import {initializeApp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {getFirestore,collection,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,onSnapshot,query,where,orderBy,limit,arrayUnion,arrayRemove,serverTimestamp,writeBatch} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";
import {loadCloudDraft,saveCloudDraft} from "./cloud-drafts.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id),canvas=$("board"),wrap=$("canvas-wrap"),ctx=canvas.getContext("2d");
const STORAGE="iliam-whiteboard-local-v1";
const types=new Set(["pen","highlighter","eraser","hand","line","rect","ellipse","arrow","text","sticky"]);
const drawKinds=new Set(["pen","highlighter","line","rect","ellipse","arrow","text","sticky"]);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),validHex=s=>/^#[0-9a-fA-F]{6}$/.test(s);
let tool="pen",color="#2360e7",width=4,grid=true,paper="#ffffff";
let items=[],preview=null,active=null,spaceDown=false,cam={x:0,y:0,z:1},localDraft=null;
let history=[],future=[],user=null,profile=null,room=null,stopItems=null,stopRoom=null;
let saveTimer=null,busy=false,frame=0,sharingBusy=false;
let inviteAccounts=[],libraryRequest=0;
const status=s=>{$("save-state").textContent=s;};
const roomStatus=s=>{$("room-status").textContent=s;};
function accessMode(data=room){return data?.accessMode||"legacy";}
function invitedUids(data=room){return Array.isArray(data?.invitedUids)?data.invitedUids:[];}
function isBoardOwner(){return !!room && !!user && room.ownerId===user.uid;}
function canEditBoard(){
 if(!room)return true;
 if(!user||!profile)return false;
 return isBoardOwner()||["link","legacy"].includes(accessMode())||invitedUids().includes(user.uid);
}
function canViewBoard(){
 if(!room)return true;
 return accessMode()==="link" ||
  (Boolean(user&&profile) && (accessMode()==="legacy"||isBoardOwner()||invitedUids().includes(user.uid)));
}
function renderBoardPermissions(){
 const edit=canEditBoard(),owner=isBoardOwner();
 document.querySelectorAll(".tool").forEach(b=>{b.disabled=!!room&&!edit&&b.dataset.tool!=="hand";});
 if(room&&!edit&&tool!=="hand")setTool("hand");
 $("paper-color").disabled=Boolean(room&&!owner);
 $("board-title").readOnly=Boolean(room&&!owner);
 $("clear-board").disabled=Boolean(room&&!owner);
 $("undo").disabled=!history.length||!edit;
 $("redo").disabled=!future.length||!edit;
}
function newId(){
 const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
 return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function safeTitle(raw){return String(raw||"Untitled Whiteboard").trim().slice(0,60)||"Untitled Whiteboard";}
function normalizeElement(raw){
 if(!raw||!drawKinds.has(raw.kind))return null;
 const n=v=>Number.isFinite(Number(v))?clamp(Number(v),-100000,100000):0;
 const result={
  kind:raw.kind,x:n(raw.x),y:n(raw.y),x2:n(raw.x2),y2:n(raw.y2),
  color:validHex(raw.color)?raw.color:"#2360e7",
  width:clamp(Number(raw.width)||4,1,40),
  opacity:clamp(Number(raw.opacity)||1,0.05,1),
  text:String(raw.text||"").slice(0,250),
  points:[]
 };
 if(Array.isArray(raw.points))result.points=raw.points.slice(0,240).map(p=>({x:n(p?.x),y:n(p?.y)}));
 if((result.kind==="pen"||result.kind==="highlighter")&&!result.points.length)
  result.points=[{x:result.x,y:result.y}];
 return result;
}
function initLocal(){
 localDraft={items:[],title:"Untitled Whiteboard",paper:"#ffffff"};
 items=[];$("board-title").value=localDraft.title;
 paper=localDraft.paper;$("paper-color").value=paper;
}
function applyDraft(raw){
 if(!raw||!Array.isArray(raw.items))return;
 localDraft={
  items:raw.items.slice(0,400).map(e=>({...normalizeElement(e),id:String(e.id||newId())})).filter(e=>drawKinds.has(e.kind)),
  title:safeTitle(raw.title),paper:validHex(raw.paper)?raw.paper:"#ffffff"
 };
 items=localDraft.items.map(e=>({...e}));
 $("board-title").value=localDraft.title;
 paper=localDraft.paper;$("paper-color").value=paper;
 history=[];future=[];schedule();
}
async function restoreAccountDraft(){
 if(room)return;
 try{
  const saved=await loadCloudDraft('whiteboard');
  if(saved.content){applyDraft(JSON.parse(saved.content));status("Whiteboard restored from iLiam account");return;}
  if(!saved.user){status("Sign in to iLiam to save this whiteboard");return;}
  // Legacy browser data may belong to another user of a shared Chromebook.
  const legacy=localStorage.getItem(STORAGE);
  if(legacy&&confirm("Found an old whiteboard saved in this browser. Import it into the currently signed-in iLiam account?")){
   const old=JSON.parse(legacy);applyDraft(old);
   await saveCloudDraft('whiteboard',JSON.stringify(localDraft),saved.user);
   localStorage.removeItem(STORAGE);
   status("Old whiteboard moved to your iLiam account");
  }
 }catch(e){status("Cloud draft unavailable — export your whiteboard: "+e.message);}
}
async function writeLocal(){
 if(room)return;
 localDraft={items:items.slice(-400).map(e=>({...e})),title:safeTitle($("board-title").value),paper};
 try{
  await saveCloudDraft('whiteboard',JSON.stringify(localDraft),user?.uid);
  status("Saved to iLiam account");
 }catch(e){status("Not cloud-saved — export your board: "+e.message);}
}
function saveLocalSoon(){if(room)return;status("Saving to iLiam…");clearTimeout(saveTimer);saveTimer=setTimeout(writeLocal,4000);}
function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;paint();});}
function geometry(){
 const r=wrap.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 return {w:r.width,h:r.height,dpr};
}
function toWorld(clientX,clientY){
 const r=wrap.getBoundingClientRect();
 return {x:(clientX-r.left-cam.x)/cam.z,y:(clientY-r.top-cam.y)/cam.z};
}
function pathStroke(points){
 if(!points?.length)return;
 ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
 if(points.length===1){ctx.lineTo(points[0].x+.01,points[0].y+.01);return;}
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
}
function drawItem(item){
 const e=normalizeElement(item);if(!e)return;
 ctx.save();ctx.strokeStyle=e.color;ctx.fillStyle=e.color;
 ctx.lineWidth=e.width;ctx.globalAlpha=e.opacity;ctx.lineCap="round";ctx.lineJoin="round";
 const dx=e.x2-e.x,dy=e.y2-e.y;
 switch(e.kind){
  case "pen":case "highlighter":
   if(e.kind==="highlighter"){ctx.globalAlpha=.3;ctx.lineWidth=Math.max(10,e.width*3);}
   pathStroke(e.points);ctx.stroke();break;
  case "line":
   ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x2,e.y2);ctx.stroke();break;
  case "arrow":{
   const angle=Math.atan2(dy,dx),tip=Math.max(12,e.width*3);
   ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x2,e.y2);
   ctx.moveTo(e.x2,e.y2);
   ctx.lineTo(e.x2-tip*Math.cos(angle-.5),e.y2-tip*Math.sin(angle-.5));
   ctx.moveTo(e.x2,e.y2);
   ctx.lineTo(e.x2-tip*Math.cos(angle+.5),e.y2-tip*Math.sin(angle+.5));ctx.stroke();break;
  }
  case "rect":ctx.strokeRect(e.x,e.y,dx,dy);break;
  case "ellipse":{
   ctx.beginPath();ctx.ellipse((e.x+e.x2)/2,(e.y+e.y2)/2,Math.max(1,Math.abs(dx)/2),Math.max(1,Math.abs(dy)/2),0,0,Math.PI*2);ctx.stroke();break;
  }
  case "text":{
   ctx.font="bold "+Math.round(14+e.width*3)+"px Verdana,Arial,sans-serif";
   ctx.textBaseline="top";for(const [i,line] of e.text.split("\n").slice(0,5).entries())ctx.fillText(line,e.x,e.y+i*(18+e.width*3));break;
  }
  case "sticky":{
   const w=200,h=145;
   ctx.globalAlpha=1;ctx.fillStyle="#fff2a8";ctx.shadowColor="#0002";ctx.shadowBlur=12;ctx.fillRect(e.x,e.y,w,h);
   ctx.shadowBlur=0;ctx.fillStyle=e.color;ctx.fillRect(e.x,e.y,w,7);
   ctx.fillStyle="#263043";ctx.font="15px Verdana,Arial,sans-serif";ctx.textBaseline="top";
   const words=e.text.split(/\s+/),lines=[];let line="";
   for(const word of words){
    const next=line?line+" "+word:word;
    if(ctx.measureText(next).width>170&&line){lines.push(line);line=word;}
    else line=next;
   }
   if(line)lines.push(line);
   lines.slice(0,6).forEach((t,i)=>ctx.fillText(t,e.x+15,e.y+22+i*19));
   break;
  }
 }
 ctx.restore();
}
function paint(){
 if(!ctx)return;
 const {w,h,dpr}=geometry();
 ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
 if(grid){
  ctx.strokeStyle=paper==="#ffffff"?"#cfd8e455":"#ffffff19";ctx.lineWidth=1;
  const space=32*cam.z;
  if(space>=8){
   const sx=((cam.x%space)+space)%space,sy=((cam.y%space)+space)%space;
   ctx.beginPath();
   for(let x=sx;x<w;x+=space){ctx.moveTo(x,0);ctx.lineTo(x,h);}
   for(let y=sy;y<h;y+=space){ctx.moveTo(0,y);ctx.lineTo(w,y);}ctx.stroke();
  }
 }
 ctx.save();ctx.translate(cam.x,cam.y);ctx.scale(cam.z,cam.z);
 for(const e of items)drawItem(e);
 if(preview)drawItem(preview);
 ctx.restore();
 $("item-count").textContent=items.length+" objects";
 $("empty-hint").hidden=items.length>0||Boolean(preview);
 $("zoom-value").textContent=Math.round(cam.z*100)+"%";
 $("undo").disabled=!history.length||!canEditBoard();$("redo").disabled=!future.length||!canEditBoard();
}
function setTool(next){
 if(!types.has(next))return;tool=next;
 document.querySelectorAll(".tool").forEach(b=>{const yes=b.dataset.tool===tool;b.classList.toggle("active",yes);b.setAttribute("aria-pressed",String(yes));});
 wrap.dataset.tool=tool;status(room?"Live collaboration":"Saved locally");
}
function historyPush(action){history.push(action);if(history.length>60)history.shift();future=[];schedule();}
function distanceToSegment(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
function hitTest(e,p){
 const tol=Math.max(9,e.width+7)/cam.z;
 if(e.kind==="sticky")return p.x>=e.x-tol&&p.x<=e.x+200+tol&&p.y>=e.y-tol&&p.y<=e.y+145+tol;
 if(e.kind==="text")return Math.abs(p.x-e.x)<Math.max(120,e.text.length*10)&&Math.abs(p.y-e.y)<60;
 if(e.kind==="pen"||e.kind==="highlighter"){
  return e.points.some((point,i)=>i&&distanceToSegment(p,e.points[i-1],point)<tol)||e.points.some(point=>Math.hypot(p.x-point.x,p.y-point.y)<tol);
 }
 if(e.kind==="line"||e.kind==="arrow")return distanceToSegment(p,{x:e.x,y:e.y},{x:e.x2,y:e.y2})<tol;
 if(e.kind==="rect"){
  const x1=Math.min(e.x,e.x2),x2=Math.max(e.x,e.x2),y1=Math.min(e.y,e.y2),y2=Math.max(e.y,e.y2);
  return p.x>=x1-tol&&p.x<=x2+tol&&p.y>=y1-tol&&p.y<=y2+tol;
 }
 if(e.kind==="ellipse"){
  const rx=Math.max(1,Math.abs(e.x2-e.x)/2),ry=Math.max(1,Math.abs(e.y2-e.y)/2);
  const x=(p.x-(e.x+e.x2)/2)/rx,y=(p.y-(e.y+e.y2)/2)/ry;
  return x*x+y*y<=1.25;
 }
 return false;
}
async function publish(action,undo=false){
 if(!room){saveLocalSoon();return;}
 if(!canEditBoard()){status("View only — sign in or ask the owner for access.");return;}
 try{
  const r=doc(db,"whiteboards",room.id,"elements",action.item?.id||"");
  if(action.kind==="add"){
   if(undo)await deleteDoc(r);
   else await setDoc(r,{...normalizeElement(action.item),createdBy:user.uid,createdAt:serverTimestamp()});
  }else if(action.kind==="delete"){
   if(undo)await setDoc(r,{...normalizeElement(action.item),createdBy:user.uid,createdAt:serverTimestamp()});
   else await deleteDoc(r);
  }else if(action.kind==="clear"){
   const batch=writeBatch(db);
   for(const e of action.items.slice(0,400)){
    const ref=doc(db,"whiteboards",room.id,"elements",e.id);
    if(undo)batch.set(ref,{...normalizeElement(e),createdBy:user.uid,createdAt:serverTimestamp()});
    else batch.delete(ref);
   }
   await batch.commit();
  }
  status("Synced to shared room");
 }catch(e){
  status("Sync failed: "+e.message);
  console.error("Whiteboard save:",e);
  alert("Could not save to Firebase. Make sure the whiteboard Firestore rules have been published. "+e.message);
 }
}
function pushElement(e){
 const elem={...normalizeElement(e),id:newId()};if(!elem)return;
 items.push(elem);historyPush({kind:"add",item:elem});publish({kind:"add",item:elem});
}
function eraseAt(p){
 const i=items.findLastIndex(e=>hitTest(e,p));if(i<0)return;
 const [item]=items.splice(i,1);
 historyPush({kind:"delete",item});publish({kind:"delete",item});
}
async function undo(){
 if(!canEditBoard()||!history.length)return;
 const action=history.pop();
 if(action.kind==="add")items=items.filter(e=>e.id!==action.item.id);
 else if(action.kind==="delete")items.push(action.item);
 else if(action.kind==="clear")items=[...action.items];
 future.push(action);schedule();await publish(action,true);
}
async function redo(){
 if(!canEditBoard()||!future.length)return;
 const action=future.pop();
 if(action.kind==="add")items.push(action.item);
 else if(action.kind==="delete")items=items.filter(e=>e.id!==action.item.id);
 else if(action.kind==="clear")items=[];
 history.push(action);schedule();await publish(action,false);
}
function addText(p,sticky){
 const message=prompt(sticky?"Enter your sticky note (up to 250 characters):":"Enter text for the board:");
 if(message===null||!message.trim())return;
 pushElement({kind:sticky?"sticky":"text",x:p.x,y:p.y,x2:p.x,y2:p.y,color,width,opacity:1,text:message.trim().slice(0,250),points:[]});
}
function onDown(e){
 if(e.button!==0&&e.pointerType==="mouse")return;
 if(room&&!canEditBoard()&&!spaceDown&&tool!=="hand"){status("View only — sign in or ask the owner for access.");return;}
 wrap.focus({preventScroll:true});
 const p=toWorld(e.clientX,e.clientY);
 $("cursor-coordinates").textContent="x: "+Math.round(p.x)+" · y: "+Math.round(p.y);
 if(tool==="eraser"){eraseAt(p);return;}
 if(tool==="text"||tool==="sticky"){addText(p,tool==="sticky");return;}
 active={
  pointer:e.pointerId,start:p,last:p,tool:spaceDown||tool==="hand"?"hand":tool,
  camStart:{...cam},client:{x:e.clientX,y:e.clientY}
 };
 try{canvas.setPointerCapture(e.pointerId);}catch{}
 if(active.tool!=="hand"){
  preview={kind:active.tool,x:p.x,y:p.y,x2:p.x,y2:p.y,
   color,width,opacity:active.tool==="highlighter"?.3:1,text:"",
   points:[{x:p.x,y:p.y}]};
 }
 schedule();
}
function onMove(e){
 const p=toWorld(e.clientX,e.clientY);
 $("cursor-coordinates").textContent="x: "+Math.round(p.x)+" · y: "+Math.round(p.y);
 if(!active||e.pointerId!==active.pointer)return;
 if(active.tool==="hand"){
  cam.x=active.camStart.x+e.clientX-active.client.x;
  cam.y=active.camStart.y+e.clientY-active.client.y;
 }else if(preview){
  preview.x2=p.x;preview.y2=p.y;
  if(preview.kind==="pen"||preview.kind==="highlighter"){
   const pts=preview.points,last=pts[pts.length-1];
   if(Math.hypot(p.x-last.x,p.y-last.y)>=2/cam.z&&pts.length<239)pts.push({x:p.x,y:p.y});
  }
 }
 schedule();
}
function onUp(e){
 if(!active||e.pointerId!==active.pointer)return;
 if(preview){
  const copy=preview;preview=null;
  if((copy.kind==="pen"||copy.kind==="highlighter")&&copy.points.length===1)copy.points.push({...copy.points[0]});
  const d=Math.hypot(copy.x2-copy.x,copy.y2-copy.y);
  if(d>2||copy.kind==="pen"||copy.kind==="highlighter")pushElement(copy);
 }
 active=null;schedule();
}
function zoom(factor,clientX,clientY){
 const rect=wrap.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
 const old=cam.z,next=clamp(old*factor,.25,4);
 cam.x=x-(x-cam.x)/old*next;cam.y=y-(y-cam.y)/old*next;cam.z=next;schedule();
}
function fit(){
 cam={x:0,y:0,z:1};schedule();
}
function toSvg(){
 const escape=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;").replace(/>/g,"&gt;");
 const box=extent();
 const W=Math.ceil(box.w),H=Math.ceil(box.h),xmin=box.x,ymin=box.y;
 let out='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="'+xmin+' '+ymin+' '+W+' '+H+'">';
 out+='<rect x="'+xmin+'" y="'+ymin+'" width="'+W+'" height="'+H+'" fill="'+paper+'"/>';
 for(const raw of items){
  const e=normalizeElement(raw);if(!e)continue;
  const common=' stroke="'+e.color+'" stroke-width="'+e.width+'" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="'+e.opacity+'"';
  const p=e.points.map(t=>t.x+','+t.y).join(' ');
  if(e.kind==="pen"||e.kind==="highlighter")out+='<polyline points="'+p+'"'+common+' stroke-width="'+(e.kind==="highlighter"?e.width*3:e.width)+'" opacity="'+(e.kind==="highlighter"?.3:e.opacity)+'"/>';
  else if(e.kind==="line")out+='<line x1="'+e.x+'" y1="'+e.y+'" x2="'+e.x2+'" y2="'+e.y2+'"'+common+'/>';
  else if(e.kind==="rect")out+='<rect x="'+Math.min(e.x,e.x2)+'" y="'+Math.min(e.y,e.y2)+'" width="'+Math.abs(e.x2-e.x)+'" height="'+Math.abs(e.y2-e.y)+'"'+common+'/>';
  else if(e.kind==="ellipse")out+='<ellipse cx="'+(e.x+e.x2)/2+'" cy="'+(e.y+e.y2)/2+'" rx="'+Math.abs(e.x2-e.x)/2+'" ry="'+Math.abs(e.y2-e.y)/2+'"'+common+'/>';
  else if(e.kind==="arrow"){
   const angle=Math.atan2(e.y2-e.y,e.x2-e.x),t=Math.max(12,e.width*3);
   out+='<path d="M'+e.x+' '+e.y+' L'+e.x2+' '+e.y2+' M'+e.x2+' '+e.y2+' L'+(e.x2-t*Math.cos(angle-.5))+' '+(e.y2-t*Math.sin(angle-.5))+' M'+e.x2+' '+e.y2+' L'+(e.x2-t*Math.cos(angle+.5))+' '+(e.y2-t*Math.sin(angle+.5))+'"'+common+'/>';
  }else if(e.kind==="text"){
   out+='<text x="'+e.x+'" y="'+e.y+'" font-size="'+(14+e.width*3)+'" font-family="Verdana,Arial" fill="'+e.color+'">'+escape(e.text)+'</text>';
  }else if(e.kind==="sticky"){
   out+='<rect x="'+e.x+'" y="'+e.y+'" width="200" height="145" fill="#fff2a8"/>';
   out+='<text x="'+(e.x+12)+'" y="'+(e.y+29)+'" font-size="14" font-family="Verdana,Arial" fill="#263043">'+escape(e.text.slice(0,90))+'</text>';
  }
 }
 return out+'</svg>';
}
function extent(){
 if(!items.length)return {x:0,y:0,w:1200,h:750};
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 const include=(x,y)=>{minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);};
 for(const e of items){
  include(e.x,e.y);include(e.x2,e.y2);
  if(e.kind==="pen"||e.kind==="highlighter")for(const p of e.points)include(p.x,p.y);
  if(e.kind==="sticky")include(e.x+200,e.y+145);
  if(e.kind==="text")include(e.x+Math.min(1200,e.text.length*14),e.y+100);
 }
 const x=minX-50,y=minY-50;
 return {x,y,w:clamp(maxX-x+50,200,5000),h:clamp(maxY-y+50,200,5000)};
}
function download(blob,filename){
 const url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function exportPNG(){
 const b=extent(),scale=Math.min(2,4096/Math.max(b.w,b.h));
 const out=document.createElement("canvas");
 out.width=Math.ceil(b.w*scale);out.height=Math.ceil(b.h*scale);
 if(!out.width||!out.height)return;
 // Render using the same drawItem function on a temporary context without altering the board.
 const original=ctx;const target=out.getContext("2d");
 target.fillStyle=paper;target.fillRect(0,0,out.width,out.height);
 target.setTransform(scale,0,0,scale,-b.x*scale,-b.y*scale);
 for(const e of items)drawExportItem(target,e);
 out.toBlob(blob=>{if(blob)download(blob,filename("png"));},"image/png");
}
function drawExportItem(target,e){
 // Reuse the regular renderer with a lexical context swap via explicit drawing.
 const el=normalizeElement(e);if(!el)return;
 target.save();target.strokeStyle=el.color;target.fillStyle=el.color;target.lineWidth=el.width;
 target.globalAlpha=el.kind==="highlighter"?.3:el.opacity;target.lineCap="round";target.lineJoin="round";
 if(el.kind==="pen"||el.kind==="highlighter"){
  target.lineWidth=el.kind==="highlighter"?el.width*3:el.width;
  target.beginPath();const pts=el.points;
  target.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))target.lineTo(p.x,p.y);target.stroke();
 }else if(el.kind==="line"||el.kind==="arrow"){
  target.beginPath();target.moveTo(el.x,el.y);target.lineTo(el.x2,el.y2);
  if(el.kind==="arrow"){
   const angle=Math.atan2(el.y2-el.y,el.x2-el.x),t=Math.max(12,el.width*3);
   for(const sign of [-1,1]){target.moveTo(el.x2,el.y2);target.lineTo(el.x2-t*Math.cos(angle+sign*.5),el.y2-t*Math.sin(angle+sign*.5));}
  }
  target.stroke();
 }else if(el.kind==="rect")target.strokeRect(el.x,el.y,el.x2-el.x,el.y2-el.y);
 else if(el.kind==="ellipse"){
  target.beginPath();target.ellipse((el.x+el.x2)/2,(el.y+el.y2)/2,Math.max(1,Math.abs(el.x2-el.x)/2),Math.max(1,Math.abs(el.y2-el.y)/2),0,0,Math.PI*2);target.stroke();
 }else if(el.kind==="text"){
  target.font="bold "+Math.round(14+el.width*3)+"px Verdana,Arial";target.textBaseline="top";
  el.text.split("\n").slice(0,5).forEach((line,i)=>target.fillText(line,el.x,el.y+i*(18+el.width*3)));
 }else if(el.kind==="sticky"){
  target.globalAlpha=1;target.fillStyle="#fff2a8";target.fillRect(el.x,el.y,200,145);
  target.fillStyle=el.color;target.fillRect(el.x,el.y,200,7);
  target.fillStyle="#263043";target.font="15px Verdana,Arial";target.textBaseline="top";
  const lines=[];let line="";for(const word of el.text.split(/\s+/)){const next=line?line+" "+word:word;if(target.measureText(next).width>170&&line){lines.push(line);line=word;}else line=next;}
  if(line)lines.push(line);lines.slice(0,6).forEach((t,i)=>target.fillText(t,el.x+15,el.y+22+i*19));
 }
 target.restore();
}
function filename(ext){const name=safeTitle($("board-title").value).replace(/[^a-z0-9-_ ]/gi,"").replace(/\s+/g,"-")||"whiteboard";return name+"."+ext;}
function saveProject(){
 const snapshot={format:"iliamboard",version:1,title:safeTitle($("board-title").value),paper,items:items.map(e=>({...normalizeElement(e),id:e.id}))};
 download(new Blob([JSON.stringify(snapshot,null,2)],{type:"application/json"}),filename("iliamboard"));
}
async function openProject(file){
 if(!file||file.size>4*1024*1024){alert("Choose a whiteboard file smaller than 4 MB.");return;}
 try{
  const raw=JSON.parse(await file.text());
  if(raw.format!=="iliamboard"||!Array.isArray(raw.items)||raw.items.length>400)throw Error("Invalid .iliamboard file.");
  if(room)throw Error("Leave the shared board before importing a local project.");
  items=raw.items.map(e=>({...normalizeElement(e),id:newId()})).filter(e=>drawKinds.has(e.kind));
  $("board-title").value=safeTitle(raw.title);
  paper=validHex(raw.paper)?raw.paper:"#ffffff";$("paper-color").value=paper;
  history=[];future=[];fit();saveLocalSoon();schedule();
 }catch(e){alert("Unable to open project: "+e.message);}
}
function renderBoardList(area,boards,emptyText){
 area.replaceChildren();
 if(!boards.length){area.textContent=emptyText;area.classList.add("invite-empty");return;}
 area.classList.remove("invite-empty");
 boards.sort((a,b)=>(a.title||"").localeCompare(b.title||""));
 for(const board of boards){
  const button=document.createElement("button");button.type="button";button.className="board-link";
  const title=document.createElement("strong");title.textContent=safeTitle(board.title);
  const meta=document.createElement("small");
  meta.textContent=board.accessMode==="restricted"?"🔒 Restricted":"🔗 Link";
  button.append(title,meta);
  button.onclick=()=>joinRoom(board.id);
  area.append(button);
 }
}
async function refreshBoardLibrary(){
 $("board-library").hidden=!profile;
 if(!user||!profile)return;
 const request=++libraryRequest,uid=user.uid;
 $("owned-boards").textContent="Loading your boards…";
 $("invited-boards").textContent="Loading invitations…";
 try{
  const boards=collection(db,"whiteboards");
  const [mine,shared]=await Promise.all([
   getDocs(query(boards,where("ownerId","==",uid),limit(25))),
   getDocs(query(boards,where("invitedUids","array-contains",uid),limit(25)))
  ]);
  if(request!==libraryRequest||auth.currentUser?.uid!==uid)return;
  renderBoardList($("owned-boards"),mine.docs.map(d=>({id:d.id,...d.data()})),"No shared boards created yet.");
  renderBoardList($("invited-boards"),shared.docs.map(d=>({id:d.id,...d.data()})),"No boards have been shared with your account yet.");
 }catch(e){
  if(request!==libraryRequest)return;
  $("owned-boards").textContent="Could not load boards: "+e.message;
  $("invited-boards").textContent="Publish the latest Firestore rules to enable invited-board lists.";
 }
}
function showRoomModal(on){
 $("room-modal").hidden=!on;updateRoomInfo();
 if(on&&room&&isBoardOwner())loadInviteAccounts();
 if(on&&profile)refreshBoardLibrary();
}
function inviteIdentity(uid){
 const p=inviteAccounts.find(v=>v.uid===uid);
 return {name:p?.nickname||p?.username||"iLiam member",username:p?.username||uid.slice(0,8)+"…"};
}
function inviteRow(uid,role,removable=false){
 const p=inviteIdentity(uid),row=document.createElement("div");row.className="invite-row";
 const identity=document.createElement("span");identity.className="identity";
 const name=document.createElement("strong");name.textContent=p.name;
 const sub=document.createElement("small");sub.textContent="@"+p.username;identity.append(name,sub);
 const action=document.createElement("span");action.className="role";action.textContent=role;
 row.append(identity,action);
 if(removable){
  const button=document.createElement("button");button.type="button";button.textContent="Remove";
  button.disabled=sharingBusy;
  button.onclick=()=>changeInvite(uid,false);
  row.replaceChild(button,action);
 }
 return row;
}
function renderInvites(){
 const list=$("invite-members");list.replaceChildren();
 if(!room)return;
 list.append(inviteRow(room.ownerId,"Owner"));
 for(const uid of invitedUids())list.append(inviteRow(uid,"Can edit",isBoardOwner()));
 if(isBoardOwner())renderInviteSearch();
}
function renderInviteSearch(){
 const area=$("invite-results");area.replaceChildren();
 if(!room||!isBoardOwner())return;
 const queryText=$("invite-search").value.trim().toLowerCase();
 if(!queryText){area.textContent="Search for an iLiam username to invite.";area.className="invite-people invite-empty";return;}
 area.className="invite-people";
 const found=inviteAccounts.filter(p=>p.uid!==room.ownerId
  && !invitedUids().includes(p.uid)
  && (p.username+" "+(p.nickname||"")).toLowerCase().includes(queryText)).slice(0,20);
 for(const p of found){
  const row=inviteRow(p.uid,"");
  const button=document.createElement("button");button.type="button";button.textContent="＋ Invite";
  button.disabled=sharingBusy||invitedUids().length>=20;
  button.onclick=()=>changeInvite(p.uid,true);
  row.lastElementChild.replaceWith(button);area.append(row);
 }
 if(!area.children.length)area.textContent=inviteAccounts.length
  ?"No matching accounts found.":"No accounts loaded. Try opening Share again.";
}
async function loadInviteAccounts(){
 if(!profile||!isBoardOwner())return;
 try{
  const snap=await getDocs(query(collection(db,"profiles"),limit(200)));
  if(!isBoardOwner())return;
  inviteAccounts=snap.docs.map(d=>({uid:d.id,...d.data()}));
  renderInvites();
 }catch(e){roomStatus("Could not load iLiam accounts: "+e.message);}
}
async function changeInvite(uid,add){
 if(!isBoardOwner()||sharingBusy||!user)return;
 if(uid===room.ownerId)return;
 if(add&&invitedUids().length>=20)return roomStatus("Maximum 20 invited accounts.");
 if(add&&accessMode()==="legacy"&&!confirm("This older board currently allows any signed-in iLiam account with its link. Inviting this person will switch the board to Restricted, so other link users will lose access unless invited. Continue?"))return;
 sharingBusy=true;roomStatus((add?"Inviting":"Removing")+" account…");
 try{
  const ref=doc(db,"whiteboards",room.id);
  // Explicitly upgrade legacy rooms to private sharing when an invite is added.
  const patch=add?{invitedUids:arrayUnion(uid)}:{invitedUids:arrayRemove(uid)};
  if(accessMode()==="legacy"){patch.accessMode="restricted";patch.invitedUids=add?[uid]:[];}
  await updateDoc(ref,patch);
  roomStatus(add?"Account invited. They can open and edit this board.":"Account removed.");
  $("invite-search").value="";
 }catch(e){roomStatus("Could not change invitation: "+e.message);}
 finally{sharingBusy=false;renderInvites();}
}
async function changeAccess(mode){
 if(!isBoardOwner()||sharingBusy)return;
 if(!["restricted","link"].includes(mode))return;
 const before=accessMode();
 if(mode==="link"&&before!=="link"&&!confirm("Anyone with this link will be able to view the board. Signed-in iLiam accounts with the link will also be able to edit. Continue?")){
  $("room-access").value=before;return;
 }
 sharingBusy=true;$("room-access").disabled=true;roomStatus("Saving sharing settings…");
 try{
  const patch={accessMode:mode,invitedUids:invitedUids()};
  await updateDoc(doc(db,"whiteboards",room.id),patch);
  roomStatus(mode==="restricted"?"Restricted sharing enabled. Only invited accounts can open.":"Anyone with the link can now view. Signed-in iLiam accounts can edit.");
 }catch(e){roomStatus("Could not change sharing mode: "+e.message);$("room-access").value=before;}
 finally{sharingBusy=false;updateRoomInfo();}
}
function updateRoomInfo(){
 $("auth-note").hidden=Boolean(profile);
 $("room-controls").hidden=false;
 $("create-room").disabled=!profile||Boolean(room);
 $("room-info").hidden=!room;
 $("board-library").hidden=!profile;
 $("leave-room").disabled=!room;
 if(!room){
  $("board-mode").textContent="● Local board";renderBoardPermissions();return;
 }
 $("current-code").textContent=room.id;
 const mode=accessMode();
 const owner=isBoardOwner(),canEdit=canEditBoard();
 $("board-mode").textContent=(canEdit?"🟢":"🔎")+" Shared "+(canEdit?"":"(view only) · ")+room.id.slice(0,7)+"…";
 $("room-access").value=mode;
 $("room-access").disabled=!owner||sharingBusy;
 $("invite-controls").hidden=!owner;
 $("room-access-detail").textContent=mode==="restricted"
  ?"Restricted: only the owner and invited iLiam accounts can open or edit this whiteboard."
  :mode==="link"
   ?"Anyone with the link can view, even without an account. Signed-in iLiam accounts with the link can edit."
   :"Existing link sharing: anyone signed in to iLiam with this code can open and edit. The owner can change this setting.";
 $("share-description").textContent=mode==="restricted"
  ?"This link works only for the people you invite below."
  :"Anyone with this link can open the board under its sharing permissions.";
 renderInvites();renderBoardPermissions();
}
function stopShared(){
 if(stopItems){stopItems();stopItems=null;}
 if(stopRoom){stopRoom();stopRoom=null;}
 room=null;history=[];future=[];
 items=localDraft.items.map(e=>({...e}));
 $("board-title").value=localDraft.title;paper=localDraft.paper;$("paper-color").value=paper;
 updateRoomInfo();schedule();status("Saved locally");
}
async function joinRoom(raw){
 if(busy)return;
 let code=String(raw||"").trim();
 if(code.startsWith("http")){
  try{code=new URL(code).searchParams.get("board")||"";}catch{code="";}
 }
 if(!/^[0-9a-f]{32}$/.test(code)){showRoomModal(true);roomStatus("Enter a valid 32-character room code or invitation URL.");return;}
 busy=true;roomStatus("Joining board…");
 try{
  const snap=await getDoc(doc(db,"whiteboards",code));
  if(!snap.exists())throw Error("This board does not exist.");
  if(room?.id===code){showRoomModal(false);return;}
  stopShared();
  room={id:code,...snap.data()};
  items=[];history=[];future=[];
  $("board-title").value=safeTitle(room.title);paper=validHex(room.paperColor)?room.paperColor:"#ffffff";$("paper-color").value=paper;
  stopItems=onSnapshot(query(collection(db,"whiteboards",code,"elements"),orderBy("createdAt","asc")),snap=>{
   items=snap.docs.map(d=>({...normalizeElement(d.data()),id:d.id})).filter(e=>drawKinds.has(e.kind)).slice(-500);
   status(canEditBoard()?"Synced · "+items.length+" objects":"View only · "+items.length+" objects");schedule();
  },e=>{
   status("Whiteboard access was lost: "+e.message);
   if(room?.id===code){stopShared();showRoomModal(true);roomStatus("You no longer have access to that whiteboard.");}
  });
  stopRoom=onSnapshot(doc(db,"whiteboards",code),snap=>{
   if(!snap.exists()){stopShared();showRoomModal(true);roomStatus("This board is no longer accessible.");return;}
   room={id:code,...snap.data()};
   if(!canViewBoard()){
    stopShared();showRoomModal(true);roomStatus("This board is restricted to invited accounts.");
    return;
   }
   $("board-title").value=safeTitle(room.title);
   paper=validHex(room.paperColor)?room.paperColor:"#ffffff";$("paper-color").value=paper;
   updateRoomInfo();schedule();
  },e=>{
   console.warn("Board access:",e);
   if(room?.id===code){stopShared();showRoomModal(true);roomStatus("Access denied. This board may be restricted to invited accounts.");}
  });
  updateRoomInfo();showRoomModal(false);
  status(canEditBoard()?"Live collaboration":"View only — sign in to edit");
  const url=new URL(location.href);url.searchParams.set("board",code);window.history.replaceState(null,"",url);
 }catch(e){roomStatus(e?.code==="permission-denied"?"This board may be private. Sign in with an invited iLiam account, or ask the owner to share it. If this is a new feature, publish the latest Firestore rules.":"Could not open board: "+e.message);showRoomModal(true);}
 finally{busy=false;}
}
async function createRoom(){
 if(!user||!profile){showRoomModal(true);roomStatus("Sign in to iLiam Community before sharing.");return;}
 if(busy)return;
 busy=true;roomStatus("Creating board…");
 if(!room)await writeLocal(); // Save personal board before leaving for a shared room.
 const source=items.map(e=>({...e}));
 const code=newId();
 try{
  await setDoc(doc(db,"whiteboards",code),{ownerId:user.uid,title:safeTitle($("board-title").value),paperColor:paper,accessMode:"restricted",invitedUids:[],createdAt:serverTimestamp()});
  if(source.length){
   const batch=writeBatch(db);
   for(const e of source.slice(-400))
    batch.set(doc(db,"whiteboards",code,"elements",newId()),{...normalizeElement(e),createdBy:user.uid,createdAt:serverTimestamp()});
   await batch.commit();
  }
  busy=false;
  await joinRoom(code);
  if(room?.id===code){
   refreshBoardLibrary();
   roomStatus("Board created with Restricted access. Invite friends or select Anyone with the link.");
  }
 }catch(e){roomStatus("Could not create board: "+e.message+". Check Firebase rules.");}
 finally{busy=false;}
}
async function updateRoomMeta(patch){
 if(!room)return;
 if(room.ownerId!==user?.uid){status("Only the creator can change the shared board name or paper color.");return;}
 try{await updateDoc(doc(db,"whiteboards",room.id),patch);status("Room updated");}
 catch(e){status("Unable to update room: "+e.message);}
}
async function clearAll(){
 if(!items.length)return;
 if(room&&!canEditBoard())return alert("You have view-only access.");
 if(room&&room.ownerId!==user?.uid){alert("Only the shared board creator can clear every item.");return;}
 if(!confirm(room?"Clear the shared whiteboard for everyone?":"Clear everything from your whiteboard?"))return;
 const old=[...items];items=[];historyPush({kind:"clear",items:old});
 if(room)await publish({kind:"clear",items:old});else saveLocalSoon();
}
function setupUI(){
 initLocal();document.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
 document.querySelectorAll(".swatch").forEach(b=>b.onclick=()=>{
  color=b.dataset.color;$("ink-color").value=color;updateSwatches();
 });
 $("ink-color").oninput=e=>{color=e.target.value;updateSwatches();};
 function onSize(){width=Number($("brush-size").value);$("size-label").textContent=width+" px";}
 $("brush-size").oninput=onSize;onSize();updateSwatches();
 $("show-grid").onchange=e=>{grid=e.target.checked;schedule();};
 $("paper-color").oninput=e=>{
  paper=e.target.value;schedule();
  if(room)updateRoomMeta({paperColor:paper});else saveLocalSoon();
 };
 $("board-title").onchange=e=>{
  e.target.value=safeTitle(e.target.value);
  if(room)updateRoomMeta({title:e.target.value});else saveLocalSoon();
 };
 $("undo").onclick=undo;$("redo").onclick=redo;
 $("zoom-in").onclick=()=>zoom(1.25,wrap.getBoundingClientRect().left+wrap.clientWidth/2,wrap.getBoundingClientRect().top+wrap.clientHeight/2);
 $("zoom-out").onclick=()=>zoom(.8,wrap.getBoundingClientRect().left+wrap.clientWidth/2,wrap.getBoundingClientRect().top+wrap.clientHeight/2);
 $("zoom-fit").onclick=fit;
 canvas.addEventListener("pointerdown",onDown);
 canvas.addEventListener("pointermove",onMove);
 canvas.addEventListener("pointerup",onUp);
 canvas.addEventListener("pointercancel",()=>{active=null;preview=null;schedule();});
 canvas.addEventListener("wheel",e=>{e.preventDefault();zoom(e.deltaY>0?.92:1.08,e.clientX,e.clientY);},{passive:false});
 window.addEventListener("keydown",e=>{
  if(["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)||!$("room-modal").hidden)return;
  if(e.code==="Space"&&!e.repeat){spaceDown=true;e.preventDefault();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo();return;}
  const hotkeys={p:"pen",h:"highlighter",e:"eraser",l:"line",a:"arrow",r:"rect",c:"ellipse",t:"text",n:"sticky"};
  if(hotkeys[e.key.toLowerCase()]&&!e.ctrlKey&&!e.altKey)setTool(hotkeys[e.key.toLowerCase()]);
 });
 window.addEventListener("keyup",e=>{if(e.code==="Space")spaceDown=false;});
 window.addEventListener("blur",()=>spaceDown=false);
 $("export-png").onclick=exportPNG;
 $("export-svg").onclick=()=>{download(new Blob([toSvg()],{type:"image/svg+xml"}),filename("svg"));hideFileMenu();};
 $("download-project").onclick=()=>{saveProject();hideFileMenu();};
 $("upload-project").onclick=()=>{$("project-file").click();hideFileMenu();};
 $("project-file").onchange=e=>{openProject(e.target.files?.[0]);e.target.value="";};
 $("clear-board").onclick=()=>{clearAll();hideFileMenu();};
 $("new-board").onclick=()=>{
  if(room)return alert("Leave the shared room to create a new local board.");
  if(items.length&&!confirm("Start a new local board? Export first if you want to keep this one."))return;
  items=[];history=[];future=[];paper="#ffffff";$("paper-color").value=paper;$("board-title").value="Untitled Whiteboard";fit();saveLocalSoon();schedule();
 };
 $("more-actions").onclick=()=>{const panel=$("file-menu");panel.hidden=!panel.hidden;$("more-actions").setAttribute("aria-expanded",String(!panel.hidden));};
 document.addEventListener("pointerdown",e=>{if(!$("file-menu").hidden&&!e.target.closest(".top-actions"))hideFileMenu();});
 $("open-rooms").onclick=()=>{showRoomModal(true);roomStatus(room?"You are connected to a shared board.":"Create a board or paste a friend's invite code.");};
 $("room-close").onclick=()=>showRoomModal(false);
 $("room-modal").onclick=e=>{if(e.target===$("room-modal"))showRoomModal(false);};
 $("create-room").onclick=createRoom;
 $("room-access").onchange=e=>changeAccess(e.target.value);
 $("refresh-boards").onclick=refreshBoardLibrary;
 $("invite-search").oninput=renderInviteSearch;
 $("join-room").onclick=()=>joinRoom($("room-code").value);
 $("room-code").onkeydown=e=>{if(e.key==="Enter")joinRoom(e.target.value);};
 $("leave-room").onclick=()=>{
  if(!room)return;stopShared();
  const url=new URL(location.href);url.searchParams.delete("board");window.history.replaceState(null,"",url);
  roomStatus("Left the shared board. Your local board has been restored.");
 };
 $("copy-code").onclick=()=>copy(room?.id||"");
 $("copy-link").onclick=()=>{if(!room)return;const url=new URL(location.href);url.searchParams.set("board",room.id);copy(url.href);};
 const ro=new ResizeObserver(schedule);ro.observe(wrap);
 schedule();
}
function hideFileMenu(){$("file-menu").hidden=true;$("more-actions").setAttribute("aria-expanded","false");}
function updateSwatches(){document.querySelectorAll(".swatch").forEach(b=>b.classList.toggle("active",b.dataset.color===color));}
async function copy(value){
 if(!value)return;
 try{await navigator.clipboard.writeText(value);roomStatus("Copied to clipboard.");}
 catch{prompt("Copy this:",value);}
}
setupUI();
onAuthStateChanged(auth,async u=>{
 if(user?.uid!==u?.uid){
  clearTimeout(saveTimer);
  if(!room)initLocal();
 }
 user=u;profile=null;
 if(u)try{
  const snap=await getDoc(doc(db,"profiles",u.uid));
  if(auth.currentUser?.uid!==u.uid)return;
  if(snap.exists())profile=snap.data();
 }catch(e){console.warn("Whiteboard profile:",e);}
 if(!room)await restoreAccountDraft();
 if(room&&!canViewBoard()){
  stopShared();showRoomModal(true);
  roomStatus("This restricted board requires an invited iLiam account.");
 }else if(room){updateRoomInfo();schedule();}
 else updateRoomInfo();
 const code=new URL(location.href).searchParams.get("board");
 if(code&&!room)joinRoom(code);
});
