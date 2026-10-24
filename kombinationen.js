(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.AIDACombinations=factory();
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const DAY=86400000;
  const GROUPS=[['inside','Innenkabine'],['outside','Meerblickkabine'],['balcony','Balkon / Veranda'],['junior','Junior-Suite'],['suite','Suite']];
  const portKey=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[\/,(]/)[0].trim();
  const daysBetween=(start,end)=>(Date.parse(end)-Date.parse(start))/DAY;
  function buildCombinations(data){
    const lookup=new Map([...(data.trips||[]),...(data.supportingTrips||[])].map(t=>[t.id,t]));
    return (data.combinations||[]).map(def=>{
      const legs=def.legIds.map(id=>lookup.get(id));
      if(legs.length<2||legs.some(t=>!t||t.isCombination))throw Error('Ungültige Teilreisen: '+def.id);
      if(portKey(legs[0].startPort)!=='hamburg'||portKey(legs.at(-1).endPort)!=='hamburg')throw Error('Keine Rundreise ab/bis Hamburg: '+def.id);
      let cruiseNights=0;const stays=[];
      for(let i=0;i<legs.length;i++){
        const leg=legs[i];const duration=daysBetween(leg.start,leg.end);
        if(!Number.isInteger(duration)||duration<=0||duration!==leg.nights)throw Error('Ungültige Dauer: '+leg.id);
        cruiseNights+=leg.nights;
        if(i){
          const previous=legs[i-1];const gap=daysBetween(previous.end,leg.start);
          if(!Number.isInteger(gap)||gap<0)throw Error('Überlappende Teilreisen: '+def.id);
          if(portKey(previous.endPort)!==portKey(leg.startPort))throw Error('Anschlusshäfen passen nicht: '+def.id);
          if(gap)stays.push({start:previous.end,end:leg.start,nights:gap,port:previous.endPort});
        }
      }
      const shipNames=[...new Set(legs.map(t=>t.ship))],start=legs[0].start,end=legs.at(-1).end;
      const nights=daysBetween(start,end),stayNights=stays.reduce((sum,s)=>sum+s.nights,0);
      if(nights!==cruiseNights+stayNights)throw Error('Gesamtdauer stimmt nicht: '+def.id);
      const sources=legs.flatMap(t=>t.sources);
      return {id:def.id,code:def.id,route:def.route,ship:shipNames.join(' + '),shipNames,scope:'combination',
        start,end,nights,cruiseNights,stayNights,stays,startPort:'Hamburg',endPort:'Hamburg',
        isCombination:true,combo:true,charter:false,legs,offers:[],sources,note:def.note||''};
    });
  }
  function priceRows(trip,state,helpers){
    return GROUPS.map(([group,label])=>{
      const parts=trip.legs.map(leg=>{
        const offer=helpers.eligibleOffers(leg,{...state,flights:false})
          .filter(o=>helpers.groupOf(o.cabin)===group).sort((a,b)=>a.price-b.price)[0]||null;
        return {leg,offer};
      });
      const complete=parts.every(p=>p.offer);
      const cabins=parts.filter(p=>p.offer).map(p=>p.offer.cabin);
      const tariffs=parts.filter(p=>p.offer).map(p=>p.offer.tariff);
      const offer=complete?{cabin:new Set(cabins).size===1?cabins[0]:label,tariff:new Set(tariffs).size===1?tariffs[0]:'GEMISCHT',
        price:parts.reduce((sum,p)=>sum+p.offer.price,0),flight:false,soldOut:false,calculated:true,source:0,
        components:parts.map(p=>({tripId:p.leg.id,...p.offer}))}:null;
      return {group,label,parts,offer};
    });
  }
  return {buildCombinations,priceRows,portKey,daysBetween};
});
