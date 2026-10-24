'use strict';
// 17TRACK v2.4: server-side credentials, registration once, then latest stored carrier scans.
const {createHash}=require('node:crypto');
const {coordinates}=require('../lib/shipping-core.js');
const visitors=new Map();
const TTL=60000,MAX_REQUESTS=12;
function fail(res,status,code,message){return res.status(status).json({error:code,message});}
function rejectCode(result){return result?.data?.rejected?.[0]?.error?.code??result?.data?.errors?.[0]?.code??(result?.code||0);}
function upstreamError(res,code){
 const errors={
  '-18019903':[422,'carrier_unknown','The carrier could not be detected. Choose the carrier below and try again.'],
  '-18019908':[503,'quota_exhausted','Tracking is temporarily unavailable because the tracking quota has been used.'],
  '-18019907':[429,'provider_limit','The tracking provider has reached its daily limit. Please try again later.'],
  '-18010012':[422,'invalid_number','The carrier rejected this tracking number. Check it with your sender.'],
  '-18010018':[422,'extra_details','This carrier needs a destination country and postal code to release tracking information.'],
  '-18010019':[422,'extra_details','This carrier needs a postal code to release tracking information.'],
  '-18010020':[422,'extra_details','This carrier needs additional recipient verification. Check the carrier directly.'],
  '-18010022':[422,'extra_details','This carrier requires additional shipment information. Check the carrier directly.'],
  '-18010201':[503,'provider_setup','Tracking is awaiting provider account configuration.'],
  '-18010204':[503,'provider_setup','Tracking is awaiting provider account configuration.'],
  '-18010001':[503,'provider_setup','Tracking is awaiting provider account configuration.'],
  '-18010002':[503,'provider_setup','Tracking is awaiting provider account configuration.'],
  '-18010005':[503,'provider_setup','Tracking is awaiting provider account configuration.']
 };
 const error=errors[String(code)]||[502,'provider_error','The tracking provider could not complete the lookup. Please try again.'];
 return fail(res,...error);
}
function cleanEvent(event,carrier){
 if(!event||typeof event!=='object')return null;
 const translated=event.description_translation?.lang==='en'?event.description_translation.description:null;
 const description=String(translated||event.description||'').slice(0,1500);
 if(!description)return null;
 return {description,time:event.time_iso||event.time_utc||null,timeUTC:event.time_utc||null,rawTime:event.time_raw||null,location:String(event.location||[event.address?.city,event.address?.state,event.address?.country].filter(Boolean).join(', ')).slice(0,300),city:String(event.address?.city||'').slice(0,150),country:String(event.address?.country||'').slice(0,2).toUpperCase(),coordinates:coordinates(event.address?.coordinates),source:'carrier',stage:event.stage||null,subStatus:event.sub_status||null,carrier:carrier||null};
}
function timestamp(event){
 const date=event?.timeUTC||event?.time;
 if(typeof date!=='string'||!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(date))return null;
 const time=Date.parse(date);return Number.isFinite(time)?time:null;
}
function normalize(item){
 const info=item.track_info||{},providers=Array.isArray(info.tracking?.providers)?info.tracking.providers:[];
 const events=[],seen=new Set();
 function add(event,name){const entry=cleanEvent(event,name);if(!entry)return;const key=[entry.time,entry.description,entry.location].join('|');if(seen.has(key)){const existing=events.find(e=>[e.time,e.description,e.location].join('|')===key);if(existing)for(const field of ['carrier','country','city','coordinates'])if(!existing[field]&&entry[field])existing[field]=entry[field];return;}seen.add(key);events.push(entry);}
 add(info.latest_event,null);
 for(const provider of providers)for(const event of provider.events||[])add(event,provider.provider?.name);
 events.sort((a,b)=>{const at=timestamp(a),bt=timestamp(b);if(at===null&&bt===null)return 0;if(at===null)return 1;if(bt===null)return -1;return bt-at;});
 const canonical=cleanEvent(info.latest_event,null);
 const latest=canonical&&timestamp(canonical)===null?canonical:events[0]||null;
 const names=[...new Set(providers.map(p=>p.provider?.name).filter(Boolean))];
 const sync=providers.map(p=>p.latest_sync_time).filter(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null;
 return {number:item.number,carrierCode:item.carrier,carriers:names,status:info.latest_status?.status||'NotFound',subStatus:info.latest_status?.sub_status||null,latest,events:events.slice(0,150),lastSynced:sync,localNumber:info.misc_info?.local_number||null,localCarrier:info.misc_info?.local_provider||null,originCountry:info.shipping_info?.shipper_address?.country||null,destinationCountry:info.shipping_info?.recipient_address?.country||null};
}
async function requestProvider(endpoint,number,carrier,key){
 const body={number};if(carrier)body.carrier=carrier;
 const response=await fetch('https://api.17track.net/track/v2.4/'+endpoint,{method:'POST',headers:{'17token':key,'Content-Type':'application/json'},body:JSON.stringify([body]),signal:AbortSignal.timeout(8000)});
 if(response.status===401)throw Object.assign(new Error('Provider authentication'),{http:503,code:'provider_setup'});
 if(response.status===429)throw Object.assign(new Error('Provider rate limit'),{http:429,code:'provider_limit'});
 if(!response.ok)throw new Error('Provider response error');
 return response.json();
}
async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(res,405,'method','Use POST to track a parcel.');}
 const origin=req.headers.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)return fail(res,403,'origin','Use tracking from this website.');}catch{return fail(res,403,'origin','Invalid request origin.');}}
 let body=req.body;
 try{if(typeof body==='string')body=JSON.parse(body);}catch{return fail(res,400,'invalid_request','Enter a valid tracking number.');}
 if(!body||typeof body.number!=='string'||body.number.length>100)return fail(res,400,'invalid_request','Enter a valid tracking number.');
 const number=body.number.replace(/[\s-]/g,'').toUpperCase();
 if(!/^[A-Z0-9]{5,50}$/.test(number))return fail(res,400,'invalid_number','Use 5 to 50 letters or numbers.');
 const carrier=body.carrier===undefined||body.carrier===''?0:Number(body.carrier);
 if(!Number.isSafeInteger(carrier)||carrier<0||carrier>10000000)return fail(res,400,'invalid_carrier','Choose a valid carrier.');
 const key=process.env.TRACKING_API_KEY;
 if(!key)return fail(res,503,'not_configured','Live tracking is being connected. Please try again shortly.');
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
 const visitor=createHash('sha256').update(ip).digest('hex'),now=Date.now();
 for(const [id,record] of visitors)if(now-record.start>TTL)visitors.delete(id);
 const count=visitors.get(visitor)||{start:now,count:0};
 if(++count.count>MAX_REQUESTS){res.setHeader('Retry-After','60');return fail(res,429,'rate_limit','Please wait a minute before checking again.');}
 visitors.set(visitor,count);
 try{
  let result=await requestProvider('gettrackinfo',number,carrier,key),code=rejectCode(result);
  if(code===-18019902){
   const registered=await requestProvider('register',number,carrier,key),registrationCode=rejectCode(registered);
   if(registrationCode&&registrationCode!==-18019901)return upstreamError(res,registrationCode);
   result=await requestProvider('gettrackinfo',number,carrier,key);code=rejectCode(result);
  }
  if(code===-18019909||code===-18019902)return res.status(200).json({number,pending:true,shipments:[],fetchedAt:new Date().toISOString()});
  const accepted=Array.isArray(result?.data?.accepted)?result.data.accepted:[];
  if(!accepted.length&&code)return upstreamError(res,code);
  const shipments=accepted.map(normalize);
  return res.status(200).json({number,pending:!shipments.some(s=>s.latest),ambiguous:shipments.length>1,shipments,fetchedAt:new Date().toISOString()});
 }catch(error){
  return fail(res,error.http||502,error.code||'provider_unavailable',error.code==='provider_setup'?'Tracking is awaiting provider account configuration.':error.code==='provider_limit'?'The tracking provider is busy. Please try again shortly.':'The tracking service did not respond. Please try again shortly.');
 }
}
module.exports=handler;
module.exports.normalize=normalize;
