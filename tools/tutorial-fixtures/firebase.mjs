// Loaded exclusively by the capture runner's offline request handler.
const lesson = window.captureLesson;
export const initializeApp = () => ({});
export const getFirestore = () => ({path: ''});
const me = {uid:'demo', email:'demo@example.invalid'};
const auth = {currentUser: [2,3].includes(lesson) ? null : me};
export const getAuth = () => auth;
const observers = new Set();
export function onAuthStateChanged(_, fn) {
  observers.add(fn);
  queueMicrotask(() => fn(auth.currentUser));
  return () => observers.delete(fn);
}
export async function signInWithEmailAndPassword() {
  auth.currentUser = me;
  for (const fn of observers) await fn(me);
  return {user:me};
}
export const createUserWithEmailAndPassword = signInWithEmailAndPassword;
export async function signOut() { auth.currentUser = null; for(const fn of observers) await fn(null); }
export const deleteUser = signOut;
export class Timestamp {
  constructor(ms) { this.ms=ms; this.seconds=Math.floor(ms/1000); }
  static now(){ return new Timestamp(Date.now()); }
  static fromMillis(ms){ return new Timestamp(ms); }
  static fromDate(date){ return new Timestamp(+date); }
  toMillis(){ return this.ms; }
  toDate(){ return new Date(this.ms); }
}
export class GeoPoint {}
export class Bytes {}
export class DocumentReference {
  constructor(path) { this.path=path; this.id=path.split('/').at(-1); }
}
let serial=0;
const makePath=(base,...parts)=>[base.path,...parts].filter(Boolean).join('/');
export const doc=(base,...parts)=>new DocumentReference(makePath(base,...(parts.length?parts:['sample-'+(++serial)])));
export const collection=(base,...parts)=>({path:makePath(base,...parts)});
export const query=(ref,...constraints)=>({...ref,constraints});
export const where=(field,op,value)=>({field,op,value});
export const orderBy=(field,order)=>({field,order});
export const limit=n=>({limit:n});
export const serverTimestamp=()=>Timestamp.now();
const createdAt=Timestamp.now();
const profile=(username,nickname)=>({username,nickname,notificationDefaultsVersion:2});
const user=profile('demo_studio','Demo Studio'), friend=profile('river_demo','River'), guest=profile('sky_demo','Sky');
const records=new Map(Object.entries({
  'profiles/demo':user,'profiles/river':friend,'profiles/sky':guest,
  'posts/sketch':{...user,uid:'demo',text:'Trying out a new sketch in Whiteboard. What should I draw next?',upvotes:3,featured:true,createdAt},
  'posts/sketch/comments/comment':{...friend,uid:'river',text:'A little mountain range!',likes:1,createdAt},
  'posts/archive':{...friend,uid:'river',text:'Our first community sketch session.',legacy:true,createdAt},
  'chats/dm_demo_river':{kind:'direct',members:['demo','river'],createdBy:'demo',createdAt},
  'chats/dm_demo_river/messages/idea':{uid:'river',text:'Want to sketch together?',createdAt},
  'chats/studio':{kind:'group',title:'Sketch Club',members:['demo','river','sky'],createdBy:'demo',createdAt},
  'publicChatMessages/sketch':{uid:'river',text:'What are you drawing today?',createdAt},
  'reviews/sketch':{...friend,uid:'river',text:'I like the drawing tools in Whiteboard.',rating:5,createdAt},
  'whiteboards/1234567890abcdef1234567890abcdef':{ownerId:'river',title:'Sketch Club',paperColor:'#ffffff',accessMode:'restricted',invitedUids:['demo'],createdAt},
  'games/practice':{name:'iLiam in iLiam',url:location.origin+'/',image:location.origin+'/images/favicon.png',featured:true,enabled:true},
}));
if(lesson===21){
  records.set('groupCalls/incoming',{hostId:'river',hostName:'River',type:'video',participants:['river','demo'],status:'open',createdAt});
  records.set('groupCalls/incoming/members/demo',{uid:'demo',status:'ringing'});
}
const subscribers=new Set();
function snapshot(ref){
  if(ref instanceof DocumentReference)return {ref,id:ref.id,metadata:{fromCache:false},exists:()=>records.has(ref.path),data:()=>records.get(ref.path)};
  let docs=[...records.keys()].filter(k=>k.slice(0,k.lastIndexOf('/'))===ref.path)
    .map(k=>snapshot(new DocumentReference(k)));
  for(const c of ref.constraints||[]){
    if(c.op) docs=docs.filter(d=>c.op==='array-contains'?d.data()[c.field]?.includes(c.value):d.data()[c.field]===c.value);
    if(c.limit) docs=docs.slice(0,c.limit);
  }
  return {docs,size:docs.length,empty:!docs.length,metadata:{fromCache:false},forEach:fn=>docs.forEach(fn),docChanges:()=>docs.map(doc=>({type:'added',doc}))};
}
export async function getDoc(ref){return snapshot(ref);}
export const getDocs=getDoc, getDocsFromServer=getDoc;
export function onSnapshot(ref,...args){
  const fn=args.find(x=>typeof x==='function'),sub={ref,fn};
  subscribers.add(sub);
  queueMicrotask(()=>{if(subscribers.has(sub))fn(snapshot(ref));});
  return ()=>subscribers.delete(sub);
}
function notify(ref){
  for(const sub of subscribers)if(sub.ref.path===ref.path||sub.ref.path===ref.path.slice(0,ref.path.lastIndexOf('/')))queueMicrotask(()=>sub.fn(snapshot(sub.ref)));
}
export async function setDoc(ref,data,opt){records.set(ref.path,opt?.merge?{...records.get(ref.path),...data}:data);notify(ref);}
export async function updateDoc(ref,data){await setDoc(ref,data,{merge:true});}
export async function deleteDoc(ref){records.delete(ref.path);notify(ref);}
export async function addDoc(base,data){const ref=doc(base);await setDoc(ref,data);return ref;}
export const arrayUnion=(...values)=>values, arrayRemove=()=>[];
export const runTransaction=async(_,fn)=>fn({get:getDoc,set:setDoc,update:updateDoc,delete:deleteDoc});
export const writeBatch=()=>({set:setDoc,update:updateDoc,delete:deleteDoc,commit:async()=>{}});
