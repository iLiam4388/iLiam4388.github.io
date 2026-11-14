import {initializeApp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {getFirestore,doc,collection,getDoc,getDocs,setDoc,addDoc,deleteDoc,updateDoc,onSnapshot,query,where,limit,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";
import {showIncomingCall,dismissIncomingCall} from "./iliam-call-alerts.js";

// Temporary 2–4-person WebRTC mesh calls. No saved groups and no video recording.
// A group needs separate pairwise connections for every accepted participant.
const launch=document.getElementById("iliam-group-button");
if(launch){
 const app=initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);
 const ui=document.createElement("div");ui.id="iliam-group-ui";
 ui.innerHTML=[
  '<section class="gc-layer" id="gc-picker" hidden><div class="gc-panel" role="dialog" aria-modal="true" aria-label="Group call picker">',
  '<div class="gc-head"><h2>Call someone</h2><div class="gc-top-controls"><button id="gc-edit" class="gc-button" type="button" aria-label="Edit blocked users">✎ Edit</button><button id="gc-close" class="gc-button">✕ Close</button></div></div>',
  '<p class="gc-note">Choose 1, 2, or 3 friends. Select one person for a private call, or more for a group call.</p>',
  '<section id="gc-block-editor" class="gc-block-editor" hidden><div class="gc-head"><h3>Blocked people</h3><button id="gc-edit-done" class="gc-button" type="button">✓ Done</button></div>',
  '<p class="gc-note">Block or unblock iLiam accounts. Blocked users cannot call you, and you cannot call them.</p>',
  '<input id="gc-block-search" class="gc-input" type="search" placeholder="Search users to block or unblock" aria-label="Search blocked accounts">',
  '<div id="gc-block-list" class="gc-users"></div></section>',
  '<div id="gc-people-section">',
  '<input id="gc-search" class="gc-input" type="search" placeholder="Search iLiam accounts" aria-label="Search iLiam accounts">',
  '<div class="gc-users" id="gc-users"></div><p class="gc-note" id="gc-count">0 of 3 selected</p>',
  '<div class="gc-actions"><button class="gc-button good" id="gc-video" disabled>📹 Video call</button>',
  '<button class="gc-button good" id="gc-audio" disabled>📞 Audio call</button></div>',
  '<p class="gc-status" id="gc-picker-status" role="status"></p></div>',
  '<button id="gc-allow-notifications" class="gc-button" type="button">🔔 Enable call notifications</button>',
  '<label class="gc-dnd-footer"><span><strong>🌙 Do Not Disturb</strong><small>Don’t receive incoming calls</small></span><input id="gc-dnd" type="checkbox" aria-label="Do Not Disturb"></label>',
  '<p class="gc-status" id="gc-privacy-status" role="status"></p></div></section>',
  '<section class="gc-invite" id="gc-invite" hidden aria-live="assertive">',
  '<h2 id="gc-invite-title">Incoming group call</h2><p id="gc-invite-who"></p>',
  '<div class="gc-actions"><button class="gc-button good" id="gc-accept">Accept</button>',
  '<button class="gc-button danger" id="gc-decline">Decline</button></div><p class="gc-status" id="gc-invite-status"></p></section>',
  '<section class="gc-layer" id="gc-active" hidden><div class="gc-callbox" role="dialog" aria-modal="true" aria-label="Group call">',
  '<div class="gc-head"><h2 id="gc-active-title">iLiam Group Call</h2><span id="gc-counter">1 connected</span></div>',
  '<div class="gc-grid" id="gc-grid"></div><p class="gc-status" id="gc-active-status"></p>',
  '<div class="gc-actions"><button class="gc-button" id="gc-mute">🎙 Mute</button>',
  '<button class="gc-button" id="gc-camera">📷 Camera off</button>',
  '<button class="gc-button" id="gc-share">🖥 Share screen</button>',
  '<button class="gc-button" id="gc-play">🔊 Play audio</button>',
  '<button class="gc-button" id="gc-pip">▣ Picture in Picture</button>',
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
 let dnd=false,blocked=new Set(),stopSettings=null,stopBlocks=null,stopInbox=null,privacyReady=false;
 const roomSubscriptions=new Map(),inviteStates=new Map();
 let lastNotifiedInvite=null;
 function notifyIncomingCall(invite){
  if(!invite||invite.id===lastNotifiedInvite)return;
  lastNotifiedInvite=invite.id;
  showIncomingCall({
   kind:"group",id:invite.id,name:invite.hostName,type:invite.type,
   accept:()=>{$("gc-accept").click();},
   decline:()=>{$("gc-decline").click();}
  });
 }
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
 function privacyStatus(message){$("gc-privacy-status").textContent=message||"";}
 function updateDnd(){
  $("gc-dnd").checked=dnd;
  $("gc-dnd").disabled=!privacyReady||!me;
 }
 function showBlockEditor(open){
  show("gc-block-editor",open);
  show("gc-people-section",!open);
  $("gc-edit").textContent=open?"✓ Done":"✎ Edit";
  if(open)drawBlockList();
 }
 function drawBlockList(){
  const list=$("gc-block-list"),q=$("gc-block-search").value.toLowerCase().trim();
  list.replaceChildren();
  const results=people.filter(p=>(displayName(p)+" "+p.username).toLowerCase().includes(q));
  results.sort((a,b)=>Number(blocked.has(b.uid))-Number(blocked.has(a.uid))||displayName(a).localeCompare(displayName(b)));
  for(const p of results.slice(0,100)){
   const row=document.createElement("div");row.className="gc-user gc-block-row";
   const img=document.createElement("img");img.src=avatar(p);img.alt="";
   const name=document.createElement("span");name.className="gc-user-info";name.textContent=displayName(p)+" @"+p.username;
   const btn=document.createElement("button");btn.type="button";btn.className="gc-button"+(blocked.has(p.uid)?"":" danger");
   btn.textContent=blocked.has(p.uid)?"Unblock":"Block";
   btn.onclick=async()=>{
    if(!me||!privacyReady)return;
    btn.disabled=true;privacyStatus("Saving block settings…");
    try{
     const wasBlocked=blocked.has(p.uid);
     const ref=doc(db,"callBlocks",me.uid,"users",p.uid);
     if(wasBlocked)await deleteDoc(ref);
     else await setDoc(ref,{uid:p.uid,blockedAt:serverTimestamp()});
     if(!wasBlocked&&current?.peers.has(p.uid))removePeer(current,p.uid);
     if(!wasBlocked&&incoming?.hostId===p.uid)await declineInvite(incoming.id);
     privacyStatus(wasBlocked?"User unblocked.":"User blocked.");
    }catch(e){privacyStatus("Could not save block setting: "+e.message);}
    finally{btn.disabled=false;}
   };
   row.append(img,name,btn);list.append(row);
  }
  if(!list.children.length)list.textContent="No matching users found.";
 }
 $("gc-edit").onclick=()=>showBlockEditor($("gc-block-editor").hidden);
 $("gc-edit-done").onclick=()=>showBlockEditor(false);
 $("gc-block-search").oninput=drawBlockList;
 $("gc-dnd").onchange=async event=>{
  if(!me||!privacyReady){updateDnd();return;}
  const checked=event.target.checked;
  event.target.disabled=true;privacyStatus("Saving Do Not Disturb…");
  try{
   await setDoc(doc(db,"callSettings",me.uid),{doNotDisturb:checked,updatedAt:serverTimestamp()});
   privacyStatus(checked?"Do Not Disturb is on.":"Do Not Disturb is off.");
  }catch(e){privacyStatus("Could not save Do Not Disturb: "+e.message);updateDnd();}
  finally{event.target.disabled=false;}
 };
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
  selected.clear();show("gc-picker",true);showBlockEditor(false);$("gc-search").value="";$("gc-block-search").value="";updateButtons();updateDnd();
  pickerStatus("Loading accounts…");
  try{
   const snap=await getDocs(query(collection(db,"profiles"),limit(200)));
   if(!me)return;
   people=snap.docs.filter(d=>d.id!==me.uid).map(d=>({uid:d.id,...d.data()}))
    .sort((a,b)=>displayName(a).localeCompare(displayName(b)));
   drawPeople();drawBlockList();pickerStatus("Choose friends, then select audio or video.");
  }catch(e){pickerStatus("Could not load accounts: "+e.message);}
 }
 launch.onclick=openPicker;$("gc-close").onclick=()=>show("gc-picker",false);
 // Start the existing call flow from a private or group chat.
 window.addEventListener("iliam:call-from-chat",async event=>{
  if(!me||!myProfile||current)return;
  const uids=[...new Set(event.detail?.uids||[])].filter(uid=>uid!==me.uid).slice(0,3);
  if(!uids.length)return;
  await openPicker();
  if(!me||current)return;
  selected.clear();
  for(const uid of uids){
   const p=people.find(x=>x.uid===uid&&!blocked.has(uid));
   if(p)selected.set(uid,p);
  }
  updateButtons();drawPeople();
  if(selected.size!==uids.length){pickerStatus("Some members cannot be called. They may be blocked or unavailable.");return;}
  if(event.detail?.type==="video"||event.detail?.type==="audio")startGroup(event.detail.type);
 });

 $("gc-search").oninput=drawPeople;
 function teardown(){
  const s=current;current=null;
  if(s){
   s.unsubs.forEach(fn=>fn());
   stopPeersFor(s);
   s.screenStream?.getTracks().forEach(t=>t.stop());
   s.stream.getTracks().forEach(t=>t.stop());
   s.previewStream=null;
  }
  $("gc-share").textContent="🖥 Share screen";
  $("gc-share").disabled=false;
  if(document.pictureInPictureElement)document.exitPictureInPicture().catch(()=>{});
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
 $("gc-allow-notifications").onclick=async()=>{
  if(!("Notification" in window)){privacyStatus("Browser notifications are unavailable here. In-page alerts will still appear.");return;}
  try{
   const result=await Notification.requestPermission();
   privacyStatus(result==="granted"?"Call notifications enabled while an iLiam page is open.":"Notifications weren't enabled. Check your browser's permission settings.");
   if(result==="granted"&&"serviceWorker" in navigator)navigator.serviceWorker.register("./iliam-call-sw.js").catch(console.warn);
  }catch(e){privacyStatus("Could not enable notifications: "+e.message);}
 };
 $("gc-pip").onclick=async()=>{
  const s=current;if(!s||s.type!=="video")return;
  if(!document.pictureInPictureEnabled){
   status("Picture-in-Picture is unavailable in this browser.");return;
  }
  try{
   if(document.pictureInPictureElement){await document.exitPictureInPicture();return;}
   const videos=[...$("gc-grid").querySelectorAll("video")];
   const remote=videos.find(video=>!video.classList.contains("self")&&video.readyState>=2);
   const video=remote||videos.find(video=>video.readyState>=2);
   if(!video){status("Wait for someone’s video to appear before opening Picture-in-Picture.");return;}
   await video.requestPictureInPicture();
   status("Picture-in-Picture is on. You can switch tabs while the call continues.");
  }catch(e){status("Could not open Picture-in-Picture: "+e.message);}
 };
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
 function previewScreen(s,track){
  if(current!==s)return;
  const tile=$("gc-grid").querySelector(".gc-tile");
  const video=tile?.querySelector("video");
  if(video){
   video.srcObject=track?new MediaStream([track]):s.stream;
   video.play().catch(()=>{});
  }
  if(tile)tile.classList.toggle("gc-screen-tile",!!track);
 }
 async function stopScreenShare(s){
  if(current!==s||!s.screenStream||s.screenUpdating)return;
  s.screenUpdating=true;
  const oldStream=s.screenStream;
  try{
   const replacements=[...s.peers.values()].map(p=>{
    const sender=p.pc.getSenders().find(x=>x.track?.kind==="video");
    return sender?sender.replaceTrack(s.cameraTrack):Promise.resolve();
   });
   await Promise.all(replacements);
   s.screenStream=null;
   s.screenTrack=null;
   previewScreen(s,null);
   $("gc-share").textContent="🖥 Share screen";
   status("Screen sharing stopped. Camera restored.");
  }catch(e){status("Unable to restore the camera: "+e.message);}
  finally{
   // Do not end an active share if restoring the camera failed.
   if(s.screenStream!==oldStream)oldStream.getTracks().forEach(t=>t.stop());
   s.screenUpdating=false;
  }
 }
 $("gc-share").onclick=async()=>{
  const s=current;
  if(!s||s.type!=="video"||s.screenUpdating)return;
  if(s.screenStream){await stopScreenShare(s);return;}
  if(!navigator.mediaDevices?.getDisplayMedia){
   status("This browser cannot share its screen. Try desktop Chrome, Edge or Opera.");
   return;
  }
  // getDisplayMedia must run directly in a click handler for user permission.
  let displayStream;
  try{displayStream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:15},audio:false});}
  catch(e){
   if(e.name!=="NotAllowedError"&&e.name!=="AbortError")status("Unable to share screen: "+e.message);
   return;
  }
  if(current!==s){displayStream.getTracks().forEach(t=>t.stop());return;}
  const screenTrack=displayStream.getVideoTracks()[0];
  if(!screenTrack){displayStream.getTracks().forEach(t=>t.stop());status("No screen video track was provided.");return;}
  screenTrack.contentHint="detail";
  s.screenUpdating=true;
  try{
   await Promise.all([...s.peers.values()].map(p=>{
    const sender=p.pc.getSenders().find(x=>x.track?.kind==="video");
    if(!sender)throw Error("A participant has no video sender.");
    return sender.replaceTrack(screenTrack);
   }));
   if(current!==s){displayStream.getTracks().forEach(t=>t.stop());return;}
   s.screenStream=displayStream;s.screenTrack=screenTrack;
   previewScreen(s,screenTrack);
   $("gc-share").textContent="⏹ Stop sharing";
   status("You are sharing your screen. Stop sharing to return to the camera.");
   screenTrack.addEventListener("ended",()=>{if(current===s&&s.screenStream===displayStream)stopScreenShare(s);},{once:true});
  }catch(e){
   await Promise.allSettled([...s.peers.values()].map(p=>{
    const sender=p.pc.getSenders().find(x=>x.track?.kind==="video");
    return sender?.replaceTrack(s.cameraTrack);
   }));
   displayStream.getTracks().forEach(t=>t.stop());
   status("Unable to share screen: "+e.message);
  }finally{s.screenUpdating=false;}
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
  for(const track of s.stream.getTracks()){
   const outgoing=track.kind==="video"&&s.screenTrack?s.screenTrack:track;
   pc.addTrack(outgoing,s.stream);
  }
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
  show("gc-share",s.type==="video");
  show("gc-pip",s.type==="video");
  $("gc-share").textContent="🖥 Share screen";
  $("gc-mute").textContent="🎙 Mute";$("gc-camera").textContent="📷 Camera off";
  s.cameraTrack=s.stream.getVideoTracks()[0]||null;
  s.screenTrack=null;s.screenStream=null;s.screenUpdating=false;
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
  notifyIncomingCall(incoming);
 }
 async function declineInvite(roomId){
  if(!roomId||!me)return;
  if(incoming?.id===roomId)incoming=null;
  show("gc-invite",false);
  dismissIncomingCall("group",roomId);
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
   incoming=null;dismissIncomingCall("group",invite.id);
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
  if(!incoming&&lastNotifiedInvite){dismissIncomingCall("group",lastNotifiedInvite);lastNotifiedInvite=null;}
  if(incoming){
   const params=new URLSearchParams(location.search);
   if(params.get("incomingKind")==="group"&&params.get("incomingId")===incoming.id){
    if(params.get("incomingAction")==="decline")$("gc-decline").click();
    else $("gc-accept").click();
    history.replaceState(null,"",location.pathname);
   }
  }
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
  roomSubscriptions.clear();inviteStates.clear();incoming=null;lastNotifiedInvite=null;
  show("gc-invite",false);
 }
 function clearPrivacy(){
  if(stopSettings){stopSettings();stopSettings=null;}
  if(stopBlocks){stopBlocks();stopBlocks=null;}
  dnd=false;blocked=new Set();privacyReady=false;updateDnd();
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
    privacyReady=true;updateDnd();
    if(dnd&&incoming)declineInvite(incoming.id);
    checkInvites();
   },e=>{privacyReady=false;updateDnd();privacyStatus("Could not load Do Not Disturb: "+e.message);console.warn("DND:",e);});
   stopBlocks=onSnapshot(collection(db,"callBlocks",user.uid,"users"),snap=>{
    blocked=new Set(snap.docs.map(d=>d.id));
    if(incoming&&blocked.has(incoming.hostId))declineInvite(incoming.id);
    if(current){
     for(const uid of [...current.peers.keys()])if(blocked.has(uid))removePeer(current,uid);
    }
    drawPeople();drawBlockList();checkInvites();
   },e=>console.warn("Group call blocks:",e));
   listenInbox(user.uid);
  }catch(e){console.warn("Group calls sign-in:",e);}
 });
 navigator.serviceWorker?.addEventListener("message",e=>{
  const a=e.data;
  if(a?.type!=="iliam-call-action"||a.kind!=="group")return;
  if(incoming?.id!==a.id)return;
  if(a.action==="decline")$("gc-decline").click();
  else $("gc-accept").click();
 });
 window.addEventListener("pagehide",()=>{
  if(current){
   current.stream.getTracks().forEach(t=>t.stop());
   for(const p of current.peers.values())p.pc.close();
  }
 });
}
