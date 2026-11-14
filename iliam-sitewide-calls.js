// Incoming calls on non-Community iLiam pages while those pages remain open.
// No server-side Firebase Cloud Messaging push is configured.
import {initializeApp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {getFirestore,collection,doc,getDoc,onSnapshot,query,where,limit,updateDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";
import {showIncomingCall,dismissIncomingCall,dismissAllCalls,openCallPage} from "./iliam-call-alerts.js";
if(!location.pathname.endsWith("/community.html")){
 const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
 let stops=[],uid=null,dnd=false,blocks=new Set(),shown=new Set(),groupMembers=new Map();
 const ms=t=>t?.toMillis?.()||0;
 function clear(){
  stops.forEach(f=>f());stops=[];
  for(const f of groupMembers.values())f();groupMembers.clear();
  dismissAllCalls();shown.clear();
 }
 function valid(t){return t&&Date.now()-ms(t)<120000&&Date.now()-ms(t)>-10000;}
 async function declineGroup(id){
  if(!uid)return;
  try{await updateDoc(doc(db,"groupCalls",id,"members",uid),{status:"declined",updatedAt:serverTimestamp()});}
  catch(e){console.warn("Group decline:",e);}
 }
 async function declineLegacy(id){
  try{await updateDoc(doc(db,"calls",id),{status:"declined"});}
  catch(e){console.warn("Decline:",e);}
 }
 function show(kind,id,name,type,decline){
  const key=kind+":"+id;
  if(shown.has(key))return;
  shown.add(key);
  showIncomingCall({kind,id,name,type,accept:()=>openCallPage(kind,id),decline});
 }
 function dismiss(kind,id){shown.delete(kind+":"+id);dismissIncomingCall(kind,id);}
 onAuthStateChanged(auth,async user=>{
  clear();uid=user?.uid||null;if(!uid)return;
  try{
   const p=await getDoc(doc(db,"profiles",uid));
   if(!p.exists()||auth.currentUser?.uid!==uid)return;
   stops.push(onSnapshot(doc(db,"callSettings",uid),s=>{
    dnd=s.exists()&&s.data().doNotDisturb===true;
    if(dnd){dismissAllCalls();shown.clear();}
   },e=>console.warn("Call settings:",e)));
   stops.push(onSnapshot(collection(db,"callBlocks",uid,"users"),s=>{
    blocks=new Set(s.docs.map(d=>d.id));
   },e=>console.warn("Blocked callers:",e)));
   stops.push(onSnapshot(query(collection(db,"calls"),where("calleeId","==",uid),limit(40)),s=>{
    const alive=new Set();
    for(const d of s.docs){
     const c=d.data();if(c.status!=="ringing"||!valid(c.createdAt)||dnd||blocks.has(c.callerId))continue;
     alive.add(d.id);
     show("legacy",d.id,c.callerName,c.type,()=>declineLegacy(d.id));
    }
    for(const key of [...shown])if(key.startsWith("legacy:")&&!alive.has(key.slice(7)))dismiss("legacy",key.slice(7));
   },e=>console.warn("Incoming calls:",e)));
   stops.push(onSnapshot(query(collection(db,"groupCalls"),where("participants","array-contains",uid),limit(25)),s=>{
    const active=new Set();
    for(const d of s.docs){
     const c=d.data();if(c.status!=="open"||!valid(c.createdAt))continue;
     active.add(d.id);
     if(groupMembers.has(d.id))continue;
     groupMembers.set(d.id,onSnapshot(doc(db,"groupCalls",d.id,"members",uid),m=>{
      const eligible=m.exists()&&m.data().status==="ringing"&&!dnd&&!blocks.has(c.hostId);
      if(eligible)show("group",d.id,c.hostName,c.type,()=>declineGroup(d.id));
      else dismiss("group",d.id);
     },e=>console.warn("Group invitation:",e)));
    }
    for(const [id,unsubscribe] of groupMembers)if(!active.has(id)){
     unsubscribe();groupMembers.delete(id);dismiss("group",id);
    }
   },e=>console.warn("Group calls:",e)));
  }catch(e){console.warn("Call watcher:",e);}
 });
}
