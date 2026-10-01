import test from 'node:test'
import assert from 'node:assert/strict'
import { loadService, queryMock } from './load-service.mjs'
import * as gps from '../src/utils/gps.ts'

async function setup(rows = [], error = null) {
  const db = queryMock(rows, error)
  const { mapAttendanceService } = await loadService('../src/services/mapAttendanceService.ts', {
    './supabaseClient': { supabase: db.client },
    './meetingUiSettingsService': { meetingUiSettingsService: {
      getSettings: async () => ({ gps_lat: 21, gps_lng: 104, gps_radius_m: 200 }),
    } },
    '../utils/gps': gps,
    './attendanceService': { DEFAULT_MEETING_LAT: null, DEFAULT_MEETING_LNG: null, MAX_ALLOWED_DISTANCE_METERS: 200 },
  })
  return { service: mapAttendanceService, db }
}

test('map rejects empty session instead of loading data from all sessions', async () => {
  const { service, db } = await setup()
  await assert.rejects(service.getSessionMapData('  '), /MISSING_SESSION_ID/)
  assert.equal(db.calls.length, 0)
})

test('map queries actual GPS column names and filters the exact meeting session', async () => {
  const { service, db } = await setup()
  const result = await service.getSessionMapData(' meeting-a ')
  assert.equal(result.meetingSessionId, 'meeting-a')
  assert.ok(db.calls.some(call => call[0] === 'eq' && call[1] === 'meeting_session_id' && call[2] === 'meeting-a'))
  const select = db.calls.find(call => call[0] === 'select')[1]
  assert.match(select, /gps_lat/)
  assert.match(select, /gps_lng/)
  assert.doesNotMatch(select, /\blatitude\b|\blongitude\b/)
})

test('map separates absent GPS from valid coordinates and retains server GPS verdict', async () => {
  const { service } = await setup([
    { id: 'a', member_id: 'm1', meeting_session_id: 'meeting-a', gps_lat: 21, gps_lng: 104, gps_valid: true, gps_distance_m: 0 },
    { id: 'b', member_id: 'm2', meeting_session_id: 'meeting-a', gps_lat: null, gps_lng: null },
    { id: 'c', member_id: 'm3', meeting_session_id: 'meeting-a', gps_lat: 21.003, gps_lng: 104, gps_valid: false, gps_distance_m: 334 },
  ])
  const result = await service.getSessionMapData('meeting-a')
  assert.deepEqual(result.summary, { totalAttendance: 3, positioned: 2, missingGps: 1, insideRadius: 1, outsideRadius: 1, unknown: 0 })
  assert.equal(result.points[1].locationStatus, 'outside_radius')
})

test('map never turns database errors into an empty successful attendance result', async () => {
  const { service } = await setup(null, { message: 'permission denied' })
  await assert.rejects(service.getSessionMapData('meeting-a'), /permission denied/)
})
