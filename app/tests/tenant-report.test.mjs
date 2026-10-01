import test from 'node:test'
import assert from 'node:assert/strict'
import {loadService} from './load-service.mjs'
import * as gps from '../src/utils/gps.ts'

// Two simultaneous sessions on the same date, with similarly named branches.
const datasets={
  meeting_sessions:[{id:'session-a',organization_id:'a',title:'Phiên A',meeting_date:'2026-10-05'},{id:'session-b',organization_id:'b',title:'Phiên B',meeting_date:'2026-10-05'}],
  chi_bos:[{id:'branch-a',organization_id:'a',name:'Chi bộ cùng tên',is_active:true,sort_order:1},{id:'branch-b',organization_id:'b',name:'Chi bộ cùng tên',is_active:true,sort_order:1}],
  meeting_participants:[{meeting_session_id:'session-a',organization_id:'a',member_id:'member-a',chi_bo_id:'branch-a'},{meeting_session_id:'session-b',organization_id:'b',member_id:'member-b',chi_bo_id:'branch-b'}],
  meeting_attendance:[{id:'attendance-a',meeting_session_id:'session-a',organization_id:'a',member_id:'member-a',status:'present',gps_valid:true,gps_lat:21,gps_lng:104},{id:'attendance-b',meeting_session_id:'session-b',organization_id:'b',member_id:'member-b',status:'warning',gps_valid:false,gps_lat:22,gps_lng:105}],
  exam_attempts:[{meeting_session_id:'session-a',organization_id:'a',member_id:'member-a',status:'submitted',score:7,duration_seconds:70,members:{organization_id:'a',full_name:'Cá nhân A',chi_bos:{name:'Chi bộ cùng tên'}}},{meeting_session_id:'session-b',organization_id:'b',member_id:'member-b',status:'submitted',score:9,duration_seconds:50,members:{organization_id:'b',full_name:'Cá nhân B',chi_bos:{name:'Chi bộ cùng tên'}}}],
}
async function setup(){
  let active='a'
  const queries=[]
  const client={from(table){
    const filters=[];let single=false,limit=Infinity
    const q={select(){return q},eq(field,value){filters.push([field,value]);return q},order(){return q},limit(value){limit=value;return q},single(){single=true;return q},then(resolve,reject){
      queries.push({table,filters:[...filters]})
      const rows=datasets[table].filter(row=>filters.every(([field,value])=>field.split('.').reduce((obj,key)=>obj?.[key],row)===value)).slice(0,limit)
      return Promise.resolve({data:single?(rows[0]||null):rows,error:single&&!rows.length?{message:'not found'}:null}).then(resolve,reject)
    }};return q
  }}
  const {reportService}=await loadService('../src/services/reportService.ts',{'./supabaseClient':{supabase:client},'./tenantService':{tenantService:{requireOrganizationId:()=>{if(!active)throw Error('Chọn xã');return active}}},'xlsx':{}})
  return {reportService,queries,client,requireOrganizationId:()=>active,choose:id=>{active=id}}
}
test('parallel commune reports isolate branches, winners, scores and exports',async()=>{
  const {reportService,queries}=await setup()
  const [a,b]=await Promise.all([reportService.compileMeetingReport('session-a','a'),reportService.compileMeetingReport('session-b','b')])
  assert.deepEqual(a.chiBoReports.map(c=>c.id),['branch-a'])
  assert.deepEqual(b.chiBoReports.map(c=>c.id),['branch-b'])
  assert.deepEqual(a.topMembers.map(m=>m.memberId),['member-a'])
  assert.deepEqual(b.topMembers.map(m=>m.memberId),['member-b'])
  assert.equal(a.stats.averageScore,7);assert.equal(b.stats.averageScore,9)
  assert.equal(a.stats.warningGpsCount,0);assert.equal(b.stats.warningGpsCount,1)
  assert.ok(!reportService.generateCsvContent(a).includes('Cá nhân B'))
  assert.ok(!reportService.generateCsvContent(b).includes('Cá nhân A'))
  for(const q of queries)assert.ok(q.filters.some(([f])=>f==='organization_id'),q.table)
  for(const q of queries.filter(q=>['meeting_participants','meeting_attendance','exam_attempts'].includes(q.table)))assert.ok(q.filters.some(([f])=>f==='meeting_session_id'))
})
test('a session belonging to another commune is rejected before compiling',async()=>{
  const {reportService,queries}=await setup()
  await assert.rejects(reportService.compileMeetingReport('session-b','a'),/Không tìm thấy/)
  assert.equal(queries.length,1)
})
test('organization is captured once even if the selector changes during an in-flight report',async()=>{
  const {reportService,choose,queries}=await setup()
  const pending=reportService.compileMeetingReport('session-a')
  choose('b')
  const result=await pending
  assert.deepEqual(result.topMembers.map(m=>m.memberId),['member-a'])
  for(const q of queries)assert.ok(q.filters.some(([f,v])=>f==='organization_id'&&v==='a'))
})
test('missing organization fails closed instead of compiling all communes',async()=>{
  const {reportService,choose,queries}=await setup();choose(null)
  await assert.rejects(reportService.compileMeetingReport('session-a'),/Chọn xã/)
  assert.equal(queries.length,0)
})

test('parallel GPS map loads capture separate commune/session IDs and hall caches',async()=>{
  const io=await setup()
  const {mapAttendanceService}=await loadService('../src/services/mapAttendanceService.ts',{
    './supabaseClient':{supabase:io.client},'./tenantService':{tenantService:{requireOrganizationId:io.requireOrganizationId}},
    './meetingUiSettingsService':{meetingUiSettingsService:{getSettings:async id=>({gps_lat:id==='session-a'?21:22,gps_lng:id==='session-a'?104:105,gps_radius_m:200})}},
    '../utils/gps':gps,'./attendanceService':{MAX_ALLOWED_DISTANCE_METERS:200},
  })
  const pendingA=mapAttendanceService.getSessionMapData('session-a');io.choose('b')
  const [a,b]=await Promise.all([pendingA,mapAttendanceService.getSessionMapData('session-b')])
  assert.deepEqual(a.points.map(p=>p.memberId),['member-a']);assert.deepEqual(b.points.map(p=>p.memberId),['member-b'])
  assert.equal(a.hall.latitude,21);assert.equal(b.hall.latitude,22)
  assert.equal(a.points[0].meetingSessionId,'session-a');assert.equal(b.points[0].meetingSessionId,'session-b')
  io.choose('a');const again=await mapAttendanceService.getSessionMapData('session-a')
  assert.equal(again.hall.latitude,21)
})
