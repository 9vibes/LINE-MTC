import assert from 'node:assert/strict';
const origin='http://127.0.0.1:28110';
const login=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'operator',password:'ci-only-container-password'})});
assert.equal(login.status,200);
const cookie=login.headers.get('set-cookie').split(';')[0];
const response=await fetch(origin+'/api/state',{headers:{Cookie:cookie}});
assert.equal(response.status,200);assert.deepEqual((await response.json()).aircraft,[]);
console.log('Container login and persistent store initialized successfully.');
