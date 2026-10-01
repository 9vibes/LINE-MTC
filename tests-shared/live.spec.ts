import {test,expect} from '@playwright/test';
for(const packaged of [false,true])test((packaged?'packaged companion: ':'website: ')+'two users share changes with glasses updates, conflicts and reload persistence',async({browser})=>{
 const operator=await browser.newContext();const phone=await browser.newContext();
 const a=await operator.newPage(),b=await phone.newPage();
 await b.addInitScript(()=>{(window as any).calls=[];(window as any).flutter_inappwebview={callHandler:async(...args:any[])=>{const msg=JSON.parse(args[1]);(window as any).calls.push(msg);return msg.method==='createStartUpPageContainer'?0:true;}};});
 for(const page of [a,b]){await page.goto(packaged&&page===b?'http://127.0.0.1:3078/':'/');await page.getByLabel('Username',{exact:true}).fill('operator');await page.getByLabel('Password',{exact:true}).fill('test-only-password-123456');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#save-state')).toContainText('Live');}
 // Create a separate editor identity and sign in on the phone.
 await a.request.post('/api/users',{headers:{Origin:'http://127.0.0.1:3077'},data:{username:'technician',password:'test-only-password-123456',role:'editor'}});
 await b.getByRole('button',{name:'Sign out',exact:true}).click();await b.getByLabel('Username',{exact:true}).fill('technician');await b.getByLabel('Password',{exact:true}).fill('test-only-password-123456');await b.getByRole('button',{name:'Sign in',exact:true}).click();await expect(b.locator('#save-state')).toContainText('Live');
 const snapshot=await (await a.request.get('/api/state')).json();await a.request.put('/api/state',{headers:{Origin:'http://127.0.0.1:3077'},data:{revision:snapshot.revision,aircraft:[]}});
 await expect(a.locator('.aircraft')).toHaveCount(0);await expect(b.locator('.aircraft')).toHaveCount(0);
 await a.getByRole('button',{name:'＋ Add aircraft',exact:true}).click();await a.getByLabel('Tail number').fill('3074');await a.getByLabel('Arrival time (ETA)').fill('13:12');await a.getByLabel('Gate',{exact:true}).fill('88A');await a.getByLabel('Log number',{exact:true}).fill('1234567');await a.getByLabel('Brief discrepancy description').fill('Tray table latch loose');await a.getByRole('button',{name:'Save aircraft',exact:true}).click();
 await expect(b.locator('.tail h2')).toHaveText(['3074']);await expect(b.locator('.arrival:not(.departure) b')).toHaveText(['13:12']);await expect.poll(async()=>JSON.stringify(await b.evaluate(()=>(window as any).calls))).toContain('3074');
 if(packaged){
  await b.getByRole('button',{name:'Edit aircraft 3074',exact:true}).click();
  await b.getByLabel('Departure time (ETD)',{exact:true}).fill('1510');
  await b.getByRole('button',{name:'Save aircraft',exact:true}).click();
  await expect(b.locator('#editor')).not.toBeVisible();await expect(a.locator('.departure b')).toHaveText('15:10');
  await a.getByRole('button',{name:'Edit aircraft 3074',exact:true}).click();
  await a.getByLabel('Log type',{exact:true}).selectOption('MEL');
  await a.getByRole('button',{name:'Save aircraft',exact:true}).click();
  await expect(a.getByLabel('Log type for log 1234567',{exact:true})).toHaveText('MEL');
  await b.reload();await expect(b.locator('.departure b')).toHaveText('15:10');
  await expect(b.getByLabel('Log type for log 1234567',{exact:true})).toHaveText('MEL');await expect(b.locator('.log-number')).toHaveText('1234567 | MEL');await expect(b.locator('select[data-log-type]')).toHaveCount(0);await expect(b.locator('.phone-log-type')).toHaveCSS('color','rgb(180, 35, 24)');
 }
 await a.getByRole('button',{name:'Edit aircraft 3074',exact:true}).click();await a.getByLabel('Gate',{exact:true}).fill('90');
 await b.getByLabel('Status for log 1234567').selectOption('C/W');await expect(a.getByLabel('Status for log 1234567')).toHaveValue('C/W');
 await a.getByRole('button',{name:'Save aircraft',exact:true}).click();await expect(a.locator('#editor-notice')).toContainText('Another user changed');await a.getByRole('button',{name:'Cancel',exact:true}).click();await expect(a.locator('.gate b')).toHaveText(['88A']);
 await b.reload();await expect(b.getByLabel('Status for log 1234567')).toHaveValue('C/W');await expect(b.locator('.aircraft-foot')).not.toContainText('Off plane');
 await b.getByRole('button',{name:'Open status menu',exact:true}).click();
 if(packaged)await expect(b.locator('#hud')).toContainText('LOG NUMBER: 1234567 | MEL');
 await b.getByRole('button',{name:'LOG TIME OFF PLANE',exact:true}).click();
 await expect(a.locator('.aircraft-foot')).toContainText('Off plane');
 await expect(b.getByLabel('Status for log 1234567')).toHaveValue('C/W');
 const offBefore=(await (await a.request.get('/api/state')).json()).aircraft[0].offRecordedAt;
 await b.getByRole('button',{name:'Open status menu',exact:true}).click();await b.locator('[data-action-status="DEF"]').click();
 await expect(a.getByLabel('Status for log 1234567')).toHaveValue('DEF');
 expect((await (await a.request.get('/api/state')).json()).aircraft[0].offRecordedAt).toBe(offBefore);
 const current=await (await a.request.get('/api/state')).json();const selectedDate=current.aircraft[0].date;
 const otherDate=selectedDate==='2099-01-01'?'2099-01-02':'2099-01-01';
 const other={...current.aircraft[0],id:'another-day',date:otherDate,logs:current.aircraft[0].logs.map((l:any)=>({...l,id:'another-day-log'}))};
 const seeded=await (await a.request.put('/api/state',{headers:{Origin:'http://127.0.0.1:3077'},data:{revision:current.revision,aircraft:[...current.aircraft,other]}})).json();
 const preserved=seeded.aircraft.find((entry:any)=>entry.id===other.id);
 // Observe the extra date on the phone before clearing the original shift.
 await b.locator('#date').fill(otherDate);await expect(b.locator('.aircraft')).toHaveCount(1);await b.locator('#date').fill(selectedDate);await expect(b.locator('.aircraft')).toHaveCount(1);
 const clearPage=packaged?a:b;
 if(packaged){await expect(b.locator('#clear-aircraft')).toHaveCount(0);await expect(b.locator('.brand')).toContainText('🍌');await expect(b.locator('.brand')).toContainText('SUPER PLATANO A/C ROUTING');await expect(b.locator('header .local')).not.toContainText('SHARED');await b.setViewportSize({width:390,height:844});expect(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();const tops=await b.locator('.aircraft-head').first().locator('.tail,.arrival,.gate').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top));expect(Math.max(...tops)-Math.min(...tops)).toBeLessThan(15);}
 const clear=clearPage.getByRole('button',{name:'Clear this day’s aircraft',exact:true});
 clearPage.once('dialog',async dialog=>{expect(dialog.message()).toContain(`for ${selectedDate} only`);await dialog.dismiss();});
 await clear.click();await expect(b.locator('.aircraft')).toHaveCount(1);await expect(a.locator('.aircraft')).toHaveCount(1);
 clearPage.once('dialog',dialog=>dialog.accept());await clear.click();
 await expect(b.locator('.aircraft')).toHaveCount(0);await expect(a.locator('.aircraft')).toHaveCount(0);await b.reload();await expect(b.locator('.aircraft')).toHaveCount(0);
 const remaining=await (await a.request.get('/api/state')).json();expect(remaining.aircraft).toEqual([preserved]);
 {await clear.click();await expect(clearPage.locator('#notice')).toContainText(`There are no aircraft to clear for ${selectedDate}`);await b.locator('#date').fill(otherDate);await expect(b.locator('.aircraft')).toHaveCount(1);}
 if(packaged){await b.getByRole('button',{name:'Sign out',exact:true}).click();await expect(b.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await expect.poll(()=>b.evaluate(()=>localStorage.getItem('line-mtc-companion-session'))).toBeNull();}
 await operator.close();await phone.close();
});
