import {doc,collection,getDoc,getDocs,setDoc,deleteDoc,query,limit,orderBy,onSnapshot,runTransaction,serverTimestamp,Timestamp,GeoPoint,Bytes,DocumentReference} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

// Authority always comes from admins/{auth.uid}; badges never grant access.
export function installAdmin({db,getUser,onRole,escapeHtml,richText}) {
  const $=id=>document.getElementById(id);
  const panel=document.createElement('section');
  panel.innerHTML=`
    <style>
      .control-section{margin:18px 0;padding:14px;border:1px solid #fff8;border-radius:14px;background:#0003}
      .control-section h3{margin-top:0}.control-actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      .control-list{max-height:260px;overflow:auto;display:grid;gap:8px}.control-item{padding:10px;background:#0003;border-radius:10px;overflow-wrap:anywhere}
      #adminJSON{height:260px;font:13px monospace}#adminNotice{white-space:pre-wrap;overflow-wrap:anywhere}
      .announcement-card{padding:18px;border:2px solid gold;border-radius:14px;background:#473300;margin-bottom:18px;text-align:left}
    </style>
    <p class="hint">Deploy the matching firestore.rules first. Real admins can edit all community data and promote others. Cosmetic ADMIN badges grant no permissions.</p>
    <section class="control-section"><h3>Users & roles</h3>
      <label for="adminSearch">Filter loaded users by name or UID</label><input id="adminSearch" placeholder="Username, nickname, or UID">
      <div class="control-actions"><button class="small-btn" id="adminLoadUsers">Load users (up to 200)</button></div><div class="control-list" id="adminUsers"></div>
      <label for="adminUID">Target Firebase UID</label><input id="adminUID" placeholder="Select a user or paste their UID">
      <div class="control-actions"><button class="small-btn" id="adminEditProfile">Edit profile</button><button class="small-btn" id="adminFakeOn">Add cosmetic ADMIN</button><button class="small-btn" id="adminFakeOff">Remove cosmetic ADMIN</button><button class="small-btn" id="adminPromote">Make real admin</button><button class="small-btn danger" id="adminDemote">Remove real admin</button></div>
      <p class="hint">Profile username changes affect public identity, not the original login username. Firebase Auth passwords, emails, and account deletion require a trusted backend or Firebase Console. Never put an Admin SDK key here.</p>
    </section>
    <section class="control-section"><h3>Announcements</h3>
      <label for="adminAnnTitle">Title</label><input id="adminAnnTitle" maxlength="100">
      <label for="adminAnnText">Message</label><textarea id="adminAnnText" maxlength="2000"></textarea>
      <div class="control-actions"><button class="small-btn" id="adminPublish">Publish announcement</button><button class="small-btn" id="adminBrowseAnnouncements">Manage announcements</button></div>
      <p class="hint">Edit an announcement below to change title/text or set enabled to false. Disabled announcements remain readable database records, not private drafts.</p>
    </section>
    <section class="control-section"><h3>Database explorer & full editor</h3>
      <label for="adminCollection">Collection path</label><input id="adminCollection" value="posts">
      <div class="control-actions"><button class="small-btn" id="adminBrowse">Browse (up to 200)</button></div><div class="control-list" id="adminDocuments"></div>
      <p class="hint">Collections: profiles, posts, announcements, admins, usernames; nested paths: posts/ID/comments, posts/ID/votes, posts/ID/comments/ID/likes, profiles/UID/followers and profiles/UID/following.</p>
      <label for="adminPath">Exact document path</label><input id="adminPath" placeholder="posts/POST_ID">
      <label for="adminJSON">Fields (JSON)</label><textarea id="adminJSON" spellcheck="false">{}</textarea>
      <div class="control-actions"><button class="small-btn" id="adminRead">Load</button><button class="small-btn" id="adminMerge">Merge fields</button><button class="small-btn" id="adminReplace">Replace all fields</button><button class="small-btn danger" id="adminDelete">Delete document</button></div>
      <p class="hint">Edit upvotes/likes, username/nickname snapshots, text, media URLs, featured, profile photoURL/bio/fakeAdmin, or custom fields. Counters are independent of vote/like records. Timestamp values use {"$timestamp":{"seconds":0,"nanoseconds":0}}. Replace removes omitted fields; merge keeps them. Deleting a document does NOT delete its subcollections. Use Delete Post for a complete post cleanup. Following/follower documents are mirrored: update both sides.</p>
    </section><p id="adminNotice" role="status" aria-live="polite"></p>`;
  $('adminModal').querySelector('.modal-head').after(panel);
  const notices=document.createElement('section');notices.id='communityAnnouncements';$('status').after(notices);
  let role=false,users=[],stops=[],session=0;
  const profileBadges=new Map(),realAdmins=new Set(),badgeStops=new Map();
  function notify(message){$('adminNotice').textContent=message;}
  async function requireAdmin(){const user=getUser();if(!user||!(await getDoc(doc(db,'admins',user.uid))).exists())throw Error('Real administrator access required.');return user;}
  function action(id,fn){$(id).onclick=async()=>{const button=$(id);button.disabled=true;try{await requireAdmin();await fn();}catch(error){notify(error.message);}finally{button.disabled=false;}};}
  function pathParts(value,documentPath=true){const parts=value.trim().split('/');if(parts.some(p=>!p)||parts.length%2!==(documentPath?0:1))throw Error('Invalid '+(documentPath?'document':'collection')+' path.');if(!['profiles','posts','admins','announcements','usernames'].includes(parts[0]))throw Error('This editor is scoped to community collections.');return parts;}
  function targetUID(){const uid=$('adminUID').value.trim();if(!uid||uid.includes('/'))throw Error('Select a valid Firebase UID.');return uid;}
  function encode(value){
    if(value instanceof Timestamp)return {$timestamp:{seconds:value.seconds,nanoseconds:value.nanoseconds}};
    if(value instanceof GeoPoint)return {$geo:[value.latitude,value.longitude]};
    if(value instanceof Bytes)return {$bytes:value.toBase64()};
    if(value instanceof DocumentReference)return {$ref:value.path};
    if(Array.isArray(value))return value.map(encode);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]));
    return value;
  }
  function decode(value){
    if(Array.isArray(value))return value.map(decode);
    if(value&&typeof value==='object'){
      if(Object.keys(value).length===1){
        if(value.$timestamp)return new Timestamp(value.$timestamp.seconds,value.$timestamp.nanoseconds);
        if(value.$geo)return new GeoPoint(...value.$geo);
        if(value.$bytes)return Bytes.fromBase64String(value.$bytes);
        if(value.$ref)return doc(db,value.$ref);
      }
      return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]));
    }return value;
  }
  function inputData(){const value=JSON.parse($('adminJSON').value);if(!value||Array.isArray(value)||typeof value!=='object')throw Error('Enter a JSON object.');return decode(value);}
  async function openDocument(path){await requireAdmin();pathParts(path);const snap=await getDoc(doc(db,path));$('adminPath').value=path;$('adminJSON').value=JSON.stringify(encode(snap.exists()?snap.data():{}),null,2);$('adminModal').classList.add('show');notify(snap.exists()?'Loaded '+path:'New document: '+path);$('adminPath').scrollIntoView({block:'center'});}
  function button(text,fn){const b=document.createElement('button');b.type='button';b.className='small-btn';b.textContent=text;b.onclick=async()=>{b.disabled=true;try{await requireAdmin();await fn();}catch(e){notify(e.message);$('adminModal').classList.add('show');}finally{b.disabled=false;}};return b;}
  function renderUsers(){const filter=$('adminSearch').value.toLowerCase();$('adminUsers').replaceChildren();for(const u of users){if(![u.id,u.username,u.nickname].join(' ').toLowerCase().includes(filter))continue;const row=document.createElement('div');row.className='control-item';const label=document.createElement('div');label.textContent=(u.nickname||'User')+' @'+(u.username||'')+' · '+u.id+(realAdmins.has(u.id)?' · REAL ADMIN':u.fakeAdmin?' · COSMETIC ADMIN':'');row.append(label,button('Select',()=>{$('adminUID').value=u.id;}));$('adminUsers').append(row);}}
  $('adminSearch').oninput=renderUsers;
  action('adminLoadUsers',async()=>{const snap=await getDocs(query(collection(db,'profiles'),limit(200)));users=snap.docs.map(d=>({...d.data(),id:d.id}));renderUsers();notify('Loaded '+users.length+' profiles. Paste a UID to access a user outside this page.');});
  action('adminEditProfile',()=>openDocument('profiles/'+targetUID()));
  for(const [id,value] of [['adminFakeOn',true],['adminFakeOff',false]])action(id,async()=>{const ref=doc(db,'profiles',targetUID());await runTransaction(db,async tx=>{if(!(await tx.get(ref)).exists())throw Error('Profile not found.');tx.update(ref,{fakeAdmin:value});});notify('Cosmetic badge '+(value?'added':'removed')+'. No permissions changed.');});
  action('adminPromote',async()=>{const uid=targetUID();if(!confirm('Give '+uid+' full community control, including promoting and removing other admins?'))return;if(!(await getDoc(doc(db,'profiles',uid))).exists())throw Error('Profile not found.');await setDoc(doc(db,'admins',uid),{grantedBy:getUser().uid,grantedAt:serverTimestamp()},{merge:true});notify('Real admin granted.');});
  action('adminDemote',async()=>{const uid=targetUID();if(uid===getUser().uid)throw Error('Self-removal is blocked to prevent lockout.');if(!confirm('Revoke real admin for '+uid+'?'))return;await deleteDoc(doc(db,'admins',uid));notify('Admin revoked. Cosmetic badges are separate.');});
  action('adminPublish',async()=>{const title=$('adminAnnTitle').value.trim(),text=$('adminAnnText').value.trim();if(!title||!text)throw Error('Enter a title and message.');const ref=doc(collection(db,'announcements'));await setDoc(ref,{title,text,enabled:true,createdAt:serverTimestamp(),createdBy:getUser().uid});$('adminAnnTitle').value='';$('adminAnnText').value='';notify('Announcement published.');});
  async function browse(){const parts=pathParts($('adminCollection').value,false),snap=await getDocs(query(collection(db,...parts),limit(200)));$('adminDocuments').replaceChildren();for(const d of snap.docs){const row=document.createElement('div');row.className='control-item';row.append(button(d.ref.path,()=>openDocument(d.ref.path)));$('adminDocuments').append(row);}notify('Loaded '+snap.size+' documents (maximum 200).');}
  action('adminBrowse',browse);action('adminBrowseAnnouncements',async()=>{$('adminCollection').value='announcements';await browse();});
  action('adminRead',()=>openDocument($('adminPath').value));
  async function write(mode){const parts=pathParts($('adminPath').value),path=parts.join('/');if(parts[0]==='admins')throw Error('Use Make real admin / Remove real admin for role changes.');if(path==='profiles/'+getUser().uid&&(mode==='delete'||mode==='replace'))throw Error('Deleting or replacing your own profile is blocked. Use Merge fields.');const data=mode==='delete'?null:inputData();if(!confirm(mode.toUpperCase()+' '+path+'?'+(mode==='replace'?' Omitted fields will be removed.':mode==='delete'?' Subcollections remain.':'')))return;const ref=doc(db,...parts);if(mode==='delete')await deleteDoc(ref);else await setDoc(ref,data,{merge:mode==='merge'});notify('Completed '+mode+' on '+path);}
  action('adminMerge',()=>write('merge'));action('adminReplace',()=>write('replace'));action('adminDelete',()=>write('delete'));
  function drawBadge(el){const uid=el.dataset.communityBadge;el.textContent=realAdmins.has(uid)||profileBadges.get(uid)?'ADMIN':'';el.hidden=!el.textContent;}
  function badges(){document.querySelectorAll('[data-community-badge]').forEach(el=>{
    const uid=el.dataset.communityBadge;if(!uid)return;
    if(!badgeStops.has(uid)&&getUser()){
      badgeStops.set(uid,onSnapshot(doc(db,'profiles',uid),snap=>{profileBadges.set(uid,snap.exists()&&snap.data().fakeAdmin===true);document.querySelectorAll('[data-community-badge]').forEach(drawBadge);},()=>{}));
    }drawBadge(el);
  });}
  function decorate(root,path){if(!role)return;const actions=root.querySelector('.actions,.comment-actions');if(actions)actions.append(button('Admin edit',()=>openDocument(path)));}
  function stop(){session++;stops.forEach(fn=>fn());stops=[];badgeStops.forEach(fn=>fn());badgeStops.clear();profileBadges.clear();realAdmins.clear();notices.replaceChildren();role=false;users=[];$('adminUsers').replaceChildren();$('adminDocuments').replaceChildren();$('adminJSON').value='{}';$('adminUID').value='';$('adminModal').classList.remove('show');}
  function start(uid){stop();const active=session;
    stops.push(onSnapshot(doc(db,'admins',uid),snap=>{if(active!==session)return;role=snap.exists();onRole(role);if(!role)$('adminModal').classList.remove('show');},e=>{role=false;onRole(false);notify(e.message);}));
    stops.push(onSnapshot(collection(db,'admins'),snap=>{realAdmins.clear();snap.forEach(d=>realAdmins.add(d.id));badges();renderUsers();},()=>{}));
    stops.push(onSnapshot(query(collection(db,'announcements'),orderBy('createdAt','desc'),limit(50)),snap=>{notices.replaceChildren();snap.forEach(d=>{const a=d.data();if(a.enabled===false)return;const card=document.createElement('article');card.className='announcement-card';card.innerHTML='<h3>📢 '+escapeHtml(a.title||'Announcement')+'</h3>'+richText(String(a.text||''));notices.append(card);});},e=>{notices.textContent='Announcements unavailable: '+e.message;}));
    badges();
  }
  return {start,stop,badges,decorate,openDocument};
}
