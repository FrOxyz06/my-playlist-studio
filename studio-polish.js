'use strict';

// UI controller for the listening workspace. The existing engine and OAuth modules own the data operations.

(() => {

  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');

  const icons = {

    music: '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',

    close: '<path d="m6 6 12 12M6 18 18 6"/>'

  };

  const descriptions = {

    balanced: 'The songs you return to, with a little variety.',

    recent: 'Your latest favorites, measured from your newest exported listen.',

    rediscover: 'Older favorites that deserve a place in your rotation again.',

    shuffle: 'A different order. An unexpected combination. Still your collection.'

  };

  let removed = null;

  let spin = null;

  const motion = new Set();

  const text = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };

  function icon(name) {

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    svg.setAttribute('viewBox', '0 0 24 24');

    svg.setAttribute('width', '20'); svg.setAttribute('height', '20');

    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');

    svg.setAttribute('stroke-width', '1.7'); svg.setAttribute('stroke-linecap', 'round');

    svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');

    svg.classList.add('icon'); svg.innerHTML = icons[name];

    return svg;

  }

  function animate(node, frames, options) {

    if (motionPreference.matches || !node.animate) return null;

    const animation = node.animate(frames, options);

    motion.add(animation);

    animation.finished.catch(() => {}).finally(() => motion.delete(animation));

    return animation;

  }

  function spinRecord() {

    if (motionPreference.matches) {

      text('desk-state', playlist.length ? 'Your mix is ready' : 'Ready for your collection');

      return;

    }

    if (spin) spin.cancel();

    spin = animate(document.querySelector('.record'), [

      { transform: 'rotate(-18deg)' }, { transform: 'rotate(342deg)' }

    ], { duration: 1250, easing: 'cubic-bezier(.18,.65,.2,1)' });

  }

  function sync() {

    const loaded = summary.tracks.some(track => track.qualified);

    const ready = playlist.length > 0;

    const connected = SpotifyConnection.connected();

    document.body.classList.toggle('is-connected', connected);

    document.body.classList.toggle('is-importing', $('files').disabled);

    $('clear').hidden = !plays.length;

    $('track-heading').hidden = !ready;

    $('sample-note').hidden = !demo;

    text('rail-summary', loaded ? (demo ? 'Sample collection' : 'Your collection') + ': ' + summary.tracks.length + ' songs.' : 'Your listening history is the starting point.');

    text('builder-state', ready ? 'Adjust and make it again' : loaded ? 'Your collection is ready' : 'Start with your collection');

    text('connection-label', connected ? (window.studioProfile?.display_name || 'Spotify connected') : 'Spotify not connected');

    text('mix-description', descriptions[$('mix').value]);

    text('desk-state', ready ? playlist.length + ' songs in this mix' : loaded ? 'Collection loaded' : 'Ready for your collection');

    text('cover-title', window.studioSeed?.title || 'Choose your starting song');

    text('cover-caption', window.studioSeed?.artist || 'On your record');

    document.querySelectorAll('[data-mix]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mix === $('mix').value)));

    const status = $('spotify-status');

    if ($('save-feedback').innerHTML !== status.innerHTML) {

      $('save-feedback').replaceChildren(...Array.from(status.childNodes, node => node.cloneNode(true)));

    }

    if (!loaded) { text('title', 'Your next rotation'); text('stats', 'Your mix will appear here.'); }

  }

  function discardUndo() { removed = null; $('undo-toast').hidden = true; }

  function revealTracks() {

    Array.from($('tracks').children).slice(0, 14).forEach((row, index) => animate(row,

      [{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],

      {duration:380,delay:Math.min(index*30,270),easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}));

  }

  function removeTrack(track, index) {

    removed = {track,index};

    playlist = playlist.filter(item => item.key !== track.key);

    render();

    $('undo-toast').hidden = false;

    animate($('undo-toast'), [{opacity:0,translate:'0 8px'},{opacity:1,translate:'0 0'}], {duration:180,easing:'ease-out'});

    const neighbor = $('tracks').children[Math.min(index,playlist.length-1)]?.querySelector('.remove');

    (neighbor || $('undo-remove')).focus({preventScroll:true});

  }

  render = function () {

    $('tracks').replaceChildren();

    $('empty').hidden = playlist.length > 0;

    $('exports').hidden = !playlist.length;

    text('badge', (demo ? 'Sample / ' : '') + playlist.length + (playlist.length === 1 ? ' song' : ' songs'));

    for (const [index, track] of playlist.entries()) {

      const row = document.createElement('li');

      const number = document.createElement('span'); number.className='number'; number.textContent=String(index+1).padStart(2,'0');

      const song = document.createElement('div'); song.className='song';

      const artwork = document.createElement('span'); artwork.className='track-art'; artwork.setAttribute('aria-hidden','true'); artwork.append(icon('music'));

      const info = document.createElement('div'); info.className='song-info';

      const link = document.createElement('a'); link.textContent=track.title; link.href=E.url(track); link.target='_blank'; link.rel='noopener noreferrer';

      const artist = document.createElement('small'); artist.textContent=track.artist;

      info.append(link,artist); song.append(artwork,info);

      const reason = document.createElement('span'); reason.className='track-reason'; reason.textContent=track.reason;

      const remove = document.createElement('button'); remove.type='button'; remove.className='remove'; remove.setAttribute('aria-label','Remove '+track.title); remove.append(icon('close')); remove.onclick=()=>removeTrack(track,index);

      row.append(number,song,remove); $('tracks').append(row);

    }

    sync();

  };

  $('undo-remove').onclick = () => {

    if (removed && !playlist.some(track => track.key === removed.track.key)) {

      const index = Math.min(removed.index,playlist.length); playlist.splice(index,0,removed.track); render();

      const row=$('tracks').children[index];

      animate(row,[{opacity:0,transform:'translateX(-8px)'},{opacity:1,transform:'translateX(0)'}],{duration:220,easing:'ease-out'});

      row.querySelector('.remove').focus({preventScroll:true});

    }

    discardUndo();

  };

  $('dismiss-undo').onclick = () => { discardUndo(); $('title').focus({preventScroll:true}); };

  document.querySelectorAll('[data-mix]').forEach(button => button.onclick = () => {

    $('mix').value=button.dataset.mix; $('mix').dispatchEvent(new Event('change',{bubbles:true}));

    animate($('mix-description'),[{opacity:0},{opacity:1}],{duration:200});

  });

  $('mix').addEventListener('change', sync);

  $('name').addEventListener('input', sync);

  $('make').addEventListener('click', event => {

    for (const id of ['count','cap']) if (!$(id).disabled && !$(id).reportValidity()) { event.stopImmediatePropagation(); return; }

  },true);

  $('make').addEventListener('click', () => {

    discardUndo(); if (!playlist.length) return;

    spinRecord(); revealTracks();

    if (matchMedia('(max-width:640px)').matches) {

      $('title').focus({preventScroll:true});

      $('title').scrollIntoView({behavior:motionPreference.matches?'instant':'smooth',block:'start'});

    }

  });

  $('motion-preview').onclick=spinRecord;

  $('empty-demo').onclick=()=>{ $('demo').click(); $('make').click(); };

  $('direction').addEventListener('change', () => { if ($('direction').value==='genre') $('artist-labels').open=true; });

  for (const id of ['clear','demo','files']) $(id).addEventListener(id==='files'?'change':'click',()=>{discardUndo();if(id==='demo')spinRecord();});

  document.querySelectorAll('a[href="#artist-labels"]').forEach(link=>link.addEventListener('click',()=>{$('artist-labels').open=true;}));

  document.querySelectorAll('.nav-item').forEach(link=>link.addEventListener('click',()=>{

    document.querySelectorAll('.nav-item').forEach(item=>{item.classList.remove('active');item.removeAttribute('aria-current');});

    link.classList.add('active');link.setAttribute('aria-current','page');

  }));

  for (const id of ['tracks','stats','spotify-status']) new MutationObserver(sync).observe($(id),{childList:true,subtree:true,characterData:true});

  new MutationObserver(sync).observe($('files'),{attributes:true,attributeFilter:['disabled']});

  motionPreference.addEventListener('change',event=>{if(event.matches)motion.forEach(animation=>animation.cancel());});

  // One initial reveal introduces the physical record. Other motion responds to actions.

  animate(document.querySelector('.turntable'),[{opacity:0,transform:'translateY(10px) rotate(-2deg)'},{opacity:1,transform:'translateY(0) rotate(0)'}],{duration:550,easing:'cubic-bezier(.2,.8,.2,1)'});

  sync();

})();



// Connection settings live in an on-demand dialog.

(()=>{const panel=document.getElementById('connection');document.querySelectorAll('a[href="#connection"]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();if(!panel.open)panel.showModal();}));panel.querySelector('.connection-close').addEventListener('click',()=>panel.close());panel.addEventListener('click',event=>{if(event.target===panel){const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)panel.close();}});})();



(()=>{let seed=null,version=0;const recentPicks=[];const q=document.getElementById('seed-query'),type=document.getElementById('seed-type'),status=document.getElementById('seed-status'),results=document.getElementById('seed-results'),search=document.getElementById('seed-search'),clear=document.getElementById('seed-clear');async function choose(item){seed=item;window.studioSeed=item;if(!item.image&&SpotifyConnection.connected()){try{const found=await SpotifyConnection.api('/search?'+new URLSearchParams({q:'track:'+item.title+' artist:'+item.artist,type:'track',limit:5}));const match=found.tracks?.items?.find(t=>E.norm(t.name)===E.norm(item.title)&&t.artists.some(a=>E.norm(a.name)===E.norm(item.artist)));if(seed!==item)return;if(match)item={...item,image:match.album?.images?.filter(i=>i.url.startsWith('https://i.scdn.co/')).sort((a,b)=>(b.width||0)-(a.width||0))[0]?.url};}catch{}}document.getElementById('seed-chosen-title').textContent=item.title;document.querySelector('.desk-bottom strong').textContent=item.title;document.getElementById('seed-chosen-artist').textContent=item.artist+' · Change selection';document.getElementById('music-picker').close();const recentKey=item.uri||item.artist+'|'+item.title;const oldPick=recentPicks.findIndex(p=>(p.uri||p.artist+'|'+p.title)===recentKey);if(oldPick>=0)recentPicks.splice(oldPick,1);recentPicks.unshift(item);recentPicks.splice(4);const shelf=document.getElementById('recent-picks');shelf.replaceChildren();for(const pick of recentPicks){const button=document.createElement('button');button.className='recent-pick';button.title=pick.title+' · '+pick.artist;if(pick.image){const art=document.createElement('img');art.src=pick.image;art.alt='';button.append(art);}const name=document.createElement('span');name.textContent=pick.title;button.append(name);button.addEventListener('click',()=>choose(pick));shelf.append(button);}results.replaceChildren();clear.hidden=false;status.textContent='Starting with '+item.title+' · '+item.artist+'. Mixes follow listening connections across artists and your genre labels.';document.querySelector('.record-art')?.remove();if(item.image){const img=document.createElement('img');img.className='record-art';img.crossOrigin='anonymous';img.addEventListener('load',()=>{img.classList.add('art-ready');try{const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,24,24);const data=ctx.getImageData(0,0,24,24).data;let best=[80,110,100],score=-1;for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b),light=(max+min)/510,sat=(max-min)/255;const rank=sat*(1-Math.abs(light-.5));if(light>.15&&light<.85&&rank>score){score=rank;best=[r,g,b];}}const [r,g,b]=best;const mix=(white)=>'rgb('+best.map(v=>Math.round(v*(1-white)+255*white)).join(',')+')';const dark='rgb('+best.map(v=>Math.round(v*.35)).join(',')+')';const root=document.documentElement;root.style.setProperty('--accent',dark);root.style.setProperty('--accent-soft',mix(.88));root.style.setProperty('--canvas',mix(.96));root.style.setProperty('--rail',mix(.91));root.style.setProperty('--desk-color',mix(.85));root.style.setProperty('--deck-color',mix(.72));root.style.setProperty('--cover-tint',mix(.55));}catch{}});img.src=item.image;img.alt=item.title+' cover';document.querySelector('.record').append(img);const badge=document.querySelector('.seed-launch-icon');badge.replaceChildren();const thumb=document.createElement('img');thumb.src=item.image;thumb.alt='';badge.append(thumb);}}async function find(){const query=q.value.trim();if(!query){status.textContent='Enter a song or artist name.';return;}const ticket=++version;results.replaceChildren();status.textContent='Searchingâ€¦';try{let items;if(type.value==='history'){items=summary.tracks.filter(t=>(t.title+' '+t.artist).toLowerCase().includes(query.toLowerCase())).slice(0,8);if(!summary.tracks.length)throw Error('Import history first, or choose Spotify search.');}else{if(!SpotifyConnection.connected())throw Error('Connect Spotify using the Spotify connection link, then search again.');const data=await SpotifyConnection.api('/search?'+new URLSearchParams({q:query,type:type.value,limit:8}));items=(data[type.value==='track'?'tracks':'albums']?.items||[]).filter(Boolean).map(t=>({title:t.name,artist:t.artists.map(a=>a.name).join(', '),artists:t.artists.map(a=>a.name),image:(t.album?.images||t.images||[]).filter(i=>i.url.startsWith('https://i.scdn.co/')).sort((a,b)=>(b.width||0)-(a.width||0))[0]?.url,uri:t.uri}));}if(ticket!==version)return;status.textContent=items.length?'Choose your starting point.':'No matches. Try the title and artist.';for(const item of items){const button=document.createElement('button');button.className='seed-result';if(item.image){const img=document.createElement('img');img.src=item.image;img.alt='';button.append(img);}const text=document.createElement('span');text.textContent=item.title;const artist=document.createElement('small');artist.textContent=item.artist;text.append(artist);button.append(text);button.addEventListener('click',()=>choose(item));results.append(button);}}catch(error){if(ticket===version)status.textContent=error.message;}finally{if(ticket===version)search.disabled=false;}}let suggestionTimer;q.addEventListener('input',()=>{clearTimeout(suggestionTimer);++version;results.replaceChildren();if(q.value.trim().length<2){status.textContent='Type at least 2 characters for song suggestions.';return;}suggestionTimer=setTimeout(find,350);});search.addEventListener('click',()=>{clearTimeout(suggestionTimer);find();});q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(suggestionTimer);find();}});clear.addEventListener('click',()=>{document.getElementById('seed-chosen-title').textContent='Choose a song';document.getElementById('seed-chosen-artist').textContent='Set the starting point for your mix';document.querySelector('.seed-launch-icon').textContent='ï¼‹';window.studioSeed=null;seed=null;['--accent','--accent-soft','--canvas','--rail','--desk-color','--deck-color','--cover-tint'].forEach(key=>document.documentElement.style.removeProperty(key));clear.hidden=true;document.querySelector('.record-art')?.remove();status.textContent='Choose a starting point for your mix.';});

// Opening the picker offers starting tracks before a search is entered.

let idleRevision=0;

let suggestionBag=[],suggestionPoolKey='',previousSuggestions=[];

function nextSuggestions(pool,count){

 const key=pool.map(t=>t.uri||t.artist+'|'+t.title).sort().join('\n');

 if(key!==suggestionPoolKey){suggestionPoolKey=key;suggestionBag=[];previousSuggestions=[];}

 const selected=[];

 while(selected.length<Math.min(count,pool.length)){

  if(!suggestionBag.length){suggestionBag=pool.slice();for(let i=suggestionBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[suggestionBag[i],suggestionBag[j]]=[suggestionBag[j],suggestionBag[i]];}suggestionBag.sort((a,b)=>Number(previousSuggestions.includes(a))-Number(previousSuggestions.includes(b)));}

  const eligible=t=>!selected.includes(t);

  const artistKey=t=>E.norm(t.artists?.[0]||t.artist);

  const freshArtist=t=>!selected.some(s=>artistKey(s)===artistKey(t));

  const freshStyle=t=>!t.style||!selected.some(s=>s.style===t.style);

  let index=suggestionBag.findIndex(t=>eligible(t)&&freshArtist(t)&&freshStyle(t));

  if(index<0)index=suggestionBag.findIndex(t=>eligible(t)&&freshArtist(t));

  if(index<0)index=suggestionBag.findIndex(eligible);

  if(index<0)break;

  selected.push(suggestionBag.splice(index,1)[0]);

 }

 previousSuggestions=selected;

 return selected;

}

async function showStartingTracks(){

 if(q.value.trim())return;

 const ticket=++version;const idleTicket=++idleRevision;

 const favorites=summary.tracks.filter(t=>t.qualified>0).map(t=>({...t,style:(labels[E.norm(t.artist)]||[])[0]})).sort((a,b)=>b.qualified-a.qualified);

 const pool=favorites.length?favorites:[

  {image:'https://i.scdn.co/image/ab67616d00001e028863bc11d2aa12b54f5aeb36',uri:'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',style:'pop',title:'Blinding Lights',artist:'The Weeknd'},

  {image:'https://i.scdn.co/image/ab67616d00001e0271d62ea7ea8a5be92d3c1f62',uri:'spotify:track:6dOtVTDdiauQNBQEDOtlAB',style:'alternative',title:'BIRDS OF A FEATHER',artist:'Billie Eilish'},

  {image:'https://i.scdn.co/image/ab67616d00001e02c5649add07ed3720be9d5526',uri:'spotify:track:3xKsf9qdS1CyvXSMEid6g8',style:'soul',title:'Pink + White',artist:'Frank Ocean'},

  {image:'https://i.scdn.co/image/ab67616d00001e02bc18bdade69ec5ef0bb25b17',uri:'spotify:track:4PMqSO5qyjpvzhlLI5GnID',style:'rnb',title:'Good Days',artist:'SZA'},

  {image:'https://i.scdn.co/image/ab67616d00001e022945110fe698cd4271892c69',uri:'spotify:track:5R3mdf4GdDgLNVqMEeNJzB',style:'electronic',title:'Get Lucky',artist:'Daft Punk'},

  {image:'https://i.scdn.co/image/ab67616d00001e02eb832efe061888ee7ef10456',uri:'spotify:track:1lbXEepatjRVjoG8pZMtdp',style:'rock',title:'Dreams',artist:'Fleetwood Mac'}

,

  {"title":"Shape of You","image":"https://i.scdn.co/image/ab67616d00001e02ba5db46f4b838ef6027e6f96","artist":"Ed Sheeran","artists":["Ed Sheeran"],"style":"pop","uri":"spotify:track:7qiZfU4dY1lWllzX7mPBI3"},

  {"title":"Mr. Brightside","image":"https://i.scdn.co/image/ab67616d00001e029c284a6855f4945dc5a3cd73","artist":"The Killers","artists":["The Killers"],"style":"rock","uri":"spotify:track:3n3Ppam7vgaVa1iaRUc9Lp"},

  {"title":"Time is Running Out","image":"https://i.scdn.co/image/ab67616d00001e028cb690f962092fd44bbe2bf4","artist":"Muse","artists":["Muse"],"style":"rock","uri":"spotify:track:2takcwOaAZWiXQijPHIx7B"},

  {"title":"One More Time","image":"https://i.scdn.co/image/ab67616d00001e021e81bff9807a9e629fce5ade","artist":"Daft Punk","artists":["Daft Punk"],"style":"electronic","uri":"spotify:track:0DiWol3AO6WpXZgp0goxAV"},

  {"title":"Billie Jean","image":"https://i.scdn.co/image/ab67616d00001e024121faee8df82c526cbab2be","artist":"Michael Jackson","artists":["Michael Jackson"],"style":"pop","uri":"spotify:track:5ChkMS8OtdzJeqyybCc9R5"},

  {"title":"Enemy (with JID) - from the series Arcane League of Legends","image":"https://i.scdn.co/image/ab67616d00001e02aa597e50829169e6994eb403","artist":"Imagine Dragons, JID","artists":["Imagine Dragons","JID"],"style":"rock","uri":"spotify:track:1r9xUipOqoNwggBpENDsvJ"},

  {"title":"Never Gonna Give You Up","image":"https://i.scdn.co/image/ab67616d00001e02255e131abc1410833be95673","artist":"Rick Astley","artists":["Rick Astley"],"style":"pop","uri":"spotify:track:4uLU6hMCjMI75M1A2tKUQC"},

  {"title":"Yellow","image":"https://i.scdn.co/image/ab67616d00001e029164bafe9aaa168d93f4816a","artist":"Coldplay","artists":["Coldplay"],"style":"alternative","uri":"spotify:track:3AJwUDP919kvQ9QcozQPxg"},

  {"title":"Despacito","image":"https://i.scdn.co/image/ab67616d00001e02ef0d4234e1a645740f77d59c","artist":"Luis Fonsi, Daddy Yankee","artists":["Luis Fonsi","Daddy Yankee"],"style":"latin","uri":"spotify:track:6habFhsOp2NvshLv26DqMb"},

  {"title":"Mask Off","image":"https://i.scdn.co/image/ab67616d00001e02e0b64c8be3c4e804abcb2696","artist":"Future","artists":["Future"],"style":"hip-hop","uri":"spotify:track:0VgkVdmE4gld66l8iyGjgx"},

  {"title":"Pumped Up Kicks","image":"https://i.scdn.co/image/ab67616d00001e02121d5f92cf90576907dfb1e5","artist":"Foster The People","artists":["Foster The People"],"style":"indie","uri":"spotify:track:7w87IxuO7BDcJ3YUqCyMTT"},

  {"title":"Ain't No Sunshine","image":"https://i.scdn.co/image/ab67616d00001e02f64b9ea8a8a409c6af86134f","artist":"Bill Withers","artists":["Bill Withers"],"style":"soul","uri":"spotify:track:1k1Bqnv2R0uJXQN4u6LKYt"}

 ];

 const items=nextSuggestions(pool,6);

 results.replaceChildren();status.textContent=favorites.length?(demo?'From the sample collection':'Your favorites · Pick one or search for something else'):'A few starting points · Pick a song or search above';

 const toolbar=document.createElement('div');toolbar.className='suggestion-toolbar';

 const heading=document.createElement('h3');heading.className='picker-suggestions-title';heading.textContent='Find your starting song';const headingGroup=document.createElement('div');headingGroup.className='suggestion-heading-group';const hint=document.createElement('p');hint.className='suggestion-caption';hint.textContent=favorites.length?'Picked from your collection':'A little inspiration to get started';headingGroup.append(heading,hint);

 const reroll=document.createElement('button');reroll.type='button';reroll.className='secondary suggestion-reroll';const refreshIcon=document.createElementNS('http://www.w3.org/2000/svg','svg');refreshIcon.setAttribute('viewBox','0 0 24 24');refreshIcon.setAttribute('fill','none');refreshIcon.setAttribute('stroke','currentColor');refreshIcon.setAttribute('stroke-width','1.7');refreshIcon.setAttribute('stroke-linecap','round');refreshIcon.setAttribute('stroke-linejoin','round');refreshIcon.setAttribute('aria-hidden','true');refreshIcon.innerHTML='<path d="M20 5v5h-5M4 19v-5h5"/><path d="M5.5 9a7 7 0 0 1 11.55-2.6L20 10M4 14l2.95 3.6A7 7 0 0 0 18.5 15"/>';reroll.append(refreshIcon);reroll.title='Refresh suggestions';reroll.setAttribute('aria-label','Refresh song suggestions');

 reroll.addEventListener('click',()=>{showStartingTracks();const next=results.querySelector('.suggestion-reroll');next?.focus({preventScroll:true});if(!matchMedia('(prefers-reduced-motion:reduce)').matches){next?.querySelector('svg')?.animate([{transform:'rotate(-180deg)'},{transform:'rotate(0deg)'}],{duration:500,easing:'cubic-bezier(.16,1,.3,1)'});results.querySelectorAll('.suggested-track').forEach((row,index)=>row.animate([{opacity:0},{opacity:1}],{duration:260,delay:index*20,easing:'ease-out',fill:'backwards'}));}});toolbar.append(headingGroup,reroll);results.append(toolbar);results.scrollTop=0;

 const rows=[];

 for(const item of items){

  const button=document.createElement('button');button.type='button';button.className='seed-result suggested-track';button.setAttribute('aria-label','Choose '+item.title+' by '+item.artist);

  const art=document.createElement('span');art.className='suggested-art';art.textContent='â™ª';art.setAttribute('aria-hidden','true');

  if(item.image){const img=document.createElement('img');img.src=item.image;img.alt='';img.addEventListener('error',()=>art.replaceChildren(document.createTextNode('â™ª')),{once:true});art.replaceChildren(img);}

  const text=document.createElement('span');text.textContent=item.title;const artist=document.createElement('small');artist.textContent=item.artist;text.append(artist);

  button.append(art,text);button.addEventListener('click',()=>choose(item));results.append(button);rows.push({item,art});

 }

 if(!SpotifyConnection.connected())return;

 for(const {item,art} of rows){

  if(item.image)continue;

  if(ticket!==version||idleTicket!==idleRevision||q.value.trim())return;

  try{

   const data=await SpotifyConnection.api('/search?'+new URLSearchParams({q:'track:'+item.title+' artist:'+item.artist,type:'track',limit:5}));

   if(ticket!==version||idleTicket!==idleRevision)return;

   const match=data.tracks?.items?.find(t=>E.norm(t.name)===E.norm(item.title)&&t.artists.some(a=>E.norm(a.name)===E.norm(item.artist)));

   if(!match)continue;

   item.uri=match.uri;item.artists=match.artists.map(a=>a.name);

   item.image=match.album?.images?.filter(i=>i.url.startsWith('https://i.scdn.co/')).sort((a,b)=>(b.width||0)-(a.width||0))[0]?.url;

   if(item.image){const img=document.createElement('img');img.src=item.image;img.alt='';art.replaceChildren(img);}

  }catch{ /* Suggestions remain usable without artwork. */ }

 }

}

document.getElementById('open-music-picker').addEventListener('click',()=>{clearTimeout(suggestionTimer);q.value='';showStartingTracks();});

q.addEventListener('input',()=>{if(!q.value.trim())showStartingTracks();});

const originalBuild=E.build;E.build=function(collection,options={}){if(!seed)return originalBuild(collection,options);const artists=(seed.artists||[seed.artist]).map(E.norm),genres=new Set(artists.flatMap(a=>options.labels?.[a]||[]).map(E.norm));const seedTracks=collection.tracks.filter(t=>artists.includes(E.norm(t.artist)));const exact=seedTracks.find(t=>E.norm(t.title)===E.norm(seed.title));const anchors=(exact?.dates?.length?exact.dates:seedTracks.flatMap(t=>t.dates)).slice().sort((a,b)=>a-b);if(!anchors.length&&!genres.size){document.getElementById('seed-status').textContent='This song has no listening-history or genre connection yet. Import history containing this artist to personalize its mix.';return [];}const affinity=t=>{if(artists.includes(E.norm(t.artist)))return 1;let near=0;for(const date of t.dates){let lo=0,hi=anchors.length;while(lo<hi){const mid=(lo+hi)>>>1;if(anchors[mid]<date)lo=mid+1;else hi=mid;}const distance=Math.min(Math.abs(date-(anchors[lo]??Infinity)),Math.abs(date-(anchors[lo-1]??-Infinity)));if(distance<=86400000)near+=Math.exp(-distance/7200000);}const shared=(options.labels?.[E.norm(t.artist)]||[]).some(g=>genres.has(E.norm(g)));return near/Math.sqrt(Math.max(1,t.dates.length)*Math.max(1,anchors.length))+(shared?.55:0);};const related=collection.tracks.map(t=>({...t,connection:affinity(t)})).filter(t=>t.connection>0&&t.key!==exact?.key).sort((a,b)=>b.connection-a.connection);const pool=related.slice(0,100);const built=originalBuild({...collection,tracks:pool},{...options,count:100,cap:100});built.sort((a,b)=>(b.connection*(1+Math.log1p(Math.max(0,b.score))*.15))-(a.connection*(1+Math.log1p(Math.max(0,a.score))*.15)));const result=[],counts=new Map();for(const t of built){const artist=E.norm(t.artist);if(options.direction!=='artist'&&(counts.get(artist)||0)>=100)continue;result.push({...t,reason:artists.includes(artist)?'Same artist as your starting song':(options.labels?.[artist]||[]).some(g=>genres.has(E.norm(g)))?'Shares your genre labels':'Often heard near your starting song in your history'});counts.set(artist,(counts.get(artist)||0)+1);if(result.length>=Number(options.count||25))break;}return result;};})();



(()=>{const picker=document.getElementById('music-picker');document.getElementById('open-music-picker').addEventListener('click',()=>{picker.showModal();document.getElementById('seed-query').focus();});document.getElementById('close-music-picker').addEventListener('click',()=>picker.close());})();



(()=>{const source=document.getElementById('seed-type'),query=document.getElementById('seed-query'),results=document.getElementById('seed-results'),idle=document.getElementById('picker-idle');document.querySelectorAll('[data-source]').forEach(button=>button.addEventListener('click',()=>{source.value=button.dataset.source;document.querySelectorAll('[data-source]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));results.replaceChildren();document.getElementById('seed-status').textContent=source.value==='history'?'Search songs from your imported history.':'Search Spotify '+(source.value==='track'?'songs':'albums')+'. Spotify connection required.';query.focus();if(query.value.trim())document.getElementById('seed-search').click();}));const syncIdle=()=>{idle.hidden=results.children.length>0||query.value.trim().length>0;};new MutationObserver(syncIdle).observe(results,{childList:true});query.addEventListener('input',syncIdle);})();



(()=>{const toggle=document.getElementById('theme-toggle');if(!toggle)return;let dark;try{const saved=localStorage.getItem('studio-appearance');dark=saved?saved==='dark':matchMedia('(prefers-color-scheme:dark)').matches;}catch{dark=false;}function apply(){document.documentElement.dataset.appearance=dark?'dark':'light';toggle.replaceChildren();for(const [symbol,label] of [['â˜€','Light'],['â˜¾','Dark']]){const part=document.createElement('span');part.className='theme-choice';part.setAttribute('aria-hidden','true');const icon=document.createElement('span');icon.className='theme-symbol';const glyph=document.createElementNS('http://www.w3.org/2000/svg','svg');glyph.setAttribute('viewBox','0 0 24 24');glyph.setAttribute('fill','none');glyph.setAttribute('stroke','currentColor');glyph.setAttribute('stroke-width','1.6');glyph.setAttribute('stroke-linecap','round');glyph.setAttribute('stroke-linejoin','round');glyph.setAttribute('aria-hidden','true');glyph.innerHTML=label==='Light'?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>':'<path d="M20.9 13.1A9 9 0 0 1 10.9 3.1 9 9 0 1 0 20.9 13.1Z"/>';icon.append(glyph);part.append(icon,document.createTextNode(label));toggle.append(part);}toggle.setAttribute('aria-pressed',String(dark));toggle.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');}toggle.addEventListener('click',()=>{dark=!dark;try{localStorage.setItem('studio-appearance',dark?'dark':'light');}catch{}apply();});apply();})();



// Resolve playlist artwork with one request at a time and a bounded tab cache.

(()=>{const cache=new Map();let chain=Promise.resolve();const tracks=document.getElementById('tracks');function lookup(track){const key=track.key;if(cache.has(key))return cache.get(key);const task=chain.then(async()=>{if(!SpotifyConnection.connected())return null;let item;if(track.uri){item=await SpotifyConnection.api('/tracks/'+track.uri.split(':')[2]);}else{const data=await SpotifyConnection.api('/search?'+new URLSearchParams({q:'track:'+track.title+' artist:'+track.artist,type:'track',limit:5}));item=data.tracks?.items?.find(t=>E.norm(t.name)===E.norm(track.title)&&t.artists.some(a=>E.norm(a.name)===E.norm(track.artist)));}return item?.album?.images?.find(image=>image.url.startsWith('https://i.scdn.co/'))?.url||null;});chain=task.catch(()=>null);cache.set(key,task);if(cache.size>500)cache.delete(cache.keys().next().value);task.catch(()=>cache.delete(key));return task;}function refresh(){if(demo||!SpotifyConnection.connected())return;[...tracks.children].forEach((row,index)=>{const track=playlist[index],art=row.querySelector('.track-art');if(!track||!art||art.dataset.lookup)return;art.dataset.lookup='true';lookup(track).then(url=>{if(!url||!row.isConnected)return;const img=document.createElement('img');img.alt='';img.loading='eager';img.addEventListener('load',()=>{if(row.isConnected)art.replaceChildren(img);},{once:true});img.src=url;}).catch(()=>{delete art.dataset.lookup;});});}new MutationObserver(refresh).observe(tracks,{childList:true});new MutationObserver(refresh).observe(document.getElementById('spotify-status'),{childList:true,subtree:true});refresh();})();



(()=>{const mode=document.getElementById('discovery-mode'),make=document.getElementById('make');

 let busy=false,revision=0;

 const available=()=>{if(mode.value==='discover'&&make.disabled!==busy)make.disabled=busy;};

 mode.addEventListener('change',available);

 new MutationObserver(available).observe(make,{attributes:true,attributeFilter:['disabled']});

 document.getElementById('clear').addEventListener('click',()=>++revision);

 make.addEventListener('click',async event=>{

  if(mode.value!=='discover')return;

  event.stopImmediatePropagation();if(busy)return;

  const seed=window.studioSeed,status=document.getElementById('status');

  if(!seed){status.textContent='Choose a starting song on the record first.';return;}

  if(!document.getElementById('count').reportValidity())return;

  busy=true;available();const ticket=++revision,count=Number(document.getElementById('count').value);

  const found=[],seen=new Set();let local=false;

  status.textContent='Finding similar songs.';

  try{

   if(SpotifyConnection.connected()){

    try{

     const response=await fetch('/api/similar?'+new URLSearchParams({artist:seed.artists?.[0]||seed.artist,track:seed.title}),{signal:AbortSignal.timeout(12000)});

     if(!response.ok)throw Error('Recommendation service unavailable');

     const data=await response.json();

     for(const candidate of data.tracks||[]){

      if(ticket!==revision)return;if(found.length>=count)break;

      const key=E.norm(candidate.artist)+'\0'+E.norm(candidate.title);

      if(seen.has(key)||E.norm(candidate.title)===E.norm(seed.title))continue;

      const familiar=summary.tracks.find(t=>t.key===key);

      if(/^spotify:track:[a-zA-Z0-9]{22}$/.test(familiar?.uri||'')){

       seen.add(key);found.push({...familiar,reason:'Similar track suggested by Last.fm',sourceUrl:candidate.url});continue;

      }

      status.textContent='Matching songs on Spotify - '+found.length+' found.';

      const results=await SpotifyConnection.api('/search?'+new URLSearchParams({q:'track:'+candidate.title+' artist:'+candidate.artist,type:'track',limit:5}));

      const match=results.tracks?.items?.find(t=>E.norm(t.name)===E.norm(candidate.title)&&t.artists.some(a=>E.norm(a.name)===E.norm(candidate.artist)));

      if(!match)continue;seen.add(key);

      found.push({key,title:match.name,artist:match.artists.map(a=>a.name).join(', '),uri:match.uri,reason:'Similar track suggested by Last.fm',sourceUrl:candidate.url});

     }

    }catch{/* A failed recommendation or matching request must not block the local collection. */}

   }

   if(ticket!==revision)return;

   if(!found.length){local=true;found.push(...E.fromCollection(summary,seed,{count,labels:typeof labels==='undefined'?{}:labels}));}

   playlist=found;if(!local)demo=false;render();

   document.getElementById('title').textContent=local?'A mix from your collection':'Discover something new';

   status.textContent=found.length?(local?'Built '+found.length+' songs from your imported collection.':'Found '+found.length+' similar songs.'):'No songs available in your collection for this mix. Import your Spotify listening history to build one.';

  }finally{busy=false;make.disabled=false;}

 },true);

})();



document.getElementById('recent-pick-first')?.addEventListener('click',()=>document.getElementById('open-music-picker').click());



(()=>{const panel=$('lastfm-settings'),key=$('lastfm-key'),feedback=$('lastfm-feedback'),save=$('lastfm-save'),show=$('lastfm-show');document.querySelectorAll('a[href="#lastfm-settings"]').forEach(link=>link.addEventListener('click',async event=>{event.preventDefault();panel.showModal();feedback.textContent='Checking connection settingsâ€¦';try{const response=await fetch('/api/lastfm-settings');if(!response.ok)throw Error();const data=await response.json();feedback.textContent=data.configured?'An API key is saved. Paste a new key only to replace it.':'No API key saved yet.';}catch{feedback.textContent='Could not load settings. Restart the app and try again.';}}));$('lastfm-close').onclick=()=>panel.close();panel.addEventListener('close',()=>{key.value='';key.type='password';show.textContent='Show';show.setAttribute('aria-label','Show API key');show.setAttribute('aria-pressed','false');});show.onclick=()=>{const visible=key.type==='password';key.type=visible?'text':'password';show.textContent=visible?'Hide':'Show';show.setAttribute('aria-label',visible?'Hide API key':'Show API key');show.setAttribute('aria-pressed',String(visible));};$('lastfm-form').addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;feedback.textContent='Checking your key with Last.fmâ€¦';try{const response=await fetch('/api/lastfm-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:key.value.trim()})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save the key.');key.value='';feedback.textContent='Connected to Last.fm. Your key is saved.';}catch(error){feedback.textContent=error.message;}finally{save.disabled=false;}});})();



if(globalThis.studioDesktop){

 document.documentElement.classList.add('desktop-app');

 const chrome=document.createElement('div');chrome.className='desktop-chrome';

 const brand=document.createElement('div');brand.className='desktop-wordmark';

 const mark=document.createElement('span');mark.className='desktop-mark';mark.setAttribute('aria-hidden','true');

 const name=document.createElement('span');name.textContent='Playlist Studio';brand.append(mark,name);

 const header=document.querySelector('.app-header');chrome.append(brand,header);document.body.prepend(chrome);

 let appearance;const syncChrome=()=>{const next=document.documentElement.dataset.appearance==='dark'?'dark':'light';if(next===appearance)return;appearance=next;globalThis.studioDesktop.setAppearance?.(next).catch(()=>{});};

 new MutationObserver(syncChrome).observe(document.documentElement,{attributes:true,attributeFilter:['data-appearance']});syncChrome();

}



// Account identity comes from Spotify /me, never from placeholder profile data.

(()=>{

 const avatar=$('spotify-avatar'),chip=avatar.closest('a'),name=$('connection-label');

 const identity=document.createElement('span');identity.className='account-identity';

 const subtitle=document.createElement('span');subtitle.className='account-provider';

 name.before(identity);identity.append(name,subtitle);
 const chevron=document.createElementNS('http://www.w3.org/2000/svg','svg');chevron.classList.add('account-chevron');chevron.setAttribute('viewBox','0 0 16 16');chevron.setAttribute('fill','none');chevron.setAttribute('stroke','currentColor');chevron.setAttribute('stroke-width','1.5');chevron.setAttribute('aria-hidden','true');chevron.innerHTML='<path d="m4 6 4 4 4-4"/>';chip.append(chevron);chip.setAttribute('aria-haspopup','dialog');

 function updateProfile(){

  const profile=window.studioProfile;avatar.replaceChildren();avatar.hidden=!profile;

  chip.classList.toggle('has-profile',!!profile);

  if(!profile){subtitle.textContent='Spotify account';chip.title='Connect or manage Spotify';chip.setAttribute('aria-label','Connect or manage Spotify');return;}

  const display=profile.display_name||'Spotify account';

  name.textContent=display;subtitle.textContent='Spotify account';

  chip.title='Spotify account: '+display;chip.setAttribute('aria-label',chip.title+'. Manage connection');

  const initials=document.createElement('span');initials.textContent=display.split(/\s+/).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]).join('').toUpperCase();const fallback=document.createElementNS('http://www.w3.org/2000/svg','svg');fallback.setAttribute('viewBox','0 0 24 24');fallback.setAttribute('fill','none');fallback.setAttribute('stroke','currentColor');fallback.setAttribute('stroke-width','1.6');fallback.innerHTML='<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>';avatar.append(fallback);

  const picture=profile.images?.filter(image=>{try{const u=new URL(image.url);return u.protocol==='https:'&&['i.scdn.co','profile-images.scdn.co'].includes(u.hostname);}catch{return false;}}).sort((a,b)=>(b.width||0)-(a.width||0))[0];

  if(picture){const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.addEventListener('load',()=>{if(window.studioProfile===profile)avatar.replaceChildren(img);},{once:true});img.src=picture.url;}

 }

 window.addEventListener('studio-profile',updateProfile);updateProfile();

})();



// Desktop-only update action. Credentials and update URLs stay in the main process.

if(globalThis.studioDesktop?.checkForUpdates){

 const link=document.querySelector('a[href="#lastfm-settings"]');

 const button=document.createElement('button');button.type='button';button.className='desktop-update-action';button.textContent='Check for updates';

 button.addEventListener('click',async()=>{button.disabled=true;try{await globalThis.studioDesktop.checkForUpdates();}finally{button.disabled=false;}});

 link?.parentElement.append(button);

}

// Connected identity and saved accounts; no token data is rendered into the DOM.
(()=>{
 const S=SpotifyConnection,panel=document.getElementById('connection'),feedback=document.getElementById('spotify-status');
 document.getElementById('connection-title').textContent='Your Spotify accounts';
 panel.querySelector('.settings-title p').textContent='Choose the account that will receive your playlists.';
 panel.querySelector('.spotify-login-help').textContent='Add another account through Spotify. If Spotify shows the same account, use its account switch or sign out there before signing in again.';
 const list=document.createElement('div');list.className='spotify-account-list';list.setAttribute('aria-label','Saved Spotify accounts');panel.querySelector('.connect-row').before(list);
 let revision=0,busy=false;
 async function renderAccounts(){
  const ticket=++revision;let accounts;
  try{accounts=await S.accounts();}catch(error){feedback.textContent=error.message;return;}
  if(ticket!==revision)return;list.replaceChildren();
  const current=window.studioProfile;
  if(current&&!accounts.some(a=>a.id===current.id))accounts.unshift(current);
  document.getElementById('connect-spotify').textContent=current?'Add Spotify account':'Sign in with Spotify';
  if(!accounts.length){const empty=document.createElement('p');empty.className='field-help';empty.textContent='No Spotify account connected. Sign in to add one.';list.append(empty);}
  for(const account of accounts){
   const row=document.createElement('div');row.className='spotify-account-row';
   const art=document.createElement('span');art.className='account-photo';
   const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.6');icon.innerHTML='<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>';art.append(icon);
   const image=account.images?.[0];if(image){try{const u=new URL(image.url);if(u.protocol==='https:'&&['i.scdn.co','profile-images.scdn.co'].includes(u.hostname)){const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.addEventListener('load',()=>art.replaceChildren(img),{once:true});img.src=u.href;}}catch{}}
   const identity=document.createElement('div');identity.className='account-identity';const name=document.createElement('strong');name.textContent=account.display_name||'Spotify account';const id=document.createElement('small');id.textContent=current?.id===account.id?'Currently selected':account.needsReconnect?'Sign in again to use this account':'Saved Spotify account';identity.append(name,id);
   const active=current?.id===account.id;row.classList.toggle('is-active',active);
   const use=document.createElement('button');use.type='button';use.className='secondary';use.textContent=active?'Connected':account.needsReconnect?'Reconnect':'Switch';use.disabled=active||busy;
   use.addEventListener('click',async()=>{
    if(busy||window.studioSaving){feedback.textContent='Finish saving your playlist before switching accounts.';return;}
    if(account.needsReconnect){document.getElementById('connect-spotify').click();return;}
    busy=true;window.studioAccountBusy=true;document.getElementById('save-spotify').disabled=true;renderAccounts();
    try{const profile=await S.switchAccount(account.id);window.studioProfile=profile;sessionStorage.removeItem('studio-saved-playlist');window.dispatchEvent(new Event('studio-profile'));document.getElementById('disconnect-spotify').hidden=false;feedback.textContent='Now using '+(profile.display_name||profile.id)+'.';}
    catch(error){feedback.textContent=error.message;}
    finally{busy=false;window.studioAccountBusy=false;document.getElementById('save-spotify').disabled=false;renderAccounts();}
   });
   const remove=document.createElement('button');remove.type='button';remove.className='text-button';remove.textContent='Remove';remove.disabled=busy;remove.setAttribute('aria-label','Remove '+(account.display_name||account.id)+' from this app');
   remove.addEventListener('click',async()=>{if(busy||window.studioSaving)return;busy=true;try{await S.removeAccount(account.id);if(active)document.getElementById('disconnect-spotify').click();await renderAccounts();}catch(error){feedback.textContent=error.message;}finally{busy=false;renderAccounts();}});
   row.append(art,identity,use,remove);list.append(row);
  }
 }
 new MutationObserver(()=>{if(panel.open)renderAccounts();}).observe(panel,{attributes:true,attributeFilter:['open']});
 window.addEventListener('studio-profile',renderAccounts);renderAccounts();
})();
