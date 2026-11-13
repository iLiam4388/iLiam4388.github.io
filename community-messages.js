import {initializeApp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {getFirestore,collection,doc,getDoc,getDocs,setDoc,addDoc,onSnapshot,query,where,orderBy,limit,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

// Messages is separate from Community posts and from the Calls screen.
// Conversation membership is checked by Firestore Rules on every read/write.
const launcher=document.getElementById("iliam-messages-button");
if(launcher){
 const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
 const ui=document.createElement("div");ui.id="iliam-messages-ui";
 ui.innerHTML=[
 '<section class="im-backdrop" id="im-backdrop" hidden><div class="im-shell" role="dialog" aria-modal="true" aria-label="iLiam Messages">',
 '<header class="im-top"><h2>✉ iLiam Messages</h2><div class="im-actions"><button type="button" class="im-btn primary" id="im-add">＋ Add user</button><button type="button" class="im-btn" id="im-close">✕ Close</button></div></header>',
 '<div class="im-main"><aside class="im-sidebar"><div id="im-conversations" class="im-list"><p class="im-empty">Loading…</p></div></aside>',
 '<section class="im-chat"><header class="im-chat-head"><h3 id="im-title">Choose a conversation</h3>',
 '<div class="im-actions"><button type="button" class="im-btn" id="im-call" hidden>📞 Call</button></div></header>',
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
 '<p class="im-status" id="im-new-status" role="status"></p></div></section>'
 ].join("");
 document.body.append(ui);
 const $=id=>ui.querySelector("#"+id),display=(id,yes)=>{$(id).hidden=!yes;};
 let user=null,profile=null,people=[],profiles=new Map(),picked=new Map(),chats=[],current=null,stopInbox=null,stopMessages=null;
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
   const old=await getDoc(ref);
   if(!old.exists())await setDoc(ref,{
    members,kind:group?"group":"direct",title:group?title:"",
    createdBy:user.uid,createdAt:serverTimestamp()
   });
   else if(!old.data().members.includes(user.uid))throw Error("You cannot open this chat.");
   const c={id:ref.id,...(old.exists()?old.data():{members,kind:group?"group":"direct",title})};
   profiles.set(user.uid,profile);
   for(const p of guests)profiles.set(p.uid,p);
   display("im-new",false);await showConversation(c);
  }catch(e){newStatus("Could not create chat: "+e.message);}
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
   },e=>$("im-conversations").textContent="Messages unavailable: "+e.message);
  }catch(err){console.warn("Messages account:",err);}
 });
}
