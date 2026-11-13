import {initializeApp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {getFirestore,doc,getDoc,collection,addDoc,deleteDoc,setDoc,updateDoc,onSnapshot,query,orderBy,limit,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const root=document.getElementById("iliam-reviews");
if(root){
  const app=initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app);
  let user=null,profile=null,isAdmin=false,rating=5,stopReviews=null,childStops=[],authSerial=0;
  const $=id=>root.querySelector("#"+id);
  root.innerHTML=[
    '<div class="review-compose-card">',
    '<div class="review-compose-head"><h2 class="review-compose-title">Leave a review</h2><div class="review-compose-profile"><img id="review-my-avatar" class="review-avatar" alt="Your profile picture"><span id="review-identity" class="review-identity">Sign in to review</span></div></div>',
    '<span class="review-rating-label">Your rating</span>',
    '<div class="review-star-row" id="review-star-row" role="group" aria-label="Star rating"></div>',
    '<textarea id="review-input" class="review-textarea" maxlength="1200" placeholder="What did you like? What could be better?"></textarea>',
    '<div class="review-compose-foot"><span id="review-character" class="review-character">0 / 1200</span><button id="review-submit" class="review-primary" type="button">Post review</button></div>',
    '<p id="review-status" class="review-state" role="status"></p>',
    '<p id="review-login-hint" class="review-login-hint" hidden>Use the Sign in button above, or <a href="community.html">visit Community</a> to manage your account.</p>',
    '</div>',
    '<div class="review-list-header"><h2>Recent reviews</h2><span id="review-total" class="review-total">Loading…</span></div>',
    '<div id="review-list" aria-live="polite"><div class="review-empty">Loading reviews…</div></div>'
  ].join("");
  const input=$("review-input"),post=$("review-submit"),status=$("review-status"),list=$("review-list");
  const ratingLabels=["","Terrible","Not great","Okay","Good","Excellent"];
  const stars=[],ratingHint=document.createElement("span");
  ratingHint.className="review-rating-desc";
  for(let i=1;i<=5;i++){
    const b=document.createElement("button");b.className="review-star";b.textContent="★";
    b.type="button";b.setAttribute("aria-label","Rate "+i+" star"+(i===1?"":"s"));
    b.onclick=()=>{rating=i;drawRating()};
    $("review-star-row").append(b);stars.push(b);
  }
  $("review-star-row").append(ratingHint);
  function drawRating(){
    for(let i=0;i<stars.length;i++){
      stars[i].classList.toggle("selected",i<rating);
      stars[i].setAttribute("aria-pressed",String(i+1===rating));
    }
    ratingHint.textContent=rating+" / 5 stars";
  }
  drawRating();
  input.oninput=()=>{$("review-character").textContent=input.value.length+" / 1200";};
  function setStatus(message,error=false){status.textContent=message;status.classList.toggle("error",error);}
  function drawAuth(){
    const active=Boolean(profile);
    input.disabled=!active;post.disabled=!active;
    $("review-identity").textContent=active?(profile.nickname||profile.username)+" · @"+profile.username:"iLiam account required";
    const mine=$("review-my-avatar");
    mine.hidden=!active;
    if(active){setPhoto(mine,photoCache.get(user?.uid)||profile);mine.dataset.reviewUid=user.uid;watchPhoto(user.uid);}
    $("review-login-hint").hidden=active;
    input.placeholder=active?"Tell everyone what you think about iLiam…":"Sign in to your iLiam account to write a review.";
  }
  function stopChildren(){for(const fn of childStops)fn();childStops=[];}
  function timeLabel(v){try{return v?.toDate?.().toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"} )||"Just now";}catch{return "Just now";}}
  function element(tag,cls,text){
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(text!==undefined)el.textContent=String(text);
    return el;
  }
  // Keep profile photos in sync with the same profiles/{uid}.photoURL used by Community.
  // For signed-out visitors, show a letter avatar because profiles are private.
  const photoCache=new Map(),photoListeners=new Map();
  function avatarFallback(value){
    const letter=Array.from(String(value?.nickname||value?.username||"U"))[0]?.toUpperCase()||"U";
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><rect width="100%" height="100%" rx="45" fill="#102b52"/><text x="50%" y="56%" fill="white" font-size="38" font-family="Verdana,Arial" font-weight="bold" text-anchor="middle" dominant-baseline="central">'+letter.replace(/[<&>"']/g,"")+'</text></svg>';
    return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
  }
  function photoSource(value){
    try{const u=new URL(String(value?.photoURL||""));return ["https:","http:"].includes(u.protocol)?u.href:null;}
    catch{return null;}
  }
  function setPhoto(img,value){
    const fallback=avatarFallback(value);
    img.dataset.fallback=fallback;
    const url=photoSource(value)||fallback;
    if(img.getAttribute("src")!==url)img.src=url;
  }
  function watchPhoto(uid){
    if(!user||!uid||photoListeners.has(uid))return;
    const unsub=onSnapshot(doc(db,"profiles",uid),snap=>{
      const fresh=snap.exists()?snap.data():null;
      photoCache.set(uid,fresh);
      root.querySelectorAll("img.review-avatar[data-review-uid]").forEach(img=>{
        if(img.dataset.reviewUid===uid)setPhoto(img,fresh||{nickname:img.dataset.fallbackName});
      });
      if(uid===user?.uid&&fresh){
        profile=fresh;
        drawAuth();
      }
    },err=>console.warn("Could not load review profile picture:",err.code));
    photoListeners.set(uid,unsub);
  }
  function clearPhotos(){
    for(const stop of photoListeners.values())stop();
    photoListeners.clear();photoCache.clear();
  }
  function makeAvatar(data){
    const img=element("img","review-avatar");
    img.alt=(data.nickname||data.username||"User")+"'s profile picture";
    img.referrerPolicy="no-referrer";
    img.loading="lazy";
    img.dataset.fallbackName=data.nickname||data.username||"User";
    if(data.uid)img.dataset.reviewUid=data.uid;
    img.addEventListener("error",()=>{
      if(img.src!==img.dataset.fallback)img.src=img.dataset.fallback;
    });
    const p=(data.uid&&photoCache.get(data.uid))||(data.uid===user?.uid&&profile)||data;
    setPhoto(img,p);
    if(data.uid)watchPhoto(data.uid);
    return img;
  }
  function userRow(data,showRating=false){
    const row=element("div","review-user-row");
    row.append(makeAvatar(data));
    const details=element("div","review-user-details");
    details.append(element("div","review-name",data.nickname||data.username||"iLiam user"));
    details.append(element("div","review-meta",timeLabel(data.createdAt)+(data.username?" · @"+data.username:"")));
    row.append(details);
    if(showRating&&Number.isInteger(data.rating)){
      row.append(element("span","review-stars-small","★".repeat(Math.max(0,Math.min(5,data.rating)))));
    }
    return row;
  }
  function showError(){
    list.replaceChildren();
    const box=element("div","review-error-box");
    box.append(element("strong","", "Reviews aren't available right now."));
    box.append(element("p","", "The website reached Firebase, but the database did not allow the review request. The updated Firestore rules still need to be published in Firebase."));
    const retry=element("button","review-action","Try again");retry.type="button";retry.onclick=listenReviews;
    box.append(retry);list.append(box);$("review-total").textContent="Unavailable";
  }
  function reactions(parent,reviewId,replyId){
    // Like only, matching the simple Community post actions.
    const row=element("div","review-actions");
    const like=element("button","review-action","👍 Like");
    like.type="button";like.disabled=!profile;
    row.append(like);parent.append(row);
    const path=replyId?["reviews",reviewId,"replies",replyId,"reactions"]:["reviews",reviewId,"reactions"];
    let liked=false,count=0;
    like.onclick=async()=>{
      if(!user||!profile){setStatus("Sign in to like a review.");return;}
      like.disabled=true;
      const ref=doc(db,...path,user.uid+"_Like");
      try{
        if(liked)await deleteDoc(ref);
        else await setDoc(ref,{uid:user.uid,emoji:"👍",createdAt:serverTimestamp()});
      }catch(err){setStatus("Could not update like: "+err.message,true);}
      finally{like.disabled=!profile;}
    };
    childStops.push(onSnapshot(collection(db,...path),snap=>{
      count=0;liked=false;
      snap.forEach(d=>{
        const x=d.data();
        if(x.emoji==="👍"){count++;if(x.uid===user?.uid)liked=true;}
      });
      like.textContent="👍 "+(count?count:"Like");
      like.classList.toggle("active",liked);
      like.setAttribute("aria-pressed",String(liked));
      like.disabled=!profile;
    },err=>console.warn("Review likes unavailable:",err.code)));
  }
  function replyItem(data,id,reviewId){
    const box=element("div","review-reply");
    box.append(userRow(data),element("p","review-text",data.text||""));
    const actions=element("div","review-actions");box.append(actions);
    reactions(actions,reviewId,id);
    if(user&&(isAdmin||data.uid===user.uid)){
      const del=element("button","review-action danger","Delete reply");
      del.onclick=async()=>{if(confirm("Delete this reply?"))try{await deleteDoc(doc(db,"reviews",reviewId,"replies",id));}catch(e){setStatus(e.message,true);}};
      actions.append(del);
    }
    return box;
  }
  function reviewItem(data,id){
    const box=element("article","review-item"+(data.featured?" featured":""));
    box.append(userRow(data,true));
    if(data.featured)box.append(element("div","review-featured","★ Featured review"));
    box.append(element("p","review-text",data.text||""));
    const tools=element("div","review-actions");
    box.append(tools);reactions(tools,id,null);
    const replyToggle=element("button","review-action","💬 Show replies");
    replyToggle.type="button";tools.append(replyToggle);
    if(isAdmin){
      const feature=element("button","review-action",data.featured?"Unfeature":"Feature");
      feature.onclick=async()=>{try{await updateDoc(doc(db,"reviews",id),{featured:!data.featured});}catch(e){setStatus(e.message,true)}};
      tools.append(feature);
    }
    if(user&&(isAdmin||data.uid===user.uid)){
      const del=element("button","review-action danger","Delete");
      del.onclick=async()=>{if(confirm("Delete this review?"))try{await deleteDoc(doc(db,"reviews",id));}catch(e){setStatus(e.message,true)}};
      tools.append(del);
    }
    const replyWrap=element("section","review-replies");replyWrap.hidden=true;
    const replies=element("div","");
    const form=element("form","review-reply-form");
    const field=element("input","review-reply-input");field.maxLength=500;field.placeholder=profile?"Write a reply…":"Sign in to reply";field.disabled=!profile;
    const submit=element("button","","Reply");submit.type="submit";submit.disabled=!profile;
    form.append(field,submit);
    form.onsubmit=async event=>{
      event.preventDefault();const value=field.value.trim();if(!value||!user||!profile)return;
      submit.disabled=true;
      try{
        await addDoc(collection(db,"reviews",id,"replies"),{uid:user.uid,username:profile.username,nickname:profile.nickname,text:value,createdAt:serverTimestamp()});
        field.value="";
      }catch(e){setStatus("Couldn't post reply: "+e.message,true);}
      finally{submit.disabled=false;}
    };
    replyWrap.append(replies,form);box.append(replyWrap);
    let stopReplies=null;
    replyToggle.onclick=()=>{
      replyWrap.hidden=!replyWrap.hidden;
      replyToggle.textContent=replyWrap.hidden?"💬 Show replies":"💬 Hide replies";
      if(!replyWrap.hidden&&!stopReplies){
        replies.replaceChildren(element("p","review-meta","Loading replies…"));
        stopReplies=onSnapshot(query(collection(db,"reviews",id,"replies"),orderBy("createdAt","asc")),snap=>{
          // Remove nested reactions listeners associated with the old reply elements.
          replies.replaceChildren(...snap.docs.map(d=>replyItem(d.data(),d.id,id)));
          if(snap.empty)replies.textContent="No replies yet.";
        },err=>replies.textContent="Replies unavailable: "+err.message);
        childStops.push(()=>{if(stopReplies)stopReplies();});
      }
    };
    return box;
  }
  function listenReviews(){
    if(stopReviews){stopReviews();stopReviews=null;}
    stopChildren();
    $("review-total").textContent="Loading…";
    list.replaceChildren(element("div","review-empty","Loading reviews…"));
    stopReviews=onSnapshot(query(collection(db,"reviews"),orderBy("createdAt","desc"),limit(40)),snap=>{
      stopChildren();list.replaceChildren();
      $("review-total").textContent=snap.size+" review"+(snap.size===1?"":"s");
      if(snap.empty){list.append(element("div","review-empty","No reviews yet. Be the first to share your thoughts!"));return;}
      for(const d of snap.docs)list.append(reviewItem(d.data(),d.id));
    },err=>{console.error("Reviews unavailable",err);showError();});
  }
  onAuthStateChanged(auth,async next=>{
    const serial=++authSerial;
    clearPhotos();
    user=next;profile=null;isAdmin=false;
    if(next){
      try{
        const [p,a]=await Promise.all([getDoc(doc(db,"profiles",next.uid)),getDoc(doc(db,"admins",next.uid))]);
        if(serial!==authSerial)return;
        profile=p.exists()?p.data():null;isAdmin=a.exists();
      }catch(err){console.warn("Review profile lookup:",err);}
    }
    drawAuth();listenReviews();
  });
  post.onclick=async()=>{
    const value=input.value.trim();
    if(!profile){setStatus("Sign in first.");return;}
    if(!value){setStatus("Write something before posting.");return;}
    post.disabled=true;setStatus("Posting…");
    try{
      await addDoc(collection(db,"reviews"),{uid:user.uid,username:profile.username,nickname:profile.nickname,text:value,rating,featured:false,createdAt:serverTimestamp()});
      input.value="";input.dispatchEvent(new Event("input"));setStatus("Your review was posted!");
    }catch(err){setStatus("Couldn't post review: "+err.message,true);}
    finally{post.disabled=!profile;}
  };
  drawAuth();
  listenReviews();
}
