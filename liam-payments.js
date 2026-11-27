import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import {firebaseConfig} from './firebase-config.js';
import {paymentConfig} from './liam-payment-config.js?v=1';
const auth=getAuth(initializeApp(firebaseConfig)),root=document.getElementById('liam-coin-packs'),shop=document.getElementById('liam-shop'),open=document.getElementById('get-liam-coins');
const packs=[['lc100',100,99],['lc600',600,499],['lc1300',1300,999],['lc3000',3000,1999],['lc8500',8500,4999]];
const backend=paymentConfig.sandbox===true&&/^https:\/\/[^\s]+$/i.test(paymentConfig.backendUrl)?paymentConfig.backendUrl.replace(/\/$/,''):'';
let current=null,busy=false,balance=null,requestVersion=0;
const status=document.getElementById('lc-payment-status'),wallet=document.getElementById('lc-sandbox-wallet'),cards=document.getElementById('lc-payment-packs');
const setStatus=(message)=>{status.textContent=message};
function show(){root.hidden=false;shop.hidden=true;open.setAttribute('aria-expanded','true');root.scrollIntoView({block:'start'});refresh();}
function hide(){root.hidden=true;shop.hidden=false;open.setAttribute('aria-expanded','false');}
open.addEventListener('click',()=>root.hidden?show():hide());
document.getElementById('lc-back-cosmetics').addEventListener('click',hide);
document.addEventListener('iliam:coin-packs',show);
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
  const btn=document.createElement('button');btn.type='button';btn.className='lc-pack-buy';btn.disabled=busy||!backend||!current;btn.textContent=busy?'Please wait…':'Test checkout';
  btn.onclick=async()=>{if(busy)return;busy=true;render();setStatus('Opening secure Stripe sandbox…');try{const result=await api('/checkout',{pack:id,attempt:crypto.randomUUID()});const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw Error('Invalid checkout URL');location.assign(url.href)}catch(e){setStatus(e.message);busy=false;render()}};
  card.append(img,name,price,btn);cards.append(card);
 }
}
async function refresh(){
 if(root.hidden)return;const v=++requestVersion;
 if(!backend){setStatus('Sandbox checkout is not connected yet. No charges can be made.');return;}
 if(!current){setStatus('Sign in through Community to test checkout.');return;}
 try{const data=await api('/wallet');if(v!==requestVersion)return;balance=data.balance;render();setStatus('Sandbox only. Test coins cannot be spent in the normal store.');}catch(e){if(v===requestVersion)setStatus(e.message)}
}
onAuthStateChanged(auth,u=>{current=u;balance=null;requestVersion++;render();if(!root.hidden)refresh();});
document.getElementById('lc-refresh-wallet').addEventListener('click',refresh);
const params=new URLSearchParams(location.search);
if(params.has('coins')){show();if(params.get('coins')==='success'){document.getElementById('lc-payment-return').textContent='Returned from Checkout. Your test LC appear only after Stripe verifies payment. Refresh test wallet to check.';}else if(params.get('coins')==='cancel'){document.getElementById('lc-payment-return').textContent='Checkout canceled. No test LC awarded.';}}
render();
