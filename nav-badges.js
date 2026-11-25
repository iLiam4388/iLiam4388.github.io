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
onSnapshot(collection(db,'navBadges'),snap=>{
  for(const {badge,label} of badges.values()){badge.hidden=true;label.textContent='';}
  for(const d of snap.docs){
    const target=badges.get(d.id),data=d.data();
    if(!target||data.enabled!==true||typeof data.text!=='string'||!data.text.trim())continue;
    target.label.textContent=data.text.slice(0,80);target.badge.hidden=false;
  }
},error=>{for(const {badge} of badges.values())badge.hidden=true;console.warn('Navigation badges unavailable:',error);});
