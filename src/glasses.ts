import {arrowOn,arrowOff} from './scroll-arrow';
import {getTextWidth,pxTruncate} from '@evenrealities/pretext';
import {DISCREPANCY_WIDTH, DISCREPANCY_PADDING} from './model';
import {ImageContainerProperty,ImageRawDataUpdate,ImageRawDataUpdateResult,RebuildPageContainer, CreateStartUpPageContainer, TextContainerProperty, MenuContainerProperty, MenuItemProperty, waitForEvenAppBridge, StartUpPageCreateResult, TextContainerUpgrade, OsEventTypeList, DeviceConnectType, type EvenAppBridge} from '@evenrealities/even_hub_sdk';
export type GlassGrid={title:string;clock?:string;hasMoreBelow?:boolean;arrowVisible?:boolean;footer:string;cells:string[][]};
export function displayContainers(content:string,grid?:GlassGrid,offPlane?:string){
 if(!grid&&offPlane){
  const [heading,...body]=content.split("\n");
  const width=getTextWidth(offPlane)+2;
  const countdown=heading.match(/ T[+-]\s*\d{2,}:\d{2}$| T- --:--$/)?.[0].trim()||'';
  const left=countdown?heading.slice(0,heading.lastIndexOf(' T')):heading;
  const countdownWidth=getTextWidth(countdown)+2;
  const countdownX=Math.floor(288-countdownWidth/2);
  const leftWidth=countdownX-18;
  return [new TextContainerProperty({xPosition:8,yPosition:8,width:leftWidth,height:27,containerID:2,containerName:"detail-heading",paddingLength:0,content:pxTruncate(left,leftWidth),isEventCapture:0}),new TextContainerProperty({xPosition:countdownX,yPosition:8,width:countdownWidth,height:27,containerID:4,containerName:"countdown",paddingLength:0,content:countdown,isEventCapture:0}),new TextContainerProperty({xPosition:568-width,yPosition:8,width,height:27,containerID:3,containerName:"off-plane",paddingLength:0,content:offPlane,isEventCapture:0}),new TextContainerProperty({xPosition:8,yPosition:35,width:560,height:245,containerID:1,containerName:"running-log",paddingLength:0,content:body.join("\n"),isEventCapture:1})];
 }
 if(!grid)return [new TextContainerProperty({xPosition:8,yPosition:8,width:560,height:272,containerID:1,containerName:'running-log',content,isEventCapture:1})];
 const widths=[76,64,62,76,DISCREPANCY_WIDTH],heads=['A/C','ETA','GATE','STATUS','Discrepancy'];let x=8;
 const columns=widths.map((width,i)=>{const result=new TextContainerProperty({xPosition:x,yPosition:40,width,height:210,containerID:10+i,containerName:'column-'+i,content:[heads[i],...grid.cells.map(row=>row[i]||' ')].join('\n'),borderWidth:2,borderColor:15,paddingLength:i===4?DISCREPANCY_PADDING:3,zOrderIndex:i+2,isEventCapture:i===0?1:0});x+=width;return result;});
 return [...columns,new TextContainerProperty({xPosition:8,yPosition:68,width:560,height:2,containerID:22,containerName:'header-rule',content:' ',borderWidth:2,borderColor:15,paddingLength:0,zOrderIndex:7,isEventCapture:0}),new TextContainerProperty({xPosition:8,yPosition:8,width:300,height:272,containerID:20,containerName:'heading',zOrderIndex:0,content:grid.title+'\n'.repeat(9)+(grid.hasMoreBelow?'↓ ':'')+grid.footer,isEventCapture:0}),new TextContainerProperty({xPosition:568-Math.ceil(getTextWidth(grid.clock||''))-2,yPosition:8,width:Math.ceil(getTextWidth(grid.clock||''))+2,height:30,containerID:21,containerName:'clock',zOrderIndex:8,content:grid.clock||'',paddingLength:0,isEventCapture:0})];
}
export class Glasses {
 private bridge?:EvenAppBridge; private started=false; private queue=Promise.resolve(); private latest='';private grid?:GlassGrid;private offPlane?:string;private sentMode='';private sentCells=new Map<number,string>(); private connecting=false; private pending=false; private lastSent='';private lastOffPlane?:string;private lastArrow?:boolean;
 constructor(private status:(s:string)=>void,private move:(delta:number)=>void,private activate:()=>void,private back:()=>boolean){}
 async connect(){
  if(this.connecting)return; this.connecting=true; this.status('Connecting…');
  try {
   const bridge=await Promise.race([waitForEvenAppBridge(),new Promise<never>((_,r)=>setTimeout(()=>r(Error('Open this app inside Even Realities to connect your G2.')),7000))]);
   if(!this.bridge){this.bridge=bridge;
    bridge.onEvenHubEvent(e=>{// Protobuf omits zero-valued CLICK_EVENT in some native/simulator events.
     const type=e.textEvent?.eventType ?? e.sysEvent?.eventType ?? ((e.textEvent || e.sysEvent) ? OsEventTypeList.CLICK_EVENT : undefined);
     if(type===OsEventTypeList.CLICK_EVENT)this.activate();
     if(type===OsEventTypeList.SCROLL_TOP_EVENT)this.move(-1);
     if(type===OsEventTypeList.SCROLL_BOTTOM_EVENT)this.move(1);
     if(type===OsEventTypeList.DOUBLE_CLICK_EVENT&&!this.back())void bridge.shutDownPageContainer(1).catch(()=>this.status('Could not close glasses view.'));
     if(e.menuItemClickEvent?.itemID===1)this.move(-1);
     if(e.menuItemClickEvent?.itemID===2)this.move(1);
    });
    bridge.onDeviceStatusChanged(s=>{if(s.connectType!==DeviceConnectType.Connected)this.status('G2 disconnected • reconnect to retry');else this.send(this.latest,this.grid,this.offPlane);});
   }
   this.send(this.latest,this.grid,this.offPlane);
  }catch(e){this.status((e as Error).message);}finally{this.connecting=false;}
 }
 send(content:string,grid?:GlassGrid,offPlane?:string){this.latest=content;this.grid=grid;this.offPlane=offPlane;if(!this.bridge||this.pending||(content===this.lastSent&&offPlane===this.lastOffPlane&&Boolean(grid?.arrowVisible)===this.lastArrow))return;this.pending=true;
  this.queue=this.queue.then(async()=>{
   const text=this.latest,grid=this.grid,offPlane=this.offPlane,bridge=this.bridge!;
   const textObject=displayContainers(text,grid,offPlane);
   const mode=JSON.stringify(textObject.map(c=>[c.containerID,c.xPosition,c.yPosition,c.width,c.height]));
   const imageObject=grid?[new ImageContainerProperty({xPosition:27,yPosition:228,width:20,height:20,containerID:30,containerName:"scroll-arrow",zOrderIndex:1})]:[];
   const props={containerTotalNum:textObject.length+imageObject.length,textObject,imageObject,menuObject:new MenuContainerProperty({menuItems:[new MenuItemProperty({itemID:1,itemName:'Previous'}),new MenuItemProperty({itemID:2,itemName:'Next'})]})};
   if(!this.started){
    const result=await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(props));
    if(result!==StartUpPageCreateResult.success)throw Error('G2 page not created. Check connection and retry.');this.started=true;
   }else if(mode!==this.sentMode){
    if(!await bridge.rebuildPageContainer(new RebuildPageContainer(props)))throw Error('G2 layout update failed.');
   }else{
    for(const cell of textObject){if(this.sentCells.get(cell.containerID!)===cell.content)continue;
     if(!await bridge.textContainerUpgrade(new TextContainerUpgrade({containerID:cell.containerID,containerName:cell.containerName,content:cell.content})))throw Error('G2 update failed. Reconnect to retry.');
    }
   }
   const arrowVisible=Boolean(grid?.hasMoreBelow&&grid.arrowVisible);
   if(grid&&(mode!==this.sentMode||arrowVisible!==this.lastArrow)){
    const result=await bridge.updateImageRawData(new ImageRawDataUpdate({containerID:30,containerName:'scroll-arrow',imageData:arrowVisible?arrowOn:arrowOff}));
    if(result!==ImageRawDataUpdateResult.success)throw Error('G2 arrow update failed. Reconnect to retry.');
   }
   this.lastArrow=arrowVisible;
   this.sentMode=mode;this.sentCells=new Map(textObject.map(c=>[c.containerID!,c.content!]));this.lastSent=text;this.lastOffPlane=offPlane;this.status('G2 update accepted');
  }).catch(e=>this.status((e as Error).message)).finally(()=>{this.pending=false;if(this.latest!==content||this.offPlane!==offPlane)this.send(this.latest,this.grid,this.offPlane);});
 }
}
