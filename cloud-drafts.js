import {getApps,getApp,initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app);
const allowed=new Set(['whiteboard','rider2d','rider3d']);
async function currentUser(){
 await auth.authStateReady();
 return auth.currentUser;
}
export async function loadCloudDraft(kind){
 if(!allowed.has(kind))throw new Error('Invalid project type.');
 const user=await currentUser();
 if(!user)return {user:null,content:null};
 const snap=await getDoc(doc(db,'profiles',user.uid,'drafts',kind));
 if(auth.currentUser?.uid!==user.uid)throw new Error('Account changed while loading.');
 return {user:user.uid,content:snap.exists()?snap.data().content:null};
}
export async function saveCloudDraft(kind,content){
 if(!allowed.has(kind))throw new Error('Invalid project type.');
 const user=await currentUser();
 if(!user)throw new Error('Sign in to your iLiam account to save this project.');
 if(typeof content!=='string'||new TextEncoder().encode(content).length>650000)
   throw new Error('Project is too large for cloud autosave. Export the project as a file.');
 await setDoc(doc(db,'profiles',user.uid,'drafts',kind),{content,updatedAt:serverTimestamp()});
 if(auth.currentUser?.uid!==user.uid)throw new Error('Your account changed while saving.');
 return true;
}
