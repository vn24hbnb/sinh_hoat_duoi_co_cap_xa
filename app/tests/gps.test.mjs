import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDistance, calculateEffectiveDistance } from '../src/utils/gps.ts'

test('GPS distance is zero at the meeting location', () => {
  assert.equal(calculateDistance(21, 104, 21, 104), 0)
})

test('GPS uses meters and distance is symmetric', () => {
  const distance = calculateDistance(21, 104, 21.001, 104)
  assert.ok(distance >= 110 && distance <= 112)
  assert.equal(distance, calculateDistance(21.001, 104, 21, 104))
})

test('GPS accuracy allowance is capped at25m, not the reported uncertainty', () => {
  assert.deepEqual(calculateEffectiveDistance(250, 10000), {
    effectiveDistanceM: 225, toleranceAppliedM: 25,
  })
  assert.deepEqual(calculateEffectiveDistance(220, 40), {
    effectiveDistanceM: 200, toleranceAppliedM: 20,
  })
})

test('GPS allowance cannot make distance negative', () => {
  assert.equal(calculateEffectiveDistance(5, 100).effectiveDistanceM, 0)
})

test('missing, zero and negative accuracy do not grant an allowance', () => {
  for (const accuracy of [undefined, null, 0, -5]) {
    assert.deepEqual(calculateEffectiveDistance(201, accuracy), {
      effectiveDistanceM: 201, toleranceAppliedM: 0,
    })
  }
})
