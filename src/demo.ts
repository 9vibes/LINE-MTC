import {type Aircraft,type Status,uid} from './model';

// Fictional records for exercising the prototype, never actual maintenance records.
export function demoAircraft(date:string,existing:Aircraft[]=[]):Aircraft[]{
 const descriptions=['LT sun visor clip broken','2D tray table damaged','Aft lav paper dispenser will not stay latched','Forward closet hold-open latch loose','Mid lav tissue holder damaged','Seat 14C reading light inoperative','Overhead bin 22 latch requires inspection','Galley drawer handle loose','Seat 8A armrest cover cracked','Cabin window shade at 19F sticks when raised'];
 const used=new Set(existing.map(a=>a.tail));
 const statuses:Status[]=['PEND','PEND','C/W','DEF','SUPP','PEND'];
 return Array.from({length:6},(_,i)=>{
  let tail:string;do{tail=String(3000+Math.floor(Math.random()*6000));}while(used.has(tail));used.add(tail);
  const minutes=8*60+Math.floor(Math.random()*14*60);
  return {id:uid(),date,tail,eta:`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`,gate:`${80+Math.floor(Math.random()*15)}${i%2?'A':''}`,off:'',logs:Array.from({length:[3,1,2,1,2,1][i]},(_,j)=>({id:uid(),number:`DEMO-${Math.floor(1000000+Math.random()*9000000)}`,description:descriptions[(i*2+j)%descriptions.length],status:statuses[(i+j)%statuses.length]}))};
 });
}
