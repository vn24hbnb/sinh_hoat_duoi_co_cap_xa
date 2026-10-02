import test from 'node:test'
import assert from 'node:assert/strict'
import { loadService } from './load-service.mjs'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { canConfirmAttendance, attendanceMethod } = await loadService('../src/utils/attendanceFlow.ts', {})
const ready = { ready: true, loading: false, photoUploading: false, pinRequired: false, pinCompleted: false, qrRequired: false, qrCompleted: false, photoRequired: false, hasPhoto: false }

test('GPS denied, unsupported, pending, timed out or missing hall never disables attendance', () => {
  for (const gpsState of ['denied', 'unsupported', 'pending', 'timeout', 'missing-hall']) assert.equal(canConfirmAttendance({ ...ready, gpsState }), true)
  assert.equal(attendanceMethod(['gps'], false), 'button')
  assert.equal(attendanceMethod(['button'], false), 'button')
  assert.equal(attendanceMethod(['gps'], true), 'gps')
})
test('configuration, submission and required QR/PIN/photo still gate the button', () => {
  for (const state of [{ ready: false }, { loading: true }, { photoUploading: true }, { pinRequired: true }, { qrRequired: true }, { photoRequired: true }]) assert.equal(canConfirmAttendance({ ...ready, ...state }), false)
  assert.equal(canConfirmAttendance({ ...ready, pinRequired: true, pinCompleted: true, qrRequired: true, qrCompleted: true, photoRequired: true, hasPhoto: true }), true)
  assert.equal(attendanceMethod(['gps','qr'], false), 'qr')
  assert.equal(attendanceMethod(['pin'], false), 'pin')
})
test('the actual Attendance component does not disable or spin the submit button for GPS', () => {
  const source=readFileSync(new URL('../src/pages/member/Attendance.tsx',import.meta.url),'utf8')
  const ast=ts.createSourceFile('Attendance.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let gate,buttonLoading
  function visit(node){
    if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='isSubmitDisabled')gate=node.initializer.getText(ast)
    if(ts.isJsxOpeningElement(node)&&node.tagName.getText(ast)==='RevolutionaryButton'&&node.attributes.properties.some(prop=>ts.isJsxAttribute(prop)&&prop.name.getText(ast)==='onClick'&&prop.initializer?.getText(ast)==='{handleAttendanceClick}'))buttonLoading=node.attributes.properties.find(prop=>prop.name?.getText(ast)==='loading').initializer.expression.getText(ast)
    ts.forEachChild(node,visit)
  }
  visit(ast);assert.ok(gate);assert.equal(buttonLoading,'loading || photoUploading')
  assert.doesNotMatch(gate,/gps|targetLat|targetLng/)
  const compiled=ts.transpileModule(`const disabled=${gate}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const evaluate=Function('canConfirmAttendance','settingsReady','meeting','loading','photoUploading','pinRequired','pinCompleted','qrRequired','qrCompleted','photoRequired','photoFile',`${compiled};return disabled`)
  assert.equal(evaluate(canConfirmAttendance,true,{status:'attendance_open'},false,false,false,false,false,false,false,null),false)
  assert.equal(evaluate(canConfirmAttendance,false,{status:'attendance_open'},false,false,false,false,false,false,false,null),true)
  assert.equal(evaluate(canConfirmAttendance,true,{status:'attendance_closed'},false,false,false,false,false,false,false,null),true)
})

async function serviceFixture(response) {
  const calls = []
  const { attendanceService } = await loadService('../src/services/attendanceService.ts', {
    './supabaseClient': { supabase: { rpc: async (name, args) => { calls.push({ name, args }); return response } } },
    './tenantService': { tenantService: { requireOrganizationId: () => 'org-a' } },
  })
  return { attendanceService, calls }
}
const record = { meetingSessionId: 'session-a', memberId: 'member-a', markedBy: 'user-a' }
test('one-click missing GPS calls the protected RPC with null coordinates, no fake position', async () => {
  const expected = { id: 'attendance-a', status: 'warning', gps_valid: false, warning_reason: 'Không có GPS' }
  const { attendanceService, calls } = await serviceFixture({ data: expected, error: null })
  assert.deepEqual(await attendanceService.markAttendance(record), expected)
  assert.deepEqual(calls, [{ name: 'attendance_mark', args: { p_meeting_session_id: 'session-a', p_lat: null, p_lng: null, p_accuracy: null, p_absence_reason: null, p_method: 'button', p_pin_code: null, p_qr_token: null, p_evidence_path: null } }])
})
test('QR/PIN and actual GPS are passed unchanged for server verification', async () => {
  const { attendanceService, calls } = await serviceFixture({ data: { id: 'attendance-a', status: 'present' }, error: null })
  await attendanceService.markAttendance({ ...record, latitude: 21, longitude: 104, accuracy: 10, method: 'qr', pinCode: ' 1234 ', qrToken: ' code ' })
  assert.equal(calls[0].args.p_method, 'qr'); assert.equal(calls[0].args.p_pin_code, '1234'); assert.equal(calls[0].args.p_qr_token, 'code')
  assert.equal(calls[0].args.p_lat, 21); assert.equal(calls[0].args.p_lng, 104)
})
test('RPC denial or empty result never displays attendance success', async () => {
  for (const response of [{ error: { message: 'Cổng điểm danh đang đóng.' } }, { data: null }, { data: [] }, { data: { id: 'a', status: 'absent' } }]) {
    const { attendanceService } = await serviceFixture(response)
    await assert.rejects(attendanceService.markAttendance(record))
  }
})
test('a single composite RPC row is accepted whether object or one-element array', async () => {
  const row={id:'attendance-a',status:'warning',gps_valid:false,warning_reason:'Không có GPS'}
  for(const data of [row,[row]]){
    const {attendanceService}=await serviceFixture({data,error:null})
    assert.deepEqual(await attendanceService.markAttendance(record),row)
  }
})
test('member home and history show attendance success, not a manager GPS warning',()=>{
  for(const file of ['MemberHome.tsx','MemberResults.tsx']){
    const source=readFileSync(new URL(`../src/pages/member/${file}`,import.meta.url),'utf8')
    assert.doesNotMatch(source,/Có cảnh báo|Cảnh báo vị trí|phê duyệt chính thức|badgeText = 'Cảnh báo'/)
    assert.match(source,/hist.attendanceStatus === 'present' \|\| hist.attendanceStatus === 'warning'/)
  }
})
