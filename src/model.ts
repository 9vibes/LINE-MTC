import {getTextWidth} from '@evenrealities/pretext';
export type Status = 'C/W' | 'DEF' | 'PEND' | 'SUPP' | '--';
export type LogType = 'NEF' | 'MEL' | 'OPEN';
export type Log = {id:string;number:string;description:string;status:Status;logType?:LogType|null;healthPoints?:number|null};
export type Aircraft = {id:string;date:string;tail:string;eta:string;etd?:string;gate:string;off:string;offRecordedAt?:string;logs:Log[]};
export function displayClock(now=new Date()) {
 const days=['Sun','Mon','Tues','Wed','Thurs','Fri','Sat'];
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec'];
 return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} | ${now.getHours()%12||12}:${String(now.getMinutes()).padStart(2,'0')}${now.getHours()<12?'AM':'PM'} ${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}`;
}
export function departureHeader(a:Aircraft) {
 const etd=a.etd?militaryTime(a.etd):'--:--';
 const minutes=(value:string)=>{
  const match=militaryTime(value).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match?Number(match[1])*60+Number(match[2]):null;
 };
 const arrival=minutes(a.eta),departure=minutes(a.etd||'');
 if(arrival===null||departure===null)return `A/C ${a.tail} | ETD: ${etd} T- --:--`;
 const remaining=(departure-arrival+24*60)%(24*60);
 return `A/C ${a.tail} | ETD: ${etd} T-${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
}
export const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const militaryTime = (time:string) => time ? time.replace(/^([0-9]{2})([0-9]{2})$/,'$1:$2') : 'TBD';
export const sortAircraft = (items:Aircraft[]) => [...items].sort((a,b)=>(a.eta||'99:99').localeCompare(b.eta||'99:99') || a.tail.localeCompare(b.tail));
export function validateData(value:unknown):Aircraft[] {
 if(!Array.isArray(value)) throw Error('Backup must contain an aircraft list.');
 const ids=new Set<string>();
 for(const a of value){
  if(!a || typeof a.id!=='string' || ids.has(a.id)) throw Error('Invalid or duplicate aircraft ID.'); ids.add(a.id);
  for(const k of ['date','tail','eta','gate','off']) if(typeof a[k]!=='string') throw Error('Invalid aircraft fields.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(a.date) || !a.tail.trim() || a.tail.length>16 || a.gate.length>12) throw Error('Invalid aircraft details.');
  if(a.etd!==undefined&&typeof a.etd!=='string') throw Error('Invalid departure time.');
  for(const time of [a.eta,a.etd,a.off]) if(time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('Invalid time.');
  if(!Array.isArray(a.logs)||!a.logs.length) throw Error('Each aircraft needs a log.');
  for(const l of a.logs){if(!l || typeof l.id!=='string' || ids.has(l.id)) throw Error('Invalid log ID.'); ids.add(l.id);
   if(typeof l.number!=='string'||l.number.length>32||typeof l.description!=='string'||!l.description.trim()||l.description.length>240||!['C/W','DEF','PEND','SUPP','--'].includes(l.status)) throw Error('Invalid log details.');
   if(l.logType!=null&&!['NEF','MEL','OPEN'].includes(l.logType)) throw Error('Invalid log type.');
   if(l.healthPoints!=null&&(typeof l.healthPoints!=='number'||!Number.isFinite(l.healthPoints))) throw Error('Invalid health points.');
  }
 }
 return value;
}
export function glassPages(aircraft:Aircraft[],date:string){return sortAircraft(aircraft).flatMap(a=>a.logs.map((l,i)=>({aircraftId:a.id,logId:l.id, text:`PLATOON  /  ${date}\nA/C ${a.tail}   ETA ${militaryTime(a.eta)}   GATE ${a.gate||'TBD'}\n${l.status}   LOG ${l.number||'TBD'}   (${i+1}/${a.logs.length})\n\n${l.description}${a.off?'\nOFF PLANE '+a.off:''}`})));}

export const AIRCRAFT_PER_SCREEN = 6;
const compactField = (value:string, max:number) => {
 const clean=value.replace(/\s+/g,' ').trim();
 return clean.length>max ? clean.slice(0,max-1)+'~' : clean;
};
export function aircraftStatus(a:Aircraft): Status | 'MIX' {
 const states=new Set(a.logs.map(l=>l.status));
 return states.size===1 ? a.logs[0].status : 'MIX';
}
export const LOG_ROWS_PER_SCREEN = 6;
export function glassRows(aircraft:Aircraft[]) {
 return sortAircraft(aircraft).flatMap((a,aircraftIndex)=>a.logs.map((log,logIndex)=>({a,log,aircraftIndex,logIndex})));
}
export function glassOverview(aircraft:Aircraft[],date:string,selected:number,tick=0,selectedLog=0) {
 const entries=glassRows(aircraft);
 const index=Math.max(0,entries.findIndex(e=>e.aircraftIndex===selected&&e.logIndex===selectedLog));
 // Fill every page; repeat the aircraft identity at the top of a continuation page.
 const pages:number[][]=[];
 for(let i=0;i<entries.length;i+=LOG_ROWS_PER_SCREEN){
  pages.push(entries.slice(i,i+LOG_ROWS_PER_SCREEN).map((_,offset)=>i+offset));
 }
 const pageIndex=Math.max(0,pages.findIndex(p=>p.includes(index)));
 const visible=pages[pageIndex]||[];
 const cells:string[][]=[];
 const rows=visible.map((entryIndex,position)=>{
  const {a,log,logIndex}=entries[entryIndex];
  const parent=logIndex===0||position===0;
  const columns=[parent?compactField(a.tail,5):'└─',parent?militaryTime(a.eta):'',parent?compactField(a.gate||'?',4):'',log.status];
  cells.push([`${entryIndex===index?'>':' '} ${columns[0]}`,...columns.slice(1),discrepancyMarquee(log.description,entryIndex===index?tick:0)]);
  const prefix=columns.map((value,i)=>value.padEnd([6,5,4,6][i])).join(' | ');
  return `${entryIndex===index?'>':' '} ${prefix} | ${discrepancyMarquee(log.description,entryIndex===index?tick:0)}`;
 });
 const footer=entries.length?`${index+1}/${entries.length} logs | Tap: status`:'Add aircraft on your phone';
 return {arrowVisible:pageIndex<pages.length-1&&tick%2===0,hasMoreBelow:pageIndex<pages.length-1,index,start:visible[0]||0,rows,cells,title:'Super Platano Log',clock:displayClock(),footer,total:entries.length,pageIndex,pageCount:pages.length,text:[`Super Platano Log   ${displayClock()}`,'  '+['A/C'.padEnd(6),'ETA'.padEnd(5),'GATE','STATUS','Discrepancy'].join(' | '),...rows,footer].join('\n')};
}
export const ACTION_STATUSES = ['C/W','DEF','SUPP'] as const;
// Measure with the G2 font metrics, including kerning, against the native
// container's inner width. Character-class estimates either wrap or cut early.
export const DISCREPANCY_WIDTH = 282;
export const DISCREPANCY_PADDING = 1;
export const DISCREPANCY_TEXT_WIDTH = DISCREPANCY_WIDTH - 2 * (2 + DISCREPANCY_PADDING);
export function discrepancyMarquee(value:string,tick:number){
 const text=Array.from(value.replace(/\s+/g,' ').trim());
 const fit=(start:number)=>{
  let end=start;
  while(end<text.length&&getTextWidth(text.slice(start,end+1).join(''))<=DISCREPANCY_TEXT_WIDTH)end++;
  return end;
 };
 if(fit(0)===text.length)return text.join('');
 let last=0;while(fit(last)<text.length)last++;
 const cycle=Math.ceil(last/2)+8,step=tick%cycle;
 const start=Math.min(last,Math.max(0,(step-4)*2));
 return text.slice(start,fit(start)).join('');
}
export function marquee(value:string,width:number,tick:number){
 const text=value.replace(/\s+/g,' ').trim();
 if(text.length<=width)return text;
 const travel=text.length-width, cycle=Math.ceil(travel/2)+8, step=tick%cycle;
 const offset=Math.min(travel,Math.max(0,(step-4)*2));
 return text.slice(offset,offset+width);
}
export function applyLogStatus(items:Aircraft[],aircraftId:string,logId:string,status:Status):Aircraft[]{
 return items.map(a=>a.id!==aircraftId?a:{...a,logs:a.logs.map(l=>l.id===logId?{...l,status}:l)});
}
export function recordOffPlane(items:Aircraft[],aircraftId:string,now=new Date()):Aircraft[]{
 const off=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
 return items.map(a=>a.id===aircraftId?{...a,off,offRecordedAt:now.toISOString(),logs:a.logs.map(l=>({...l,status:'PEND' as const}))}:a);
}
