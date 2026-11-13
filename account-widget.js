import {initializeApp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const mount=document.getElementById("iliam-account");
if(mount){
  const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
  mount.innerHTML='<button class="account-button" type="button" id="iliam-account-toggle">👤 Sign in</button><div class="account-panel" id="iliam-account-panel" hidden><p id="iliam-account-label"></p><a href="community.html">Open Community profile</a><p></p><button id="iliam-account-signout" type="button">Sign out</button></div>';
  const button=mount.querySelector("#iliam-account-toggle");
  const menu=mount.querySelector("#iliam-account-panel");
  const label=mount.querySelector("#iliam-account-label");
  const overlay=document.createElement("div");
  overlay.id="iliam-login-overlay";overlay.hidden=true;
  overlay.innerHTML=[
    '<div class="login-card" role="dialog" aria-modal="true" aria-labelledby="iliam-login-title">',
    '<div class="login-head"><h2 id="iliam-login-title">Sign in to iLiam</h2><button class="login-close" id="iliam-login-close" type="button" aria-label="Close">✕</button></div>',
    '<p class="login-hint">Use your iLiam Community username and password. This is the same account.</p>',
    '<div class="login-tabs"><button type="button" class="login-tab active" id="iliam-login-tab">Log in</button><button type="button" class="login-tab" id="iliam-signup-tab">Sign up</button></div>',
    '<form id="iliam-login-form"><label for="iliam-login-username">Username</label><input id="iliam-login-username" autocomplete="username" maxlength="20" required>',
    '<div id="iliam-signup-nickname" hidden><label for="iliam-login-nickname">Display name</label><input id="iliam-login-nickname" maxlength="24" autocomplete="nickname"></div>',
    '<label for="iliam-login-password">Password</label><input id="iliam-login-password" type="password" autocomplete="current-password" minlength="6" required>',
    '<div id="iliam-signup-confirm" hidden><label for="iliam-login-confirm">Confirm password</label><input id="iliam-login-confirm" type="password" autocomplete="new-password"></div>',
    '<button class="login-submit" id="iliam-login-submit" type="submit">Log in</button></form>',
    '<p class="login-error" id="iliam-login-error" role="alert"></p></div>'
  ].join("");
  document.body.append(overlay);
  const $=id=>overlay.querySelector("#"+id);
  let mode="login",user=null,profile=null,creating=false;
  function setMode(next){
    mode=next;const signup=next==="signup";
    $("iliam-signup-nickname").hidden=!signup;
    $("iliam-signup-confirm").hidden=!signup;
    $("iliam-login-tab").classList.toggle("active",!signup);
    $("iliam-signup-tab").classList.toggle("active",signup);
    $("iliam-login-title").textContent=signup?"Create an iLiam account":"Sign in to iLiam";
    $("iliam-login-submit").textContent=signup?"Create account":"Log in";
    $("iliam-login-password").autocomplete=signup?"new-password":"current-password";
    $("iliam-login-error").textContent="";
  }
  function close(){overlay.hidden=true;$("iliam-login-error").textContent="";}
  function refreshButton(){
    button.textContent=profile?"👤 "+(profile.nickname||profile.username):user?"👤 Account setup":"👤 Sign in";
    label.textContent=profile?(profile.nickname||profile.username)+" · @"+profile.username:"Account";
  }
  button.onclick=()=>{
    if(profile)menu.hidden=!menu.hidden;
    else{menu.hidden=true;overlay.hidden=false;$("iliam-login-username").focus();}
  };
  $("iliam-login-close").onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close();};
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.hidden)close();});
  $("iliam-login-tab").onclick=()=>setMode("login");
  $("iliam-signup-tab").onclick=()=>setMode("signup");
  mount.querySelector("#iliam-account-signout").onclick=async()=>{menu.hidden=true;await signOut(auth);};
  async function loadProfile(current){
    if(!current){profile=null;refreshButton();return;}
    try{
      const snap=await getDoc(doc(db,"profiles",current.uid));
      if(auth.currentUser?.uid!==current.uid)return;
      profile=snap.exists()?snap.data():null;
      refreshButton();
      if(profile)close();
      else $("iliam-login-error").textContent="This account has no profile. Open Community to finish setup.";
    }catch(e){$("iliam-login-error").textContent="Could not load profile: "+e.message;refreshButton();}
  }
  onAuthStateChanged(auth,async current=>{
    user=current;profile=null;refreshButton();
    if(current&&!creating)await loadProfile(current);
  });
  $("iliam-login-form").onsubmit=async e=>{
    e.preventDefault();
    const username=$("iliam-login-username").value.trim().toLowerCase().replace(/[^a-z0-9_]/g,"");
    const password=$("iliam-login-password").value,nickname=$("iliam-login-nickname").value.trim();
    const submit=$("iliam-login-submit"),error=$("iliam-login-error");
    error.textContent="";
    if(username.length<3){error.textContent="Username must have at least three characters.";return;}
    if(password.length<6){error.textContent="Password must have at least six characters.";return;}
    if(mode==="signup"&&(!nickname||password!==$("iliam-login-confirm").value)){
      error.textContent="Enter a display name and matching passwords.";return;
    }
    submit.disabled=true;
    try{
      const email=username+"@users.iliam.app";
      if(mode==="signup"){
        creating=true;
        const result=await createUserWithEmailAndPassword(auth,email,password);
        await setDoc(doc(db,"profiles",result.user.uid),{
          username,nickname,photoURL:"",createdAt:serverTimestamp()
        });
        creating=false;user=result.user;await loadProfile(result.user);
      }else await signInWithEmailAndPassword(auth,email,password);
      $("iliam-login-password").value="";$("iliam-login-confirm").value="";
    }catch(ex){
      error.textContent=/invalid-credential|wrong-password|user-not-found/.test(ex.code||"")?"Incorrect username or password.":
        /email-already-in-use/.test(ex.code||"")?"That username is taken. Log in instead.":ex.message;
    }finally{creating=false;submit.disabled=false;}
  };
}
