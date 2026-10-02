import test from 'node:test'
import assert from 'node:assert/strict'
import { loadService } from './load-service.mjs'

async function setup(results = {}) {
  let organization = 'org-a'
  const calls = []
  const supabase = { from(table) {
    const entry = { table, operations: [] }; calls.push(entry)
    const query = { then(resolve, reject) { return Promise.resolve(results[table] ?? { data: { id: 'branch-a', name: 'Tên mới' }, error: null }).then(resolve, reject) } }
    for (const method of ['select', 'update', 'delete', 'eq', 'single']) query[method] = (...args) => { entry.operations.push([method, ...args]); return query }
    return query
  } }
  const { branchService } = await loadService('../src/services/branchService.ts', {
    './supabaseClient': { supabase }, './tenantService': { tenantService: { requireOrganizationId: () => { if (!organization) throw new Error('Chọn xã'); return organization } } },
  })
  return { service: branchService, calls, select: value => { organization = value } }
}
test('branch rename keeps its ID and scopes the update to the selected commune', async () => {
  const { service, calls } = await setup()
  await service.rename('org-a', 'branch-a', '  Chi   bộ mới  ')
  const operations = calls[0].operations
  assert.deepEqual(operations.filter(op => op[0] === 'eq'), [['eq', 'organization_id', 'org-a'], ['eq', 'id', 'branch-a']])
  const payload = operations.find(op => op[0] === 'update')[1]
  assert.equal(payload.name, 'Chi bộ mới'); assert.deepEqual(Object.keys(payload).sort(), ['name', 'updated_at'])
  assert.deepEqual(calls.map(call => call.table), ['chi_bos'])
})
test('missing, stale commune or empty branch/name cannot write', async () => {
  const { service, calls, select } = await setup()
  await assert.rejects(service.rename('org-b', 'branch-a', 'Tên'), /Xã/)
  await assert.rejects(service.remove('', 'branch-a'), /Xã/)
  await assert.rejects(service.rename('org-a', '', 'Tên'), /chọn chi bộ/)
  for (const name of [' ', 'a'.repeat(201)]) await assert.rejects(service.rename('org-a', 'branch-a', name), /200/)
  select(null); await assert.rejects(service.remove('org-a', 'branch-a'), /Chọn xã/)
  assert.equal(calls.length, 0)
})
test('duplicate name and RLS-denied updates produce clear errors', async () => {
  for (const [code, message] of [['23505', /đã tồn tại/], ['42501', /quyền/], ['PGRST116', /quyền/]]) {
    const { service } = await setup({ chi_bos: { data: null, error: { code } } })
    await assert.rejects(service.rename('org-a', 'branch-a', 'Tên'), message)
  }
})
test('branch with members or historical participants can never be deleted', async () => {
  for (const table of ['members', 'meeting_participants']) {
    const { service, calls } = await setup({ members: { count: table === 'members' ? 1 : 0 }, meeting_participants: { count: table === 'meeting_participants' ? 1 : 0 } })
    await assert.rejects(service.remove('org-a', 'branch-a'), /không thể xóa/)
    assert.equal(calls.some(call => call.table === 'chi_bos'), false)
    for (const call of calls) assert.deepEqual(call.operations.filter(op => op[0] === 'eq'), [['eq', 'organization_id', 'org-a'], ['eq', 'chi_bo_id', 'branch-a']])
  }
})
test('reference errors or unavailable counts fail closed without deleting', async () => {
  for (const result of [{ count: null }, { count: 0, error: { message: 'Kiểm tra thất bại' } }]) {
    const { service, calls } = await setup({ members: result, meeting_participants: { count: 0 } })
    await assert.rejects(service.remove('org-a', 'branch-a'))
    assert.equal(calls.some(call => call.table === 'chi_bos'), false)
  }
})
test('unused branch deletion is scoped and returns a deleted row', async () => {
  const { service, calls } = await setup({ members: { count: 0 }, meeting_participants: { count: 0 } })
  await service.remove('org-a', 'branch-a')
  assert.deepEqual(calls[2].operations, [['delete'], ['eq', 'organization_id', 'org-a'], ['eq', 'id', 'branch-a'], ['select', 'id'], ['single']])
})
test('concurrent assignment protected by FK cannot silently delete history', async () => {
  const { service } = await setup({ members: { count: 0 }, meeting_participants: { count: 0 }, chi_bos: { data: null, error: { code: '23503' } } })
  await assert.rejects(service.remove('org-a', 'branch-a'), /Lịch sử được giữ nguyên/)
})
test('commune change during delete preflight prevents the final delete', async () => {
  let select
  const result = { get count() { select('org-b'); return 0 } }
  const fixture = await setup({ members: result, meeting_participants: { count: 0 } }); select = fixture.select
  await assert.rejects(fixture.service.remove('org-a', 'branch-a'), /Xã/)
  assert.equal(fixture.calls.some(call => call.table === 'chi_bos'), false)
})
