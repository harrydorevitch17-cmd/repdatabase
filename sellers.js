const SUPABASE_URL='https://xbhqvoapbfhyhcrhafxm.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaHF2b2FwYmZoeWhjcmhhZnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MjUxNTcsImV4cCI6MjEwNjUwMTE1N30.w-AH-743HhJjDwazZg-AdkuotzANoCd7kwXH6exIo-g';
const search=document.querySelector('#seller-search'),status=document.querySelector('#seller-status'),grid=document.querySelector('#seller-grid'),retry=document.querySelector('#retry');
let sellers=[];
function render(){
 const q=search.value.trim().toLocaleLowerCase();
 const list=sellers.filter(s=>[s.name,...s.categories].join(' ').toLocaleLowerCase().includes(q));
 grid.replaceChildren();
 status.textContent=list.length?`${list.length} seller${list.length===1?'':'s'} found`:q?'No sellers match your search. Try a different name or category.':'No named sellers are available in the catalogue yet.';
 for(const seller of list){
  const card=document.createElement('article');card.className='seller-card';card.dataset.initial=seller.name.slice(0,1).toUpperCase();
  const title=document.createElement('h2');title.textContent=seller.name;
  const count=document.createElement('p');count.className='muted';count.textContent=`${seller.count} listed find${seller.count===1?'':'s'}`;
  const cats=document.createElement('p');cats.textContent=[...seller.categories].sort().join(' - ')||'Browse their catalogue finds';
  const link=document.createElement('a');link.className='btn';link.href='/?seller='+encodeURIComponent(seller.name)+'#shop';link.textContent='Browse seller finds';
  card.append(title,count,cats,link);grid.append(card);
 }
}
async function load(){
 retry.hidden=true;status.textContent='Loading sellers from the catalogue...';
 try{
  const rows=[];
  for(let offset=0;;){
   const response=await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,seller,category&order=id.asc&limit=1000&offset=${offset}`,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY},signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('Catalogue unavailable');
   const batch=await response.json();if(!Array.isArray(batch))throw Error('Invalid catalogue');
   rows.push(...batch);if(!batch.length)break;offset+=batch.length;
  }
  const grouped=new Map();
  for(const row of rows){const name=String(row.seller||'').trim();if(!name)continue;const key=name.toLocaleLowerCase();if(!grouped.has(key))grouped.set(key,{name,count:0,categories:new Set()});const seller=grouped.get(key);seller.count++;if(row.category)seller.categories.add(String(row.category).trim());}
  sellers=[...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name));render();
 }catch{status.textContent='Unable to load the seller directory. Please try again.';retry.hidden=false;}
}
search.addEventListener('input',render);retry.addEventListener('click',load);load();
