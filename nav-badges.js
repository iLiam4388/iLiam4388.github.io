import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {getFirestore,collection,doc,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const app=initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);
const welcome=document.getElementById('home-welcome'),terminal=document.getElementById('terminal-welcome');
let stopProfile=null,authGeneration=0;
function showWelcome(username){
  const name=typeof username==='string'?username.trim():'';
  if(welcome)welcome.textContent=name?'Welcome, @'+name+'!':'WELCOME TO iLIAM';
  if(terminal)terminal.textContent=name?'WELCOME, @'+name+'!':'WELCOME TO iLIAM!';
}
onAuthStateChanged(auth,user=>{
  const generation=++authGeneration;
  if(stopProfile){stopProfile();stopProfile=null;}
  showWelcome('');
  if(user)stopProfile=onSnapshot(doc(db,'profiles',user.uid),snap=>{
    if(generation===authGeneration)showWelcome(snap.exists()?snap.data().username:'');
  },()=>{if(generation===authGeneration)showWelcome('');});
});
const section=document.getElementById('new-stuff-for-you'),list=document.getElementById('new-stuff-list');
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
  const name=link.textContent.trim();
  const {badge,label}=makeBadge();link.append(badge);
  badges.set(page,{badge,label,name,href:link.getAttribute('href')});
}
let records=[],expiryTimer;
function renderBadges(){
  clearTimeout(expiryTimer);
  const now=Date.now();let next=Infinity;
  if(list)list.replaceChildren();
  for(const {badge,label} of badges.values()){badge.hidden=true;label.textContent='';}
  for(const {id,data} of records){
    const target=badges.get(id);
    if(!target||data.enabled!==true||typeof data.text!=='string'||!data.text.trim())continue;
    const end=data.endsAt==null?Infinity:data.endsAt.toMillis?.();
    if(end!==Infinity&&(!Number.isFinite(end)||end<=now))continue;
    target.label.textContent=data.text.slice(0,80);target.badge.hidden=false;
    if(list){
      const row=document.createElement('a');row.href=target.href;
      const name=document.createElement('span');name.textContent=target.name;
      const copy=makeBadge();copy.label.textContent=target.label.textContent;copy.badge.hidden=false;
      row.append(name,copy.badge);list.append(row);
    }
    next=Math.min(next,end);
  }
  if(section)section.hidden=!list?.childElementCount;
  if(Number.isFinite(next))expiryTimer=setTimeout(renderBadges,Math.min(2147483647,Math.max(0,next-Date.now())));
}
onSnapshot(collection(db,'navBadges'),snap=>{
  records=snap.docs.map(d=>({id:d.id,data:d.data()}));renderBadges();
},error=>{records=[];renderBadges();console.warn('Navigation badges unavailable:',error);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderBadges();});
window.addEventListener('pageshow',renderBadges);
