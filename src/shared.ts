import {waitForEvenAppBridge,type EvenAppBridge} from '@evenrealities/even_hub_sdk';
import {type Aircraft,validateData} from './model';
declare const __LINE_MTC_SERVER__:string;
const remote=__LINE_MTC_SERVER__;
const tokenKey='line-mtc-companion-session';
const endpoint=(path:string)=>remote?remote+path.replace('/api/','/api/mobile/'):path;
export type User={username:string;role:'operator'|'editor'|'viewer'};
export type Snapshot={revision:number;aircraft:Aircraft[];updatedAt:string|null;updatedBy:string|null};
export class SharedSession {
 user!:User;revision=-1;pending=false;source?:{close:()=>void};
 private token='';
 private storageBridge?:EvenAppBridge;
 private async bounded<T>(operation:Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([operation,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Native storage unavailable')),4000);})]);}finally{clearTimeout(timer);}}
 private async restore(){if(!remote)return;try{this.storageBridge=await this.bounded(waitForEvenAppBridge());const saved=await this.bounded(this.storageBridge.getLocalStorage(tokenKey));if(typeof saved==='string'&&/^[a-f0-9]{64}$/.test(saved))this.token=saved;}catch{/* Browser preview uses its existing local session. */}}
 constructor(){if(remote){try{this.token=localStorage.getItem(tokenKey)||'';}catch{/* Session stays in memory if storage is unavailable. */}}}
 private async remember(token:string){this.token=token;try{if(token)localStorage.setItem(tokenKey,token);else localStorage.removeItem(tokenKey);}catch{/* Signing in still works for this launch. */}if(this.storageBridge){try{await this.bounded(this.storageBridge.setLocalStorage(tokenKey,token));}catch{/* Keep the browser fallback if native storage is temporarily unavailable. */}}}
 private onSnapshot?:(s:Snapshot)=>void;private onStatus?:(s:string)=>void;
 private connected=false;private polling=false;
 async request(path:string,init:RequestInit={}){
  const response=await fetch(endpoint(path),{...init,credentials:remote?'omit':'same-origin',headers:{'Content-Type':'application/json',...(remote&&this.token?{Authorization:'Bearer '+this.token}:{}),...init.headers},cache:'no-store',signal:AbortSignal.timeout(15000)});
  const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Server unavailable'),{status:response.status,snapshot:result});return result;
 }
 async signIn(){
  await this.restore();
  try{this.user=(await this.request('/api/session')).user;if(remote)await this.remember(this.token);return;}catch(e){if((e as {status?:number}).status!==401)throw e;if(remote)await this.remember('');}
  document.querySelector('#app')!.innerHTML=`<main class="sign-in"><p class="eyebrow">SHARED RUNNING LOG</p><h1>LINE MTC</h1><p>Sign in to share aircraft logs with your team.</p><form id="login-form"><label>Username<input name="username" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Sign in</button><p role="alert" id="login-error"></p></form></main>`;
  await new Promise<void>(resolve=>{document.querySelector<HTMLFormElement>('#login-form')!.onsubmit=async e=>{e.preventDefault();const form=e.currentTarget as HTMLFormElement;const b=form.querySelector('button')!;b.disabled=true;try{const values=Object.fromEntries(new FormData(form));const login=await this.request('/api/login',{method:'POST',body:JSON.stringify(values)});if(remote)await this.remember(login.token);this.user=login.user;resolve();}catch(e){document.querySelector('#login-error')!.textContent=(e as Error).message;}finally{b.disabled=false;}};});
 }
 async read():Promise<Snapshot>{return this.request('/api/state');}
 accept(snapshot:Snapshot){if(!Number.isInteger(snapshot.revision)||snapshot.revision<=this.revision)return;validateData(snapshot.aircraft);this.revision=snapshot.revision;this.onSnapshot?.(snapshot);}
 watch(onSnapshot:(s:Snapshot)=>void,onStatus:(s:string)=>void){
  this.onSnapshot=onSnapshot;this.onStatus=onStatus;
  const received=(value:string)=>{try{this.accept(JSON.parse(value));this.connected=true;onStatus('Live · shared with your team');}catch{onStatus('Could not read server update');}};
  const disconnected=()=>{this.connected=false;onStatus('Reconnecting · showing last received data');};
  if(remote){
   // EventSource cannot send Authorization; consume the same SSE stream using fetch.
   let stopped=false;let controller:AbortController|undefined;let retry:ReturnType<typeof setTimeout>|undefined;
   this.source={close:()=>{stopped=true;controller?.abort();clearTimeout(retry);}};
   const stream=async()=>{
    controller=new AbortController();let idle:ReturnType<typeof setTimeout>|undefined;
    const heartbeat=()=>{clearTimeout(idle);idle=setTimeout(()=>controller?.abort(),45000);};
    try{
     heartbeat();const response=await fetch(endpoint('/api/events'),{headers:{Authorization:'Bearer '+this.token},credentials:'omit',cache:'no-store',signal:controller.signal});
     if(response.status===401){await this.remember('');stopped=true;onStatus('Session expired · reopen to sign in');return;}
     if(!response.ok||!response.body)throw Error('Stream unavailable');
     const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
     while(!stopped){const chunk=await reader.read();if(chunk.done)break;heartbeat();buffer+=decoder.decode(chunk.value,{stream:true}).replace(/\r/g,'');let end;
      while((end=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);if(event.includes('event: snapshot'))received(event.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n'));}
     }
    }catch{/* Polling keeps the last snapshot current while the stream reconnects. */}
    finally{clearTimeout(idle);controller?.abort();if(!stopped){disconnected();retry=setTimeout(()=>void stream(),2000);}}
   };
   void stream();
  }else{
   const source=new EventSource('/api/events');this.source=source;
   source.addEventListener('snapshot',event=>received((event as MessageEvent).data));source.onerror=disconnected;
  }
  const refresh=async()=>{if(this.polling)return;this.polling=true;try{this.accept(await this.read());onStatus(this.connected?'Live · shared with your team':'Connected · refreshing every 10 seconds');}catch(e){if((e as {status?:number}).status===401){this.source?.close();onStatus('Session expired · reopen to sign in');}else onStatus('Offline · showing last received data');}finally{this.polling=false;}};
  setInterval(()=>void refresh(),10000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});window.addEventListener('online',()=>void refresh());
 }
 async save(aircraft:Aircraft[],revision=this.revision,statusAction?:{aircraftId:string;logId:string}){
  if(this.pending)throw Error('A save is already in progress. Please try again after it finishes.');
  this.pending=true;this.onStatus?.('Saving to LINE MTC…');
  try{const result=await this.request('/api/state',{method:'PUT',body:JSON.stringify({revision,aircraft,statusAction})});this.accept(result);this.onStatus?.('Saved · shared with your team');return result as Snapshot;}
  catch(e){const error=e as Error&{status?:number;snapshot?:Snapshot};if(error.status===409&&error.snapshot)this.accept(error.snapshot);this.onStatus?.('Not saved · '+error.message);throw e;}finally{this.pending=false;}
 }
 async logout(){await this.request('/api/logout',{method:'POST',body:'{}'});this.source?.close();if(remote)await this.remember('');location.reload();}
}
export async function connectShared():Promise<SharedSession|undefined>{
 const config=await fetch(endpoint('/api/config'),{cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(config.status===404&&!remote&&!['rl.kunas.pro','mtc.kunas.pro'].includes(location.hostname))return;
 if(!config.ok)throw Error(remote&&[401,404].includes(config.status)?'Update LINE MTC on Umbrel to version 1.0.2 or later, then reopen this app.':'LINE MTC server unavailable. Reload to try again.');
 const contentType=config.headers.get('content-type')||'';
 if(!contentType.includes('application/json')&&!remote&&!['rl.kunas.pro','mtc.kunas.pro'].includes(location.hostname))return;
 if((await config.json()).mode!=='shared')throw Error('Invalid server configuration');
 const session=new SharedSession();await session.signIn();return session;
}
export function accountTools(session:SharedSession){
 const wrap=document.createElement('div');wrap.className='account-tools';
 const name=document.createElement('span');name.textContent=`${session.user.username} · ${session.user.role}`;wrap.append(name);
 const logout=document.createElement('button');logout.textContent='Sign out';logout.onclick=()=>void session.logout();wrap.append(logout);
 document.querySelector('footer')!.prepend(wrap);
 if(session.user.role!=='operator')return;
 const dialog=document.createElement('dialog');dialog.className='accounts';dialog.innerHTML=`<h2>Team accounts</h2><div id="team-list"></div><form id="team-form"><label>Username<input name="username" pattern="[a-z0-9_-]{3,40}" required autocomplete="off"></label><label>Initial password<input name="password" type="password" minlength="12" maxlength="256" required autocomplete="new-password"></label><label>Access<select name="role"><option value="editor">Editor — can edit shared logs</option><option value="operator">Operator — also manages accounts</option><option value="viewer">Viewer — read only</option></select></label><button class="primary">Add account</button></form><p id="team-message" role="status"></p><button id="team-close">Close</button>`;document.body.append(dialog);
 const message=(text:string)=>{dialog.querySelector('#team-message')!.textContent=text;};
 const refresh=async()=>{try{const {users}=await session.request('/api/users');const list=dialog.querySelector('#team-list')!;list.replaceChildren();for(const u of users as User[]){const row=document.createElement('p');row.textContent=`${u.username} · ${u.role} `;if(u.username!==session.user.username){const remove=document.createElement('button');remove.textContent='Remove';remove.onclick=async()=>{if(!confirm(`Remove access for ${u.username}?`))return;try{await session.request('/api/users/remove',{method:'POST',body:JSON.stringify({username:u.username})});await refresh();}catch(e){message((e as Error).message);}};row.append(remove);}list.append(row);}}catch(e){message((e as Error).message);}};
 dialog.querySelector<HTMLFormElement>('#team-form')!.onsubmit=async e=>{e.preventDefault();const form=e.currentTarget as HTMLFormElement;try{await session.request('/api/users',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();message('Account created. Share its credentials privately with that person.');await refresh();}catch(e){message((e as Error).message);}};
 dialog.querySelector<HTMLButtonElement>('#team-close')!.onclick=()=>dialog.close();const button=document.createElement('button');button.textContent='Team accounts';button.onclick=()=>{dialog.showModal();void refresh();};wrap.append(button);
}
