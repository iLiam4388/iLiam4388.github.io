export function createRewardCelebration({amount,label,message:messageText,onDone}){
  const el=document.createElement('div');el.className='lc-reward-overlay';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
  const panel=document.createElement('div');panel.className='lc-reward-card';
  const burst=document.createElement('div');burst.className='lc-reward-burst';burst.setAttribute('aria-hidden','true');
  for(let i=0;i<12;i++){const spark=document.createElement('span');spark.className='lc-reward-spark';spark.style.setProperty('--angle',i*30+'deg');spark.style.setProperty('--distance',(70+(i%3)*15)+'px');burst.append(spark);}
  const coin=document.createElement('div');coin.className='lc-reward-coin';coin.setAttribute('aria-hidden','true');coin.textContent='LC';burst.append(coin);
  const title=document.createElement('strong');title.className='lc-reward-amount';title.textContent='+'+amount.toLocaleString();
  const subtitle=document.createElement('span');subtitle.className='lc-reward-label';subtitle.textContent=label;
  const message=document.createElement('span');message.className='lc-reward-success';message.textContent=messageText;
  const done=document.createElement('button');done.type='button';done.className='lc-reward-done';done.textContent='Continue';done.onclick=onDone;
  panel.append(burst,title,subtitle,message,done);el.append(panel);document.body.append(el);
 return el;
}
