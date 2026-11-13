import {initializeApp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {getFirestore,collection,doc,getDoc,getDocs,setDoc,addDoc,deleteDoc,updateDoc,onSnapshot,query,where,orderBy,limit,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

// Messages is separate from Community posts and from the Calls screen.
// Conversation membership is checked by Firestore Rules on every read/write.
const launcher=document.getElementById("iliam-messages-button");
if(launcher){
 const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
 const ui=document.createElement("div");ui.id="iliam-messages-ui";
 ui.innerHTML=[
 '<section class="im-backdrop" id="im-backdrop" hidden><div class="im-shell" role="dialog" aria-modal="true" aria-label="iLiam Messages">',
 '<header class="im-top"><h2>✉ iLiam Messages</h2><div class="im-actions"><button type="button" class="im-btn primary" id="im-add">＋ Add user</button><button type="button" class="im-btn" id="im-settings-open">⚙ Settings</button><button type="button" class="im-btn" id="im-close">✕ Close</button></div></header>',
 '<div class="im-main"><aside class="im-sidebar"><div id="im-conversations" class="im-list"><p class="im-empty">Loading…</p></div></aside>',
 '<section class="im-chat"><header class="im-chat-head"><h3 id="im-title">Choose a conversation</h3>',
 '<div class="im-actions"><button type="button" class="im-btn" id="im-edit-group" hidden>✎ Edit group</button><button type="button" class="im-btn danger" id="im-delete" hidden>🗑 Delete chat</button><button type="button" class="im-btn" id="im-call" hidden>📞 Call</button></div></header>',
 '<div id="im-call-menu" class="im-call-menu" hidden><button type="button" class="im-btn" id="im-voice">📞 Audio call</button>',
 '<button type="button" class="im-btn" id="im-video">📹 Video call</button></div>',
 '<div id="im-messages" class="im-bubbles"><p class="im-empty">Choose a chat or add someone.</p></div>',
 '<form id="im-form" class="im-send"><input class="im-input" id="im-input" maxlength="2000" placeholder="Type a private message…" aria-label="Message" disabled>',
 '<button class="im-btn primary" id="im-send" type="submit" disabled>Send</button></form></section></div>',
 '</div></section>',
 '<section class="im-modal" id="im-new" hidden><div class="im-panel" role="dialog" aria-modal="true" aria-label="New conversation">',
 '<div class="im-actions" style="justify-content:space-between;align-items:center"><h3>New message</h3><button class="im-btn" id="im-new-close">✕ Close</button></div>',
 '<p class="im-hint">Choose one person for a private chat, or two or three people for a group chat (4 people maximum including you).</p>',
 '<input id="im-search" class="im-search" type="search" placeholder="Search iLiam users" aria-label="Search users">',
 '<div id="im-people" class="im-people"></div><p id="im-selected" class="im-hint">0 of 3 selected</p>',
 '<input id="im-group-name" class="im-search" maxlength="60" placeholder="Group name (for group chats)" hidden>',
 '<div class="im-actions"><button class="im-btn primary" id="im-create" disabled>Create chat</button>',
 '<button class="im-btn" id="im-cancel">Cancel</button></div>',
 '<p class="im-status" id="im-new-status" role="status"></p></div></section>',
 '<section class="im-modal" id="im-group-edit" hidden><div class="im-panel" role="dialog" aria-modal="true" aria-label="Edit group">',
 '<div class="im-actions" style="justify-content:space-between"><h3>Edit group</h3><button class="im-btn" id="im-group-close">✕ Close</button></div>',
 '<label for="im-edit-title">Group name</label><input id="im-edit-title" maxlength="60" class="im-search" placeholder="Group name">',
 '<label for="im-edit-image">Group picture</label><input id="im-edit-image" type="file" accept="image/*" class="im-search">',
 '<img id="im-group-preview" class="im-group-preview" alt="Group picture preview" hidden>',
 '<p class="im-hint">Choose an image from your device. It will be resized and stored in the group chat; your personal profile picture is unchanged.</p>',
 '<div class="im-actions"><button class="im-btn primary" id="im-save-group">Save changes</button><button class="im-btn" id="im-remove-group-photo">Remove picture</button></div>',
 '<p class="im-status" id="im-group-status" role="status"></p></div></section>',
 '<section class="im-modal" id="im-settings" hidden><div class="im-panel" role="dialog" aria-modal="true" aria-label="Message settings">',
 '<div class="im-actions" style="justify-content:space-between"><h3>Message settings</h3><button class="im-btn" id="im-settings-close">✕ Close</button></div>',
 '<button class="im-btn primary" id="im-enable-alerts">🔔 Enable browser notifications</button>',
 '<p class="im-hint">Message and call notifications work while Community is open. The browser may require your permission.</p>',
 '<h4>Blocked messages</h4><input id="im-block-search" class="im-search" type="search" placeholder="Search accounts to block">',
 '<div id="im-block-users" class="im-people"></div>',
 '<label class="im-dnd-row"><span>🌙 Do Not Disturb for messages</span><input id="im-dnd" type="checkbox"></label>',
 '<p class="im-status" id="im-settings-status" role="status"></p></div></section>'
 ].join("");
 document.body.append(ui);
 const $=id=>ui.querySelector("#"+id),display=(id,yes)=>{$(id).hidden=!yes;};
 let user=null,profile=null,people=[],profiles=new Map(),picked=new Map(),chats=[],current=null,stopInbox=null,stopMessages=null;
 let hiddenChats=new Set(),messageBlocks=new Set(),messageDnd=false;
 let stopHidden=null,stopBlocked=null,stopMessageDnd=null;
 let inboxWatchers=new Map(),seenMessageIds=new Map();
 let pendingGroupImage=undefined;
 launcher.disabled=true;
 const label=p=>p?.nickname||p?.username||"iLiam user";
 const time=t=>t?.toDate?.().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})||"";
 const newStatus=t=>{$("im-new-status").textContent=t||"";};
 function profileOf(uid){return profiles.get(uid)||{nickname:"User"};}
 function chatName(c){
  if(c.kind==="group")return c.title||"Group chat";
  const other=c.members.find(uid=>uid!==user?.uid);
  return label(profileOf(other));
 }
 async function ensureProfiles(ids){
  await Promise.all(ids.filter(uid=>!profiles.has(uid)).map(async uid=>{
   try{
    const snap=await getDoc(doc(db,"profiles",uid));
    if(snap.exists())profiles.set(uid,snap.data());
   }catch(e){console.warn("Chat profile lookup:",e);}
  }));
 }
 function toast(title,body,onClick){
  const item=document.createElement("button");item.type="button";item.className="im-toast";
  const head=document.createElement("strong");head.textContent=title;
  const content=document.createElement("span");content.textContent=body;item.append(head,content);
  item.onclick=()=>{item.remove();onClick?.();};
  document.body.append(item);
  setTimeout(()=>item.remove(),6500);
 }
 function notify(title,body,activate){
  toast(title,body,activate);
  if("Notification" in window && Notification.permission==="granted" && document.hidden){
   try{const n=new Notification(title,{body,tag:"iliam-"+title});n.onclick=()=>{window.focus();activate?.();n.close();};}catch(e){console.warn("Notification:",e);}
  }
 }
 function openFromNotification(c){
  display("im-backdrop",true);showConversation(c);
 }
 function stopNotifications(){
  for(const fn of inboxWatchers.values())fn();
  inboxWatchers.clear();seenMessageIds.clear();
 }
 function watchMessageNotices(){
  if(!user)return;
  const eligible=chats.filter(c=>!hiddenChats.has(c.id));
  const ids=new Set(eligible.map(c=>c.id));
  for(const [id,fn] of inboxWatchers)if(!ids.has(id)){fn();inboxWatchers.delete(id);seenMessageIds.delete(id);}
  for(const c of eligible){
   if(inboxWatchers.has(c.id))continue;
   let initialized=false;
   const stop=onSnapshot(query(collection(db,"chats",c.id,"messages"),orderBy("createdAt","desc"),limit(1)),snapshot=>{
    const top=snapshot.docs[0];
    if(!initialized){initialized=true;seenMessageIds.set(c.id,top?.id||"");return;}
    if(!top || top.id===seenMessageIds.get(c.id))return;
    seenMessageIds.set(c.id,top.id);
    const msg=top.data();
    if(msg.uid===user.uid||messageDnd||messageBlocks.has(msg.uid))return;
    if(current?.id===c.id && !$("im-backdrop").hidden && !document.hidden)return;
    notify("New message · "+chatName(c),msg.text.slice(0,140),()=>openFromNotification(c));
   },e=>console.warn("Message notifications:",e));
   inboxWatchers.set(c.id,stop);
  }
 }
 function updateConversationControls(){
  const has=Boolean(current);
  display("im-delete",has);
  display("im-edit-group",has&&current.kind==="group");
  display("im-call",has);
  if(has){
   $("im-title").replaceChildren();
   if(current.kind==="group"&&current.imageUrl){
    const image=document.createElement("img");image.className="im-avatar";image.alt="";
    image.src=current.imageUrl;$("im-title").append(image);
   }
   const title=document.createElement("span");title.textContent=chatName(current);$("im-title").append(title);
  }
 }
 function renderSettingsPeople(){
  const area=$("im-block-users"),search=$("im-block-search").value.toLowerCase().trim();
  area.replaceChildren();
  const sorted=people.filter(p=>(label(p)+" "+p.username).toLowerCase().includes(search))
    .sort((a,b)=>Number(messageBlocks.has(b.uid))-Number(messageBlocks.has(a.uid))||label(a).localeCompare(label(b)));
  for(const p of sorted.slice(0,100)){
   const row=document.createElement("div");row.className="im-entry";
   const name=document.createElement("span");name.className="im-account-label";name.textContent=label(p)+" @"+p.username;
   const button=document.createElement("button");button.className="im-btn"+(messageBlocks.has(p.uid)?"":" danger");
   button.textContent=messageBlocks.has(p.uid)?"Unblock":"Block";
   button.onclick=async()=>{
    if(!user)return;
    button.disabled=true;$("im-settings-status").textContent="Updating block list…";
    try{
     const ref=doc(db,"messageBlocks",user.uid,"users",p.uid);
     if(messageBlocks.has(p.uid))await deleteDoc(ref);
     else await setDoc(ref,{uid:p.uid,blockedAt:serverTimestamp()});
     $("im-settings-status").textContent="Saved.";
    }catch(e){$("im-settings-status").textContent="Could not update block: "+e.message;}
    finally{button.disabled=false;}
   };
   row.append(name,button);area.append(row);
  }
  if(!area.children.length)area.textContent="No matching users.";
 }
 async function openSettings(){
  display("im-settings",true);
  $("im-settings-status").textContent="";
  $("im-dnd").checked=messageDnd;
  $("im-block-users").textContent="Loading accounts…";
  try{
   const snap=await getDocs(query(collection(db,"profiles"),limit(200)));
   if(!user)return;
   people=snap.docs.filter(d=>d.id!==user.uid).map(d=>({uid:d.id,...d.data()}));
   renderSettingsPeople();
  }catch(e){$("im-settings-status").textContent="Could not load accounts: "+e.message;}
 }
 function compressedGroupPhoto(file){
  return new Promise((resolve,reject)=>{
   if(!file||!file.type.startsWith("image/"))return reject(Error("Choose an image file."));
   if(file.size>12*1024*1024)return reject(Error("Image must be under 12 MB."));
   const url=URL.createObjectURL(file),image=new Image();
   image.onload=()=>{
    URL.revokeObjectURL(url);
    try{
     const canvas=document.createElement("canvas");canvas.width=192;canvas.height=192;
     const ctx=canvas.getContext("2d");
     if(!ctx)throw Error("Image resizing is not available.");
     const side=Math.min(image.width,image.height);
     ctx.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,192,192);
     const data=canvas.toDataURL("image/jpeg",0.74);
     if(data.length>120000)throw Error("Compressed group picture is too large.");
     resolve(data);
    }catch(e){reject(e);}
   };
   image.onerror=()=>{URL.revokeObjectURL(url);reject(Error("Could not read image."));};
   image.src=url;
  });
 }
 async function saveGroup(){
  if(!current||current.kind!=="group"||!user)return;
  const c=current,title=$("im-edit-title").value.trim();
  if(!title)return $("im-group-status").textContent="Enter a group name.";
  $("im-save-group").disabled=true;$("im-group-status").textContent="Saving group…";
  try{
   const data={title};
   if(pendingGroupImage!==undefined)data.imageUrl=pendingGroupImage;
   await updateDoc(doc(db,"chats",c.id),data);
   Object.assign(c,data);
   updateConversationControls();drawInbox();
   display("im-group-edit",false);
  }catch(e){$("im-group-status").textContent="Could not edit group: "+e.message;}
  finally{$("im-save-group").disabled=false;}
 }
 $("im-settings-open").onclick=openSettings;
 $("im-settings-close").onclick=()=>display("im-settings",false);
 $("im-block-search").oninput=renderSettingsPeople;
 $("im-dnd").onchange=async e=>{
  if(!user)return;
  const enabled=e.target.checked;
  e.target.disabled=true;$("im-settings-status").textContent="Saving Do Not Disturb…";
  try{
   await setDoc(doc(db,"messagePreferences",user.uid,"settings","messages"),{doNotDisturb:enabled,updatedAt:serverTimestamp()});
   $("im-settings-status").textContent=enabled?"Message notifications muted.":"Message notifications enabled.";
  }catch(err){$("im-dnd").checked=messageDnd;$("im-settings-status").textContent="Could not save: "+err.message;}
  finally{e.target.disabled=false;}
 };
 $("im-enable-alerts").onclick=async()=>{
  if(!("Notification" in window)){return $("im-settings-status").textContent="This browser does not support system notifications. In-page notices still work.";}
  const permission=await Notification.requestPermission();
  $("im-settings-status").textContent=permission==="granted"?"Browser notifications enabled.":"Browser notifications were not allowed.";
 };
 $("im-edit-group").onclick=()=>{
  if(!current||current.kind!=="group")return;
  pendingGroupImage=undefined;
  $("im-edit-title").value=current.title||"";
  $("im-edit-image").value="";
  const preview=$("im-group-preview");preview.hidden=!current.imageUrl;
  if(current.imageUrl)preview.src=current.imageUrl;
  $("im-group-status").textContent="";
  display("im-group-edit",true);
 };
 $("im-group-close").onclick=()=>display("im-group-edit",false);
 $("im-edit-image").onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  $("im-group-status").textContent="Preparing image…";
  try{
   pendingGroupImage=await compressedGroupPhoto(file);
   $("im-group-preview").src=pendingGroupImage;$("im-group-preview").hidden=false;
   $("im-group-status").textContent="Image ready. Click Save changes.";
  }catch(err){$("im-group-status").textContent=err.message;}
 };
 $("im-remove-group-photo").onclick=()=>{
  pendingGroupImage="";$("im-group-preview").hidden=true;
  $("im-edit-image").value="";$("im-group-status").textContent="Picture will be removed when you save.";
 };
 $("im-save-group").onclick=saveGroup;
 $("im-delete").onclick=async()=>{
  if(!current||!user)return;
  const c=current;
  if(!confirm("Delete this conversation from your inbox? Other participants keep their messages."))return;
  try{
   await setDoc(doc(db,"messagePreferences",user.uid,"hidden",c.id),{hiddenAt:serverTimestamp()});
   hiddenChats.add(c.id);resetCurrent();drawInbox();watchMessageNotices();
  }catch(e){alert("Could not hide conversation: "+e.message);}
 };
 function resetCurrent(){
  if(stopMessages){stopMessages();stopMessages=null;}
  current=null;
  $("im-title").textContent="Choose a conversation";
  $("im-messages").replaceChildren();
  $("im-messages").textContent="Choose a chat or add someone.";
  $("im-input").disabled=true;$("im-send").disabled=true;
  display("im-call",false);display("im-call-menu",false);
 }
 async function showConversation(c){
  if(!user||!c)return;
  if(stopMessages){stopMessages();stopMessages=null;}
  current=c;
  await ensureProfiles(c.members);
  if(current?.id!==c.id)return;
  $("im-title").textContent=chatName(c);
  $("im-input").disabled=false;$("im-send").disabled=false;
  display("im-call",true);display("im-call-menu",false);
  drawInbox();
  $("im-messages").textContent="Loading messages…";
  stopMessages=onSnapshot(query(collection(db,"chats",c.id,"messages"),orderBy("createdAt","asc"),limit(100)),snap=>{
   if(current?.id!==c.id)return;
   const board=$("im-messages");board.replaceChildren();
   for(const row of snap.docs){
    const m=row.data();
    const bubble=document.createElement("div");bubble.className="im-bubble"+(m.uid===user.uid?" mine":"");
    if(c.kind==="group"){
     const who=document.createElement("span");who.className="im-sender";who.textContent=m.uid===user.uid?"You":label(profileOf(m.uid));bubble.append(who);
    }
    const content=document.createElement("div");content.textContent=m.text; // Never inject message HTML.
    const stamp=document.createElement("span");stamp.className="im-time";stamp.textContent=time(m.createdAt);
    bubble.append(content,stamp);board.append(bubble);
   }
   if(snap.empty)board.textContent="No messages yet. Say hello!";
   board.scrollTop=board.scrollHeight;
  },e=>$("im-messages").textContent="Could not load this chat: "+e.message);
 }
 function drawInbox(){
  const list=$("im-conversations");list.replaceChildren();
  for(const c of chats){
   const btn=document.createElement("button");btn.type="button";
   btn.className="im-entry"+(c.id===current?.id?" selected":"");
   btn.textContent=(c.kind==="group"?"👥 ":"👤 ")+chatName(c);
   btn.onclick=()=>showConversation(c);list.append(btn);
  }
  if(!chats.length)list.innerHTML='<p class="im-empty">No conversations yet. Select Add user to start one.</p>';
 }
 function updatePicker(){
  const count=picked.size;
  $("im-selected").textContent=count+" of 3 selected"+(count>1?" · Group chat":count===1?" · Private chat":"");
  $("im-create").disabled=count===0;
  display("im-group-name",count>1);
  $("im-create").textContent=count>1?"Create group chat":"Start private chat";
 }
 function drawUsers(){
  const area=$("im-people"),term=$("im-search").value.trim().toLowerCase();
  area.replaceChildren();
  for(const p of people.filter(p=>(label(p)+" "+p.username).toLowerCase().includes(term)).slice(0,100)){
   const b=document.createElement("button");b.type="button";
   b.className="im-entry"+(picked.has(p.uid)?" selected":"");
   b.setAttribute("aria-pressed",String(picked.has(p.uid)));
   b.textContent=(picked.has(p.uid)?"☑ ":"☐ ")+label(p)+"  @"+p.username;
   b.onclick=()=>{
    if(picked.has(p.uid))picked.delete(p.uid);
    else if(picked.size<3)picked.set(p.uid,p);
    else newStatus("A chat can include at most three other people.");
    updatePicker();drawUsers();
   };
   area.append(b);
  }
  if(!area.children.length)area.textContent="No matching users.";
 }
 async function openNew(){
  if(!user||!profile)return;
  picked.clear();$("im-search").value="";$("im-group-name").value="";
  newStatus("");updatePicker();display("im-new",true);
  $("im-people").textContent="Loading accounts…";
  try{
   const snap=await getDocs(query(collection(db,"profiles"),limit(200)));
   if(!user)return;
   people=snap.docs.filter(d=>d.id!==user.uid).map(d=>({uid:d.id,...d.data()}));
   for(const p of people)profiles.set(p.uid,p);
   drawUsers();
  }catch(e){newStatus("Could not load accounts: "+e.message);}
 }
 async function createChat(){
  if(!user||!profile||picked.size===0)return;
  const guests=[...picked.values()];
  const members=[user.uid,...guests.map(p=>p.uid)];
  const group=members.length>2;
  const title=$("im-group-name").value.trim();
  if(group&&!title)return newStatus("Give this group a name.");
  $("im-create").disabled=true;newStatus("Creating chat…");
  try{
   let ref;
   if(group){
    ref=doc(db,"chats","group_"+doc(collection(db,"chats")).id);
   }else{
    ref=doc(db,"chats","dm_"+[user.uid,guests[0].uid].sort().join("_"));
   }
   // A missing chat cannot be read through the member-only get rule.
   // Create it first; if the same DM already exists, safely read/reuse it.
   const candidate={members,kind:group?"group":"direct",title:group?title:"",
    createdBy:user.uid,createdAt:serverTimestamp()};
   let existing=null;
   if(!group){
    try{
     const snap=await getDoc(ref);
     if(snap.exists())existing=snap.data();
    }catch(err){
     if(err.code!=="permission-denied")throw err;
     // The missing document is unreadable until the caller creates it.
    }
   }
   if(!existing){
    try{
     await setDoc(ref,candidate);
    }catch(err){
     // A simultaneous DM creation can race the write. Re-read only when
     // another member has created the exact same conversation.
     if(group)throw err;
     const retry=await getDoc(ref);
     if(!retry.exists())throw err;
     existing=retry.data();
    }
   }
   if(existing && (!Array.isArray(existing.members) ||
      existing.members.length!==members.length ||
      !members.every(uid=>existing.members.includes(uid))))
    throw Error("The existing chat does not match these participants.");
   const c={id:ref.id,...(existing||{members,kind:group?"group":"direct",title})};
   profiles.set(user.uid,profile);
   for(const p of guests)profiles.set(p.uid,p);
   display("im-new",false);await showConversation(c);
  }catch(e){
   const denied=e?.code==="permission-denied"||/insufficient permissions/i.test(e?.message||"");
   newStatus(denied
     ?"Firebase denied chat creation. Publish the latest Firestore rules from GitHub (the rules must include /chats and /messages)."
     :"Could not create chat: "+e.message);
  }
  finally{updatePicker();}
 }
 launcher.onclick=()=>{if(!profile)return alert("Sign in to Community first.");display("im-backdrop",true);};
 $("im-close").onclick=()=>display("im-backdrop",false);
 $("im-add").onclick=openNew;
 $("im-new-close").onclick=()=>display("im-new",false);
 $("im-cancel").onclick=()=>display("im-new",false);
 $("im-search").oninput=drawUsers;
 $("im-create").onclick=createChat;
 $("im-form").onsubmit=async e=>{
  e.preventDefault();if(!user||!current)return;
  const text=$("im-input").value.trim();if(!text)return;
  const btn=$("im-send");btn.disabled=true;
  try{
   await addDoc(collection(db,"chats",current.id,"messages"),{uid:user.uid,text,createdAt:serverTimestamp()});
   $("im-input").value="";
  }catch(err){alert("Message not sent: "+err.message);}
  finally{btn.disabled=false;}
 };
 $("im-call").onclick=()=>display("im-call-menu",$("im-call-menu").hidden);
 function callChat(type){
  if(!current||!user)return;
  const ids=current.members.filter(uid=>uid!==user.uid);
  display("im-call-menu",false);
  display("im-backdrop",false);
  window.dispatchEvent(new CustomEvent("iliam:call-from-chat",{detail:{uids:ids,type}}));
 }
 $("im-voice").onclick=()=>callChat("audio");
 $("im-video").onclick=()=>callChat("video");
 onAuthStateChanged(auth,async u=>{
  if(stopInbox){stopInbox();stopInbox=null;}
  resetCurrent();user=u;profile=null;chats=[];profiles.clear();
  launcher.disabled=true;
  if(!u){display("im-backdrop",false);return;}
  try{
   const snap=await getDoc(doc(db,"profiles",u.uid));
   if(auth.currentUser?.uid!==u.uid||!snap.exists())return;
   profile=snap.data();profiles.set(u.uid,profile);
   launcher.disabled=false;
   stopInbox=onSnapshot(query(collection(db,"chats"),where("members","array-contains",u.uid),limit(100)),async snap=>{
    chats=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
    await ensureProfiles([...new Set(chats.flatMap(c=>c.members))]);
    if(auth.currentUser?.uid!==u.uid)return;
    drawInbox();
   },e=>{
    const denied=e?.code==="permission-denied";
    $("im-conversations").textContent=denied
      ?"Messages unavailable: Firestore rules for /chats need to be published in Firebase."
      :"Messages unavailable: "+e.message;
   });
  }catch(err){console.warn("Messages account:",err);}
 });
}
