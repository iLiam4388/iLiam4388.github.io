import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
const root=process.cwd();
const config=JSON.parse(await fs.readFile('tools/tutorial-screens.json','utf8'));
const dir=path.join(root,'images/tutorials');await fs.mkdir(dir,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.mp4':'video/mp4','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const target=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403);return res.end();}const file=target===root?path.join(root,'index.html'):target;res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1360,height:850},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce'});
// Never connect to production Firebase. Only demo data and local source are used.
const mocks={
 app:'export const initializeApp=()=>({});export const getApps=()=>[];export const getApp=()=>({});',
 auth:'const auth={currentUser:null};export const getAuth=()=>auth;export const onAuthStateChanged=()=>()=>{};export const signInWithEmailAndPassword=async()=>{throw Error("Screenshot mode")};export const createUserWithEmailAndPassword=signInWithEmailAndPassword;export const signOut=async()=>{};export const deleteUser=signOut;export const updateProfile=signOut;export const setPersistence=signOut;export const browserLocalPersistence={};export const inMemoryPersistence={};',
 firestore:'const empty={exists:()=>false,data:()=>({}),docs:[],size:0,empty:true,forEach:()=>{}};export const getFirestore=()=>({});export const collection=(...x)=>x;export const doc=(...x)=>x;export const query=(...x)=>x;export const where=(...x)=>x;export const orderBy=(...x)=>x;export const limit=(...x)=>x;export const getDoc=async()=>empty;export const getDocs=getDoc;export const getDocsFromServer=getDoc;export const onSnapshot=()=>()=>{};export const serverTimestamp=()=>null;export const setDoc=async()=>{};export const addDoc=async()=>({id:"demo"});export const deleteDoc=setDoc;export const updateDoc=setDoc;export const runTransaction=async()=>{};export const writeBatch=()=>({set(){},delete(){},update(){},commit:async()=>{}});export const Timestamp={now:()=>({}),fromMillis:()=>({})};export const arrayUnion=(...x)=>x;export const arrayRemove=(...x)=>x;export const increment=x=>x;export const deleteField=()=>null;'
};
await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();const m=url.pathname.match(/firebase-(app|auth|firestore)\.js$/);if(url.hostname==='www.gstatic.com'&&m)return route.fulfill({status:200,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:mocks[m[1]]});if(['cdn.jsdelivr.net','unpkg.com'].includes(url.hostname)&&/three|gif|ffmpeg|opentype|matter/i.test(url.pathname))return route.continue();return route.abort();});
const failures=[];let captured=0;
try{
for(const lesson of config){
 const page=await context.newPage();
 try{
 await page.goto(origin+'/'+lesson.page,{waitUntil:'domcontentloaded',timeout:25000});
 await page.waitForTimeout(450);
 await page.evaluate(({state,id})=>{
  const $=x=>document.querySelector(x), el=x=>document.getElementById(x);
  const show=(x)=>{const e=el(x);if(e){e.hidden=false;if(e.classList.contains('modal'))e.classList.add('show');else if(getComputedStyle(e).display==='none')e.style.display='block';}};
  const hide=(x)=>{const e=el(x);if(e){e.hidden=true;e.classList.remove('show');}};
  const text=(x,v)=>{const e=el(x);if(e)e.textContent=v;};
  const value=(x,v)=>{const e=el(x);if(e)e.value=v;};
  const enable=(...ids)=>ids.forEach(x=>{if(el(x))el(x).disabled=false});
  if(lessonPageCommunity()){
   ['authModal','profileModal','adminModal','savedPostsModal','publicProfileModal'].forEach(hide);
   enable('iliam-group-button','iliam-messages-button','iliam-public-chat-button','postButton');
   text('status','Signed in as Demo User (@demo_user) • tutorial example');
   const posts=el('posts');if(posts)posts.innerHTML='<article class="post"><div class="username">@demo_user</div><div class="time">Example post</div><div class="post-text">Hello, iLiam! This is a demonstration post.</div><div class="actions"><button class="small-btn upvote-btn">Upvote 2</button><button class="small-btn save-btn">Save</button><button class="small-btn danger delete-btn">Delete Post</button></div><div class="comment"><strong>@demo_friend</strong><p>Nice post!</p><button class="small-btn demo-reply">Reply</button></div><div class="comment-form"><input placeholder="Write a comment"><button class="small-btn">Comment</button></div></article>';
  }
  function lessonPageCommunity(){return !!el('postText');}
  if(state==='signup'||state==='login'){show('authModal');if(state==='signup'){text('authTitle','Create your iLiam account');text('authSubmitButton','SIGN UP');show('signupNicknameRow');show('confirmPasswordRow');}value('authUsernameInput','demo_user');}
  if(state==='profile'){show('profileModal');show('accountActions');value('usernameInput','demo_user');value('nicknameInput','Demo User');}
  if(['image','video','post','link'].includes(state)){value('postText','An example post from the iLiam tutorial.');if(state==='image'||state==='video'){show('postMediaFields');show(state==='image'?'imageUrl':'videoUrl');value(state==='image'?'imageUrl':'videoUrl',state==='image'?'https://example.com/photo.png':'https://example.com/video.mp4');}}
  if(state==='notifications'){show('iliam-notify-panel');show('iliam-permission-banner');}
  if(['newchat','groupchat','message','message-settings'].includes(state)){
   show('im-backdrop');text('im-title','Demo Friend');enable('im-input','im-image','im-attach-video','im-link','im-send','im-create');
   if(el('im-conversations'))el('im-conversations').innerHTML='<div class="im-entry selected"><strong>Demo Friend</strong><span> Example conversation</span></div>';
   if(el('im-messages'))el('im-messages').innerHTML='<div class="im-bubble"><strong>Demo Friend</strong><p>Hello! This is a tutorial message.</p><button class="im-btn demo-reply">Reply</button></div>';
   if(state==='newchat'||state==='groupchat'){show('im-new');if(el('im-people'))el('im-people').innerHTML='<div class="im-entry">✓ Demo Friend @demo_friend</div><div class="im-entry">Demo User 2 @demo2</div>';if(state==='groupchat'){show('im-group-name');value('im-group-name','Demo group');}}
   if(id===15){show('im-reply-composer');text('im-reply-name','Replying to Demo Friend');text('im-reply-text','Hello! This is a tutorial message.');}
   if(state==='message-settings'){show('im-settings');}
  }
  if(state==='public'||state==='public-media'){
   show('iliam-public-chat');enable('pc-text','pc-send');if(el('pc-history'))el('pc-history').innerHTML='<article class="pc-message"><div class="pc-message-body"><div class="pc-message-head"><strong>Demo Friend</strong></div><div class="pc-message-text">Welcome to the tutorial!</div><button class="pc-btn demo-reply">Reply</button></div></article>';if(state==='public-media'){show('pc-media-entry');value('pc-media-url','https://example.com/photo.png');}
  }
  if(['call','incoming','active-call'].includes(state)){
   show(state==='call'?'gc-picker':state==='incoming'?'gc-invite':'gc-active');enable('gc-audio','gc-video','gc-dnd');
   if(el('gc-users'))el('gc-users').innerHTML='<button class="gc-user selected"><span class="gc-user-info">Demo Friend @demo_friend ✓</span></button>';
   text('gc-count','1 of 3 selected • Private call');text('gc-invite-who','Demo Friend is calling you');
   if(el('gc-grid'))el('gc-grid').innerHTML='<div class="gc-tile"><div class="gc-voice">You</div><div class="gc-label">Demo User</div></div><div class="gc-tile"><div class="gc-voice">Demo Friend</div><div class="gc-label">Connected</div></div>';
  }
  if(state==='room'){show('room-modal');show('room-controls');show('room-info');show('invite-controls');text('invited-boards','Demo shared whiteboard');}
  if(state==='board'){if(el('empty-hint'))el('empty-hint').hidden=true;if(id===36)show('file-menu');enable('undo','redo');}
  if(state==='reviews'){enable('review-submit');value('review-input','Example feedback about iLiam.');}
 },{state:lesson.state,id:lesson.id});
 // For the creative tools use the original editor controls, not a mock image.
 if(lesson.state==='2d'||lesson.state==='3d'){
   if(lesson.state==='2d'){await page.locator('[data-panel="buildPanel"]').click({timeout:2000}).catch(()=>{});await page.locator('[data-add="rect"]').click({timeout:2000}).catch(()=>{});}
   else{await page.locator('[data-add="box"]').click({timeout:3500}).catch(()=>{});}
 }
 for(let j=0;j<lesson.selectors.length;j++){
  const selector=lesson.selectors[j];let loc=page.locator(selector).first();
  try{
   if(lesson.state==='2d'){
    const panel=await loc.evaluate(e=>e.closest('#buildPanel,#editPanel,#timelinePanel,#projectPanel')?.id||'').catch(()=>null);
    if(panel&&!await loc.isVisible().catch(()=>false))await page.locator('[data-panel="'+panel+'"]').click({timeout:2000}).catch(()=>{});
   }
   if(lesson.state==='3d'&&!await loc.isVisible().catch(()=>false)){
    if(selector.includes('data-display-action'))await page.locator('#compactMenu').evaluate(e=>{e.hidden=false;e.style.display='block'}).catch(()=>{});
    if(selector.includes('keyframe'))await page.locator('#animationToggle').click({timeout:1500}).catch(()=>{});
   }
   // Use the real DOM dialogs when a step moves to another screen.
   await page.evaluate(({id,j})=>{
    const el=x=>document.getElementById(x);const show=x=>{const e=el(x);if(e){e.hidden=false;if(e.classList.contains('modal'))e.classList.add('show');else if(getComputedStyle(e).display==='none')e.style.display='block';}};const hide=x=>{const e=el(x);if(e){e.hidden=true;e.classList.remove('show');}};
    if(id===3&&j===1){hide('authModal');}if(id===3&&j===2){show('profileModal');}
    if((id===13||id===14)&&j===0){hide('im-new');}if((id===13||id===14)&&j>0){show('im-new');}
    if(id===17&&j===0)hide('im-settings');if(id===17&&j>0)show('im-settings');
    if(id===21&&j===2){hide('gc-invite');show('gc-active');}
    if(id===48&&j>0)hide('profileModal');
    if(id===4&&j===0){hide('iliam-notify-panel');show('iliam-permission-banner');}if(id===4&&j>0){hide('iliam-permission-banner');show('iliam-notify-panel');}
   },{id:lesson.id,j});
   if(!await loc.isVisible().catch(()=>false))throw Error('control is not visible');
   await loc.scrollIntoViewIfNeeded({timeout:2500});
   await loc.evaluate((e)=>{e.dataset.tutorialHighlight='true';e.style.setProperty('outline','4px solid #ffe34d','important');e.style.setProperty('outline-offset','4px','important');e.style.setProperty('box-shadow','0 0 0 7px #111827,0 0 18px 8px #ffe34d','important');});
   await page.waitForTimeout(180);
   await page.screenshot({path:path.join(dir,'lesson-'+lesson.id+'-step-'+(j+1)+'.png'),animations:'disabled',timeout:12000});
   captured++;
   await loc.evaluate(e=>{e.removeAttribute('data-tutorial-highlight');e.style.removeProperty('outline');e.style.removeProperty('outline-offset');e.style.removeProperty('box-shadow');});
  }catch(e){failures.push({lesson:lesson.id,step:j+1,selector,reason:String(e).slice(0,180)});}
 }
 }catch(e){failures.push({lesson:lesson.id,reason:String(e).slice(0,180)});}finally{await page.close();}
}
}finally{await browser.close();server.close();}
const report={captured,expected:config.reduce((n,l)=>n+l.selectors.length,0),failures};
await fs.writeFile(path.join(dir,'capture-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(!captured)process.exitCode=1;
