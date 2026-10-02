import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FileSpreadsheet, Pencil, RefreshCw, Search, UserPlus } from 'lucide-react'
import { tenantService } from '../../services/tenantService'
import { supabase } from '../../services/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { BranchManager } from '../../components/ui/BranchManager'

type Branch = { id: string; name: string }
type Member = { id: string; full_name: string; date_of_birth: string | null; chi_bo_id: string; position: string | null; is_active: boolean }
type PersonRow = { full_name: string; date_of_birth: string; source_date_of_birth: string; identity_problem: boolean; identity_confirmed: boolean; chi_bo_id: string; branch_name: string; branch_source: 'sheet'|'default'|'unresolved'; worksheet: string; row_number: number }
type EditForm = Omit<Member, 'position'> & { position: string }
const MEMBER_POSITIONS = [
  'Đảng viên',
  'Bí thư Đảng ủy',
  'Phó Bí thư Đảng ủy',
  'Đảng ủy viên',
  'Bí thư chi bộ',
  'Phó Bí thư chi bộ',
  'Chi ủy viên',
  'Chủ nhiệm Ủy ban kiểm tra',
  'Trưởng ban',
  'Phó Trưởng ban',
] as const
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900'

function parseDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return validateDate([value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-'))
  }
  if (typeof value === 'number') {
    const parsed = new Date(Date.UTC(1899,11,30)+Math.round(value*86400000))
    if (!Number.isNaN(parsed.getTime())) return validateDate(parsed.toISOString().slice(0,10))
  }
  if (typeof value !== 'string') return ''
  const raw = value.trim()
  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (dmy) return validateDate(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return validateDate(raw)
  return ''
}
function validateDate(value:string):string {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return ''
  const [year,month,day]=value.split('-').map(Number)
  const parsed=new Date(Date.UTC(year,month-1,day))
  return parsed.getUTCFullYear()===year&&parsed.getUTCMonth()===month-1&&parsed.getUTCDate()===day?value:''
}
const normalizedName = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase('vi')
const normalizedLabel = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/\s+/g,' ').trim()
const normalizedBranch = (value: unknown) => normalizedLabel(value).replace(/[^a-z0-9\s]/g,' ').replace(/\bund\b/g,'ubnd').replace(/\s+/g,' ').trim()
const samePersonName = (a: Pick<PersonRow,'full_name'|'chi_bo_id'>, b: Pick<PersonRow,'full_name'|'chi_bo_id'>) =>
  Boolean(a.chi_bo_id && b.chi_bo_id) && a.chi_bo_id === b.chi_bo_id && normalizedName(a.full_name) === normalizedName(b.full_name)
const sameMember = (a: Pick<PersonRow,'full_name'|'date_of_birth'|'chi_bo_id'>, b: Pick<PersonRow,'full_name'|'date_of_birth'|'chi_bo_id'>) =>
  samePersonName(a,b) && a.date_of_birth === b.date_of_birth

async function fetchOrganizationMembers(organizationId:string) {
  const [branches,members]=await Promise.all([
    supabase.from('chi_bos').select('id,name').eq('organization_id',organizationId).order('sort_order'),
    supabase.from('members').select('id,full_name,date_of_birth,chi_bo_id,position,is_active').eq('organization_id',organizationId).order('full_name')
  ])
  if(branches.error)throw branches.error
  if(members.error)throw members.error
  return {branches:branches.data||[],members:members.data||[]}
}

export default function MemberManager() {
  const { organizationId } = useAuth()
  const [branches,setBranches]=useState<Branch[]>([])
  const [members,setMembers]=useState<Member[]>([])
  const [dataOrganizationId,setDataOrganizationId]=useState<string|null>(null)
  const loadRequest=useRef(0)
  const [branch,setBranch]=useState('')
  const [search,setSearch]=useState('')
  const [form,setForm]=useState({full_name:'',date_of_birth:'',chi_bo_id:'',position:'Đảng viên'})
  const [editing,setEditing]=useState<EditForm|null>(null)
  const [importRows,setImportRows]=useState<PersonRow[]>([])
  const [fileName,setFileName]=useState('')
  const [importBranch,setImportBranch]=useState('')
  const [branchName,setBranchName]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  async function load(){
    if(!organizationId)return
    const request=++loadRequest.current
    setBusy(true)
    try {
      const {branches,members}=await fetchOrganizationMembers(organizationId)
      if(request!==loadRequest.current)return
      setBranches(branches)
      setMembers(members)
      setBranch(v=>branches.some(item=>item.id===v)?v:branches[0]?.id||'')
      setImportBranch(v=>branches.some(item=>item.id===v)?v:'')
      setDataOrganizationId(organizationId)
    } catch(e) {
      if(request!==loadRequest.current)return
      setError(e instanceof Error?e.message:'Không tải được danh sách đảng viên.')
    } finally {if(request===loadRequest.current)setBusy(false)}
  }
  useEffect(()=>{
    if(!organizationId)return
    const request=++loadRequest.current
    void fetchOrganizationMembers(organizationId).then(({branches,members})=>{
      if(request!==loadRequest.current)return
      setImportRows([])
      setFileName('')
      setImportBranch('')
      setBranches(branches)
      setMembers(members)
      setBranch(v=>branches.some(item=>item.id===v)?v:branches[0]?.id||'')
      setImportBranch(v=>branches.some(item=>item.id===v)?v:'')
      setDataOrganizationId(organizationId)
    }).catch(e=>{
      if(request===loadRequest.current)setError(e instanceof Error?e.message:'Không tải được danh sách đảng viên.')
    })
    return()=>{if(request===loadRequest.current)loadRequest.current+=1}
  },[organizationId])

  const filtered=useMemo(()=>members.filter(m=>(!branch||m.chi_bo_id===branch)&&(!search||m.full_name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))),[members,branch,search])
  const isDuplicate=(row:PersonRow,index:number)=>members.some(member=>sameMember(row,{...member,date_of_birth:member.date_of_birth||''}))||importRows.slice(0,index).some(other=>sameMember(row,other))
  const needsIdentityReview=(row:PersonRow,index:number)=>!isDuplicate(row,index)&&(members.some(member=>samePersonName(row,member)&&!sameMember(row,{...member,date_of_birth:member.date_of_birth||''}))||importRows.slice(0,index).some(other=>samePersonName(row,other)&&!sameMember(row,other)))
  const duplicates=importRows.filter(isDuplicate).length
  const identityReviews=importRows.filter((row,index)=>needsIdentityReview(row,index)&&!row.identity_confirmed).length
  const identityProblems=importRows.filter(row=>row.identity_problem).length
  const readyRows=importRows.filter((row,index)=>row.full_name&&row.chi_bo_id&&!row.identity_problem&&!isDuplicate(row,index)&&(!needsIdentityReview(row,index)||row.identity_confirmed))

  async function invoke(action:string,payload:Record<string,unknown>={}) {
    const {data,error:invokeError}=await supabase.functions.invoke('admin-members',{body:{action,organization_id:tenantService.requireOrganizationId(),...payload}})
    if(invokeError)throw new Error('Máy chủ chưa xử lý được yêu cầu quản lý tài khoản.')
    if(data?.error)throw new Error(data.error)
    return data
  }
  async function saveNew(e:React.FormEvent) {
    e.preventDefault();setError('');setMessage('')
    if(!form.full_name.trim()||!form.chi_bo_id)return
    setBusy(true)
    try {await invoke('create',form);setForm({full_name:'',date_of_birth:'',chi_bo_id:form.chi_bo_id,position:'Đảng viên'});setMessage('Đã thêm đảng viên và tạo tài khoản đăng nhập. Mật khẩu mặc định: 123456.');await load()}
    catch(e){setError(e instanceof Error?e.message:'Chưa thêm được đảng viên.')}
    finally{setBusy(false)}
  }
  async function saveEdit(e:React.FormEvent) {
    e.preventDefault();if(!editing)return
    setBusy(true);setError('')
    try {await invoke('update',{member_id:editing.id,full_name:editing.full_name,date_of_birth:editing.date_of_birth,chi_bo_id:editing.chi_bo_id,position:editing.position});setEditing(null);setMessage('Đã cập nhật thông tin đảng viên và chức vụ.');await load()}
    catch(e){setError(e instanceof Error?e.message:'Chưa cập nhật được.')}
    finally{setBusy(false)}
  }
  async function toggle(member:Member) {
    setBusy(true);setError('')
    try {await invoke(member.is_active?'deactivate':'activate',{member_id:member.id});setMessage(member.is_active?'Đã khóa tài khoản.':'Đã mở lại tài khoản.');await load()}
    catch(e){setError(e instanceof Error?e.message:'Chưa cập nhật được.')}
    finally{setBusy(false)}
  }
  async function resetPassword(member:Member) {
    if(!window.confirm(`Đặt lại mật khẩu cho ${member.full_name} về 123456?`))return
    setBusy(true)
    try {await invoke('reset_password',{member_id:member.id});setMessage(`Đã đặt lại mật khẩu của ${member.full_name} về 123456.`)}
    catch(e){setError(e instanceof Error?e.message:'Chưa đặt lại mật khẩu được.')}
    finally{setBusy(false)}
  }
  async function addBranch(e:React.FormEvent) {
    e.preventDefault();if(!branchName.trim())return
    setBusy(true);setError('')
    try {const added=await invoke('create_branch',{name:branchName.trim()});setBranchName('');setMessage(`Đã thêm chi bộ ${added.name}.`);await load()}
    catch(e){setError(e instanceof Error?e.message:'Chưa tạo được chi bộ.')}
    finally{setBusy(false)}
  }
  async function readWorkbook(file:File) {
    setError('');setMessage('')
    try {
      const XLSX=await import('xlsx')
      const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true})
      const normalized=normalizedLabel
      const fileLabel=normalized(file.name)
      const fileBranch=fileLabel.includes('ubnd')?branches.find(item=>normalizedBranch(item.name)==='uy ban nhan dan xa'):
        fileLabel.includes('coq')?branches.find(item=>normalizedBranch(item.name)==='cac co quan dang'):undefined
      const filenameBranchId=fileBranch?.id||''
      const worksheets=workbook.SheetNames.map(sheetName=>{
        const rows=XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName],{header:1,raw:true,defval:''})
        let headerInfo:{header:number;nameCol:number;dobCol:number|null;serialCol:number|null}|null=null
        for(let i=0;i<Math.min(rows.length,20);i++){
          const cells=rows[i].map(normalized)
          const nameCol=cells.findIndex(v=>v.includes('ho va ten')||v==='ho ten'||v==='ho ten dang vien'||(v.includes('ho')&&v.includes('ten')))
          const dobCol=cells.findIndex(v=>v.includes('ngay sinh')||v.includes('nam sinh'))
          const serialCol=cells.findIndex(v=>v==='stt'||v==='so tt'||v.includes('so thu tu')||v==='thu tu')
          if(nameCol>=0){headerInfo={header:i,nameCol,dobCol:dobCol>=0?dobCol:null,serialCol:serialCol>=0?serialCol:null};break}
        }
        const branch=branches.find(item=>normalizedBranch(item.name)===normalizedBranch(sheetName))
        return {sheetName,rows,headerInfo,matchedBranchId:branch?.id||''}
      }).filter(sheet=>{
        const hasContent=sheet.rows.some(row=>row.some(value=>String(value??'').trim()!==''))
        return hasContent&&Boolean(sheet.headerInfo||sheet.matchedBranchId||['ca xa','qs xa'].includes(normalized(sheet.sheetName)))
      })
      const parsed:PersonRow[]=[]
      for(const sheet of worksheets){
        const sheetKey=normalizedBranch(sheet.sheetName)
        const matchedBranch=branches.find(item=>normalizedBranch(item.name)===sheetKey)
        const fallbackId=filenameBranchId||(worksheets.length===1?importBranch:'')
        const defaultBranchId=matchedBranch?.id||fallbackId
        const branchSource:PersonRow['branch_source']=matchedBranch?'sheet':defaultBranchId?'default':'unresolved'
        const header=sheet.headerInfo?.header??-1
        let nameCol=sheet.headerInfo?.nameCol??1
        const dobCol=sheet.headerInfo?.dobCol??(sheet.headerInfo?null:3)
        let serialCol=sheet.headerInfo?.serialCol??(['ca xa','qs xa'].includes(normalized(sheet.sheetName))?0:null)
        let firstDataRow=header+1
        if(!sheet.headerInfo&&['ca xa','qs xa'].includes(normalized(sheet.sheetName))){firstDataRow=4;nameCol=1}
        // Some source sheets merge or shift the STT column, leaving the header
        // in one column and every serial value blank in the data rows.
        if(serialCol!==null){
          const candidateSerialCol=serialCol
          if(!sheet.rows.slice(firstDataRow).some(row=>/^\d+$/.test(String(row[candidateSerialCol]??'').trim())))serialCol=null
        }
        for(let i=firstDataRow;i<sheet.rows.length;i++){
          const row=sheet.rows[i]
          const rawName=row[nameCol]
          if(typeof rawName!=='string')continue
          const full_name=rawName.trim().replace(/\s+/g,' ').normalize('NFC')
          if(!full_name)continue
          const normalizedPerson=normalized(full_name)
          if(full_name.length>200||/\d/.test(full_name)||/^(ho va ten|ho ten|danh sach|tong so|ghi chu|chu thich)\b/.test(normalizedPerson)||normalizedPerson==='cong'||normalizedPerson.startsWith('cong tong '))continue
          if(serialCol!==null&&!/^\d+$/.test(String(row[serialCol]??'').trim()))continue
          const rawDob=dobCol===null?'':row[dobCol]
          const source_date_of_birth=parseDate(rawDob)
          const rowBranchId=defaultBranchId
          const branch_name=branches.find(item=>item.id===rowBranchId)?.name||sheet.sheetName.trim()
          parsed.push({full_name,date_of_birth:'',source_date_of_birth,identity_problem:false,identity_confirmed:false,chi_bo_id:rowBranchId,branch_name,branch_source:branchSource,worksheet:sheet.sheetName,row_number:i+1})
        }
      }
      if(!parsed.length)throw new Error('Không tìm thấy dòng có họ tên trong tệp.')
      const sameNameGroups=new Map<string,number[]>()
      parsed.forEach((row,index)=>{
        if(!row.chi_bo_id)return
        const key=`${row.chi_bo_id}:${normalizedName(row.full_name)}`
        sameNameGroups.set(key,[...(sameNameGroups.get(key)||[]),index])
      })
      for(const indexes of sameNameGroups.values()){
        if(indexes.length<2)continue
        const dates=indexes.map(index=>parsed[index].source_date_of_birth)
        const canDisambiguate=dates.every(Boolean)&&new Set(dates).size===dates.length
        if(!canDisambiguate){indexes.forEach(index=>{parsed[index].identity_problem=true});continue}
        indexes.forEach((index,position)=>{
          const [year,month,day]=dates[position].split('-')
          parsed[index].full_name=`${parsed[index].full_name} (${day}/${month}/${year})`
        })
      }
      setImportBranch(filenameBranchId||(worksheets.length===1?importBranch:''))
      setFileName(`${file.name} · ${worksheets.length} trang tính · ${parsed.length} dòng`);setImportRows(parsed)
    } catch(e) {setImportRows([]);setFileName('');setError(e instanceof Error?e.message:'Không đọc được tệp danh sách.')}
  }
  async function importRoster() {
    setBusy(true);setError('');setMessage('')
    let created=0,skipped=duplicates
    const completedBranches:string[]=[]
    try {
      if(identityProblems)throw new Error('Có tên trùng nhưng thiếu ngày sinh phân biệt hoặc ngày sinh bị lặp/sai định dạng. Hãy kiểm tra và sửa danh sách gốc trước khi nhập để tránh mất người.')
      if(importRows.some(row=>!row.chi_bo_id))throw new Error('Có trang tính chưa khớp với chi bộ trong xã. Hãy chọn chi bộ mặc định hoặc kiểm tra tên trang tính.')
      const groups=new Map<string,PersonRow[]>()
      readyRows.forEach(row=>groups.set(row.chi_bo_id,[...(groups.get(row.chi_bo_id)||[]),row]))
      for(const [chi_bo_id,rows] of groups){
        const result=await invoke('import',{chi_bo_id,records:rows.map(({full_name})=>({full_name,date_of_birth:''}))})
        created+=Number(result.created)||0;skipped+=Number(result.skipped)||0
        completedBranches.push(branches.find(item=>item.id===chi_bo_id)?.name||'chi bộ')
      }
      setMessage(`Đã nhập ${created} đảng viên; bỏ qua ${skipped} dòng trùng hoặc đã có.`)
      setImportRows([]);setFileName('');await load()
    } catch(e) {
      const detail=e instanceof Error?e.message:'Chưa nhập được danh sách.'
      if(completedBranches.length){await load();setMessage(`Đã nhập ${created} đảng viên ở ${completedBranches.join(', ')} trước khi gặp lỗi.`);setError(`${detail} Các chi bộ đã hoàn tất được giữ nguyên dữ liệu.`)}
      else setError(detail)
    }
    finally{setBusy(false)}
  }

  if(!organizationId||dataOrganizationId!==organizationId)return <PatternBackground>
    <PortalHeader/><RedNavigationBar isAuthenticated/>
    <main className="mx-auto max-w-6xl p-4 text-center text-muted">{organizationId?'Đang tải danh sách đảng viên…':'Đang xác định đơn vị quản lý…'}</main>
  </PatternBackground>

  return <PatternBackground>
    <PortalHeader/><RedNavigationBar isAuthenticated/>
    <main className="mx-auto max-w-6xl space-y-5 p-4">
      <h1 className="text-2xl font-bold text-red-deep dark:text-gold">Quản lý đảng viên</h1>
      {message&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <GlassCard className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-bold text-red-deep dark:text-gold"><UserPlus size={18}/>Thêm đảng viên</h2>
        <form onSubmit={saveNew} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input required placeholder="Họ và tên" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} className={inputClass}/>
          <input type="date" aria-label="Ngày sinh (không bắt buộc)" value={form.date_of_birth} onChange={e=>setForm({...form,date_of_birth:e.target.value})} className={inputClass}/>
          <select required value={form.chi_bo_id} onChange={e=>setForm({...form,chi_bo_id:e.target.value})} className={inputClass}><option value="">Chọn chi bộ</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select aria-label="Chức vụ" value={form.position} onChange={e=>setForm({...form,position:e.target.value})} className={inputClass}>{MEMBER_POSITIONS.map(position=><option key={position} value={position}>{position}</option>)}</select>
          <button disabled={busy} className="rounded-xl bg-red-revolution px-4 py-2 font-bold text-white disabled:opacity-50">Thêm</button>
        </form>
      </GlassCard>
      <GlassCard className="space-y-3 p-5">
        <h2 className="font-bold text-red-deep dark:text-gold">Quản lý chi bộ của xã đang chọn</h2>
        <form onSubmit={addBranch} className="flex flex-wrap gap-3"><input required maxLength={200} aria-label="Tên chi bộ mới" placeholder="Tên chi bộ mới" value={branchName} onChange={e=>setBranchName(e.target.value)} className={inputClass+' md:max-w-sm'}/><button disabled={busy||!branchName.trim()} className="rounded-xl border border-red-revolution px-4 py-2 font-bold text-red-revolution disabled:opacity-50">Thêm chi bộ</button></form>
        <BranchManager key={organizationId} organizationId={organizationId} branches={branches} members={members} disabled={busy} onChanged={load}/>
      </GlassCard>
      <GlassCard className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-bold text-red-deep dark:text-gold"><FileSpreadsheet size={18}/>Nhập danh sách từ Excel</h2>
        <p className="text-sm text-muted">Chỉ lấy họ tên; ngày sinh trong cơ sở dữ liệu sẽ để trống. Nếu trùng họ tên trong cùng chi bộ, ngày sinh trong tệp chỉ được dùng để thêm vào sau tên nhằm phân biệt, không lưu vào trường ngày sinh. Tên trang tính được dùng để nhận diện chi bộ.</p>
        <div className="flex flex-wrap items-center gap-3">
          <select value={importBranch} onChange={e=>{const value=e.target.value;setImportBranch(value);const fallback=branches.find(item=>item.id===value);setImportRows(rows=>rows.map(row=>row.branch_source==='sheet'?row:{...row,chi_bo_id:value,branch_name:fallback?.name||row.worksheet,branch_source:value?'default':'unresolved'}))}} className={inputClass+' md:max-w-xs'}><option value="">Chi bộ mặc định nếu tệp không chỉ rõ</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <input aria-label="Chọn tệp Excel" type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const file=e.target.files?.[0];if(file)void readWorkbook(file)}} className="max-w-full text-sm"/>
          {fileName&&<span className="text-sm font-medium">{fileName}</span>}
        </div>
        {importRows.length>0&&<><div className="max-h-64 overflow-auto rounded border"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-amber-50"><tr><th className="p-2">Họ và tên</th><th>Ngày sinh</th><th>Chi bộ</th><th>Trang tính / dòng</th><th>Trạng thái</th></tr></thead><tbody>{importRows.map((r,i)=>{const duplicate=isDuplicate(r,i);const needsReview=needsIdentityReview(r,i);return <tr key={`${r.worksheet}-${r.row_number}-${i}`} className="border-t"><td className="p-2">{r.full_name}</td><td>—</td><td>{r.chi_bo_id?r.branch_name:<span className="text-rose-700">{r.branch_name} (chưa khớp)</span>}</td><td>{r.worksheet} · {r.row_number}</td><td>{r.identity_problem?<span className="text-rose-700">Tên trùng, chưa phân biệt được</span>:duplicate?<span className="text-amber-700">Trùng chính xác, sẽ bỏ qua</span>:needsReview?<label className="flex items-start gap-2 text-amber-800"><input type="checkbox" checked={r.identity_confirmed} onChange={e=>setImportRows(rows=>rows.map((item,index)=>index===i?{...item,identity_confirmed:e.target.checked}:item))}/> Xác nhận là người khác</label>:r.chi_bo_id?'Sẵn sàng':'Chưa nhận diện chi bộ'}</td></tr>})}</tbody></table></div><p className="text-xs text-muted">Có {importRows.length} dòng, {readyRows.length} dòng sẵn sàng, {duplicates} dòng trùng chính xác, {identityReviews} trường hợp trùng tên cần xác nhận.</p>{identityProblems>0&&<p className="text-sm text-rose-700">Có {identityProblems} dòng thuộc nhóm trùng tên nhưng không có ngày sinh riêng biệt hợp lệ. Hãy sửa danh sách gốc trước khi nhập để tránh tài khoản bị bỏ sót.</p>}{identityReviews>0&&<p className="text-sm text-amber-800">Có người cùng tên với dữ liệu hiện có nhưng thông tin ngày sinh đã được để trống. Hãy kiểm tra và xác nhận từng trường hợp trước khi nhập.</p>}<button onClick={()=>void importRoster()} disabled={busy||readyRows.length===0||identityReviews>0||identityProblems>0||importRows.some(row=>!row.chi_bo_id)} className="rounded-xl bg-red-revolution px-5 py-2 font-bold text-white disabled:opacity-50">{busy?'Đang nhập…':'Xác nhận nhập danh sách'}</button></>}
      </GlassCard>
      <GlassCard className="p-5">
        <div className="mb-4 flex flex-wrap gap-3">
          <select value={branch} onChange={e=>setBranch(e.target.value)} className={inputClass+' md:max-w-xs'}><option value="">Tất cả chi bộ</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <div className="relative min-w-[220px] flex-1"><Search size={17} className="absolute left-3 top-3.5 text-muted"/><input placeholder="Tìm theo họ tên" value={search} onChange={e=>setSearch(e.target.value)} className={inputClass+' pl-10'}/></div>
          <span className="self-center text-sm">{filtered.length} đảng viên</span>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Họ tên</th><th>Ngày sinh</th><th>Chi bộ</th><th>Chức vụ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {filtered.map(m=><tr key={m.id} className="border-t"><td className="p-2">{m.full_name}</td><td>{m.date_of_birth||'—'}</td><td>{branches.find(b=>b.id===m.chi_bo_id)?.name||'—'}</td><td>{m.position||'Đảng viên'}</td><td>{m.is_active?'Đang hoạt động':'Đã khóa'}</td><td className="space-x-2 whitespace-nowrap">
            <button aria-label={`Sửa ${m.full_name}`} onClick={()=>setEditing({...m,position:m.position||'Đảng viên'})} className="text-blue-700 underline"><Pencil size={15} className="inline"/> Sửa</button>
            <button disabled={busy} onClick={()=>void toggle(m)} className="text-red-700 underline">{m.is_active?'Khóa':'Mở lại'}</button>
            <button disabled={busy} onClick={()=>void resetPassword(m)} className="text-slate-700 underline"><RefreshCw size={14} className="inline"/> Mật khẩu</button>
          </td></tr>)}
        </tbody></table></div>
      </GlassCard>
      <p className="text-xs text-muted">Tài khoản mới dùng mật khẩu mặc định 123456. Đảng viên có thể tự đổi mật khẩu sau khi đăng nhập.</p>
    </main>
    {editing&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><GlassCard className="w-full max-w-lg space-y-4 bg-white p-5 dark:bg-slate-900"><h2 className="font-bold">Sửa thông tin đảng viên</h2><form onSubmit={saveEdit} className="space-y-3"><label className="block text-sm">Họ và tên<input required value={editing.full_name} onChange={e=>setEditing({...editing,full_name:e.target.value})} className={inputClass}/></label><label className="block text-sm">Ngày sinh<input type="date" value={editing.date_of_birth||''} onChange={e=>setEditing({...editing,date_of_birth:e.target.value})} className={inputClass}/></label><label className="block text-sm">Chi bộ<select value={editing.chi_bo_id} onChange={e=>setEditing({...editing,chi_bo_id:e.target.value})} className={inputClass}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="block text-sm">Chức vụ<select value={editing.position} onChange={e=>setEditing({...editing,position:e.target.value})} className={inputClass}>{MEMBER_POSITIONS.map(position=><option key={position} value={position}>{position}</option>)}</select></label><div className="flex justify-end gap-3"><button type="button" onClick={()=>setEditing(null)} className="rounded-lg border px-4 py-2">Hủy</button><button disabled={busy} className="rounded-lg bg-red-revolution px-4 py-2 font-bold text-white">Lưu thay đổi</button></div></form></GlassCard></div>}
  </PatternBackground>
}
