import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {openStore,digest,passwordMatches,passwordHash} from './store.mjs';
import {validateData,applyLogStatus} from './model.js';

export function startServer(options={}){
 const root=resolve(options.dist||process.env.STATIC_DIR||'dist');
 const origin=options.origin||process.env.PUBLIC_ORIGIN||'http://localhost:3000';
 const allowedOrigins=new Set([origin,...(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean)]);
 const password=options.password??process.env.LINE_MTC_ADMIN_PASSWORD??(process.env.LINE_MTC_ADMIN_PASSWORD_FILE?readFileSync(process.env.LINE_MTC_ADMIN_PASSWORD_FILE,'utf8').trim():undefined);
 const db=openStore(options.dbPath||process.env.DB_PATH||'data/line-mtc.sqlite',password);
 const clients=new Set(),attempts=new Map();const sessionAge=7*86400000;
 const snapshot=()=>{const s=db.prepare('SELECT * FROM state WHERE id=1').get();return {revision:s.revision,aircraft:JSON.parse(s.aircraft),updatedAt:s.updated_at,updatedBy:s.updated_by};};
 const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 const publicUser=u=>({username:u.username,role:u.role});
 const session=req=>{const token=req.mobile?(req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]):(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('line_mtc_session='))?.slice(17);return token?db.prepare('SELECT u.username,u.role,s.expires,s.token FROM sessions s JOIN users u ON u.username=s.username WHERE s.token=? AND s.expires>?').get(digest(token),Date.now()):undefined;};
 const cookie=(token,age,req)=>`line_mtc_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${req.headers.origin?.startsWith('https:')?'; Secure':''}`;
 const broadcast=()=>{const body=`event: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`;for(const c of clients){if(!c.res.write(body))c.res.destroy();}};
 async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>5000000)throw Object.assign(Error('Request too large'),{status:413});}try{return JSON.parse(raw);}catch{throw Object.assign(Error('Invalid JSON'),{status:400});}}
 const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
 const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
  let path=new URL(req.url,'http://localhost').pathname;
  // Packaged apps use explicit bearer credentials, never ambient browser cookies.
  req.mobile=path.startsWith('/api/mobile/');
  if(req.mobile){
   path='/api/'+path.slice('/api/mobile/'.length);
   res.setHeader('Access-Control-Allow-Origin','*');
   res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, OPTIONS');
   res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
   res.setHeader('Access-Control-Max-Age','600');
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  }
  try{
   if(path==='/api/health')return json(res,200,{name:'LINE MTC',ok:true});
   if(path==='/api/config')return json(res,200,{mode:'shared',name:'LINE MTC'});
   if(!['GET','HEAD'].includes(req.method)){
    if(!req.mobile&&!allowedOrigins.has(req.headers.origin))fail(403,'Unrecognized request origin');
    if(!String(req.headers['content-type']).startsWith('application/json'))fail(415,'JSON required');
   }
   if(path==='/api/login'&&req.method==='POST'){
    // Apply both a global cap and account cap; never trust a caller-supplied IP header.
    const b=await body(req);const now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
    const key=String(b.username||'').toLowerCase();const global=attempts.get('*')||{count:0,until:now+60000};const account=attempts.get(key)||{count:0,until:now+60000};
    if(global.count>=60||account.count>=10)fail(429,'Too many attempts. Try again in a minute.');global.count++;account.count++;attempts.set('*',global);attempts.set(key,account);
    const u=db.prepare('SELECT * FROM users WHERE username=?').get(key);
    if(typeof b.password!=='string'||b.password.length>256||!u||!passwordMatches(b.password,u.password))fail(401,'Incorrect username or password');
    const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(now);db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),u.username,now+sessionAge);
    if(!req.mobile)res.setHeader('Set-Cookie',cookie(token,sessionAge/1000,req));return json(res,200,{user:publicUser(u),...(req.mobile?{token}:{})});
   }
   if(path.startsWith('/api/')){
    const user=session(req);if(!user)fail(401,'Sign in to LINE MTC');
    if(path==='/api/session')return json(res,200,{user:publicUser(user)});
    if(path==='/api/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(user.token);for(const c of clients)if(c.token===user.token)c.res.end();if(!req.mobile)res.setHeader('Set-Cookie',cookie('',0,req));return json(res,200,{ok:true});}
    if(path==='/api/events'&&req.method==='GET'){
     if(clients.size>=100)fail(503,'Connection limit reached');
     res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-store, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
     res.write(`retry: 2000\nevent: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`);
     const c={res,token:user.token};clients.add(c);
     const timer=setInterval(()=>{if(!session(req)){res.end();return;}if(!res.write(': heartbeat\n\n'))res.destroy();},15000);
     res.on('close',()=>{clearInterval(timer);clients.delete(c);});return;
    }
    if(path==='/api/users'){
     if(user.role!=='operator')fail(403,'Operator account required');
     if(req.method==='GET')return json(res,200,{users:db.prepare('SELECT username,role FROM users ORDER BY username').all()});
     if(req.method==='POST'){
      const b=await body(req);if(!/^[a-z0-9_-]{3,40}$/.test(b.username)||typeof b.password!=='string'||b.password.length<12||b.password.length>256||!['operator','editor','viewer'].includes(b.role))fail(400,'Use a lowercase username, password of 12–256 characters, and a valid role');
      if(db.prepare('SELECT 1 FROM users WHERE username=?').get(b.username))fail(409,'Username already exists');
      db.prepare('INSERT INTO users VALUES(?,?,?)').run(b.username,passwordHash(b.password),b.role);return json(res,201,{user:{username:b.username,role:b.role}});
     }
    }
    if(path==='/api/users/remove'&&req.method==='POST'){
     if(user.role!=='operator')fail(403,'Operator account required');const b=await body(req);if(b.username===user.username)fail(400,'Cannot remove your own account');
     const tokens=db.prepare('SELECT token FROM sessions WHERE username=?').all(b.username);db.prepare('DELETE FROM sessions WHERE username=?').run(b.username);db.prepare('DELETE FROM users WHERE username=?').run(b.username);for(const c of clients)if(tokens.some(t=>t.token===c.token))c.res.end();return json(res,200,{ok:true});
    }
    if(path==='/api/state'&&req.method==='GET')return json(res,200,snapshot());
    if(path==='/api/state'&&req.method==='PUT'){
     if(user.role==='viewer')fail(403,'This account has view-only access');
     const b=await body(req);const before=snapshot();if(b.revision!==before.revision)return json(res,409,{error:'Another user changed the log. Review the latest entries and try again.',...before});
     let next;try{next=validateData(b.aircraft);}catch(e){fail(400,e.message);}
     if(next.length>5000)fail(400,'Maximum 5000 aircraft');
     const keys=new Set();for(const a of next){const key=a.date+'|'+a.tail.toUpperCase();if(keys.has(key))fail(400,'Duplicate tail number on the same day');keys.add(key);if(a.logs.length>100)fail(400,'Maximum 100 logs per aircraft');}
     // Preserve ETD when an older companion does not send the optional field.
     for(const a of next){const old=before.aircraft.find(x=>x.id===a.id);if(old&&!('etd' in a)&&'etd' in old)a.etd=old.etd;}
     // Older companion editors omit report fields; explicit null clears them.
     for(const a of next)for(const l of a.logs){
      const old=before.aircraft.find(x=>x.id===a.id)?.logs.find(x=>x.id===l.id);
      for(const key of ['logType','healthPoints'])if(old&&!(key in l)&&key in old)l[key]=old[key];
     }
     const now=new Date();
     for(const a of next)for(const l of a.logs){const old=before.aircraft.find(x=>x.id===a.id)?.logs.find(x=>x.id===l.id);const explicit=b.statusAction?.aircraftId===a.id&&b.statusAction?.logId===l.id;
      if((old?.status!==l.status||explicit)&&['C/W','DEF','SUPP'].includes(l.status))next=applyLogStatus(next,a.id,l.id,l.status,now);
     }
     db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE state SET revision=?,aircraft=?,updated_at=?,updated_by=? WHERE id=1').run(before.revision+1,JSON.stringify(next),now.toISOString(),user.username);db.prepare('INSERT INTO audit(revision,username,at,action) VALUES(?,?,?,?)').run(before.revision+1,user.username,now.toISOString(),b.statusAction?'status':'edit');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
     broadcast();return json(res,200,snapshot());
    }
    return json(res,404,{error:'Not found'});
   }
   if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
   const requested=decodeURIComponent(path);let file=resolve(root,'.'+(requested==='/'||requested==='/operator'||requested==='/companion'?'/index.html':requested));
   if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile())return json(res,404,{error:'Not found'});
   const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
   res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':file.includes('/assets/')?'public, max-age=31536000, immutable':'no-store'});res.end(req.method==='HEAD'?undefined:readFileSync(file));
  }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Server error'});else res.end();if(!e.status)console.error(e);}
 });
 server.listen(options.port??Number(process.env.PORT||3000),options.host||'0.0.0.0');
 const close=()=>new Promise(resolve=>{for(const c of clients)c.res.end();server.close(()=>{db.close();resolve();});server.closeIdleConnections();});
 return {server,close};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const app=startServer();console.log('LINE MTC listening on port '+(process.env.PORT||3000));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));}
