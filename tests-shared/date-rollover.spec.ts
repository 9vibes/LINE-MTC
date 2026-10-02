import {test,expect} from '@playwright/test';
test.use({timezoneId:'America/New_York'});
for(const packaged of [false,true])test(`${packaged?'phone':'website'} defaults to today, rolls over and preserves an open form's date`,async({page})=>{
 await page.clock.install({time:new Date('2026-09-29T23:59:58-04:00')});
 await page.addInitScript(()=>{(window as any).flutter_inappwebview={callHandler:async(...args:any[])=>JSON.parse(args[1]).method==='getLocalStorage'?'':true};});
 let state={revision:0,updatedAt:null,updatedBy:null,aircraft:['2026-09-28','2026-09-29','2026-09-30'].map((date,i)=>({id:'a'+i,date,tail:String(1111*(i+1)),eta:'13:12',gate:'87',off:'',logs:[{id:'l'+i,number:'123'+i,description:'Test discrepancy',status:'--'}]}))};
 await page.route('**/api/**',async route=>{
  const path=route.request().url().split('/').pop();
  if(path==='state'&&route.request().method()==='PUT'){const body=route.request().postDataJSON();state={...state,revision:state.revision+1,aircraft:body.aircraft};}
  if(path==='events'){await route.fulfill({contentType:'text/event-stream',body:`event: snapshot\ndata: ${JSON.stringify(state)}\n\n`});return;}
  await route.fulfill({contentType:'application/json',body:JSON.stringify(path==='config'?{mode:'shared',statusPreservesOffPlane:true}:path==='session'?{user:{username:'tester',role:'editor'}}:state)});
 });
 await page.goto(packaged?'http://127.0.0.1:3078/':'/');
 await expect(page.locator('#date')).toHaveValue('2026-09-29');await expect(page.locator('.tail h2')).toHaveText(['2222']);
 await page.getByRole('button',{name:'＋ Add aircraft',exact:true}).click();await page.getByLabel('Tail number').fill('4444');await page.getByLabel('Brief discrepancy description').fill('Draft before midnight');
 await page.clock.setFixedTime(new Date('2026-09-30T00:00:01-04:00'));await page.clock.runFor(600);
 await expect(page.locator('#date')).toHaveValue('2026-09-30');await expect(page.locator('#editor-notice')).toContainText('still save to 2026-09-29');
 await page.getByRole('button',{name:'Save aircraft',exact:true}).click();await expect(page.locator('.tail h2')).toHaveText(['3333']);expect(state.aircraft.find(a=>a.tail==='4444')?.date).toBe('2026-09-29');expect(state.aircraft).toHaveLength(4);
 await page.locator('#date').fill('2026-09-28');await expect(page.locator('.tail h2')).toHaveText(['1111']);
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(page.locator('#date')).toHaveValue('2026-09-30');await expect(page.locator('.tail h2')).toHaveText(['3333']);
 await page.locator('#date').fill('2026-09-28');await page.reload();await expect(page.locator('#date')).toHaveValue('2026-09-30');await expect(page.locator('.tail h2')).toHaveText(['3333']);
});
