import {isCompanion} from './companion-ui';
import './style.css';
import {type Aircraft,type Status,today,uid,militaryTime,sortAircraft,validateData,glassPages,glassOverview,glassRows,marquee,ACTION_STATUSES,applyLogStatus} from './model';
import {Glasses} from './glasses';
import {demoAircraft} from './demo';
import {connectShared,accountTools,type SharedSession} from './shared';
let shared:SharedSession|undefined;let sharedStale=false;
try{shared=await connectShared();}catch(e){document.querySelector('#app')!.textContent=(e as Error).message;throw e;}
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const KEY='platoon-running-log-v1';let data:Aircraft[]=[];let date=today(),filter='ALL',query='',page=0,selected=0,detail=false,choice=0,tick=0,editing:string|undefined,loadError='';
try{if(shared){const state=await shared.read();data=validateData(state.aircraft);shared.revision=state.revision;}else data=validateData(JSON.parse(localStorage.getItem(KEY)||'[]'));}catch{loadError='Saved data could not be loaded. Export the existing backup before making changes.';}
$('#app').innerHTML=`<header><div class="brand"><span class="mark">P</span><span>SUPER PLATANO LOG<small>LINE MAINTENANCE</small></span></div><span class="local">${shared?'● LINE MTC · SHARED':'● LOCAL WORKSPACE'}</span></header>
<main><div class="heading"><div><p class="eyebrow">YOUR SHIFT, AT A GLANCE</p><h1>Running log<span>.</span></h1><p class="subtitle">Every aircraft. Every discrepancy. One clear view.</p></div><div>${isCompanion?'':'<button id="random-demo">Add demo aircraft</button>'} <button class="primary" id="add">＋ Add aircraft</button></div></div>
<div class="summary"><div><b id="count">0</b><span>AIRCRAFT</span></div><div><b id="pending">0</b><span>PENDING</span></div><div><b id="deferred">0</b><span>DEFERRED</span></div><div><b id="completed">0</b><span>COMPLIED WITH</span></div><label class="date">SHIFT DATE<input id="date" type="date" value="${date}"></label></div>
<div class="workspace"><section class="board"><div class="toolbar"><div class="tabs" role="group" aria-label="Filter log status">${['ALL','PEND','DEF','C/W','SUPP','--'].map(s=>`<button data-filter="${s}" class="${s==='ALL'?'active':''}">${s==='ALL'?'All logs':s}</button>`).join('')}</div><input id="search" type="search" placeholder="Find tail, gate or log…" aria-label="Search aircraft and logs"></div><div class="list-label"><span>DAILY AIRCRAFT</span><span>↑ ARRIVAL ORDER · LOCAL TIME</span></div><div id="aircraft"></div></section>
<aside><div class="preview-heading"><h2>Glasses view</h2><span>EVEN G2</span></div><p class="muted">Aircraft grouped by arrival, with each log on its own row.</p><div class="glass"><div class="glass-top"><span>SUPER PLATANO LOG / HUD</span><span id="page-label">0 / 0</span></div><pre id="hud"></pre></div><div class="pager"><button id="prev" aria-label="Previous aircraft">←</button><span id="browse-label">Select aircraft</span><button id="next" aria-label="Next aircraft">→</button></div><button id="toggle-view" class="connect view-toggle">Open status menu</button><div id="status-actions" hidden><div class="status-buttons"><button data-action-status="C/W">C/W</button><button data-action-status="DEF">DEF</button><button data-action-status="SUPP">SUPP</button><button data-action-status="--">--</button></div><button id="next-aircraft-log">Next discrepancy log</button></div><button id="connect" class="connect">Connect to G2</button><p id="connection" class="connection" role="status">Preview mode • no glasses connected</p><button id="clear-aircraft" class="clear-aircraft" type="button">Clear all aircraft</button><div class="tips"><b>Made for a quick glance</b><p>Additional logs branch beneath their aircraft. Each log row is selectable. Long descriptions scroll across the selected row. Tap an aircraft for C/W, DEF, SUPP, or --; swipe to choose and tap to save. C/W, DEF, and SUPP record the current off-plane time; -- leaves it unchanged. Next log switches discrepancies. Double tap returns without saving.</p></div></aside></div>
<footer><span id="save-state" role="status">Saved on this device · no account needed</span><div>${isCompanion?'':'<button id="demo">Load example</button>'}<button id="export">Export backup</button><button id="import">Import backup</button><input type="file" accept="application/json,.json" id="file" hidden></div></footer><p id="notice" role="alert"></p></main>
<dialog id="editor"><form id="form"><div class="dialog-head"><div><p class="eyebrow">SHIFT DETAILS</p><h2 id="editor-title">Add aircraft</h2></div><button type="button" id="close" aria-label="Close editor">✕</button></div><div class="fields"><label>Tail number<input name="tail" required maxlength="16" placeholder="e.g. 3074" autocapitalize="characters"></label><label>Arrival time (ETA)<input name="eta" type="text" inputmode="numeric" placeholder="HH:MM, e.g. 13:12" pattern="([01][0-9]|2[0-3]):?[0-5][0-9]" maxlength="5" title="24-hour time, e.g. 13:12"></label><label>Gate<input name="gate" maxlength="12" placeholder="e.g. 88A"></label><label>Off plane time (optional)<input name="off" type="time"></label></div><div class="logs-head"><h3>Discrepancy logs</h3><button type="button" id="add-log">＋ Add log</button></div><div id="log-fields"></div><p class="muted">Unknown ETA? Leave it blank; the aircraft appears last.</p><p id="editor-notice" role="alert"></p><div class="dialog-actions"><button type="button" id="cancel">Cancel</button><button class="primary" type="submit">Save aircraft</button></div></form></dialog>`;
const notify=(s:string)=>{$('#notice').textContent=s;$('#editor-notice').textContent=s;};if(loadError)notify(loadError);
const glasses=new Glasses(s=>{$('#connection').textContent=s;},d=>move(d),()=>activate(),()=>{if(detail){detail=false;tick=0;renderHud();return true;}return false;});
function dayItems(){return sortAircraft(data.filter(a=>a.date===date));}
async function persist(next:Aircraft[],recovery=false,revision=shared?.revision,statusAction?:{aircraftId:string;logId:string}){if(shared){try{await shared.save(next,revision,statusAction);notify('');return true;}catch(e){notify((e as Error).message);return false;}}if(loadError&&!recovery){notify('Saved data is unreadable. Export it, then import a valid backup before editing.');return false;}try{validateData(next);localStorage.setItem(KEY,JSON.stringify(next));data=next;$('#save-state').textContent='Saved on this device · '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});notify('');return true;}catch(e){notify('Not saved: '+(e as Error).message);return false;}}
function render(){const all=dayItems(),logs=all.flatMap(a=>a.logs);$('#count').textContent=String(all.length);for(const [id,status] of [['pending','PEND'],['deferred','DEF'],['completed','C/W']])$('#'+id).textContent=String(logs.filter(l=>l.status===status).length);
 const visible=all.map(a=>({...a,logs:a.logs.filter(l=>(filter==='ALL'||l.status===filter)&&[a.tail,a.gate,l.number,l.description].some(t=>t.toLowerCase().includes(query)))})).filter(a=>a.logs.length);
 $('#aircraft').innerHTML=visible.length?visible.map(a=>`<article class="aircraft"><div class="aircraft-head"><div class="tail-icon">✈</div><div class="tail"><small>AIRCRAFT</small><h2>${esc(a.tail)}</h2></div><div class="arrival"><small>ETA</small><b>${militaryTime(a.eta)}</b></div><div class="gate"><small>GATE</small><b>${esc(a.gate)||'—'}</b></div><button data-edit="${esc(a.id)}" aria-label="Edit aircraft ${esc(a.tail)}">Edit</button></div><div class="log-list">${a.logs.map(l=>`<div class="log-row"><button class="log-number" data-view="${esc(l.id)}" title="Show on glasses">${esc(l.number)||'No log number'}</button><p>${esc(l.description)}</p><select aria-label="Status for log ${esc(l.number)}" data-status="${esc(l.id)}" class="status ${l.status==='C/W'?'cw':l.status.toLowerCase()}">${['PEND','DEF','C/W','SUPP','--'].map(s=>`<option ${s===l.status?'selected':''}>${s}</option>`).join('')}</select></div>`).join('')}</div><div class="aircraft-foot"><span>${a.logs.length} ${a.logs.length===1?'log':'logs'}${a.off?' · Off plane '+a.off:''}</span><button data-delete="${esc(a.id)}">Remove aircraft</button></div></article>`).join(''):`<div class="empty"><span>＋</span><h2>${all.length?'No matching logs':'Ready for your next shift'}</h2><p>${all.length?'Try another status or search.':'Add an aircraft, its arrival time, and the logs you’ll work today.'}</p>${!all.length?'<button class="primary" id="empty-add">Add your first aircraft</button>':''}</div>`;
 if(shared?.user.role==='viewer')document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('#add,#random-demo,#demo,#import,#clear-aircraft,[data-edit],[data-delete],[data-status],[data-action-status]').forEach(el=>el.disabled=true);
 $('#empty-add')?.addEventListener('click',()=>openEditor());renderHud();}
function renderHud(){
 const all=dayItems();selected=Math.max(0,Math.min(selected,all.length-1));
 const aircraft=all[selected];page=Math.max(0,Math.min(page,(aircraft?.logs.length||1)-1));
 if(!aircraft)detail=false;
 const log=aircraft?.logs[page];
 const overview=glassOverview(all,date,selected,tick,page);
 if(sharedStale){overview.text=overview.text.replace(overview.footer,'OFFLINE · last received data');overview.footer='OFFLINE · last received data';}
 const choices=[...ACTION_STATUSES,...((aircraft?.logs.length||0)>1?['Next log']:[])];
 choice=Math.max(0,Math.min(choice,choices.length-1));
 const content=detail ? [
  `A/C ${aircraft.tail} | OFF Plane Time: ${aircraft.off||'--:--'}`,
  `LOG NUMBER: ${log.number.replace(/^DEMO-/, '')||'TBD'} (${page+1}/${aircraft.logs.length})`,
  `${log.status} ${marquee(log.description,38,tick)}`,
  ...choices.map((s,i)=>`${i===choice?'>':' '} ${s}`),
  sharedStale?'Offline · reconnect to save':'Tap: save | Double tap: back'
 ].join('\n') : overview.text;
 $('#hud').classList.add('overview');
 if(detail){$('#hud').textContent=content;}else{$('#hud').innerHTML=`<span class="hud-heading"><span>${esc(overview.title)}</span><span>${esc(overview.clock)}</span></span><span class="hud-grid">${['A/C','ETA','GATE','STATUS','Discrepancy'].map((h,i)=>`<span class="hud-column"><span>${h}</span>${overview.cells.map(row=>`<span>${esc(row[i]||' ')}</span>`).join('')}</span>`).join('')}</span><span>${esc(overview.footer)}</span>`;}
 $('#page-label').textContent=detail?`LOG ${page+1} / ${aircraft.logs.length}`:all.length?`PAGE ${overview.pageIndex+1} / ${overview.pageCount}`:'0 / 0';
 $('#prev').toggleAttribute('disabled',detail?choice===0:overview.index===0);
 $('#next').toggleAttribute('disabled',detail?choice>=choices.length-1:overview.index>=overview.total-1);
 $('#prev').setAttribute('aria-label',detail?'Previous menu option':'Previous log row');
 $('#next').setAttribute('aria-label',detail?'Next menu option':'Next log row');
 $('#browse-label').textContent=detail?'Choose status':'Select discrepancy';
 $('#toggle-view').textContent=detail?'← All aircraft':'Open status menu';
 $('#toggle-view').toggleAttribute('disabled',!all.length);
 $('#status-actions').hidden=!detail;
 $('#next-aircraft-log').toggleAttribute('disabled',(aircraft?.logs.length||0)<2);
 glasses.send(content,detail?undefined:{title:overview.title,clock:overview.clock,footer:overview.footer,cells:overview.cells});
}
function move(d:number){if(detail)choice+=d;else {
 const rows=glassRows(dayItems());const index=rows.findIndex(r=>r.aircraftIndex===selected&&r.logIndex===page);
 const row=rows[Math.max(0,Math.min(index+d,rows.length-1))];if(row){selected=row.aircraftIndex;page=row.logIndex;}
 }tick=0;renderHud();}
function nextLog(){page=(page+1)%(dayItems()[selected]?.logs.length||1);choice=0;tick=0;renderHud();}
async function selectStatus(status:Status){if(shared?.user.role==='viewer'){notify('This account has view-only access.');return;}const a=dayItems()[selected];if(!a)return;const l=a.logs[page];
 if(await persist(applyLogStatus(data,a.id,l.id,status),false,shared?.revision,{aircraftId:a.id,logId:l.id})){detail=false;tick=0;render();notify(`${a.tail} / ${l.number||'log'}: ${status} · Off plane ${data.find(x=>x.id===a.id)!.off||'--:--'}`);}}
function activate(){if(detail){if(choice<ACTION_STATUSES.length)selectStatus(ACTION_STATUSES[choice]);else nextLog();}else{detail=true;choice=0;tick=0;renderHud();}}
setInterval(()=>{if($('#editor').hasAttribute('open'))return;tick++;renderHud();},500);
function logField(log?:Aircraft['logs'][number]){const el=document.createElement('div');el.className='log-edit';el.dataset.id=log?.id||uid();el.innerHTML=`<div class="fields"><label>Log number<input name="number" maxlength="32" placeholder="e.g. 9608226" value="${esc(log?.number||'')}"></label><label>Log status<select name="status">${['PEND','DEF','C/W','SUPP','--'].map(s=>`<option ${(log?.status??'--')===s?'selected':''}>${s}</option>`).join('')}</select></label></div><label>Brief discrepancy description<textarea name="description" required maxlength="240" rows="2" placeholder="Describe the item to work…">${esc(log?.description||'')}</textarea></label><button type="button" class="remove-log">Remove log</button>`;el.querySelector('button')!.onclick=()=>{if($('#log-fields').children.length>1)el.remove();};$('#log-fields').append(el);}
let editRevision:number|undefined;
function openEditor(id?:string){editRevision=shared?.revision;notify('');editing=id;const a=data.find(a=>a.id===id);$('#editor-title').textContent=a?'Edit aircraft':'Add aircraft';const form=$<HTMLFormElement>('#form');form.reset();for(const field of ['tail','eta','gate','off'] as const)(form.elements.namedItem(field) as HTMLInputElement).value=field==='eta'&&a?.eta?militaryTime(a.eta):a?.[field]||'';$('#log-fields').innerHTML='';if(a)a.logs.forEach(logField);else logField();$<HTMLDialogElement>('#editor').showModal();}
if(!isCompanion)$('#random-demo').onclick=async()=>{const samples=demoAircraft(date,dayItems());if(await persist([...data,...samples])){render();notify('Added 6 fictional demo aircraft for this day.');}};
$('#add').onclick=()=>openEditor();$('#close').onclick=$('#cancel').onclick=()=>$<HTMLDialogElement>('#editor').close();$('#add-log').onclick=()=>logField();
$('#form').onsubmit=async e=>{e.preventDefault();const f=new FormData($<HTMLFormElement>('#form'));const item:Aircraft={id:editing||uid(),date,tail:String(f.get('tail')).trim().toUpperCase(),eta:String(f.get('eta')).replace(/^([0-9]{2})([0-9]{2})$/,'$1:$2'),gate:String(f.get('gate')).trim().toUpperCase(),off:String(f.get('off')),logs:Array.from(document.querySelectorAll<HTMLElement>('.log-edit')).map(el=>({id:el.dataset.id!,number:el.querySelector<HTMLInputElement>('[name=number]')!.value.trim(),description:el.querySelector<HTMLTextAreaElement>('textarea')!.value.trim(),status:el.querySelector<HTMLSelectElement>('select')!.value as Status}))};if(!item.tail||item.logs.some(l=>!l.description)){notify('Enter a tail number and a description for each log.');return;}if(data.some(a=>a.date===date&&a.tail===item.tail&&a.id!==item.id)){notify('This aircraft is already on the day’s log. Edit it to add another discrepancy.');return;}const old=data.find(a=>a.id===item.id);if(old?.offRecordedAt)item.offRecordedAt=old.offRecordedAt;let next=[...data.filter(a=>a.id!==item.id),item];for(const l of item.logs){if(l.status!=='PEND'&&old?.logs.find(x=>x.id===l.id)?.status!==l.status)next=applyLogStatus(next,item.id,l.id,l.status);}if(await persist(next,false,editRevision)){$<HTMLDialogElement>('#editor').close();render();}};
$('#aircraft').onclick=async e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;if(b.dataset.edit)openEditor(b.dataset.edit);if(b.dataset.view){selected=dayItems().findIndex(a=>a.logs.some(l=>l.id===b.dataset.view));page=dayItems()[selected]?.logs.findIndex(l=>l.id===b.dataset.view)||0;detail=true;choice=0;tick=0;renderHud();}if(b.dataset.delete&&confirm('Remove this aircraft and its logs?')){if(await persist(data.filter(a=>a.id!==b.dataset.delete)))render();}};
$('#aircraft').onchange=async e=>{const s=e.target as HTMLSelectElement;if(s.dataset.status){const a=data.find(a=>a.logs.some(l=>l.id===s.dataset.status));if(a)await persist(applyLogStatus(data,a.id,s.dataset.status,s.value as Status),false,shared?.revision,{aircraftId:a.id,logId:s.dataset.status});render();}};
$('#date').onchange=e=>{const value=(e.target as HTMLInputElement).value;if(value){date=value;page=0;selected=0;detail=false;render();}};
$('#search').oninput=e=>{query=(e.target as HTMLInputElement).value.toLowerCase();render();};document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter!;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render();});
$('#toggle-view').onclick=()=>{if(detail){detail=false;renderHud();}else activate();};
document.querySelectorAll<HTMLButtonElement>('[data-action-status]').forEach(b=>b.onclick=()=>selectStatus(b.dataset.actionStatus as Status));
$('#next-aircraft-log').onclick=nextLog;
$('#prev').onclick=()=>move(-1);$('#next').onclick=()=>move(1);$('#connect').onclick=()=>void glasses.connect();
$('#clear-aircraft').onclick=async()=>{
 if(shared?.user.role==='viewer')return;
 if(!data.length){notify('There are no aircraft to clear.');return;}
 const revision=shared?.revision;
 if(!confirm(`Are you sure you want to clear all ${data.length} aircraft and their discrepancy logs from every shift date${shared?' for everyone':''}? This cannot be undone.`))return;
 const button=$<HTMLButtonElement>('#clear-aircraft');button.disabled=true;
 try{if(await persist([],false,revision)){selected=0;page=0;detail=false;tick=0;render();notify('All aircraft and discrepancy logs cleared.');}}finally{button.disabled=false;}
};
$('#export').onclick=()=>{const blob=new Blob([loadError?localStorage.getItem(KEY)||'[]':JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`platoon-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import').onclick=()=>$<HTMLInputElement>('#file').click();$('#file').onchange=async()=>{const input=$<HTMLInputElement>('#file'),file=input.files?.[0];if(!file)return;try{if(file.size>5000000)throw Error('Backup is too large.');const restored=validateData(JSON.parse(await file.text()));if(confirm(`Replace saved data with ${restored.length} aircraft from this backup?`)&&await persist(restored,true)){loadError='';render();}}catch(e){notify('Import failed: '+(e as Error).message);}input.value='';};
if(!isCompanion)$('#demo').onclick=async()=>{if(dayItems().length){notify('Choose an empty day to load the example.');return;}const examples=[{tail:'3074',eta:'13:27',gate:'87',logs:[['9608226','LT sun visor clip broken','C/W'],['1828904','2D tray table damaged','PEND']]},{tail:'3768',eta:'17:19',gate:'86',logs:[['1800396','203 lav paper dispenser will not stay latched','PEND']]},{tail:'3069',eta:'17:30',gate:'88A',logs:[['9317948','Mid lav Kleenex holder damaged','DEF']]}];if(await persist([...data,...examples.map(a=>({...a,id:uid(),date,off:'',logs:a.logs.map(([number,description,status])=>({id:uid(),number,description,status:status as Status}))}))])){render();notify('Example data loaded for this day. Statuses are illustrative; edit or remove these entries.');}};
// Populate an empty prototype once per device; deleting examples stays permanent.
try {
 const demoKey='super-platano-demo-initialized-v1';
 if(!shared&&!loadError&&!localStorage.getItem(demoKey)){
  if(dayItems().length){localStorage.setItem(demoKey,'1');}
  else if(await persist([...data,...demoAircraft(date)])){
   localStorage.setItem(demoKey,'1');
   notify('6 fictional demo aircraft loaded. Edit or remove them to try the prototype.');
  }
 }
}catch{notify('Demo data could not be saved on this device.');}
if(shared){
 accountTools(shared);
 shared.watch(state=>{
  const current=dayItems()[selected];const currentId=current?.id,logId=current?.logs[page]?.id;
  data=state.aircraft;loadError='';
  const next=dayItems().findIndex(a=>a.id===currentId);if(next>=0){selected=next;const nextLog=dayItems()[next].logs.findIndex(l=>l.id===logId);if(nextLog<0)detail=false;page=Math.max(0,nextLog);}else{detail=false;selected=0;page=0;}
  render();
 },message=>{$('#save-state').textContent=message;sharedStale=/Offline|Reconnecting|Session expired/.test(message);renderHud();});
 $('#save-state').textContent='Connecting to shared updates…';
}
render();
if((window as Window & {flutter_inappwebview?:unknown}).flutter_inappwebview)void glasses.connect();
