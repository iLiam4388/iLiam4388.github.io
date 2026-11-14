// Browser notification actions while a page registered this worker.
// This does not receive incoming calls when no iLiam page is open; FCM push
// and a trusted backend would be needed for that.
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const data=event.notification.data||{};
 if(!["group","legacy"].includes(data.kind)||typeof data.id!=="string")return;
 const url=new URL("./community.html",self.registration.scope);
 url.searchParams.set("incomingKind",data.kind);
 url.searchParams.set("incomingId",data.id);
 url.searchParams.set("incomingAction",event.action==="decline"?"decline":"accept");
 event.waitUntil((async()=>{
  const clientsList=await clients.matchAll({type:"window",includeUncontrolled:true});
  const target=clientsList.find(c=>new URL(c.url).pathname===url.pathname);
  if(target){await target.focus();target.postMessage({type:"iliam-call-action",kind:data.kind,id:data.id,action:event.action==="decline"?"decline":"accept"});}
  else await clients.openWindow(url.href);
 })());
});
self.addEventListener("notificationclose",()=>{});
