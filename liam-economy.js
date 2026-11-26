import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {getFirestore,doc,getDoc,onSnapshot,runTransaction,updateDoc,collection,query,where,limit,getDocs} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
import {defaultAppearance,dotSVG} from './idot-render.js';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const catalog=[
 ['follower','iDot Assistant',250,'iDot','Your own customized iDot follows your cursor. Eye tracking is included.',{}],
 ['glasses','iDot Sunglasses',75,'iDot','A cool pair of shades.',{glasses:true}],
 ['hat','iDot Beanie',75,'iDot','A cozy pink hat.',{hat:true}],
 ['purple','Purple iDot',50,'iDot','Purple body color.',{color:'purple'}],
 ['green','Mint iDot',50,'iDot','Mint body color.',{color:'green'}],
 ['gold','Golden iDot',100,'iDot','Gold body color.',{color:'gold'}],
 ['frame','Golden Profile Frame',100,'Profile','A golden outline for your profile picture.',{}],
 ['gradient','Gradient Display Name',125,'Profile','A blue-to-purple display name.',{}],
 ['username','Blue Username',75,'Profile','A bright cyan username.',{}],
 ['tag','iDot Club Tag',100,'Profile','Show an optional tag next to your name.',{}],
 ['cursor','Neon Cursor',150,'Extras','A cyan custom cursor on iLiam.',{}],
 ['texture','Starfield Texture',150,'Extras','Decorate your iLiam background.',{}],
 ['wallpaper','iDot Wallpaper',75,'Downloads','Download an iDot PNG wallpaper.',{}]
];
let user=null,wallet=null,appearance={...defaultAppearance},stops=[],generation=0,error='',busy=false,category='All';
const store=document.getElementById('liam-shop'),custom=document.getElementById('liam-customize');
const balance=document.createElement('a');balance.className='lc-balance';balance.href='store.html';balance.hidden=true;document.body.append(balance);
const style=document.createElement('link');style.rel='stylesheet';style.href='liam-economy.css';document.head.append(style);
const buddy=document.createElement('div');buddy.className='lc-buddy';buddy.hidden=true;buddy.setAttribute('aria-hidden','true');document.body.append(buddy);
let lastX=innerWidth/2,lastY=innerHeight/2,bx=lastX,by=lastY,frame=0;
const motion=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer:fine)');
function eyes(root,x,y){
 root.querySelectorAll('.idot-pupil').forEach(p=>{p.setAttribute('cx',Number(p.dataset.x)+x);p.setAttribute('cy',Number(p.dataset.y)+y)});
}
function tick(){
 frame=0;
 if(buddy.hidden||motion.matches||!fine.matches)return;
 bx+=(lastX+24-bx)*.14;by+=(lastY+25-by)*.14;
 buddy.style.transform='translate('+Math.min(innerWidth-65,Math.max(0,bx))+'px,'+Math.min(innerHeight-65,Math.max(0,by))+'px)';
 eyes(buddy,Math.max(-3,Math.min(3,(lastX-bx)/15)),Math.max(-3,Math.min(3,(lastY-by)/15)));
 if(Math.abs(lastX+24-bx)+Math.abs(lastY+25-by)>.4)frame=requestAnimationFrame(tick);
}
addEventListener('pointermove',e=>{
 if(e.pointerType==='touch'||motion.matches)return;lastX=e.clientX;lastY=e.clientY;
 document.querySelectorAll('.lc-dot-preview').forEach(el=>{const r=el.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;const n=Math.max(1,Math.hypot(dx,dy));eyes(el,dx/n*3,dy/n*3)});
 if(!buddy.hidden&&!frame)frame=requestAnimationFrame(tick);
},{passive:true});
function has(id){return wallet?.owned?.includes(id)===true;}
function apply(){
 balance.hidden=!user||!wallet;balance.textContent=wallet?wallet.balance.toLocaleString()+' LC':'';
 balance.setAttribute('aria-label','Liam Coins balance and store');
 const b=document.getElementById('profileButton');if(b){let t=b.querySelector('.lc-profile-balance');if(!t){t=document.createElement('span');t.className='lc-profile-balance';b.append(t)}t.textContent=wallet?' · '+wallet.balance+' LC':''}
 buddy.hidden=!(user&&has('follower')&&appearance.follower&&fine.matches&&!motion.matches);
 if(!buddy.hidden){buddy.innerHTML=dotSVG(appearance);if(!frame)frame=requestAnimationFrame(tick)}
 document.body.classList.toggle('lc-cursor',has('cursor')&&appearance.cursor);
 document.body.classList.toggle('lc-texture',has('texture')&&appearance.texture);
}
motion.addEventListener?.('change',apply);fine.addEventListener?.('change',apply);
function element(tag,txt,cls){const e=document.createElement(tag);if(txt)e.textContent=txt;if(cls)e.className=cls;return e;}
function button(txt,fn,disabled=false){const b=element('button',txt,'lc-button');b.type='button';b.disabled=disabled;b.onclick=fn;return b;}
function svgImage(s){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s)})}
async function png(id,config,w=280,h=180){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
 const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#102a55');g.addColorStop(1,'#38165f');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#b9d7ff';for(let i=0;i<22;i++){ctx.globalAlpha=.35;ctx.fillRect((i*83+17)%w,(i*41+11)%h,2,2)}ctx.globalAlpha=1;
 if(id==='texture'){for(let i=0;i<60;i++){ctx.fillStyle=i%2?'#a9d9ff':'#dcafff';ctx.fillRect((i*73)%w,(i*37)%h,i%3+1,i%3+1)}}
 else if(['gradient','username','tag'].includes(id)){ctx.font='bold '+Math.round(w/9)+'px Verdana';ctx.textAlign='center';const t=ctx.createLinearGradient(0,0,w,0);t.addColorStop(0,'#45d9ff');t.addColorStop(1,'#e8a1ff');ctx.fillStyle=id==='gradient'?t:'#68dfff';ctx.fillText(id==='tag'?'iDot Club':id==='username'?'@username':'Display Name',w/2,h*.57)}
 else if(id==='cursor'){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.fillStyle='#31cfff';ctx.beginPath();ctx.moveTo(w*.4,h*.2);ctx.lineTo(w*.4,h*.79);ctx.lineTo(w*.51,h*.65);ctx.lineTo(w*.59,h*.79);ctx.lineTo(w*.65,h*.74);ctx.lineTo(w*.55,h*.58);ctx.lineTo(w*.68,h*.55);ctx.closePath();ctx.fill();ctx.stroke()}
 else {const img=await svgImage(dotSVG(config));const size=Math.min(w,h)*.8;ctx.drawImage(img,(w-size)/2,(h-size)/2,size,size);if(id==='frame'){ctx.strokeStyle='#ffd65e';ctx.lineWidth=7;ctx.beginPath();ctx.arc(w/2,h/2,size*.44,0,Math.PI*2);ctx.stroke()}if(id==='follower'){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(w*.77,h*.68);ctx.lineTo(w*.77,h*.90);ctx.lineTo(w*.82,h*.83);ctx.lineTo(w*.87,h*.88);ctx.lineTo(w*.89,h*.84);ctx.lineTo(w*.84,h*.79);ctx.lineTo(w*.91,h*.79);ctx.closePath();ctx.fill()}}
 return canvas.toDataURL('image/png');
}
const previews=new Map();
function thumbnail(id,c){if(!previews.has(id))previews.set(id,png(id,c));return previews.get(id)}
function status(root){if(error)root.append(element('p',error,'lc-error'))}
function shop(){
 if(!store)return;store.replaceChildren();
 const intro=element('div','','lc-intro');intro.append(element('h2','Liam Store'),element('p','Earn Liam Coins and unlock cosmetics, companions and downloads.'));
 if(!user){const link=element('a','Sign in through Community');link.href='community.html';intro.append(link)}
 else if(wallet)intro.append(element('strong',wallet.balance+' Liam Coins (LC)'));
 else intro.append(element('p','Loading your wallet…'));
 store.append(intro);status(store);
 const filters=element('div','','lc-filters');for(const name of ['All','iDot','Profile','Extras','Downloads']){const b=button(name,()=>{category=name;shop()});b.setAttribute('aria-pressed',String(category===name));filters.append(b)}store.append(filters);
 const grid=element('div','','lc-grid');for(const [id,name,price,group,desc,c] of catalog){if(category!=='All'&&group!==category)continue;const card=element('article','','lc-card'),img=element('img');img.alt=name;img.width=280;img.height=180;thumbnail(id,c).then(src=>img.src=src).catch(()=>{});card.append(img,element('h3',name),element('p',desc),element('strong',price+' LC'));
 if(has(id)){if(id==='wallpaper')card.append(button('Download PNG',async()=>{const a=element('a');a.download='idot-wallpaper.png';a.href=await png(id,appearance,1920,1080);a.click()}));else {const a=element('a','Owned · Customize in profile');a.href='community.html?customize=1';card.append(a)}}else card.append(button(wallet&&wallet.balance<price?'Not enough LC':'Buy',()=>buy(id,price),!wallet||busy||wallet.balance<price));grid.append(card)}store.append(grid);
}
function customize(){
 if(!custom)return;custom.replaceChildren();if(!user)return;
 custom.append(element('h3','Liam Coins & Profile Customization'),element('p',wallet?wallet.balance+' LC':'Loading wallet…'));status(custom);
 const link=element('a','Visit Liam Store','lc-button');link.href='store.html';custom.append(link);
 const preview=element('div','','lc-dot-preview');preview.innerHTML=dotSVG(appearance);custom.append(preview);
 const controls=element('div','','lc-controls');
 function toggle(id,label,free=false){const row=element('label','','lc-option'),input=element('input');input.type='checkbox';input.checked=appearance[id]===true;input.disabled=busy||!wallet||(!free&&!has(id));input.onchange=()=>equip({[id]:input.checked});row.append(input,document.createTextNode(label+(free||has(id)?'':' (locked)')));controls.append(row)}
 toggle('avatar','Use iDot as profile picture (free)',true);
 const colors=element('label','iDot color '),select=element('select');for(const id of ['blue','purple','green','gold']){const option=element('option',id+(id==='blue'||has(id)?'':' (locked)'));option.value=id;option.disabled=id!=='blue'&&!has(id);select.append(option)}select.value=appearance.color;select.disabled=busy||!wallet;select.onchange=()=>equip({color:select.value});colors.append(select);controls.append(colors);
 for(const [id,label] of [['glasses','Sunglasses'],['hat','Beanie'],['follower','iDot assistant follows cursor'],['frame','Golden profile frame'],['gradient','Gradient display name'],['username','Blue username'],['tag','iDot Club tag'],['cursor','Neon cursor'],['texture','Starfield texture']])toggle(id,label);
 custom.append(controls,element('p','Eye tracking is included with every live iDot. The assistant uses exactly the same color and accessories as your iDot avatar.'));
 const ach=element('div','','lc-achievements');ach.append(element('h4','Achievements'));
 for(const [id,label,amount] of [['firstPost','Publish your first post',25],['featured','Get a featured post',150]])ach.append(button(wallet?.claims?.includes(id)?label+' · Claimed':label+' · Claim '+amount+' LC',()=>claim(id,amount),!wallet||busy||wallet.claims.includes(id)));
 custom.append(ach);
}
function render(){apply();shop();customize();}
async function operate(fn){if(busy||!user)return;const g=generation;busy=true;error='';render();try{await fn()}catch(e){if(g===generation)error=e.message||String(e)}finally{if(g===generation){busy=false;render()}}}
async function buy(id,price){if(!confirm('Purchase '+catalog.find(x=>x[0]===id)[1]+' for '+price+' LC?'))return;return operate(async()=>{const ref=doc(db,'liamWallets',user.uid);await runTransaction(db,async tx=>{const s=await tx.get(ref),w=s.data();if(!w||w.owned.includes(id))throw Error('Already owned or unavailable.');if(w.balance<price)throw Error('Not enough Liam Coins.');tx.update(ref,{balance:w.balance-price,owned:[...w.owned,id],action:id,postId:''})})})}
async function equip(changes){return operate(async()=>{await updateDoc(doc(db,'profiles',user.uid),{liamAppearance:{...appearance,...changes}})})}
async function claim(id,amount){return operate(async()=>{const uid=user.uid;const constraints=[where('uid','==',uid)];if(id==='featured')constraints.push(where('featured','==',true));const posts=await getDocs(query(collection(db,'posts'),...constraints,limit(1)));if(posts.empty)throw Error('You have not earned this achievement yet.');const ref=doc(db,'liamWallets',uid);await runTransaction(db,async tx=>{const w=(await tx.get(ref)).data();if(w.claims.includes(id))throw Error('Already claimed.');tx.update(ref,{balance:w.balance+amount,claims:[...w.claims,id],action:id,postId:posts.docs[0].id})})})}
onAuthStateChanged(auth,async current=>{
 const g=++generation;stops.forEach(s=>s());stops=[];user=current;wallet=null;appearance={...defaultAppearance};busy=false;error='';render();if(!current)return;
 const profileRef=doc(db,'profiles',current.uid),ref=doc(db,'liamWallets',current.uid);
 let started=false;
 stops.push(onSnapshot(profileRef,async p=>{
  if(g!==generation||!p.exists())return;
  appearance={...defaultAppearance,...p.data().liamAppearance};render();if(started)return;started=true;
  try{await runTransaction(db,async tx=>{const w=await tx.get(ref);if(!w.exists())tx.set(ref,{balance:100,owned:[],claims:[],action:'starter',postId:''})});if(g!==generation)return;
   stops.push(onSnapshot(ref,s=>{if(g!==generation)return;wallet=s.data()||null;render()},e=>{if(g===generation){error='Wallet unavailable: '+e.message;render()}}));
  }catch(e){if(g===generation){error='Liam Coins unavailable. The updated Firestore rules may need deployment. '+e.message;render()}}
 },e=>{if(g===generation){error=e.message;render()}}));
});
if(custom&&new URLSearchParams(location.search).get('customize')==='1'){const timer=setInterval(()=>{if(user&&wallet){clearInterval(timer);document.getElementById('profileButton')?.click();custom.scrollIntoView({block:'nearest'})}},250);setTimeout(()=>clearInterval(timer),15000)}
render();
