import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {getFirestore,collection,query,orderBy,limit,onSnapshot,doc,getDoc,Timestamp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const app=initializeApp(firebaseConfig), db=getFirestore(app), auth=getAuth(app);
const CSS=`
#iliam-announcements{position:fixed;z-index:9000;top:12px;left:50%;transform:translateX(-50%);width:min(580px,calc(100% - 24px));pointer-events:none;display:grid;gap:8px}
.iliam-notice{pointer-events:auto;position:relative;text-align:left;padding:15px 42px 15px 17px;background:rgba(2,22,42,.94);color:white;border:2px solid cyan;border-radius:17px;box-shadow:0 8px 36px #00ffff66;backdrop-filter:blur(16px);opacity:0;transform:translateY(-20px);transition:opacity .4s ease,transform .4s ease}
.iliam-notice.visible{opacity:1;transform:translateY(0)}
.iliam-notice strong{display:block;margin-bottom:5px}
.iliam-notice button{position:absolute;right:9px;top:9px;border:0;border-radius:8px;background:#ffffff22;color:white;cursor:pointer;padding:6px 10px}
#iliam-notify-settings{position:fixed;z-index:8999;right:12px;bottom:12px;padding:10px 13px;border:1px solid cyan;border-radius:13px;background:#001b34ee;color:white;cursor:pointer;font:13px Verdana,Arial}
#iliam-notify-panel{position:fixed;z-index:9001;right:12px;bottom:55px;width:min(320px,calc(100% - 24px));padding:16px;border:2px solid cyan;border-radius:14px;background:#00182c;color:white;font:14px Verdana,Arial;text-align:left;box-shadow:0 0 24px #00ffff66}
#iliam-notify-panel label{display:block;margin:12px 0}#iliam-notify-panel input{width:auto;margin-right:8px}
`;
document.head.append(Object.assign(document.createElement('style'),{textContent:CSS}));
const stack=document.createElement('div');stack.id='iliam-announcements';stack.setAttribute('aria-live','polite');document.body.append(stack);
const toggle=document.createElement('button');toggle.id='iliam-notify-settings';toggle.textContent='🔔 Notifications';document.body.append(toggle);
const panel=document.createElement('section');panel.id='iliam-notify-panel';panel.hidden=true;
panel.innerHTML='<strong>iLiam notifications</strong><label><input type="checkbox" id="noticeAnnouncements">New announcements</label><label><input type="checkbox" id="noticeVotes">Upvotes and featured posts</label><p style="font-size:12px">Browser notifications work only while an iLiam page is open. Turn them on to request permission.</p>';
document.body.append(panel);
const settings={announcements:localStorage.getItem('iliam-notify-announcements')==='true',votes:localStorage.getItem('iliam-notify-votes')==='true'};
panel.querySelector('#noticeAnnouncements').checked=settings.announcements;
panel.querySelector('#noticeVotes').checked=settings.votes;
toggle.onclick=()=>panel.hidden=!panel.hidden;
async function updateSetting(key,checked){
 settings[key]=checked;localStorage.setItem('iliam-notify-'+key,String(checked));
 if(checked&&'Notification' in window&&Notification.permission==='default')await Notification.requestPermission();
}
panel.querySelector('#noticeAnnouncements').onchange=e=>updateSetting('announcements',e.target.checked);
panel.querySelector('#noticeVotes').onchange=e=>updateSetting('votes',e.target.checked);
function notify(title,body){if('Notification' in window&&Notification.permission==='granted')new Notification(title,{body});}
function milliseconds(value){return value?.toMillis?.()??(typeof value==='number'?value:0)}
let announcements=[],dismissed=new Set(),seenAnnouncements=new Set(),annInitial=true;
function showNotices(){
 const now=Date.now(),active=announcements.filter(a=>a.enabled!==false&&(!a.startsAt||milliseconds(a.startsAt)<=now)&&(!a.endsAt||milliseconds(a.endsAt)>now));
 const ids=new Set(active.map(a=>a.id));
 for(const node of [...stack.children])if(!ids.has(node.dataset.id)){node.classList.remove('visible');setTimeout(()=>node.remove(),450);}
 for(const a of active){
  if(dismissed.has(a.id))continue;
  let card=[...stack.children].find(x=>x.dataset.id===a.id);
  if(!card){
   card=document.createElement('article');card.className='iliam-notice';card.dataset.id=a.id;
   const title=document.createElement('strong'),body=document.createElement('div'),close=document.createElement('button');
   title.textContent='📢 '+String(a.title||'Announcement');body.textContent=String(a.text||'');
   close.textContent='✕';close.setAttribute('aria-label','Dismiss announcement');
   close.onclick=()=>{dismissed.add(a.id);card.classList.remove('visible');setTimeout(()=>card.remove(),450)};
   card.append(title,body,close);stack.append(card);requestAnimationFrame(()=>card.classList.add('visible'));
  }
  if(!annInitial&&!seenAnnouncements.has(a.id)&&settings.announcements)notify(a.title||'iLiam announcement',a.text||'');
  seenAnnouncements.add(a.id);
 }
 annInitial=false;
}
onSnapshot(query(collection(db,'announcements'),orderBy('createdAt','desc'),limit(50)),snap=>{
 announcements=snap.docs.map(d=>({id:d.id,...d.data()}));showNotices();
},err=>console.warn('Announcement listener unavailable:',err));
setInterval(showNotices,1000);
let stopVotes=null;
onAuthStateChanged(auth,async user=>{
 if(stopVotes){stopVotes();stopVotes=null;}
 if(!user)return;
 try{
  const p=await getDoc(doc(db,'profiles',user.uid));if(!p.exists())return;
  let first=true,prior=new Map();
  stopVotes=onSnapshot(collection(db,'posts'),snap=>{
   const next=new Map();
   snap.forEach(d=>{
    const post=d.data();if(post.uid!==user.uid)return;
    next.set(d.id,{upvotes:Number(post.upvotes)||0,featured:post.featured===true});
    const old=prior.get(d.id);
    if(!first&&old&&settings.votes){
     if(post.upvotes>old.upvotes)notify('iLiam upvote','Your post received '+(post.upvotes-old.upvotes)+' new upvote(s).');
     if(!old.featured&&post.featured===true)notify('iLiam featured','One of your posts was featured!');
    }
   });
   prior=next;first=false;
  },err=>console.warn('Post notification listener:',err));
 }catch(err){console.warn(err)}
});
