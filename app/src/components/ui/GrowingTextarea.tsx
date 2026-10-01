import { useLayoutEffect, useRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'
export function GrowingTextarea(props:TextareaHTMLAttributes<HTMLTextAreaElement>){
  const ref=useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(()=>{
    const element=ref.current
    if(!element)return
    element.style.height='auto'
    const lineHeight=parseFloat(getComputedStyle(element).lineHeight)||24
    element.style.height=`${Math.max(element.scrollHeight+2,element.rows*lineHeight+24)}px`
  },[props.value])
  return <textarea {...props} ref={ref}/>
}
