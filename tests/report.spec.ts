import {test,expect} from '@playwright/test';
import ExcelJS from 'exceljs';
import {createReport} from '../src/report';
import {validateData,today,type Aircraft} from '../src/model';
const make=(date=today()):Aircraft=>({id:'report-aircraft',date,tail:'08337',eta:'13:29',gate:'93',off:'',logs:[
 {id:'report-log',number:'01839400',description:'TOILET PAPER HOLDER LAV 201',status:'C/W'},
 {id:'report-log-2',number:'01839401',description:'=Literal text, not a formula',status:'DEF'}]});

test('report workbook follows template, preserves identifiers and includes only selected date',async()=>{
 const a=make('2026-09-30');a.logs[0].logType='NEF';a.logs[0].healthPoints=-.5;
 const other={...make('2026-09-29'),id:'other'};
 const book=new ExcelJS.Workbook();await book.xlsx.load(await createReport([a,other],'2026-09-30'));
 const sheet=book.worksheets[0];
 expect(sheet.getCell('A1').value).toBe('DATE:09/30/26');expect(sheet.getCell('G2').isMerged).toBe(true);
 expect(sheet.getCell('A4').value).toBe('08337');expect(sheet.getCell('C4').value).toBe('01839400');
 expect(sheet.getCell('B4').value).toBe('NEF');expect(sheet.getCell('E4').value).toBe(-.5);
 expect(sheet.getCell('D5').value).toBe('=Literal text, not a formula');expect(sheet.getCell('A6').value).toBeNull();
 expect(sheet.rowCount).toBe(23);expect(sheet.getCell('B4').dataValidation.formulae).toEqual(['"NEF,MEL,OPEN"']);
 expect(sheet.pageSetup.orientation).toBe('landscape');expect(sheet.pageSetup.printTitlesRow).toBe('1:3');
 expect(sheet.getCell('A3').fill).toMatchObject({fgColor:{argb:'FFAA0000'}});
 expect(()=>validateData([{...a,logs:[{...a.logs[0],logType:'INVALID'}]}])).toThrow('Invalid log type');
 expect(()=>validateData([{...a,logs:[{...a.logs[0],healthPoints:Infinity}]}])).toThrow('Invalid health points');
 expect(()=>validateData([make()])).not.toThrow();
});

test('operator report fields persist through edit, export ignores filter, and empty input clears points',async({page},testInfo)=>{
 let state:any={revision:0,aircraft:[make()]};
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname.split('/').pop();
  if(route.request().method()==='PUT'){state={revision:state.revision+1,aircraft:route.request().postDataJSON().aircraft};}
  if(path==='events'){await route.fulfill({contentType:'text/event-stream',body:`event: snapshot\ndata: ${JSON.stringify(state)}\n\n`});return;}
  await route.fulfill({contentType:'application/json',body:JSON.stringify(path==='config'?{mode:'shared'}:path==='session'?{user:{username:'operator',role:'operator'}}:state)});
 });
 await page.setViewportSize({width:1440,height:1000});await page.goto('/operator');
 await page.getByLabel('Log type for log 01839400',{exact:true}).selectOption('NEF');
 await page.getByLabel('Health points for log 01839400',{exact:true}).fill('-0.5');await page.getByLabel('Health points for log 01839400',{exact:true}).press('Tab');
 await expect.poll(()=>state.aircraft[0].logs[0].healthPoints).toBe(-.5);
 expect(state.aircraft[0].off).toBe('');
 await page.reload();await expect(page.getByLabel('Health points for log 01839400',{exact:true})).toHaveValue('-0.5');
 await page.getByRole('button',{name:'Edit aircraft 08337'}).click();await page.getByRole('button',{name:'Save aircraft',exact:true}).click();
 await expect(page.locator('#editor')).not.toBeVisible();expect(state.aircraft[0].logs[0].logType).toBe('NEF');expect(state.aircraft[0].logs[0].healthPoints).toBe(-.5);
 await page.screenshot({path:testInfo.outputPath('report-controls.png'),fullPage:true});
 await page.locator('[data-filter="C/W"]').click();await expect(page.locator('.log-row')).toHaveCount(1);
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Print Report',exact:true}).click();const download=await downloaded;
 expect(download.suggestedFilename()).toBe(`LINE-MTC-report-${today()}.xlsx`);
 const path=testInfo.outputPath('report.xlsx');await download.saveAs(path);const book=new ExcelJS.Workbook();await book.xlsx.readFile(path);
 expect(book.worksheets[0].getCell('C5').value).toBe('01839401');
 await page.getByLabel('Health points for log 01839400',{exact:true}).fill('');await page.getByLabel('Health points for log 01839400',{exact:true}).press('Tab');
 await expect.poll(()=>state.aircraft[0].logs[0].healthPoints).toBeNull();
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
