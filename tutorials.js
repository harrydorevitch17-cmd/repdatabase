const journey=document.querySelector('.haul-visual');
if(journey){
 const stages=[
  {title:'Find your piece',body:'Choose a product, then check the colour, size and measurements on Kakobuy before placing your order.',action:'Your move',tip:'Compare the size chart with something you already wear.',link:'#buying',label:'Read the buying guide'},
  {title:'The seller sends it to the warehouse',body:'After purchase, the seller ships your item to Kakobuy in China. This is the domestic leg of the journey.',action:'What to watch',tip:'Follow the order in Kakobuy. Warehouse arrival comes before international shipping.',link:'#buying',label:'See how ordering works'},
  {title:'Check the item that actually arrived',body:'Open your warehouse QC photos. Compare the item, colour, size label and visible details with your order.',action:'Before you ship',tip:'If something is unclear, ask about extra photos or return options while the item is still at the warehouse.',link:'#qc',label:'Open the QC checklist'},
  {title:'Choose your shipping and send it home',body:'Select the warehouse items you want to ship, confirm your address and compare the available shipping lines.',action:'Second payment',tip:'International shipping is paid separately from the item purchase. Review the final parcel charges in Kakobuy.',link:'#shipping',label:'Read the shipping guide'}
 ];
 const panel=document.createElement('section');panel.className='walkthrough-detail';panel.id='walkthrough-detail';panel.setAttribute('aria-label','Selected journey stage');
 panel.innerHTML='<div class="walkthrough-detail-top"><span class="walkthrough-detail-count"></span><span>YOUR NEXT MOVE</span></div><div class="walkthrough-detail-copy" aria-live="polite" aria-atomic="true"><h2></h2><p></p><div class="journey-tip"><strong></strong><span></span></div></div><div class="walkthrough-detail-actions"><a class="journey-read"></a><div class="journey-controls"><button type="button" aria-label="Previous stage">&#8592;</button><button type="button" aria-label="Next stage">&#8594;</button></div></div>';
 journey.querySelector('.journey-caption').replaceWith(panel);
 const stops=Array.from(journey.querySelectorAll('.journey-stop'),(a,i)=>{const b=document.createElement('button');b.type='button';b.className=a.className;b.innerHTML=a.innerHTML;b.setAttribute('aria-controls',panel.id);b.onclick=()=>select(i);a.replaceWith(b);return b});
 let selected=0;
 const select=i=>{
  selected=i;const stage=stages[i];
  stops.forEach((button,j)=>button.setAttribute('aria-pressed',String(j===i)));
  panel.querySelector('.walkthrough-detail-count').textContent=`0${i+1} / 04`;
  panel.querySelector('h2').textContent=stage.title;panel.querySelector('p').textContent=stage.body;
  panel.querySelector('.journey-tip strong').textContent=stage.action;panel.querySelector('.journey-tip span').textContent=stage.tip;
  const a=panel.querySelector('.journey-read');a.href=stage.link;a.textContent=stage.label+' \u2197';
  const controls=panel.querySelectorAll('button');controls[0].disabled=i===0;controls[1].disabled=i===stages.length-1;
 };
 const controls=panel.querySelectorAll('button');controls[0].onclick=()=>select(selected-1);controls[1].onclick=()=>select(selected+1);
 journey.classList.add('journey-interactive');select(0);
}
