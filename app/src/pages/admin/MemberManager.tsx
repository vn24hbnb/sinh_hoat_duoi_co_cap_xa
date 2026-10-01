import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FileSpreadsheet, Pencil, RefreshCw, Search, UserPlus } from 'lucide-react'
import { tenantService } from '../../services/tenantService'
import { supabase } from '../../services/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'

type Branch = { id: string; name: string }
type Member = { id: string; full_name: string; date_of_birth: string; chi_bo_id: string; is_active: boolean }
type PersonRow = { full_name: string; date_of_birth: string }
type EditForm = Member
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900'

function parseDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-')
  }
  if (typeof value === 'number') {
    const parsed = new Date(Math.round((value-25569)*86400000))
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0,10)
  }
  if (typeof value !== 'string') return ''
  const raw = value.trim()
  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return ''
}
const duplicateKey = (row: PersonRow) => `${row.full_name.trim().toLocaleLowerCase('vi')}|${row.date_of_birth}`

async function fetchOrganizationMembers(organizationId:string) {
  const [branches,members]=await Promise.all([
    supabase.from('chi_bos').select('id,name').eq('organization_id',organizationId).order('sort_order'),
    supabase.from('members').select('id,full_name,date_of_birth,chi_bo_id,is_active').eq('organization_id',organizationId).order('full_name')
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
  const [form,setForm]=useState({full_name:'',date_of_birth:'',chi_bo_id:''})
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
  const localKeys=new Set(members.filter(m=>m.chi_bo_id===importBranch).map(duplicateKey))
  const duplicateCounts=new Map<string,number>()
  for(const row of importRows)duplicateCounts.set(duplicateKey(row),(duplicateCounts.get(duplicateKey(row))||0)+1)
  const duplicates=importRows.filter(r=>localKeys.has(duplicateKey(r))||(duplicateCounts.get(duplicateKey(r))||0)>1).length

  async function invoke(action:string,payload:Record<string,unknown>={}) {
    const {data,error:invokeError}=await supabase.functions.invoke('admin-members',{body:{action,organization_id:tenantService.requireOrganizationId(),...payload}})
    if(invokeError)throw new Error('Máy chủ chưa xử lý được yêu cầu quản lý tài khoản.')
    if(data?.error)throw new Error(data.error)
    return data
  }
  async function saveNew(e:React.FormEvent) {
    e.preventDefault();setError('');setMessage('')
    if(!form.full_name.trim()||!form.date_of_birth||!form.chi_bo_id)return
    setBusy(true)
    try {await invoke('create',form);setForm({full_name:'',date_of_birth:'',chi_bo_id:form.chi_bo_id});setMessage('Đã thêm đảng viên và tạo tài khoản đăng nhập. Mật khẩu mặc định: 123456.');await load()}
    catch(e){setError(e instanceof Error?e.message:'Chưa thêm được đảng viên.')}
    finally{setBusy(false)}
  }
  async function saveEdit(e:React.FormEvent) {
    e.preventDefault();if(!editing)return
    setBusy(true);setError('')
    try {await invoke('update',{member_id:editing.id,full_name:editing.full_name,date_of_birth:editing.date_of_birth,chi_bo_id:editing.chi_bo_id});setEditing(null);setMessage('Đã cập nhật thông tin đảng viên.');await load()}
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
      const normalized=(v:unknown)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      const worksheets=workbook.SheetNames.map(sheetName=>{
        const rows=XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName],{header:1,raw:true,defval:''})
        let headerInfo:{header:number;nameCol:number;dobCol:number}|null=null
        for(let i=0;i<Math.min(rows.length,12);i++){
          const cells=rows[i].map(normalized)
          const nameCol=cells.findIndex(v=>v.includes('ho va ten')||v==='ho ten'||v==='ho ten dang vien')
          const dobCol=cells.findIndex(v=>v.includes('ngay sinh')||v.includes('nam sinh'))
          if(nameCol>=0&&dobCol>=0){headerInfo={header:i,nameCol,dobCol};break}
        }
        return {sheetName,rows,headerInfo}
      }).filter(sheet=>sheet.rows.some(row=>row.some(value=>String(value??'').trim()!=='')))
      const selectedSheet=worksheets.find(sheet=>sheet.headerInfo)||worksheets[0]
      if(!selectedSheet)throw new Error('Tệp không có trang tính chứa dữ liệu.')
      const {rows}=selectedSheet
      let {header,nameCol,dobCol}=selectedSheet.headerInfo||{header:-1,nameCol:-1,dobCol:-1}
      if(header<0){nameCol=1;dobCol=3;header=-1}
      const parsed:PersonRow[]=[]
      for(let i=header+1;i<rows.length;i++){
        const row=rows[i]
        const full_name=String(row[nameCol]??'').trim()
        const date_of_birth=parseDate(row[dobCol])
        if(!full_name&&!date_of_birth)continue
        parsed.push({full_name,date_of_birth})
      }
      if(!parsed.length)throw new Error('Không nhận ra cột Họ và tên, Ngày sinh. Tệp danh sách cần có tên ở cột B và ngày sinh ở cột D.')
      const filePath=normalized(file.name)
      const expectedBranch=filePath.includes('ubnd')?'uy ban nhan dan xa':filePath.includes('coq')?'cac co quan dang':''
      const matchedBranch=branches.find(item=>normalized(item.name)===expectedBranch)
      setImportBranch(matchedBranch?.id||'')
      setFileName(`${file.name} · trang tính ${selectedSheet.sheetName}`);setImportRows(parsed)
    } catch(e) {setImportRows([]);setFileName('');setError(e instanceof Error?e.message:'Không đọc được tệp danh sách.')}
  }
  async function importRoster() {
    setBusy(true);setError('');setMessage('')
    try {
      const records=importRows.filter(r=>r.full_name&&r.date_of_birth&&!localKeys.has(duplicateKey(r)))
      const result=await invoke('import',{chi_bo_id:importBranch,records})
      setMessage(`Đã nhập ${result.created} đảng viên; bỏ qua ${result.skipped} dòng đã có.`)
      setImportRows([]);setFileName('');await load()
    } catch(e) {setError(e instanceof Error?e.message:'Chưa nhập được danh sách.')}
    finally{setBusy(false)}
  }

  if(!organizationId||dataOrganizationId!==organizationId)return <PatternBackground>
    <PortalHeader/><RedNavigationBar isAuthenticated/>
    <main className="mx-auto max-w-6xl p-4 text-center text-slate-500">{organizationId?'Đang tải danh sách đảng viên…':'Đang xác định đơn vị quản lý…'}</main>
  </PatternBackground>

  return <PatternBackground>
    <PortalHeader/><RedNavigationBar isAuthenticated/>
    <main className="mx-auto max-w-6xl space-y-5 p-4">
      <h1 className="text-2xl font-black text-red-deep dark:text-gold">Quản lý đảng viên</h1>
      {message&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <GlassCard className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-black text-red-deep dark:text-gold"><UserPlus size={18}/>Thêm đảng viên</h2>
        <form onSubmit={saveNew} className="grid gap-3 md:grid-cols-4">
          <input required placeholder="Họ và tên" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} className={inputClass}/>
          <input required type="date" value={form.date_of_birth} onChange={e=>setForm({...form,date_of_birth:e.target.value})} className={inputClass}/>
          <select required value={form.chi_bo_id} onChange={e=>setForm({...form,chi_bo_id:e.target.value})} className={inputClass}><option value="">Chọn chi bộ</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <button disabled={busy} className="rounded-xl bg-red-revolution px-4 py-2 font-bold text-white disabled:opacity-50">Thêm</button>
        </form>
        <form onSubmit={addBranch} className="flex flex-wrap gap-3 border-t pt-3"><input placeholder="Tên chi bộ mới" value={branchName} onChange={e=>setBranchName(e.target.value)} className={inputClass+' md:max-w-sm'}/><button disabled={busy||!branchName.trim()} className="rounded-xl border border-red-revolution px-4 py-2 font-bold text-red-revolution disabled:opacity-50">Thêm chi bộ</button></form>
      </GlassCard>
      <GlassCard className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-black text-red-deep dark:text-gold"><FileSpreadsheet size={18}/>Nhập danh sách từ Excel</h2>
        <p className="text-sm text-slate-600">Chỉ lấy họ tên và ngày sinh. Tệp được xem trước tại đây; tài khoản trùng tên và ngày sinh sẽ được bỏ qua.</p>
        <div className="flex flex-wrap items-center gap-3">
          <select value={importBranch} onChange={e=>setImportBranch(e.target.value)} className={inputClass+' md:max-w-xs'}><option value="">Chọn chi bộ</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <input aria-label="Chọn tệp Excel" type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const file=e.target.files?.[0];if(file)void readWorkbook(file)}} className="max-w-full text-sm"/>
          {fileName&&<span className="text-sm font-medium">{fileName}</span>}
        </div>
        {importRows.length>0&&<><div className="max-h-64 overflow-auto rounded border"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-amber-50"><tr><th className="p-2">Họ và tên</th><th>Ngày sinh</th><th>Trạng thái</th></tr></thead><tbody>{importRows.map((r,i)=>{const duplicate=localKeys.has(duplicateKey(r))||(duplicateCounts.get(duplicateKey(r))||0)>1;return <tr key={i} className="border-t"><td className="p-2">{r.full_name||<span className="text-rose-700">Thiếu họ tên</span>}</td><td>{r.date_of_birth||<span className="text-rose-700">Thiếu ngày sinh</span>}</td><td>{duplicate?<span className="text-amber-700">Trùng, sẽ bỏ qua</span>:r.full_name&&r.date_of_birth?'Sẵn sàng':'Dữ liệu cần bổ sung'}</td></tr>})}</tbody></table></div><p className="text-xs text-slate-500">Có {importRows.length} dòng, {duplicates} dòng trùng hoặc đã có trong danh sách.</p><button onClick={()=>void importRoster()} disabled={busy||!importBranch||importRows.filter(r=>r.full_name&&r.date_of_birth&&!localKeys.has(duplicateKey(r))&&duplicateCounts.get(duplicateKey(r))===1).length===0} className="rounded-xl bg-red-revolution px-5 py-2 font-bold text-white disabled:opacity-50">{busy?'Đang nhập…':'Xác nhận nhập danh sách'}</button></>}
      </GlassCard>
      <GlassCard className="p-5">
        <div className="mb-4 flex flex-wrap gap-3">
          <select value={branch} onChange={e=>setBranch(e.target.value)} className={inputClass+' md:max-w-xs'}><option value="">Tất cả chi bộ</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <div className="relative min-w-[220px] flex-1"><Search size={17} className="absolute left-3 top-3.5 text-slate-400"/><input placeholder="Tìm theo họ tên" value={search} onChange={e=>setSearch(e.target.value)} className={inputClass+' pl-10'}/></div>
          <span className="self-center text-sm">{filtered.length} đảng viên</span>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Họ tên</th><th>Ngày sinh</th><th>Chi bộ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
          {filtered.map(m=><tr key={m.id} className="border-t"><td className="p-2">{m.full_name}</td><td>{m.date_of_birth||'—'}</td><td>{branches.find(b=>b.id===m.chi_bo_id)?.name||'—'}</td><td>{m.is_active?'Đang hoạt động':'Đã khóa'}</td><td className="space-x-2 whitespace-nowrap">
            <button aria-label={`Sửa ${m.full_name}`} onClick={()=>setEditing({...m})} className="text-blue-700 underline"><Pencil size={15} className="inline"/> Sửa</button>
            <button disabled={busy} onClick={()=>void toggle(m)} className="text-red-700 underline">{m.is_active?'Khóa':'Mở lại'}</button>
            <button disabled={busy} onClick={()=>void resetPassword(m)} className="text-slate-700 underline"><RefreshCw size={14} className="inline"/> Mật khẩu</button>
          </td></tr>)}
        </tbody></table></div>
      </GlassCard>
      <p className="text-xs text-slate-500">Tài khoản mới và đặt lại mật khẩu dùng mặc định 123456. Có thể tự đổi mật khẩu sau khi đăng nhập.</p>
    </main>
    {editing&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><GlassCard className="w-full max-w-md space-y-4 bg-white p-5 dark:bg-slate-900"><h2 className="font-black">Sửa thông tin đảng viên</h2><form onSubmit={saveEdit} className="space-y-3"><label className="block text-sm">Họ và tên<input required value={editing.full_name} onChange={e=>setEditing({...editing,full_name:e.target.value})} className={inputClass}/></label><label className="block text-sm">Ngày sinh<input required type="date" value={editing.date_of_birth} onChange={e=>setEditing({...editing,date_of_birth:e.target.value})} className={inputClass}/></label><label className="block text-sm">Chi bộ<select value={editing.chi_bo_id} onChange={e=>setEditing({...editing,chi_bo_id:e.target.value})} className={inputClass}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><div className="flex justify-end gap-3"><button type="button" onClick={()=>setEditing(null)} className="rounded-lg border px-4 py-2">Hủy</button><button disabled={busy} className="rounded-lg bg-red-revolution px-4 py-2 font-bold text-white">Lưu thay đổi</button></div></form></GlassCard></div>}
  </PatternBackground>
}
