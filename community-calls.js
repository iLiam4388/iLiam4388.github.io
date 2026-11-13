import {initializeApp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {getFirestore,collection,doc,getDoc,getDocs,setDoc,addDoc,updateDoc,query,where,limit,onSnapshot,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

// iLiam Community voice/video calling. Firestore carries signaling only, not media.
const launch=document.getElementById("iliam-call-button");
if(launch){
 const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
 const ui=document.createElement("div");ui.id="iliam-call-ui";
 ui.innerHTML=[
  '<section class="call-backdrop" id="call-picker" hidden><div class="call-panel" role="dialog" aria-modal="true" aria-label="Call someone">',
  '<div class="call-row"><h2 class="call-title">Call someone</h2><button class="call-btn" id="call-close">✕ Close</button></div>',
  '<p class="call-subtitle">Choose an iLiam user. They must have Community open to receive your call.</p>',
  '<input id="call-search" class="call-input" type="search" placeholder="Search usernames or nicknames" aria-label="Search accounts">',
  '<div class="call-user-list" id="call-users"></div><div class="call-actions">',
  '<button class="call-btn primary" id="call-video" disabled>📹 Video call</button><button class="call-btn primary" id="call-audio" disabled>📞 Audio call</button></div>',
  '<p class="call-status" id="call-picker-status" role="status"></p></div></section>',
  '<section class="call-incoming" id="call-incoming" hidden><h2 class="call-title" id="call-incoming-heading">Incoming call</h2>',
  '<p id="call-incoming-name"></p><div class="call-actions"><button class="call-btn primary" id="call-accept">Accept</button>',
  '<button class="call-btn danger" id="call-decline">Decline</button></div><p class="call-status" id="call-incoming-error"></p></section>',
  '<section class="call-backdrop" id="call-active" hidden><div class="call-screen" role="dialog" aria-modal="true" aria-label="iLiam Call">',
  '<div class="call-row"><h2 class="call-title" id="call-peer">iLiam Call</h2><span id="call-type"></span></div>',
  '<p class="call-status" id="call-status" role="status">Connecting…</p>',
  '<div class="call-videos" id="call-videos"><video id="call-remote" autoplay playsinline></video>',
  '<video class="local" id="call-local" autoplay playsinline muted></video></div>',
  '<div class="call-voice" id="call-voice" hidden><span>📞</span><span style="font-size:17px">Voice call</span></div>',
  '<div class="call-actions call-center"><button class="call-btn" id="call-mute">🎙 Mute</button>',
  '<button class="call-btn" id="call-camera">📷 Camera off</button>',
  '<button class="call-btn" id="call-play">🔊 Play sound</button>',
  '<button class="call-btn danger" id="call-end">☎ End call</button></div></div></section>'
 ].join("");
 document.body.append(ui);
 const $=id=>ui.querySelector("#"+id);
 let me=null,profile=null,people=[],chosen=null,incoming=null,session=null;
 let stopInbox=null,stopCall=null,stopCandidates=null,working=false;
 launch.disabled=true;
 const visible=(id,on)=>{$(id).hidden=!on};
 const status=s=>$("call-status").textContent=s;
 const pickerStatus=s=>$("call-picker-status").textContent=s;
 const name=p=>p?.nickname||p?.username||"iLiam user";
 const when=t=>t?.toMillis?.()||0;
 function captureError(err,type){
  const kind=type==="video"?"camera and microphone":"microphone";
  const errorName=String(err?.name||"");
  const message=String(err?.message||"");
  if(["NotAllowedError","PermissionDeniedError","SecurityError"].includes(errorName)||/permission denied|permission blocked|not allowed/i.test(message))
   return "Access to your "+kind+" was blocked. In Opera, click the site permissions icon next to the address and allow Microphone"+(type==="video"?" and Camera":"")+". In Windows Settings → Privacy & security → "+(type==="video"?"Camera and Microphone":"Microphone")+", enable access for desktop apps, then retry.";
  if(errorName==="NotFoundError"||errorName==="DevicesNotFoundError")
   return "No usable "+kind+" was found. Connect a device and check Windows sound/camera settings.";
  if(errorName==="NotReadableError"||errorName==="TrackStartError")
   return "Your "+kind+" is unavailable or in use. Close other apps using it and try again.";
  return err?.message||"Unable to access microphone/camera.";
 }
 function safeAvatar(p){
  try{const u=new URL(p.photoURL);if(["http:","https:"].includes(u.protocol))return u.href;}catch{}
  const letter=name(p).slice(0,1).toUpperCase().replace(/[<&>"]/g,"")||"U";
  return "data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#265075"/><text x="40" y="54" fill="white" text-anchor="middle" font-family="Arial" font-size="35">'+letter+'</text></svg>');
 }
 function drawPeople(){
  const q=$("call-search").value.toLowerCase().trim(),area=$("call-users");
  area.replaceChildren();
  for(const p of people.filter(x=>(name(x)+" "+x.username).toLowerCase().includes(q)).slice(0,100)){
   const row=document.createElement("button");row.type="button";row.className="call-user";
   row.setAttribute("aria-selected",String(chosen?.uid===p.uid));
   const img=document.createElement("img");img.className="call-avatar";img.alt="";img.referrerPolicy="no-referrer";
   img.src=safeAvatar(p);img.onerror=()=>{img.onerror=null;img.src=safeAvatar({nickname:p.nickname});};
   const label=document.createElement("div");label.className="call-name";label.textContent=name(p)+"  @"+p.username;
   row.append(img,label);row.onclick=()=>{chosen=p;$("call-video").disabled=false;$("call-audio").disabled=false;drawPeople();};
   area.append(row);
  }
  if(!area.children.length)area.textContent="No matching accounts found.";
 }
 async function openPicker(){
  if(!me||!profile)return alert("Sign in with your iLiam Community account first.");
  if(session)return;
  chosen=null;$("call-search").value="";$("call-video").disabled=true;$("call-audio").disabled=true;
  visible("call-picker",true);pickerStatus("Loading iLiam accounts…");
  try{
   const snap=await getDocs(query(collection(db,"profiles"),limit(200)));
   if(!me)return;
   people=snap.docs.filter(d=>d.id!==me.uid).map(d=>({uid:d.id,...d.data()}))
    .sort((a,b)=>name(a).localeCompare(name(b)));
   drawPeople();pickerStatus("Choose a user, then select Audio or Video.");
  }catch(e){pickerStatus("Could not load accounts: "+e.message);}
 }
 launch.onclick=openPicker;$("call-close").onclick=()=>visible("call-picker",false);
 $("call-search").oninput=drawPeople;
 function cleanup(){
  if(stopCall){stopCall();stopCall=null;}
  if(stopCandidates){stopCandidates();stopCandidates=null;}
  const old=session;session=null;
  if(old){
   old.stream?.getTracks().forEach(t=>t.stop());
   old.pc?.close();
  }
  $("call-local").srcObject=null;$("call-remote").srcObject=null;
  visible("call-active",false);
  working=false;
 }
 async function endCall(value="ended"){
  const old=session;cleanup();
  if(old?.ref)try{await updateDoc(old.ref,{status:value});}catch(e){console.warn("Call status:",e);}
 }
 $("call-end").onclick=()=>endCall();
 $("call-mute").onclick=()=>{
  const t=session?.stream?.getAudioTracks()[0];if(!t)return;
  t.enabled=!t.enabled;$("call-mute").textContent=t.enabled?"🎙 Mute":"🔇 Unmute";
 };
 $("call-camera").onclick=()=>{
  const t=session?.stream?.getVideoTracks()[0];if(!t)return;
  t.enabled=!t.enabled;$("call-camera").textContent=t.enabled?"📷 Camera off":"📷 Camera on";
 };
 $("call-play").onclick=()=>$("call-remote").play().catch(e=>status("Audio playback failed: "+e.message));
 function showCall(s,peer){
  $("call-peer").textContent=peer;$("call-type").textContent=s.type==="video"?"📹 Video":"📞 Audio";
  visible("call-videos",s.type==="video");visible("call-voice",s.type==="audio");
  visible("call-camera",s.type==="video");visible("call-picker",false);visible("call-incoming",false);
  visible("call-active",true);
  $("call-mute").textContent="🎙 Mute";$("call-camera").textContent="📷 Camera off";
  status("Connecting…");
 }
 async function capture(type){
  if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==="undefined")
   throw Error("This browser cannot make WebRTC calls.");
  const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:type==="video"});
  let pc;
  try{
   pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]});
   for(const track of stream.getTracks())pc.addTrack(track,stream);
  }catch(e){stream.getTracks().forEach(t=>t.stop());throw e;}
  const remote=new MediaStream();
  pc.ontrack=e=>{
   const tracks=e.streams[0]?.getTracks()||[e.track];
   for(const t of tracks)if(!remote.getTracks().some(k=>k.id===t.id))remote.addTrack(t);
   $("call-remote").srcObject=remote;
   $("call-remote").play().catch(()=>status("Connected. Tap Play sound to hear the other person."));
  };
  pc.onconnectionstatechange=()=>{
   if(session?.pc!==pc)return;
   if(pc.connectionState==="connected")status("Connected");
   else if(pc.connectionState==="failed")status("Connection failed; this network may require a TURN server.");
   else if(pc.connectionState==="disconnected")status("Connection interrupted…");
  };
  $("call-local").srcObject=stream;$("call-remote").srcObject=remote;
  return {pc,stream,type};
 }
 function setupCandidates(s,remoteSide){
  const queue=[];
  async function flush(){
   if(!s.pc.remoteDescription)return;
   while(queue.length){
    try{await s.pc.addIceCandidate(queue.shift());}
    catch(e){console.warn("ICE candidate error:",e);}
   }
  }
  stopCandidates=onSnapshot(collection(s.ref,remoteSide+"Candidates"),snap=>{
   for(const event of snap.docChanges())if(event.type==="added"){
    const d=event.doc.data();
    queue.push({candidate:d.candidate,sdpMid:d.sdpMid,sdpMLineIndex:d.sdpMLineIndex});
   }
   flush();
  },e=>status("ICE signaling unavailable: "+e.message));
  return flush;
 }
 function watchCall(s,caller,flush){
  stopCall=onSnapshot(s.ref,async snap=>{
   if(session!==s)return;
   if(!snap.exists()){cleanup();return;}
   const data=snap.data();
   if(data.status==="ended"||data.status==="declined"){
    cleanup();alert(data.status==="declined"?"Call declined.":"Call ended.");return;
   }
   if(caller&&data.answer&&!s.answerApplied){
    s.answerApplied=true;
    try{await s.pc.setRemoteDescription(data.answer);await flush();status("Connecting…");}
    catch(e){status("Answer error: "+e.message);}
   }
  },e=>status("Call status unavailable: "+e.message));
 }
 async function call(type){
  if(working||session||!chosen||!me||!profile)return;
  working=true;const friend=chosen;
  pickerStatus("Requesting microphone/camera permission…");
  let media;
  try{
   media=await capture(type);
   const ref=doc(collection(db,"calls"));
   const s={...media,ref,answerApplied:false};session=s;showCall(s,"Calling "+name(friend)+"…");
   const queue=[];let published=false;
   media.pc.onicecandidate=e=>{
    if(!e.candidate||session!==s)return;
    const data=e.candidate.toJSON();
    if(!published)queue.push(data);
    else addDoc(collection(ref,"callerCandidates"),{...data,uid:me.uid}).catch(console.warn);
   };
   const offer=await media.pc.createOffer();await media.pc.setLocalDescription(offer);
   await setDoc(ref,{callerId:me.uid,calleeId:friend.uid,callerName:name(profile),
    type,status:"ringing",offer:{type:offer.type,sdp:offer.sdp},createdAt:serverTimestamp()});
   published=true;
   for(const ice of queue)await addDoc(collection(ref,"callerCandidates"),{...ice,uid:me.uid});
   const flush=setupCandidates(s,"callee");watchCall(s,true,flush);
   status("Ringing "+name(friend)+"…");
  }catch(e){if(media&&!session){media.stream.getTracks().forEach(t=>t.stop());media.pc.close();}
   cleanup();visible("call-picker",true);pickerStatus("Could not start: "+captureError(e,type));
  }finally{working=false;}
 }
 $("call-video").onclick=()=>call("video");$("call-audio").onclick=()=>call("audio");
 function displayIncoming(){
  if(!incoming||session){visible("call-incoming",false);return;}
  $("call-incoming-heading").textContent=incoming.type==="video"?"📹 Incoming video call":"📞 Incoming audio call";
  $("call-incoming-name").textContent=(incoming.callerName||"Someone")+" is calling you.";
  $("call-incoming-error").textContent="";
  visible("call-incoming",true);
 }
 $("call-decline").onclick=async()=>{
  if(!incoming)return;
  const ref=doc(db,"calls",incoming.id);
  incoming=null;visible("call-incoming",false);
  try{await updateDoc(ref,{status:"declined"});}catch(e){console.warn(e);}
 };
 $("call-accept").onclick=async()=>{
  if(!incoming||working||session)return;
  working=true;$("call-accept").disabled=true;
  const invite=incoming;let media;
  $("call-incoming-error").textContent="Requesting microphone/camera permission…";
  try{
   const ref=doc(db,"calls",invite.id),snap=await getDoc(ref);
   if(!snap.exists()||snap.data().status!=="ringing")throw Error("Call is no longer available.");
   media=await capture(invite.type);
   const s={...media,ref};session=s;incoming=null;showCall(s,invite.callerName||"iLiam Call");
   const queue=[];let published=false;
   media.pc.onicecandidate=e=>{
    if(!e.candidate||session!==s)return;
    const data=e.candidate.toJSON();
    if(!published)queue.push(data);
    else addDoc(collection(ref,"calleeCandidates"),{...data,uid:me.uid}).catch(console.warn);
   };
   await media.pc.setRemoteDescription(invite.offer);
   const flush=setupCandidates(s,"caller");
   const answer=await media.pc.createAnswer();await media.pc.setLocalDescription(answer);
   await updateDoc(ref,{status:"accepted",answer:{type:answer.type,sdp:answer.sdp}});
   published=true;
   for(const ice of queue)await addDoc(collection(ref,"calleeCandidates"),{...ice,uid:me.uid});
   await flush();watchCall(s,false,flush);status("Connecting…");
  }catch(e){
   if(media&&!session){media.stream.getTracks().forEach(t=>t.stop());media.pc.close();}
   cleanup();visible("call-incoming",true);$("call-incoming-error").textContent="Could not answer: "+captureError(e,invite.type);
  }finally{$("call-accept").disabled=false;working=false;}
 };
 function subscribeInbox(uid){
  if(stopInbox)stopInbox();
  stopInbox=onSnapshot(query(collection(db,"calls"),where("calleeId","==",uid),limit(40)),snap=>{
   const now=Date.now();
   const list=snap.docs.map(d=>({id:d.id,...d.data()}))
    .filter(d=>d.status==="ringing"&&now-when(d.createdAt)<120000)
    .sort((a,b)=>when(b.createdAt)-when(a.createdAt));
   incoming=list[0]||null;displayIncoming();
  },e=>console.warn("Incoming calls unavailable:",e));
 }
 onAuthStateChanged(auth,async user=>{
  if(stopInbox){stopInbox();stopInbox=null;}
  me=user;profile=null;launch.disabled=true;
  if(!user){incoming=null;visible("call-incoming",false);if(session)cleanup();return;}
  try{
   const snap=await getDoc(doc(db,"profiles",user.uid));
   if(auth.currentUser?.uid!==user.uid)return;
   if(snap.exists()){profile=snap.data();launch.disabled=false;subscribeInbox(user.uid);}
  }catch(e){console.warn("Call sign-in:",e);}
 });
 window.addEventListener("pagehide",()=>{
  session?.stream?.getTracks().forEach(t=>t.stop());session?.pc?.close();
 });
}
