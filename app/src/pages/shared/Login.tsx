import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Eye, EyeOff, HelpCircle } from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { useAuth } from '../../contexts/AuthContext'
import { useUiSettings } from '../../contexts/UiSettingsContext'
import { tenantService, type Directory } from '../../services/tenantService'

export const Login: React.FC = () => {
  const { login } = useAuth()
  const { settings } = useUiSettings()
  const [directory,setDirectory]=useState<Directory>({organizations:[],chi_bos:[],members:[]})
  const [loginMode,setLoginMode]=useState<'member'|'admin'>('member')
  const [organizationId,setOrganizationId]=useState('')
  const [chiBoId,setChiBoId]=useState('')
  const [memberId,setMemberId]=useState('')
  const [administrator,setAdministrator]=useState('')
  const [password,setPassword]=useState('')
  const [showPassword,setShowPassword]=useState(false)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const directoryRequest=useRef(0)
  const navigate=useNavigate()

  const requestDirectory=useCallback((org?:string,branch?:string)=>{
    const request=++directoryRequest.current
    void tenantService.directory(org,branch).then(data=>{if(request===directoryRequest.current)setDirectory(data)}).catch(e=>{if(request===directoryRequest.current)setError(e instanceof Error?e.message:'Không tải được danh sách đăng nhập.')})
  },[])
  useEffect(()=>{requestDirectory()},[requestDirectory])

  const handleLoginSubmit=async(e:React.FormEvent)=>{
    e.preventDefault();setError('')
    const identity=loginMode==='admin'?administrator:memberId
    if(!identity||!password){setError(loginMode==='admin'?'Vui lòng chọn loại tài khoản quản trị và nhập mật khẩu.':'Vui lòng chọn xã, chi bộ, tên đảng viên và nhập mật khẩu.');return}
    setLoading(true)
    try{const session=await login(identity,password);navigate(session.role==='admin'||session.role==='organizer'?'/admin':'/member')}
    catch(err){setError(err instanceof Error?err.message:'Đăng nhập thất bại.')}
    finally{setLoading(false)}
  }
  const organization=directory.organizations.find(o=>o.id===organizationId)
  return <PatternBackground bgImageUrl={settings?.active_login_background?.file_url}>
    <PortalHeader/>
    <div className="max-w-md mx-auto py-12 px-4"><GlassCard className="border border-red-revolution/25">
      <div className="text-center mb-6"><h2 className="text-xl font-bold text-red-deep dark:text-gold normal-case tracking-normal">{settings?.login_title||'Đăng nhập phiên họp'}</h2><p className="text-xs font-semibold text-muted mt-1">{loginMode==='admin'?'Khu vực dành cho quản trị viên':organization?.name||'Chào mừng đồng chí'}</p></div>
      {error&&<AlertMessage type="error" message={error} className="mb-4"/>}
      <form onSubmit={handleLoginSubmit} className="space-y-4">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-bold dark:bg-slate-800" role="group" aria-label="Chọn loại tài khoản">
          <button type="button" aria-pressed={loginMode==='member'} onClick={()=>{setLoginMode('member');setAdministrator('');setError('')}} className={`min-h-[44px] rounded-lg px-2 transition ${loginMode==='member'?'bg-white text-red-deep shadow dark:bg-slate-700 dark:text-gold':'text-muted dark:text-muted'}`}>Đảng viên</button>
          <button type="button" aria-pressed={loginMode==='admin'} onClick={()=>{setLoginMode('admin');setMemberId('');setError('')}} className={`min-h-[44px] rounded-lg px-2 transition ${loginMode==='admin'?'bg-white text-red-deep shadow dark:bg-slate-700 dark:text-gold':'text-muted dark:text-muted'}`}>Quản trị viên</button>
        </div>
        {loginMode==='member'?<>
          <label className="block text-xs font-bold">Xã
            <select required value={organizationId} onChange={e=>{const id=e.target.value;setOrganizationId(id);setChiBoId('');setMemberId('');setDirectory(current=>({...current,chi_bos:[],members:[]}));requestDirectory(id||undefined)}} className="mt-1 block w-full min-h-[48px] px-3 rounded-xl border bg-white/80">
              <option value="">Chọn xã</option>{directory.organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold">Chi bộ
            <select disabled={!organizationId} required value={chiBoId} onChange={e=>{const id=e.target.value;setChiBoId(id);setMemberId('');setDirectory(current=>({...current,members:[]}));if(organizationId&&id)requestDirectory(organizationId,id)}} className="mt-1 block w-full min-h-[48px] px-3 rounded-xl border bg-white/80">
              <option value="">Chọn chi bộ</option>{directory.chi_bos.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold">Họ và tên
            <select disabled={!chiBoId} required value={memberId} onChange={e=>setMemberId(e.target.value)} className="mt-1 block w-full min-h-[48px] px-3 rounded-xl border bg-white/80">
              <option value="">Chọn tên trong danh sách</option>{directory.members.map(m=><option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
          </label>
        </>:<label className="block text-xs font-bold">Tài khoản quản trị
          <select required value={administrator} onChange={e=>setAdministrator(e.target.value)} className="mt-1 block w-full min-h-[48px] px-3 rounded-xl border bg-white/80">
            <option value="">Chọn tài khoản quản trị</option><option value="admin@muongla">Quản trị xã Mường La</option><option value="admin@chienglao">Quản trị xã Chiềng Lao</option><option value="admin@">Quản trị chung hai xã</option>
          </select>
        </label>}
        <div><label htmlFor="login-password" className="block text-xs font-semibold">Mật khẩu</label>
          <div className="relative mt-1"><KeyRound size={18} aria-hidden="true" className="absolute left-3 top-4 text-muted"/><input id="login-password" required type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="block w-full min-h-[48px] pl-10 pr-12 rounded-control border bg-surface" placeholder="Nhập mật khẩu"/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-0.5 top-0.5 min-w-11 min-h-11 flex items-center justify-center text-muted" aria-label={showPassword?'Ẩn mật khẩu':'Hiện mật khẩu'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
        </div>
        <RevolutionaryButton type="submit" loading={loading} fullWidth>{loginMode==='admin'?'Đăng nhập quản trị':'Tiếp tục'}</RevolutionaryButton>
      </form>
      <p className="mt-5 pt-4 border-t text-center text-xs text-muted">{loginMode==='member'?'Chọn đúng xã, chi bộ và tên của đồng chí. Dùng mật khẩu đã được cấp; có thể tự đổi sau khi đăng nhập.':'Sử dụng mật khẩu đã được cấp cho tài khoản quản trị.'}</p>
    </GlassCard></div>
    <div className="flex justify-center px-4 pb-8"><button onClick={()=>navigate('/guide')} className="min-h-11 flex items-center gap-2 px-4 rounded-control text-muted hover:text-primary" aria-label="Hướng dẫn sử dụng"><HelpCircle size={20}/>Hướng dẫn sử dụng</button></div>
  </PatternBackground>
}
export default Login
