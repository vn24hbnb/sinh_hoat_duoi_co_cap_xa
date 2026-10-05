import test from 'node:test'
import assert from 'node:assert/strict'
import {loadService} from './load-service.mjs'
const {subscribeReportRefresh,REPORT_REFRESH_INTERVAL_MS}=await loadService('../src/utils/reportRefresh.ts',{})
const tick=()=>new Promise(resolve=>setImmediate(resolve))
function browser(){
  const w=new EventTarget(),d=new EventTarget()
  d.visibilityState='visible'
  w.setInterval=(fn,ms)=>{w.timer=fn;w.ms=ms;return 1}
  w.clearInterval=id=>{assert.equal(id,1);w.timer=null}
  return {w,d}
}
test('reports refresh every 10s and on focus/online/visibility, with clean disposal',async()=>{
  const {w,d}=browser();let reads=0
  const stop=subscribeReportRefresh(async()=>{reads++},w,d)
  assert.equal(w.ms,REPORT_REFRESH_INTERVAL_MS);assert.equal(w.ms,10000)
  w.timer();await tick()
  w.dispatchEvent(new Event('focus'));await tick()
  w.dispatchEvent(new Event('online'));await tick()
  d.visibilityState='hidden';w.timer();await tick()
  assert.equal(reads,3)
  d.visibilityState='visible';d.dispatchEvent(new Event('visibilitychange'));await tick()
  assert.equal(reads,4)
  stop();assert.equal(w.timer,null)
  w.dispatchEvent(new Event('focus'));d.dispatchEvent(new Event('visibilitychange'));await tick()
  assert.equal(reads,4)
})
test('slow background reads are serialized and bursts coalesced, not continually cancelled',async()=>{
  const {w,d}=browser();let reads=0;const finish=[]
  const stop=subscribeReportRefresh(()=>{reads++;return new Promise(resolve=>finish.push(resolve))},w,d)
  w.timer();w.timer();w.dispatchEvent(new Event('focus'));w.dispatchEvent(new Event('online'))
  assert.equal(reads,1)
  finish.shift()();await tick();assert.equal(reads,2)
  w.timer();stop();finish.shift()();await tick()
  assert.equal(reads,2)
})
test('a failed background refresh can retry on the next event',async()=>{
  const {w,d}=browser();let reads=0
  const stop=subscribeReportRefresh(async()=>{reads++;throw Error('offline')},w,d)
  w.timer();await tick();w.dispatchEvent(new Event('online'));await tick()
  assert.equal(reads,2);stop()
})
