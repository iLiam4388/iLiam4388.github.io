import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {firebaseConfig} from './firebase-config.js';
import {paymentConfig as sandboxConfig,livePaymentConfig} from './liam-payment-config.js?v=5';
const live=new URLSearchParams(location.search).get('mode')==='live';
const paymentConfig=live?livePaymentConfig:sandboxConfig;
const prefix=live?'cs_live_':'cs_test_';
const modeName=live?'Live':'Sandbox';
const coinsName=live?'LC':'test LC';
const auth=getAuth(initializeApp(firebaseConfig)),root=document.getElementById('liam-coin-packs');
const packs=[['lc100',100,99],['lc600',600,499],['lc1300',1300,999],['lc3000',3000,1999],['lc8500',8500,4999]];
const checkoutConfigured=live?paymentConfig.enabled===true:paymentConfig.sandbox===true;
const backend=(live||paymentConfig.sandbox===true)&&/^https:\/\/[^\s]+$/i.test(paymentConfig.backendUrl)?paymentConfig.backendUrl.replace(/\/$/,''):'';
let current=null,busy=false,balance=null,requestVersion=0,checkout=null,checkoutVersion=0,stripe=null,liveAuthorized=false;
const panel=document.getElementById('lc-embedded-panel'),mount=document.getElementById('lc-embedded-checkout'),heading=document.getElementById('lc-embedded-heading'),notice=document.getElementById('lc-embedded-notice'),close=document.getElementById('lc-embedded-close'),confirmation=document.getElementById('lc-payment-return');
const key=paymentConfig.publishableKey;
const ready=typeof key==='string'&&(live?/^pk_live_[A-Za-z0-9]+$/:/^pk_test_[A-Za-z0-9]+$/).test(key);
const status=document.getElementById('lc-payment-status'),wallet=document.getElementById('lc-sandbox-wallet'),cards=document.getElementById('lc-payment-packs');
const setStatus=(message)=>{status.textContent=message};
setStatus('Checking your iLiam sign-in…');
if(live){
 root.querySelector('.lc-payment-badge').textContent=checkoutConfigured?'LIVE PAYMENT PILOT · REAL MONEY':'LIVE WALLET VERIFICATION · CHECKOUT DISABLED';
 root.querySelector('.lc-payment-note').textContent='Real one-time purchases for approved adult pilot users only. iLiam Coins are spendable on iLiam cosmetics, not redeemable for cash or transferable. Live checkout is disabled until approved.';
 document.getElementById('lc-refresh-wallet').textContent='Refresh wallet';
 heading.textContent='Live checkout';
 notice.textContent='Real money will be charged if you complete checkout.';
}

async function api(path,body){
 if(live&&!checkoutConfigured&&path!=='/wallet')throw Error('Live checkout is disabled on the website.');
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
 wallet.textContent=modeName+' wallet: '+(balance===null?'—':balance.toLocaleString()+' '+coinsName);
 cards.replaceChildren();
 for(const [id,coins,cents] of packs){
  const card=document.createElement('article');card.className='lc-pack-card';
  const img=document.createElement('div');img.className='lc-pack-icon';img.setAttribute('aria-hidden','true');img.textContent='LC';
  const name=document.createElement('h3');name.textContent=coins.toLocaleString()+' LC';
  const price=document.createElement('strong');price.textContent=(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
  const btn=document.createElement('button');btn.type='button';btn.className='lc-pack-buy';btn.disabled=busy||!backend||!current||!ready||!checkoutConfigured||(live&&!liveAuthorized);btn.textContent=busy?'Checkout open':live?'Buy coins':'Test checkout';
  btn.onclick=()=>openCheckout(id,coins,cents);
  card.append(img,name,price,btn);cards.append(card);
 }
}
function closeCheckout(){
 checkoutVersion++;if(checkout){try{checkout.destroy()}catch{}checkout=null;}
 mount.replaceChildren();panel.hidden=true;busy=false;render();
}
close.addEventListener('click',()=>{closeCheckout();setStatus('Checkout closed. Any completed payment is still verified by Stripe.');refresh();});
async function openCheckout(id,coins,cents){
 if(busy||!current||!ready||!backend||!checkoutConfigured||(live&&!liveAuthorized))return;
 const v=++checkoutVersion,uid=current.uid;busy=true;render();panel.hidden=false;
 heading.textContent=coins.toLocaleString()+' LC · '+(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
 confirmation.textContent='';notice.textContent='Loading secure '+(live?'live':'test')+' checkout…';panel.scrollIntoView({block:'start',behavior:'smooth'});
 try{
  if(typeof window.Stripe!=='function')throw Error('Stripe.js could not load. Refresh the page and try again.');
  stripe ||= window.Stripe(key);
  const result=await api('/checkout',{pack:id,attempt:crypto.randomUUID(),embedded:true});
  if(v!==checkoutVersion||current?.uid!==uid)return;
  if(typeof result.clientSecret!=='string'||!result.clientSecret.startsWith(prefix)||typeof result.sessionId!=='string'||!result.sessionId.startsWith(prefix))throw Error('Embedded checkout is not ready. Deploy the latest payment server and refresh.');
  const options={fetchClientSecret:async()=>result.clientSecret,onComplete:()=>{if(v===checkoutVersion&&current?.uid===uid){closeCheckout();confirmOrder(result.sessionId,uid,checkoutVersion);}}};
  const create=stripe.createEmbeddedCheckoutPage||stripe.initEmbeddedCheckout;
  if(typeof create!=='function')throw Error('Embedded Stripe Checkout is unavailable in this browser.');
  const instance=await create.call(stripe,options);
  if(v!==checkoutVersion||current?.uid!==uid){instance.destroy();return;}
  checkout=instance;checkout.mount('#lc-embedded-checkout');notice.textContent=live?'This is a real purchase. Only use your own authorized payment method.':'Use a Stripe test card only. No real money will be charged.';
 }catch(e){if(v===checkoutVersion){closeCheckout();setStatus(e.message||'Unable to open checkout');}}
}
async function confirmOrder(sessionId,uid,version){
 confirmation.textContent='Checkout completed. Waiting for verified coins…';
 for(let i=0;i<10;i++){
  if(current?.uid!==uid||checkoutVersion!==version)return;
  try{
   const result=await api('/checkout-status',{sessionId});
   if(current?.uid!==uid||checkoutVersion!==version)return;
   if(result.verified){confirmation.textContent='Stripe verified your '+(live?'':'test ')+'purchase. '+result.credited.toLocaleString()+' '+coinsName+' credited (after any refunds or disputes).';await refresh();return;}
  }catch{}
  if(i<9)await new Promise(resolve=>setTimeout(resolve,2000));
 }
 if(current?.uid===uid&&checkoutVersion===version){confirmation.textContent='Checkout completed. Verification may still be pending; use the wallet refresh button to check.';refresh();}
}
async function refresh(){
 if(root.hidden)return;const v=++requestVersion;
 if(!backend){setStatus(modeName+' checkout is not enabled. No charges can be made.');return;}
 if(!current){setStatus('Sign in through Community to access checkout.');return;}
 if(!ready&&!live){setStatus('A matching Stripe publishable key is required for embedded checkout.');return;}
 setStatus(live?'Connecting to live wallet… The free Render service may need to wake up.':'Connecting to sandbox wallet…');
 try{const data=await api('/wallet');if(v!==requestVersion)return;if(data.sandbox!==!live)throw Error('Payment environment mismatch');if(!Number.isSafeInteger(data.balance))throw Error('Wallet returned an invalid balance');balance=data.balance;liveAuthorized=live&&checkoutConfigured&&data.checkoutEnabled===true;render();setStatus(live?(liveAuthorized?'Live pilot: real money purchases.':'Live wallet verified. Real purchases remain disabled.'):'Sandbox only. Test coins cannot be spent in the normal store.');}catch(e){if(v===requestVersion){liveAuthorized=false;render();setStatus(e.message)}}
}
onAuthStateChanged(auth,u=>{if(current?.uid!==u?.uid){closeCheckout();confirmation.textContent='';}current=u;balance=null;liveAuthorized=false;requestVersion++;render();if(!root.hidden)refresh();},()=>{liveAuthorized=false;balance=null;render();setStatus('Firebase sign-in could not be verified. Sign in again through Community.');});
document.getElementById('lc-refresh-wallet').addEventListener('click',refresh);
const params=new URLSearchParams(location.search);
if(!live&&params.has('coins')){if(params.get('coins')==='success'){document.getElementById('lc-payment-return').textContent='Returned from Checkout. Your test LC appear only after Stripe verifies payment. Refresh test wallet to check.';}else if(params.get('coins')==='cancel'){document.getElementById('lc-payment-return').textContent='Checkout canceled. No test LC awarded.';}}
render();
