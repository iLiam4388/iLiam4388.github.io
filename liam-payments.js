import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {firebaseConfig} from './firebase-config.js';
import {paymentConfig as sandboxConfig,livePaymentConfig} from './liam-payment-config.js?v=6';
// Production is the default; sandbox remains an explicit test route.
const live=new URLSearchParams(location.search).get('mode')!=='sandbox';
const paymentConfig=live?livePaymentConfig:sandboxConfig;
const prefix=live?'cs_live_':'cs_test_';
const modeName=live?'Live':'Sandbox';
const coinsName=live?'LC':'test LC';
const auth=getAuth(initializeApp(firebaseConfig)),root=document.getElementById('liam-coin-packs');
const packs=[['lc100',100,99],['lc600',600,499],['lc1300',1300,999],['lc3000',3000,1999],['lc8500',8500,4999]];
const checkoutConfigured=live?paymentConfig.enabled===true:paymentConfig.sandbox===true;
const backend=(live||paymentConfig.sandbox===true)&&/^https:\/\/[^\s]+$/i.test(paymentConfig.backendUrl)?paymentConfig.backendUrl.replace(/\/$/,''):'';
let current=null,busy=false,balance=null,requestVersion=0,checkout=null,checkoutVersion=0,liveAuthorized=false,pending=null,polling=false;
const confirmation=document.getElementById('lc-payment-return');
const ready=!!backend;
const params=new URLSearchParams(location.search);
const returnedFromCheckout=['success','cancel'].includes(params.get('coins'));
const validSession=id=>typeof id==='string'&&id.startsWith(prefix)&&/^[A-Za-z0-9_]{1,220}$/.test(id);
const pendingKey=uid=>'iliam-checkout-'+modeName+'-'+uid;
const savePending=id=>{pending=id;try{if(current){if(id)sessionStorage.setItem(pendingKey(current.uid),id);else sessionStorage.removeItem(pendingKey(current.uid));}}catch{}};
const status=document.getElementById('lc-payment-status'),wallet=document.getElementById('lc-sandbox-wallet'),cards=document.getElementById('lc-payment-packs');
const setStatus=(message)=>{status.textContent=message};
setStatus('Checking your iLiam sign-in…');
if(live){
 root.querySelector('.lc-payment-badge').textContent=checkoutConfigured?'SECURE CHECKOUT':'CHECKOUT UNAVAILABLE';
 root.querySelector('.lc-payment-note').textContent='One-time purchases for approved adult users. iLiam Coins can be spent on cosmetics and cannot be transferred or redeemed for cash.';
 document.getElementById('lc-refresh-wallet').textContent='Refresh';


}

function rewardAmount(result){return result?.verified===true&&Number.isSafeInteger(result.credited)&&result.credited>0?result.credited:0;}
function showReward(result,sessionId,uid){
 const amount=rewardAmount(result);if(!amount)return;
 if(document.visibilityState==='hidden'){const visible=()=>{if(document.visibilityState==='visible'){document.removeEventListener('visibilitychange',visible);if(current?.uid===uid)showReward(result,sessionId,uid);}};document.addEventListener('visibilitychange',visible);return;}
 const key='iliam-reward-shown-'+uid+'-'+sessionId;
 try{if(localStorage.getItem(key))return;localStorage.setItem(key,'1')}catch{}
 const el=document.createElement('div');el.className='lc-reward-overlay';el.setAttribute('role','status');
 const coin=document.createElement('div');coin.className='lc-reward-coin';coin.textContent='LC';
 const title=document.createElement('strong');title.textContent='+'+amount.toLocaleString()+' new iLiam Coins!';
 el.append(coin,title);document.body.append(el);setTimeout(()=>el.remove(),4200);
}

async function api(path,body){
 if(live&&!checkoutConfigured&&path==='/checkout')throw Error('Live checkout is disabled on the website.');
 if(!backend||!current)throw Error('Payment backend is not configured or you are not signed in.');
 const account=current,controller=new AbortController();
 let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('The payment server or sign-in took too long. Refresh your wallet to retry.'));},90000)});
 try{return await Promise.race([timeout,(async()=>{
  const token=await account.getIdToken();if(controller.signal.aborted||current?.uid!==account.uid)throw Error('Sign-in changed. Try again.');
  const res=await fetch(backend+path,{signal:controller.signal,method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await res.json().catch(()=>null);if(!res.ok)throw Error(data?.error||'Payment server returned HTTP '+res.status);
  if(!data)throw Error('Payment server returned an unexpected response');return data;
 })()]);}catch(e){if(e?.name==='AbortError')throw Error('Payment server request timed out. Refresh your wallet to retry.');if(e instanceof TypeError)throw Error('Cannot reach the payment server. Check your connection, then refresh your wallet.');throw e;}finally{clearTimeout(timer);}

}
function render(){
 wallet.textContent='Balance: '+(balance===null?'—':balance.toLocaleString()+' '+coinsName);
 cards.replaceChildren();
 if(returnedFromCheckout)return;
 for(const [id,coins,cents] of packs){
  const card=document.createElement('article');card.className='lc-pack-card';
  const img=document.createElement('div');img.className='lc-pack-icon';img.setAttribute('aria-hidden','true');img.textContent='LC';
  const name=document.createElement('h3');name.textContent=coins.toLocaleString()+' LC';
  const price=document.createElement('strong');price.textContent=(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
  const btn=document.createElement('button');btn.type='button';btn.className='lc-pack-buy';btn.disabled=busy||!!pending||!backend||!current||!ready||!checkoutConfigured||(live&&!liveAuthorized);btn.textContent=(busy||pending)?'Checkout pending':live?'Buy coins':'Test checkout';
  btn.onclick=()=>openCheckout(id,coins,cents);
  card.append(img,name,price,btn);cards.append(card);
 }
}
function closeCheckout(keepReturnWindow=false){
 checkoutVersion++;polling=false;
 if(checkout){if(!keepReturnWindow)try{checkout.close()}catch{}checkout=null;}
 busy=false;render();
}
async function openCheckout(id,coins,cents){
 if(returnedFromCheckout||busy||pending||!current||!ready||!backend||!checkoutConfigured||(live&&!liveAuthorized))return;
 // Open synchronously on the click so popup blockers can recognize user activation.
 const mobile=/Android|iPhone|iPad|iPod|Mobile|Tablet|Silk/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)||navigator.userAgentData?.mobile===true;
 const popup=mobile?window.open('about:blank','_blank'):window.open('about:blank','_blank','popup,width=560,height=780,resizable=yes,scrollbars=yes');
 if(!popup){setStatus('Your browser blocked the payment window. Allow popups for iLiam and try again. No checkout was created.');return;}
 const v=++checkoutVersion,uid=current.uid;polling=false;checkout=popup;busy=true;render();
 try{
  popup.opener=null;
  popup.document.title='iLiam secure checkout';
  popup.document.body.textContent='Opening secure Stripe checkout…';
 }catch{}

 confirmation.textContent='';
 try{
  const result=await api('/checkout',{pack:id,attempt:crypto.randomUUID(),embedded:false});
  if(v!==checkoutVersion||current?.uid!==uid){try{popup.close()}catch{}return;}
  const url=new URL(result.url);
  if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||url.username||url.password||url.port||!validSession(result.sessionId))throw Error('Hosted Stripe checkout is not ready. Deploy the latest payment server and refresh.');
  if(popup.closed)throw Error('The payment window was closed before checkout loaded.');
  savePending(result.sessionId);
  popup.location.replace(url.href);


  confirmOrder(result.sessionId,uid,v);
 }catch(e){if(v===checkoutVersion){closeCheckout();setStatus('Unable to open checkout. Please try again.');}}
}
const resultDelay=i=>document.visibilityState==='hidden'?5000:i<12?1200:i<40?2000:4000;
let wakePaymentPoll=null;
function waitPaymentPoll(ms){return new Promise(resolve=>{const done=()=>{clearTimeout(timer);if(wakePaymentPoll===done)wakePaymentPoll=null;resolve()};const timer=setTimeout(done,ms);wakePaymentPoll=done;});}
async function confirmOrder(sessionId,uid,version){
 if(polling||!validSession(sessionId)||current?.uid!==uid)return;
 polling=true;
 confirmation.textContent='Checking Stripe for verified payment…';
 try{
  for(let i=0;i<100;i++){
   if(current?.uid!==uid||checkoutVersion!==version)return;
   try{
    const result=await api('/checkout-status',{sessionId});
    if(current?.uid!==uid||checkoutVersion!==version)return;
    if(result.verified){
     savePending(null);
     closeCheckout(true);
     confirmation.textContent='Purchase verified.';showReward(result,sessionId,uid);
     await refresh();return;
    }
    if(result.sessionStatus==='expired'){
     savePending(null);closeCheckout();confirmation.textContent='Checkout expired. No verified coins were awarded.';await refresh();return;
    }
    if(checkout?.closed&&result.sessionStatus==='open'&&!result.paid){savePending(null);closeCheckout();confirmation.textContent='Checkout window closed. Any completed payment will still be credited automatically.';await refresh();return;}
    confirmation.textContent=result.paid?'Payment received. Delivering your coins…':'Complete your purchase in Stripe.';
   }catch(e){if(current?.uid===uid&&checkoutVersion===version)confirmation.textContent='Unable to verify payment right now. Please try again.';}
   if(i<99)await waitPaymentPoll(resultDelay(i));
  }
  if(current?.uid===uid&&checkoutVersion===version){confirmation.textContent='Payment verification is pending. Select Refresh to check again.';render();}
 }finally{if(checkoutVersion===version)polling=false;}
}
async function refresh(){
 if(root.hidden)return;const v=++requestVersion;
 if(!backend){setStatus(modeName+' checkout is not enabled. No charges can be made.');return;}
 if(!current){setStatus('Sign in through Community to access checkout.');return;}
 if(!ready){setStatus('Payment backend is not configured.');return;}
 setStatus('');
 try{const data=await api('/wallet');if(v!==requestVersion)return;if(data.sandbox!==!live)throw Error('Payment environment mismatch');if(!Number.isSafeInteger(data.balance))throw Error('Wallet returned an invalid balance');balance=data.balance;liveAuthorized=live&&checkoutConfigured&&data.checkoutEnabled===true;render();setStatus(live?(liveAuthorized?'':'Purchases are currently unavailable for this account.'):'Sandbox only. Test coins cannot be spent in the normal store.');}catch(e){if(v===requestVersion){liveAuthorized=false;render();setStatus('Unable to load your balance. Please try again.')}}
}
function checkPending(){if(current&&pending){if(polling)wakePaymentPoll?.();else confirmOrder(pending,current.uid,checkoutVersion);}}
onAuthStateChanged(auth,u=>{
 if(current?.uid!==u?.uid){closeCheckout();confirmation.textContent='';pending=null;}
 current=u;balance=null;liveAuthorized=false;requestVersion++;render();
 if(!root.hidden)refresh();
 if(u){
  let stored;try{stored=sessionStorage.getItem(pendingKey(u.uid))}catch{}
  const returned=params.get('coins')==='success'?params.get('session_id'):null;
  if(validSession(returned))savePending(returned);else if(validSession(stored))pending=stored;
  if(params.get('coins')==='cancel')confirmation.textContent='Returned from Checkout without completing payment. You may close this window.';
  checkPending();
 }
},()=>{liveAuthorized=false;balance=null;render();setStatus('Firebase sign-in could not be verified. Sign in again through Community.');});
document.getElementById('lc-refresh-wallet').addEventListener('click',()=>{refresh();checkPending();});
window.addEventListener('focus',()=>{if(current){refresh();checkPending();}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&current)checkPending();});
if(returnedFromCheckout){
 const exit=document.createElement('button');exit.type='button';exit.className='lc-pack-buy';exit.textContent='Close payment window';exit.onclick=()=>{window.close();if(!window.closed)confirmation.textContent='You may close this tab and return to iLiam. Coins are only credited after verified payment.';};
 root.querySelector('.lc-payment-actions').prepend(exit);
}
render();
