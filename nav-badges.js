import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {getFirestore,collection,doc,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const app=initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);
const terminal=document.getElementById('terminal-user');
let stopProfile=null,authGeneration=0;
function showWelcome(username){
  const name=typeof username==='string'?username.trim():'';
  if(terminal){terminal.textContent=name?' • USER: @'+name:'';terminal.hidden=!name;}
}
if(terminal)onAuthStateChanged(auth,user=>{
  const generation=++authGeneration;
  if(stopProfile){stopProfile();stopProfile=null;}
  showWelcome('');
  if(user)stopProfile=onSnapshot(doc(db,'profiles',user.uid),snap=>{
    if(generation===authGeneration)showWelcome(snap.exists()?snap.data().username:'');
  },()=>{if(generation===authGeneration)showWelcome('');});
});
function makeBadge(){
  const badge=document.createElement('span');badge.className='new-stuff-tag';badge.hidden=true;
  const label=document.createElement('span');
  const mark=document.createElement('span');mark.className='new-stuff-mark';mark.textContent='!';mark.setAttribute('aria-hidden','true');
  badge.append(label,mark);return {badge,label};
}
const badges=new Map();
for(const page of ["videos","photos","downloads","community","store","games","other"]){
  const link=document.querySelector('.nav a[href="'+page+'.html"]');
  if(!link)continue;
  const {badge,label}=makeBadge();link.append(badge);
  badges.set(page,{badge,label});
}
const title=document.querySelector('[data-nav-badge-page]');
const pageId=title?.dataset.navBadgePage;
if(title&&["videos","photos","downloads","community","store","games","other"].includes(pageId)){
  const {badge,label}=makeBadge();title.append(badge);badges.set(pageId,{badge,label});
}
let records=[],expiryTimer;
function renderBadges(){
  clearTimeout(expiryTimer);
  const now=Date.now();let next=Infinity;
  for(const {badge,label} of badges.values()){badge.hidden=true;label.textContent='';}
  for(const {id,data} of records){
    const target=badges.get(id);
    if(!target||data.enabled!==true||typeof data.text!=='string'||!data.text.trim())continue;
    const end=data.endsAt==null?Infinity:data.endsAt.toMillis?.();
    if(end!==Infinity&&(!Number.isFinite(end)||end<=now))continue;
    target.label.textContent=data.text.slice(0,80);target.badge.hidden=false;
    next=Math.min(next,end);
  }
  if(Number.isFinite(next))expiryTimer=setTimeout(renderBadges,Math.min(2147483647,Math.max(0,next-Date.now())));
}
function badgeError(error){records=[];renderBadges();console.warn('Navigation badges unavailable:',error);}
if(pageId&&badges.has(pageId)){
  onSnapshot(doc(db,'navBadges',pageId),snap=>{
    records=snap.exists()?[{id:snap.id,data:snap.data()}]:[];renderBadges();
  },badgeError);
}else if(badges.size){
  onSnapshot(collection(db,'navBadges'),snap=>{
    records=snap.docs.map(d=>({id:d.id,data:d.data()}));renderBadges();
  },badgeError);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderBadges();});
window.addEventListener('pageshow',renderBadges);

import "./liam-economy.js?v=13";
