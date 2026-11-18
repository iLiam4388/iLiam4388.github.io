// iLiam Firestore retention. Run only on a trusted server / GitHub Actions.
// Never put the Firebase service-account key in browser JavaScript or this repository.
import {initializeApp,cert} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

const raw=process.env.FIREBASE_SERVICE_ACCOUNT;
if(!raw){
 console.log("Retention skipped: configure the FIREBASE_SERVICE_ACCOUNT GitHub Actions secret.");
 process.exit(0);
}
const key=JSON.parse(raw);
initializeApp({credential:cert(key),projectId:key.project_id});
const db=getFirestore();
const ACTIVE_POSTS=50,LEGACY_POSTS=200;
const PUBLIC_CHAT_HISTORY=500, DIRECT_CHAT_HISTORY=100, GROUP_CHAT_HISTORY=50;
const FETCH=300;

async function purgeOlderMessages(collectionRef,description,keep){
 // Count aggregation avoids reading 500 messages in every inactive chat.
 const count=await collectionRef.count().get();
 if(count.data().count<=keep)return 0;
 const latest=await collectionRef.orderBy("createdAt","desc").limit(keep).get();
 if(latest.size<keep)return 0;
 const cutoff=latest.docs[latest.docs.length-1];
 let cursor=cutoff,removed=0;
 while(true){
  const batch=await collectionRef.orderBy("createdAt","desc").startAfter(cursor).limit(FETCH).get();
  if(batch.empty)break;
  cursor=batch.docs[batch.docs.length-1];
  // Messages have no subcollections; deletions only run with Admin credentials.
  for(const d of batch.docs)await d.ref.delete();
  removed+=batch.size;
 }
 if(removed)console.log(description+": removed "+removed+" oldest messages");
 return removed;
}

async function retainPosts(){
 const count=await db.collection("posts").count().get();
 if(count.data().count<=ACTIVE_POSTS)return;
 let cursor=null,index=0,archived=0,removed=0;
 while(true){
  let query=db.collection("posts").orderBy("createdAt","desc").limit(FETCH);
  if(cursor)query=query.startAfter(cursor);
  const snap=await query.get();
  if(snap.empty)break;
  cursor=snap.docs[snap.docs.length-1];
  for(const post of snap.docs){
   const rank=index++;
   if(rank<ACTIVE_POSTS)continue;
   if(rank>=ACTIVE_POSTS+LEGACY_POSTS){
    // recursiveDelete removes votes, comments and likes as well as the post.
    await db.recursiveDelete(post.ref);
    removed++;
    continue;
   }
   const data=post.data();
   if(data.legacy===true)continue;
   // Completely remove nested reactions/comments before dropping their counts.
   await db.recursiveDelete(post.ref.collection("votes"));
   await db.recursiveDelete(post.ref.collection("comments"));
   await post.ref.set({
    uid:String(data.uid||""),
    username:String(data.username||"unknown"),
    text:String(data.text||""),
    createdAt:data.createdAt,
    legacy:true
   });
   archived++;
  }
 }
 console.log("Posts: "+archived+" archived, "+removed+" older than 250 deleted");
}

async function main(){
 await retainPosts();
 await purgeOlderMessages(db.collection("publicChatMessages"),"Public Chat",PUBLIC_CHAT_HISTORY);
 for await(const chat of db.collection("chats").stream()){
  const keep=chat.data().kind==="group" ? GROUP_CHAT_HISTORY : DIRECT_CHAT_HISTORY;
  await purgeOlderMessages(chat.ref.collection("messages"),"Chat "+chat.id,keep);
 }
 console.log("Community retention finished");
}
main().catch(e=>{console.error("Community retention failed",e);process.exitCode=1;});
