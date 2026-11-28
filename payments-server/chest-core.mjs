import {randomInt} from 'node:crypto';
export const CHESTS=Object.freeze({daily:{ms:86400000,rewards:[500,250,175,100]},quick:{ms:21600000,rewards:[250,130,90,50]}});
export function chestReward(kind,roll=randomInt(100)){if(!Object.hasOwn(CHESTS,kind)||!Number.isInteger(roll)||roll<0||roll>=100)throw Error('Invalid chest');return CHESTS[kind].rewards[roll<1?0:roll<11?1:roll<31?2:3];}
export function chestEligible(now,last,kind){return Object.hasOwn(CHESTS,kind)&&Number.isSafeInteger(now)&&Number.isSafeInteger(last)&&now>=last+CHESTS[kind].ms;}
