import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {getFirestore,doc,getDoc,collection,addDoc,deleteDoc,setDoc,onSnapshot,query,orderBy,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const app=initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);
const root=document.getElementById('iliam-reviews');
if(root){
 const style=document.createElement('style');style.textContent=`
 #iliam-reviews [hidden]{display:none!important} #iliam-reviews{color:#171323;text-align:left}.review-controls{display:grid;gap:10px;margin:14px 0}.review-controls textarea{width:100%;min-height:90px;padding:12px;border-radius:12px;font:inherit}.review-controls button,.review-entry button{cursor:pointer;border:0;border-radius:10px;padding:9px 14px;background:#142c56;color:white;font:inherit}
 .review-controls button:disabled{opacity:.55;cursor:wait}.review-entry{padding:16px;margin:16px 0;border-radius:15px;background:#fff;color:#171323;box-shadow:0 2px 10px #0002;overflow-wrap:anywhere}
 .review-entry .review-entry{margin:12px 0 0 18px;background:#e9f3ff}.review-entry header{display:flex;gap:9px;flex-wrap:wrap;align-items:center;font-weight:bold}.review-entry time{font-weight:normal;font-size:12px;color:#555}.review-entry p{white-space:pre-wrap;line-height:1.5}.review-actions{display:flex;gap:7px;flex-wrap:wrap}.review-compose{display:flex;gap:8px;margin-top:10px}.review-compose input{flex:1;min-width:0;padding:9px;border-radius:10px;border:1px solid #aaa}.review-hint{font-size:13px}.review-score{font-size:22px}
 `;document.head.append(style);
 let user=null,profile=null,admin=false,stopReviews=null,stops=[];
 const heading=document.createElement('p');heading.className='review-hint';heading.textContent='Sign in with your iLiam Community account to leave a review, reply, or react.';
 const controls=document.createElement('div');controls.className='review-controls';
 const rating=document.createElement('select');rating.setAttribute('aria-label','Your rating');
 for(let n=5;n>=1;n--){const o=document.createElement('option');o.value=n;o.textContent='★'.repeat(n)+'☆'.repeat(5-n);rating.append(o)}
 const message=document.createElement('textarea');message.maxLength=1200;message.placeholder='What do you think of iLiam?';
 const submit=document.createElement('button');submit.textContent='Post review';
 const status=document.createElement('p');status.className='review-hint';
 controls.append(rating,message,submit,status);
 const login=document.createElement('a');login.href='community.html';login.textContent='Log in or create an iLiam account in Community';login.style.color='#071f90';
 const list=document.createElement('div');root.replaceChildren(heading,login,controls,list);
 function note(text){status.textContent=text}
 function stopAll(){stops.forEach(s=>s());stops=[]}
 function entry(data,id,parent=null){
  const wrap=document.createElement('article');wrap.className='review-entry';
  const head=document.createElement('header'),name=document.createElement('span'),date=document.createElement('time');
  name.textContent=data.nickname||data.username||'iLiam user';
  date.textContent=data.createdAt?.toDate?.().toLocaleString()||'recently';
  head.append(name,date);
  if(data.featured===true){const badge=document.createElement('span');badge.textContent='★ FEATURED';head.append(badge)}
  const text=document.createElement('p');text.textContent=data.text||'';
  const actions=document.createElement('div');actions.className='review-actions';
  wrap.append(head,text,actions);
  if(!parent){
   const score=document.createElement('div');score.className='review-score';score.textContent='★'.repeat(data.rating||0)+'☆'.repeat(5-(data.rating||0));head.append(score);
  }
  const reactionRow=document.createElement('div');reactionRow.className='review-actions';
  for(const [label,emoji] of [['Like','👍'],['Love','❤️'],['Laugh','😂']]){
   const b=document.createElement('button');b.type='button';b.textContent=emoji+' '+label;
   b.disabled=!profile;
   b.onclick=async()=>{
    if(!profile)return;
    b.disabled=true;
    try{
     const path=parent?['reviews',parent,'replies',id,'reactions',user.uid+'_'+label]:['reviews',id,'reactions',user.uid+'_'+label];
     await setDoc(doc(db,...path),{uid:user.uid,emoji,createdAt:serverTimestamp()});
    }catch(e){note(e.message)}finally{b.disabled=false}
   };
   reactionRow.append(b);
  }
  actions.append(reactionRow);
  if(user&&(admin||user.uid===data.uid)){
   const del=document.createElement('button');del.textContent='Delete';del.onclick=async()=>{if(confirm('Delete this '+(parent?'reply':'review')+'?'))try{await deleteDoc(parent?doc(db,'reviews',parent,'replies',id):doc(db,'reviews',id));}catch(e){note(e.message)}};actions.append(del);
  }
  if(!parent){
   const replySection=document.createElement('div');
   const replyForm=document.createElement('div');replyForm.className='review-compose';
   const input=document.createElement('input');input.maxLength=500;input.placeholder=profile?'Write a reply…':'Sign in to reply';input.disabled=!profile;
   const send=document.createElement('button');send.textContent='Reply';send.disabled=!profile;
   send.onclick=async()=>{
    const val=input.value.trim();if(!val||!profile)return;
    send.disabled=true;
    try{await addDoc(collection(db,'reviews',id,'replies'),{uid:user.uid,username:profile.username,nickname:profile.nickname,text:val,createdAt:serverTimestamp()});input.value=''}catch(e){note(e.message)}finally{send.disabled=false}
   };
   replyForm.append(input,send);wrap.append(replyForm,replySection);
   stops.push(onSnapshot(query(collection(db,'reviews',id,'replies'),orderBy('createdAt','asc')),snap=>{
    replySection.replaceChildren(...snap.docs.map(d=>entry(d.data(),d.id,id)));
   },e=>{replySection.textContent='Replies unavailable: '+e.message}));
  }
  return wrap;
 }
 function watchReviews(){
  if(stopReviews)stopReviews();stopAll();
  stopReviews=onSnapshot(query(collection(db,'reviews'),orderBy('createdAt','desc')),snap=>{
   stopAll();
   list.replaceChildren(...snap.docs.map(d=>entry(d.data(),d.id)));
   if(snap.empty)list.textContent='No reviews yet. Be the first!';
  },e=>list.textContent='Could not load reviews: '+e.message);
 }
 onAuthStateChanged(auth,async u=>{
  user=u;profile=null;admin=false;
  if(u)try{const [p,a]=await Promise.all([getDoc(doc(db,'profiles',u.uid)),getDoc(doc(db,'admins',u.uid))]);if(p.exists())profile=p.data();admin=a.exists()}catch(e){note(e.message)}
  login.hidden=Boolean(profile);controls.hidden=!profile;
  heading.textContent=profile?'Posting as '+(profile.nickname||profile.username):'Sign in with your iLiam Community account to review, reply, and react.';
  watchReviews();
 });
 submit.onclick=async()=>{
  const val=message.value.trim();if(!profile||!val)return note('Write a review first.');
  submit.disabled=true;
  try{await addDoc(collection(db,'reviews'),{uid:user.uid,username:profile.username,nickname:profile.nickname,text:val,rating:Number(rating.value),featured:false,createdAt:serverTimestamp()});message.value='';note('Review posted!')}catch(e){note(e.message)}finally{submit.disabled=false}
 };
}
