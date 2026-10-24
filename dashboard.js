(function () {
  'use strict';
  const CombinationCore=typeof module==='object'&&module.exports?require('./kombinationen.js'):window.AIDACombinations;
  const CalendarCore=typeof module==='object'&&module.exports?require('./kalender.js'):window.MeerzeitCalendar;
  const FEATURED=new Set(['LU43270110','LU21270222','DIE4271024','MA44271105','MA21271219']);
  const shipsOf=trip=>trip.shipNames||[trip.ship];
  const operatorOf=trip=>trip.operator||'AIDA';
  const featured=trip=>FEATURED.has(trip.id)||(operatorOf(trip)==='Mein Schiff'&&trip.nights>=15);
  const priceNights=trip=>trip.cruiseNights||trip.nights;
  const BASE = new Set(['PREMIUM', 'CLASSIC', 'LIGHT', 'PAUSCHAL', 'CHARTER', 'ANGEBOT']);
  const GROUPS = [
    ['inside', 'Innen'], ['outside', 'Meerblick'], ['balcony', 'Balkon / Veranda'],
    ['junior', 'Junior-Suite'], ['suites', 'Suite / Kategorie*']
  ];
  const defaults = {scope:'all',roundtripType:'featured',atlanticType:'oneway',operator:'',ship:'',startPort:'',endPort:'',dateFrom:'',dateTo:'',month:'',route:'',search:'',cabin:'Innenkabine',tariff:'BASE',duration:'',budget:'',flights:false,pricedOnly:false,display:'person',sort:'date',page:1};
  const norm = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss');
  const harborKey=value=>{
    const key=CombinationCore.portKey(value);
    return ({palma:'palma de mallorca','gran canaria':'las palmas','santa cruz':'santa cruz de tenerife'})[key]||key;
  };
  const harborLabel=value=>({'palma de mallorca':'Palma de Mallorca','las palmas':'Las Palmas (Gran Canaria)','santa cruz de tenerife':'Santa Cruz (Teneriffa)'})[harborKey(value)]||value;
  const portMatches=(actual,selected)=>!selected||harborKey(actual)===harborKey(selected);
  function searchMatches(trip,query){
    const tokens=norm(query).match(/[\p{L}\p{N}]+/gu)||[];
    if(!tokens.length)return true;
    const requestedShip=norm(query).match(/\bmein\s*schiff\s*(\d+|relax|flow)\b/);
    if(requestedShip&&!shipsOf(trip).some(ship=>norm(ship)==='mein schiff '+requestedShip[1]))return false;
    const month=new Date(trip.start+'T12:00:00Z').toLocaleDateString('de-DE',{month:'long',timeZone:'UTC'});
    const haystack=norm([operatorOf(trip),...shipsOf(trip),...shipsOf(trip).map(s=>s.replace(/\s/g,'')),trip.route,trip.startPort,trip.endPort,harborLabel(trip.startPort),harborLabel(trip.endPort),...(trip.regions||[]),trip.start,month].join(' '));
    const words=haystack.match(/[\p{L}\p{N}]+/gu)||[];
    return tokens.every(token=>/^\d+$/.test(token)?words.includes(token):haystack.includes(token));
  }
  function groupOf(cabin) {
    const c = norm(cabin);
    if (c.includes('anbietergruppe')) return 'suitegroup';
    if (c.includes('junior')) return 'junior';
    if (c.includes('suite')) return 'suite';
    if (c.includes('innen')) return 'inside';
    if (c.includes('meerblick') || c.includes('außen') || c.includes('aussen')) return 'outside';
    if (c.includes('balkon') || c.includes('veranda')) return 'balcony';
    return 'other';
  }
  function cabinMatches(cabin, selection) {
    if (!selection || selection === '@any') return true;
    if (selection === '@suites') return ['suite','suitegroup'].includes(groupOf(cabin));
    if (selection.startsWith('@')) return groupOf(cabin) === selection.slice(1);
    if (selection === 'Innenkabine') return groupOf(cabin) === 'inside';
    if (selection === 'Meerblickkabine') return groupOf(cabin) === 'outside';
    if (selection === 'Suite') return groupOf(cabin) === 'suite';
    if (selection === 'Junior-Suite') return groupOf(cabin) === 'junior';
    return cabin === selection;
  }
  function combinationPriceRows(trip,state){return CombinationCore.priceRows(trip,state,{eligibleOffers,groupOf});}
  function eligibleOffers(trip, state) {
    if(trip.isCombination)return combinationPriceRows(trip,state).map(row=>row.offer).filter(Boolean);
    return trip.offers.filter(o => Number.isFinite(o.price) && o.price > 0 && !o.soldOut && !o.onRequest && !o.stale &&
      (state.flights || !o.flight) &&
      (state.tariff === 'ALL' || (state.tariff === 'BASE' ? BASE.has(o.tariff) : o.tariff === state.tariff)));
  }
  function bestOffer(trip, state, selection = state.cabin) {
    return eligibleOffers(trip, state).filter(o => cabinMatches(o.cabin, selection))
      .sort((a,b) => a.price - b.price || Number(a.flight) - Number(b.flight))[0] || null;
  }
  function historyStats(series){
    const points=(series?.points||[]).filter(p=>p[2]==='available'&&Number.isFinite(p[1])&&p[1]>0);
    const last=series?.points?.at(-1);
    return {points,first:points[0]||null,last:last?.[2]==='available'?last:null,min:points.length?Math.min(...points.map(p=>p[1])):null,max:points.length?Math.max(...points.map(p=>p[1])):null};
  }
  const historySourceKey=url=>url.includes('mykreuzfahrt.de/landingpage.php')?'https://www.mykreuzfahrt.de/tui-cruises/mein-schiff-2027/':url;
  function currentHistoryOffer(trip,series){
    return trip.offers.find(o=>!o.stale&&!o.soldOut&&!o.onRequest&&o.cabin===series.cabin&&o.tariff===series.tariff&&o.flight===series.flight&&historySourceKey(trip.sources[o.source].url)===series.sourceUrl)||null;
  }
  function scopeMatches(trip,state) {
    if(state.scope==='all')return !trip.isCombination;
    if(state.scope==='kiel')return !trip.isCombination&&portMatches(trip.startPort,'Kiel');
    if(state.scope==='roundtrip'){
      const type=state.roundtripType||'featured';
      if(type==='combined')return !!trip.isCombination;
      return !trip.isCombination&&CombinationCore.portKey(trip.startPort)==='hamburg'&&CombinationCore.portKey(trip.endPort)==='hamburg'&&(type==='all'||featured(trip));
    }
    if (state.scope === 'atlantic') return !!trip.atlantic && (state.atlanticType === 'all' || trip.atlantic === (state.atlanticType || 'oneway'));
    return !state.scope || trip.scope === state.scope;
  }
  function filterTrips(trips, state, ignoreMonth = false) {
    return trips.filter(t => {
      if (!scopeMatches(t,state)) return false;
      if (state.operator && operatorOf(t)!==state.operator) return false;
      if (!portMatches(t.startPort,state.startPort)||!portMatches(t.endPort,state.endPort)) return false;
      if (state.dateFrom && t.start<state.dateFrom) return false;
      if (state.dateTo && t.start>state.dateTo) return false;
      if (state.ship && !shipsOf(t).includes(state.ship)) return false;
      if (!ignoreMonth && state.month && Number(t.start.slice(5,7)) !== Number(state.month)) return false;
      if (state.route && t.route !== state.route) return false;
      if (!searchMatches(t,state.search)) return false;
      if (state.duration === 'short' && t.nights > 7) return false;
      if (state.duration === 'medium' && (t.nights < 8 || t.nights > 14)) return false;
      if (state.duration === 'long' && (t.nights < 15 || t.nights > 28)) return false;
      if (state.duration === 'extended' && t.nights < 29) return false;
      const best = bestOffer(t,state);
      if (state.pricedOnly && !best) return false;
      const budget = Number(state.budget);
      if (budget > 0 && (!best || best.price > budget)) return false;
      return true;
    });
  }
  function sortTrips(trips,state) {
    return [...trips].sort((a,b) => {
      const pa = bestOffer(a,state)?.price ?? Infinity, pb = bestOffer(b,state)?.price ?? Infinity;
      let order = 0;
      if (state.sort === 'price') order = pa === pb ? 0 : pa - pb;
      if (state.sort === 'night') order = pa / priceNights(a) === pb / priceNights(b) ? 0 : pa / priceNights(a) - pb / priceNights(b);
      if (state.sort === 'duration') order = a.nights - b.nights;
      return order || a.start.localeCompare(b.start) || a.ship.localeCompare(b.ship) || a.nights - b.nights;
    });
  }
  function displayPrice(price,nights,mode) {
    return mode === 'cabin' ? price * 2 : mode === 'night' ? price / nights : price;
  }
  function csvEncode(value) {
    let str = String(value ?? '');
    if (/^[=+@\-]/.test(str)) str = "'" + str;
    return '"' + str.replace(/"/g,'""') + '"';
  }
  function offerSources(trip,offer){
    if(!offer?.calculated)return offer?[trip.sources[offer.source]]:trip.sources;
    return offer.components.map(part=>trip.legs.find(leg=>leg.id===part.tripId).sources[part.source]);
  }
  function csvRowsForTrip(trip,state){
    const rows=trip.isCombination?combinationPriceRows(trip,state).map(row=>({offer:row.offer,cabin:row.label,parts:row.parts})):
      eligibleOffers(trip,state).map(offer=>({offer,cabin:offer.cabin,parts:[]}));
    if(!rows.length)rows.push({offer:null,cabin:'kein Preis erfasst',parts:[]});
    return rows.map(row=>{
      const offer=row.offer,sources=offerSources(trip,offer),components=row.parts.map(p=>p.offer);
      const flight=offer?(offer.flight?'ja':'nein'):'';
      const legText=trip.isCombination?trip.legs.map(leg=>leg.ship+' · '+leg.route+' · '+leg.start+' bis '+leg.end).join(' | '):'';
      const scope=trip.isCombination?'Berechnete Kombination':'Veröffentlichtes Reiseangebot';
      const scopeNote=trip.isCombination?(trip.stayNights?'Nur Kreuzfahrten; Unterkunft, Verpflegung und Transfers im Zwischenaufenthalt nicht enthalten':'Summe zweier Einzelbuchungen; keine Zusage derselben Kabine'):'';
      const format=value=>Number.isFinite(value)?value.toFixed(2).replace('.',','):'';
      return [trip.ship,trip.route,trip.start,trip.end,trip.nights,trip.startPort,trip.endPort,row.cabin,
        offer?(offer.calculated?offer.components.map(p=>p.tariff).join(' + '):offer.tariff):'',
        format(offer?.price),format(offer?offer.price*2:null),flight,
        sources.map(s=>s.url).join(' | '),sources.map(s=>s.checkedAt).join(' | '),
        scope,priceNights(trip),trip.stayNights||0,trip.isCombination?(offer?'Berechnete Kreuzfahrten-Summe':'Unvollständig – keine Summe'):'Veröffentlichter Ab-Preis',
        format(components[0]?.price),format(components[1]?.price),scopeNote,legText,operatorOf(trip)];
    });
  }
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = {currentHistoryOffer,historyStats,operatorOf,harborKey,portMatches,searchMatches,buildCombinations:CombinationCore.buildCombinations,combinationPriceRows,shipsOf,priceNights,csvRowsForTrip,offerSources,scopeMatches,groupOf,cabinMatches,eligibleOffers,bestOffer,filterTrips,sortTrips,displayPrice,csvEncode,defaults};
    return;
  }
  const AIDA = window.AIDA2027, MEIN = window.MEINSCHIFF2027;
  const DATA = AIDA&&MEIN?{...AIDA,trips:[...AIDA.trips,...MEIN.trips]}:null;
  if (!DATA || !Array.isArray(DATA.trips)) {
    document.getElementById('coverage').textContent = 'Die Reisedaten konnten nicht geladen werden. Bitte index.html zusammen mit den übrigen Dateien im Ordner öffnen.';
    return;
  }
  const initialScope = ({'#alle':'all','#mein-schiff':'all','#transatlantik':'atlantic','#rueckreisen':'incoming','#hamburg':'hamburg','#kiel':'kiel','#rundreisen':'roundtrip','#rundreisen-alle':'roundtrip','#kombinationen':'roundtrip'})[window.location.hash] || 'all';
  const trips = [...DATA.trips,...CombinationCore.buildCombinations(DATA)], state = {...defaults,scope:initialScope,operator:window.location.hash==='#mein-schiff'?'Mein Schiff':'',roundtripType:window.location.hash==='#kombinationen'?'combined':window.location.hash==='#rundreisen-alle'?'all':'featured',flights:['incoming','atlantic'].includes(initialScope)}, pageSize = 20;
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:state.display === 'night' ? 2 : 0}).format(value);
  const integerMoney = value => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);
  const date = value => new Date(value + 'T12:00:00Z').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Berlin'});
  const stamp = value => new Date(value).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'});
  const tariffName = t => ({ANGEBOT:'Angebot · Tarif prüfen',CHARTER:'Chartertarif',GEMISCHT:'Tarife je Teilreise'}[t] || t);
  const cabinOptions = [['@any','Günstigste Kabinenart'],['Innenkabine','Innenkabine'],['Meerblickkabine','Meerblick / Außenkabine'],['@balcony','Balkon / Veranda – alle'],['Balkonkabine','Balkonkabine'],['Verandakabine','Verandakabine'],['Verandakabine Komfort','Veranda Komfort'],['Verandakabine Deluxe','Veranda Deluxe'],['Panorama-Balkonkabine','Panorama-Balkonkabine'],['Junior-Suite','Junior-Suite'],['Suite','Suite – eindeutig bestimmt'],['@suitegroup','Suite – Anbietergruppe*']];
  $('cabin').innerHTML = cabinOptions.map(([v,l])=>`<option value="${escape(v)}">${escape(l)}</option>`).join('');
  $('cabin').value = state.cabin;
  $('price-date').textContent = 'Preisabruf AIDA: '+stamp(AIDA.lastUpdate?.attemptedAt||AIDA.generatedAt)+' · Mein Schiff: '+stamp(MEIN.lastUpdate?.attemptedAt||MEIN.generatedAt)+' Uhr';
  const updates=[['AIDA',AIDA.lastUpdate],['Mein Schiff',MEIN.lastUpdate]].filter(([,r])=>r);
  if(updates.length){
    const notice=document.createElement('details');notice.className='update-notice';
    const checked=updates.reduce((sum,[,r])=>sum+r.ok,0),issues=updates.reduce((sum,[,r])=>sum+r.errors+r.manual+(r.skipped||0),0);
    notice.innerHTML=`<summary><strong>${checked} Quellen aktualisiert</strong><span>${issues?issues+' Hinweise':'Alle Abfragen bestätigt'} <span aria-hidden="true">⌄</span></span></summary><p>${escape(updates.map(([name,r])=>`${name}: ${r.ok} Quellen aktualisiert${r.errors?', '+r.errors+' Abruffehler':''}${r.manual?', '+r.manual+' manuell zu prüfen':''}${r.skipped?', '+r.skipped+' nicht abgefragt':''}`).join(' · '))}. Unbestätigte alte Preise stehen nur in den Details und im Verlauf.</p>`;
    document.querySelector('.intro').after(notice);
  }
  let filtered = [],currentView=window.location.hash==='#kalender'?'calendar':'list';
  const calendar=CalendarCore.create({root:$('calendar-panel'),year:2027,operatorOf,harborKey,harborLabel,bestOffer,displayPrice,priceNights,money,date,escape,tariffName,
    cabinLabel:selection=>cabinOptions.find(([value])=>value===selection)?.[1]||selection,
    openTrip:showDetail,onMonthChange:month=>{state.month=month;state.page=1;render();},onReset:reset});
  const scopeNames = {all:'Alle erfassten Reisen 2027',hamburg:'Ab Hamburg',kiel:'Ab Kiel',incoming:'Ausland → Hamburg / Kiel',atlantic:'Transatlantik',roundtrip:'Rundreisen ab/bis Hamburg'};
  const scopeDescriptions = {
    all:DATA.trips.length+' erfasste Reisen von AIDA & Mein Schiff. Abreise 2027; das Ende kann in 2028 liegen.',
    roundtrip:'Hamburg ist Start und Ziel. Alle erfassten Rundreisen, große Fernrundreisen oder fünf berechnete AIDA-Kombinationen wählen. Das Reiseende kann 2028 liegen.',
    hamburg:'Alle erfassten Reisen mit Einschiffung in Hamburg im Kalenderjahr 2027.',
    kiel:'Reisen von AIDA & Mein Schiff mit Start in Kiel im Jahr 2027. Für Rundreisen auch Kiel als Zielhafen wählen.',
    incoming:'Im Ausland einsteigen und in Hamburg oder Kiel ankommen. Start jeweils im Jahr 2027.',
    atlantic:'Europa ↔ Amerika: erfasste Überfahrten von AIDA und Mein Schiff mit Start 2027. Reisen nach Afrika zählen nicht als Transatlantik. Rund- und Weltreisen findest du unter „Weitere Filter“.'
  };
  function syncControls() {
    for (const id of ['search','operator','startPort','endPort','dateFrom','dateTo','route','cabin','tariff','duration','budget','display','sort']) $(id).value=state[id];
    $('flights').checked=state.flights;$('priced-only').checked=state.pricedOnly;
    $('atlantic-type').value=state.atlanticType;
  }
  function renderScope() {
    document.querySelectorAll('[data-scope]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.scope===state.scope)));
    document.querySelectorAll('[data-scope-count]').forEach(x=>x.textContent=trips.filter(t=>(!state.operator||operatorOf(t)===state.operator)&&scopeMatches(t,{scope:x.dataset.scopeCount,atlanticType:'oneway',roundtripType:'all'})).length);
    $('scope-description').textContent=scopeDescriptions[state.scope];
    $('results-eyebrow').textContent=scopeNames[state.scope];
    $('atlantic-type-field').hidden=state.scope!=='atlantic';
    $('roundtrip-nav').hidden=state.scope!=='roundtrip';
    $('combination-notice').hidden=state.scope!=='roundtrip'||state.roundtripType!=='combined';
    document.querySelectorAll('[data-roundtrip-type]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.roundtripType===state.roundtripType));button.querySelector('span').textContent=trips.filter(t=>(!state.operator||operatorOf(t)===state.operator)&&scopeMatches(t,{scope:'roundtrip',roundtripType:button.dataset.roundtripType})).length;});
    const monthNames=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    $('selected-month').textContent=state.month?monthNames[Number(state.month)-1]:'Ganzes Jahr';
    const chips=[];
    if(state.operator)chips.push(['operator',state.operator]);
    if(state.ship)chips.push(['ship',state.ship]);
    if(state.startPort)chips.push(['startPort','Ab '+state.startPort]);
    if(state.endPort)chips.push(['endPort','Bis '+state.endPort]);
    if(state.dateFrom)chips.push(['dateFrom','Abreise ab '+date(state.dateFrom)]);
    if(state.dateTo)chips.push(['dateTo','Abreise bis '+date(state.dateTo)]);
    if(state.month)chips.push(['month',monthNames[Number(state.month)-1]]);
    if(state.search)chips.push(['search','Suche: '+state.search]);
    if(state.route)chips.push(['route',state.route]);
    if(state.tariff!=='BASE')chips.push(['tariff',tariffName(state.tariff)]);
    if(state.duration)chips.push(['duration',$('duration').selectedOptions[0].textContent]);
    if(Number(state.budget)>0)chips.push(['budget','Bis '+integerMoney(Number(state.budget))+' p. P.']);
    if(state.flights)chips.push(['flights','Flugpakete einbezogen']);
    if(state.pricedOnly)chips.push(['pricedOnly','Nur mit Preis']);
    if(state.scope==='atlantic'&&state.atlanticType!=='oneway')chips.push(['atlanticType',$('atlantic-type').selectedOptions[0].textContent]);
    $('active-filters').innerHTML=chips.length?chips.map(([key,label])=>`<button type="button" data-clear="${key}" class="filter-chip" aria-label="Filter entfernen: ${escape(label)}">${escape(label)} <span aria-hidden="true">×</span></button>`).join(''):'<span class="filter-hint">Alle Termine · Ab-Preise für 2 Erwachsene</span>';
    const invalidDates=!!(state.dateFrom&&state.dateTo&&state.dateFrom>state.dateTo);
    $('date-error').hidden=!invalidDates;
    $('dateFrom').setAttribute('aria-invalid',String(invalidDates));$('dateTo').setAttribute('aria-invalid',String(invalidDates));
    const advanced=chips.filter(([key])=>['dateFrom','dateTo','route','tariff','duration','budget','pricedOnly','atlanticType'].includes(key)).length;
    $('advanced-count').textContent=advanced?'('+advanced+')':'';
  }
  function renderShips() {
    const relevant = trips.filter(t=>scopeMatches(t,state)&&(!state.operator||operatorOf(t)===state.operator)&&
      portMatches(t.startPort,state.startPort)&&portMatches(t.endPort,state.endPort)&&
      (!state.dateFrom||t.start>=state.dateFrom)&&(!state.dateTo||t.start<=state.dateTo)&&
      (!state.month||Number(t.start.slice(5,7))===Number(state.month)));
    const ships = [...new Set([...relevant.flatMap(shipsOf),...(state.ship?[state.ship]:[])])].sort();
    $('ship-select').innerHTML='<option value="">Alle Schiffe</option>'+ships.map(s=>`<option value="${escape(s)}">${escape(s)}</option>`).join('');
    $('ship-select').value=state.ship;
    $('ship-nav').innerHTML = [['','Alle Schiffe'],...ships.map(s=>[s,s])].map(([value,label]) => {
      const count = value ? relevant.filter(t=>shipsOf(t).includes(value)).length : relevant.length;
      return `<button type="button" class="ship-button" data-ship="${escape(value)}" aria-label="${escape(label)}: ${count} Reisevarianten" aria-pressed="${state.ship === value}">${escape(label)}<span aria-hidden="true">${count}</span></button>`;
    }).join('');
  }
  function renderRoutes() {
    const relevant=trips.filter(t=>scopeMatches(t,state)&&(!state.operator||operatorOf(t)===state.operator)&&(!state.ship||shipsOf(t).includes(state.ship)));
    for(const field of ['startPort','endPort']){
      const options=[...new Set(relevant.map(t=>harborKey(t[field])))].sort((a,b)=>a.localeCompare(b,'de'));
      const labels=new Map(relevant.map(t=>[harborKey(t[field]),harborLabel(t[field])]));
      if(state[field]&&!options.includes(harborKey(state[field])))state[field]='';
      $(field).innerHTML='<option value="">Alle Häfen</option>'+options.map(v=>`<option value="${escape(v)}">${escape(labels.get(v))}</option>`).join('');
      $(field).value=state[field];
    }
    const tariffs=[...new Set(relevant.flatMap(t=>t.isCombination?t.legs.flatMap(leg=>leg.offers.map(o=>o.tariff)):t.offers.map(o=>o.tariff)))].sort();
    if(!['BASE','ALL',...tariffs].includes(state.tariff))state.tariff='BASE';
    $('tariff').innerHTML='<option value="BASE">Günstigster Basistarif / Anbieterpreis</option><option value="ALL">Alle Tarife / Pakete</option>'+tariffs.map(v=>`<option value="${escape(v)}">${escape(tariffName(v))}</option>`).join('');
    $('tariff').value=state.tariff;
    const routes = [...new Set(relevant.filter(t=>portMatches(t.startPort,state.startPort)&&portMatches(t.endPort,state.endPort)).map(t=>t.route))].sort((a,b)=>a.localeCompare(b,'de'));
    if (state.route && !routes.includes(state.route)) state.route = '';
    $('route').innerHTML = '<option value="">Alle Routen</option>' + routes.map(r=>`<option value="${escape(r)}">${escape(r)}</option>`).join('');
    $('route').value = state.route;
  }
  function renderMonths() {
    const rows = filterTrips(trips,state,true);
    const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    const counts = months.map((_,i)=>rows.filter(t=>Number(t.start.slice(5,7)) === i+1).length);
    const max = Math.max(1,...counts);
    $('months').innerHTML = months.map((label,i)=> {
      const offers = rows.filter(t=>Number(t.start.slice(5,7))===i+1).map(t=>({t,o:bestOffer(t,state)})).filter(x=>x.o);
      const cheapest = offers.map(x=>({...x,value:displayPrice(x.o.price,priceNights(x.t),state.display)})).sort((a,b)=>a.value-b.value)[0];
      const quote = cheapest ? 'ab '+money(cheapest.value)+(cheapest.o.flight?' · inkl. Flug':'') : 'Kein Kabinenpreis';
      return `<button type="button" class="month month-choice" data-month="${i+1}" aria-pressed="${Number(state.month)===i+1}" aria-label="${label} 2027: ${counts[i]} Reiseangebote, ${quote}" style="--fill:${Math.round(counts[i]/max*100)}%"><strong>${label}</strong><span class="month-count">${counts[i]} <span>Reisen</span></span><small>${quote}</small></button>`;
    }).join('');
  }
  function priceCell(trip, group, label) {
    const offer = bestOffer(trip,state,'@'+group);
    if (!offer) return `<td class="cabin-price" data-label="${label}"><span class="no-price" title="${trip.isCombination?'Keine vollständige Kreuzfahrten-Summe für diese Kabine':'Kein Preis erfasst'}">—</span></td>`;
    const formatted = money(displayPrice(offer.price,priceNights(trip),state.display));
    return `<td class="cabin-price" data-label="${label}"><button type="button" class="price-button" data-detail="${escape(trip.id)}" aria-label="${escape((offer.calculated?'Berechnete Kreuzfahrten-Summe · ':'')+label+': ab '+formatted+', '+offer.cabin+', '+tariffName(offer.tariff)+(offer.flight?', inklusive Flug':''))}"><strong>${formatted}</strong><small>${escape(offer.cabin.replace('kabine','').replace('Veranda Komfort','Komfort'))}<br>${escape(tariffName(offer.tariff))}</small>${offer.calculated?'<span class="calculated-mark">Σ Einzelpreise</span>':''}${offer.flight?'<span class="flight-mark">inkl. Flug</span>':''}</button></td>`;
  }
  function renderRows() {
    filtered = sortTrips(filterTrips(trips,state),state);
    const pages = Math.max(1,Math.ceil(filtered.length/pageSize));
    state.page = Math.min(state.page,pages);
    const offset = (state.page-1)*pageSize;
    const priced = filtered.filter(t=>bestOffer(t,state));
    const min = priced.length ? Math.min(...priced.map(t=>displayPrice(bestOffer(t,state).price,priceNights(t),state.display))) : null;
    const cabinLabel = cabinOptions.find(([v])=>v === state.cabin)?.[1] || state.cabin;
    $('result-count').textContent = filtered.length;
    $('result-label').textContent='passende Reisen';
    const shipCount=new Set(filtered.flatMap(shipsOf)).size;
    $('coverage').textContent = `${shipCount} ${shipCount===1?'Schiff':'Schiffe'} · ${priced.length} mit Preis für ${cabinLabel}${min === null ? '' : ' · ab '+money(min)}`;
    $('basis-label').textContent = `Preise ${state.display==='cabin'?'für 2 Erwachsene':state.display==='night'?'pro Person und Bordnacht':'pro Person'} · ${$('tariff').selectedOptions[0].textContent}${state.flights?' · Flugpakete gekennzeichnet':' · ohne Flug'}`;
    $('journeys-body').innerHTML = filtered.slice(offset,offset+pageSize).map(t=>{
      const selected=bestOffer(t,state);
      const preview=selected?`<button type="button" class="mobile-price" data-detail="${escape(t.id)}" aria-label="Alle Preise, ab ${escape(money(displayPrice(selected.price,priceNights(t),state.display)))}"><span>${escape(cabinLabel)} ab</span><strong>${money(displayPrice(selected.price,priceNights(t),state.display))}</strong><small>${state.display==='cabin'?'für 2 Erwachsene':state.display==='night'?'pro Person / Bordnacht':'pro Person'} · ${escape(tariffName(selected.tariff))}${selected.calculated?' <b>Σ Kreuzfahrten</b>':''}${selected.flight?' <b>inkl. Flug</b>':''}</small></button>`:'<div class="mobile-price missing"><span>Für diese Kabinenwahl kein Preis erfasst</span></div>';
      const badges = [`<span class="badge operator ${operatorOf(t)==='Mein Schiff'?'mein-schiff':''}">${escape(operatorOf(t))}</span>`,t.atlantic?`<span class="badge atlantic">${({oneway:'Atlantiküberquerung',roundtrip:'Hin- & Rücküberquerung',world:'Weltreise'})[t.atlantic]}</span>`:'',t.charter?'<span class="badge">Charter</span>':'',t.isCombination?'<span class="badge calculated">Berechnete Kombination</span>':t.combo?'<span class="badge">Kombireise</span>':'',t.scope === 'incoming'?'<span class="badge">Transitreise</span>':'',!t.isCombination&&!t.offers.some(o=>!o.soldOut&&!o.onRequest&&!o.stale)?'<span class="badge warn">Kein aktueller Preis</span>':'',!state.flights&&t.offers.some(o=>o.flight&&!o.stale&&!o.soldOut)&&!t.offers.some(o=>!o.flight&&!o.stale&&!o.soldOut)?'<button type="button" class="badge flight-reveal" data-show-flights="true">Flugpreise anzeigen +</button>':''].join('');
      return `<tr><td class="date-cell" data-label="Reisezeitraum"><span class="date-start">${date(t.start)}</span><span class="date-end">bis ${date(t.end)}</span></td><td class="route-cell"><span class="ship-label">${escape(t.ship)}</span><span class="route-name">${escape(t.route)}</span><span class="end-port">${escape(t.startPort === t.endPort?'ab/bis '+t.startPort:t.startPort+' → '+t.endPort)}</span>${badges}${t.isCombination?`<span class="journey-breakdown">${t.cruiseNights} Nächte an Bord${t.stayNights?' + '+t.stayNights+' Nächte Aufenthalt':' · direkter Anschluss'}${t.shipNames.length>1?' · Schiffwechsel':''}</span>`:''}${preview}</td><td class="nights-cell" data-label="Nächte"><span class="night-count">${t.nights}</span>${t.isCombination?`<small class="duration-breakdown">${t.cruiseNights} Bord${t.stayNights?" + "+t.stayNights+" Aufenthalt":""}</small>`:""}</td>${GROUPS.map(([g,l])=>priceCell(t,g,l)).join('')}<td class="detail-cell"><button type="button" class="detail-button" data-detail="${escape(t.id)}">${t.isCombination?"Plan & Teilpreise →":"Kabinen & Preise →"}</button></td></tr>`;
    }).join('');
    $('empty-state').hidden = !!filtered.length;
    document.querySelector('.table-wrap').hidden = !filtered.length;
    $('page-label').textContent = filtered.length ? `${offset+1}–${Math.min(offset+pageSize,filtered.length)} von ${filtered.length} · Seite ${state.page} / ${pages}` : '0 Ergebnisse';
    $('prev').disabled = state.page <= 1;
    $('next').disabled = state.page >= pages;
    $('export').disabled = !filtered.length;
    const isCalendar=currentView==='calendar';
    $('calendar-panel').hidden=!isCalendar;$('list-panel').hidden=isCalendar;$('sort-field').hidden=isCalendar;
    document.body.classList.toggle('calendar-mode',isCalendar);
    document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===currentView)));
    if(isCalendar){
      const summary=calendar.render(filtered,state);
      $('result-count').textContent=summary.count;$('result-label').textContent=summary.noun;
      $('coverage').textContent=filtered.length+' Reisevarianten · '+summary.ships+' Schiffe · '+cabinLabel+' · '+(state.flights?'Flugpakete gekennzeichnet':'ohne Flug');
    }
    $('filter-result-link').textContent=$('result-count').textContent+' '+(isCalendar?'Abfahrten':'Reisen')+' ansehen ↓';
  }
  function render() {renderShips();renderRoutes();renderScope();renderMonths();renderRows();}
  function reset() {
    const scope=state.scope,roundtripType=state.roundtripType;Object.assign(state,defaults,{scope,roundtripType,flights:['incoming','atlantic'].includes(scope)});syncControls();render();
  }
  function selectScope(scope) {
    const cabin=state.cabin,display=state.display,operator=state.operator;
    Object.assign(state,defaults,{scope,cabin,display,operator,flights:['incoming','atlantic'].includes(scope)});
    syncControls();render();
    try {history.replaceState(null,'',({all:'#alle',hamburg:'#hamburg',kiel:'#kiel',incoming:'#rueckreisen',atlantic:'#transatlantik',roundtrip:'#rundreisen'})[scope]);} catch {}
  }
  function showCombinationDetail(t){
    const rows=combinationPriceRows(t,state);
    $('dialog-ship').textContent=t.ship+' · berechnete Kombination';
    $('dialog-title').textContent=t.route;
    $('dialog-dates').textContent=`${date(t.start)} – ${date(t.end)} · ${t.nights} Nächte / ${t.nights+1} Kalendertage · Hamburg → Hamburg`;
    const costNotice=t.stayNights?
      'Die angezeigten Summen enthalten ausschließlich die zwei Kreuzfahrten. Unterkunft, Verpflegung und Transfers für '+t.stayNights+' Nächte Zwischenaufenthalt sind nicht enthalten. Ein Gesamtpreis für die gesamte Reise ist damit noch offen.':
      'Die Beträge sind berechnete Summen zweier Einzelbuchungen. Eine durchgehend gleiche Kabine und die gemeinsame Verfügbarkeit sind nicht bestätigt.';
    const plan=t.legs.map((leg,index)=>{
      const gap=index<t.legs.length-1?CombinationCore.daysBetween(leg.end,t.legs[index+1].start):0;
      const connection=index<t.legs.length-1?(gap?`<li class="stay-step"><strong>${gap} Nächte Zwischenaufenthalt in ${escape(leg.endPort)}</strong><span>${date(leg.end)} – ${date(t.legs[index+1].start)} · selbst zu organisieren und zusätzlich zu bezahlen</span></li>`:`<li class="connection-step">Direkter Anschluss am ${date(leg.end)} in ${escape(leg.endPort)}</li>`):'';
      return `<li><span class="leg-label">KREUZFAHRT ${index+1} · ${escape(leg.ship)}</span><strong>${escape(leg.route)}</strong><span>${date(leg.start)} – ${date(leg.end)} · ${leg.nights} Nächte</span><span>${escape(leg.startPort)} → ${escape(leg.endPort)}</span></li>${connection}`;
    }).join('');
    const partCell=part=>{
      if(!part.offer)return '<td><strong class="no-price">—</strong><small>Kein passender Preis erfasst</small></td>';
      const source=part.leg.sources[part.offer.source];
      return `<td><strong>${integerMoney(part.offer.price)}</strong><small>${escape(part.offer.cabin)}<br>${escape(tariffName(part.offer.tariff))}</small><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">Quelle ↗</a></td>`;
    };
    const priceTable=`<div class="combination-table-wrap"><table class="combination-prices"><caption>Kreuzfahrten-Summen · ${escape($('tariff').selectedOptions[0].textContent)} · ohne Flug</caption><thead><tr><th>Kabinenart</th><th>Kreuzfahrt 1 / Person</th><th>Kreuzfahrt 2 / Person</th><th>Summe / Person</th><th>Summe / 2 Erw.</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escape(row.label)}</td>${row.parts.map(partCell).join('')}<td class="sum-cell"><strong>${row.offer?integerMoney(row.offer.price):'—'}</strong><small>${row.offer?'Σ Einzelpreise':'Teilpreis fehlt'}</small></td><td class="sum-cell"><strong>${row.offer?integerMoney(row.offer.price*2):'—'}</strong><small>${row.offer?'für 2 Erwachsene':'keine vollständige Summe'}</small></td></tr>`).join('')}</tbody></table></div>`;
    const individual=t.legs.map((leg,index)=>`<details class="leg-quotes"><summary>Alle erfassten Kabinen und Tarife für Kreuzfahrt ${index+1} · ${escape(leg.ship)}</summary><p class="source-note">${escape(leg.route)} · ${date(leg.start)} – ${date(leg.end)}</p><div class="offer-table-wrap"><table class="offer-table"><thead><tr><th>Kabinenart</th><th>Tarif / Paket</th><th class="number">Pro Person</th><th class="number">2 Erwachsene</th><th>Quelle</th></tr></thead><tbody>${leg.offers.map(o=>`<tr><td>${escape(o.cabin)}</td><td>${escape(tariffName(o.tariff))}<br><span class="muted">${o.flight?'inkl. Flug · nicht in der Summe':'ohne Flug'}</span></td><td class="number">${integerMoney(o.price)}</td><td class="number">${integerMoney(o.price*2)}</td><td><a href="${escape(leg.sources[o.source].url)}" target="_blank" rel="noopener noreferrer">Angebot ↗</a></td></tr>`).join('')}</tbody></table></div><button type="button" class="history-leg-button" data-history-trip="${escape(leg.id)}">Preisverlauf dieser Teilreise ansehen →</button><div class="source-note">${leg.sources.map(s=>`<div><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)}</a> · abgerufen ${escape(stamp(s.checkedAt))} Uhr</div>`).join('')}</div></details>`).join('');
    $('dialog-content').innerHTML=`<div class="combination-duration"><strong>${t.nights} Nächte gesamt</strong><span>${t.cruiseNights} Nächte an Bord</span><span>${t.stayNights?t.stayNights+' Nächte Zwischenaufenthalt':'Direkter Anschluss · '+(t.shipNames.length===1?'gleiches Schiff':'Schiffwechsel')}</span></div><p class="detail-note">${escape(costNotice)}</p>${priceTable}<p class="source-note">Je Kabinengruppe wird der günstigste passende Preis ohne Flug auf jeder Teilreise verwendet. Die konkrete Kabinenart und der Tarif stehen bei den Teilpreisen. Unterschiedliche Tarife können unterschiedliche Leistungen haben. Fehlt ein Teilpreis, bleibt die Summe offen. Der Preis pro Bordnacht bezieht sich auf ${t.cruiseNights} Nächte an Bord.</p><h3 class="combo-plan-heading">Reiseablauf</h3><ol class="leg-plan">${plan}</ol>${t.note?`<p class="source-note">${escape(t.note)}</p>`:''}${individual}`;
    if(!$('trip-dialog').open)$('trip-dialog').showModal();
  }
  let historyTrip=null;
  function historyMarkup(t){
    const series=t.priceHistory||[];
    if(!series.length)return '<section class="price-history"><h3>Preisverlauf</h3><p>Noch keine vergleichbaren Beobachtungen erfasst.</p></section>';
    return `<section class="price-history" aria-labelledby="history-title"><div class="history-heading"><h3 id="history-title">Preisverlauf</h3><span class="badge">Pro Person · 2 Erwachsene</span></div><div class="history-controls"><label for="history-cabin">Kabinenart<select id="history-cabin">${[...new Set(series.map(s=>s.cabin))].map(c=>`<option value="${escape(c)}">${escape(c)}</option>`).join('')}</select></label><label for="history-series">Tarif & Anreise<select id="history-series"></select></label></div><div id="history-chart" aria-live="polite"></div><details class="history-explanation"><summary>Wie werden die Preise verglichen?</summary><p class="source-note">Jede Linie vergleicht dieselbe Kabine, denselben Tarif, dieselbe Flugart und dieselbe Quelle für 2 Erwachsene. Der Verlauf beginnt mit dem ersten dokumentierten Abruf. Fehlende Kategoriepreise sind Lücken; ein Abruffehler erzeugt keinen neuen Preispunkt.</p></details></section>`;
  }
  function renderHistory(index){
    const series=historyTrip?.priceHistory?.[index],root=$('history-chart');if(!root||!series)return;
    const stats=historyStats(series),points=series.points,valid=stats.points;
    const first=stats.first,last=stats.last,diff=first&&last?last[1]-first[1]:null;
    const start=Date.parse(points[0][0]),end=Date.parse(points.at(-1)[0]);
    const lo=stats.min||0,hi=stats.max||1,pad=Math.max((hi-lo)*.15,hi*.01,1);
    const chartWidth=Math.max(200,Math.min(700,root.clientWidth||260));
    const x=p=>54+(Date.parse(p[0])-start)/Math.max(end-start,1)*(chartWidth-70);
    const y=p=>160-(p[1]-lo+pad)/(hi-lo+2*pad)*130;
    let runs=[],run=[];for(const p of points){if(p[2]==='available'&&p[1]>0)run.push(p);else if(run.length){runs.push(run);run=[];}}if(run.length)runs.push(run);
    const svg=valid.length?`<svg class="history-svg" viewBox="0 0 ${chartWidth} 208" role="img" aria-label="Preisverlauf ${escape(series.cabin)}: ${valid.length} Beobachtungen, von ${escape(stamp(points[0][0]))} bis ${escape(stamp(points.at(-1)[0]))}"><line x1="54" y1="160" x2="${chartWidth-16}" y2="160" stroke="currentColor" opacity=".2"/><text x="4" y="${y([start,hi])+4}">${integerMoney(hi)}</text>${lo!==hi?`<text x="4" y="${y([start,lo])+4}">${integerMoney(lo)}</text>`:''}${runs.map(r=>`<polyline fill="none" stroke="var(--history-line,#066b72)" stroke-width="3" points="${r.map(p=>x(p).toFixed(2)+','+y(p).toFixed(2)).join(' ')}"/>`).join('')}${valid.map(p=>`<circle cx="${x(p).toFixed(2)}" cy="${y(p).toFixed(2)}" r="4" fill="var(--history-line,#066b72)"><title>${escape(stamp(p[0]))}: ${integerMoney(p[1])}</title></circle>`).join('')}<text x="54" y="195">${date(points[0][0].slice(0,10))}</text><text x="${chartWidth-16}" y="195" text-anchor="end">${date(points.at(-1)[0].slice(0,10))}</text></svg>`:'';
    const labels={available:'Veröffentlichter Ab-Preis',unavailable:'Kategoriepreis nicht mehr geliefert',soldout:'Als ausgebucht erfasst',request:'Auf Anfrage'};
    root.innerHTML=`${currentHistoryOffer(historyTrip,series)?'':'<p class="history-warning">Dieser Preis ist aktuell nicht bestätigt. Der Verlauf zeigt die bisher dokumentierten Preisstände.</p>'}<p class="history-selection">${escape(series.cabin)} · ${escape(tariffName(series.tariff))}<br>${series.flight?'Inklusive Flug':'Ohne Flug'} · ${escape(new URL(series.sourceUrl).hostname)}</p>${svg}<div class="history-metrics"><div><span>${currentHistoryOffer(historyTrip,series)?'Letzter Preisstand':'Historischer Stand'}</span><strong>${last?integerMoney(last[1]):'Kein verfügbarer Preis'}</strong><small>${escape(stamp(points.at(-1)[0]))} Uhr</small></div><div><span>Seit erster Beobachtung</span><strong>${diff===null?'—':(diff>0?'+':'')+integerMoney(diff)}</strong><small>${points.length} erfasste Preisstände</small></div><div><span>Bisheriger Tiefstpreis</span><strong>${stats.min===null?'—':integerMoney(stats.min)}</strong><small>gleiche Angebotsgrundlage</small></div></div>${points.length<2?'<p class="history-empty">Erster Preisstand erfasst. Nach dem nächsten erfolgreichen Abruf entsteht der Verlauf.</p>':''}<details class="history-observations"><summary>Alle Preisstände als Tabelle</summary><div class="offer-table-wrap"><table class="offer-table"><thead><tr><th>Abrufzeitpunkt</th><th class="number">Pro Person</th><th>Status</th></tr></thead><tbody>${[...points].reverse().map(p=>`<tr><td>${escape(stamp(p[0]))} Uhr</td><td class="number">${p[1]===null?'—':integerMoney(p[1])}</td><td>${escape(labels[p[2]]||p[2])}</td></tr>`).join('')}</tbody></table></div></details><p class="source-note">Quelle: <a href="${escape(series.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(new URL(series.sourceUrl).hostname)} ↗</a> · EUR pro Person</p>`;
  }
  function initHistory(t){
    historyTrip=t;const select=$('history-series');if(!select)return;
    const selected=bestOffer(t,state)||bestOffer(t,state,'@any');
    let index=selected?(t.priceHistory||[]).findIndex(s=>s.cabin===selected.cabin&&s.tariff===selected.tariff&&s.flight===selected.flight&&new URL(s.sourceUrl).hostname===new URL(t.sources[selected.source].url).hostname):-1;
    if(index<0)index=(t.priceHistory||[]).findIndex(s=>cabinMatches(s.cabin,state.cabin)&&(!s.flight||state.flights)&&historyStats(s).last);
    if(index<0)index=0;
    $('history-cabin').value=t.priceHistory[index].cabin;
    setHistoryCabin(t.priceHistory[index].cabin,index);
  }
  function setHistoryCabin(cabin,preferred=-1){
    const series=historyTrip.priceHistory.map((s,i)=>({s,i})).filter(({s})=>s.cabin===cabin);
    $('history-series').innerHTML=series.map(({s,i})=>`<option value="${i}">${escape(s.tariff==='ANGEBOT'?'Angebot':tariffName(s.tariff))} · ${s.flight?'mit Flug':'ohne Flug'}${series.some(({s:other,i:otherId})=>otherId!==i&&other.tariff===s.tariff&&other.flight===s.flight)?' · '+escape(new URL(s.sourceUrl).hostname):''}</option>`).join('');
    const cheapest=bestOffer(historyTrip,state,cabin);
    const chosen=series.find(({i})=>i===preferred)||series.find(({s})=>cheapest&&currentHistoryOffer(historyTrip,s)===cheapest)||series.find(({s})=>currentHistoryOffer(historyTrip,s)&&(!s.flight||state.flights))||series.find(({s})=>historyStats(s).last&&(!s.flight||state.flights))||series[0];
    $('history-series').value=String(chosen.i);renderHistory(chosen.i);
  }
  $('dialog-content').addEventListener('change',event=>{if(event.target.id==='history-cabin')setHistoryCabin(event.target.value);else if(event.target.id==='history-series')renderHistory(Number(event.target.value));});
  window.addEventListener('resize',()=>{if($('trip-dialog').open&&$('history-series'))renderHistory(Number($('history-series').value));});
  $('dialog-content').addEventListener('click',event=>{const button=event.target.closest('[data-history-trip]');if(button)showDetail(button.dataset.historyTrip);});
  function showDetail(id) {
    const t = [...trips,...(DATA.supportingTrips||[])].find(t=>t.id === id);if(!t)return;
    if(t.isCombination){showCombinationDetail(t);return;}
    $('dialog-ship').textContent = operatorOf(t)+' · '+t.ship + (t.charter?' · Charterreise':t.atlantic?' · '+({oneway:'Atlantiküberquerung',roundtrip:'Karibik-Rundreise',world:'Weltreise'})[t.atlantic]:t.scope==='incoming'?' · Transitreise':'');
    $('dialog-title').textContent = t.route;
    $('dialog-dates').textContent = `${date(t.start)} – ${date(t.end)} · ${t.nights} Nächte · ${t.startPort} → ${t.endPort}`;
    const isMein=operatorOf(t)==='Mein Schiff';
    const note = (t.bookingUrl?`<p class="booking-link"><a class="primary-button" href="${escape(t.bookingUrl)}" target="_blank" rel="noopener noreferrer">Reise beim Anbieter öffnen ↗</a></p>`:'')+(!isMein&&t.note?`<p class="detail-note">${escape(t.note)}</p>`:isMein?'<p class="source-note">Mein Schiff · All Inclusive. Konkreter Tarif beim Anbieter prüfen. „Suitenkategorie“ kann Junior-Suiten enthalten.</p>':'');
    const sources = t.sources.map((s,i)=>`<div>[${i+1}] <a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)}</a> · abgerufen ${escape(stamp(s.checkedAt))} Uhr${s.updateStatus&&s.updateStatus!=='ok'?' · '+escape(s.updateError||'Erneut prüfen'):''}</div>`).join('');
    const offers=[...t.offers].sort((a,b)=>Number(a.flight)-Number(b.flight)||groupOf(a.cabin).localeCompare(groupOf(b.cabin))||a.cabin.localeCompare(b.cabin,'de')||a.price-b.price);
    $('dialog-content').innerHTML = note + historyMarkup(t) + '<p class="source-note">Veröffentlichte Ab-Preise für 2 Erwachsene. Einzelne Kategoriecodes, Tarife und Flugpakete bleiben getrennt. Die Tabellenwerte sind keine verbindliche Buchungszusage.</p>' + (offers.length ? `<div class="offer-table-wrap"><table class="offer-table"><thead><tr><th>Kabinenart</th><th>Tarif / Paket</th><th class="number">Pro Person</th><th class="number">Kabine / 2 Erw.</th><th>Status / Quelle</th></tr></thead><tbody>${offers.map(o=>`<tr${o.soldOut?' class="sold-out"':''}><td>${escape(o.cabin)}</td><td>${escape(tariffName(o.tariff))}<br><span class="muted">${o.flight?'inkl. Flug':'ohne Flug'}</span></td><td class="number">${integerMoney(o.price)}</td><td class="number">${integerMoney(o.price*2)}</td><td>${o.stale?'Alter Preis · erneut prüfen':o.soldOut?'ausgebucht · veröffentlichter Preis':o.onRequest?'auf Anfrage · veröffentlichter Preis':'Ab-Preis'}<br><a href="${escape(t.sources[o.source].url)}" target="_blank" rel="noopener noreferrer">Angebot [${o.source+1}] ↗</a></td></tr>`).join('')}</tbody></table></div>` : '<p class="detail-note">Für diese Reise wurde bei der Preisabfrage kein Kabinenpreis geliefert. Bitte den Anbieterlink für eine erneute Prüfung öffnen.</p>') + (isMein&&t.note?`<details class="leg-quotes"><summary>Preisgrundlage und Kabineneinordnung</summary><p class="source-note">${escape(t.note)}</p></details>`:'') + `<div class="source-note">${sources}</div>`;
    if(!$('trip-dialog').open)$('trip-dialog').showModal();
    initHistory(t);
  }
  function exportCSV() {
    const header=['Schiff','Reise','Start','Ende','Gesamtdauer Nächte','Starthafen','Zielhafen','Kabinenart','Tarif','Preis pro Person EUR','Preis für 2 Erwachsene EUR','Flug enthalten','Quelle','Preis abgerufen','Angebotsart','Bordnächte','Zwischenaufenthalt Nächte','Preisgrundlage','Kreuzfahrt 1 pro Person EUR','Kreuzfahrt 2 pro Person EUR','Weitere Kosten / Grenzen','Teilstrecken','Reederei'];
    const rows=[header,...filtered.flatMap(t=>csvRowsForTrip(t,state))];
    const blob=new Blob(['\ufeff'+rows.map(row=>row.map(csvEncode).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='meerzeit-2027-preisliste.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.querySelector('.view-switch').addEventListener('click',event=>{
    const button=event.target.closest('[data-view]');if(!button)return;currentView=button.dataset.view;renderRows();
    try{history.replaceState(null,'',currentView==='calendar'?'#kalender':({all:'#alle',hamburg:'#hamburg',kiel:'#kiel',incoming:'#rueckreisen',atlantic:'#transatlantik',roundtrip:state.roundtripType==='combined'?'#kombinationen':state.roundtripType==='all'?'#rundreisen-alle':'#rundreisen'})[state.scope]);}catch{}
    $('results-title').scrollIntoView({block:'start'});$('results-title').focus({preventScroll:true});
  });
  $('ship-nav').addEventListener('click',event=>{const b=event.target.closest('[data-ship]');if(!b)return;state.ship=b.dataset.ship;state.route='';state.page=1;render();});
  $('months').addEventListener('click',event=>{const b=event.target.closest('[data-month]');if(!b)return;state.month=state.month===b.dataset.month?'':b.dataset.month;state.page=1;render();});
  document.querySelector('.direction').addEventListener('click',event=>{const b=event.target.closest('[data-scope]');if(b)selectScope(b.dataset.scope);});
  $('roundtrip-nav').addEventListener('click',event=>{
    const button=event.target.closest('[data-roundtrip-type]');if(!button)return;
    state.roundtripType=button.dataset.roundtripType;state.ship='';state.route='';state.month='';state.page=1;render();
    try{history.replaceState(null,'',state.roundtripType==='combined'?'#kombinationen':state.roundtripType==='all'?'#rundreisen-alle':'#rundreisen');}catch{}
  });
  document.querySelectorAll('[data-quick]').forEach(button=>button.addEventListener('click',()=>{
    const type=button.dataset.quick;Object.assign(state,defaults,{scope:type==='hamburg-round'?'roundtrip':'all',roundtripType:'all',operator:type==='mein-schiff'?'Mein Schiff':''});
    syncControls();render();try{history.replaceState(null,'',type==='mein-schiff'?'#mein-schiff':type==='hamburg-round'?'#rundreisen-alle':'#alle');}catch{}
  }));
  $('operator').addEventListener('change',()=>{state.operator=$('operator').value;state.ship='';state.route='';state.startPort='';state.endPort='';state.tariff='BASE';state.page=1;render();});
  $('ship-select').addEventListener('change',()=>{state.ship=$('ship-select').value;state.route='';state.page=1;render();});
  $('atlantic-type').addEventListener('change',()=>{state.atlanticType=$('atlantic-type').value;state.ship='';state.route='';state.month='';state.page=1;render();});
  $('compare-mobile').addEventListener('change',()=>document.querySelector('.table-wrap').classList.toggle('compare-all',$('compare-mobile').checked));
  $('active-filters').addEventListener('click',event=>{const b=event.target.closest('[data-clear]');if(!b)return;const key=b.dataset.clear;state[key]=defaults[key];if(key==='ship')state.route='';if(key==='operator'){state.ship='';state.route='';state.startPort='';state.endPort='';state.tariff='BASE';}state.page=1;syncControls();render();});
  $('all-months').addEventListener('click',()=>{state.month='';state.page=1;render();});
  for(const id of ['search','startPort','endPort','dateFrom','dateTo','route','cabin','tariff','duration','budget','display','sort']) $(id).addEventListener(id==='search'||id==='budget'?'input':'change',()=>{state[id]=$(id).value;state.page=1;render();});
  for(const [id,key] of [['flights','flights'],['priced-only','pricedOnly']])$(id).addEventListener('change',()=>{state[key]=$(id).checked;state.page=1;render();});
  $('reset').addEventListener('click',reset);$('empty-reset').addEventListener('click',reset);
  function changePage(delta){state.page+=delta;renderRows();$('results-title').scrollIntoView({block:'start'});$('results-title').focus({preventScroll:true});}
  $('prev').addEventListener('click',()=>changePage(-1));$('next').addEventListener('click',()=>changePage(1));
  $('journeys-body').addEventListener('click',event=>{
    if(event.target.closest('[data-show-flights]')){state.flights=true;syncControls();render();$('results-title').scrollIntoView({block:'start'});$('results-title').focus({preventScroll:true});return;}
    const b=event.target.closest('[data-detail]');if(b)showDetail(b.dataset.detail);
  });
  $('export').addEventListener('click',exportCSV);$('close-dialog').addEventListener('click',()=>$('trip-dialog').close());
  $('trip-dialog').addEventListener('click',event=>{if(event.target===$('trip-dialog')){const r=$('trip-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('trip-dialog').close();}});
  document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();selectScope('all');window.scrollTo({top:0});});
  document.querySelectorAll('a[href="#results-title"]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();$('results-title').scrollIntoView({block:'start'});$('results-title').focus({preventScroll:true});}));
  syncControls();render();
})();
