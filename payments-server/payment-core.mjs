export const PACKS=Object.freeze({lc100:{coins:100,cents:99},lc600:{coins:600,cents:499},lc1300:{coins:1300,cents:999},lc3000:{coins:3000,cents:1999},lc8500:{coins:8500,cents:4999}});
export const packFor=id=>Object.hasOwn(PACKS,id)?PACKS[id]:null;
export function paidOrder(session){
 const id=session.metadata?.pack,uid=session.metadata?.uid,p=packFor(id);
 if(session.livemode!==false||session.metadata?.app!=='iliam-sandbox-v1'||session.mode!=='payment'||session.payment_status!=='paid'||session.currency!=='usd'||!p||session.amount_total!==p.cents||typeof uid!=='string'||!uid||uid.includes('/')||typeof session.payment_intent!=='string'||!session.payment_intent.startsWith('pi_'))return null;
 return {uid,id,coins:p.coins,cents:p.cents,pi:session.payment_intent};
}
export function netCoins(coins,cents,refunded){return Math.floor(coins*Math.max(0,cents-Math.max(0,refunded))/cents)}
