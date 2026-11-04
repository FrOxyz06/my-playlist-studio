'use strict';
(()=>{
 const mode=document.getElementById('discovery-mode'),history=document.getElementById('history-controls'),help=document.getElementById('discovery-help');
 function syncMode(){const discover=mode.value==='discover';history.hidden=discover;help.textContent=discover?'Similar songs from a wider pool. Your starting song is included first.':'Only songs from your imported history. A selected starting song is included first.';}
 mode.addEventListener('change',syncMode);syncMode();
 const list=document.getElementById('tracks');
 const observer=new MutationObserver(()=>{[...list.children].forEach((row,index)=>{const seed=!!playlist[index]?.isSeed;row.classList.toggle('starting-track',seed);if(seed){row.setAttribute('aria-label','Starting song: '+playlist[index].title);if(!row.querySelector('.starting-track-label')){const label=document.createElement('span');label.className='starting-track-label';label.textContent='Starting song';row.querySelector('.song-info')?.append(label);}}});});
 observer.observe(list,{childList:true});
})();
