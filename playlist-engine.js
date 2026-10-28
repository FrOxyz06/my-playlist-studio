(function(root){'use strict';
const norm=s=>String(s||'').trim().toLocaleLowerCase();
function parse(rows){if(!Array.isArray(rows))throw Error('Not a listening-history file.');const plays=[];for(const r of rows){if(!r||typeof r!=='object')continue;const ext='master_metadata_track_name'in r,title=ext?r.master_metadata_track_name:r.trackName,artist=ext?r.master_metadata_album_artist_name:r.artistName,ms=Number(ext?r.ms_played:r.msPlayed),stamp=ext?r.ts:r.endTime;const date=typeof stamp==='string'?Date.parse(stamp.includes('T')?stamp:stamp.replace(' ','T')+'Z'):NaN;if(typeof title!=='string'||!title.trim()||typeof artist!=='string'||!artist.trim()||!Number.isFinite(ms)||ms<0||!Number.isFinite(date))continue;plays.push({title:title.trim(),artist:artist.trim(),ms,date,skipped:r.skipped===true,uri:/^spotify:track:[A-Za-z0-9]{22}$/.test(r.spotify_track_uri||'')?r.spotify_track_uri:null});}return plays;}
function summarize(plays){const tracks=new Map();let latest=0;for(const p of plays){latest=Math.max(latest,p.date);const key=norm(p.artist)+'\0'+norm(p.title);let t=tracks.get(key);if(!t){t={key,title:p.title,artist:p.artist,uri:p.uri,plays:0,qualified:0,skips:0,last:0,dates:[]};tracks.set(key,t);}t.plays++;if(p.skipped)t.skips++;if(p.ms>=30000&&!p.skipped){t.qualified++;t.last=Math.max(t.last,p.date);t.dates.push(p.date);}if(!t.uri)t.uri=p.uri;}return {tracks:[...tracks.values()],latest,plays:plays.length};}
function build(summary,{direction='all',artist='',genre='',mix='balanced',count=25,cap=3,labels={},excluded=[],random=Math.random}={}){count=Math.max(1,Math.min(100,Math.floor(Number(count)||25)));cap=Math.max(1,Math.min(100,Math.floor(Number(cap)||3)));const blocked=new Set(excluded),candidates=summary.tracks.filter(t=>t.qualified&&!blocked.has(t.key)&&(direction!=='artist'||norm(t.artist)===norm(artist))&&(direction!=='genre'||(labels[norm(t.artist)]||[]).some(g=>norm(g)===norm(genre)))).map(t=>{const age=Math.max(0,(summary.latest-t.last)/86400000),recent=t.dates.reduce((s,d)=>s+Math.exp(-(summary.latest-d)/86400000/60),0),affinity=Math.log1p(t.qualified)*(1-.6*t.skips/t.plays);const weight=mix==='recent'?Math.log1p(recent)*2:mix==='rediscover'?affinity*Math.min(3,age/90):affinity+Math.log1p(recent);const score=mix==='shuffle'?random():weight*(.8+random()*.4);return {...t,score,reason:mix==='rediscover'?Math.floor(age)+' days before your latest exported play':t.qualified+' substantial listens in your files'};}).filter(t=>mix==='shuffle'||t.score>0).sort((a,b)=>b.score-a.score);const result=[],counts=new Map();for(const t of candidates){const a=norm(t.artist);if(direction!=='artist'&&(counts.get(a)||0)>=cap)continue;result.push(t);counts.set(a,(counts.get(a)||0)+1);if(result.length>=count)break;}return result;}
const url=t=>t.uri?'https://open.spotify.com/track/'+t.uri.split(':')[2]:'https://open.spotify.com/search/'+encodeURIComponent(t.artist+' '+t.title);
function csv(tracks){const cell=s=>'"'+String(/^[=+@\-\t\r]/.test(String(s))?"'"+s:s).replaceAll('"','""')+'"';return ['Title,Artist,Spotify link,Why selected',...tracks.map(t=>[t.title,t.artist,url(t),t.reason].map(cell).join(','))].join('\r\n');}
// Local signals guide this fallback; it does not analyze audio.
function fromCollection(summary,seed,{count=25,labels={},random=Math.random}={}){
 const seedArtists=(seed.artists||[seed.artist]).map(norm).filter(Boolean),seedTitle=norm(seed.title);
 const anchors=summary.tracks.filter(t=>norm(t.title)===seedTitle&&seedArtists.includes(norm(t.artist)));
 const dates=anchors.flatMap(t=>t.dates||[]).sort((a,b)=>a-b);
 const genres=new Set(seedArtists.flatMap(a=>labels[a]||[]).map(norm));
 const candidates=summary.tracks.filter(t=>t.qualified&&!(norm(t.title)===seedTitle&&seedArtists.includes(norm(t.artist)))).map(t=>{
  let nearby=0,index=0;
  for(const date of [...(t.dates||[])].sort((a,b)=>a-b)){
   while(index<dates.length&&dates[index]<date-1800000)index++;
   if(index<dates.length&&Math.abs(dates[index]-date)<=1800000)nearby++;
  }
  const shared=(labels[norm(t.artist)]||[]).some(g=>genres.has(norm(g)));
  return {...t,score:(seedArtists.includes(norm(t.artist))?3:0)+(shared?4:0)+Math.min(4,Math.log1p(nearby)*2)+Math.log1p(t.qualified)+random()*.5,reason:'From your imported collection'};
 });
 const result=[],counts=new Map();count=Math.max(1,Math.min(100,Math.floor(Number(count)||25)));
 while(candidates.length&&result.length<count){
  candidates.sort((a,b)=>b.score/(1+(counts.get(norm(b.artist))||0))-a.score/(1+(counts.get(norm(a.artist))||0)));
  const next=candidates.shift();result.push(next);const artist=norm(next.artist);counts.set(artist,(counts.get(artist)||0)+1);
 }
 return result;
}
const api={parse,summarize,build,fromCollection,url,csv,norm};if(typeof module!=='undefined')module.exports=api;else root.StudioEngine=api;
})(globalThis);
