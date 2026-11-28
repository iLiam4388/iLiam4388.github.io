// Live admin-managed Store and LC package features. No price or payment logic lives here.
import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {getFirestore,doc,getDoc,onSnapshot,runTransaction} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
const app=getApps().length?getApp():initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);
const featuredRef=doc(db,'liamStoreConfig','featured');
export function watchFeatured(callback){return onSnapshot(featuredRef,s=>{const data=s.data()||{};callback({products:Array.isArray(data.products)?data.products:[],packs:Array.isArray(data.packs)?data.packs:[]})},e=>console.warn('Store highlights unavailable',e));}
export async function isFeaturedAdmin(uid){return Boolean(uid&&(await getDoc(doc(db,'admins',uid))).exists());}
export async function toggleFeatured(section,id){
 if(!['products','packs'].includes(section)||typeof id!=='string'||id.length>100)throw Error('Invalid feature selection');
 const account=auth.currentUser;if(!account||!(await isFeaturedAdmin(account.uid)))throw Error('Admin access required');
 await runTransaction(db,async tx=>{const current=(await tx.get(featuredRef)).data()||{};const products=Array.isArray(current.products)?current.products:[],packs=Array.isArray(current.packs)?current.packs:[];const target=section==='products'?products:packs;const updated=target.includes(id)?target.filter(v=>v!==id):[...target,id];if(updated.length>(section==='products'?100:5))throw Error('Too many featured items');tx.set(featuredRef,{products:section==='products'?updated:products,packs:section==='packs'?updated:packs});});
}
