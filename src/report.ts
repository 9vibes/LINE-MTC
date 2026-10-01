import ExcelJS from 'exceljs';
import {sortAircraft,type Aircraft} from './model';

/** Export the full selected shift, independent of the screen's search/status filters. */
export async function createReport(items:Aircraft[],date:string) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid report date.');
 const book=new ExcelJS.Workbook();
 book.creator='LINE MTC';
 const sheet=book.addWorksheet('Daily aircraft',{
  views:[{state:'frozen',ySplit:3,showGridLines:false}],
  pageSetup:{paperSize:1 as ExcelJS.PaperSize,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,
   horizontalCentered:true,margins:{left:.25,right:.25,top:.3,bottom:.3,header:.1,footer:.1}}
 });
 [12,13,14,44,17,15,45].forEach((width,i)=>sheet.getColumn(i+1).width=width);
 sheet.mergeCells('A1:G2');
 const [year,month,day]=date.split('-');
 sheet.getCell('A1').value=`DATE:${month}/${day}/${year.slice(-2)}`;
 sheet.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17365D'}};
 sheet.getCell('A1').font={name:'Arial',size:13,bold:true,color:{argb:'FFFFFFFF'}};
 sheet.getCell('A1').alignment={horizontal:'center',vertical:'middle'};
 sheet.getRow(1).height=14;sheet.getRow(2).height=14;
 const headers=['A/C','MEL/NEF','LOG #','DESCRIPTION','HEALTH\nSCORE (LOG\nPOINTS)','ACTION','COMMENTS DEF REASON'];
 const header=sheet.getRow(3);header.values=headers;header.height=54;
 header.eachCell(cell=>{
  cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFAA0000'}};
  cell.font={name:'Arial',size:10,bold:true,color:{argb:'FFFFFFFF'}};
  cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
 });
 let index=4;
 for(const aircraft of sortAircraft(items.filter(a=>a.date===date)))for(const log of aircraft.logs){
  const row=sheet.getRow(index++);
  // Strings are stored as text, never interpreted as formulas or numeric identifiers.
  row.values=[aircraft.tail,log.logType??'',log.number,log.description,log.healthPoints??null,log.status,''];
  const lines=log.description.split(/\r?\n/).reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/43)),0);
  row.height=Math.max(20,lines*14+6);
 }
 const last=Math.max(23,index-1);
 for(let r=3;r<=last;r++)for(let c=1;c<=7;c++){
  const cell=sheet.getCell(r,c);
  cell.border={top:{style:'thin',color:{argb:'FF000000'}},bottom:{style:'thin',color:{argb:'FF000000'}},left:{style:'thin',color:{argb:'FF000000'}},right:{style:'thin',color:{argb:'FF000000'}}};
  if(r>3){
   cell.font={name:'Arial',size:10,bold:true,color:{argb:'FF000000'}};
   cell.alignment={horizontal:c===7?'left':'center',vertical:'middle',wrapText:true};
   if(r>=index)sheet.getRow(r).height=20;
  }
 }
 for(let r=4;r<=last;r++)sheet.getCell(r,2).dataValidation={type:'list',allowBlank:true,formulae:['"NEF,MEL,OPEN"'],showErrorMessage:true,errorTitle:'Choose a log type',error:'Select NEF, MEL, or OPEN.'};
 sheet.pageSetup.printArea=`A1:G${last}`;
 sheet.pageSetup.printTitlesRow='1:3';
 return book.xlsx.writeBuffer();
}

export async function downloadReport(items:Aircraft[],date:string){
 const bytes=await createReport(items,date);
 const blob=new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=`LINE-MTC-report-${date}.xlsx`;
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
