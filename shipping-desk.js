'use strict';
(()=>{
const $=id=>document.getElementById(id),Core=window.ShippingCore;
const names=new Intl.DisplayNames(['en'],{type:'region'});
const state={number:'',mode:'empty',shipment:null,agentEvents:[],events:[],points:[],selected:null,airports:[],airport:null,flights:[],flightMode:'empty',matches:[],historyLimit:15};
let requestId=0,flightId=0,geoId=0,controller=null,flightController=null,geoPromise=null,carrierPromise=null,carriers=[],directoryLimit=9;
let map=null,mapLayers=null,streetTiles=null,streets=false,worldLoaded=false,worldLayer=null;
const icons={box:'<path d="m4 7 8-4 8 4v10l-8 4-8-4Z"/><path d="m4 7 8 4 8-4M12 11v10M8 5l8 4"/>',warehouse:'<path d="M3 21V8l9-5 9 5v13M1 21h22M7 21V11h10v10M7 15h10M7 18h10"/>',van:'<path d="M3 17V6h11v11M14 10h4l3 4v3h-3M7 17h7"/><circle cx="5" cy="18" r="2"/><circle cx="16" cy="18" r="2"/>',plane:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m8 12 3 3 5-6"/>',home:'<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/>'};
function svg(name){const element=document.createElementNS('http://www.w3.org/2000/svg','svg');element.setAttribute('viewBox','0 0 24 24');element.setAttribute('fill','none');element.setAttribute('stroke','currentColor');element.setAttribute('stroke-width','1.4');element.setAttribute('stroke-linecap','round');element.setAttribute('stroke-linejoin','round');element.setAttribute('aria-hidden','true');element.innerHTML=icons[name]||icons.box;return element;}
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function country(code){try{return code?names.of(code):'';}catch{return code||'';}}
function notice(message){$('tracking-status').textContent=message;$('tracking-status').hidden=!message;}
function datetime(event,compact=false){const value=event?.time||event?.timeUTC;if(!value)return 'Time not supplied';const epoch=Core.instant(event);if(epoch!==null)return new Intl.DateTimeFormat(undefined,compact?{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}:{dateStyle:'medium',timeStyle:'short'}).format(new Date(epoch))+' local';return value.replace('T',' ')+' (timezone not supplied)';}
function dateParts(event){const epoch=Core.instant(event);if(epoch===null)return {day:'Time not supplied',time:'--:--'};const date=new Date(epoch);return {day:new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'}).format(date),time:new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',hour12:false}).format(date)};}
function latestEvent(){return state.events[0]||null;}
function sourceLabel(event){return event?.source==='agent'?(state.mode==='demo'?'Example KakoBuy update':'KakoBuy / added by you'):(state.mode==='demo'?'Example carrier scan':event?.carrier||'Carrier scan');}
function setBusy(busy){$('tracking-form').querySelector('[type=submit]').disabled=busy;$('tracking-search')?.setAttribute('aria-busy',String(busy));}
function renderSummary(){
 const latest=latestEvent(),classification=latest?Core.classify(latest):null;
 $('demo-banner').hidden=state.mode!=='demo';$('parcel-number').textContent=state.number||'\u2014';
 $('destination-label').textContent=country(state.shipment?.destinationCountry||$('destination').value)||'Your door';
 $('data-source').textContent=state.mode==='demo'?'ILLUSTRATIVE EXAMPLE':latest?.source==='agent'?'ADDED BY YOU':latest?'CARRIER DATA':state.number?'AWAITING SCANS':'Awaiting a number';
 $('shipment-status').textContent=classification?.label||(state.number?'No scans available yet':'Ready when you are.');
 $('shipment-title').textContent=latest?classification.label:state.number?'Waiting for the first scan.':'Every handover. One place.';
 $('latest-description').textContent=latest?.description||(state.number?'New tracking numbers can take a few minutes to return carrier data. You can also add the update shown on your KakoBuy parcel page.':'Enter a tracking number to see its latest available carrier scan, reported location and shipping history.');
 $('parcel-scan-time').textContent=latest?datetime(latest):'\u2014';$('parcel-location').textContent=latest?.location||latest?.city||'Not reported';
 $('parcel-carrier').textContent=state.shipment?.carriers?.join(' / ')||'Not yet identified';
 $('refresh-parcel').disabled=!state.number;$('refresh-parcel').textContent=state.mode==='demo'?'Reset sample journey':'Check for updates';$('copy-number').disabled=!state.number;
 $('sync-note').textContent=state.mode==='demo'?'Example data for exploring the interface. No real parcel is being tracked.':state.shipment?.lastSynced?'Provider last synced: '+datetime({time:state.shipment.lastSynced})+'. Scan timestamps above may be older.':state.number?'Carrier information is shown as received. No location or delivery time is guessed.':'Scan time and lookup time are shown separately.';
}
function renderStages(){
 const observed=new Map();for(const event of [...state.events].reverse()){const c=Core.classify(event);if(c.id!=='unknown')observed.set(c.id,event);}
 const current=latestEvent()?Core.classify(latestEvent()).id:null;
 $('progress-stages').replaceChildren(...Core.stages.map(stage=>{
  const event=observed.get(stage.id),item=node('div',undefined,'progress-step'+(event?' observed':'')+(stage.id===current?' current':'')+(event?.source==='agent'?' agent-step':''));
  if(stage.id===current)item.setAttribute('aria-current','step');const icon=node('span',undefined,'progress-icon');icon.append(svg(stage.icon));item.append(icon,node('strong',stage.label),node('small',event?event.source==='agent'?'AGENT UPDATE':'SCAN REPORTED':'NOT REPORTED'));return item;
 }));
 const currentEvent=latestEvent();$('stage-context').textContent=currentEvent?(currentEvent.source==='agent'?'KakoBuy update you added: ':'Latest carrier update: ')+currentEvent.description:'Warehouse updates from your KakoBuy account can be added below. Carrier scans appear when tracking data is available.';
}
function renderHistory(){
 const filter=$('event-filter').value,events=state.events.filter(event=>filter==='all'||event.source===filter),shown=events.slice(0,state.historyLimit);
 $('event-count').textContent=events.length+' update'+(events.length===1?'':'s');const container=$('tracking-history');container.replaceChildren();
 if(!events.length){const empty=node('div',undefined,'history-empty');empty.append(node('span','\u25a1'),node('h3',state.number?'No updates in this view.':'The journey starts with a scan.'),node('p',state.number?'Carrier updates will appear when they are available. You can also add the wording from your KakoBuy parcel page.':'Carrier timestamps, locations and handovers will appear here. Select a located scan to focus it on the map.'));container.append(empty);return;}
 let day='';for(const event of shown){const parts=dateParts(event);if(parts.day!==day){container.append(node('span',parts.day,'history-group-label'));day=parts.day;}
  const item=node('article',undefined,'history-event'+(event.source==='agent'?' agent-event':''));item.append(node('time',parts.time,'history-time'));
  const body=node('div',undefined,'history-body');body.append(node('h3',event.description));if(event.location||event.city)body.append(node('p',event.location||event.city));
  body.append(node('span',sourceLabel(event),'history-source'+(event.source==='agent'?' agent':'')));
  if(Core.instant(event)===null)body.append(node('p','Time cannot be compared: timezone not supplied.'));
  if(event.source==='agent'&&event.id){const remove=node('button','Remove','delete-agent');remove.type='button';remove.addEventListener('click',()=>{state.agentEvents=state.agentEvents.filter(e=>e.id!==event.id);rebuildEvents();});body.append(remove);}
  if(event.mapPoint&&!event.mapPoint.ambiguous){const locate=node('button','View '+event.mapPoint.name+' on map \u2197','history-map-link');locate.type='button';locate.addEventListener('click',()=>selectPoint(event,true));body.append(locate);}
  else if(event.location||event.city)body.append(node('p',event.mapPoint?.ambiguous?'City name is ambiguous; no map pin placed.':'Location could not be matched to a city.'));
  item.append(body);container.append(item);
 }
 if(events.length>state.historyLimit){const more=node('button','Show more updates','btn history-more');more.type='button';more.addEventListener('click',()=>{state.historyLimit+=15;renderHistory();});container.append(more);}
}
async function loadGeo(){
 if(!geoPromise)geoPromise=Promise.all([fetch('/data/cities.json').then(r=>{if(!r.ok)throw Error('City data unavailable');return r.json();}),fetch('/data/airports.json').then(r=>{if(!r.ok)throw Error('Airport data unavailable');return r.json();})]).then(([cities,airports])=>({index:Core.cityIndex(cities),airports})).catch(error=>{geoPromise=null;throw error;});return geoPromise;
}
function initialiseMap(){
 if(!window.L){$('map-empty').querySelector('strong').textContent='Map could not load.';return;}
 map=L.map('shipment-map',{zoomControl:false,scrollWheelZoom:false,minZoom:1,maxZoom:16,worldCopyJump:true,attributionControl:true}).setView([28,55],2);
 L.control.zoom({position:'topright'}).addTo(map);map.attributionControl.setPrefix(false);map.attributionControl.addAttribution('World boundaries: <a href="https://www.naturalearthdata.com/">Natural Earth</a>');mapLayers=L.layerGroup().addTo(map);
 fetch('/data/world.json').then(r=>{if(!r.ok)throw Error('Map unavailable');return r.json();}).then(data=>{worldLayer=L.geoJSON(data,{style:{fillColor:'#d7dfcc',fillOpacity:.8,color:'#f4f6ee',weight:1},interactive:false}).addTo(map);worldLayer.bringToBack();if(streets)worldLayer.remove();worldLoaded=true;}).catch(()=>{$('map-note').textContent='Map boundaries could not load. Scan coordinates remain available.';});
}
function mapPopup(event){const content=node('div');content.append(node('strong',event.mapPoint.name),node('p',event.description),node('small',datetime(event)));return content;}
function renderMap(){
 if(!map||!mapLayers)return;mapLayers.clearLayers();state.points=state.events.filter(e=>e.mapPoint&&!e.mapPoint.ambiguous);
 const unique=[];let previous='';for(const event of [...state.points].reverse()){const key=event.mapPoint.lat.toFixed(3)+':'+event.mapPoint.lng.toFixed(3);if(key===previous)continue;previous=key;unique.push([event.mapPoint.lat,event.mapPoint.lng]);}
 if(unique.length>1)L.polyline(unique,{color:'#899574',weight:1.5,dashArray:'5 6',opacity:.8,interactive:false}).addTo(mapLayers);
 for(let i=state.points.length-1;i>=0;i--){const event=state.points[i],point=event.mapPoint,latest=i===0;
  const element=node('span',latest?'\u25a1':String(state.points.length-i));const icon=L.divIcon({className:'parcel-map-pin'+(event.source==='agent'?' agent':'')+(!latest?' historic':''),html:element.outerHTML,iconSize:latest?[28,28]:[19,19],iconAnchor:latest?[14,14]:[9,9]});
  const marker=L.marker([point.lat,point.lng],{icon,title:point.name+' / '+datetime(event),keyboard:true}).addTo(mapLayers).bindPopup(mapPopup(event));marker.on('click',()=>selectPoint(event,false));if(!state.points.slice(0,i).some(e=>e.mapPoint.name===point.name)){marker.bindTooltip(node('span',point.name),{permanent:true,direction:'top',offset:[0,-15],className:'scan-city-label'});}
 }
 const newest=latestEvent();$('map-empty').hidden=state.points.length>0;
 if(!state.points.length){$('map-empty').querySelector('strong').textContent=state.number?'No mappable scan yet.':'Your next stop, in context.';$('map-empty').querySelector('span:last-child').textContent=state.number?'A location must be reported before we place a pin.':'Track a parcel or explore the sample journey.';$('map-precision').textContent='No reported coordinates';$('map-selected').hidden=true;state.selected=null;map.setView([28,55],2,{animate:false});resetAirport();}
 else{
  const first=state.points[0];selectPoint(first,false);if(!state.streetPreference)setStreetMap(true);fitMap();
  $('map-note').textContent=newest&&(!newest.mapPoint||newest.mapPoint.ambiguous)?'The newest update has no mapped location. Showing the most recent scan that can be located. Pins are not live GPS.':'Pins show carrier-reported coordinates or approximate city centres. Dashed lines connect scans, not the actual transport route.';
 }
}
function fitMap(){if(!map)return;if(state.points.length>1)map.fitBounds(L.latLngBounds(state.points.map(e=>[e.mapPoint.lat,e.mapPoint.lng])),{padding:[50,60],maxZoom:8,animate:false});else if(state.points.length===1)map.setView([state.points[0].mapPoint.lat,state.points[0].mapPoint.lng],7,{animate:false});else map.setView([28,55],2,{animate:false});}
function selectPoint(event,move){
 if(!event.mapPoint||event.mapPoint.ambiguous)return;state.selected=event;const p=event.mapPoint;
 $('map-selected').hidden=false;$('map-selected-source').textContent=event.source==='agent'?'AGENT UPDATE / ADDED BY YOU':p.basis==='carrier'?'CARRIER-REPORTED LOCATION':'APPROXIMATE SCAN CITY';$('map-selected-name').textContent=p.name+(p.country?', '+country(p.country):'');$('map-selected-time').textContent=datetime(event,true);
 $('map-precision').textContent=p.basis==='carrier'?'Reported coordinates':'Approximate city centre';
 if(move&&map){map.setView([p.lat,p.lng],8,{animate:false});$('shipment-map').scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 configureAirports(event);
}
function resetAirport(){flightId++;flightController?.abort();state.airport=null;state.airports=[];$('departure-airport').replaceChildren(node('option','Locate a scan first'));$('departure-airport').disabled=true;$('load-flights').disabled=true;$('airport-proximity').textContent='Airport suggestions use distance from the mapped scan location.';$('flight-status').textContent='Tracking a parcel will help find nearby airports.';$('flight-board').replaceChildren();$('flight-source').textContent='';$('airport-website').hidden=true;$('flight-reference').hidden=true;}
function configureAirports(event){
 const point=event.mapPoint;if(!point||point.ambiguous||!state.geo)return;const nearby=Core.nearbyAirports(point,state.geo.airports);
 const previous=state.airport?.iata;state.airports=nearby;$('departure-airport').replaceChildren();
 if(!nearby.length){resetAirport();$('flight-status').textContent='No scheduled-service airport in our reference data was found within 150 km of this scan location.';return;}
 for(const airport of nearby){const option=node('option',airport.iata+' / '+(airport.city||airport.name)+' / '+Math.round(airport.distance)+' km');option.value=airport.iata;$('departure-airport').append(option);}
 $('departure-airport').disabled=false;$('load-flights').disabled=false;state.airport=nearby.find(a=>a.large)||nearby[0];$('departure-airport').value=state.airport.iata;
 if(previous!==state.airport.iata){flightId++;flightController?.abort();$('flight-board').replaceChildren();$('flight-source').textContent='';$('flight-status').textContent=state.mode==='demo'?'Example departures are available for this sample city.':'Choose an airport, then check its upcoming departures.';}
 updateAirportMeta();
}
function updateAirportMeta(){const airport=state.airport;if(!airport)return;const reference=Core.mentionedFlight(state.selected);$('flight-reference').hidden=!reference;$('flight-reference').textContent=reference?'Flight reference in this scan: '+reference+'. The departure board below is a separate schedule lookup.':'';$('airport-proximity').textContent=Math.round(airport.distance)+' km from '+state.selected.mapPoint.name+' (straight-line distance). This is a nearby airport, not a confirmed parcel handover.';$('airport-website').hidden=!airport.website;$('airport-website').href=airport.website||'#';}
async function rebuildEvents(){
 const id=++geoId;const events=state.shipment?.events||[];const latest=state.shipment?.latest;
 const sourceEvents=latest&&!events.some(e=>e.description===latest.description&&e.time===latest.time)?[latest,...events]:events;
 state.events=Core.mergeEvents(sourceEvents,state.agentEvents);renderSummary();renderStages();renderHistory();
 if(!state.events.length){renderMap();return;}
 $('map-precision').textContent='Locating reported scans';
 try{const geo=await loadGeo();if(id!==geoId)return;state.geo=geo;for(const event of state.events)event.mapPoint=Core.locate(event,geo.index);renderHistory();renderMap();}
 catch{if(id!==geoId)return;$('map-note').textContent='The location reference data could not load. Carrier scans are still shown in the history.';$('map-precision').textContent='Map data unavailable';}
}
async function loadCarriers(){
 if(!carrierPromise)carrierPromise=fetch('/carriers.json').then(r=>{if(!r.ok)throw Error('Directory unavailable');return r.json();}).then(data=>{carriers=data.carriers||[];$('tracking-carriers').replaceChildren(...carriers.map(c=>{const option=node('option',c.name);option.value=c.name+(c.country?' ('+c.country+')':'');return option;}));renderDirectory();return carriers;}).catch(error=>{carrierPromise=null;$('directory-status').textContent='The directory could not load. Please try again.';throw error;});return carrierPromise;
}
function renderDirectory(){const q=$('carrier-search').value.trim().toLowerCase(),region=$('destination').value;const list=carriers.filter(c=>(!region||c.country===region)&&(!q||c.name.toLowerCase().includes(q)));$('directory-status').textContent=list.length+' carrier portals'+(region?' in '+country(region):' worldwide');$('carrier-portals').replaceChildren(...list.slice(0,directoryLimit).map(c=>{const article=node('article',undefined,'seller-card');article.append(node('h3',c.name),node('p',country(c.country),'muted'));const link=node('a','Open carrier portal \u2197','btn');try{if(!['http:','https:'].includes(new URL(c.url).protocol))return article;}catch{return article;}link.href=c.url;link.target='_blank';link.rel='noopener noreferrer';article.append(link);return article;}));$('more-carriers').hidden=list.length<=directoryLimit;}
function clearTracking(){requestId++;controller?.abort();flightId++;flightController?.abort();geoId++;state.number='';state.mode='empty';state.shipment=null;state.agentEvents=[];state.events=[];state.points=[];state.matches=[];state.historyLimit=15;$('demo-banner').hidden=true;$('carrier-ambiguity').hidden=true;notice('');setBusy(false);renderSummary();renderStages();renderHistory();renderMap();}
async function track(number,keepAgent=false){
 const id=++requestId;controller?.abort();controller=new AbortController();const currentController=controller;
 const entered=$('tracking-carrier').value.trim();let chosen;
 if(entered){try{await loadCarriers();}catch{}if(id!==requestId)return;chosen=carriers.find(c=>c.name+(c.country?' ('+c.country+')':'')===entered);if(!chosen){notice('Choose a carrier from the list, or clear the field for automatic detection.');return;}}
 const agentEvents=keepAgent?state.agentEvents:[];state.number=number;state.mode='live';state.shipment=null;state.agentEvents=agentEvents;state.matches=[];state.historyLimit=15;$('carrier-ambiguity').hidden=true;flightId++;flightController?.abort();await rebuildEvents();if(id!==requestId)return;
 notice('Checking the latest available carrier updates...');setBusy(true);const timer=setTimeout(()=>currentController.abort(),28000);
 try{const payload={number};if(chosen)payload.carrier=Number(chosen.id);const response=await fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:currentController.signal});let data;try{data=await response.json();}catch{throw Error('The tracking connection is not available yet. You can add your KakoBuy update or explore the sample journey.');}if(id!==requestId)return;if(!response.ok)throw Error(data.message||'Tracking is temporarily unavailable.');
  state.matches=Array.isArray(data.shipments)?data.shipments:[];
  if(data.ambiguous&&state.matches.length>1){const select=$('carrier-match');select.replaceChildren(node('option','Choose a carrier'));select.firstChild.value='';state.matches.forEach((shipment,i)=>{const option=node('option',shipment.carriers?.join(' / ')||'Carrier '+shipment.carrierCode);option.value=String(i);select.append(option);});$('carrier-ambiguity').hidden=false;notice('Several carriers matched this number. Choose the one used by your sender.');}
  else{state.shipment=state.matches[0]||{number,events:[]};notice(data.pending?'No scans have returned yet. New registrations can take a few minutes. Add a KakoBuy account update if you have one.':'Latest available carrier scans loaded. Last checked '+new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date())+'.');await rebuildEvents();}
 }catch(error){if(id!==requestId)return;notice(error.name==='AbortError'?'The carrier lookup took too long. Try again in a moment.':error.message);}
 finally{clearTimeout(timer);if(id===requestId)setBusy(false);}
}
function sample(){
 clearTracking();state.mode='demo';state.number='EXAMPLE123456';const ago=hours=>new Date(Date.now()-hours*3600000).toISOString();
 state.agentEvents=[{id:'demo-warehouse',description:'Leaving the KakoBuy warehouse and shipping to the logistics provider',time:ago(76),location:'Shenzhen, China',city:'Shenzhen',country:'CN',source:'agent'},{id:'demo-qc',description:'Stored in KakoBuy warehouse. QC inspection completed.',time:ago(96),location:'Shenzhen, China',city:'Shenzhen',country:'CN',source:'agent'}];
 state.shipment={number:state.number,carriers:['Example international carrier'],destinationCountry:'AU',lastSynced:ago(1),events:[{description:'Airline received the shipment. Awaiting onward air transport.',time:ago(3),location:'Guangzhou, China',city:'Guangzhou',country:'CN',source:'carrier',carrier:'Example international carrier'},{description:'Shipment processed at the export sorting centre.',time:ago(20),location:'Guangzhou, China',city:'Guangzhou',country:'CN',source:'carrier',carrier:'Example international carrier'},{description:'Received by the logistics provider.',time:ago(65),location:'Dongguan, China',city:'Dongguan',country:'CN',source:'carrier',carrier:'Example international carrier'}]};
 $('destination').value='AU';rebuildEvents();notice('');
}
function flightTime(row){const value=row.estimated||row.scheduled;const date=new Date(value);if(!row.departureTimezone)return String(value).slice(11,16);try{return new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:row.departureTimezone||undefined}).format(date);}catch{return String(value).slice(11,16);}}
function flightCaption(row){const value=row.estimated||row.scheduled;let day=String(value).slice(5,10).replace('-','/');try{day=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:row.departureTimezone||'UTC'}).format(new Date(value));}catch{}return day+' / '+(row.estimated?'EST':'SCHED');}
function renderFlightBoard(rows){$('flight-board').replaceChildren(...rows.slice(0,8).map(row=>{const item=node('article',undefined,'departure-row');const time=node('div',undefined,'departure-time');time.append(node('strong',flightTime(row)),node('small',flightCaption(row)));const info=node('div',undefined,'departure-info');info.append(node('strong',row.to+' / '+(row.destination||'')),node('span',row.airline+(row.departureTimezone?' / '+row.departureTimezone:'')));const code=node('div',row.flight,'departure-code');code.append(node('small',state.mode==='demo'?'EXAMPLE':'SCHEDULE ONLY'));item.append(time,info,code);return item;}));}
async function loadFlights(){
 if(!state.airport)return;const id=++flightId;flightController?.abort();flightController=new AbortController();const airport=state.airport;$('flight-board').replaceChildren();$('flight-source').textContent='';$('flight-status').textContent='Checking scheduled departures from '+airport.iata+'...';$('load-flights').disabled=true;
 try{
  if(state.mode==='demo'){
   const departure=hours=>new Date(Date.now()+hours*3600000).toISOString();const rows=[{flight:'EX101',airline:'Example airline',to:'SYD',destination:'Sydney',scheduled:departure(2),departureTimezone:'Asia/Shanghai'},{flight:'EX205',airline:'Example airline',to:'MEL',destination:'Melbourne',scheduled:departure(5),departureTimezone:'Asia/Shanghai'},{flight:'EX312',airline:'Example airline',to:'SIN',destination:'Singapore',scheduled:departure(8),departureTimezone:'Asia/Shanghai'}];renderFlightBoard(rows);$('flight-status').textContent='Illustrative departure board. These are not real flights or your parcel booking.';$('flight-source').textContent='Sample data only. Real departure schedules require a connected flight-data provider.';return;
  }
  const response=await fetch('/api/flights?airport='+encodeURIComponent(airport.iata),{signal:flightController.signal});let data;try{data=await response.json();}catch{throw Error('Departure schedules are not available right now.');}if(id!==flightId)return;if(!response.ok)throw Error(data.message||'Departure schedules could not be loaded.');
  const rows=Array.isArray(data.flights)?data.flights:[];renderFlightBoard(rows);$('flight-status').textContent=rows.length?'Upcoming departures returned by the provider. None is confirmed to carry this parcel.':'No upcoming departures were returned in the provider\'s current coverage window.';$('flight-source').textContent=data.source+' / fetched '+datetime({time:data.fetchedAt},true)+'. '+(data.partial?'Partial provider coverage; other departures may exist.':data.scope||'');
 }catch(error){if(id!==flightId)return;$('flight-status').textContent=error.name==='AbortError'?'The departure request was cancelled.':error.message;}
 finally{if(id===flightId)$('load-flights').disabled=false;}
}
function openAgent(){
 if(!state.number){notice('Track a parcel first, or explore the sample journey, before adding its KakoBuy update.');$('tracking-number').focus();return;}
 $('agent-form').reset();$('agent-time').value=new Date(Date.now()+8*3600000).toISOString().slice(0,16);$('agent-dialog').showModal();
}
$('tracking-form').addEventListener('submit',event=>{event.preventDefault();const input=$('tracking-number');input.setCustomValidity('');const number=input.value.replace(/[\s-]/g,'').toUpperCase();if(!/^[A-Z0-9]{5,50}$/.test(number)){input.setCustomValidity('Enter 5 to 50 letters or numbers.');input.reportValidity();return;}track(number,state.number===number&&state.mode==='live');});
$('tracking-number').addEventListener('input',event=>{event.target.setCustomValidity('');if(state.mode!=='empty')clearTracking();});
$('tracking-carrier').addEventListener('focus',()=>loadCarriers().catch(()=>{}));
$('destination').addEventListener('change',()=>{renderSummary();directoryLimit=9;renderDirectory();});
$('demo-button').addEventListener('click',sample);$('exit-demo').addEventListener('click',()=>{$('tracking-number').value='';clearTracking();});
$('refresh-parcel').addEventListener('click',()=>state.mode==='demo'?sample():state.number&&track(state.number,true));
$('copy-number').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.number);$('copy-number').textContent='Copied';setTimeout(()=>{$('copy-number').textContent='Copy number';},2000);}catch{notice('Copy this tracking number: '+state.number);}});
$('carrier-match').addEventListener('change',event=>{state.shipment=state.matches[Number(event.target.value)]||null;if(event.target.value==='')state.shipment=null;rebuildEvents();});
$('event-filter').addEventListener('change',()=>{state.historyLimit=15;renderHistory();});
$('fit-map').addEventListener('click',fitMap);
function setStreetMap(enabled){
 if(!map)return;streets=enabled;$('map-style').setAttribute('aria-pressed',String(streets));
 if(streets){if(!streetTiles){streetTiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:19});streetTiles.on('tileerror',()=>{if(worldLayer&&!map.hasLayer(worldLayer))worldLayer.addTo(map).bringToBack();$('map-note').textContent='Some street tiles could not load. The local world map and scan locations remain available.';});}if(worldLayer)worldLayer.remove();streetTiles.addTo(map);}else{if(streetTiles)streetTiles.remove();if(worldLayer)worldLayer.addTo(map).bringToBack();}
}
$('map-style').addEventListener('click',()=>{state.streetPreference=true;setStreetMap(!streets);});
$('departure-airport').addEventListener('change',()=>{state.airport=state.airports.find(a=>a.iata===$('departure-airport').value)||null;flightId++;flightController?.abort();$('flight-board').replaceChildren();$('flight-source').textContent='';$('flight-status').textContent='Check the selected airport for scheduled departures.';$('load-flights').disabled=!state.airport;updateAirportMeta();});
$('load-flights').addEventListener('click',loadFlights);
$('add-agent-update').addEventListener('click',openAgent);$('add-agent-bottom').addEventListener('click',openAgent);$('close-agent').addEventListener('click',()=>$('agent-dialog').close());
$('agent-form').addEventListener('submit',event=>{
 event.preventDefault();const description=$('agent-description').value.trim(),raw=$('agent-time').value,zone=$('agent-timezone').value;if(!description||!raw)return;
 let time=raw;if(zone==='local')time=new Date(raw).toISOString();else if(zone!=='unknown')time=raw+':00'+zone;
 state.agentEvents.push({id:crypto.randomUUID(),source:'agent',description,time,location:$('agent-location').value.trim(),city:$('agent-location').value.trim(),country:$('agent-country').value.trim().toUpperCase()});$('agent-dialog').close();rebuildEvents();
});
document.querySelector('.carrier-directory').addEventListener('toggle',event=>{if(event.target.open)loadCarriers().catch(()=>{});});$('carrier-search').addEventListener('input',()=>{directoryLimit=9;renderDirectory();});$('more-carriers').addEventListener('click',()=>{directoryLimit+=9;renderDirectory();});
const codes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ').sort((a,b)=>country(a).localeCompare(country(b)));
$('destination').append(...codes.map(code=>{const option=node('option',country(code));option.value=code;return option;}));
initialiseMap();renderStages();
fetch('/api/tracking-config').then(r=>{if(!r.ok)throw Error('No configuration');return r.json();}).then(config=>{$('connection-state').textContent=config.tracking?'Carrier connection available':'Live carrier connection pending';$('connection-state').classList.toggle('connected',config.tracking);}).catch(()=>{$('connection-state').textContent='Live carrier connection pending';});
})();
