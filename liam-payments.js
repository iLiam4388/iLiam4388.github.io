import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {firebaseConfig} from './firebase-config.js';
import {paymentConfig} from './liam-payment-config.js?v=3';
const auth=getAuth(initializeApp(firebaseConfig)),root=document.getElementById('liam-coin-packs');
const packs=[['lc100',100,99],['lc600',600,499],['lc1300',1300,999],['lc3000',3000,1999],['lc8500',8500,4999]];
const backend=paymentConfig.sandbox===true&&/^https:\/\/[^\s]+$/i.test(paymentConfig.backendUrl)?paymentConfig.backendUrl.replace(/\/$/,''):'';
let current=null,busy=false,balance=null,requestVersion=0,checkout=null,checkoutVersion=0,stripe=null;
const panel=document.getElementById('lc-embedded-panel'),mount=document.getElementById('lc-embedded-checkout'),heading=document.getElementById('lc-embedded-heading'),notice=document.getElementById('lc-embedded-notice'),close=document.getElementById('lc-embedded-close'),confirmation=document.getElementById('lc-payment-return');
const key=paymentConfig.publishableKey;
const ready=typeof key==='string'&&/^pk_test_[A-Za-z0-9]+$/.test(key);
const status=document.getElementById('lc-payment-status'),wallet=document.getElementById('lc-sandbox-wallet'),cards=document.getElementById('lc-payment-packs');
const setStatus=(message)=>{status.textContent=message};
async function api(path,body){
 if(!backend||!current)throw Error('Sandbox backend is not configured or you are not signed in.');
 const token=await current.getIdToken(),res=await fetch(backend+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await res.json();if(!res.ok)throw Error(data.error||'Request failed');return data;
}
function render(){
 wallet.textContent=balance===null?'Sandbox wallet: —':'Sandbox wallet: '+balance.toLocaleString()+' test LC';
 cards.replaceChildren();
 for(const [id,coins,cents] of packs){
  const card=document.createElement('article');card.className='lc-pack-card';
  const img=document.createElement('div');img.className='lc-pack-icon';img.setAttribute('aria-hidden','true');img.textContent='LC';
  const name=document.createElement('h3');name.textContent=coins.toLocaleString()+' LC';
  const price=document.createElement('strong');price.textContent=(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
  const btn=document.createElement('button');btn.type='button';btn.className='lc-pack-buy';btn.disabled=busy||!backend||!current||!ready;btn.textContent=busy?'Checkout open':'Test checkout';
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
 if(busy||!current||!ready)return;
 const v=++checkoutVersion,uid=current.uid;busy=true;render();panel.hidden=false;
 heading.textContent=coins.toLocaleString()+' LC · '+(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
 confirmation.textContent='';notice.textContent='Loading secure test checkout…';panel.scrollIntoView({block:'start',behavior:'smooth'});
 try{
  if(typeof window.Stripe!=='function')throw Error('Stripe.js could not load. Refresh the page and try again.');
  stripe ||= window.Stripe(key);
  const result=await api('/checkout',{pack:id,attempt:crypto.randomUUID(),embedded:true});
  if(v!==checkoutVersion||current?.uid!==uid)return;
  if(typeof result.clientSecret!=='string'||!result.clientSecret.startsWith('cs_test_')||typeof result.sessionId!=='string'||!result.sessionId.startsWith('cs_test_'))throw Error('Embedded sandbox checkout is not ready. Deploy the latest payment server and refresh.');
  const options={fetchClientSecret:async()=>result.clientSecret,onComplete:()=>{if(v===checkoutVersion&&current?.uid===uid){closeCheckout();confirmOrder(result.sessionId,uid,checkoutVersion);}}};
  const create=stripe.createEmbeddedCheckoutPage||stripe.initEmbeddedCheckout;
  if(typeof create!=='function')throw Error('Embedded Stripe Checkout is unavailable in this browser.');
  const instance=await create.call(stripe,options);
  if(v!==checkoutVersion||current?.uid!==uid){instance.destroy();return;}
  checkout=instance;checkout.mount('#lc-embedded-checkout');notice.textContent='Use a Stripe test card only. No real money will be charged.';
 }catch(e){if(v===checkoutVersion){closeCheckout();setStatus(e.message||'Unable to open test checkout');}}
}
async function confirmOrder(sessionId,uid,version){
 confirmation.textContent='Checkout completed. Waiting for verified test coins…';
 for(let i=0;i<10;i++){
  if(current?.uid!==uid||checkoutVersion!==version)return;
  try{
   const result=await api('/checkout-status',{sessionId});
   if(current?.uid!==uid||checkoutVersion!==version)return;
   if(result.verified){confirmation.textContent='Stripe verified your test purchase. '+result.credited.toLocaleString()+' test LC credited (after any refunds).';await refresh();return;}
  }catch{}
  if(i<9)await new Promise(resolve=>setTimeout(resolve,2000));
 }
 if(current?.uid===uid&&checkoutVersion===version){confirmation.textContent='Checkout completed. Verification may still be pending; use Refresh test wallet to check.';refresh();}
}
async function refresh(){
 if(root.hidden)return;const v=++requestVersion;
 if(!backend){setStatus('Sandbox checkout is not connected yet. No charges can be made.');return;}
 if(!current){setStatus('Sign in through Community to test checkout.');return;}
 if(!ready){setStatus('A Stripe sandbox publishable key is required for embedded checkout.');return;}
 try{const data=await api('/wallet');if(v!==requestVersion)return;balance=data.balance;render();setStatus('Sandbox only. Test coins cannot be spent in the normal store.');}catch(e){if(v===requestVersion)setStatus(e.message)}
}
onAuthStateChanged(auth,u=>{if(current?.uid!==u?.uid){closeCheckout();confirmation.textContent='';}current=u;balance=null;requestVersion++;render();if(!root.hidden)refresh();});
document.getElementById('lc-refresh-wallet').addEventListener('click',refresh);
const params=new URLSearchParams(location.search);
if(params.has('coins')){if(params.get('coins')==='success'){document.getElementById('lc-payment-return').textContent='Returned from Checkout. Your test LC appear only after Stripe verifies payment. Refresh test wallet to check.';}else if(params.get('coins')==='cancel'){document.getElementById('lc-payment-return').textContent='Checkout canceled. No test LC awarded.';}}
render();
