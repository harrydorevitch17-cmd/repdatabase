'use strict';
module.exports=function(req,res){res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({error:'method'});return res.status(200).json({tracking:!!process.env.TRACKING_API_KEY,flights:!!process.env.AVIATIONSTACK_API_KEY});};
