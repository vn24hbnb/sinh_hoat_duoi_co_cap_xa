import React, { useCallback, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, LayoutDashboard, Calendar, Users, BookOpen, BarChart3, Settings, HelpCircle, Trophy, MonitorPlay, Minimize2, Play, Pause, Map, ChevronDown, KeyRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface NavigationBarProps { isAuthenticated: boolean; userRole?: 'member'|'organizer'|'admin'; userName?: string; onLogout?: () => void }
interface NavItem { path: string; label: string; icon: LucideIcon }
export const RedNavigationBar: React.FC<NavigationBarProps> = ({isAuthenticated, userRole, userName, onLogout}) => {
  const auth=useAuth(), navigate=useNavigate()
  const role=userRole || auth.user?.role || 'member'
  const [isOpen,setIsOpen]=useState(false)
  const [textSize,setTextSize]=useState<'sm'|'md'|'lg'>(()=>{
    const saved=localStorage.getItem('user-text-size'); return saved==='sm'||saved==='lg'?saved:'md'
  })
  const [presentationMode,setPresentationMode]=useState(false)
  const [presentationFontSize,setPresentationFontSize]=useState(()=>Math.min(40,Math.max(16,Number(localStorage.getItem('presentation-font-size'))||24)))
  const [autoScroll,setAutoScroll]=useState(false)
  const [logoutError,setLogoutError]=useState('')
  useEffect(()=>{
    const root=document.documentElement
    root.classList.remove('text-size-sm','text-size-md','text-size-lg'); root.classList.add(`text-size-${textSize}`)
    localStorage.setItem('user-text-size',textSize)
  },[textSize])
  useEffect(()=>{
    const root=document.documentElement
    root.classList.toggle('presentation-mode',presentationMode)
    if(presentationMode){root.style.setProperty('--presentation-font-size',`${presentationFontSize}px`);root.style.setProperty('--presentation-font-size-mobile',`${Math.round(presentationFontSize*.75)}px`);localStorage.setItem('presentation-font-size',String(presentationFontSize))}
    return ()=>{root.classList.remove('presentation-mode');root.style.removeProperty('--presentation-font-size');root.style.removeProperty('--presentation-font-size-mobile')}
  },[presentationMode,presentationFontSize])
  useEffect(()=>{
    if(!autoScroll||!presentationMode)return
    let frame=0, last=window.scrollY
    const step=()=>{window.scrollBy(0,1);const current=window.scrollY;if(current>=document.documentElement.scrollHeight-window.innerHeight-2||current===last){setAutoScroll(false);return}last=current;frame=requestAnimationFrame(step)}
    frame=requestAnimationFrame(step);return()=>cancelAnimationFrame(frame)
  },[autoScroll,presentationMode])
  const togglePresentationMode=useCallback(async()=>{
    setAutoScroll(false);setIsOpen(false)
    if(presentationMode){setPresentationMode(false);if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{})}
    else {setPresentationMode(true);await document.documentElement.requestFullscreen?.().catch(()=>{/* Reading mode still works without fullscreen. */})}
  },[presentationMode])
  useEffect(()=>{
    const full=()=>{if(!document.fullscreenElement){setPresentationMode(false);setAutoScroll(false)}}
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setIsOpen(false);setPresentationMode(false);setAutoScroll(false)}
      if(event.altKey&&event.key.toLowerCase()==='p' && !(event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable]'))){event.preventDefault();void togglePresentationMode()}
    }
    document.addEventListener('fullscreenchange',full);window.addEventListener('keydown',key)
    return()=>{document.removeEventListener('fullscreenchange',full);window.removeEventListener('keydown',key)}
  },[togglePresentationMode])
  const handleLogout=async()=>{
    setIsOpen(false);setLogoutError('')
    try {if(onLogout)await onLogout();else{await auth.logout();navigate('/login')}}
    catch {setLogoutError('Chưa đăng xuất được. Vui lòng thử lại.')}
  }
  const links:NavItem[]=!isAuthenticated?[
    {path:'/',label:'Tổng quan',icon:LayoutDashboard},{path:'/guide',label:'Hướng dẫn',icon:HelpCircle},{path:'/login',label:'Đăng nhập',icon:LogOut}
  ]:role==='member'?[
    {path:'/member',label:'Trang chủ',icon:LayoutDashboard},{path:'/attendance',label:'Điểm danh',icon:Calendar},{path:'/exam',label:'Kiểm tra',icon:BookOpen},{path:'/results',label:'Kết quả',icon:Trophy},{path:'/guide',label:'Hướng dẫn',icon:HelpCircle}
  ]:[
    {path:'/admin',label:'Tổng quan',icon:LayoutDashboard},{path:'/admin/meetings',label:'Phiên họp',icon:Calendar},{path:'/admin/members',label:'Đảng viên',icon:Users},{path:'/admin/questions',label:'Câu hỏi',icon:BookOpen},{path:'/admin/reports',label:'Báo cáo',icon:BarChart3},{path:'/admin/live-map',label:'Bản đồ giám sát',icon:Map},{path:'/admin/ui-settings',label:'Giao diện',icon:Settings},{path:'/admin/audit-logs',label:'Nhật ký',icon:BookOpen},{path:'/guide',label:'Hướng dẫn',icon:HelpCircle}
  ]
  const item=(link:NavItem)=><NavLink key={link.path} to={link.path} end={['/','/admin','/member'].includes(link.path)} onClick={()=>setIsOpen(false)} className="nav-link"><link.icon size={18} aria-hidden="true"/><span>{link.label}</span></NavLink>
  const options=<>
    <fieldset className="p-3"><legend className="text-xs px-1">Cỡ chữ cá nhân</legend><div className="flex gap-2">{(['sm','md','lg'] as const).map((size,i)=><button key={size} onClick={()=>setTextSize(size)} aria-pressed={textSize===size} className={`min-h-11 flex-1 rounded-control px-3 text-sm ${textSize===size?'bg-[#f4e8c8] text-[#4a090c]':'bg-white/10 text-white'}`}>{['Nhỏ','Vừa','Lớn'][i]}</button>)}</div></fieldset>
    <button onClick={()=>void togglePresentationMode()} className="nav-link w-full"><MonitorPlay size={18}/>Trình chiếu</button>
    {isAuthenticated&&<><NavLink to="/change-password" className="nav-link" onClick={()=>setIsOpen(false)}><KeyRound size={18}/>Đổi mật khẩu</NavLink><button onClick={()=>void handleLogout()} className="nav-link w-full"><LogOut size={18}/>Đăng xuất</button></>}
  </>
  return <>
    <nav aria-label="Điều hướng chính" className="app-navigation revolution-nav sticky top-0 z-50 text-white">
      <div className="max-w-7xl mx-auto px-3 flex items-center justify-between gap-2 min-h-14">
        <div className="hidden xl:flex items-center gap-1">{links.slice(0,5).map(item)}{links.length>5&&<details className="relative"><summary className="nav-link cursor-pointer list-none">Thêm<ChevronDown size={16}/></summary><div className="absolute left-0 top-full w-60 bg-red-dark rounded-control border border-white/20 p-2 shadow-sm">{links.slice(5).map(item)}</div></details>}</div>
        <span className="xl:hidden text-sm font-semibold">{isAuthenticated?'Sinh hoạt dưới cờ':'Cổng sinh hoạt chính trị'}</span>
        <details className="hidden xl:block relative"><summary className="nav-link cursor-pointer list-none max-w-64"><span className="truncate">{userName||auth.user?.memberName||'Tùy chọn'}</span><ChevronDown size={16}/></summary><div className="absolute right-0 top-full w-72 bg-red-dark rounded-control border border-white/20 p-2 shadow-sm">{options}</div></details>
        <button className="xl:hidden min-h-11 min-w-11 flex items-center justify-center rounded-control" aria-expanded={isOpen} aria-controls="navigation-menu" aria-label={isOpen?'Đóng menu':'Mở menu'} onClick={()=>setIsOpen(!isOpen)}>{isOpen?<X/>:<Menu/>}</button>
      </div>
      {isOpen&&<div id="navigation-menu" className="xl:hidden max-h-[75dvh] overflow-y-auto border-t border-white/20 p-3">{links.map(item)}<div className="border-t border-white/20 mt-3">{options}</div></div>}
      {logoutError&&<p role="alert" className="p-3">{logoutError}</p>}
    </nav>
    <nav aria-label="Điều hướng nhanh" className="mobile-tabbar fixed bottom-0 inset-x-0 z-50 md:hidden bg-surface border-t border-line flex items-stretch justify-around">
      {links.slice(0,isAuthenticated&&role==='member'?4:5).map(link=><NavLink key={link.path} to={link.path} end={['/','/admin','/member'].includes(link.path)} className={({isActive})=>`flex flex-col flex-1 min-w-0 items-center justify-center gap-1 px-1 py-2 text-xs font-medium ${isActive?'text-primary dark:text-accent-text bg-surface-muted':'text-muted'}`}><link.icon size={20} aria-hidden="true"/><span className="text-center leading-tight">{link.label}</span></NavLink>)}
    </nav>
    {presentationMode&&<div role="group" aria-label="Điều khiển trình chiếu" className="floating-presentation-exit fixed bottom-3 right-3 left-3 sm:left-auto z-[9999] flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-3 shadow-sm text-ink">
      <button aria-label="Giảm chữ trình chiếu" disabled={presentationFontSize<=16} onClick={()=>setPresentationFontSize(v=>Math.max(16,v-2))}>A−</button><span className="text-xs">{presentationFontSize}px</span><button aria-label="Tăng chữ trình chiếu" disabled={presentationFontSize>=40} onClick={()=>setPresentationFontSize(v=>Math.min(40,v+2))}>A+</button>
      <button aria-pressed={autoScroll} onClick={()=>setAutoScroll(!autoScroll)} className="flex items-center gap-2 px-3">{autoScroll?<Pause size={18}/>:<Play size={18}/>} {autoScroll?'Dừng cuộn':'Tự cuộn'}</button>
      <button onClick={()=>void togglePresentationMode()} className="flex items-center gap-2 rounded-control bg-primary text-white px-3"><Minimize2 size={18}/>Thoát</button>
    </div>}
  </>
}
