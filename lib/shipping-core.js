(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ShippingCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const stages=[{id:'warehouse',label:'KakoBuy warehouse',icon:'box'},{id:'dispatch',label:'Warehouse departure',icon:'warehouse'},{id:'logistics',label:'Carrier handover',icon:'van'},{id:'export',label:'Export / airport',icon:'plane'},{id:'flight',label:'Air transport',icon:'plane'},{id:'customs',label:'Customs',icon:'shield'},{id:'delivery',label:'Local delivery',icon:'van'},{id:'delivered',label:'Delivered',icon:'home'}];
function classify(event){
 const text=String(event?.description||'').toLowerCase(),status=String(event?.subStatus||event?.stage||'');
 const agent=event?.source==='agent';
 if(/return(?:ed|ing) to sender|delivery fail|exception|undeliver|delivery attempt|投递失败|退回/.test(text)||/Exception|DeliveryFailure|Returning|Returned/.test(status))return {id:'exception',label:'Needs attention',tone:'attention'};
 if(/\bnot (?:yet )?delivered\b|\bnot received\b|\bawaiting delivery\b/.test(text))return {id:'unknown',label:'Awaiting an update',tone:'neutral'};
 if(/^(Delivered|Delivered_)/.test(status)||/\bdelivered\b|\bsigned for\b|妥投|已签收/.test(text))return {id:'delivered',label:'Delivered',tone:'good'};
 if(/OutForDelivery|AvailableForPickup/.test(status)||/out for delivery|ready for (?:collection|pickup)|派送中|正在投递/.test(text))return {id:'delivery',label:/pickup|collection/.test(text)?'Ready for collection':'Out for delivery',tone:'good'};
 if(/customs|clearance|海关|清关/.test(text)||/Customs/.test(status))return {id:'customs',label:/clear(?:ed|ance complete)|放行|清关完成/.test(text)?'Customs clearance reported':'Customs processing',tone:'neutral'};
 if(/flight (?:has (?:already )?)?(?:departed|taken off|flown)|aircraft departed|airline departure|航班起飞|航班已飞|航空公司启运/.test(text))return {id:'flight',label:'Air transport departure reported',tone:'good'};
 if(/(?:flight|aircraft).{0,25}(?:arrived|landed)/.test(text))return {id:'flight',label:'Air transport arrival reported',tone:'good'};
 if(/airline (?:received|receives)|handed (?:over )?to (?:the )?airline|awaiting (?:a )?flight|waiting for flight|航司接收|航空公司接收/.test(text))return {id:'export',label:'Handed to airline',tone:'neutral'};
 if(/airport|export|outward office|离境|出口|机场/.test(text)||/^Departure$/.test(status))return {id:'export',label:'Export processing',tone:'neutral'};
 if(/(?:le(?:ft|aving)|depart(?:ed|ure)|shipped|dispatched|出库|离开).{0,45}warehouse|warehouse.{0,45}(?:departure|dispatch|出库)|出库|离开仓库/.test(text))return {id:'dispatch',label:agent||/kako\s?buy/.test(text)?'Left KakoBuy warehouse':'Warehouse departure reported',tone:'good'};
 if(agent&&/stored|stocked|qc|inspection|warehouse received|仓库|入库/.test(text))return {id:'warehouse',label:'At KakoBuy warehouse',tone:'neutral'};
 if(/pick(?:ed)? up|collected|accepted|received by (?:the )?carrier|logistics provider|揽收|已收寄/.test(text)||/PickedUp/.test(status))return {id:'logistics',label:'Carrier handover',tone:'good'};
 if(/InfoReceived/.test(status)||/label created|information received|shipment information/.test(text))return {id:'unknown',label:'Shipping label created',tone:'neutral'};
 return {id:'unknown',label:'Carrier update received',tone:'neutral'};
}
function coordinates(raw){
 if(!raw||raw.latitude===null||raw.longitude===null||raw.latitude===''||raw.longitude==='')return null;
 const lat=Number(raw.latitude??raw.lat),lng=Number(raw.longitude??raw.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||(lat===0&&lng===0))return null;
 return {lat,lng,precision:raw.precision||'carrier-location'};
}
const fold=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function cityIndex(cities){
 const index=new Map();
 for(const city of cities)for(const name of city[5]||[city[0]]){const key=fold(name);if(key.length<3&&!/[^\x00-\x7F]/.test(key))continue;if(!index.has(key))index.set(key,[]);const records=index.get(key);if(!records.includes(city))records.push(city);}
 return index;
}
function locate(event,index){
 const direct=coordinates(event?.coordinates);if(direct)return {...direct,name:event.city||event.location||'Carrier-reported location',country:event.country||'',basis:'carrier'};
 const country=String(event?.country||'').toUpperCase(),text=fold(event?.city||event?.location||'');if(!text)return null;
 const keys=[];const words=text.split(' ');
 for(let size=Math.min(words.length,5);size>0;size--)for(let start=0;start<=words.length-size;start++)keys.push(words.slice(start,start+size).join(' '));
 const matches=[];
 for(const key of keys){let candidates=index.get(key)||[];if(country)candidates=candidates.filter(c=>c[1]===country);if(!candidates.length)continue;
  const unique=[...new Map(candidates.map(c=>[c[1]+':'+c[2]+':'+c[3],c])).values()];
  if(unique.length===1){const city=unique[0];return {name:city[0],country:city[1],lat:city[2],lng:city[3],precision:'city-centre',basis:'city-match'};}
  matches.push(...unique);
 }
 if(matches.length)return {ambiguous:true,candidates:[...new Set(matches)].slice(0,8).map(c=>({name:c[0],country:c[1],lat:c[2],lng:c[3]}))};
 return null;
}
function distance(a,b){const rad=n=>n*Math.PI/180;const dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng);const term=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;return 6371*2*Math.atan2(Math.sqrt(Math.min(1,term)),Math.sqrt(Math.max(0,1-term)));}
function nearbyAirports(point,airports,maxKm=150){if(!point||point.ambiguous)return [];return airports.map(a=>({...a,distance:distance(point,a)})).filter(a=>a.distance<=maxKm).sort((a,b)=>a.distance-b.distance).slice(0,5);}
function instant(event){const time=event?.timeUTC||event?.time;if(typeof time!=='string'||!/(Z|[+-]\d{2}:?\d{2})$/i.test(time))return null;const value=Date.parse(time);return Number.isFinite(value)?value:null;}
function mergeEvents(carrierEvents,agentEvents){return [...carrierEvents.map(e=>({...e,source:e.source||'carrier'})),...agentEvents.map(e=>({...e,source:'agent'}))].sort((a,b)=>{const x=instant(a),y=instant(b);if(x===null&&y===null)return 0;if(x===null)return 1;if(y===null)return -1;return y-x;});}
function mentionedFlight(event){const text=String(event?.description||'');if(!/flight|航班/i.test(text))return null;const match=text.match(/\b([A-Z][A-Z0-9]|[0-9][A-Z])[ -]?(\d{2,4})\b/);return match?match[1]+match[2]:null;}
function upcomingFlights(rows,airport,now=Date.now()){
 const seen=new Set(),flights=[];
 for(const row of rows||[]){
  if(row.departure?.iata!==airport||row.flight_status==='cancelled'||row.departure?.actual||row.flight?.codeshared)continue;
  const scheduled=row.departure?.scheduled,estimated=row.departure?.estimated,time=estimated||scheduled;
  if(typeof time!=='string'||!/(Z|[+-]\d{2}:?\d{2})$/i.test(time))continue;
  const epoch=Date.parse(time);if(!Number.isFinite(epoch)||epoch<now||epoch>now+36*3600000)continue;
  const flight=row.flight?.iata||row.flight?.icao;if(!flight)continue;const key=flight+':'+scheduled;if(seen.has(key))continue;seen.add(key);
  flights.push({flight,airline:row.airline?.name||'',from:airport,to:row.arrival?.iata||'',destination:row.arrival?.airport||'',scheduled,estimated:estimated||null,status:row.flight_status||'scheduled',departureTimezone:row.departure?.timezone||null,departureEpoch:epoch});
 }
 return flights.sort((a,b)=>a.departureEpoch-b.departureEpoch);
}
return {stages,classify,coordinates,fold,cityIndex,locate,distance,nearbyAirports,instant,mergeEvents,mentionedFlight,upcomingFlights};
});
