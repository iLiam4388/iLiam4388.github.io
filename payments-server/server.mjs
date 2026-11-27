import express from 'express';
import Stripe from 'stripe';
import {initializeApp,cert} from 'firebase-admin/app';
import {readFileSync} from 'node:fs';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {packFor,paidOrder,netCoins} from './payment-core.mjs';
const key=process.env.STRIPE_API_KEY, signing=process.env.STRIPE_WEBHOOK_SECRET;
const testers=new Set((process.env.TESTER_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean));
if(!/^(sk|rk)_test_/.test(key||'')||!signing?.startsWith('whsec_')||!testers.size)throw Error('Sandbox test key, webhook secret and tester allowlist are required.');
const stripe=new Stripe(key,{apiVersion:'2026-11-18.endive'});
const projectId=process.env.FIREBASE_PROJECT_ID||'iliam-4d0c9';
const credentialPath=process.env.GOOGLE_APPLICATION_CREDENTIALS||'/etc/secrets/firebase-service-account.json';
let account;
const credentialJson=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
try{account=JSON.parse(credentialJson?.trim()?credentialJson:readFileSync(credentialPath,'utf8'))}catch(e){
 throw Error(credentialJson?.trim()?'FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON':e?.code==='ENOENT'?'Firebase secret file not found: configure FIREBASE_SERVICE_ACCOUNT_JSON or check filename and GOOGLE_APPLICATION_CREDENTIALS':'Firebase secret file unreadable or invalid JSON');
}
if(account?.type!=='service_account'||!account.client_email||!account.private_key)throw Error('Firebase secret file is not a complete service account JSON');
if(account.project_id!==projectId)throw Error('Firebase service account project does not match FIREBASE_PROJECT_ID');
const credential=cert(account);
const firebase=initializeApp({credential,projectId});
console.log('Firebase service account JSON loaded and project matches');
const db=getFirestore(firebase),auth=getAuth(firebase),app=express();
const ORIGIN='https://iliam4388.github.io',RETURN=ORIGIN+'/liam-coins.html';
const wallet=uid=>db.collection('liamSandboxWallets').doc(uid);
const ledger=pi=>db.collection('liamSandboxPayments').doc(pi);
async function applyOrder(order,refund=0){
 const record=ledger(order.pi),w=wallet(order.uid);
 await db.runTransaction(async tx=>{
  const s=await tx.get(record),old=s.data()||{},ws=await tx.get(w);
  if(old.uid&&old.uid!==order.uid)throw Error('Order identity mismatch');
  const refunded=Math.max(old.refunded||0,refund),target=netCoins(order.coins,order.cents,refunded),delta=target-(old.credited||0);
  const balance=(ws.data()?.balance||0)+delta;
  if(!Number.isSafeInteger(balance)||balance<0)throw Error('Invalid sandbox wallet balance');
  tx.set(record,{uid:order.uid,pack:order.id,coins:order.coins,cents:order.cents,refunded,credited:target,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  tx.set(w,{balance,updatedAt:FieldValue.serverTimestamp()},{merge:true});
 });
}
app.post('/webhook',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
 let event;try{event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],signing)}catch{return res.status(400).send('Invalid signature')}
 if(event.livemode!==false)return res.status(400).send('Sandbox only');
 try{
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
   const session=await stripe.checkout.sessions.retrieve(event.data.object.id);
   const order=paidOrder(session);if(order){
    const pi=await stripe.paymentIntents.retrieve(order.pi,{expand:['latest_charge']});
    const charge=pi.latest_charge;await applyOrder(order,typeof charge==='object'&&charge?charge.amount_refunded||0:0);
   }
  }else if(event.type==='charge.refunded'){
   const charge=event.data.object,pi=charge.payment_intent,m=charge.metadata||{};
   const p=packFor(m.pack);
   if(typeof pi==='string'&&m.app==='iliam-sandbox-v1'&&p&&typeof m.uid==='string'&&m.uid&&!m.uid.includes('/')&&charge.currency==='usd'&&charge.amount===p.cents){
    await applyOrder({uid:m.uid,id:m.pack,coins:p.coins,cents:p.cents,pi},charge.amount_refunded||0);
   }
  }
  // Unpaid/failed/canceled sessions never credit the wallet.
  return res.json({received:true});
 }catch{console.error('Sandbox webhook fulfillment failed',event.id);return res.status(500).send('Retry fulfillment')}
});
app.use((req,res,next)=>{
 const origin=req.headers.origin;
 if(origin&&origin!==ORIGIN)return res.status(403).json({error:'Origin not allowed'});
 res.set('Access-Control-Allow-Origin',ORIGIN);res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Authorization, Content-Type');res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.set('Cache-Control','no-store');
 if(req.method==='OPTIONS')return res.sendStatus(204);next();
});
app.use(express.json({limit:'8kb'}));
async function tester(req,res,next){
 try{const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token)return res.status(401).json({error:'Sign in first'});
 const decoded=await auth.verifyIdToken(token,true);if(!testers.has(decoded.uid))return res.status(403).json({error:'Sandbox is restricted to approved testers'});req.uid=decoded.uid;next();
 }catch(e){
  // Log only the SDK error code, never tokens, user details or credentials.
  const code=typeof e?.code==='string'&&/^[a-zA-Z0-9_\/-]{1,100}$/.test(e.code)?e.code:'unknown';
  console.warn('Sandbox Firebase auth verification failed:',code);
  if(['auth/insufficient-permission','auth/invalid-credential','auth/project-not-found','app/invalid-credential','app/no-app','auth/internal-error'].includes(code))return res.status(503).json({error:'Sandbox Firebase authentication configuration error'});
  return res.status(401).json({error:'Invalid sign-in'});
 }
}
app.get('/wallet',tester,async(req,res)=>{try{const s=await wallet(req.uid).get();res.json({balance:s.data()?.balance||0,sandbox:true})}catch{return res.status(503).json({error:'Wallet unavailable'})}});
app.post('/checkout',tester,async(req,res)=>{
 const id=req.body?.pack,p=packFor(id);if(!p)return res.status(400).json({error:'Invalid pack'});
 const attempt=req.body?.attempt;if(typeof attempt!=='string'||!/^[a-zA-Z0-9-]{16,64}$/.test(attempt))return res.status(400).json({error:'Invalid attempt'});
 const metadata={app:'iliam-sandbox-v1',uid:req.uid,pack:id};
 try{const s=await stripe.checkout.sessions.create({
 mode:'payment',ui_mode:'hosted_page',integration_identifier:'iliam-sandbox-qmztkphv',adaptive_pricing:{enabled:false},
 line_items:[{price_data:{currency:'usd',unit_amount:p.cents,product_data:{name:p.coins+' Liam Coins (SANDBOX TEST)'}},quantity:1}],
 metadata,payment_intent_data:{metadata},client_reference_id:req.uid,
 success_url:RETURN+'?coins=success&session_id={CHECKOUT_SESSION_ID}',cancel_url:RETURN+'?coins=cancel'
 },{idempotencyKey:'iliam-sandbox:'+req.uid+':'+id+':'+attempt});
 if(s.livemode!==false||!s.url)throw Error('Invalid sandbox session');res.json({url:s.url});
 }catch(e){
  // Only log structured diagnostic fields, never keys, tokens, or request bodies.
  const safe=v=>typeof v==='string'&&/^[a-zA-Z0-9_.\[\]\/-]{1,160}$/.test(v)?v:undefined;
  console.error('Sandbox Stripe checkout failed:',JSON.stringify({type:safe(e?.type),code:safe(e?.code),param:safe(e?.param),statusCode:Number.isInteger(e?.statusCode)?e.statusCode:undefined,requestId:safe(e?.requestId)}));
  res.status(503).json({error:'Sandbox checkout unavailable'});
 }
});
app.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('iLiam sandbox checkout ready'));
