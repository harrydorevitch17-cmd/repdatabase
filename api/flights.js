'use strict';
const {upcomingFlights}=require('../lib/shipping-core.js');
const airports=require('../data/airports.json');
const airportCodes=new Set(airports.map(a=>a.iata));
const cache=new Map(),inFlight=new Map();
const TTL=10*60*1000;
async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method',message:'Use GET for airport departures.'});}
 const airport=String(req.query?.airport||'').toUpperCase();
 if(!/^[A-Z]{3}$/.test(airport)||!airportCodes.has(airport))return res.status(400).json({error:'invalid_airport',message:'Select an airport from the list.'});
 const key=process.env.AVIATIONSTACK_API_KEY;
 if(!key)return res.status(503).json({error:'not_configured',message:'Departure schedules are not connected yet. Airport and map information remain available.'});
 const cached=cache.get(airport);if(cached&&Date.now()-cached.at<TTL)return res.status(200).json({...cached.data,flights:cached.data.flights.filter(f=>f.departureEpoch>Date.now()),cached:true});
 try{
  if(!inFlight.has(airport)){
   const query=new URLSearchParams({access_key:key,dep_iata:airport,flight_status:'scheduled',limit:'100'});
   const request=(async()=>{
    const response=await fetch('https://api.aviationstack.com/v1/flights?'+query,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Provider unavailable');const payload=await response.json();
    if(payload.error||!Array.isArray(payload.data))throw new Error('Provider response rejected');
    const data={airport,flights:upcomingFlights(payload.data,airport),fetchedAt:new Date().toISOString(),source:'Aviationstack',scope:'Returned scheduled departures within 36 hours. Coverage may be partial.',partial:Number(payload.pagination?.total||0)>payload.data.length,parcelAssociation:'unconfirmed'};
    cache.set(airport,{data,at:Date.now()});for(const [code,item] of cache)if(Date.now()-item.at>TTL)cache.delete(code);return data;
   })();inFlight.set(airport,request);
  }
  const data=await inFlight.get(airport);return res.status(200).json(data);
 }catch{return res.status(502).json({error:'provider_unavailable',message:'Airport departures could not be retrieved. Please try again later.'});}
 finally{inFlight.delete(airport);}
}
module.exports=handler;
