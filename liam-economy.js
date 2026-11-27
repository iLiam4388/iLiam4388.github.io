import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {getFirestore,doc,getDoc,onSnapshot,runTransaction,updateDoc,collection,query,where,limit,getDocs,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
import {defaultAppearance,dotSVG,appearanceForProfile} from './idot-render.js?v=3';
import {expansion,expansionById,slotFor,rarityFor,describe,cursorSvg,buddySVG,profileClasses,themeVars} from './liam-expansion.js?v=1';
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
 ['texture','Starfield Texture',150,'Extras','Transform backgrounds, buttons, reviews, posts and panels with a cosmic theme.',{}],
 ['wallpaper','iDot Wallpaper',75,'Downloads','Download an iDot PNG wallpaper.',{}]
];
const achievements=[
 {
  "id": "firstPost",
  "name": "First Post",
  "description": "Publish your first community post",
  "reward": 25,
  "kind": "post",
  "target": 1
 },
 {
  "id": "artist",
  "name": "Artist",
  "description": "Share an image in a post",
  "reward": 50,
  "kind": "image",
  "target": 1
 },
 {
  "id": "messages50",
  "name": "Chatter",
  "description": "Send 50 messages",
  "reward": 50,
  "kind": "messages",
  "target": 50
 },
 {
  "id": "messages100",
  "name": "Conversation Pro",
  "description": "Send 100 messages",
  "reward": 100,
  "kind": "messages",
  "target": 100
 },
 {
  "id": "messages10",
  "name": "Icebreaker",
  "description": "Send 10 messages",
  "reward": 10,
  "kind": "messages",
  "target": 10
 },
 {
  "id": "messages25",
  "name": "Getting Chatty",
  "description": "Send 25 messages",
  "reward": 25,
  "kind": "messages",
  "target": 25
 },
 {
  "id": "messages150",
  "name": "Social Butterfly",
  "description": "Send 150 messages",
  "reward": 75,
  "kind": "messages",
  "target": 150
 },
 {
  "id": "messages250",
  "name": "Regular",
  "description": "Send 250 messages",
  "reward": 100,
  "kind": "messages",
  "target": 250
 },
 {
  "id": "messages500",
  "name": "Chatterbox",
  "description": "Send 500 messages",
  "reward": 150,
  "kind": "messages",
  "target": 500
 },
 {
  "id": "messages750",
  "name": "Wordsmith",
  "description": "Send 750 messages",
  "reward": 200,
  "kind": "messages",
  "target": 750
 },
 {
  "id": "messages1000",
  "name": "Conversation Champion",
  "description": "Send 1,000 messages",
  "reward": 250,
  "kind": "messages",
  "target": 1000
 },
 {
  "id": "messages2000",
  "name": "Messaging Master",
  "description": "Send 2,000 messages",
  "reward": 350,
  "kind": "messages",
  "target": 2000
 },
 {
  "id": "messages5000",
  "name": "Talk of the Town",
  "description": "Send 5,000 messages",
  "reward": 500,
  "kind": "messages",
  "target": 5000
 },
 {
  "id": "messages10000",
  "name": "Living Legend",
  "description": "Send 10,000 messages",
  "reward": 750,
  "kind": "messages",
  "target": 10000
 },
 {
  "id": "votes1",
  "name": "First Fan",
  "description": "Receive 1 upvotes on one post",
  "reward": 10,
  "kind": "votes",
  "target": 1
 },
 {
  "id": "votes5",
  "name": "Crowd Pleaser",
  "description": "Receive 5 upvotes on one post",
  "reward": 20,
  "kind": "votes",
  "target": 5
 },
 {
  "id": "votes10",
  "name": "Rising Star",
  "description": "Receive 10 upvotes on one post",
  "reward": 30,
  "kind": "votes",
  "target": 10
 },
 {
  "id": "votes25",
  "name": "Trending",
  "description": "Receive 25 upvotes on one post",
  "reward": 60,
  "kind": "votes",
  "target": 25
 },
 {
  "id": "votes50",
  "name": "Community Favorite",
  "description": "Receive 50 upvotes on one post",
  "reward": 100,
  "kind": "votes",
  "target": 50
 },
 {
  "id": "votes75",
  "name": "Spotlight",
  "description": "Receive 75 upvotes on one post",
  "reward": 150,
  "kind": "votes",
  "target": 75
 },
 {
  "id": "votes100",
  "name": "Going Viral",
  "description": "Receive 100 upvotes on one post",
  "reward": 200,
  "kind": "votes",
  "target": 100
 },
 {
  "id": "votes250",
  "name": "Internet Sensation",
  "description": "Receive 250 upvotes on one post",
  "reward": 400,
  "kind": "votes",
  "target": 250
 },
 {
  "id": "video",
  "name": "Filmmaker",
  "description": "Publish a post with a video",
  "reward": 50,
  "kind": "video",
  "target": 1
 },
 {
  "id": "gallery2",
  "name": "Gallery Curator",
  "description": "Share two images in one post",
  "reward": 40,
  "kind": "image",
  "target": 2
 },
 {
  "id": "gallery3",
  "name": "Photo Exhibition",
  "description": "Share three images in one post",
  "reward": 60,
  "kind": "image",
  "target": 3
 },
 {
  "id": "mixedMedia",
  "name": "Mixed Media",
  "description": "Share an image and a video in one post",
  "reward": 75,
  "kind": "mixed",
  "target": 1
 },
 {
  "id": "video2",
  "name": "Double Feature",
  "description": "Share two videos in one post",
  "reward": 60,
  "kind": "video",
  "target": 2
 },
 {
  "id": "owned1",
  "name": "First Purchase",
  "description": "Own 1 different store or cosmetic items",
  "reward": 10,
  "kind": "owned",
  "target": 1
 },
 {
  "id": "owned2",
  "name": "Window Shopper",
  "description": "Own 2 different store or cosmetic items",
  "reward": 15,
  "kind": "owned",
  "target": 2
 },
 {
  "id": "owned3",
  "name": "Collector",
  "description": "Own 3 different store or cosmetic items",
  "reward": 25,
  "kind": "owned",
  "target": 3
 },
 {
  "id": "owned5",
  "name": "Treasure Hunter",
  "description": "Own 5 different store or cosmetic items",
  "reward": 40,
  "kind": "owned",
  "target": 5
 },
 {
  "id": "owned7",
  "name": "Cosmetic Enthusiast",
  "description": "Own 7 different store or cosmetic items",
  "reward": 60,
  "kind": "owned",
  "target": 7
 },
 {
  "id": "owned10",
  "name": "Master Collector",
  "description": "Own 10 different store or cosmetic items",
  "reward": 100,
  "kind": "owned",
  "target": 10
 },
 {
  "id": "owned13",
  "name": "Completionist",
  "description": "Own 13 different store or cosmetic items",
  "reward": 200,
  "kind": "owned",
  "target": 13
 },
 {
  "id": "age7",
  "name": "One Week In",
  "description": "Have an account for 7 days",
  "reward": 15,
  "kind": "age",
  "target": 7
 },
 {
  "id": "age14",
  "name": "Two Weeks Strong",
  "description": "Have an account for 14 days",
  "reward": 20,
  "kind": "age",
  "target": 14
 },
 {
  "id": "age30",
  "name": "Month of iLiam",
  "description": "Have an account for 30 days",
  "reward": 40,
  "kind": "age",
  "target": 30
 },
 {
  "id": "age60",
  "name": "Familiar Face",
  "description": "Have an account for 60 days",
  "reward": 60,
  "kind": "age",
  "target": 60
 },
 {
  "id": "age90",
  "name": "Quarter Year Club",
  "description": "Have an account for 90 days",
  "reward": 90,
  "kind": "age",
  "target": 90
 },
 {
  "id": "age180",
  "name": "Half-Year Hero",
  "description": "Have an account for 180 days",
  "reward": 150,
  "kind": "age",
  "target": 180
 },
 {
  "id": "age365",
  "name": "iLiam Veteran",
  "description": "Have an account for 365 days",
  "reward": 250,
  "kind": "age",
  "target": 365
 },
 {
  "id": "age730",
  "name": "Two-Year Legend",
  "description": "Have an account for 730 days",
  "reward": 500,
  "kind": "age",
  "target": 730
 },
 {
  "id": "styleDuo",
  "name": "Fashion Icon",
  "description": "Own iDot sunglasses and beanie",
  "reward": 35,
  "kind": "items",
  "target": [
   "glasses",
   "hat"
  ]
 },
 {
  "id": "colorCollector",
  "name": "Color Collector",
  "description": "Own all three premium iDot colors",
  "reward": 60,
  "kind": "items",
  "target": [
   "purple",
   "green",
   "gold"
  ]
 },
 {
  "id": "buddyOwner",
  "name": "Best Buddies",
  "description": "Own the iDot Assistant",
  "reward": 50,
  "kind": "items",
  "target": [
   "follower"
  ]
 },
 {
  "id": "cursorOwner",
  "name": "Pointer Power",
  "description": "Own the Neon Cursor",
  "reward": 25,
  "kind": "items",
  "target": [
   "cursor"
  ]
 },
 {
  "id": "textureOwner",
  "name": "Star Explorer",
  "description": "Own the Starfield Texture",
  "reward": 25,
  "kind": "items",
  "target": [
   "texture"
  ]
 },
 {
  "id": "wallpaperOwner",
  "name": "Desktop Decorator",
  "description": "Own the iDot Wallpaper",
  "reward": 15,
  "kind": "items",
  "target": [
   "wallpaper"
  ]
 },
 {
  "id": "frameOwner",
  "name": "Picture Perfect",
  "description": "Own the Golden Profile Frame",
  "reward": 20,
  "kind": "items",
  "target": [
   "frame"
  ]
 },
 {
  "id": "gradientOwner",
  "name": "Colorful Character",
  "description": "Own the Gradient Display Name",
  "reward": 25,
  "kind": "items",
  "target": [
   "gradient"
  ]
 },
 {
  "id": "usernameOwner",
  "name": "True Blue",
  "description": "Own the Blue Username",
  "reward": 15,
  "kind": "items",
  "target": [
   "username"
  ]
 },
 {
  "id": "tagOwner",
  "name": "Club Member",
  "description": "Own the iDot Club Tag",
  "reward": 20,
  "kind": "items",
  "target": [
   "tag"
  ]
 },
 {
  "id": "extrasCollector",
  "name": "Extra Everything",
  "description": "Own the four original Liam Store extras",
  "reward": 100,
  "kind": "items",
  "target": [
   "follower",
   "cursor",
   "texture",
   "wallpaper"
  ]
 },
 {
  "id": "profileCollector",
  "name": "Profile Perfection",
  "description": "Own the four original profile appearance items",
  "reward": 80,
  "kind": "items",
  "target": [
   "frame",
   "gradient",
   "username",
   "tag"
  ]
 }
];
catalog.push(...expansion.map(r=>[r[0],r[1],r[2],r[3],describe(r),r[3]==='iDot'?{accessory:r[0]}:{}]));
const achievementById=new Map(achievements.map(a=>[a.id,a]));
let profileCreatedAt=null,achievementFilter='All';
let user=null,wallet=null,appearance={...defaultAppearance},stops=[],generation=0,error='',busy=false,category='All',profileTab='idot',dailyTimer=0,messageCount=0,rareGranted=false;
const store=document.getElementById('liam-shop'),custom=document.getElementById('liam-customize');
const balance=document.createElement('a');balance.className='lc-balance';balance.href='community.html?earn=1';balance.hidden=true;document.body.append(balance);
const style=document.createElement('link');style.rel='stylesheet';style.href='liam-economy.css?v=4';document.head.append(style);
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
const storeIds=new Set(['follower','cursor','texture','wallpaper',...expansion.filter(r=>!['iDot','Profile'].includes(r[3])).map(r=>r[0])]);
const equipped=id=>slotFor(id)?appearance[slotFor(id)]===id:appearance[id]===true;
function switchItem(id){const slot=slotFor(id);if(!slot)return equip({[id]:!appearance[id],...(id==='cursor'?{cursorStyle:''}:id==='texture'?{themeStyle:''}:id==='follower'?{buddyStyle:''}:id==='hat'?{accessory:'',favicon:false}:id==='frame'?{borderStyle:''}:id==='gradient'?{nameStyle:''}:id==='username'?{handleStyle:''}:{})});const changes={[slot]:equipped(id)?'':id};if(slot==='cursorStyle')changes.cursor=false;if(slot==='themeStyle')changes.texture=false;if(slot==='buddyStyle')changes.follower=false;if(slot==='accessory'&&!equipped(id)){changes.hat=false;changes.favicon=false;}if(slot==='borderStyle')changes.frame=false;if(slot==='nameStyle')changes.gradient=false;if(slot==='handleStyle')changes.username=false;return equip(changes);}
function dailyReady(){return !!wallet&&(!wallet.lastDaily||Date.now()-wallet.lastDaily.toMillis()>=86400000);}
function has(id){return wallet?.owned?.includes(id)===true;}
function apply(){
 balance.hidden=!user||!wallet;balance.textContent=wallet?wallet.balance.toLocaleString()+' LC':'';
 balance.setAttribute('aria-label','Liam Coins balance and ways to earn');
 const b=document.getElementById('profileButton');if(b){let t=b.querySelector('.lc-profile-balance');if(!t){t=document.createElement('span');t.className='lc-profile-balance';b.append(t)}t.textContent=wallet?' · '+wallet.balance.toLocaleString()+' LC':''}
 const otherBuddy=has(appearance.buddyStyle)?buddySVG(appearance.buddyStyle):'';
 buddy.hidden=!(user&&(otherBuddy||has('follower')&&appearance.follower)&&fine.matches&&!motion.matches);
 if(!buddy.hidden){buddy.innerHTML=otherBuddy||dotSVG(appearance);if(!frame)frame=requestAnimationFrame(tick)}
 const cursor=has(appearance.cursorStyle)?cursorSvg(appearance.cursorStyle):'';
 document.body.classList.toggle('lc-new-cursor',!!cursor);
 document.body.style.setProperty('--lc-custom-cursor',cursor?'url("data:image/svg+xml,'+encodeURIComponent(cursor)+'") '+(['cursorStar','cursorIce','cursorFire','cursorDot'].includes(appearance.cursorStyle)?'16 16':'3 3')+', auto':'auto');
 document.body.classList.toggle('lc-cursor',!cursor&&has('cursor')&&appearance.cursor);
 const theme=has(appearance.themeStyle)?themeVars(appearance.themeStyle):null;
 document.body.classList.toggle('lc-texture',!!theme||has('texture')&&appearance.texture);
 document.body.classList.toggle('lc-expanded-theme',!!theme);
 for(const key of ['bg','panel','accent','light','pattern','size']){if(theme)document.body.style.setProperty('--lc-theme-'+key,theme[key]);else document.body.style.removeProperty('--lc-theme-'+key);}

}
motion.addEventListener?.('change',apply);fine.addEventListener?.('change',apply);
function element(tag,txt,cls){const e=document.createElement(tag);if(txt)e.textContent=txt;if(cls)e.className=cls;return e;}
function button(txt,fn,disabled=false){const b=element('button',txt,'lc-button');b.type='button';b.disabled=disabled;b.onclick=fn;return b;}
function svgImage(s){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s)})}
async function png(id,config,w=280,h=180){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
 const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#102a55');g.addColorStop(1,'#38165f');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#b9d7ff';for(let i=0;i<22;i++){ctx.globalAlpha=.35;ctx.fillRect((i*83+17)%w,(i*41+11)%h,2,2)}ctx.globalAlpha=1;
 const extra=expansionById.get(id);
 if(extra?.[3]==='Cursors'||extra?.[3]==='Buddies'||extra?.[3]==='iDot'){
  const svg=extra[3]==='Cursors'?cursorSvg(id):extra[3]==='Buddies'?buddySVG(id):dotSVG({accessory:id});const image=await svgImage(svg);const size=Math.min(w,h)*.78;ctx.drawImage(image,(w-size)/2,(h-size)/2,size,size);return canvas.toDataURL('image/png');
 }
 if(extra?.[3]==='Textures'||id==='packGalaxy'){
  const v=themeVars(extra?.[3]==='Textures'?id:'themeGalaxy');ctx.fillStyle=v.bg;ctx.fillRect(0,0,w,h);const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,v.bg);grad.addColorStop(1,v.panel);ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);ctx.fillStyle=v.light;for(let i=0;i<45;i++){ctx.globalAlpha=.4;ctx.fillRect((i*73+13)%w,(i*41+19)%h,2+i%2,2+i%2)}ctx.globalAlpha=1;ctx.fillStyle=v.panel;ctx.fillRect(w*.07,h*.40,w*.86,h*.50);ctx.strokeStyle=v.light;ctx.strokeRect(w*.07,h*.40,w*.86,h*.50);ctx.fillStyle=v.light;ctx.font='bold '+Math.round(h*.11)+'px Verdana';ctx.textAlign='center';ctx.fillText('iLiam',w*.5,h*.20);for(let i=0;i<3;i++){ctx.fillStyle=v.accent;ctx.fillRect(w*(.07+i*.29),h*.25,w*.27,h*.11)}ctx.textAlign='left';ctx.fillStyle=v.light;ctx.font='bold '+Math.round(h*.07)+'px Verdana';ctx.fillText('REVIEWS',w*.11,h*.53);for(let i=0;i<3;i++){ctx.globalAlpha=.55;ctx.fillRect(w*.12,h*(.63+i*.075),w*(.65-i*.09),h*.025)}ctx.globalAlpha=1;return canvas.toDataURL('image/png');
 }
 if(extra?.[3]==='Profile'){
  const image=await svgImage(dotSVG({})),cx=w*.25,cy=h*.49,size=h*.56;ctx.drawImage(image,cx-size/2,cy-size/2,size,size);const color={profSilver:'#cddbe8',profNeon:'#72ffba',profSunset:'#ffac91',profMetal:'#c3d6e5',profRainbow:'#d8a1ff',profSparkles:'#ffe7a2',profBanner:'#ae93ff',profGalaxy:'#baa0ff'}[id];
  if(id==='profSilver'||id==='profRainbow'){ctx.strokeStyle=color;ctx.lineWidth=5;ctx.beginPath();ctx.arc(cx,cy,size*.44,0,Math.PI*2);ctx.stroke()}
  if(id==='profSparkles'||id==='profBanner'){ctx.fillStyle=color;for(let i=0;i<24;i++){ctx.fillRect((i*71+13)%w,(i*37+5)%h,3,3)}}
  ctx.fillStyle=color;ctx.font='bold '+Math.round(w*.065)+'px Verdana';ctx.fillText(id==='profMetal'||id==='profGalaxy'?'@username':'Display Name',w*.46,h*.45);ctx.font=Math.round(w*.046)+'px Verdana';ctx.fillText(id==='profMetal'||id==='profGalaxy'?'Display Name':'@username',w*.46,h*.59);return canvas.toDataURL('image/png');
 }
 if(id==='packSticker'||id==='packIcons'){const image=await svgImage(dotSVG({accessory:id==='packSticker'?'accHalo':'accCrown'}));const size=h*.57;ctx.drawImage(image,w*.13,h*.18,size,size);ctx.drawImage(await svgImage(dotSVG({color:'purple',accessory:'accHeart'})),w*.48,h*.27,size,size);return canvas.toDataURL('image/png');}
 if(id==='texture'){for(let i=0;i<60;i++){ctx.fillStyle=i%2?'#a9d9ff':'#dcafff';ctx.fillRect((i*73)%w,(i*37)%h,i%3+1,i%3+1)}}
 else if(['gradient','username','tag'].includes(id)){ctx.font='bold '+Math.round(w/9)+'px Verdana';ctx.textAlign='center';const t=ctx.createLinearGradient(0,0,w,0);t.addColorStop(0,'#45d9ff');t.addColorStop(1,'#e8a1ff');ctx.fillStyle=id==='gradient'?t:'#68dfff';ctx.fillText(id==='tag'?'iDot Club':id==='username'?'@username':'Display Name',w/2,h*.57)}
 else if(id==='cursor'){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.fillStyle='#31cfff';ctx.beginPath();ctx.moveTo(w*.4,h*.2);ctx.lineTo(w*.4,h*.79);ctx.lineTo(w*.51,h*.65);ctx.lineTo(w*.59,h*.79);ctx.lineTo(w*.65,h*.74);ctx.lineTo(w*.55,h*.58);ctx.lineTo(w*.68,h*.55);ctx.closePath();ctx.fill();ctx.stroke()}
 else {const img=await svgImage(dotSVG(config));const size=Math.min(w,h)*.8;ctx.drawImage(img,(w-size)/2,(h-size)/2,size,size);if(id==='frame'){ctx.strokeStyle='#ffd65e';ctx.lineWidth=7;ctx.beginPath();ctx.arc(w/2,h/2,size*.44,0,Math.PI*2);ctx.stroke()}if(id==='follower'){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(w*.77,h*.68);ctx.lineTo(w*.77,h*.90);ctx.lineTo(w*.82,h*.83);ctx.lineTo(w*.87,h*.88);ctx.lineTo(w*.89,h*.84);ctx.lineTo(w*.84,h*.79);ctx.lineTo(w*.91,h*.79);ctx.closePath();ctx.fill()}}
 return canvas.toDataURL('image/png');
}
// Store-only downloadable ZIP packs; PNGs are generated locally, no external services.
function zipBytes(files){
 const enc=new TextEncoder(),chunks=[],central=[];let offset=0,centralLen=0;
 const crc=bytes=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0)}return (n^0xffffffff)>>>0};
 for(const f of files){const name=enc.encode(f.name),bytes=f.bytes,hash=crc(bytes),local=new Uint8Array(30+name.length),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint32(14,hash,true);l.setUint32(18,bytes.length,true);l.setUint32(22,bytes.length,true);l.setUint16(26,name.length,true);local.set(name,30);
  const dir=new Uint8Array(46+name.length),d=new DataView(dir.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint32(16,hash,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);dir.set(name,46);chunks.push(local,bytes);central.push(dir);centralLen+=dir.length;offset+=local.length+bytes.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralLen,true);e.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});
}
async function downloadPack(id){
 if(!has(id))return;
 const files=[],add=async(name,url)=>{const bytes=Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0));files.push({name,bytes})};
 if(id==='packGalaxy'){for(const [i,theme] of ['themeGalaxy','themeAurora','themeMidnight'].entries()){
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const ctx=canvas.getContext('2d'),v=themeVars(theme),g=ctx.createLinearGradient(0,0,1920,1080);g.addColorStop(0,v.bg);g.addColorStop(.52,v.panel);g.addColorStop(1,v.bg);ctx.fillStyle=g;ctx.fillRect(0,0,1920,1080);
  const glow=ctx.createRadialGradient(1320,370,0,1320,370,850);glow.addColorStop(0,v.accent+'99');glow.addColorStop(1,v.bg+'00');ctx.fillStyle=glow;ctx.fillRect(0,0,1920,1080);
  for(let j=0;j<420;j++){const x=(j*197+91)%1920,y=(j*j*37+27)%1080;ctx.globalAlpha=.18+(j%7)*.11;ctx.fillStyle=j%4===0?v.light:'#fff';ctx.beginPath();ctx.arc(x,y,j%17===0?3:1.2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
  const dot=await svgImage(dotSVG({color:['purple','green','blue'][i]}));ctx.globalAlpha=.88;ctx.drawImage(dot,820,400,280,280);ctx.globalAlpha=1;await add(theme+'.png',canvas.toDataURL('image/png'));
 }}
 else if(id==='packSticker'){for(const [i,accessory] of ['accHeart','accHalo','accGamer','accCrown','accWings'].entries()){const canvas=document.createElement('canvas');canvas.width=canvas.height=512;canvas.getContext('2d').drawImage(await svgImage(dotSVG({color:['blue','purple','green','gold','blue'][i],accessory})),0,0,512,512);await add(accessory+'.png',canvas.toDataURL('image/png'));}}
 else if(id==='packIcons'){const icon=new Image();await new Promise((res,rej)=>{icon.onload=res;icon.onerror=rej;icon.src='images/favicon.png'});for(const size of [32,64,128,256,512]){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.getContext('2d').drawImage(icon,0,0,size,size);await add('iliam-'+size+'.png',canvas.toDataURL('image/png'));}}
 if(!files.length)return;const url=URL.createObjectURL(zipBytes(files));const link=element('a');link.href=url;link.download=id+'.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
const previews=new Map();
function thumbnail(id,c){if(!previews.has(id))previews.set(id,png(id,c));return previews.get(id)}
function status(root){if(error)root.append(element('p',error,'lc-error'))}
function shop(){
 if(!store)return;store.replaceChildren();
 const intro=element('div','','lc-intro');intro.append(element('h2','Liam Store'),element('p','Spend Liam Coins on assistants, cursors, textures and downloads. Customize your iDot and profile in Community.'));
 if(!user){const link=element('a','Sign in through Community');link.href='community.html';intro.append(link)}
 else if(wallet)intro.append(element('strong',wallet.balance.toLocaleString()+' Liam Coins (LC)'));
 else intro.append(element('p','Loading your wallet…'));
 const earn=element('a','How to earn Liam Coins','lc-button');earn.href='community.html?earn=1';intro.append(earn);store.append(intro);status(store);
 const filters=element('div','','lc-filters');for(const name of ['All','Cursors','Textures','Buddies','Downloads','Owned','Get iLiam Coins']){const b=button(name,()=>{if(name==='Get iLiam Coins'){document.dispatchEvent(new Event('iliam:coin-packs'));return;}category=name;shop()});b.setAttribute('aria-pressed',String(category===name));filters.append(b)}store.append(filters);
 const grid=element('div','','lc-grid');for(const [id,name,price,group,desc,c] of catalog){const displayGroup=id==='cursor'?'Cursors':id==='texture'?'Textures':id==='follower'?'Buddies':group;if(!storeIds.has(id)||(category==='Owned'?!has(id):category!=='All'&&displayGroup!==category))continue;const card=element('article','','lc-card'),img=element('img');img.alt=name;img.width=280;img.height=180;thumbnail(id,c).then(src=>img.src=src).catch(()=>{});card.append(img,element('span',rarityFor(id),'lc-item-rarity'),element('h3',name),element('p',desc),element('strong',price+' LC'));
 if(has(id)){if(id==='wallpaper')card.append(button('Download PNG',async()=>{const a=element('a');a.download='idot-wallpaper.png';a.href=await png(id,appearance,1920,1080);a.click()}));else if(group==='Downloads'){card.append(button('Download PNG pack',()=>downloadPack(id),busy));}else {card.append(button(equipped(id)?'Equipped · Turn off':'Owned · Equip',()=>switchItem(id),busy));if(id==='follower'){const a=element('a','Customize your iDot in Community');a.href='community.html?customize=1';card.append(a)}}}else card.append(button(wallet&&wallet.balance<price?'Not enough LC':'Buy',()=>buy(id,price),!wallet||busy||wallet.balance<price));grid.append(card)}store.append(grid);
}
function customize(){
 if(!custom)return;custom.replaceChildren();if(!user)return;
 const bar=element('div','','lc-filters');
 for(const [id,label] of [['idot','iDot Studio'],['profile','Profile style'],['earn','Earn LC']]){
  const b=button(label,()=>{profileTab=id;customize()});b.setAttribute('aria-pressed',String(profileTab===id));bar.append(b);
 }
 const heading=element('div','','lc-studio-heading');heading.append(element('h3','Customize your profile'),element('span',wallet?wallet.balance.toLocaleString()+' LC':'Loading…','lc-studio-coins'));custom.append(heading,bar);status(custom);
 if(!profileTab){custom.append(element('p','Open a menu to customize your profile, customize iDot, or earn Liam Coins.'));return;}
 if(profileTab==='earn'){
  custom.append(element('h4','How to earn Liam Coins'),element('p','Your account receives 100 LC once when its wallet is created. Earn more by claiming daily rewards and completing achievements.'));
  const daily=button(dailyReady()?'Claim daily reward · +10 LC':'Daily reward · '+(wallet?.lastDaily?'come back after 24 hours':'loading'),()=>claimDaily(),!dailyReady()||busy);custom.append(daily);
  const postReady=wallet&&(!wallet.lastPostReward||Date.now()-wallet.lastPostReward.toMillis()>=3600000);
  custom.append(element('h4','Repeatable rewards'));
  custom.append(button(postReady?'Publish a post · Claim +5 LC':'Post reward · available after one hour',()=>claim('postReward',5),!postReady||busy));
  custom.append(button('Featured post · Claim +150 LC per post',()=>claim('featuredReward',150),!wallet||busy));
  custom.append(element('p','Each post can be rewarded once. Regular post rewards are limited to one per hour to discourage spam.'));
  custom.append(element('h4','Achievements · '+achievements.filter(a=>wallet?.claims?.includes(a.id)).length+'/'+achievements.length));
  const groupFor=a=>a.kind==='messages'?'Messages':['votes','post'].includes(a.kind)?'Community':['image','video','mixed'].includes(a.kind)?'Creativity':a.kind==='age'?'Milestones':'Collection';
  const filters=element('div','','lc-filters');for(const name of ['All','Community','Messages','Creativity','Collection','Milestones']){const b=button(name,()=>{achievementFilter=name;customize()});b.setAttribute('aria-pressed',String(name===achievementFilter));filters.append(b)}custom.append(filters);
  const list=element('div','','lc-achievements');
  for(const a of achievements){
   if(achievementFilter!=='All'&&groupFor(a)!==achievementFilter)continue;
   const claimed=wallet?.claims?.includes(a.id);let progress=null;
   if(a.kind==='messages')progress=messageCount;
   if(a.kind==='owned')progress=wallet?.owned?.length||0;
   if(a.kind==='age')progress=profileCreatedAt?Math.max(0,Math.floor((Date.now()-profileCreatedAt)/86400000)):0;
   if(a.kind==='items')progress=a.target.filter(has).length;
   const target=Array.isArray(a.target)?a.target.length:a.target;
   const row=element('div','','lc-achievement-row');const info=element('div');
   info.append(element('strong',a.name),element('p',a.description+(progress===null?'':' · '+Math.min(progress,target)+'/'+target)));
   row.append(info,button(claimed?'Claimed':'+'+a.reward+' LC · Claim',()=>claim(a.id,a.reward),!wallet||busy||claimed||(progress!==null&&progress<target)));
   list.append(row);
  }
  custom.append(list);
  return;
 }
 const isDot=profileTab==='idot';
 const hero=element('div','','lc-studio-hero');
 if(isDot){
  const live=element('div','','lc-dot-preview');live.innerHTML=dotSVG(appearance);
  const info=element('div','','lc-studio-info');info.append(element('span','LIVE PREVIEW','lc-eyebrow'),element('h4','Your iDot'),element('p','Move your cursor to see its eyes follow you. Your avatar and assistant share this appearance.'));
  const avatar=button(appearance.avatar?'iDot profile picture · On':'Use iDot as profile picture',()=>equip({avatar:!appearance.avatar}),busy||!wallet);
  avatar.setAttribute('aria-pressed',String(appearance.avatar));info.append(avatar);if(rareGranted)info.append(element('p','Exclusive unlocked: iLiam Icon Crown','lc-rare-label'));hero.append(live,info);
 }else{
  const live=element('div','','lc-identity-preview');const picture=element('img');picture.alt='Avatar preview';picture.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(dotSVG(appearance));picture.className=appearance.frame?'lc-frame':'';
  const name=element('strong','Display Name',appearance.gradient?'lc-preview-gradient':'');const handle=element('span','@username',appearance.username?'lc-blue-name':'');
  live.append(picture,name,handle);profileClasses(live,appearance);if(appearance.tag)live.append(element('span','iDot Club','lc-public-tag'));
  const info=element('div','','lc-studio-info');info.append(element('span','PROFILE PREVIEW','lc-eyebrow'),element('h4','Your public style'),element('p','Choose how your name and avatar look to the community.'));hero.append(live,info);
 }
 custom.append(hero);
 const grid=element('div','','lc-cosmetic-grid');
 function tile(id,name,price,desc,config,owned,active,onAction,rare=false){
  const item=element('article','','lc-cosmetic'+(active?' lc-cosmetic-selected':'')+(rare?' lc-cosmetic-rare':''));
  const img=element('img');img.alt=name+' preview';img.width=280;img.height=180;
  thumbnail(id,config).then(src=>img.src=src).catch(()=>{});
  item.append(img,element('h4',name),element('p',desc));
  if(rare)item.append(element('span','ULTRA RARE · INVITE ONLY','lc-rare-label'));
  else item.append(element('span',rarityFor(id)+' · '+(owned?'Owned':price+' LC'),'lc-item-price'));
  const disabled=busy||!wallet||(!owned&&wallet.balance<price);
  const b=button(owned?(active?'Equipped · Unequip':'Equip'):wallet&&wallet.balance<price?'Not enough LC':'Unlock',onAction,disabled||(id==='blue'&&active));b.setAttribute('aria-pressed',String(active));item.append(b);grid.append(item);
 }
 if(isDot&&rareGranted)tile('favicon','iLiam Icon Crown',0,'A special iLiam favicon worn above your iDot. Awarded to selected accounts.',{favicon:true},true,appearance.favicon===true,()=>equip({favicon:!appearance.favicon,...(!appearance.favicon?{accessory:'',hat:false}:{})}),true);
 if(isDot)tile('blue','Classic Blue',0,'The original iDot.',{color:'blue'},true,appearance.color==='blue',()=>equip({color:'blue'}));
 for(const [id,name,price,group,desc,config] of catalog){
  if(storeIds.has(id)||group!==(isDot?'iDot':'Profile'))continue;
  const color=['purple','green','gold'].includes(id);
  const active=color?appearance.color===id:equipped(id);
  tile(id,name,price,desc,config,has(id),active,()=>has(id)?(color?equip({color:active?'blue':id}):switchItem(id)):buy(id,price));
 }

 custom.append(element('h4',isDot?'iDot collection':'Profile cosmetics','lc-section-heading'),grid);

}
function render(){apply();shop();customize();}
async function operate(fn){if(busy||!user)return;const g=generation;busy=true;error='';render();try{await fn()}catch(e){if(g===generation)error=e.message||String(e)}finally{if(g===generation){busy=false;render()}}}
async function buy(id,price){if(!confirm('Purchase '+catalog.find(x=>x[0]===id)[1]+' for '+price+' LC?'))return;return operate(async()=>{const ref=doc(db,'liamWallets',user.uid);await runTransaction(db,async tx=>{const s=await tx.get(ref),w=s.data();if(!w||w.owned.includes(id))throw Error('Already owned or unavailable.');if(w.balance<price)throw Error('Not enough Liam Coins.');tx.update(ref,{balance:w.balance-price,owned:[...w.owned,id],action:id,postId:''})})})}
async function equip(changes){return operate(async()=>{const next={...appearance,...changes};if(!rareGranted){if(next.favicon===true)throw Error('This exclusive item has not been granted to your account.');delete next.favicon;}await updateDoc(doc(db,'profiles',user.uid),{liamAppearance:next})})}
async function claimDaily(){return operate(async()=>{const ref=doc(db,'liamWallets',user.uid);await runTransaction(db,async tx=>{const w=(await tx.get(ref)).data();if(w.lastDaily&&Date.now()-w.lastDaily.toMillis()<86400000)throw Error('Daily reward already claimed. Try again after 24 hours.');tx.update(ref,{balance:w.balance+10,action:'daily',postId:'',lastDaily:serverTimestamp()})})})}
async function claim(id,amount){return operate(async()=>{
 const uid=user.uid;let postId='';
 const repeat=id==='postReward'||id==='featuredReward';
 const a=achievementById.get(id);
 if(repeat||a&&['post','image','video','mixed','votes'].includes(a.kind)){
  const posts=await getDocs(query(collection(db,'posts'),where('uid','==',uid),limit(250)));
  const eligible=posts.docs.filter(p=>{
   const data=p.data(),raw=data.text||'';
   if(id==='featuredReward'&&data.featured!==true)return false;
   if(a?.kind==='votes'&&Number(data.upvotes||0)<a.target)return false;
   const images=(raw.match(/⟦iLiam-media:v1:Image:[^⟧]+⟧/g)||[]).length;
   const videos=(raw.match(/⟦iLiam-media:v1:Video:[^⟧]+⟧/g)||[]).length;
   if(a?.kind==='image'&&images<a.target)return false;
   if(a?.kind==='video'&&videos<a.target)return false;
   if(a?.kind==='mixed'&&(!images||!videos))return false;
   return !repeat||!wallet.claims.includes(id+':'+p.id);
  });
  if(!eligible.length)throw Error('No eligible unclaimed post yet.');
  postId=eligible[0].id;
 }
 const ref=doc(db,'liamWallets',uid),key=repeat?id+':'+postId:id;
 await runTransaction(db,async tx=>{
  const w=(await tx.get(ref)).data();if(w.claims.includes(key))throw Error('Already claimed.');
  if(id==='postReward'&&w.lastPostReward&&Date.now()-w.lastPostReward.toMillis()<3600000)throw Error('Try again after one hour.');
  tx.update(ref,{balance:w.balance+amount,claims:[...w.claims,key],action:id,postId,...(id==='postReward'?{lastPostReward:serverTimestamp()}:{})});
 });
})}
onAuthStateChanged(auth,async current=>{
 const g=++generation;stops.forEach(s=>s());stops=[];user=current;clearTimeout(dailyTimer);wallet=null;messageCount=0;rareGranted=false;profileCreatedAt=null;achievementFilter='All';profileTab='idot';appearance={...defaultAppearance};busy=false;error='';render();if(!current)return;
 const profileRef=doc(db,'profiles',current.uid),ref=doc(db,'liamWallets',current.uid);
 if(custom)stops.push(onSnapshot(doc(db,'liamMessageStats',current.uid),s=>{if(g===generation){messageCount=s.data()?.count||0;if(profileTab==='earn')customize()}},()=>{}));
 let started=false;
 stops.push(onSnapshot(profileRef,async p=>{
  if(g!==generation||!p.exists())return;
  profileCreatedAt=p.data().createdAt?.toMillis?.()||null;rareGranted=p.data().idotFaviconGranted===true;appearance=appearanceForProfile(p.data());render();if(started)return;started=true;
  try{await runTransaction(db,async tx=>{const w=await tx.get(ref);if(!w.exists())tx.set(ref,{balance:100,owned:[],claims:[],action:'starter',postId:''})});if(g!==generation)return;
   stops.push(onSnapshot(ref,s=>{if(g!==generation)return;wallet=s.data()||null;clearTimeout(dailyTimer);const times=[wallet?.lastDaily?wallet.lastDaily.toMillis()+86400000:0,wallet?.lastPostReward?wallet.lastPostReward.toMillis()+3600000:0].filter(t=>t>Date.now());if(times.length)dailyTimer=setTimeout(render,Math.min(...times)-Date.now()+1000);render()},e=>{if(g===generation){error='Wallet unavailable: '+e.message;render()}}));
  }catch(e){if(g===generation){error='Liam Coins unavailable. The updated Firestore rules may need deployment. '+e.message;render()}}
 },e=>{if(g===generation){error=e.message;render()}}));
});
const params=new URLSearchParams(location.search);
if(custom&&(params.get('customize')==='1'||params.get('earn')==='1')){
 const timer=setInterval(()=>{if(user&&document.getElementById('profileButton')&&!document.getElementById('profileButton').disabled){clearInterval(timer);profileTab=params.get('earn')==='1'?'earn':'idot';customize();document.getElementById('profileButton')?.click();custom.scrollIntoView({block:'nearest'})}},500);setTimeout(()=>clearInterval(timer),15000);
}
render();
