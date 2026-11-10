'use strict';
(()=>{
 const mode=document.getElementById('discovery-mode'),history=document.getElementById('history-controls'),help=document.getElementById('discovery-help');
 function syncMode(){const discover=mode.value==='discover';history.hidden=discover;help.textContent=discover?'Similar songs from a wider pool. Your starting song is included first.':'Only songs from your imported history. A selected starting song is included first.';}
 mode.addEventListener('change',syncMode);syncMode();
 const list=document.getElementById('tracks');
 const observer=new MutationObserver(()=>{[...list.children].forEach((row,index)=>{const seed=!!playlist[index]?.isSeed;row.classList.toggle('starting-track',seed);if(seed){row.setAttribute('aria-label','Starting song: '+playlist[index].title);if(!row.querySelector('.starting-track-label')){const label=document.createElement('span');label.className='starting-track-label';label.textContent='Starting song';(row.querySelector('.song-info')||row.querySelector('.song'))?.append(label);}}});});
 observer.observe(list,{childList:true});
})();

// Convenience controls only change the view or existing builder inputs.
(()=>{
 const count=document.getElementById('count');
 const presets=document.createElement('div');
 presets.className='length-presets';
 presets.setAttribute('role','group');
 presets.setAttribute('aria-label','Quick playlist lengths');
 for(const length of [10,25,50]){
  const button=document.createElement('button');
  button.type='button';button.textContent=length+' songs';
  button.addEventListener('click',()=>{
   count.value=String(length);
   count.dispatchEvent(new Event('input',{bubbles:true}));
   count.dispatchEvent(new Event('change',{bubbles:true}));
  });
  presets.append(button);
 }
 count.closest('.quantity-fields').append(presets);
 function syncLength(){[...presets.children].forEach((button,index)=>button.setAttribute('aria-pressed',String(Number(count.value)===[10,25,50][index])));}
 count.addEventListener('input',syncLength);count.addEventListener('change',syncLength);syncLength();

 const list=document.getElementById('tracks');
 const tools=document.createElement('div');tools.className='playlist-filter';tools.hidden=true;
 const label=document.createElement('label');label.htmlFor='playlist-filter';label.textContent='Find in this mix';
 const input=document.createElement('input');input.id='playlist-filter';input.type='search';input.placeholder='Song or artist';input.autocomplete='off';
 const status=document.createElement('span');status.setAttribute('role','status');status.className='filter-status';
 tools.append(label,input,status);document.getElementById('track-heading').before(tools);
 const empty=document.createElement('p');empty.className='filter-empty';empty.textContent='No matching tracks. Try another song or artist.';empty.hidden=true;list.after(empty);
 function filter(){
  const rows=[...list.children],query=input.value.trim().toLocaleLowerCase();let matches=0;
  for(const row of rows){const match=!query||(row.querySelector('.song')?.textContent||'').toLocaleLowerCase().includes(query);row.hidden=!match;if(match)matches++;}
  tools.hidden=!rows.length;empty.hidden=!rows.length||matches>0;
  status.textContent=query?matches+' of '+rows.length+' tracks':'';
 }
 input.addEventListener('input',filter);
 new MutationObserver(filter).observe(list,{childList:true});
 filter();
 const arrow=document.querySelector('.seed-launch>span:last-child');if(arrow)arrow.textContent='\u2197';
})();
