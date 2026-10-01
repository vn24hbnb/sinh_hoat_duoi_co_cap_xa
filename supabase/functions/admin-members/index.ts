import { createClient } from 'npm:@supabase/supabase-js@2.107.0'

const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' }
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return reply({error:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL')!, serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
 const authHeader=req.headers.get('Authorization')||''
 if(!authHeader.startsWith('Bearer '))return reply({error:'Vui lòng đăng nhập lại.'},401)
 const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}})
 const token=authHeader.slice(7)
 const {data:{user:caller},error:authError}=await admin.auth.getUser(token)
 if(authError||!caller)return reply({error:'Phiên đăng nhập không hợp lệ.'},401)
 const {data:actor}=await admin.from('app_users').select('id,role,organization_id,is_active').eq('id',caller.id).maybeSingle()
 if(!actor?.is_active||!['admin','super_admin'].includes(actor.role))return reply({error:'Không đủ quyền quản lý.'},403)
 let input:Record<string,unknown>
 try{input=await req.json()}catch{return reply({error:'Dữ liệu gửi lên không hợp lệ.'},400)}
 const action=String(input.action||'')
const organizationId=typeof input.organization_id==='string'?input.organization_id:actor.organization_id
if(actor.role!=='super_admin'&&organizationId!==actor.organization_id)return reply({error:'Không được thao tác ngoài xã của mình.'},403)
 const audit=async(action:string,targetType:string,targetId:string|null,metadata:Record<string,unknown>={})=>{
  const {error}=await admin.from('audit_logs').insert({organization_id:organizationId,actor_id:actor.id,action,target_type:targetType,target_id:targetId,metadata})
  if(error)console.error('Không ghi được nhật ký quản trị:',error.message)
 }
 const isValidDate=(value:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
  const parsed=new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value
 }
 const createAccount=async(fullName:string,dob:string,branch:string,recordAudit=true)=>{
  const pendingEmail=`pending-${crypto.randomUUID()}@members.internal`
  const {data:created,error:createError}=await admin.auth.admin.createUser({email:pendingEmail,password:'123456',email_confirm:true})
  if(createError||!created.user)throw new Error('Không tạo được tài khoản đăng nhập.')
  const id=created.user.id
  const {error:emailError}=await admin.auth.admin.updateUserById(id,{email:`member-${id}@members.internal`,email_confirm:true})
  if(emailError){await admin.auth.admin.deleteUser(id);throw new Error('Không hoàn tất được tên đăng nhập.')}
  const {error:memberError}=await admin.from('members').insert({id,organization_id:organizationId,chi_bo_id:branch,full_name:fullName,date_of_birth:dob,is_active:true})
  if(memberError){await admin.auth.admin.deleteUser(id);throw new Error(memberError.code==='23505'?'Đảng viên có tên và ngày sinh này đã có trong chi bộ.':'Không lưu được thông tin đảng viên.')}
  const {error:userError}=await admin.from('app_users').insert({id,organization_id:organizationId,member_id:id,username:`member-${id.slice(0,8)}`,role:'member',is_active:true,must_change_password:false})
  if(userError){await admin.from('members').delete().eq('id',id);await admin.auth.admin.deleteUser(id);throw new Error('Không hoàn tất được tài khoản; thao tác đã được hoàn tác.')}
  if(recordAudit)await audit('CREATE_MEMBER','members',id)
  return id
 }
 if(action==='create_branch'){
  const name=typeof input.name==='string'?input.name.trim():''
  if(!name||name.length>160)return reply({error:'Tên chi bộ không hợp lệ.'},400)
  const {data:branch,error}=await admin.from('chi_bos').insert({organization_id:organizationId,name,is_active:true}).select('id,name').single()
  if(error)return reply({error:error.code==='23505'?'Tên chi bộ này đã tồn tại.':'Không tạo được chi bộ.'},400)
  await audit('CREATE_BRANCH','chi_bos',branch.id)
  return reply(branch)
 }
 if(action==='import'){
  const branch=typeof input.chi_bo_id==='string'?input.chi_bo_id:''
  const records=Array.isArray(input.records)?input.records as Array<Record<string,unknown>>:[]
  if(records.length<1||records.length>200||!branch)return reply({error:'Chọn một chi bộ và nhập tối đa 200 dòng mỗi lần.'},400)
  const {data:chiBo}=await admin.from('chi_bos').select('id').eq('id',branch).eq('organization_id',organizationId).eq('is_active',true).maybeSingle()
  if(!chiBo)return reply({error:'Chi bộ không thuộc xã đang quản lý.'},400)
  const inputRows=records.map(r=>({full_name:typeof r.full_name==='string'?r.full_name.trim():'',date_of_birth:typeof r.date_of_birth==='string'?r.date_of_birth:''}))
  if(inputRows.some(r=>!r.full_name||r.full_name.length>200||!isValidDate(r.date_of_birth)))return reply({error:'Có dòng thiếu họ tên hoặc ngày sinh không hợp lệ.'},400)
  const keys=new Set<string>()
  if(inputRows.some(r=>{const k=`${r.full_name.toLocaleLowerCase('vi')}|${r.date_of_birth}`;if(keys.has(k))return true;keys.add(k);return false}))return reply({error:'Tệp có dòng tên và ngày sinh bị lặp. Hãy xử lý trong phần xem trước.'},400)
  const {data:existing}=await admin.from('members').select('full_name,date_of_birth').eq('organization_id',organizationId).eq('chi_bo_id',branch)
  const existingKeys=new Set((existing||[]).map(r=>`${String(r.full_name).toLocaleLowerCase('vi')}|${r.date_of_birth}`))
  const pending=inputRows.filter(r=>!existingKeys.has(`${r.full_name.toLocaleLowerCase('vi')}|${r.date_of_birth}`))
  const createdIds:string[]=[];let next=0;let failure:Error|null=null
  const worker=async()=>{while(!failure){const i=next++;if(i>=pending.length)return;try{createdIds.push(await createAccount(pending[i].full_name,pending[i].date_of_birth,branch,false))}catch(error){failure=error instanceof Error?error:new Error('Không tạo được tài khoản.');return}}}
  await Promise.all(Array.from({length:Math.min(6,pending.length)},()=>worker()))
  if(failure){await admin.from('app_users').delete().in('id',createdIds);await admin.from('members').delete().in('id',createdIds);await Promise.all(createdIds.map(id=>admin.auth.admin.deleteUser(id)));return reply({error:`${failure.message} Đã hoàn tác các tài khoản vừa tạo.`},400)}
  await audit('IMPORT_MEMBERS','chi_bos',branch,{created:createdIds.length,skipped:inputRows.length-pending.length})
  return reply({created:createdIds.length,skipped:inputRows.length-pending.length})
 }
 if(action==='create'){
  const fullName=typeof input.full_name==='string'?input.full_name.trim():''
  const dob=typeof input.date_of_birth==='string'?input.date_of_birth:''
  const branch=typeof input.chi_bo_id==='string'?input.chi_bo_id:''
  if(!fullName||fullName.length>200||!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!branch)return reply({error:'Cần nhập họ tên, ngày sinh và chi bộ.'},400)
  const {data:chiBo}=await admin.from('chi_bos').select('id').eq('id',branch).eq('organization_id',organizationId).eq('is_active',true).maybeSingle()
  if(!chiBo)return reply({error:'Chi bộ không thuộc xã đang quản lý.'},400)
  try{const id=await createAccount(fullName,dob,branch);return reply({id})}catch(error){return reply({error:error instanceof Error?error.message:'Không tạo được đảng viên.'},400)}
 }
 if(action==='activate'||action==='deactivate'){
  const memberId=typeof input.member_id==='string'?input.member_id:''
  const active=action==='activate'
  const {data:member}=await admin.from('members').select('id,organization_id').eq('id',memberId).maybeSingle()
  if(!member||member.organization_id!==organizationId)return reply({error:'Không tìm thấy đảng viên trong xã đang quản lý.'},404)
  const {error}=await admin.from('members').update({is_active:active,updated_at:new Date().toISOString()}).eq('id',memberId)
  if(error)return reply({error:'Không cập nhật được thông tin đảng viên.'},400)
  const {error:userError}=await admin.from('app_users').update({is_active:active,updated_at:new Date().toISOString()}).eq('member_id',memberId)
  if(userError)return reply({error:'Đã cập nhật hồ sơ nhưng chưa đồng bộ trạng thái tài khoản. Vui lòng thử lại.'},500)
  await audit(active?'ACTIVATE_MEMBER':'DEACTIVATE_MEMBER','members',memberId)
  return reply({ok:true})
 }
 if(action==='update'){
  const memberId=typeof input.member_id==='string'?input.member_id:''
  const fullName=typeof input.full_name==='string'?input.full_name.trim():''
  const dob=typeof input.date_of_birth==='string'?input.date_of_birth:''
  const branch=typeof input.chi_bo_id==='string'?input.chi_bo_id:''
  const {data:chiBo}=await admin.from('chi_bos').select('id').eq('id',branch).eq('organization_id',organizationId).maybeSingle()
  if(!memberId||!fullName||!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!chiBo)return reply({error:'Thông tin cập nhật chưa hợp lệ.'},400)
  const {error}=await admin.from('members').update({full_name:fullName,date_of_birth:dob,chi_bo_id:branch,updated_at:new Date().toISOString()}).eq('id',memberId).eq('organization_id',organizationId)
  if(error)return reply({error:'Không cập nhật được đảng viên.'},400)
  await audit('UPDATE_MEMBER','members',memberId)
  return reply({ok:true})
 }
 if(action==='reset_password'){
  const memberId=typeof input.member_id==='string'?input.member_id:''
  const {data:member}=await admin.from('members').select('id,organization_id').eq('id',memberId).maybeSingle()
  if(!member||member.organization_id!==organizationId)return reply({error:'Không tìm thấy đảng viên trong xã đang quản lý.'},404)
  const {data:{user:account},error:getError}=await admin.auth.admin.getUserById(memberId)
  if(getError||!account)return reply({error:'Không tìm thấy tài khoản đăng nhập.'},404)
  const {error}=await admin.auth.admin.updateUserById(account.id,{password:'123456'})
  if(error)return reply({error:'Không đặt lại được mật khẩu.'},400)
  await audit('RESET_MEMBER_PASSWORD','members',memberId)
  return reply({ok:true,temporaryPassword:'123456'})
 }
 return reply({error:'Thao tác không được hỗ trợ.'},400)
})
