import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {startServer} from '../server-build/main.mjs';
const password='test-only-operator-password-123';
const aircraft={id:'a1',date:'2026-09-29',tail:'3074',eta:'13:12',gate:'87',off:'',logs:[{id:'l1',number:'1234567',description:'Tray table latch loose',status:'--'}]};
test('authentication, real-time updates, concurrency, permissions and restart persistence',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'line-mtc-test-'));let app=startServer({port:0,dbPath:join(dir,'test.sqlite'),password,origin:'http://test.local'});await once(app.server,'listening');let url=`http://127.0.0.1:${app.server.address().port}`;let events;
 const request=async(path,method='GET',data,cookie,origin='http://test.local')=>fetch(url+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});
 try{
  assert.equal((await request('/api/state')).status,401);
  assert.equal((await request('/api/login','POST',{username:'operator',password},undefined,'https://evil.example')).status,403);
  const login=await request('/api/login','POST',{username:'operator',password});assert.equal(login.status,200);const admin=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/users','POST',{username:'tech1',password,role:'editor'},admin)).status,201);
  assert.equal((await request('/api/users','POST',{username:'observer',password,role:'viewer'},admin)).status,201);
  const editor=(await request('/api/login','POST',{username:'tech1',password})).headers.get('set-cookie').split(';')[0];
  const viewer=(await request('/api/login','POST',{username:'observer',password})).headers.get('set-cookie').split(';')[0];
  const abort=new AbortController();events=abort;const stream=await fetch(url+'/api/events',{headers:{Cookie:editor},signal:abort.signal});assert.match(stream.headers.get('content-type'),/event-stream/);const reader=stream.body.getReader();const decode=new TextDecoder();assert.match(decode.decode((await reader.read()).value),/"revision":0/);
  const save=await request('/api/state','PUT',{revision:0,aircraft:[aircraft]},admin);assert.equal(save.status,200);assert.match(decode.decode((await reader.read()).value),/3074/);
  assert.equal((await request('/api/state','PUT',{revision:0,aircraft:[]},editor)).status,409);
  assert.equal((await request('/api/state','PUT',{revision:1,aircraft:[]},viewer)).status,403);
  assert.equal((await request('/api/users','GET',null,editor)).status,403);
  const changed=structuredClone(aircraft);changed.logs[0].status='C/W';
  const result=await (await request('/api/state','PUT',{revision:1,aircraft:[changed]},editor)).json();assert.equal(result.revision,2);assert.match(result.aircraft[0].off,/^\d\d:\d\d$/);assert.ok(result.aircraft[0].offRecordedAt);assert.equal(result.updatedBy,'tech1');
  assert.equal((await request('/api/state','PUT',{revision:2,aircraft:[{...aircraft,eta:'27:20'}]},editor)).status,400);
  assert.equal((await request('/api/state','PUT',{revision:2,aircraft:[aircraft,{...aircraft,id:'a2',logs:[{...aircraft.logs[0],id:'l2'}]}]},editor)).status,400);
  abort.abort();await app.close();app=startServer({port:0,dbPath:join(dir,'test.sqlite'),origin:'http://test.local'});await once(app.server,'listening');url=`http://127.0.0.1:${app.server.address().port}`;
  const persisted=await (await request('/api/state','GET',null,admin)).json();assert.equal(persisted.revision,2);assert.equal(persisted.aircraft[0].logs[0].status,'C/W');
  assert.equal((await request('/api/users/remove','POST',{username:'tech1'},admin)).status,200);assert.equal((await request('/api/state','GET',null,editor)).status,401);
  await request('/api/logout','POST',{},admin);assert.equal((await request('/api/state','GET',null,admin)).status,401);
 }finally{events?.abort();await app.close();rmSync(dir,{recursive:true,force:true});}
});
