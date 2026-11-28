import express from 'express';
import Stripe from 'stripe';
import {initializeApp,cert} from 'firebase-admin/app';
import {readFileSync} from 'node:fs';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {packFor} from './payment-core.mjs';
import {APP,liveOrder,liveSession,reconcile} from './live-core.mjs';

const key=process.env.STRIPE_API_KEY, signing=process.env.STRIPE_WEBHOOK_SECRET;
const enabled=process.env.LIVE_CHECKOUT_ENABLED==='true';
const pilot=new Set((process.env.LIVE_PILOT_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean));
if(!/^rk_live_/.test(key||'')||!signing?.startsWith('whsec_')||!pilot.size)throw Error('Live restricted key, live webhook signing secret and pilot UIDs are required');
const projectId=process.env.FIREBASE_PROJECT_ID;
if(projectId!=='iliam-4d0c9')throw Error('Explicit iLiam Firebase project required');
const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()||readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS||'/etc/secrets/firebase-service-account.json','utf8'));
if(account.type!=='service_account'||account.project_id!==projectId||!account.client_email||!account.private_key)throw Error('Invalid Firebase service account');
const firebase=initializeApp({credential:cert(account),projectId});
const db=getFirestore(firebase),auth=getAuth(firebase),stripe=new Stripe(key,{apiVersion:'2026-09-30.endive'}),app=express();
const ORIGIN='https://iliam4388.github.io';
const wallet=uid=>db.collection('liamWallets').doc(uid);
const ledger=pi=>db.collection('liamLivePayments').doc(pi);
async function applyOrder(order,forceDispute=false){
 const record=ledger(order.pi),w=wallet(order.uid);
 await db.runTransaction(async tx=>{
  const [r,ws]=await Promise.all([tx.get(record),tx.get(w)]);
  if(!ws.exists)throw Error('Existing real wallet required');
  const old=r.data()||{},result=reconcile(order,old,ws.data().balance,forceDispute);
  tx.set(record,{uid:order.uid,pack:order.id,coins:order.coins,cents:order.cents,credited:result.credited,refunded:result.refunded,disputed:result.disputed,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  if(ws.data().balance!==result.balance)tx.update(w,{balance:result.balance});
 });
}
async function getOrder(pi){
 return liveOrder(await stripe.paymentIntents.retrieve(pi,{expand:['latest_charge']}));
}
app.post('/webhook',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
 let event;try{event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],signing)}catch{return res.status(400).send('Invalid signature')}
 if(event.livemode!==true)return res.status(400).send('Live events only');
 try{
  const o=event.data.object;
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
   const s=await stripe.checkout.sessions.retrieve(o.id);
   const expected=liveSession(s);
   if(expected){
    const order=await getOrder(expected.pi);
    if(!order||order.uid!==expected.uid||order.id!==expected.id)throw Error('Payment mismatch');
    await applyOrder(order);
   }else if(s.metadata?.app===APP&&s.payment_status==='paid')throw Error('Paid session validation failed');
  }else if(event.type==='charge.refunded'||event.type.startsWith('charge.dispute.')){
   const pi=typeof o.payment_intent==='string'?o.payment_intent:null;
   if(pi){
    const payment=await stripe.paymentIntents.retrieve(pi,{expand:['latest_charge']});
    if(payment.metadata?.app===APP){
     const order=liveOrder(payment);
     if(!order)throw Error('Refund/dispute payment validation failed');
     if(event.type==='charge.refunded'&&Number.isSafeInteger(o.amount_refunded))order.refund=Math.max(order.refund,o.amount_refunded);
     await applyOrder(order,event.type.startsWith('charge.dispute.'));
    }
   }else if(event.type.startsWith('charge.dispute.'))throw Error('Dispute missing payment intent');
  }
  return res.json({received:true});
 }catch{console.error('Live webhook requires retry or investigation',event.id);return res.status(500).send('Retry fulfillment')}
});
app.use((req,res,next)=>{
 const origin=req.headers.origin;
 if(origin&&origin!==ORIGIN)return res.status(403).json({error:'Origin not allowed'});
 res.set('Access-Control-Allow-Origin',ORIGIN);res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Authorization, Content-Type');res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.set('Cache-Control','no-store');
 if(req.method==='OPTIONS')return res.sendStatus(204);next();
});
app.use(express.json({limit:'8kb'}));
app.get('/health',(_req,res)=>res.json({mode:'live',checkoutEnabled:enabled}));
async function authorize(req,res,next){
 try{
  const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];
  if(!token)return res.status(401).json({error:'Sign in first'});
  const decoded=await auth.verifyIdToken(token,true);
  if(!pilot.has(decoded.uid))return res.status(403).json({error:'Live pilot is restricted'});
  req.uid=decoded.uid;next();
 }catch{return res.status(401).json({error:'Sign-in verification unavailable'})}
}
app.get('/wallet',authorize,async(req,res)=>{
 try{const s=await wallet(req.uid).get();if(!s.exists)return res.status(409).json({error:'Open the regular store to initialize your wallet first'});
 res.json({balance:s.data().balance,sandbox:false,checkoutEnabled:enabled})}catch{return res.status(503).json({error:'Wallet unavailable'})}
});
app.post('/checkout',authorize,async(req,res)=>{
 if(!enabled)return res.status(503).json({error:'Live purchases are disabled'});
 const id=req.body?.pack,p=packFor(id),attempt=req.body?.attempt;
 if(!p||typeof attempt!=='string'||!/^[a-zA-Z0-9-]{16,64}$/.test(attempt)||(req.body?.embedded!==true&&req.body?.embedded!==false))return res.status(400).json({error:'Invalid checkout request'});
 try{
  const [w,profile]=await Promise.all([wallet(req.uid).get(),db.collection('profiles').doc(req.uid).get()]);
  if(!w.exists||!profile.exists||!Number.isSafeInteger(w.data().balance))return res.status(409).json({error:'Initialize your regular wallet and profile first'});
  const metadata={app:APP,uid:req.uid,pack:id};
  const embedded=req.body.embedded===true;
  const returnUrl=ORIGIN+'/liam-coins.html?mode=live';
  const s=await stripe.checkout.sessions.create({
   mode:'payment',managed_payments:{enabled:false},adaptive_pricing:{enabled:false},allowed_payment_method_types:['card'],
   line_items:[{price_data:{currency:'usd',unit_amount:p.cents,product_data:{name:p.coins+' iLiam Coins'}},quantity:1}],
   metadata,payment_intent_data:{metadata},client_reference_id:req.uid,
   ...(embedded?{ui_mode:'embedded_page',redirect_on_completion:'never'}:{success_url:returnUrl+'&coins=success&session_id={CHECKOUT_SESSION_ID}',cancel_url:returnUrl+'&coins=cancel'})
  },{idempotencyKey:'iliam-live:'+req.uid+':'+id+':'+(embedded?'embedded':'hosted')+':'+attempt});
  if(s.livemode!==true||(embedded?!s.client_secret:!s.url)||!s.id.startsWith('cs_live_'))throw Error('Live session mismatch');
  res.json(embedded?{clientSecret:s.client_secret,sessionId:s.id}:{url:s.url,sessionId:s.id});
 }catch(e){
  console.error('Live checkout failed',typeof e?.code==='string'?e.code:'unknown');
  res.status(503).json({error:'Live checkout unavailable'});
 }
});
app.post('/checkout-status',authorize,async(req,res)=>{
 const id=req.body?.sessionId;
 if(typeof id!=='string'||!/^cs_live_[A-Za-z0-9_]{1,200}$/.test(id))return res.status(400).json({error:'Invalid live session'});
 try{
  const s=await stripe.checkout.sessions.retrieve(id);
  if(s.livemode!==true||s.metadata?.app!==APP||s.metadata?.uid!==req.uid||s.client_reference_id!==req.uid)return res.status(404).json({error:'Session not found'});
  const order=liveSession(s);let record=order?(await ledger(order.pi).get()).data():null;
  // A confirmed paid session can be fulfilled on demand when the webhook is delayed.
  // The same transactional ledger reconciles both paths, so retries do not double-credit.
  if(order&&!record){
   const verifiedOrder=await getOrder(order.pi);
   if(!verifiedOrder||verifiedOrder.uid!==req.uid||verifiedOrder.id!==order.id||verifiedOrder.pi!==order.pi)throw Error('Payment mismatch');
   await applyOrder(verifiedOrder);
   record=(await ledger(order.pi).get()).data();
  }
  res.json({sessionStatus:s.status,paid:!!order,verified:!!record&&record.uid===req.uid&&record.pack===order.id,credited:record?.uid===req.uid?record.credited:0});
 }catch{return res.status(503).json({error:'Session status unavailable'})}
});
app.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('iLiam live backend ready; new checkout '+(enabled?'pilot enabled':'disabled')));
