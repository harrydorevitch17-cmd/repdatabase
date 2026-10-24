'use strict';
const el=id=>document.getElementById(id);
const regionNames=new Intl.DisplayNames(['en'],{type:'region'});
const countryCodes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
for(const code of countryCodes.sort((a,b)=>regionNames.of(a).localeCompare(regionNames.of(b)))){
 const option=document.createElement('option');option.value=code;option.textContent=regionNames.of(code);el('destination').append(option);
}
let carriers=[],limit=12,activeNumber='';
function card(title,description,url,label){
 const node=document.createElement('article');node.className='seller-card';
 const heading=document.createElement('h3');heading.textContent=title;
 const text=document.createElement('p');text.className='muted';text.textContent=description;
 const link=document.createElement('a');link.className='btn';link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=label;
 node.append(heading,text,link);return node;
}
const commonCarriers=['Australia Post','USPS','Royal Mail','China Post','Canada Post','Japan Post','Singapore Post','HongKong Post','Deutsche Post Mail','La Poste (Colissimo)','India Post','New Zealand Post'];
const portalRank=name=>{const i=commonCarriers.indexOf(name);return i<0?commonCarriers.length:i;};
function renderDirectory(){
 const country=el('destination').value,q=el('carrier-search').value.trim().toLocaleLowerCase();
 const list=carriers.filter(c=>(!country||c.country===country)&&(!q||c.name.toLocaleLowerCase().includes(q)));
 list.sort((a,b)=>portalRank(a.name)-portalRank(b.name)||Number(/post|postal|ems/i.test(b.name))-Number(/post|postal|ems/i.test(a.name))||a.name.localeCompare(b.name));
 el('carrier-portals').replaceChildren(...list.slice(0,limit).map(c=>card(c.name,(c.country?regionNames.of(c.country)+' - ':'')+'Carrier website. Paste your tracking number to check updates.'+(c.url.startsWith('http:')?' This directory link uses HTTP.':''),c.url,'Open carrier portal')));
 el('directory-status').textContent=list.length?`${list.length} portals found; showing ${Math.min(limit,list.length)}.`:carriers.length?'No listed portal matches this selection. Try searching worldwide, or use the UPU and EMS directories below.':'Carrier directory is not available yet. Global tracking links still work.';
 el('more-carriers').hidden=list.length<=limit;
}
async function loadDirectory(){
 el('directory-retry').hidden=true;
 try{
  const response=await fetch('/carriers.json');if(!response.ok)throw Error('Directory unavailable');
  const data=await response.json();if(!Array.isArray(data.carriers))throw Error('Invalid directory');
  carriers=data.carriers.filter(c=>{try{return ['https:','http:'].includes(new URL(c.url).protocol)&&typeof c.name==='string'}catch{return false}});renderDirectory();
 }catch{el('directory-status').textContent='Could not load the carrier directory. Retry, or use the UPU and EMS links below.';el('directory-retry').hidden=false;}
}
function showSources(number){
 const encoded=encodeURIComponent(number),country=el('destination').value;
 const sources=[
  card('17TRACK','Look for the identified carrier and any destination delivery number.','https://t.17track.net/en#nums='+encoded,'Track on 17TRACK'),
  card('ParcelsApp','Cross-check scans and possible carrier handovers.','https://parcelsapp.com/en/tracking/'+encoded,'Track on ParcelsApp'),
  card('EMS','Official tracking for EMS shipments. Paste your number on the portal.','https://www.ems.post/en/global-network/tracking','Open EMS tracking'),
  card('UPU Global Track & Trace','Postal tracking for participating operators. Paste your number on the portal.','https://globaltracktrace.ptc.post/gtt.web/','Open UPU tracking')
 ];
 if(country){const local=card(regionNames.of(country)+' delivery portals','Identify your destination carrier, then compare its scans.','#portal-directory','Find local portals');const link=local.querySelector('a');link.removeAttribute('target');link.removeAttribute('rel');sources.unshift(local);}
 el('tracking-sources').replaceChildren(...sources);
 const postal=/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(number),suffix=number.slice(-2);
 el('number-hint').textContent=postal?`This resembles a 13-character international postal number${countryCodes.includes(suffix)?' with issuing-country code '+regionNames.of(suffix):''}. The suffix does not identify the destination or confirm the current carrier. Check EMS if the sender used EMS.`:'The format alone does not reliably identify the carrier. Start with an international tracker, then check the named carrier portal.';
 el('tracking-results').hidden=false;el('tracking-status').textContent='Tracking resources ready. Choose a source below to check live results.';
}
el('tracking-form').addEventListener('submit',event=>{
 event.preventDefault();const input=el('tracking-number');input.setCustomValidity('');
 const number=input.value.replace(/[\s-]/g,'').toUpperCase();
 if(!/^[A-Z0-9]{5,60}$/.test(number)){input.setCustomValidity('Enter 5 to 60 letters or numbers. Spaces and hyphens are allowed.');input.reportValidity();return;}
 activeNumber=number;el('copy-status').textContent='';showSources(number);renderDirectory();
});
el('tracking-number').addEventListener('input',event=>{event.target.setCustomValidity('');el('tracking-results').hidden=true;el('tracking-status').textContent='';activeNumber='';});
el('destination').addEventListener('change',()=>{limit=12;renderDirectory();if(activeNumber)showSources(activeNumber);});
el('carrier-search').addEventListener('input',()=>{limit=12;renderDirectory();});
el('more-carriers').addEventListener('click',()=>{limit+=12;renderDirectory();});
el('directory-retry').addEventListener('click',loadDirectory);
el('copy-number').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(activeNumber);el('copy-status').textContent='Tracking number copied.';}
 catch{el('copy-status').textContent='Copy this tracking number: '+activeNumber;}
});
loadDirectory();
