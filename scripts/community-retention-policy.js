// Shared retention policy for the Firebase cleanup job and local test page.
export const ACTIVE_POSTS=50;
export const LEGACY_POSTS=200;
export const PUBLIC_CHAT_HISTORY=500;
export const DIRECT_CHAT_HISTORY=100;
export const GROUP_CHAT_HISTORY=50;

export function postRetentionState(rank){
 if(!Number.isInteger(rank)||rank<0)throw new RangeError("Post rank must be a nonnegative integer.");
 return rank<ACTIVE_POSTS?"active":rank<ACTIVE_POSTS+LEGACY_POSTS?"legacy":"deleted";
}

export function chatRetentionLimit(kind){
 return kind==="group"?GROUP_CHAT_HISTORY:DIRECT_CHAT_HISTORY;
}
