import {test,expect} from '@playwright/test';
test('operator bundles new logs by ship and day with plain numbers and no glasses preview',async({page})=>{
 const date=new Date().toLocaleDateString('en-CA');let state:any={revision:0,aircraft:[]};
 await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname.split('/').pop();if(route.request().method()==='PUT'){const body=route.request().postDataJSON();state={revision:state.revision+1,aircraft:body.aircraft};}if(path==='events'){await route.fulfill({contentType:'text/event-stream',body:`event: snapshot\ndata: ${JSON.stringify(state)}\n\n`});return;}await route.fulfill({contentType:'application/json',body:JSON.stringify(path==='config'?{mode:'shared'}:path==='session'?{user:{username:'operator',role:'operator'}}:state)});});
 await page.goto('/operator');await expect(page.getByRole('heading',{name:'Glasses view'})).toHaveCount(0);await expect(page.locator('#clear-aircraft')).toBeVisible();
 async function add(tail:string,number:string,eta:string,gate:string){await page.locator('#add').click();await page.getByLabel('Tail number').fill(tail);await page.getByLabel('Arrival time (ETA)').fill(eta);await page.getByLabel('Gate',{exact:true}).fill(gate);await page.getByLabel('Log number',{exact:true}).fill(number);await page.getByLabel('Brief discrepancy description').fill('Discrepancy '+number);await page.getByRole('button',{name:'Save aircraft',exact:true}).click();await expect(page.locator('#editor')).not.toBeVisible();}
 await add('ab3074','100','13:12','88A');await add('AB3074','200','','');
 await expect(page.locator('.aircraft')).toHaveCount(1);await expect(page.locator('.log-number')).toHaveText(['100','200']);await expect(page.locator('button.log-number')).toHaveCount(0);await expect(page.locator('.arrival b')).toHaveText('13:12');await expect(page.locator('.gate b')).toHaveText('88A');
 await page.reload();await expect(page.locator('.log-number')).toHaveText(['100','200']);
 await page.locator('#date').fill('2099-01-01');await add('AB3074','300','14:00','90');expect(state.aircraft).toHaveLength(2);await expect(page.locator('.log-number')).toHaveText(['300']);
});
