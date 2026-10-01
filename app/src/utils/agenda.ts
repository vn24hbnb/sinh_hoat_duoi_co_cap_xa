export interface AgendaItem { tt?: number; content?: string; moderator?: string; performer?: string; [key:string]:unknown }
export interface StructuredAgenda { is_structured: true; time_str?: string; location_str?: string; participants_str?: string; items: AgendaItem[]; [key:string]:unknown }
export function parseAgenda(value:string):StructuredAgenda|null {
  try {
    const parsed:unknown=JSON.parse(value)
    if(!parsed || typeof parsed!=='object' || Array.isArray(parsed))return null
    const agenda=parsed as StructuredAgenda
    if(agenda.is_structured!==true || !Array.isArray(agenda.items))return null
    if(!agenda.items.every(item=>item && typeof item==='object' && !Array.isArray(item) && ['content','moderator','performer'].every(key=>item[key]===undefined||typeof item[key]==='string')))return null
    if(!['time_str','location_str','participants_str'].every(key=>agenda[key]===undefined||typeof agenda[key]==='string'))return null
    return agenda
  } catch {return null}
}
// Spread preserves extension fields instead of rebuilding a reduced schema.
export function updateAgendaItem(value:string,index:number,field:'content'|'moderator'|'performer',text:string):string {
  const agenda=parseAgenda(value)
  if(!agenda || !agenda.items[index])return value
  return JSON.stringify({...agenda,items:agenda.items.map((item,i)=>i===index?{...item,[field]:text}:item)},null,2)
}
