import {createRewardCelebration} from './liam-reward-celebration.js?v=1';
import {livePaymentConfig} from './liam-payment-config.js?v=6';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {getFirestore,doc,getDoc,onSnapshot,runTransaction,updateDoc,collection,query,where,limit,getDocs,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
import {defaultAppearance,dotSVG,dotAvatar,styleCosmeticProfile,appearanceForProfile} from './idot-render.js?v=5';
import {expansion,expansionById,slotFor,rarityFor,describe,cursorSvg,buddySVG,profileClasses,themeVars,pixelTextureSVG,cosmeticArt,cosmeticLabel} from './liam-expansion.js?v=5';
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
catalog.push(...expansion.map(r=>[r[0],r[1],r[2],r[3],describe(r),r[3]==='iDot'?{[slotFor(r[0])]:r[0]}:{}]));
const achievementById=new Map(achievements.map(a=>[a.id,a]));
let profileCreatedAt=null,achievementFilter='All';
let user=null,wallet=null,appearance={...defaultAppearance},stops=[],generation=0,error='',busy=false,category='All',profileTab='idot',dailyTimer=0,messageCount=0,rareGranted=false;
const store=document.getElementById('liam-shop'),custom=document.getElementById('liam-customize');
const balance=document.createElement('a');balance.className='lc-balance';balance.href='community.html?earn=1';balance.hidden=true;document.body.append(balance);
const style=document.createElement('link');style.rel='stylesheet';style.href='liam-economy.css?v=10';document.head.append(style);
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
function switchItem(id){const slot=slotFor(id);if(!slot)return equip({[id]:!appearance[id],...(id==='cursor'?{cursorStyle:''}:id==='texture'?{themeStyle:''}:id==='follower'?{buddyStyle:''}:id==='hat'?{accessory:'',favicon:false}:id==='frame'?{borderStyle:''}:id==='gradient'?{nameStyle:''}:id==='username'?{handleStyle:''}:{})});const changes={[slot]:equipped(id)?'':id};if(slot==='cursorStyle')changes.cursor=false;if(slot==='themeStyle')changes.texture=false;if(slot==='buddyStyle')changes.follower=false;if(slot==='accessory'&&!equipped(id)){changes.hat=false;changes.favicon=false;changes.hatStyle='';changes.eyewearStyle='';}if(slot==='hatStyle'&&!equipped(id)){changes.hat=false;changes.favicon=false;changes.accessory='';}if(slot==='eyewearStyle'&&!equipped(id)){changes.glasses=false;if(appearance.accessory==='accHeart')changes.accessory='';}if(slot==='tagStyle'&&!equipped(id))changes.tag=false;if(slot==='borderStyle')changes.frame=false;if(slot==='nameStyle')changes.gradient=false;if(slot==='handleStyle')changes.username=false;return equip(changes);}
function has(id){return wallet?.owned?.includes(id)===true;}
function apply(){
 updateChests();balance.hidden=!user||!wallet;balance.textContent=wallet?wallet.balance.toLocaleString()+' LC':'';
 balance.setAttribute('aria-label','Liam Coins balance and ways to earn');
 const b=document.getElementById('profileButton');if(b){let t=b.querySelector('.lc-profile-balance');if(!t){t=document.createElement('span');t.className='lc-profile-balance';b.append(t)}t.textContent=wallet?' · '+wallet.balance.toLocaleString()+' LC':''}
 const otherBuddy=has(appearance.buddyStyle)?buddySVG(appearance.buddyStyle):'';
 buddy.hidden=!(user&&(otherBuddy||has('follower')&&appearance.follower)&&fine.matches&&!motion.matches);
 if(!buddy.hidden){buddy.innerHTML=otherBuddy||dotSVG(appearance);if(!frame)frame=requestAnimationFrame(tick)}
 const cursor=has(appearance.cursorStyle)?cursorSvg(appearance.cursorStyle):has('cursor')&&appearance.cursor?cursorSvg('cursor'):'';
 document.body.classList.toggle('lc-new-cursor',!!cursor);
 document.body.style.setProperty('--lc-custom-cursor',cursor?'url("data:image/svg+xml,'+encodeURIComponent(cursor)+'") '+(['cursorStar','cursorIce','cursorFire','cursorDot'].includes(appearance.cursorStyle)?'16 16':'3 3')+', auto':'auto');
 document.body.classList.toggle('lc-cursor',!cursor&&has('cursor')&&appearance.cursor);
 const theme=has(appearance.themeStyle)?themeVars(appearance.themeStyle):null;
 document.body.classList.toggle('lc-texture',!!theme||has('texture')&&appearance.texture);
 document.body.classList.toggle('lc-expanded-theme',!!theme);
 if(theme)document.body.dataset.lcSkin=appearance.themeStyle;else if(has('texture')&&appearance.texture)document.body.dataset.lcSkin='texture';else delete document.body.dataset.lcSkin;
 for(const key of ['bg','panel','accent','light','pattern','size']){if(theme)document.body.style.setProperty('--lc-theme-'+key,theme[key]);else document.body.style.removeProperty('--lc-theme-'+key);}

}
motion.addEventListener?.('change',apply);fine.addEventListener?.('change',apply);
window.addEventListener('pageshow',apply);document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply()});
function element(tag,txt,cls){const e=document.createElement(tag);if(txt)e.textContent=txt;if(cls)e.className=cls;return e;}
function button(txt,fn,disabled=false){const b=element('button',txt,'lc-button');b.type='button';b.disabled=disabled;b.onclick=fn;return b;}
function svgImage(s){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s)})}
async function png(id,config,w=280,h=180){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
 const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#102a55');g.addColorStop(1,'#38165f');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#b9d7ff';for(let i=0;i<22;i++){ctx.globalAlpha=.35;ctx.fillRect((i*83+17)%w,(i*41+11)%h,2,2)}ctx.globalAlpha=1;
 const extra=expansionById.get(id);
 if(id==='cursor'||extra?.[3]==='Cursors'||extra?.[3]==='Buddies'||extra?.[3]==='iDot'){
  const svg=id==='cursor'||extra?.[3]==='Cursors'?cursorSvg(id):extra?.[3]==='Buddies'?buddySVG(id):dotSVG({[slotFor(id)]:id});const image=await svgImage(svg);const size=id==='cursorPixel'?Math.floor(Math.min(w,h)*.78/32)*32:Math.min(w,h)*.78;if(id==='cursorPixel')ctx.imageSmoothingEnabled=false;ctx.drawImage(image,Math.floor((w-size)/2),Math.floor((h-size)/2),size,size);return canvas.toDataURL('image/png');
 }
 if(id==='packGalaxy'){const v=themeVars('themeGalaxy');const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,v.bg);g.addColorStop(1,v.panel);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.fillStyle=v.light;for(let i=0;i<95;i++){const x=(i*73+13)%w,y=(i*41+19)%h,s=1+i%3;ctx.globalAlpha=.25+(i%5)/8;ctx.fillRect(x,y,s,s);}ctx.globalAlpha=1;return canvas.toDataURL('image/png');}
  if(extra?.[3]==='Textures'){
  const skin=extra?.[3]==='Textures'?id:'themeGalaxy',v=themeVars(skin);
  const retro=skin==='themeRetro',cyber=skin==='themeCyber',arcade=skin==='themeArcade',cloud=skin==='themeCloud',crystal=skin==='themeCrystal',midnight=skin==='themeMidnight';
  const fg=retro?'#17385d':cloud?'#233a60':cyber?'#a8ffd1':'#f4f6ff';
  const bg=retro?'#b6d5f5':cloud?'#d3e8fa':v.bg, surface=retro?'#edf6ff':cloud?'#f4faff':v.panel,edge=retro?'#507eae':cloud?'#789cc5':v.light;
  const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,bg);gradient.addColorStop(1,retro?'#82afe0':cloud?'#a3c4e9':v.accent);ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.globalAlpha=.18;ctx.strokeStyle=edge;ctx.fillStyle=edge;ctx.lineWidth=1;
  if(cyber){for(let x=0;x<w;x+=18){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=18){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}for(let y=0;y<h;y+=4)ctx.fillRect(0,y,w,1)}
  else if(retro){for(let y=0;y<h;y+=4)ctx.fillRect(0,y,w,1)}
  else if(arcade){const tile=await svgImage(pixelTextureSVG());ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;for(let y=0;y<h;y+=96)for(let x=0;x<w;x+=96)ctx.drawImage(tile,x,y,96,96)}
  else if(skin==='themeOcean'){for(let y=0;y<h;y+=18){ctx.beginPath();for(let x=0;x<=w;x+=3){const yy=y+6*Math.sin(x/18);x?ctx.lineTo(x,yy):ctx.moveTo(x,yy)}ctx.stroke()}}
  else if(crystal){for(let x=-h;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+h,h);ctx.stroke()}}
  else if(skin==='themeSunset'||skin==='themeAurora'||cloud){for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(w*(.2+i*.26),h*(.15+i%2*.23),w*.3,h*.18,-.3,0,Math.PI*2);ctx.fill()}}
  else if(!midnight){for(let i=0;i<45;i++)ctx.fillRect((i*73+13)%w,(i*41+19)%h,2+i%2,2+i%2)}
  ctx.restore();
  const radius=cyber||arcade?0:retro||midnight?3:crystal?6:cloud?20:skin==='themeOcean'?9:14;
  function panel(x,y,pw,ph,fill,rad=radius){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,pw,ph,rad);else ctx.rect(x,y,pw,ph);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=edge;ctx.lineWidth=arcade||retro?2:1;ctx.stroke()}
  panel(w*.06,h*.08,w*.88,h*.84,surface);
  if(retro){const chrome=ctx.createLinearGradient(0,h*.08,0,h*.24);chrome.addColorStop(0,'#e6f5ff');chrome.addColorStop(.48,'#8cbef4');chrome.addColorStop(.5,'#478bd7');chrome.addColorStop(1,'#acd4f9');panel(w*.06,h*.08,w*.88,h*.16,chrome,3);for(let i=0;i<3;i++){ctx.fillStyle=i===2?'#d35b4b':'#eaf5ff';ctx.fillRect(w*(.75+i*.055),h*.115,w*.04,h*.075)}}
  if(cyber){ctx.fillStyle='#42ff95';ctx.fillRect(w*.06,h*.08,3,h*.84)}
  ctx.fillStyle=fg;ctx.font='bold '+Math.round(h*.115)+'px '+(cyber||arcade?'monospace':retro?'Tahoma, sans-serif':crystal||skin==='themeGalaxy'?'Georgia, serif':'Verdana, sans-serif');ctx.textAlign=retro||cyber?'left':'center';ctx.fillText(cyber?'>_ iLIAM':retro?'iLiam.exe':arcade?'iLIAM ARCADE':'iLiam',retro||cyber?w*.105:w*.5,h*.205);
  for(let i=0;i<3;i++){let fill=v.accent;if(retro){fill=ctx.createLinearGradient(0,h*.29,0,h*.42);fill.addColorStop(0,'#fff');fill.addColorStop(.48,'#e4f3ff');fill.addColorStop(.5,'#a9c9e9');fill.addColorStop(1,'#d9edff')}else if(cyber)fill='#092a19';else if(cloud)fill='#d5e8ff';panel(w*(.10+i*.27),h*.29,w*.25,h*.12,fill,cyber||arcade?0:retro?3:10);ctx.fillStyle=fg;ctx.textAlign='center';ctx.font='bold '+Math.round(h*.055)+'px '+(cyber||arcade?'monospace':'Arial');ctx.fillText(['HOME','GAMES','STORE'][i],w*(.225+i*.27),h*.37)}
  panel(w*.10,h*.49,w*.80,h*.35,retro?'#fff':cyber?'#04150c':cloud?'#e5f1ff':v.bg);
  ctx.fillStyle=fg;ctx.textAlign='left';ctx.font='bold '+Math.round(h*.075)+'px '+(cyber||arcade?'monospace':'Verdana');ctx.fillText(cyber?'$ SYSTEM ONLINE':retro?'Welcome to iLiam!':'COMMUNITY',w*.14,h*.60);
  ctx.fillStyle=fg;ctx.globalAlpha=.55;for(let i=0;i<3;i++)ctx.fillRect(w*.14,h*(.66+i*.055),w*(.64-i*.09),Math.max(1,h*.015));ctx.globalAlpha=1;
  return canvas.toDataURL('image/png');
 }
 if(extra?.[3]==='Profile'){
  const slot=slotFor(id),art=cosmeticArt(id);if(slot==='bannerStyle'&&Array.isArray(art)){const g=ctx.createLinearGradient(0,0,w,h);art.forEach((c,i)=>g.addColorStop(i/(art.length-1),c));ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}const image=await svgImage(dotSVG({})),cx=w*.25,cy=h*.49,size=h*.56;if(slot==='avatarColor'&&typeof art==='string'){ctx.fillStyle=art;ctx.beginPath();ctx.arc(cx,cy,size*.49,0,Math.PI*2);ctx.fill();}ctx.drawImage(image,cx-size/2,cy-size/2,size,size);const color={ringSilver:'#e7edf7',ringNeon:'#1ebfff',ringRainbow:'#ff89b4',ringFire:'#ff8132',ringLightning:'#76e7ff',ringGalaxy:'#bc8aff',ringDiamond:'#b8faff',profSilver:'#cddbe8',profNeon:'#72ffba',profSunset:'#ffac91',profMetal:'#c3d6e5',profRainbow:'#d8a1ff',profSparkles:'#ffe7a2',profBanner:'#ae93ff',profGalaxy:'#baa0ff'}[id]||(typeof art==='string'?art:'#e9efff');
  if(slot==='borderStyle'){ctx.strokeStyle=color;ctx.lineWidth=5;ctx.beginPath();ctx.arc(cx,cy,size*.44,0,Math.PI*2);ctx.stroke()}
  if(id==='profSparkles'||id==='profBanner'){ctx.fillStyle=color;for(let i=0;i<24;i++){ctx.fillRect((i*71+13)%w,(i*37+5)%h,3,3)}}
  ctx.fillStyle=color;ctx.font='bold '+Math.round(w*.065)+'px Verdana';ctx.fillText(slot==='tagStyle'?cosmeticLabel(id):id==='profMetal'||id==='profGalaxy'?'@username':'Display Name',w*.46,h*.45);ctx.font=Math.round(w*.046)+'px Verdana';ctx.fillText(id==='profMetal'||id==='profGalaxy'?'Display Name':'@username',w*.46,h*.59);return canvas.toDataURL('image/png');
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
 const filters=element('div','','lc-filters');for(const name of ['All','Cursors','Textures','Buddies','Downloads','Owned']){const b=button(name,()=>{category=name;shop()});b.setAttribute('aria-pressed',String(category===name));filters.append(b)}store.append(filters);
 const grid=element('div','','lc-grid');for(const [id,name,price,group,desc,c] of catalog){const displayGroup=id==='cursor'?'Cursors':id==='texture'?'Textures':id==='follower'?'Buddies':group;if(!storeIds.has(id)||(category==='Owned'?!has(id):category!=='All'&&displayGroup!==category))continue;const card=element('article','','lc-card'),img=element('img');img.alt=name;img.width=280;img.height=180;thumbnail(id,c).then(src=>img.src=src).catch(()=>{});card.append(img,element('span',rarityFor(id),'lc-item-rarity'),element('h3',name),element('p',desc),element('strong',price+' LC'));
 if(has(id)){if(id==='wallpaper')card.append(button('Download PNG',async()=>{const a=element('a');a.download='idot-wallpaper.png';a.href=await png(id,appearance,1920,1080);a.click()}));else if(group==='Downloads'){card.append(button('Download PNG pack',()=>downloadPack(id),busy));}else {card.append(button(equipped(id)?'Equipped · Turn off':'Owned · Equip',()=>switchItem(id),busy));if(id==='follower'){const a=element('a','Customize your iDot in Community');a.href='community.html?customize=1';card.append(a)}}}else card.append(button(wallet&&wallet.balance<price?'Not enough LC':'Buy',()=>buy(id,price),!wallet||busy||wallet.balance<price));grid.append(card)}store.append(grid);
}
// Compact avatar editor: catalog, ownership and transaction logic remain shared.
let dotCategory='colors',dotSelection='',dotScroll=0;
const dotCategories=[
 ['colors','Colors','<circle cx="12" cy="12" r="9"/><ellipse cx="9" cy="11" rx="1.2" ry="2"/><ellipse cx="15" cy="11" rx="1.2" ry="2"/><path d="M9 16q3 2 6 0"/>'],
 ['hats','Hats','<path d="M5 13Q5 5 12 5t7 8M3 13h18v3H3z"/><circle cx="12" cy="4" r="1.4"/>'],
 ['eyewear','Eyewear','<path d="M3 10h7v4a3.5 3.5 0 0 1-7 0zm11 0h7v4a3.5 3.5 0 0 1-7 0zM10 12h4M1 10h2m18 0h2"/>'],
 ['extras','Accessories','<circle cx="12" cy="12" r="7"/><ellipse cx="12" cy="12" rx="11" ry="3.7" transform="rotate(-28 12 12)"/>'],
 ['exclusive','Exclusive','<path d="m3 7 4 4 5-7 5 7 4-4-2 11H5zM5 21h14"/>']
];
function dotGroup(id){
 const slot=slotFor(id);
 if(id==='blue'||['purple','green','gold'].includes(id)||slot==='color')return 'colors';
 if(id==='hat'||['accCap','accSleep','accTop','accPirate','accCrown'].includes(id)||slot==='hatStyle')return 'hats';
 if(id==='glasses'||id==='accHeart'||slot==='eyewearStyle')return 'eyewear';
 return 'extras';
}
function dotItems(){
 const items=[{id:'blue',name:'Classic Blue',price:0,config:{color:'blue'},group:'colors',free:true},...catalog.filter(r=>r[3]==='iDot'&&!storeIds.has(r[0])).map(([id,name,price,group,desc,config])=>({id,name,price,config,group:dotGroup(id)}))];
 for(const group of ['hats','eyewear','extras','exclusive'])items.unshift({id:'none-'+group,name:'None',price:0,config:{},group,free:true,isNone:true});
 if(rareGranted)items.push({id:'favicon',name:'iLiam Icon Crown',price:0,config:{favicon:true},group:'exclusive',free:true});
 return items;
}
const dotOwned=item=>item.free||has(item.id);
const dotActive=item=>item.isNone?(item.group==='hats'?!appearance.hat&&!appearance.hatStyle:item.group==='eyewear'?!appearance.glasses&&!appearance.eyewearStyle:item.group==='extras'?!appearance.accessory:!appearance.favicon):item.group==='colors'?appearance.color===item.id:item.id==='favicon'?appearance.favicon===true:equipped(item.id);
function dotTryOn(item){
 if(!item||dotActive(item))return {...appearance};
 const id=item.id,slot=slotFor(id),next={...appearance};
 if(item.isNone){if(item.group==='hats')Object.assign(next,{hat:false,hatStyle:''});else if(item.group==='eyewear')Object.assign(next,{glasses:false,eyewearStyle:''});else if(item.group==='extras')next.accessory='';else if(item.group==='exclusive')next.favicon=false;return next;}
 if(item.group==='colors')next.color=id;
 else if(id==='favicon'){Object.assign(next,{favicon:true,accessory:'',hat:false,hatStyle:''});}
 else if(id==='hat'){Object.assign(next,{hat:true,accessory:'',hatStyle:'',favicon:false});}
 else if(id==='glasses'){Object.assign(next,{glasses:true,eyewearStyle:''});if(next.accessory==='accHeart')next.accessory='';}
 else if(slot==='hatStyle'){Object.assign(next,{hatStyle:id,hat:false,accessory:'',favicon:false});}
 else if(slot==='eyewearStyle'){Object.assign(next,{eyewearStyle:id,glasses:false});if(next.accessory==='accHeart')next.accessory='';}
 else if(slot==='accessory'){Object.assign(next,{accessory:id,hat:false,favicon:false,hatStyle:'',eyewearStyle:''});}
 return next;
}
function dotAction(item){
 if(!dotOwned(item))return buy(item.id,item.price);
 if(item.isNone)return equip(dotTryOn(item));
 if(item.group==='colors')return equip({color:item.id});
 if(item.id==='favicon')return equip({favicon:!appearance.favicon,...(!appearance.favicon?{accessory:'',hat:false,hatStyle:''}:{})});
 return switchItem(item.id);
}

function scrollableChoices(strip){
 const wrap=element('div','','lc-avatar-scroll-wrap');
 const arrow=(direction,label)=>{const b=button('',()=>strip.scrollBy({left:direction*(strip.clientWidth*.78),behavior:'smooth'}));b.className='lc-avatar-arrow';b.setAttribute('aria-label',label);b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(direction<0?'m15 18-6-6 6-6':'m9 18 6-6-6-6')+'"/></svg>';return b;};
 const prev=arrow(-1,'Scroll items left'),next=arrow(1,'Scroll items right');
 const update=()=>{prev.disabled=strip.scrollLeft<2;next.disabled=strip.scrollLeft+strip.clientWidth>=strip.scrollWidth-2;};
 strip.addEventListener('scroll',update,{passive:true});wrap.append(prev,strip,next);requestAnimationFrame(update);return wrap;
}
function itemActionLabel(item,owned,active){return item.isNone?(active?'None selected':'Select None'):!owned?'Unlock · '+item.price+' LC':active?(item.group==='colors'?'Equipped':'Unequip'):'Equip';}

function renderDotStudio(){
 const items=dotItems(),categories=dotCategories.filter(c=>c[0]!=='exclusive'||rareGranted);
 if(!categories.some(c=>c[0]===dotCategory)){dotCategory='colors';dotSelection='';dotScroll=0;}
 const visible=items.filter(i=>i.group===dotCategory);
 const selected=visible.find(i=>i.id===dotSelection)||visible.find(dotActive)||null;
 const studio=element('section','','lc-avatar-studio');studio.setAttribute('aria-label','iDot customization editor');
 const top=element('div','','lc-avatar-top');top.append(element('strong','iDot Studio'),element('span',wallet?wallet.balance.toLocaleString()+' LC':'Loading…','lc-studio-coins'));
 const exit=button('',()=>{});exit.onclick=()=>{profileTab='';dotSelection='';dotScroll=0;customize()};exit.className='lc-avatar-close';exit.setAttribute('aria-label','Close iDot Studio');exit.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';top.append(exit);
 const stage=element('div','','lc-avatar-stage'),live=element('div','','lc-dot-preview');live.innerHTML=dotSVG(dotTryOn(selected));stage.append(live,element('span','Live iDot preview','lc-avatar-preview-note'));
 const avatar=button(appearance.avatar?'Profile picture: On':'Use as profile picture',()=>equip({avatar:!appearance.avatar}),busy||!wallet);avatar.className='lc-button lc-avatar-use';avatar.setAttribute('aria-pressed',String(appearance.avatar));stage.append(avatar);
 const label=element('div','','lc-avatar-selection');const title=element('strong',selected?.name||'Select an item');label.append(title);
 if(selected){const active=dotActive(selected),owned=dotOwned(selected);const state=active?'Equipped':owned?'Owned · Preview':selected.price+' LC · Preview';label.append(element('span',state,'lc-avatar-state'));const action=button(itemActionLabel(selected,owned,active),()=>dotAction(selected),busy||!wallet||(!owned&&wallet.balance<selected.price)||(active&&(selected.group==='colors'||selected.isNone)));action.classList.add('lc-avatar-action');label.append(action);}
 const strip=element('div','','lc-avatar-strip');strip.setAttribute('aria-label','Available '+dotCategory);
 for(const item of visible){
  const b=button('',()=>{dotScroll=strip.scrollLeft;dotSelection=item.id;customize()});b.className='lc-avatar-option';b.setAttribute('aria-pressed',String(selected?.id===item.id));b.setAttribute('aria-label',item.name+', '+(dotOwned(item)?dotActive(item)?'equipped':'owned':item.price+' LC'));
  const thumb=element('span','','lc-avatar-thumb');thumb.innerHTML=dotSVG(item.group==='colors'?{color:item.id}:item.config);b.append(thumb,element('span',item.name,'lc-avatar-item-name'),element('span',dotActive(item)?'Equipped':dotOwned(item)?'Owned':item.price+' LC','lc-avatar-item-price'));strip.append(b);
 }
 strip.addEventListener('scroll',()=>{dotScroll=strip.scrollLeft},{passive:true});
 const nav=element('div','','lc-avatar-categories');nav.setAttribute('aria-label','iDot accessory categories');
 for(const [id,name,icon] of categories){const b=button('',()=>{dotCategory=id;dotSelection='';dotScroll=0;customize()});b.className='lc-avatar-category';b.setAttribute('aria-pressed',String(dotCategory===id));b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon+'</svg>';b.append(element('span',name));nav.append(b);}
 studio.append(top,stage,label,scrollableChoices(strip),nav);custom.append(studio);strip.scrollLeft=dotScroll;
}
let profileDisplay={};
let styleCategory='banners',styleSelection='',styleScroll=0;
const styleCategories=[
 ['banners','Banners','<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 5"/><circle cx="16.5" cy="8.5" r="1"/>'],
 ['pictures','Picture','<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M5.5 18a7 7 0 0 1 13 0"/>'],
 ['rings','Rings','<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/>'],
 ['tags','Tags','<path d="M3 4h8l10 10-7 7L3 10z"/><circle cx="7.5" cy="8" r="1"/>'],
 ['names','Names & effects','<path d="m3 19 7-14 7 14M6 13h8M19 5v6m-3-3h6"/>']
];
function styleGroup(id){const slot=slotFor(id);return slot==='bannerStyle'?'banners':slot==='avatarColor'?'pictures':id==='frame'||slot==='borderStyle'?'rings':id==='tag'||slot==='tagStyle'?'tags':'names';}
function styleItems(){const items=catalog.filter(r=>r[3]==='Profile'&&!storeIds.has(r[0])).map(([id,name,price,group,desc,config])=>({id,name,price,config,group:styleGroup(id)}));for(const group of ['banners','pictures','rings','tags','names'])items.unshift({id:'none-'+group,name:'None',price:0,config:{},group,free:true,isNone:true});return items;}
function styleNone(group){return group==='banners'?{bannerStyle:''}:group==='pictures'?{avatarColor:''}:group==='rings'?{frame:false,borderStyle:''}:group==='tags'?{tag:false,tagStyle:''}:{gradient:false,username:false,nameStyle:'',handleStyle:'',profileEffect:''};}
function styleActive(item){if(item.isNone){const changes=styleNone(item.group);return Object.keys(changes).every(key=>appearance[key]===changes[key]||(!appearance[key]&&!changes[key]));}return equipped(item.id);}
function styleChange(id,active=false){
 const slot=slotFor(id),next=slot?{[slot]:active?'':id}:{[id]:!active};
 if(!active){
 if(slot==='borderStyle')next.frame=false;if(id==='frame')next.borderStyle='';
 if(slot==='tagStyle')next.tag=false;if(id==='tag')next.tagStyle='';
 if(slot==='nameStyle')next.gradient=false;if(id==='gradient')next.nameStyle='';
 if(slot==='handleStyle')next.username=false;if(id==='username')next.handleStyle='';
 }
 return next;
}
function renderProfileStudio(){
 const items=styleItems(),visible=items.filter(i=>i.group===styleCategory);
 const selected=visible.find(i=>i.id===styleSelection)||visible.find(styleActive)||null;
 const preview={...appearance,...(selected&&!styleActive(selected)?selected.isNone?styleNone(selected.group):styleChange(selected.id):{})};
 const studio=element('section','','lc-avatar-studio lc-profile-studio');studio.setAttribute('aria-label','Profile style editor');
 const top=element('div','','lc-avatar-top');top.append(element('strong','Profile Style'),element('span',wallet?wallet.balance.toLocaleString()+' LC':'Loading…','lc-studio-coins'));
 const exit=button('',()=>{profileTab='';styleSelection='';styleScroll=0;customize()});exit.className='lc-avatar-close';exit.setAttribute('aria-label','Close Profile Style');exit.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';top.append(exit);
 const stage=element('div','','lc-profile-stage');
 const live=element('div','','lc-identity-preview lc-profile-live');const picture=element('img');picture.alt='Profile picture preview';
 const existing=document.querySelector('#profileSummary img.avatar,#profileSummary img');
 picture.src=appearance.avatar?dotAvatar(preview):existing?.getAttribute('src')||dotAvatar(preview);picture.className='avatar'+(preview.frame?' lc-frame':'');
 const name=element('strong',profileDisplay.name||'Display Name',preview.gradient?'lc-preview-gradient':'');const handle=element('span',profileDisplay.handle||'@username',preview.username?'lc-blue-name':'');
 handle.classList.add('username');live.append(picture,name,handle);profileClasses(live,preview);styleCosmeticProfile(live,preview);stage.append(live);
 const label=element('div','','lc-avatar-selection');label.append(element('strong',selected?.name||'Select an item'));
 if(selected){const active=styleActive(selected),owned=selected.free||has(selected.id);label.append(element('span',active?'Equipped':owned?'Owned · Preview':selected.price+' LC · Preview','lc-avatar-state'));const action=button(selected.isNone?(active?'None selected':'Select None'):!owned?'Unlock · '+selected.price+' LC':active?'Unequip':'Equip',()=>selected.isNone?equip(styleNone(selected.group)):owned?equip(styleChange(selected.id,active)):buy(selected.id,selected.price),busy||!wallet||(!owned&&wallet.balance<selected.price)||(selected.isNone&&active));action.classList.add('lc-avatar-action');label.append(action);}
 const strip=element('div','','lc-avatar-strip');strip.setAttribute('aria-label','Available profile cosmetics');
 for(const item of visible){const b=button('',()=>{styleScroll=strip.scrollLeft;styleSelection=item.id;customize()});b.className='lc-avatar-option';b.setAttribute('aria-pressed',String(selected?.id===item.id));b.setAttribute('aria-label',item.name+', '+(styleActive(item)?'equipped':item.free||has(item.id)?'owned':item.price+' LC'));const thumb=element('span','','lc-avatar-thumb lc-profile-thumb');if(item.isNone)thumb.textContent='∅';else{const img=element('img');img.alt='';thumbnail(item.id,item.config).then(src=>img.src=src).catch(()=>{});thumb.append(img);}b.append(thumb,element('span',item.name,'lc-avatar-item-name'),element('span',styleActive(item)?'Equipped':item.free||has(item.id)?'Owned':item.price+' LC','lc-avatar-item-price'));strip.append(b);}
 strip.addEventListener('scroll',()=>{styleScroll=strip.scrollLeft},{passive:true});
 const nav=element('div','','lc-avatar-categories');nav.setAttribute('aria-label','Profile categories');
 for(const [id,name,icon] of styleCategories){const b=button('',()=>{styleCategory=id;styleSelection='';styleScroll=0;customize()});b.className='lc-avatar-category';b.setAttribute('aria-pressed',String(styleCategory===id));b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon+'</svg>';b.append(element('span',name));nav.append(b);}
 studio.append(top,stage,label,scrollableChoices(strip),nav);custom.append(studio);strip.scrollLeft=styleScroll;
}
let chestState={},chestLoaded=false,chestBusy=false,chestOpen=false,rewardBaseline=null;
const chestTypes=[['daily','Daily Chest',86400000,[500,250,175,100]],['quick','6-hour Chest',21600000,[250,130,90,50]]];
const chestButton=document.createElement('button');chestButton.type='button';chestButton.className='lc-chest-fab';chestButton.hidden=true;chestButton.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 10V7l3-3h12l3 3v3M3 10h18v10H3zM10 9h4v5h-4z"/></svg><span>Chests</span><b hidden></b>';document.body.append(chestButton);
const chestPanel=document.createElement('div');chestPanel.className='lc-chest-overlay';chestPanel.hidden=true;document.body.append(chestPanel);
const toastRoot=document.createElement('div');toastRoot.className='lc-reward-toasts';toastRoot.setAttribute('aria-live','polite');document.body.append(toastRoot);
// The wheel reveals the server-selected reward, not a client-generated result.
const chestColors=['#f0bc4f','#b58cf1','#55afdb','#4eae86'],chestBounds=[0,3.6,39.6,111.6,360];
let chestCelebration=null,chestCelebrationTimer=0;
function dismissChestCelebration(){clearTimeout(chestCelebrationTimer);chestCelebration?.remove();chestCelebration=null;}
function celebrateChest(amount,title){dismissChestCelebration();chestCelebration=createRewardCelebration({amount,label:'iLiam Coins earned!',message:'You opened the '+title,onDone:dismissChestCelebration});chestCelebrationTimer=setTimeout(dismissChestCelebration,5500);}
function chestWheel(type){
 const frame=element('div','','lc-wheel-frame'),pointer=element('span','','lc-wheel-pointer'),wheel=element('div','','lc-chest-wheel');wheel.setAttribute('aria-label','Reward wheel');wheel.style.background='conic-gradient('+chestColors.map((c,i)=>c+' '+chestBounds[i]+'deg '+chestBounds[i+1]+'deg').join(',')+')';
 for(let i=1;i<4;i++){const angle=(chestBounds[i]+chestBounds[i+1])/2,rad=angle*Math.PI/180,tag=element('span',String(type[3][i]),'lc-wheel-label');tag.style.left=(50+Math.sin(rad)*34)+'%';tag.style.top=(50-Math.cos(rad)*34)+'%';wheel.append(tag);}
 wheel.append(element('span','LC','lc-wheel-hub'));frame.append(wheel,pointer);return frame;
}
async function spinChest(kind,amount,g){
 const type=chestTypes.find(t=>t[0]===kind),index=type[3].indexOf(amount);
 if(index<0)return;
 const wheel=chestPanel.querySelector('[data-chest="'+kind+'"] .lc-chest-wheel');
 if(wheel&&chestOpen&&!motion.matches){const center=(chestBounds[index]+chestBounds[index+1])/2,angle=360*5+360-center;wheel.style.transition='none';wheel.style.transform='rotate(0deg)';void wheel.offsetWidth;wheel.style.transition='transform 3.2s cubic-bezier(.12,.75,.12,1)';wheel.style.transform='rotate('+angle+'deg)';await new Promise(r=>setTimeout(r,3300));}
 else if(wheel){const center=(chestBounds[index]+chestBounds[index+1])/2;wheel.style.transform='rotate('+(360-center)+'deg)';}
 if(g!==generation)return;celebrateChest(amount,type[1]);
}
function placeChestButton(){const n=document.getElementById('iliam-notify-settings'),r=n?.getBoundingClientRect();if(r&&r.height>0){chestButton.style.bottom=Math.max(12,innerHeight-r.top+8)+'px';chestButton.style.right=Math.max(8,innerWidth-r.right)+'px';}else{chestButton.style.removeProperty('bottom');chestButton.style.removeProperty('right');}}
window.addEventListener('resize',placeChestButton);

function rewardToast(title,amount){const t=element('div','','lc-reward-toast');const coin=element('span','LC','lc-toast-coin');const copy=element('div');copy.append(element('strong',title),element('span','+'+amount.toLocaleString()+' LC'));t.append(coin,copy);toastRoot.append(t);setTimeout(()=>t.remove(),5000);}
function observeRewardClaims(next){if(!next)return;const claims=new Set(next.claims||[]);if(rewardBaseline){for(const key of claims){if(rewardBaseline.has(key))continue;const a=achievementById.get(key);if(a)rewardToast('Achievement unlocked: '+a.name,a.reward);else if(key.startsWith('postReward:'))rewardToast('Post reward',5);else if(key.startsWith('featuredReward:'))rewardToast('Featured post reward',150);}}rewardBaseline=claims;}
function chestNext(kind,ms){const old=kind==='daily'?(wallet?.lastDaily?.toMillis?.()||0):0;return Math.max(Number(chestState[kind+'At'])||0,old)+ms;}
function chestTime(ms){const sec=Math.max(0,Math.ceil(ms/1000));return [Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(n=>String(n).padStart(2,'0')).join(':');}
function updateChests(){chestButton.hidden=!user;placeChestButton();const badge=chestButton.querySelector('b');const count=wallet&&chestLoaded?chestTypes.filter(([k,,ms])=>Date.now()>=chestNext(k,ms)).length:0;badge.hidden=!count;badge.textContent=count||'';if(!chestOpen)return;for(const [kind,,ms] of chestTypes){const row=chestPanel.querySelector('[data-chest="'+kind+'"]');if(!row)continue;const btn=row.querySelector('button'),ready=wallet&&chestLoaded&&Date.now()>=chestNext(kind,ms);btn.disabled=chestBusy||!ready;btn.textContent=!wallet||!chestLoaded?'Loading…':ready?'Open chest':chestTime(chestNext(kind,ms)-Date.now());}}
function showChests(){if(!user)return;chestOpen=true;chestPanel.hidden=false;chestPanel.replaceChildren();const dialog=element('section','','lc-chest-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','Free reward chests');const top=element('div','','lc-chest-top');top.append(element('strong','Reward Chests'),button('Close',hideChests));dialog.append(top,element('p','Free rewards. No LC or money needed.'));for(const [kind,title,ms,amounts] of chestTypes){const row=element('article','','lc-chest-row');row.dataset.chest=kind;row.append(element('strong',title),element('span',kind==='daily'?'Every 24 hours':'Every 6 hours'));const odds=element('div','','lc-chest-odds');[1,10,20,69].forEach((p,i)=>odds.append(element('span',amounts[i]+' LC · '+p+'%')));row.append(chestWheel([kind,title,ms,amounts]),odds,button('Loading…',()=>openChest(kind),true));dialog.append(row);}const msg=element('p','','lc-chest-message');msg.setAttribute('aria-live','polite');dialog.append(msg);chestPanel.append(dialog);updateChests();}
function hideChests(){if(chestBusy)return;chestOpen=false;chestPanel.hidden=true;}
chestButton.onclick=showChests;chestPanel.addEventListener('click',e=>{if(e.target===chestPanel)hideChests()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&chestOpen)hideChests()});setInterval(updateChests,1000);
async function openChest(kind){const g=generation,account=user;if(chestBusy||!account||!wallet||!chestLoaded)return;const type=chestTypes.find(c=>c[0]===kind);if(!type||Date.now()<chestNext(kind,type[2]))return;chestBusy=true;updateChests();const message=t=>{if(g!==generation)return;const el=chestPanel.querySelector('.lc-chest-message');if(el)el.textContent=t;};message('Opening chest…');try{const token=await account.getIdToken();const res=await fetch(livePaymentConfig.backendUrl+'/rewards/chest',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({kind})});const data=await res.json();if(g!==generation)return;if(!res.ok){if(Number.isSafeInteger(data.nextAt))chestState[kind+'At']=data.nextAt-type[2];throw Error(data.error||'Chest unavailable');}if(!Number.isSafeInteger(data.amount)||!type[3].includes(data.amount)||!Number.isSafeInteger(data.nextAt))throw Error('Unexpected reward response');chestState[kind+'At']=data.nextAt-type[2];message('Revealing your reward…');await spinChest(kind,data.amount,g);if(g!==generation)return;message('You earned +'+data.amount+' LC!');const el=chestPanel.querySelector('.lc-chest-message');if(el){el.classList.remove('lc-chest-win');void el.offsetWidth;el.classList.add('lc-chest-win');}}catch(e){message(e.message||'Try again');}finally{if(g===generation){chestBusy=false;updateChests();}}}

function customize(){
 if(!custom)return;custom.replaceChildren();if(!user)return;
 const bar=element('div','','lc-filters');
 for(const [id,label] of [['idot','iDot Studio'],['profile','Profile style'],['earn','Earn LC']]){
  const b=button(label,()=>{profileTab=id;dotSelection='';dotScroll=0;styleSelection='';styleScroll=0;customize()});b.setAttribute('aria-pressed',String(profileTab===id));bar.append(b);
 }
 const heading=element('div','','lc-studio-heading');heading.append(element('h3','Customize your profile'),element('span',wallet?wallet.balance.toLocaleString()+' LC':'Loading…','lc-studio-coins'));custom.append(heading,bar);status(custom);
 if(!profileTab){custom.append(element('p','Open a menu to customize your profile, customize iDot, or earn Liam Coins.'));return;}
 if(profileTab==='earn'){
  custom.append(element('h4','How to earn Liam Coins'),element('p','Your account receives 100 LC once when its wallet is created. Earn more through daily rewards and automatically unlocked achievements.'));
  custom.append(button('Open reward chests',showChests,!wallet));
  
  custom.append(element('h4','Repeatable rewards'));
  custom.append(element('p','Publish a post · +5 LC · Automatic (once per hour)'));
  custom.append(element('p','Featured post · +150 LC · Automatic'));
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
   row.append(info,element('strong',claimed?'Unlocked ✓':'+'+a.reward+' LC · Automatic'));
   list.append(row);
  }
  custom.append(list);
  return;
 }
 if(profileTab==='idot'){renderDotStudio();return;}
 if(profileTab==='profile')renderProfileStudio();
}
function render(){apply();shop();customize();}
async function operate(fn){if(busy||!user)return;const g=generation;busy=true;error='';render();try{await fn()}catch(e){if(g===generation)error=e.message||String(e)}finally{if(g===generation){busy=false;render()}}}
async function buy(id,price){if(!confirm('Purchase '+catalog.find(x=>x[0]===id)[1]+' for '+price+' LC?'))return;return operate(async()=>{const ref=doc(db,'liamWallets',user.uid);await runTransaction(db,async tx=>{const s=await tx.get(ref),w=s.data();if(!w||w.owned.includes(id))throw Error('Already owned or unavailable.');if(w.balance<price)throw Error('Not enough Liam Coins.');tx.update(ref,{balance:w.balance-price,owned:[...w.owned,id],action:id,postId:''})})})}
async function equip(changes){return operate(async()=>{const next={...appearance,...changes};if(!rareGranted){if(next.favicon===true)throw Error('This exclusive item has not been granted to your account.');delete next.favicon;}await updateDoc(doc(db,'profiles',user.uid),{liamAppearance:next})})}
async function claim(id,amount,knownPostId=''){return operate(async()=>{
 const uid=user.uid;let postId=knownPostId;
 const repeat=id==='postReward'||id==='featuredReward';
 const a=achievementById.get(id);
 if(!postId&&(repeat||a&&['post','image','video','mixed','votes'].includes(a.kind))){
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
let autoRunning=false,autoTimer=0,autoPosts=null;
function scheduleAchievements(delay=1200){if(!custom||!user||!wallet)return;clearTimeout(autoTimer);autoTimer=setTimeout(autoAchievements,delay);}
async function autoAchievements(){
 if(autoRunning||busy||!user||!wallet)return;
 const g=generation,uid=user.uid;autoRunning=true;
 try{
  const remaining=achievements.filter(a=>!wallet.claims.includes(a.id));
  const postKinds=['post','image','video','mixed','votes'];
  const posts=autoPosts||[];
  const claimed=new Set(wallet.claims||[]);
  for(const post of posts){if(g!==generation||user?.uid!==uid)return;if(!busy&&post.data().featured===true&&!post.data().legacy&&!claimed.has('featuredReward:'+post.id))await claim('featuredReward',150,post.id);}
  if(g!==generation||user?.uid!==uid)return;
  if(!busy&&(!wallet.lastPostReward||Date.now()-wallet.lastPostReward.toMillis()>=3600000)){const post=posts.find(p=>!p.data().legacy&&!claimed.has('postReward:'+p.id));if(post)await claim('postReward',5,post.id);}
  for(const a of remaining){
   if(g!==generation||user?.uid!==uid)return;
   let eligible=false;
   if(a.kind==='messages')eligible=messageCount>=a.target;
   if(a.kind==='owned')eligible=wallet.owned.length>=a.target;
   if(a.kind==='items')eligible=a.target.every(has);
   if(a.kind==='age')eligible=!!profileCreatedAt&&Date.now()-profileCreatedAt>=a.target*86400000;
   if(postKinds.includes(a.kind))eligible=posts.some(p=>{
    const d=p.data(),raw=d.text||'',images=(raw.match(/⟦iLiam-media:v1:Image:[^⟧]+⟧/g)||[]).length,videos=(raw.match(/⟦iLiam-media:v1:Video:[^⟧]+⟧/g)||[]).length;
    return a.kind==='post'||(a.kind==='image'&&images>=a.target)||(a.kind==='video'&&videos>=a.target)||(a.kind==='mixed'&&images>0&&videos>0)||(a.kind==='votes'&&Number(d.upvotes||0)>=a.target);
   });
   if(!eligible||busy)continue;
   await claim(a.id,a.reward);
  }
 }catch(e){console.warn('Achievement check unavailable',e)}finally{autoRunning=false;if(g===generation)scheduleAchievements(60000);}
}

onAuthStateChanged(auth,async current=>{
 const g=++generation;stops.forEach(s=>s());stops=[];user=current;autoPosts=null;chestState={};chestLoaded=false;chestBusy=false;rewardBaseline=null;toastRoot.replaceChildren();dismissChestCelebration();hideChests();clearTimeout(dailyTimer);clearTimeout(autoTimer);wallet=null;messageCount=0;rareGranted=false;profileCreatedAt=null;achievementFilter='All';profileTab='idot';dotCategory='colors';dotSelection='';dotScroll=0;styleCategory='banners';styleSelection='';styleScroll=0;profileDisplay={};appearance={...defaultAppearance};busy=false;error='';render();if(!current)return;
 const profileRef=doc(db,'profiles',current.uid),ref=doc(db,'liamWallets',current.uid);
 stops.push(onSnapshot(doc(db,'liamRewardChests',current.uid),ss=>{if(g===generation){chestState=ss.data()||{};chestLoaded=true;updateChests()}},()=>{if(g===generation){chestLoaded=false;updateChests()}}));
 if(custom)stops.push(onSnapshot(query(collection(db,'posts'),where('uid','==',current.uid),limit(250)),ps=>{if(g===generation){autoPosts=ps.docs;scheduleAchievements()}},e=>console.warn('Post reward listener unavailable',e)));
 if(custom)stops.push(onSnapshot(doc(db,'liamMessageStats',current.uid),s=>{if(g===generation){messageCount=s.data()?.count||0;if(profileTab==='earn')customize();scheduleAchievements()}},()=>{}));
 let profileReady=false,walletKnownMissing=false,creatingWallet=false,initializedWallet=false;
 // Subscribe independently: a slow or failed starter transaction must never
 // block existing users' owned cosmetics and saved appearance from loading.
 function renderLoadedState(){
  if(g!==generation)return;
  render();scheduleAchievements();
 }
 async function ensureStarterWallet(){
  if(g!==generation||!profileReady||!walletKnownMissing||creatingWallet||initializedWallet)return;
  creatingWallet=true;
  try{
   await runTransaction(db,async tx=>{
    if(g!==generation)throw Error('Account changed');
    const w=await tx.get(ref);
    if(g!==generation)throw Error('Account changed');
    if(!w.exists())tx.set(ref,{balance:100,owned:[],claims:[],action:'starter',postId:''});
   });
   initializedWallet=true;
  }catch(e){if(g===generation){error='Wallet initialization unavailable: '+e.message;renderLoadedState();}}
  finally{creatingWallet=false;}
 }
 const retryWallet=()=>ensureStarterWallet();
 window.addEventListener('online',retryWallet);stops.push(()=>window.removeEventListener('online',retryWallet));
 stops.push(onSnapshot(ref,{includeMetadataChanges:true},snap=>{
  if(g!==generation)return;
  if(snap.exists()){
   wallet=snap.data();walletKnownMissing=false;initializedWallet=true;
   if(error.startsWith('Wallet '))error='';
   if(!snap.metadata.hasPendingWrites&&!snap.metadata.fromCache)observeRewardClaims(wallet);
  }else if(!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites){
   wallet=null;walletKnownMissing=true;
  }
  clearTimeout(dailyTimer);
  const times=[wallet?.lastDaily?wallet.lastDaily.toMillis()+86400000:0,wallet?.lastPostReward?wallet.lastPostReward.toMillis()+3600000:0].filter(t=>t>Date.now());
  if(times.length)dailyTimer=setTimeout(render,Math.min(...times)-Date.now()+1000);
  renderLoadedState();ensureStarterWallet();
 },e=>{if(g===generation){error='Wallet unavailable: '+e.message;renderLoadedState();}}));
 stops.push(onSnapshot(profileRef,{includeMetadataChanges:true},p=>{
  if(g!==generation)return;
  if(!p.exists()){
   if(!p.metadata.fromCache){profileReady=false;appearance={...defaultAppearance};rareGranted=false;renderLoadedState();}
   return;
  }
  profileReady=true;
  const data=p.data();
  profileDisplay={name:data.displayName||data.username||'',handle:data.username?'@'+String(data.username).replace(/^@/,''):''};
  profileCreatedAt=data.createdAt?.toMillis?.()||null;rareGranted=data.idotFaviconGranted===true;
  appearance=appearanceForProfile(data);
  renderLoadedState();ensureStarterWallet();
 },e=>{if(g===generation){error='Profile unavailable: '+e.message;renderLoadedState();}}));
});
const params=new URLSearchParams(location.search);
if(custom&&(params.get('customize')==='1'||params.get('earn')==='1')){
 const timer=setInterval(()=>{if(user&&document.getElementById('profileButton')&&!document.getElementById('profileButton').disabled){clearInterval(timer);profileTab=params.get('earn')==='1'?'earn':'idot';customize();document.getElementById('profileButton')?.click();custom.scrollIntoView({block:'nearest'})}},500);setTimeout(()=>clearInterval(timer),15000);
}
render();
