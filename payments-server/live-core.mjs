import {packFor,netCoins} from './payment-core.mjs';
export const APP='iliam-live-v1';
export function liveOrder(pi){
 const m=pi?.metadata||{},p=packFor(m.pack);
 if(pi?.livemode!==true||pi.status!=='succeeded'||pi.currency!=='usd'||!p||pi.amount!==p.cents||pi.amount_received!==p.cents||m.app!==APP||typeof m.uid!=='string'||!m.uid||m.uid.includes('/')||typeof pi.id!=='string'||!pi.id.startsWith('pi_'))return null;
 const c=pi.latest_charge;
 if(!c||typeof c!=='object'||c.livemode!==true||c.payment_intent!==pi.id||c.currency!=='usd'||c.amount!==p.cents||c.paid!==true||c.captured!==true||c.amount_captured!==p.cents||!Number.isSafeInteger(c.amount_refunded)||c.amount_refunded<0||c.amount_refunded>p.cents)return null;
 return {uid:m.uid,id:m.pack,coins:p.coins,cents:p.cents,pi:pi.id,refund:c.amount_refunded,disputed:c.disputed===true};
}
export function liveSession(session){
 const m=session?.metadata||{},p=packFor(m.pack);
 if(session?.livemode!==true||session.mode!=='payment'||session.payment_status!=='paid'||session.currency!=='usd'||!p||session.amount_total!==p.cents||m.app!==APP||typeof m.uid!=='string'||!m.uid||m.uid.includes('/')||session.client_reference_id!==m.uid||typeof session.payment_intent!=='string'||!session.payment_intent.startsWith('pi_'))return null;
 return {uid:m.uid,id:m.pack,pi:session.payment_intent};
}
export function reconcile(order,old,balance,forceDispute=false){
 if(!Number.isSafeInteger(balance)||!Number.isSafeInteger(order.refund)||order.refund<0||order.refund>order.cents)throw Error('Invalid ledger input');
 if(old.uid&&(old.uid!==order.uid||old.pack!==order.id||old.cents!==order.cents||old.coins!==order.coins))throw Error('Ledger identity mismatch');
 const prior=old.credited??0,previousRefund=old.refunded??0;
 if(!Number.isSafeInteger(prior)||prior<0||prior>order.coins||!Number.isSafeInteger(previousRefund)||previousRefund<0||previousRefund>order.cents)throw Error('Invalid existing ledger');
 const refunded=Math.max(previousRefund,order.refund),disputed=old.disputed===true||order.disputed||forceDispute;
 const credited=disputed?0:netCoins(order.coins,order.cents,refunded);
 const next=balance+credited-prior;
 if(!Number.isSafeInteger(next))throw Error('Invalid resulting balance');
 return {balance:next,refunded,disputed,credited};
}
