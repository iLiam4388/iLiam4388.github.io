import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getFirestore,collection,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const db=getFirestore(initializeApp(firebaseConfig));
const badges=new Map();
for(const page of ["videos","photos","downloads","community","store","games","other"]){
  const link=document.querySelector('.nav a[href="'+page+'.html"]');
  if(!link)continue;
  const badge=document.createElement('span');badge.className='new-stuff-tag';badge.hidden=true;
  const label=document.createElement('span');
  const mark=document.createElement('span');mark.className='new-stuff-mark';mark.textContent='!';mark.setAttribute('aria-hidden','true');
  badge.append(label,mark);link.append(badge);badges.set(page,{badge,label});
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
onSnapshot(collection(db,'navBadges'),snap=>{
  records=snap.docs.map(d=>({id:d.id,data:d.data()}));renderBadges();
},error=>{records=[];renderBadges();console.warn('Navigation badges unavailable:',error);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderBadges();});
window.addEventListener('pageshow',renderBadges);
