import {displayContainers} from '../src/glasses';
import {test,expect} from '@playwright/test';
import {sortAircraft,glassPages,validateData,glassOverview,aircraftStatus,displayClock,marquee,discrepancyMarquee,applyLogStatus} from '../src/model';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('super-platano-demo-initialized-v1','1'));});
test('ETA sorting keeps unknown last and preserves multiple logs',()=>{
 const a=(tail:string,eta:string)=>({id:tail,date:'2026-09-29',tail,eta,gate:'88A',off:'',logs:[{id:tail+'l',number:'001',description:'Test',status:'PEND' as const}]});
 const items=[a('later','17:30'),a('unknown',''),a('early','09:15')];
 expect(sortAircraft(items).map(a=>a.tail)).toEqual(['early','later','unknown']);
 items[2].logs.push({...items[2].logs[0],id:'second',number:'002'});
 expect(glassPages(items,'2026-09-29').map(p=>p.logId)).toEqual(['earlyl','second','laterl','unknownl']);
 expect(()=>validateData([{...items[0],eta:'29:00'}])).toThrow();
 expect(()=>validateData([{...items[0],logs:[{...items[0].logs[0],status:'DONE'}]}])).toThrow();
});
test('phone entry, sorting, edit, statuses and reload persistence',async({page})=>{
 await page.goto('/');
 async function add(tail:string,eta:string){await page.getByRole('button',{name:'＋ Add aircraft',exact:true}).click();await page.getByLabel('Tail number').fill(tail);await page.getByLabel('Arrival time (ETA)').fill(eta);await page.getByLabel('Gate',{exact:true}).fill('88A');await page.getByLabel('Log number',{exact:true}).fill('100'+tail);await page.getByLabel('Brief discrepancy description').fill('Cabin latch damaged');await page.getByRole('button',{name:'Save aircraft'}).click();}
 await add('3069','1730');await add('3074','1327');
 await expect(page.locator('.arrival b')).toHaveText(['13:27','17:30']);
 await expect(page.getByLabel('Status for log 1003074')).toHaveValue('--');
 await expect(page.getByLabel('Status for log 1003069')).toHaveValue('--');
 await expect(page.locator('.tail h2')).toHaveText(['3074','3069']);
 await page.getByLabel('Status for log 1003074').selectOption('C/W');
 await page.getByRole('button',{name:'Edit aircraft 3074'}).click();
 await page.getByRole('button',{name:'＋ Add log',exact:true}).click();
 await page.getByLabel('Log number',{exact:true}).nth(1).fill('002');await page.getByLabel('Brief discrepancy description').nth(1).fill('Tray table damaged');
 await page.getByRole('button',{name:'Save aircraft'}).click();
 await page.reload();await expect(page.locator('.log-row')).toHaveCount(3);await expect(page.getByLabel('Status for log 1003074')).toHaveValue('C/W');
 await page.locator('[data-filter="--"]').click();await expect(page.locator('.log-row')).toHaveCount(2);
 await page.getByRole('button',{name:'All logs',exact:true}).click();
 await page.getByRole('button',{name:'002',exact:true}).click();await expect(page.locator('#hud')).toContainText('Tray table damaged');
 await page.getByLabel('Search aircraft and logs').fill('3069');await expect(page.locator('.tail h2')).toHaveText(['3069']);
});
test('mobile layout, backup validation, example preview',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Load example'}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await expect(page.locator('.aircraft')).toHaveCount(3);
 await page.screenshot({path:'preview-phone.png',fullPage:true});
 await page.locator('#file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('[{"tail":"bad"}]')});
 await expect(page.locator('#notice')).toContainText('Import failed');await expect(page.locator('.aircraft')).toHaveCount(3);
 await page.reload();await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'preview-desktop.png',fullPage:true});
});
test('G2 bridge creates one page then sends updated log text',async({page})=>{
 await page.addInitScript(()=>{(window as any).calls=[];(window as any).flutter_inappwebview={callHandler:async(...args:any[])=>{(window as any).calls.push(args);return JSON.parse(args[1]).method==='createStartUpPageContainer'?0:true;}};});
 await page.goto('/');await page.getByRole('button',{name:'Load example'}).click();
 await expect.poll(async()=>JSON.stringify(await page.evaluate(()=>(window as any).calls))).toContain('createStartUpPageContainer');
 await expect(page.locator('.hud-column').nth(0)).toContainText('3074');
 await expect(page.locator('.hud-column').nth(0)).toContainText('3768');
 await page.getByRole('button',{name:'Open status menu',exact:true}).click();
 await page.getByRole('button',{name:'Next discrepancy log',exact:true}).click();
 await expect(page.locator('#connection')).toHaveText('G2 update accepted');
 const calls=await page.evaluate(()=>(window as any).calls.map((a:any[])=>JSON.parse(a[1])));
 expect(calls.filter((c:any)=>c.method==='createStartUpPageContainer')).toHaveLength(1);
 expect(calls.at(-1).data.content).toContain('1828904');
 expect(calls[0].data.textObject[0].isEventCapture).toBe(1);
});

test('overview has one bounded row per aircraft, five per page, with honest mixed status',()=>{
 const items=Array.from({length:7},(_,i)=>({id:String(i),date:'2026-09-29',tail:'N1234567890123456',eta:`1${i}:00`,gate:'LONGGATE1234',off:'',logs:[{id:'l'+i,number:'001',description:'Test',status:'C/W' as const}]}));
 const first=glassOverview(items,'2026-09-29',0);
 expect(first.rows).toHaveLength(5);expect(first.text.split('\n')).toHaveLength(8);
 expect(first.rows.every(row=>row.length<=80&&!row.includes('\n'))).toBeTruthy();
 expect(first.rows[0]).toContain('N123~');
 const second=glassOverview(items,'2026-09-29',5);expect(second.rows).toHaveLength(2);expect(second.rows[0]).toContain('15:00');
 expect(aircraftStatus({...items[0],logs:[...items[0].logs,{id:'pending',number:'2',description:'Open',status:'PEND'}]})).toBe('MIX');
});
test('overview navigation opens selected aircraft and returns to list',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Load example'}).click();
 await page.getByRole('button',{name:'Next log row',exact:true}).click();
 await expect(page.locator('#hud')).toContainText('> └─');
 await page.getByRole('button',{name:'Open status menu',exact:true}).click();
 await expect(page.locator('#hud')).toContainText('1828904');
 await page.getByRole('button',{name:'← All aircraft',exact:true}).click();
 await expect(page.locator('#hud')).toContainText('> └─');
 await expect(page.locator('#hud')).toContainText('3069');
});

test('glasses status selection stamps time, affects only chosen log, and survives reload',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-09-29T20:25:00Z'));
 await page.goto('/');await page.getByRole('button',{name:'Load example'}).click();
 await page.getByRole('button',{name:'Open status menu',exact:true}).click();
 await page.getByRole('button',{name:'Next discrepancy log',exact:true}).click();
 await page.locator('[data-action-status="SUPP"]').click();
 await expect(page.getByLabel('Status for log 1828904')).toHaveValue('SUPP');
 await expect(page.getByLabel('Status for log 9608226')).toHaveValue('C/W');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('platoon-running-log-v1')!));
 expect(saved[0].offRecordedAt).toBe('2026-09-29T20:25:00.000Z');
 expect(saved[0].off).toMatch(/^\d{2}:\d{2}$/);
 await page.reload();await expect(page.getByLabel('Status for log 1828904')).toHaveValue('SUPP');
 await expect(page.locator('.aircraft').first()).toContainText('Off plane '+saved[0].off);
 await page.getByRole('button',{name:'Open status menu',exact:true}).click();
 await page.getByRole('button',{name:'← All aircraft',exact:true}).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('platoon-running-log-v1')!)[0].offRecordedAt)).toBe(saved[0].offRecordedAt);
});
test('long text marquee scrolls to the end then resets without reversing',()=>{
 const text='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
 expect(marquee('short',18,20)).toBe('short');
 expect(marquee(text,18,0)).toBe(text.slice(0,18));
 expect(marquee(text,18,13)).toBe(text.slice(-18));
 expect(marquee(text,18,16)).toBe(text.slice(-18));
 expect(marquee(text,18,17)).toBe(text.slice(0,18));
});

test('multiple logs fill pages and repeat the aircraft identity on continuation',()=>{
 const a=(id:string,count:number)=>({id,date:'2026-09-29',tail:id,eta:'13:00',gate:'87',off:'',logs:Array.from({length:count},(_,i)=>({id:id+i,number:String(i),description:'Discrepancy '+i,status:'PEND' as const}))});
 const items=[a('3074',3),a('8104',3),a('9000',4)];
 const first=glassOverview(items,'2026-09-29',0,0,1);
 expect(first.rows).toHaveLength(5);
 expect(first.rows.filter(r=>r.includes('3074'))).toHaveLength(1);
 expect(first.rows[1]).toContain('> └─');expect(first.rows[1]).toContain('PEND   | Discrepancy 1');
 expect(first.rows[2]).toContain('└─');expect(first.rows[2]).toContain('PEND   | Discrepancy 2');
 expect(first.rows[3]).toContain('8104');
 expect(first.rows[4]).toContain('└─');
 const second=glassOverview(items,'2026-09-29',1,0,2);expect(second.rows[0]).toContain('8104');expect(second.pageIndex).toBe(1);
 expect(second.rows).toHaveLength(5);expect(second.pageCount).toBe(2);
 expect(second.cells[0][1]).toBe('13:00');expect(second.cells[0][2]).toBe('87');
 expect(second.rows[1]).toContain('9000');
 const oversized=glassOverview([a('9999',7)],'2026-09-29',0,0,6);
 expect(oversized.rows[0]).toContain('9999');expect(oversized.rows[1]).toContain('> └─');
});

test('native grid borders connect and update layout without overflowing container budget',()=>{
 const columns=displayContainers('',{title:'Title',footer:'Footer',cells:[['> 3074','13:27','87','PEND','Discrepancy'],['  └─','','','DEF','Second log']]});
 expect(columns).toHaveLength(8);expect(columns.filter(c=>c.isEventCapture===1)).toHaveLength(1);
 for(let i=0;i<5;i++){expect(columns[i].yPosition).toBe(40);expect(columns[i].height).toBe(190);expect(columns[i].borderWidth).toBe(2);expect(columns[i].borderColor).toBe(15);if(i<4)expect(columns[i].xPosition!+columns[i].width!).toBe(columns[i+1].xPosition);}
 expect(columns[4].xPosition!+columns[4].width!).toBe(568);
 const divider=columns.find(c=>c.containerName==='header-rule')!;expect(divider.xPosition).toBe(8);expect(divider.width).toBe(560);expect(divider.yPosition).toBe(73);expect(divider.height).toBe(2);
 expect(new Set(columns.map(c=>c.zOrderIndex)).size).toBe(8);
 expect(columns.find(c=>c.containerName==='heading')!.zOrderIndex).toBeLessThan(columns[0].zOrderIndex!);
 expect(columns.slice(0,5).every(c=>c.content!.split('\n').length===3)).toBeTruthy();
});

test('glasses title and live clock use requested wording and format',async({page})=>{
 expect(displayClock(new Date(2026,8,29,16,34))).toBe('16:34 Tues Sept 29');
 await page.clock.setFixedTime(new Date(2026,8,29,16,34));
 await page.goto('/');
 await expect(page.locator('.hud-heading')).toContainText('Super Platano Log');
 await expect(page.locator('.hud-heading')).toContainText('16:34 Tues Sept 29');
 await page.clock.setFixedTime(new Date(2026,8,29,16,35));
 await expect(page.locator('.hud-heading')).toContainText('16:35 Tues Sept 29');
 const containers=displayContainers('',{title:'Super Platano Log',clock:'16:34 Tues Sept 29',footer:'1/4 logs',cells:[]});
 expect(containers).toHaveLength(8);
 expect(containers.find(c=>c.containerName==='clock')?.xPosition).toBe(394);
});

test('discrepancies fit proportional text and scroll to the final characters',()=>{
 const text='Forward closet hold open latch requires inspection';
 expect(discrepancyMarquee('LT sun visor clip',0)).toBe('LT sun visor clip');
 expect(discrepancyMarquee('iiiiiiiiiiiiiiiiiiiiiiiiiiiiii',0)).toHaveLength(30);
 expect(discrepancyMarquee('WWWWWWWWWWWWWWWWWWWW',0)).toHaveLength(15);
 const frames=Array.from({length:150},(_,i)=>discrepancyMarquee(text,i));
 expect(frames.some(frame=>frame.endsWith('inspection'))).toBeTruthy();
 expect(frames.every(frame=>text.includes(frame)&&frame.length>0)).toBeTruthy();
 const starts=frames.map(frame=>text.indexOf(frame));
 expect(starts.every((start,i)=>i===0||start>=starts[i-1]||start===0)).toBeTruthy();
});

test('unset status works in glasses actions, phone editor, filters and persistence',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Load example',exact:true}).click();
 await page.getByRole('button',{name:'Open status menu',exact:true}).click();
 await page.locator('[data-action-status="--"]').click();
 await expect(page.getByLabel('Status for log 9608226')).toHaveValue('--');
 const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('platoon-running-log-v1')!));
 expect(records.find((a:any)=>a.tail==='3074').off).toBe('');
 expect(()=>validateData(records)).not.toThrow();
 await page.reload();await expect(page.getByLabel('Status for log 9608226')).toHaveValue('--');
 await page.getByRole('button',{name:'Edit aircraft 3074'}).click();
 await expect(page.locator('#editor select[name="status"]').first()).toHaveValue('--');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.locator('[data-filter="--"]').click();await expect(page.locator('.log-row')).toHaveCount(1);
});
