import React from 'react'
import { parseAgenda, updateAgendaItem } from '../../utils/agenda'
import { GrowingTextarea } from './GrowingTextarea'
export const AgendaEditor:React.FC<{value:string;onChange:(value:string)=>void}>=({value,onChange})=>{
  const agenda=parseAgenda(value)
  const raw=<label className="block text-sm text-muted">Nội dung chương trình<GrowingTextarea value={value} onChange={event=>onChange(event.target.value)} rows={6} className="mt-2 w-full p-3 border border-line rounded-control font-mono text-sm"/></label>
  if(!agenda)return raw
  return <div className="space-y-4">
    <p className="text-xs text-muted">Chương trình sinh hoạt — chỉnh nội dung từng mục bên dưới.</p>
    <div className="grid gap-3 sm:grid-cols-2">{(['time_str','location_str','participants_str'] as const).map((field,index)=><label key={field} className="block text-sm">{['Thời gian chương trình','Địa điểm chương trình','Thành phần tham dự'][index]}<input value={agenda[field]??''} onChange={event=>onChange(JSON.stringify({...agenda,[field]:event.target.value},null,2))} className="mt-1 w-full p-3 border border-line rounded-control"/></label>)}</div>
    <ol className="space-y-3">{agenda.items.map((item,index)=><li key={index} className="p-4 border border-line rounded-card bg-surface-muted"><p className="font-semibold text-sm mb-2">Mục {item.tt??index+1}</p><label className="block text-sm">Nội dung<GrowingTextarea rows={2} value={item.content??''} onChange={event=>onChange(updateAgendaItem(value,index,'content',event.target.value))} className="w-full mt-1 p-3 border border-line rounded-control"/></label><div className="grid gap-3 sm:grid-cols-2 mt-3">{(['moderator','performer'] as const).map((field,i)=><label key={field} className="block text-sm">{['Chủ trì','Thực hiện'][i]}<input value={item[field]??''} onChange={event=>onChange(updateAgendaItem(value,index,field,event.target.value))} className="mt-1 w-full p-3 border border-line rounded-control"/></label>)}</div></li>)}</ol>
    <details><summary className="text-sm text-muted cursor-pointer min-h-11 py-3">Chỉnh nâng cao / thêm, bớt mục chương trình</summary>{raw}</details>
  </div>
}
