import React from 'react'
import { useLocation } from 'react-router-dom'
import { useUiSettings } from '../../contexts/UiSettingsContext'
import bronzeDrum from '../../assets/bronze_drum.png'
interface PatternBackgroundProps { children: React.ReactNode; className?: string; bgImageUrl?: string|null }
export const PatternBackground: React.FC<PatternBackgroundProps> = ({children,className='',bgImageUrl}) => {
  const {settings}=useUiSettings(), {pathname}=useLocation()
  const decorative=['/','/login'].includes(pathname)
  const isLogin=pathname==='/login'
  const image=bgImageUrl || (isLogin?settings?.active_login_background?.file_url:settings?.active_home_background?.file_url) || bronzeDrum
  const opacity=isLogin?(settings?.login_background_opacity??88):(settings?.home_background_opacity??88)
  const rotate=!isLogin && settings?.effects_enabled!==false && localStorage.getItem('fallback_home_background_rotate')!=='false'
  const speed=Math.max(20,Number(settings?.home_background_spin_speed??localStorage.getItem('fallback_home_background_spin_speed'))||160)
  return <div className={`relative isolate min-h-screen w-full bg-page text-ink ${className}`}>
    {decorative&&<div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"><div className={`app-pattern-layer absolute inset-0 ${rotate?'app-slow-spin-bg':''}`} style={{'--pattern-image':`url("${image}")`,'--pattern-opacity':`${opacity}%`,'--pattern-speed':`${speed}s`,backgroundSize:image===bronzeDrum?'min(80vw, 900px)':'cover'} as React.CSSProperties}/></div>}
    <div className="relative min-h-screen w-full">{children}</div>
  </div>
}
