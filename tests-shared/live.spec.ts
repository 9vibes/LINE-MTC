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
 await expect(b.locator('.tail h2')).toHaveText(['3074']);await expect(b.locator('.arrival b')).toHaveText(['13:12']);await expect.poll(async()=>JSON.stringify(await b.evaluate(()=>(window as any).calls))).toContain('3074');
 await a.getByRole('button',{name:'Edit aircraft 3074',exact:true}).click();await a.getByLabel('Gate',{exact:true}).fill('90');
 await b.getByLabel('Status for log 1234567').selectOption('C/W');await expect(a.locator('#hud')).toContainText('C/W');
 await a.getByRole('button',{name:'Save aircraft',exact:true}).click();await expect(a.locator('#editor-notice')).toContainText('Another user changed');await a.getByRole('button',{name:'Cancel',exact:true}).click();await expect(a.locator('.gate b')).toHaveText(['88A']);
 await b.reload();await expect(b.getByLabel('Status for log 1234567')).toHaveValue('C/W');await expect(b.locator('.aircraft-foot')).toContainText('Off plane');
 b.once('dialog',async dialog=>{expect(dialog.message()).toContain('every shift date for everyone');await dialog.dismiss();});
 await b.getByRole('button',{name:'Clear all aircraft',exact:true}).click();await expect(b.locator('.aircraft')).toHaveCount(1);await expect(a.locator('.aircraft')).toHaveCount(1);
 b.once('dialog',dialog=>dialog.accept());await b.getByRole('button',{name:'Clear all aircraft',exact:true}).click();
 await expect(b.locator('.aircraft')).toHaveCount(0);await expect(a.locator('.aircraft')).toHaveCount(0);await b.reload();await expect(b.locator('.aircraft')).toHaveCount(0);
 if(packaged){await b.getByRole('button',{name:'Sign out',exact:true}).click();await expect(b.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await expect.poll(()=>b.evaluate(()=>localStorage.getItem('line-mtc-companion-session'))).toBeNull();}
 await operator.close();await phone.close();
});
