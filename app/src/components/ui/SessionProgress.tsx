import React from 'react'
import { CheckCircle2, Calendar, BookOpen, Trophy } from 'lucide-react'
export const SessionProgress:React.FC<{attended:boolean;submitted:boolean;examOpen:boolean}>=({attended,submitted,examOpen})=>{
  const steps=[{label:'Điểm danh',complete:attended,current:!attended&&!examOpen&&!submitted,icon:Calendar},{label:'Kiểm tra',complete:submitted,current:examOpen&&!submitted,icon:BookOpen},{label:'Kết quả',complete:submitted,current:submitted,icon:Trophy}]
  return <section aria-label="Tiến trình phiên sinh hoạt" className="glass-card p-4"><ol className="grid grid-cols-3 gap-2">{steps.map(step=><li key={step.label} aria-current={step.current?'step':undefined} className={`flex flex-col sm:flex-row items-center gap-2 text-sm ${step.complete?'text-success':step.current?'text-primary dark:text-accent-text':'text-muted'}`}>{step.complete?<CheckCircle2 size={20} aria-hidden="true"/>:<step.icon size={20} aria-hidden="true"/>}<span>{step.label}{step.complete&&<span className="sr-only">: đã hoàn thành</span>}</span></li>)}</ol><p className="text-xs text-muted mt-3">Có thể làm bài kiểm tra khi cổng thi mở, kể cả chưa điểm danh thành công.</p></section>
}
