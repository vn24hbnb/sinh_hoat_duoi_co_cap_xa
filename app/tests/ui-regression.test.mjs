import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'
import {loadService} from './load-service.mjs'
// Freeze against the approved production source immediately before this synchronization fix.
const baseline='6be43c705e813d58e116a6196132f178cf438bd2'
const {parseAgenda,updateAgendaItem}=await loadService('../src/utils/agenda.ts',{})

test('agenda changes preserve root and item extension fields',()=>{
  const data={is_structured:true,time_str:'08:00',extra:{flag:true},items:[{tt:7,content:'Cũ',moderator:'A',performer:'B',extension:{id:'unchanged'}},{tt:8,content:'Không đổi'}]}
  const source=JSON.stringify(data)
  const result=JSON.parse(updateAgendaItem(source,0,'content','Nội dung mới'))
  assert.deepEqual(result,{...data,items:[{...data.items[0],content:'Nội dung mới'},data.items[1]]})
})
test('legacy or invalid agenda is left intact, not silently rewritten',()=>{
  for(const value of ['Nội dung dạng văn bản','{','null','[]','{"is_structured":true,"items":[null]}','{"is_structured":true,"items":[],"time_str":5}']){
    assert.equal(parseAgenda(value),null)
    assert.equal(updateAgendaItem(value,0,'content','mới'),value)
  }
})
test('empty agenda and invalid item indexes are supported without data loss',()=>{
  const value='{"is_structured":true,"items":[],"extension":1}'
  assert.deepEqual(parseAgenda(value).items,[])
  assert.equal(updateAgendaItem(value,2,'performer','new'),value)
})

const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:10*1024*1024})
test('authorized map/report fixes leave other backend, auth and route guards byte-identical',()=>{
  const files=git('ls-tree','-r','--full-tree','--name-only',baseline).trim().split('\n').filter(file=>file.startsWith('app/src/services/')||file.startsWith('supabase/')||file.startsWith('app/src/types/')||['app/src/contexts/AuthContext.tsx','app/src/App.tsx','app/package.json','app/package-lock.json'].includes(file))
  assert.ok(files.length>20)
  const authorized=new Set(['app/src/services/reportService.ts'])
  for(const file of files.filter(file=>!authorized.has(file)))assert.equal(readFileSync(new URL(`../../${file}`,import.meta.url),'utf8'),git('show',`${baseline}:${file}`),file)
  const oldPackage=JSON.parse(git('show',`${baseline}:app/package.json`)),currentPackage=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'))
  assert.equal(currentPackage.dependencies.leaflet,'1.9.4');assert.equal(currentPackage.devDependencies['@types/leaflet'],'1.9.22')
  assert.deepEqual(currentPackage,oldPackage)
})
function businessNodes(source,file){
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const printer=ts.createPrinter({removeComments:true}),calls=[],functions={}
  const printed=node=>printer.printNode(ts.EmitHint.Unspecified,node,ast)
  function visit(node){
    if(ts.isCallExpression(node)&&/(?:\b\w+Service\.|\bsupabase\.)/.test(node.expression.getText(ast)))calls.push(printed(node))
    if(ts.isVariableDeclaration(node)&&node.initializer&&ts.isArrowFunction(node.initializer)&&/^handle|^getNextAction$/.test(node.name.getText(ast)))functions[node.name.getText(ast)]=printed(node.initializer)
    ts.forEachChild(node,visit)
  }
  visit(ast);return{calls,functions}
}
test('all page service requests and business action handlers remain unchanged',()=>{
  const files=git('ls-tree','-r','--full-tree','--name-only',baseline).trim().split('\n').filter(file=>/^app\/src\/pages\/.*\.tsx$/.test(file))
  let count=0
  for(const file of files){
    const previous=businessNodes(git('show',`${baseline}:${file}`),file),current=businessNodes(readFileSync(new URL(`../../${file}`,import.meta.url),'utf8'),file)
    // Only explicitly requested report refreshes may differ from current production.
    if(file.endsWith('/Attendance.tsx')){
      assert.match(current.functions.handleAttendanceClick,/currentSession.status !== 'attendance_open'/)
      assert.match(current.functions.handleAttendanceClick,/attendanceMethod\(methods, !!gpsCoords\)/)
      assert.match(current.functions.handleAttendanceClick,/isSubmitDisabled \|\| success/)
    }
    if(file.endsWith('/AdminReports.tsx')){
      assert.equal(current.calls.filter(call=>call==='tenantService.getOrganizationId()').length,3)
      current.calls=current.calls.filter(call=>call!=='tenantService.getOrganizationId()')
      previous.calls=previous.calls.filter(call=>call!=='tenantService.getOrganizationId()')
      assert.ok(current.calls.includes('reportService.compileMeetingReport(sessionId, organizationId)'))
      assert.ok(current.calls.includes('reportService.downloadExcel(fresh)'))
      current.calls=current.calls.filter(call=>!['reportService.compileMeetingReport(sessionId, organizationId)','reportService.downloadExcel(fresh)'].includes(call))
      previous.calls=previous.calls.filter(call=>call!=='reportService.downloadExcel(report)')
      assert.match(current.functions.handleSelectMeeting,/setReport\(null\)/)
      assert.match(current.functions.handleSelectMeeting,/setMeeting\(null\)/)
      assert.match(current.functions.handleSelectMeeting,/loadReportData\(true, id\)/)
    }
    if(file.endsWith('/AdminDashboard.tsx')){
      assert.equal(current.calls.filter(call=>call==='tenantService.getOrganizationId()').length,3)
      current.calls=current.calls.filter(call=>call!=='tenantService.getOrganizationId()')
      previous.calls=previous.calls.filter(call=>call!=='tenantService.getOrganizationId()')
      for(const call of current.calls.filter(call=>call.startsWith('reportService.compileMeetingReport(')))assert.match(call,/, organizationId\)$/)
      current.calls=current.calls.map(call=>call.replace(/compileMeetingReport\((activeSession|meeting).id, organizationId\)/g,'compileMeetingReport($1.id)'))
      // Approval writes stay unchanged; only their report-refresh read is explicitly scoped.
      for(const key of ['handleQuickApprove','handleQuickReject']){
        const writes=value=>value.match(/await meetingService\.[^;]+;/g)
        assert.deepEqual(writes(current.functions[key]),writes(previous.functions[key]))
        delete current.functions[key];delete previous.functions[key]
      }
    }
    assert.deepEqual(current,previous,file)
    count+=current.calls.length
  }
  assert.ok(count>50)
})

test('the actual member action allows an exam without attendance and preserves all states',()=>{
  const source=readFileSync(new URL('../src/pages/member/MemberHome.tsx',import.meta.url),'utf8')
  const ast=ts.createSourceFile('MemberHome.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let expression
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='getNextAction')expression=node.initializer.getText(ast);ts.forEachChild(node,visit)}
  visit(ast)
  assert.ok(expression)
  const compiled=ts.transpileModule(`const action=${expression}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const action=Function(`${compiled};return action`)()
  const status={attended:false,excused:false,examSubmitted:false,hasExam:true}
  assert.equal(action(status,{status:'exam_open'}),'EXAM')
  assert.equal(action(status,{status:'attendance_open'}),'ATTENDANCE')
  assert.equal(action(status,{status:'active'}),'WAITING')
  assert.equal(action({...status,attended:true,examSubmitted:true},{status:'exam_closed'}),'RESULT')
  assert.equal(action({...status,hasExam:false},{status:'exam_open'}),'WAITING')
})
