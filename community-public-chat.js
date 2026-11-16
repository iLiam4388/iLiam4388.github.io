import {initializeApp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {getFirestore,collection,doc,getDoc,addDoc,deleteDoc,onSnapshot,query,orderBy,limit,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const launcher=document.getElementById("iliam-public-chat-button");
if(launcher){
 const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
 const root=document.createElement("section");
 root.id="iliam-public-chat";
 root.hidden=true;
 root.innerHTML=`
 <div class="pc-shell" role="dialog" aria-modal="true" aria-label="iLiam Public Chat">
  <header class="pc-header"><h2>iLiam Public Chat</h2><button type="button" id="pc-close" class="pc-btn">✕ Close</button></header>
  <div class="pc-history" id="pc-history" role="log" aria-live="polite"><p class="pc-info">Sign in to join Public Chat.</p></div>
  <div id="pc-reply-preview" class="pc-reply-preview" hidden><div><strong id="pc-reply-title"></strong><span id="pc-reply-quote"></span></div><button type="button" class="pc-btn" id="pc-cancel-reply">✕</button></div>
  <form id="pc-form" class="pc-composer">
   <button type="button" class="pc-btn" id="pc-link">🔗 Link</button>
   <input id="pc-text" maxlength="2000" aria-label="Public message" placeholder="Type a public message..." disabled>
   <button type="submit" class="pc-btn pc-primary" id="pc-send" disabled>Send</button>
  </form>
  <p class="pc-status" id="pc-status" role="status"></p>
 </div>
 <div id="pc-link-overlay" class="pc-link-overlay" hidden>
  <form id="pc-link-form" class="pc-link-panel">
   <h3>Add a link</h3><label>Link text<input id="pc-link-label" maxlength="120" required placeholder="My website"></label>
   <label>URL<input id="pc-link-url" type="url" required placeholder="https://example.com"></label>
   <div class="pc-link-actions"><button type="button" class="pc-btn" id="pc-link-close">Cancel</button><button type="submit" class="pc-btn pc-primary">Insert link</button></div>
   <p class="pc-status" id="pc-link-error"></p>
  </form>
 </div>`;
 document.body.append(root);
 const $=id=>root.querySelector("#"+id);
 let user=null,profile=null,stop=null,reply=null,knownProfiles=new Map(),lastSent=0,session=0,seenMessages=new Map();
 const status=t=>{$("pc-status").textContent=t||"";};
 const name=p=>p?.nickname||p?.username||"iLiam user";
 const safeUrl=s=>{try{const u=new URL(s);return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}};
 function makeLinks(node,text){
  const regex=/\[([^\]\r\n]{1,120})\]\((https?:\/\/[^\s)]+)\)/gi;
  let pos=0,m;
  while((m=regex.exec(text))){
   const href=safeUrl(m[2]);if(!href)continue;
   node.append(document.createTextNode(text.slice(pos,m.index)));
   const a=document.createElement("a");a.textContent=m[1];a.href=href;a.target="_blank";a.rel="noopener noreferrer";node.append(a);pos=regex.lastIndex;
  }
  node.append(document.createTextNode(text.slice(pos)));
 }
 function clearReply(){reply=null;$("pc-reply-preview").hidden=true;}
 function startReply(m){
  reply={id:m.id,uid:m.uid,text:m.text.slice(0,180)};
  $("pc-reply-title").textContent="Replying to "+(m.uid===user.uid?"yourself":name(knownProfiles.get(m.uid)));
  $("pc-reply-quote").textContent=reply.text;
  $("pc-reply-preview").hidden=false;$("pc-text").focus();
 }
 $("pc-cancel-reply").onclick=clearReply;
 const profileName=uid=>uid===user?.uid?"You":name(knownProfiles.get(uid));
 async function loadProfile(uid,active){
  if(knownProfiles.has(uid))return;
  knownProfiles.set(uid,{nickname:"User"});
  try{
   const snapshot=await getDoc(doc(db,"profiles",uid));
   if(session===active&&snapshot.exists()){knownProfiles.set(uid,snapshot.data());draw();}
  }catch(e){console.warn("Public profile load:",e);}
 }
 function avatar(uid){
  const p=knownProfiles.get(uid)||{};
  const frame=document.createElement("span");frame.className="pc-avatar";
  const url=typeof p.photoURL==="string"&&(/^(https?:\/\/|data:image\/)/i).test(p.photoURL)?p.photoURL:null;
  if(url){const img=document.createElement("img");img.src=url;img.alt="";img.referrerPolicy="no-referrer";img.onerror=()=>{frame.textContent=name(p).slice(0,1).toUpperCase();};frame.append(img);}
  else frame.textContent=name(p).slice(0,1).toUpperCase();
  return frame;
 }
 function draw(){
  const area=$("pc-history"),atBottom=area.scrollHeight-area.scrollTop-area.clientHeight<110;
  area.replaceChildren();
  const entries=[...seenMessages.values()];
  if(!entries.length){const empty=document.createElement("p");empty.className="pc-info";empty.textContent="No messages yet. Start the conversation!";area.append(empty);}
  for(const m of entries){
   const line=document.createElement("article");line.className="pc-message";line.dataset.messageId=m.id;
   line.append(avatar(m.uid));
   const body=document.createElement("div");body.className="pc-message-body";
   const head=document.createElement("div");head.className="pc-message-head";
   const sender=document.createElement("strong");sender.textContent=profileName(m.uid);
   const t=document.createElement("time");t.textContent=m.createdAt?.toDate?.().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})||"";
   head.append(sender,t);body.append(head);
   if(m.replyTo){
    const quoted=document.createElement("button");quoted.type="button";quoted.className="pc-quote";
    const original=seenMessages.get(m.replyTo.id);
    quoted.textContent="↳ "+(original?profileName(original.uid)+": "+original.text.slice(0,110):"Original message not in recent history");
    quoted.onclick=()=>{const target=area.querySelector('[data-message-id="'+CSS.escape(m.replyTo.id)+'"]');if(target){target.scrollIntoView({behavior:"smooth",block:"center"});target.classList.add("pc-highlight");setTimeout(()=>target.classList.remove("pc-highlight"),1000);}};
    body.append(quoted);
   }
   const message=document.createElement("div");message.className="pc-message-text";makeLinks(message,m.text);body.append(message);
   const actions=document.createElement("div");actions.className="pc-message-actions";
   const response=document.createElement("button");response.type="button";response.textContent="Reply";response.onclick=()=>startReply(m);actions.append(response);
   if(user&&(m.uid===user.uid||$("pc-history").dataset.admin==="yes")){
    const remove=document.createElement("button");remove.type="button";remove.textContent="Delete";
    remove.onclick=async()=>{if(!confirm("Delete this public message?"))return;try{await deleteDoc(doc(db,"publicChatMessages",m.id));}catch(e){status("Could not delete: "+e.message);}};actions.append(remove);
   }
   body.append(actions);line.append(body);area.append(line);
  }
  if(atBottom)area.scrollTop=area.scrollHeight;
 }
 async function open(){
  if(!user||!profile)return alert("Sign in to iLiam Community first.");
  root.hidden=false;document.body.classList.add("pc-open");
  if(stop)return;
  const active=++session;status("Connecting to Public Chat…");
  try{$("pc-history").dataset.admin=(await getDoc(doc(db,"admins",user.uid))).exists()?"yes":"no";}
  catch{$("pc-history").dataset.admin="no";}
  stop=onSnapshot(query(collection(db,"publicChatMessages"),orderBy("createdAt","desc"),limit(100)),snap=>{
   if(active!==session)return;
   seenMessages=new Map(snap.docs.slice().reverse().map(d=>[d.id,{id:d.id,...d.data()}]));
   for(const uid of new Set([...seenMessages.values()].map(m=>m.uid)))loadProfile(uid,active);
   draw();status("");
  },e=>status("Could not load Public Chat: "+e.message));
 }
 function close(){
  root.hidden=true;document.body.classList.remove("pc-open");clearReply();
  if(stop){stop();stop=null;}session++;seenMessages.clear();
 }
 launcher.onclick=open;
 $("pc-close").onclick=close;
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!root.hidden){if(!$("pc-link-overlay").hidden)$("pc-link-overlay").hidden=true;else close();}});
 $("pc-form").onsubmit=async e=>{
  e.preventDefault();if(!user||!profile)return;
  const text=$("pc-text").value.trim();if(!text)return;
  if(Date.now()-lastSent<2000)return status("Please wait two seconds between messages.");
  const uid=user.uid,btn=$("pc-send");btn.disabled=true;
  try{
   await addDoc(collection(db,"publicChatMessages"),{uid,text,createdAt:serverTimestamp(),...(reply?{replyTo:reply}:{})});
   if(auth.currentUser?.uid!==uid)return;
   lastSent=Date.now();$("pc-text").value="";clearReply();status("");
  }catch(error){status("Message not sent: "+error.message);}
  finally{btn.disabled=false;}
 };
 $("pc-link").onclick=()=>{$("pc-link-label").value="";$("pc-link-url").value="";$("pc-link-error").textContent="";$("pc-link-overlay").hidden=false;$("pc-link-label").focus();};
 $("pc-link-close").onclick=()=>{$("pc-link-overlay").hidden=true;};
 $("pc-link-form").onsubmit=e=>{
  e.preventDefault();
  const label=$("pc-link-label").value.trim(),raw=$("pc-link-url").value.trim(),url=safeUrl(raw);
  if(!label||/[\[\]\r\n]/.test(label)||!url||/[\s()]/.test(raw))return $("pc-link-error").textContent="Enter valid link text and an HTTP(S) URL.";
  const field=$("pc-text"),mark="["+label+"]("+url+")";
  if(field.value.length+mark.length+1>2000)return $("pc-link-error").textContent="Message is too long.";
  field.value+=(field.value&&!field.value.endsWith(" ")?" ":"")+mark;
  $("pc-link-overlay").hidden=true;field.focus();
 };
 onAuthStateChanged(auth,async current=>{
  close();user=current;profile=null;knownProfiles.clear();launcher.disabled=true;
  if(!current)return;
  try{const snap=await getDoc(doc(db,"profiles",current.uid));if(auth.currentUser?.uid!==current.uid||!snap.exists())return;
   profile=snap.data();knownProfiles.set(current.uid,profile);launcher.disabled=false;
   $("pc-text").disabled=false;$("pc-send").disabled=false;
  }catch(e){console.warn("Public Chat sign-in:",e);}
 });
}
