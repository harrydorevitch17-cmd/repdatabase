'use strict';
const {createHash}=require('node:crypto');
const snapshot=require('../data/catalogue.json');
const DEFAULT_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaHF2b2FwYmZoeWhjcmhhZnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MjUxNTcsImV4cCI6MjEwNjUwMTE1N30.w-AH-743HhJjDwazZg-AdkuotzANoCd7kwXH6exIo-g';
const PAGE_SIZE=500;
function validRows(rows){
 if(!Array.isArray(rows)||rows.some(r=>!r||!Number.isSafeInteger(Number(r.id))||Number(r.id)<=0||typeof r.name!=='string'||!r.name.trim()))throw Error('Invalid catalogue');
 return rows;
}
function createHandler(options={}){
 const fetcher=options.fetch||((...args)=>fetch(...args)),clock=options.now||Date.now,fallback=options.snapshot||snapshot;
 const pageSize=options.pageSize||PAGE_SIZE;
 let cached=null,inFlight=null;
 const result=(rows,source)=>({rows,source,etag:'"'+createHash('sha256').update(JSON.stringify(rows)).digest('hex')+'"'});
 async function refresh(){
  const base=process.env.SUPABASE_URL||'https://xbhqvoapbfhyhcrhafxm.supabase.co',key=process.env.SUPABASE_ANON_KEY||DEFAULT_KEY;
  const rows=[],seen=new Set(),signal=AbortSignal.timeout(7000);
  for(let offset=0;offset<50000;){
   const url=new URL('/rest/v1/products',base);url.searchParams.set('select','*');url.searchParams.set('order','created_at.desc,id.desc');url.searchParams.set('limit',String(pageSize));url.searchParams.set('offset',String(offset));
   const response=await fetcher(url.href,{headers:{apikey:key,Authorization:'Bearer '+key,Prefer:'count=exact'},signal});
   if(!response.ok)throw Error('Catalogue unavailable');
   const batch=validRows(await response.json());
   const range=response.headers?.get?.('content-range'),total=range&&/\/(\d+)$/.test(range)?Number(range.split('/')[1]):null;
   for(const row of batch){if(seen.has(String(row.id)))throw Error('Catalogue changed during pagination');seen.add(String(row.id));rows.push(row)}
   offset+=batch.length;
   if(total!==null&&offset>=total||total===null&&!batch.length){const value=result(rows,'live');cached={...value,at:clock()};return value}
   if(!batch.length)throw Error('Incomplete catalogue');
  }
  throw Error('Catalogue exceeds response limit');
 }
 async function get(){
  if(cached&&clock()-cached.at<15000)return cached;
  if(!inFlight)inFlight=refresh().catch(()=>{
   if(cached&&clock()-cached.at<300000)return {...cached,source:'stale'};
   return result(validRows(fallback),'snapshot');
  }).finally(()=>{inFlight=null});
  return inFlight;
 }
 return async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');res.setHeader('Cache-Control','no-store');return res.status(405).end()}
  try{
   const value=await get();res.setHeader('ETag',value.etag);res.setHeader('X-Catalogue-Source',value.source);
   res.setHeader('Cache-Control',value.source==='live'?'public, max-age=0, s-maxage=15, stale-while-revalidate=30':'public, max-age=0, s-maxage=5');
   const matches=String(req.headers?.['if-none-match']||'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===value.etag);
   if(matches)return res.status(304).end();
   return req.method==='HEAD'?res.status(200).end():res.status(200).json(value.rows);
  }catch{res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Catalogue temporarily unavailable'})}
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
