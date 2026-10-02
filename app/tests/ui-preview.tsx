// Local-only fixture: not an application route or a production build entry.
// It never makes attendance, exam, account or database mutations.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AuthContext from '../src/contexts/AuthContext'
import { RedNavigationBar } from '../src/components/layout/RedNavigationBar'
import { GlassCard } from '../src/components/ui/GlassCard'
import { AlertMessage } from '../src/components/ui/AlertMessage'
import { StatusBadge } from '../src/components/ui/StatusBadge'
import { RevolutionaryButton } from '../src/components/ui/RevolutionaryButton'
import { SessionProgress } from '../src/components/ui/SessionProgress'
import { AgendaEditor } from '../src/components/ui/AgendaEditor'
import { SatelliteMap } from '../src/components/ui/SatelliteMap'
import { BranchManager } from '../src/components/ui/BranchManager'
import '../src/index.css'
const session={id:'fixture',username:'fixture',role:'member' as const,mustChangePassword:false,memberId:'fixture',memberName:'Tài khoản kiểm thử',position:'',chiBoId:'fixture',chiBoName:'',organizationId:'fixture',organizationName:'',isGlobalAdmin:false}
export function Preview(){
  const [dark,setDark]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false)
  const [agenda,setAgenda]=useState(JSON.stringify({is_structured:true,extension:{preserved:true},items:[{tt:1,content:'Chương trình kiểm thử',moderator:'',performer:'',extension:123}]}))
  return <AuthContext.Provider value={{user:session,loading:false,organizationId:'fixture',organizations:[],login:async()=>session,logout:async()=>{},changePassword:async()=>{},selectOrganization:()=>{}}}><BrowserRouter>
    <RedNavigationBar isAuthenticated/>
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <SatelliteMap className="h-[420px]" hall={{latitude:21.327,longitude:103.91,radiusM:200,source:'meeting_settings'}} />
      <h1 className="text-2xl">Kiểm thử giao diện độc lập</h1><p className="text-muted">Không kết nối dữ liệu nghiệp vụ. Kiểm tra màu, font, cỡ chữ và thao tác an toàn.</p>
      <GlassCard><h2 className="text-xl mb-4">Quản lý chi bộ — dữ liệu kiểm thử</h2><BranchManager organizationId="fixture" branches={[{id:'fixture-used',name:'Chi bộ kiểm thử có đảng viên'},{id:'fixture-empty',name:'Chi bộ kiểm thử chưa sử dụng'}]} members={[{chi_bo_id:'fixture-used'}]} disabled={false} onChanged={async()=>{}}/></GlassCard>
      <button className="min-h-11 border border-line rounded-control px-4" onClick={()=>{document.documentElement.classList.toggle('dark',!dark);setDark(!dark)}}>{dark?'Chuyển sang sáng':'Chuyển sang tối'}</button>
      <SessionProgress attended={false} submitted={false} examOpen/>
      <GlassCard><h2 className="text-xl mb-4">Trạng thái và biểu mẫu</h2><div className="flex flex-wrap gap-2 mb-4"><StatusBadge status="success" label="Đã hoàn thành"/><StatusBadge status="warning" label="Đang chờ"/><StatusBadge status="error" label="Cần kiểm tra"/></div><AlertMessage type="error" message="Thông báo lỗi kiểm thử, không phải lỗi dữ liệu thật."/><label className="block mt-4">Nội dung kiểm thử<input className="w-full border border-line p-3 rounded-control mt-2" defaultValue="Đảng viên – Mường La – Chiềng Lao"/></label><div className="mt-4 flex flex-wrap gap-3"><RevolutionaryButton onClick={()=>setSaved(true)} disabled={busy}>Tiếp tục kiểm thử</RevolutionaryButton><RevolutionaryButton variant="secondary" onClick={()=>setBusy(!busy)}>Đổi trạng thái chờ</RevolutionaryButton><RevolutionaryButton loading={busy}>Đang xử lý</RevolutionaryButton></div>{saved&&<p role="status" className="text-success mt-3">Nút hoạt động; không có dữ liệu được gửi đi.</p>}</GlassCard>
      <GlassCard><h2 className="text-xl mb-4">Chương trình sinh hoạt</h2><AgendaEditor value={agenda} onChange={setAgenda}/><details className="mt-4"><summary>Kết quả đọc–ghi để đối chiếu</summary><pre className="text-xs whitespace-pre-wrap break-all">{agenda}</pre></details></GlassCard>
    </main>
  </BrowserRouter></AuthContext.Provider>
}
const previewRoot = import.meta.hot?.data.previewRoot ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.previewRoot = previewRoot
previewRoot.render(<Preview/> )
