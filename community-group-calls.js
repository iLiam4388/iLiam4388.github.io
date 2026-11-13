import {initializeApp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {getFirestore,doc,collection,getDoc,getDocs,setDoc,addDoc,updateDoc,onSnapshot,query,where,limit,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

// Temporary 2–4-person WebRTC mesh calls. No saved groups and no video recording.
// A group needs separate pairwise connections for every accepted participant.
const launch=document.getElementById("iliam-group-button");
if(launch){
 const app=initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);
 const ui=document.createElement("div");ui.id="iliam-group-ui";
 ui.innerHTML=[
  '<section class="gc-layer" id="gc-picker" hidden><div class="gc-panel" role="dialog" aria-modal="true" aria-label="Group call picker">',
  '<div class="gc-head"><h2>Call someone</h2><button id="gc-close" class="gc-button">✕ Close</button></div>',
  '<p class="gc-note">Choose 1, 2, or 3 friends. Select one person for a private call, or more for a group call.</p>',
  '<input id="gc-search" class="gc-input" type="search" placeholder="Search iLiam accounts" aria-label="Search iLiam accounts">',
  '<div class="gc-users" id="gc-users"></div><p class="gc-note" id="gc-count">0 of 3 selected</p>',
  '<div class="gc-actions"><button class="gc-button good" id="gc-video" disabled>📹 Video call</button>',
  '<button class="gc-button good" id="gc-audio" disabled>📞 Audio call</button></div>',
  '<p class="gc-status" id="gc-picker-status" role="status"></p></div></section>',
  '<section class="gc-invite" id="gc-invite" hidden aria-live="assertive">',
  '<h2 id="gc-invite-title">Incoming group call</h2><p id="gc-invite-who"></p>',
  '<div class="gc-actions"><button class="gc-button good" id="gc-accept">Accept</button>',
  '<button class="gc-button danger" id="gc-decline">Decline</button></div><p class="gc-status" id="gc-invite-status"></p></section>',
  '<section class="gc-layer" id="gc-active" hidden><div class="gc-callbox" role="dialog" aria-modal="true" aria-label="Group call">',
  '<div class="gc-head"><h2 id="gc-active-title">iLiam Group Call</h2><span id="gc-counter">1 connected</span></div>',
  '<div class="gc-grid" id="gc-grid"></div><p class="gc-status" id="gc-active-status"></p>',
  '<div class="gc-actions"><button class="gc-button" id="gc-mute">🎙 Mute</button>',
  '<button class="gc-button" id="gc-camera">📷 Camera off</button>',
  '<button class="gc-button" id="gc-play">🔊 Play audio</button>',
  '<button class="gc-button danger" id="gc-end">☎ Leave call</button></div></div></section>'
 ].join("");
 document.body.append(ui);
 const $=id=>ui.querySelector("#"+id);
 const show=(id,on)=>{$(id).hidden=!on;};
 const status=text=>$("gc-active-status").textContent=text;
 const pickerStatus=text=>$("gc-picker-status").textContent=text;
 const displayName=p=>p?.nickname||p?.username||"iLiam user";
 const millis=t=>t?.toMillis?.()||0;
 let me=null,myProfile=null,people=[],selected=new Map(),current=null,incoming=null,working=false;
 let dnd=false,blocked=new Set(),stopSettings=null,stopBlocks=null,stopInbox=null;
 const roomSubscriptions=new Map(),inviteStates=new Map();
 launch.disabled=true;
 function avatar(p){
  try{const u=new URL(p.photoURL);if(["http:","https:"].includes(u.protocol))return u.href;}catch{}
  const ch=displayName(p).slice(0,1).toUpperCase().replace(/[<>&"]/g,"")||"U";
  return "data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#205579"/><text x="40" y="54" text-anchor="middle" font-family="Arial" fill="white" font-size="36">'+ch+'</text></svg>');
 }
 function mediaError(e){
  const n=e?.name||"",m=e?.message||"";
  if(["NotAllowedError","PermissionDeniedError"].includes(n))return "Camera/microphone permission was blocked in this browser.";
  if(n==="NotFoundError")return "No camera or microphone was found.";
  if(n==="NotReadableError")return "Your camera or microphone is in use by another app.";
  if(e?.code==="permission-denied"||/insufficient permissions|permission-denied/i.test(m))
   return "An invited user may have Do Not Disturb on or may have blocked calls. Check that the updated Firestore rules are published.";
  return m||"Could not start group call.";
 }
 function updateButtons(){
  $("gc-count").textContent=selected.size+" of 3 selected"+(selected.size===1?" · Private call":selected.size>1?" · Group call":"");
  $("gc-video").disabled=!selected.size||working;
  $("gc-audio").disabled=!selected.size||working;
 }
 function drawPeople(){
  const q=$("gc-search").value.toLowerCase().trim(),area=$("gc-users");area.replaceChildren();
  for(const p of people.filter(p=>!blocked.has(p.uid)&&(displayName(p)+" "+p.username).toLowerCase().includes(q)).slice(0,100)){
   const row=document.createElement("button");row.type="button";row.className="gc-user"+(selected.has(p.uid)?" selected":"");
   const img=document.createElement("img");img.src=avatar(p);img.alt="";img.referrerPolicy="no-referrer";img.onerror=()=>{img.onerror=null;img.src=avatar({nickname:p.nickname});};
   const text=document.createElement("div");text.className="gc-user-info";text.textContent=displayName(p);
   const handle=document.createElement("div");handle.className="gc-username";handle.textContent="@"+p.username;text.append(handle);
   const marker=document.createElement("span");marker.textContent=selected.has(p.uid)?"✓":"＋";
   row.setAttribute("aria-pressed",String(selected.has(p.uid)));
   row.append(img,text,marker);
   row.onclick=()=>{
    if(selected.has(p.uid))selected.delete(p.uid);
    else if(selected.size<3)selected.set(p.uid,p);
    else pickerStatus("You can choose at most 3 other people.");
    updateButtons();drawPeople();
   };
   area.append(row);
  }
  if(!area.children.length)area.textContent="No matching users.";
 }
 async function openPicker(){
  if(!me||!myProfile)return alert("Sign in to Community first.");
  if(current)return;
  selected.clear();show("gc-picker",true);$("gc-search").value="";updateButtons();
  pickerStatus("Loading accounts…");
  try{
   const snap=await getDocs(query(collection(db,"profiles"),limit(200)));
   if(!me)return;
   people=snap.docs.filter(d=>d.id!==me.uid).map(d=>({uid:d.id,...d.data()}))
    .sort((a,b)=>displayName(a).localeCompare(displayName(b)));
   drawPeople();pickerStatus("Choose friends, then select audio or video.");
  }catch(e){pickerStatus("Could not load accounts: "+e.message);}
 }
 launch.onclick=openPicker;$("gc-close").onclick=()=>show("gc-picker",false);
 $("gc-search").oninput=drawPeople;
 function teardown(){
  const s=current;current=null;
  if(s){
   s.unsubs.forEach(fn=>fn());
   stopPeersFor(s);
   s.stream.getTracks().forEach(t=>t.stop());
  }
  $("gc-grid").replaceChildren();
  show("gc-active",false);
  working=false;
 }
 function stopPeersFor(s){
  for(const p of s.peers.values()){
   p.unsubs.forEach(fn=>fn());
   try{p.pc.close();}catch{}
  }
  s.peers.clear();
  s.pending.clear();
 }
 async function leaveRoom(){
  const s=current;
  teardown();
  if(!s)return;
  try{
   if(s.host)await updateDoc(s.ref,{status:"ended"});
   else await updateDoc(doc(s.ref,"members",me.uid),{status:"left",updatedAt:serverTimestamp()});
  }catch(e){console.warn("Could not mark group call left:",e);}
 }
 $("gc-end").onclick=leaveRoom;
 $("gc-mute").onclick=()=>{
  const t=current?.stream.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;
  $("gc-mute").textContent=t.enabled?"🎙 Mute":"🔇 Unmute";
 };
 $("gc-camera").onclick=()=>{
  const t=current?.stream.getVideoTracks()[0];if(!t)return;t.enabled=!t.enabled;
  $("gc-camera").textContent=t.enabled?"📷 Camera off":"📷 Camera on";
 };
 $("gc-play").onclick=()=>{
  if(!current)return;
  for(const p of current.peers.values())p.media?.play().catch(()=>{});
 };
 async function capture(type){
  if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==="undefined")
   throw Error("This browser does not support WebRTC.");
  return navigator.mediaDevices.getUserMedia({audio:true,video:type==="video"?{facingMode:"user",width:{ideal:640},height:{ideal:480}}:false});
 }
 function addTile(s,uid,label,stream,local=false){
  const tile=document.createElement("div");tile.className="gc-tile";
  let player;
  if(s.type==="video"){
   player=document.createElement("video");player.autoplay=true;player.playsInline=true;player.muted=local;
   if(local)player.className="self";
   player.srcObject=stream;
   tile.append(player);
  }else{
   const symbol=document.createElement("div");symbol.className="gc-voice";symbol.textContent=local?"🎙":"📞";tile.append(symbol);
   if(!local){
    player=document.createElement("audio");player.autoplay=true;player.srcObject=stream;tile.append(player);
   }
  }
  const caption=document.createElement("div");caption.className="gc-label";caption.textContent=label;tile.append(caption);
  $("gc-grid").append(tile);
  if(player)player.play().catch(()=>{});
  return {tile,media:player};
 }
 function refreshCount(s){
  const count=1+[...s.peers.values()].filter(p=>p.pc.connectionState==="connected").length;
  $("gc-counter").textContent=count+" connected";
 }
 async function peerName(uid){
  const fromPeople=people.find(p=>p.uid===uid);if(fromPeople)return displayName(fromPeople);
  try{const snap=await getDoc(doc(db,"profiles",uid));return snap.exists()?displayName(snap.data()):"User";}
  catch{return "User";}
 }
 async function connectPeer(s,uid){
  if(current!==s||s.peers.has(uid)||s.pending.has(uid)||blocked.has(uid))return;
  s.pending.add(uid);
  // Lower Firebase UID offers; the other participant answers.
  const a=[me.uid,uid].sort()[0],b=[me.uid,uid].sort()[1],offerer=me.uid===a;
  const connectionRef=doc(s.ref,"connections",a+"__"+b);
  const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]});
  for(const track of s.stream.getTracks())pc.addTrack(track,s.stream);
  const remote=new MediaStream(),label=await peerName(uid);
  if(current!==s){pc.close();s.pending.delete(uid);return;}
  const view=addTile(s,uid,label+" · Connecting",remote);
  const p={pc,uid,connectionRef,remote,unsubs:[],tile:view.tile,media:view.media,answered:false,answerSent:false};
  s.peers.set(uid,p);s.pending.delete(uid);
  const pending=[],localCandidates=[];
  let connectionExists=false;
  const icePath=offerer?"aCandidates":"bCandidates",remotePath=offerer?"bCandidates":"aCandidates";
  async function flushIncoming(){
   if(!pc.remoteDescription)return;
   while(pending.length){
    try{await pc.addIceCandidate(pending.shift());}
    catch(e){console.warn("Group ICE:",e);}
   }
  }
  async function flushOutgoing(){
   if(!connectionExists)return;
   while(localCandidates.length){
    const item=localCandidates.shift();
    try{await addDoc(collection(connectionRef,icePath),{...item,uid:me.uid});}
    catch(e){console.warn("Group ICE write:",e);}
   }
  }
  pc.onicecandidate=e=>{
   if(!e.candidate||current!==s)return;
   localCandidates.push(e.candidate.toJSON());flushOutgoing();
  };
  pc.ontrack=e=>{
   for(const t of e.streams[0]?.getTracks()||[e.track]){
    if(!remote.getTracks().some(x=>x.id===t.id))remote.addTrack(t);
   }
   if(p.media){p.media.srcObject=remote;p.media.play().catch(()=>status("Tap Play audio if you cannot hear a participant."));}
  };
  pc.onconnectionstatechange=()=>{
   if(current!==s)return;
   p.tile.querySelector(".gc-label").textContent=label+(pc.connectionState==="connected"?" · Connected":" · "+pc.connectionState);
   refreshCount(s);
   if(pc.connectionState==="failed")status("A connection failed. Different networks may require a TURN server.");
  };
  p.unsubs.push(onSnapshot(collection(connectionRef,remotePath),snap=>{
   for(const ch of snap.docChanges())if(ch.type==="added"){
    const d=ch.doc.data();
    pending.push({candidate:d.candidate,sdpMid:d.sdpMid,sdpMLineIndex:d.sdpMLineIndex,usernameFragment:d.usernameFragment||undefined});
   }
   flushIncoming();
  },e=>status("Group ICE error: "+e.message)));
  p.unsubs.push(onSnapshot(connectionRef,async snap=>{
   if(current!==s||!snap.exists())return;
   const data=snap.data();connectionExists=true;flushOutgoing();
   try{
    if(!offerer&&!p.answerSent&&data.offer){
     p.answerSent=true;
     await pc.setRemoteDescription(data.offer);
     await flushIncoming();
     const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
     await updateDoc(connectionRef,{answer:{type:answer.type,sdp:answer.sdp}});
    }else if(offerer&&!p.answered&&data.answer){
     p.answered=true;
     await pc.setRemoteDescription(data.answer);await flushIncoming();
    }
   }catch(e){status("Could not connect to "+label+": "+e.message);}
  },e=>status("Group signaling error: "+e.message)));
  if(offerer)try{
   const offer=await pc.createOffer();await pc.setLocalDescription(offer);
   if(current!==s)return;
   await setDoc(connectionRef,{a,b,offer:{type:offer.type,sdp:offer.sdp},createdAt:serverTimestamp()});
   connectionExists=true;await flushOutgoing();
  }catch(e){status("Could not connect to "+label+": "+e.message);}
 }
 function removePeer(s,uid){
  const peer=s.peers.get(uid);if(!peer)return;
  peer.unsubs.forEach(fn=>fn());peer.pc.close();peer.tile.remove();s.peers.delete(uid);refreshCount(s);
 }
 function beginSession(s){
  current=s;show("gc-picker",false);show("gc-invite",false);show("gc-active",true);
  const label=s.participantCount===2?"Call":"Group call";
  $("gc-active-title").textContent=(s.type==="video"?"📹 Video ":"📞 Audio ")+label;
  show("gc-camera",s.type==="video");
  $("gc-mute").textContent="🎙 Mute";$("gc-camera").textContent="📷 Camera off";
  $("gc-grid").replaceChildren();addTile(s,me.uid,"You",s.stream,true);
  refreshCount(s);status("Waiting for invited people to join…");
  s.unsubs.push(onSnapshot(s.ref,snap=>{
   if(current!==s)return;
   if(!snap.exists()||snap.data().status==="ended"){teardown();return;}
  },e=>status("Room error: "+e.message)));
  s.unsubs.push(onSnapshot(collection(s.ref,"members"),snap=>{
   if(current!==s)return;
   const accepted=new Set();
   snap.forEach(d=>{if(d.id!==me.uid&&d.data().status==="accepted")accepted.add(d.id);});
   for(const uid of accepted)if(!s.peers.has(uid))connectPeer(s,uid);
   for(const uid of [...s.peers.keys()])if(!accepted.has(uid))removePeer(s,uid);
   if(!accepted.size)status("Waiting for invited people to join…");
   else status("Participants joining…");
  },e=>status("Room members unavailable: "+e.message)));
 }
 async function startGroup(type){
  if(working||current||!me||!myProfile||!selected.size)return;
  working=true;updateButtons();pickerStatus("Requesting "+(type==="video"?"camera and microphone":"microphone")+"…");
  let stream=null,ref=null,started=false;
  try{
   stream=await capture(type);
   const guests=[...selected.values()],participants=[me.uid,...guests.map(p=>p.uid)];
   ref=doc(collection(db,"groupCalls"));
   await setDoc(ref,{hostId:me.uid,hostName:displayName(myProfile),participants,type,status:"open",createdAt:serverTimestamp()});
   await setDoc(doc(ref,"members",me.uid),{uid:me.uid,status:"accepted",updatedAt:serverTimestamp()});
   const session={ref,stream,type,host:true,participantCount:participants.length,peers:new Map(),pending:new Set(),unsubs:[]};
   beginSession(session);started=true;
   let invited=0,failed=[];
   for(const guest of guests)try{
    await setDoc(doc(ref,"members",guest.uid),{uid:guest.uid,status:"ringing",updatedAt:serverTimestamp()});
    invited++;
   }catch(e){failed.push(displayName(guest));console.warn("Invite rejected:",e);}
   if(!invited){
    status("No invitations went through. Friends may have DND enabled or blocked calls.");
    await leaveRoom();
    show("gc-picker",true);
    pickerStatus("Unable to invite anyone. Check their Do Not Disturb settings or your Firebase rules.");
   }else status("Calling "+invited+" "+(invited===1?"person":"people")+(failed.length?". Could not invite: "+failed.join(", "):"")+".");
  }catch(e){
   if(!started&&stream)stream.getTracks().forEach(t=>t.stop());
   if(!started&&ref)updateDoc(ref,{status:"ended"}).catch(()=>{});
   pickerStatus(mediaError(e));
  }finally{working=false;updateButtons();}
 }
 $("gc-video").onclick=()=>startGroup("video");
 $("gc-audio").onclick=()=>startGroup("audio");
 function showInvite(){
  if(current||!incoming){show("gc-invite",false);return;}
  const isGroup=incoming.room?.participants?.length>2;
  $("gc-invite-title").textContent=(incoming.type==="video"?"📹 Incoming video call":"📞 Incoming audio call")+(isGroup?" (group)":"");
  $("gc-invite-who").textContent=(incoming.hostName||"Someone")+(isGroup?" invited you to a group call.":" is calling you.");
  $("gc-invite-status").textContent="";
  show("gc-invite",true);
 }
 async function declineInvite(roomId){
  if(!roomId||!me)return;
  if(incoming?.id===roomId)incoming=null;
  show("gc-invite",false);
  try{await updateDoc(doc(db,"groupCalls",roomId,"members",me.uid),{status:"declined",updatedAt:serverTimestamp()});}
  catch(e){console.warn("Decline group invite:",e);}
 }
 $("gc-decline").onclick=()=>{if(incoming)declineInvite(incoming.id);};
 $("gc-accept").onclick=async()=>{
  if(!incoming||working||current||!me)return;
  const invite=incoming;working=true;$("gc-accept").disabled=true;
  $("gc-invite-status").textContent="Requesting "+(invite.type==="video"?"camera and microphone":"microphone")+"…";
  let stream=null;
  try{
   const ref=doc(db,"groupCalls",invite.id);
   const [room,member]=await Promise.all([getDoc(ref),getDoc(doc(ref,"members",me.uid))]);
   if(!room.exists()||room.data().status!=="open"||!member.exists()||member.data().status!=="ringing")
    throw Error("This group invitation is no longer available.");
   stream=await capture(invite.type);
   await updateDoc(doc(ref,"members",me.uid),{status:"accepted",updatedAt:serverTimestamp()});
   incoming=null;
   beginSession({ref,stream,type:invite.type,host:false,participantCount:room.data().participants.length,peers:new Map(),pending:new Set(),unsubs:[]});
  }catch(e){
   if(stream)stream.getTracks().forEach(t=>t.stop());
   $("gc-invite-status").textContent=mediaError(e);
  }finally{$("gc-accept").disabled=false;working=false;}
 };
 function checkInvites(){
  if(current){show("gc-invite",false);return;}
  const now=Date.now();
  incoming=[...inviteStates.values()]
   .filter(v=>v.member==="ringing"&&v.room.status==="open"
      &&now-millis(v.room.createdAt)<120000&&!dnd&&!blocked.has(v.room.hostId))
   .sort((a,b)=>millis(b.room.createdAt)-millis(a.room.createdAt))[0]||null;
  showInvite();
 }
 function listenInbox(uid){
  if(stopInbox)stopInbox();
  stopInbox=onSnapshot(query(collection(db,"groupCalls"),where("participants","array-contains",uid),limit(25)),snap=>{
   const present=new Set();
   for(const d of snap.docs){
    const data=d.data();present.add(d.id);
    if(!roomSubscriptions.has(d.id)){
     roomSubscriptions.set(d.id,onSnapshot(doc(db,"groupCalls",d.id,"members",uid),member=>{
      inviteStates.set(d.id,{id:d.id,room:data,...data,member:member.exists()?member.data().status:null});
      checkInvites();
     },e=>console.warn("Group invite:",e)));
    }else{
     const old=inviteStates.get(d.id);
     if(old)inviteStates.set(d.id,{...old,room:data,...data});
    }
   }
   for(const [id,stop] of roomSubscriptions)if(!present.has(id)){
    stop();roomSubscriptions.delete(id);inviteStates.delete(id);
   }
   checkInvites();
  },e=>console.warn("Group inbox:",e));
 }
 function clearInbox(){
  if(stopInbox){stopInbox();stopInbox=null;}
  for(const fn of roomSubscriptions.values())fn();
  roomSubscriptions.clear();inviteStates.clear();incoming=null;
  show("gc-invite",false);
 }
 function clearPrivacy(){
  if(stopSettings){stopSettings();stopSettings=null;}
  if(stopBlocks){stopBlocks();stopBlocks=null;}
  dnd=false;blocked=new Set();
 }
 onAuthStateChanged(auth,async user=>{
  clearInbox();clearPrivacy();
  if(current)teardown();
  me=user;myProfile=null;launch.disabled=true;
  if(!user)return;
  try{
   const snap=await getDoc(doc(db,"profiles",user.uid));
   if(auth.currentUser?.uid!==user.uid||!snap.exists())return;
   myProfile=snap.data();launch.disabled=false;
   stopSettings=onSnapshot(doc(db,"callSettings",user.uid),s=>{
    dnd=s.exists()&&s.data().doNotDisturb===true;
    if(dnd&&incoming)declineInvite(incoming.id);
    checkInvites();
   },e=>console.warn("DND:",e));
   stopBlocks=onSnapshot(collection(db,"callBlocks",user.uid,"users"),snap=>{
    blocked=new Set(snap.docs.map(d=>d.id));
    if(incoming&&blocked.has(incoming.hostId))declineInvite(incoming.id);
    if(current){
     for(const uid of [...current.peers.keys()])if(blocked.has(uid))removePeer(current,uid);
    }
    drawPeople();checkInvites();
   },e=>console.warn("Group call blocks:",e));
   listenInbox(user.uid);
  }catch(e){console.warn("Group calls sign-in:",e);}
 });
 window.addEventListener("pagehide",()=>{
  if(current){
   current.stream.getTracks().forEach(t=>t.stop());
   for(const p of current.peers.values())p.pc.close();
  }
 });
}
