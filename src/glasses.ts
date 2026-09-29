import {RebuildPageContainer, CreateStartUpPageContainer, TextContainerProperty, MenuContainerProperty, MenuItemProperty, waitForEvenAppBridge, StartUpPageCreateResult, TextContainerUpgrade, OsEventTypeList, DeviceConnectType, type EvenAppBridge} from '@evenrealities/even_hub_sdk';
export type GlassGrid={title:string;clock?:string;footer:string;cells:string[][]};
export function displayContainers(content:string,grid?:GlassGrid){
 if(!grid)return [new TextContainerProperty({xPosition:8,yPosition:8,width:560,height:272,containerID:1,containerName:'running-log',content,isEventCapture:1})];
 const widths=[76,64,62,76,282],heads=['A/C','ETA','GATE','STATUS','Discrepancy'];let x=8;
 const columns=widths.map((width,i)=>{const result=new TextContainerProperty({xPosition:x,yPosition:40,width,height:190,containerID:10+i,containerName:'column-'+i,content:[heads[i],...grid.cells.map(row=>row[i]||' ')].join('\n'),borderWidth:2,borderColor:15,paddingLength:3,zOrderIndex:i+1,isEventCapture:i===0?1:0});x+=width;return result;});
 return [...columns,new TextContainerProperty({xPosition:8,yPosition:73,width:560,height:2,containerID:22,containerName:'header-rule',content:' ',borderWidth:2,borderColor:15,paddingLength:0,zOrderIndex:6,isEventCapture:0}),new TextContainerProperty({xPosition:8,yPosition:8,width:300,height:272,containerID:20,containerName:'heading',zOrderIndex:0,content:grid.title+'\n'.repeat(9)+grid.footer,isEventCapture:0}),new TextContainerProperty({xPosition:394,yPosition:8,width:178,height:30,containerID:21,containerName:'clock',zOrderIndex:7,content:grid.clock||'',paddingLength:0,isEventCapture:0})];
}
export class Glasses {
 private bridge?:EvenAppBridge; private started=false; private queue=Promise.resolve(); private latest='';private grid?:GlassGrid;private sentMode='';private sentCells=new Map<number,string>(); private connecting=false; private pending=false; private lastSent='';
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
    bridge.onDeviceStatusChanged(s=>{if(s.connectType!==DeviceConnectType.Connected)this.status('G2 disconnected • reconnect to retry');else this.send(this.latest,this.grid);});
   }
   this.send(this.latest,this.grid);
  }catch(e){this.status((e as Error).message);}finally{this.connecting=false;}
 }
 send(content:string,grid?:GlassGrid){this.latest=content;this.grid=grid;if(!this.bridge||this.pending||content===this.lastSent)return;this.pending=true;
  this.queue=this.queue.then(async()=>{
   const text=this.latest,grid=this.grid,bridge=this.bridge!,mode=grid?'grid':'detail';
   const textObject=displayContainers(text,grid);
   const props={containerTotalNum:textObject.length,textObject,menuObject:new MenuContainerProperty({menuItems:[new MenuItemProperty({itemID:1,itemName:'Previous'}),new MenuItemProperty({itemID:2,itemName:'Next'})]})};
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
   this.sentMode=mode;this.sentCells=new Map(textObject.map(c=>[c.containerID!,c.content!]));this.lastSent=text;this.status('G2 update accepted');
  }).catch(e=>this.status((e as Error).message)).finally(()=>{this.pending=false;if(this.latest!==content)this.send(this.latest,this.grid);});
 }
}
