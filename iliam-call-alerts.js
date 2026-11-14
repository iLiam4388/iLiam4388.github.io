// iLiam call alerts while the website is open. Background push requires a server.
let ctx=null,timer=null;
const visible=new Map();
function unlock(){
 try{ctx ||= new (window.AudioContext||window.webkitAudioContext)();ctx.resume().catch(()=>{});}catch{}
}
window.addEventListener("pointerdown",unlock,{once:true,capture:true});
window.addEventListener("keydown",unlock,{once:true,capture:true});
function ring(){
 if(!visible.size||!ctx||ctx.state!=="running")return;
 const t=ctx.currentTime;
 for(const [offset,freq] of [[0,520],[0.25,660]]){
  const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=freq;
  g.gain.setValueAtTime(0.0001,t+offset);
  g.gain.exponentialRampToValueAtTime(0.06,t+offset+0.035);
  g.gain.exponentialRampToValueAtTime(0.0001,t+offset+0.21);
  o.connect(g);g.connect(ctx.destination);o.start(t+offset);o.stop(t+offset+0.22);
 }
}
function startRing(){
 if(visible.size&&!timer){unlock();ring();timer=setInterval(ring,1800);}
 if(!visible.size&&timer){clearInterval(timer);timer=null;}
}
function style(){
 if(document.getElementById("iliam-call-alert-css"))return;
 const e=document.createElement("style");e.id="iliam-call-alert-css";
 e.textContent=".iliam-call-banner{position:fixed;z-index:2147483000;top:12px;right:12px;width:min(380px,calc(100vw - 24px));padding:17px;color:#fff;background:#071b32;border:2px solid cyan;border-radius:16px;box-shadow:0 8px 30px #000b;font:14px Verdana,Arial,sans-serif;text-align:left}.iliam-call-banner strong{display:block;font-size:18px}.iliam-call-banner p{line-height:1.4}.iliam-call-banner div{display:flex;gap:9px}.iliam-call-banner button{color:white;padding:10px 15px;border-radius:9px;border:1px solid #79d8ef;font:bold 14px Verdana,Arial;cursor:pointer}.iliam-call-yes{background:#138454}.iliam-call-no{background:#ac2948}";
 document.head.append(e);
}
export function openCallPage(kind,id,action="accept"){
 const url=new URL("./community.html",location.href);
 url.searchParams.set("incomingKind",kind);
 url.searchParams.set("incomingId",id);
 url.searchParams.set("incomingAction",action);
 const tab=window.open(url.href,"_blank");if(!tab)location.href=url.href;
}
async function notify(kind,id,title,body){
 if(!("Notification" in window)||Notification.permission!=="granted"||!document.hidden)return;
 if("serviceWorker" in navigator){
  try{
   const r=await navigator.serviceWorker.register("./iliam-call-sw.js");
   await r.showNotification(title,{body,icon:"./images/favicon.png",tag:"iliam-call-"+kind+"-"+id,renotify:false,data:{kind,id},actions:[{action:"accept",title:"Accept"},{action:"decline",title:"Decline"}]});
   return;
  }catch(e){console.warn("Call actions unavailable:",e);}
 }
 try{const n=new Notification(title,{body,tag:"iliam-call-"+kind+"-"+id});n.onclick=()=>{openCallPage(kind,id);n.close();};}catch{}
}
export function showIncomingCall({kind,id,name,type,accept,decline}){
 if(!id)return;const key=kind+":"+id;if(visible.has(key))return;
 style();
 const title=type==="video"?"📹 Incoming video call":"📞 Incoming audio call";
 const p=document.createElement("section");p.className="iliam-call-banner";
 const h=document.createElement("strong");h.textContent=title;
 const description=document.createElement("p");description.textContent=(name||"Someone")+" is calling you.";
 const row=document.createElement("div");
 const yes=document.createElement("button");yes.className="iliam-call-yes";yes.textContent="✓ Accept";
 const no=document.createElement("button");no.className="iliam-call-no";no.textContent="✕ Decline";
 yes.onclick=()=>{dismissIncomingCall(kind,id);accept?accept():openCallPage(kind,id);};
 no.onclick=()=>{dismissIncomingCall(kind,id);decline?.();};
 row.append(yes,no);p.append(h,description,row);document.body.append(p);
 visible.set(key,p);startRing();notify(kind,id,title,description.textContent);
}
export function dismissIncomingCall(kind,id){
 const key=kind+":"+id;visible.get(key)?.remove();visible.delete(key);startRing();
 if("serviceWorker" in navigator)navigator.serviceWorker.ready.then(r=>r.getNotifications({tag:"iliam-call-"+kind+"-"+id}).then(ns=>ns.forEach(n=>n.close()))).catch(()=>{});
}
export function dismissAllCalls(){
 for(const key of [...visible.keys()]){const [kind,...rest]=key.split(":");dismissIncomingCall(kind,rest.join(":"));}
}
