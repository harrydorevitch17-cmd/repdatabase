const search=document.querySelector('#seller-search');
const status=document.querySelector('#seller-status');
const grid=document.querySelector('#seller-grid');
const retry=document.querySelector('#retry');
const filter=document.querySelector('#seller-filter');
const pagination=document.querySelector('#seller-pagination');
const pageLabel=document.querySelector('#seller-page');
const previous=document.querySelector('#seller-previous');
const next=document.querySelector('#seller-next');
const PAGE_SIZE=36;
let sellers=[],page=0;
function safeUrl(value){
 if(typeof value!=='string')return null;
 try{const url=new URL(value);return url.protocol==='https:'?url.href:null}catch{return null}
}
function element(tag,className,text){
 const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;
}
function externalLink(url,label,className){
 const node=element('a',className,label);node.href=url;node.target='_blank';node.rel='noopener noreferrer';return node;
}
function render(){
 const query=search.value.trim().toLocaleLowerCase();
 const list=sellers.filter(s=>(!filter.value||s.tags.includes(filter.value))&&[s.name,...s.tags,...s.yupooUrls].join(' ').toLocaleLowerCase().includes(query));
 const pages=Math.ceil(list.length/PAGE_SIZE);page=Math.max(0,Math.min(page,pages-1));
 const start=page*PAGE_SIZE;grid.replaceChildren();
 status.textContent=list.length?`${list.length} sellers${list.length===sellers.length?'':` / ${sellers.length} total`}`:'No sellers match. Try another name or seller type.';
 pagination.hidden=list.length<=PAGE_SIZE;
 pageLabel.textContent=list.length?`${start+1}–${Math.min(start+PAGE_SIZE,list.length)} of ${list.length}`:'';
 previous.disabled=page===0;next.disabled=page>=pages-1;
 for(const seller of list.slice(start,start+PAGE_SIZE)){
  const card=element('article','seller-card');card.dataset.initial=seller.name.slice(0,2).toUpperCase();
  card.append(element('h2','',seller.name));
  const address=seller.yupooUrls[0];card.append(element('p','seller-address',address?new URL(address).hostname:'Yupoo directory listing'));
  const tags=element('div','seller-tags');for(const tag of seller.tags)tags.append(element('span','seller-tag',tag));card.append(tags);
  const links=element('div','seller-links');
  if(address)links.append(externalLink(address,'Open Yupoo ↗','seller-primary'));
  else if(seller.website)links.append(externalLink(seller.website,'Open seller store ↗','seller-primary'));
  else links.append(externalLink(seller.sourceUrl,'View seller details ↗','seller-primary'));
  if(seller.yupooUrls.length>1){
   const details=element('details','seller-alternates');details.append(element('summary','',`${seller.yupooUrls.length-1} more album${seller.yupooUrls.length===2?'':'s'}`));
   for(const url of seller.yupooUrls.slice(1))details.append(externalLink(url,new URL(url).hostname,''));links.append(details);
  }
  links.append(externalLink(seller.sourceUrl,'Jadeship entry ↗','seller-source'));card.append(links);grid.append(card);
 }
}
async function load(){
 retry.hidden=true;status.textContent='Loading the seller directory…';
 try{
  const response=await fetch('/data/sellers.json',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Directory unavailable');
  const data=await response.json();if(!Array.isArray(data.sellers)||!data.sellers.length)throw Error('Invalid directory');
  sellers=data.sellers.map(s=>{
   const sourceUrl=safeUrl(s.sourceUrl);if(typeof s.name!=='string'||!sourceUrl)throw Error('Invalid seller');
   return {name:s.name,tags:Array.isArray(s.tags)?s.tags.filter(t=>typeof t==='string'):[],sourceUrl,website:safeUrl(s.website),yupooUrls:(s.yupooUrls||[]).map(safeUrl).filter(u=>u&&new URL(u).hostname.endsWith('.yupoo.com'))};
  }).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
  filter.replaceChildren(element('option','','All seller types'));filter.firstChild.value='';
  for(const tag of [...new Set(sellers.flatMap(s=>s.tags))].sort()){const option=element('option','',tag);option.value=tag;filter.append(option)}
  const date=new Date(data.fetchedAt);document.querySelector('#seller-updated').textContent=Number.isNaN(date.getTime())?'':`Imported ${date.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Sydney'})}`;
  render();
 }catch{status.textContent='Unable to load the seller directory. Please try again.';retry.hidden=false;pagination.hidden=true;}
}
function reset(){page=0;render()}
function changePage(offset){page+=offset;render();document.querySelector('#seller-directory').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
search.addEventListener('input',reset);filter.addEventListener('change',reset);previous.addEventListener('click',()=>changePage(-1));next.addEventListener('click',()=>changePage(1));retry.addEventListener('click',load);load();
