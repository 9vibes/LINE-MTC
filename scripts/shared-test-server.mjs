import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../server-build/main.mjs';
const dir=mkdtempSync(join(tmpdir(),'line-mtc-browser-'));
const app=startServer({port:3077,dbPath:join(dir,'test.sqlite'),password:'test-only-password-123456',origin:'http://127.0.0.1:3077'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.close().then(()=>{rmSync(dir,{recursive:true,force:true});process.exit(0);}));
