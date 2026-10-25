// Public catalogue only. The fallback key has the existing anonymous read permissions.
module.exports=async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end()}
 try{
  const url=process.env.SUPABASE_URL||'https://xbhqvoapbfhyhcrhafxm.supabase.co';
  const key=process.env.SUPABASE_ANON_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaHF2b2FwYmZoeWhjcmhhZnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MjUxNTcsImV4cCI6MjEwNjUwMTE1N30.w-AH-743HhJjDwazZg-AdkuotzANoCd7kwXH6exIo-g';
  const upstream=await fetch(url+'/rest/v1/products?select=*&order=created_at.desc,id.desc',{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(7000)});
  if(!upstream.ok)throw Error('Catalogue unavailable');
  const rows=await upstream.json();if(!Array.isArray(rows))throw Error('Invalid catalogue');
  res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=60');
  return req.method==='HEAD'?res.status(200).end():res.status(200).json(rows);
 }catch{return res.status(503).json({error:'Catalogue temporarily unavailable'})}
};
