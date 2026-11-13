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
    '<div class="review-compose-head"><h2 class="review-compose-title">Share your thoughts</h2><span id="review-identity" class="review-identity">Sign in to review</span></div>',
    '<span class="review-rating-label">Your rating</span>',
    '<div class="review-star-row" id="review-star-row" role="group" aria-label="Star rating"></div>',
    '<textarea id="review-input" class="review-textarea" maxlength="1200" placeholder="What did you like? What could be better?"></textarea>',
    '<div class="review-compose-foot"><span id="review-character" class="review-character">0 / 1200</span><button id="review-submit" class="review-primary" type="button">Post review</button></div>',
    '<p id="review-status" class="review-state" role="status"></p>',
    '<p id="review-login-hint" class="review-login-hint" hidden>Use the Sign in button above, or <a href="community.html">visit Community</a> to manage your account.</p>',
    '</div>',
    '<div class="review-list-header"><h2>What people are saying</h2><span id="review-total" class="review-total">Loading…</span></div>',
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
    ratingHint.textContent=ratingLabels[rating];
  }
  drawRating();
  input.oninput=()=>{$("review-character").textContent=input.value.length+" / 1200";};
  function setStatus(message,error=false){status.textContent=message;status.classList.toggle("error",error);}
  function drawAuth(){
    const active=Boolean(profile);
    input.disabled=!active;post.disabled=!active;
    $("review-identity").textContent=active?"Posting as @"+profile.username:"iLiam account required";
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
  function userRow(data,showRating=false){
    const row=element("div","review-user-row");
    const initial=String(data.nickname||data.username||"U").trim().charAt(0).toUpperCase();
    row.append(element("div","review-avatar",initial));
    const details=element("div","review-user-details");
    details.append(element("div","review-name",data.nickname||data.username||"iLiam user"));
    const meta=element("div","review-meta",timeLabel(data.createdAt)+(data.username?" · @"+data.username:""));
    details.append(meta);row.append(details);
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
    // One reaction marker per emoji and account. Rules enforce ownership.
    const tools=element("div","review-actions"),buttons=new Map();
    const emojiMap={Like:"👍",Love:"❤️",Laugh:"😂"};
    const reactionsPath=replyId?["reviews",reviewId,"replies",replyId,"reactions"]:["reviews",reviewId,"reactions"];
    let mine=new Set();
    for(const [name,emoji] of Object.entries(emojiMap)){
      const b=element("button","review-action",emoji+" 0");
      b.type="button";b.setAttribute("aria-label",name+" reaction");
      b.disabled=!profile;buttons.set(name,b);tools.append(b);
      b.onclick=async()=>{
        if(!user||!profile){setStatus("Sign in to react.");return;}
        b.disabled=true;
        const marker=doc(db,...reactionsPath,user.uid+"_"+name);
        try{
          if(mine.has(name))await deleteDoc(marker);
          else await setDoc(marker,{uid:user.uid,emoji,createdAt:serverTimestamp()});
        }catch(err){setStatus("Could not update reaction: "+err.message,true);}
        finally{b.disabled=false;}
      };
    }
    childStops.push(onSnapshot(collection(db,...reactionsPath),snap=>{
      mine=new Set();const counts={Like:0,Love:0,Laugh:0};
      snap.forEach(d=>{
        const x=d.data();
        const key=Object.keys(emojiMap).find(k=>emojiMap[k]===x.emoji);
        if(key){counts[key]++;if(x.uid===user?.uid)mine.add(key);}
      });
      for(const [name,b] of buttons){
        b.textContent=emojiMap[name]+" "+counts[name];
        b.classList.toggle("active",mine.has(name));
        b.disabled=!profile;b.setAttribute("aria-pressed",String(mine.has(name)));
      }
    },err=>console.warn("Review reactions:",err.code)));
    parent.append(tools);
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
