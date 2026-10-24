(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.MeerzeitCalendar=factory();
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const WEEKDAYS=['Mo','Di','Mi','Do','Fr','Sa','So'];
  function buildDepartures(trips,year,{operatorOf,harborKey}){
    const groups=new Map(),seen=new Set();
    for(const trip of trips){
      if(seen.has(trip.id)||!trip.start?.startsWith(year+'-'))continue;
      const check=new Date(trip.start+'T12:00:00Z');
      if(!Number.isFinite(check.getTime())||check.toISOString().slice(0,10)!==trip.start)throw Error('Ungültiges Kalenderdatum: '+trip.id);
      seen.add(trip.id);
      const first=trip.isCombination?trip.legs[0]:trip;
      const operator=operatorOf(first),ship=first.ship,startPort=first.startPort;
      const key=[trip.start,operator,ship,harborKey(startPort)].join('|');
      if(!groups.has(key))groups.set(key,{key,date:trip.start,operator,ship,startPort,trips:[]});
      groups.get(key).trips.push(trip);
    }
    return [...groups.values()].map(group=>({...group,planned:group.trips.every(t=>t.isCombination)}))
      .sort((a,b)=>a.date.localeCompare(b.date)||a.ship.localeCompare(b.ship,'de')||a.startPort.localeCompare(b.startPort,'de'));
  }
  function monthCells(year,month,departures){
    const first=new Date(Date.UTC(year,month-1,1)),offset=(first.getUTCDay()+6)%7;
    const days=new Date(Date.UTC(year,month,0)).getUTCDate();
    const byDate=new Map();
    for(const departure of departures){if(!byDate.has(departure.date))byDate.set(departure.date,[]);byDate.get(departure.date).push(departure);}
    return Array.from({length:42},(_,index)=>{
      const day=index-offset+1;if(day<1||day>days)return null;
      const iso=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
      return {day,iso,weekend:index%7>=5,departures:byDate.get(iso)||[]};
    });
  }
  function create(options){
    const {root,year,operatorOf,harborKey,harborLabel,bestOffer,displayPrice,priceNights,money,date,escape,tariffName,openTrip,onMonthChange,onReset}=options;
    let selectedMonth=1,selectedDay='',lastFilter='',lastTrips=[],lastState={},departures=[];
    const monthOf=iso=>Number(iso.slice(5,7));
    function render(trips,state){
      lastTrips=trips;lastState=state;
      departures=buildDepartures(trips,year,{operatorOf,harborKey});
      const filter=JSON.stringify(Object.entries(state).filter(([key])=>!['page','sort','display'].includes(key)));
      if(state.month)selectedMonth=Number(state.month);
      else if(filter!==lastFilter&&!departures.some(d=>monthOf(d.date)===selectedMonth))selectedMonth=departures.length?monthOf(departures[0].date):selectedMonth;
      if(selectedDay&&(monthOf(selectedDay)!==selectedMonth||!departures.some(d=>d.date===selectedDay)))selectedDay='';
      lastFilter=filter;
      const planned=departures.length>0&&departures.every(d=>d.planned),noun=planned?'Kombinationsstarts':'Abfahrtstermine';
      const monthEntries=departures.filter(d=>monthOf(d.date)===selectedMonth);
      const agenda=monthEntries.filter(d=>!selectedDay||d.date===selectedDay);
      const byDay=new Map();for(const item of agenda){if(!byDay.has(item.date))byDay.set(item.date,[]);byDay.get(item.date).push(item);}
      const unit=state.display==='cabin'?'für 2 Erwachsene':state.display==='night'?'pro Person / Bordnacht':'pro Person';
      const cabinLabel=options.cabinLabel(state.cabin);
      function variant(trip){
        const offer=bestOffer(trip,state),price=offer?'ab '+money(displayPrice(offer.price,priceNights(trip),state.display)):'Kein passender Preis';
        return `<li class="calendar-variant"><div><strong>${escape(trip.route)}</strong><span>${date(trip.start)} – ${date(trip.end)} · ${trip.nights} Nächte · Ziel ${escape(harborLabel(trip.endPort))}</span></div><div class="calendar-quote"><strong>${price}</strong><small>${escape(cabinLabel)} · ${unit}${offer?' · '+escape(tariffName(offer.tariff)):''}${offer?.flight?' · inkl. Flug':''}${offer?.calculated?' · Σ Einzelpreise':''}</small><button type="button" data-calendar-trip="${escape(trip.id)}">${trip.isCombination?'Plan & Teilpreise':'Reise & Preise'} →</button></div></li>`;
      }
      function departureCard(item){
        const items=[...item.trips].sort((a,b)=>a.nights-b.nights||a.route.localeCompare(b.route,'de'));
        const variants=items.map(variant).join('');
        return `<article class="calendar-departure ${item.operator==='Mein Schiff'?'mein-schiff':'aida'}"><header><div><strong>${escape(item.ship)}</strong><span>ab ${escape(harborLabel(item.startPort))}${item.planned?' · Kombinationsstart':''}</span></div><span class="calendar-operator">${escape(item.operator)}</span></header>${items.length===1?'<ul>'+variants+'</ul>':`<details class="calendar-variants"><summary>${items.length} Reisevarianten · ${Math.min(...items.map(t=>t.nights))}–${Math.max(...items.map(t=>t.nights))} Nächte</summary><ul>${variants}</ul></details>`}</article>`;
      }
      root.innerHTML=`<div class="calendar-intro"><div><p class="eyebrow">EIN JAHR AUF EINEN BLICK</p><h3 id="calendar-year-title" tabindex="-1">Abfahrtskalender ${year}</h3><p>Schiffsnamen und Starthäfen stehen direkt beim Datum. Ein Klick öffnet die Reise- und Preisdetails.</p></div><label>Monat anzeigen<select id="calendar-month-select">${MONTHS.map((name,i)=>`<option value="${i+1}"${selectedMonth===i+1?' selected':''}>${name} · ${departures.filter(d=>monthOf(d.date)===i+1).length}</option>`).join('')}</select></label></div>
        <div class="calendar-key"><span><i class="calendar-dot aida"></i>AIDA</span><span><i class="calendar-dot mein-schiff"></i>Mein Schiff</span><span>Alle Schiffe und Starthäfen direkt beim Datum</span></div>
        <p class="calendar-explainer">Gleiches Schiff, Startdatum und Starthafen zählen als ein Termin. Reisevarianten bleiben einzeln aufrufbar. ${planned?'Bei Kombinationen ist nur der Start mit dem ersten Schiff markiert; spätere Teilreisen stehen im Plan.':'Gezeigt werden Einschiffungstermine der erfassten Reisen; Abfahrtsuhrzeiten liegen nicht vor.'} Alle aktuellen Filter gelten auch hier.</p>
        <nav class="calendar-month-nav" aria-label="Monat im Jahreskalender auswählen">${MONTHS.map((name,i)=>`<button type="button" data-calendar-month="${i+1}" aria-pressed="${selectedMonth===i+1}" aria-label="${name} anzeigen">${name.slice(0,3)}</button>`).join('')}</nav>
        <div class="calendar-year-grid" aria-label="Zwölf Monate ${year}">${MONTHS.map((name,i)=>{
          const month=i+1,entries=departures.filter(d=>monthOf(d.date)===month),cells=monthCells(year,month,entries);
          return `<section class="calendar-month${selectedMonth===month?' selected':''}" data-calendar-month-section="${month}"><h4 id="calendar-month-title-${month}" tabindex="-1"><button type="button" data-calendar-month="${month}" aria-pressed="${selectedMonth===month}" aria-label="${name} ${year}: ${entries.length} ${noun}. Monat anzeigen"><span>${name}</span><small>${entries.length} Termine</small></button></h4><table class="mini-calendar"><caption class="sr-only">${name} ${year}</caption><thead><tr>${WEEKDAYS.map(day=>`<th scope="col">${day}</th>`).join('')}</tr></thead><tbody>${Array.from({length:6},(_,week)=>'<tr>'+cells.slice(week*7,week*7+7).map(cell=>{
            if(!cell)return '<td class="calendar-padding"></td>';
            const count=cell.departures.length;
            const weekday=new Date(cell.iso+'T12:00:00Z').toLocaleDateString('de-DE',{weekday:'long',timeZone:'UTC'});
            const labels=cell.departures.map(item=>`<li><button type="button" class="calendar-event ${item.operator==='Mein Schiff'?'mein-schiff':'aida'}" data-calendar-event="${escape(item.key)}" aria-label="${escape(item.ship)}, ab ${escape(harborLabel(item.startPort))}, ${date(item.date)}${item.planned?', Kombinationsstart':''}, Reise- und Preisdetails öffnen"><strong>${escape(item.ship)}</strong><span>ab ${escape(harborLabel(item.startPort))}</span>${item.planned?'<small>Kombinationsstart</small>':item.trips.length>1?`<small>${item.trips.length} Reisevarianten</small>`:''}</button></li>`).join('');
            return `<td class="${cell.weekend?'weekend ':''}${count?'has-departure':'calendar-day-empty'}"><div class="calendar-date-line">${count?`<button type="button" class="calendar-date-button" data-calendar-day="${cell.iso}" aria-pressed="${selectedDay===cell.iso}" aria-label="${date(cell.iso)}: ${count} ${noun}. Tagesdetails öffnen"><span>${cell.day}</span><span class="calendar-date-weekday">${weekday}</span><small>${count}</small></button>`:`<span class="calendar-no-departure" title="Keine passenden Termine erfasst">${cell.day}</span>`}</div>${count?`<ul class="calendar-day-departures">${labels}</ul>`:''}</td>`;
          }).join('')+'</tr>').join('')}</tbody></table></section>`;
        }).join('')}</div>
        <section class="calendar-agenda" aria-labelledby="calendar-agenda-title"><div class="calendar-agenda-heading"><div><p class="eyebrow">${selectedDay?'GEWÄHLTER TAG':'GEWÄHLTER MONAT'}</p><h3 id="calendar-agenda-title" tabindex="-1">${selectedDay?date(selectedDay):MONTHS[selectedMonth-1]+' '+year}</h3><p>${agenda.length} ${noun} · ${agenda.reduce((sum,d)=>sum+d.trips.length,0)} Reisevarianten</p></div><div class="calendar-month-actions"><button type="button" data-calendar-step="-1" aria-label="Vorheriger Monat"${selectedMonth===1?' disabled':''}>←</button><button type="button" data-calendar-action="month"${!selectedDay?' hidden':''}>Ganzer Monat</button><button type="button" data-calendar-step="1" aria-label="Nächster Monat"${selectedMonth===12?' disabled':''}>→</button><button type="button" data-calendar-action="year">Jahresübersicht ↑</button></div></div>
        ${agenda.length?[...byDay].map(([iso,items])=>`<section class="calendar-day-group"><h4><time datetime="${iso}">${new Date(iso+'T12:00:00Z').toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long',timeZone:'UTC'})}</time><span>${items.length} ${items.length===1?'Termin':'Termine'}</span></h4><div class="calendar-day-ships">${items.map(departureCard).join('')}</div></section>`).join(''):'<div class="calendar-empty"><h4>Keine passenden Abfahrten in diesem Monat.</h4><p>Wähle einen anderen Monat oder entferne einen Filter. Leere Tage bedeuten: im gefilterten Bestand kein Termin erfasst.</p><button type="button" data-calendar-action="reset">Filter zurücksetzen</button></div>'}</section>`;
      return {count:departures.length,noun,ships:new Set(departures.map(d=>d.ship)).size};
    }
    function focusAgenda(){root.querySelector('#calendar-agenda-title').scrollIntoView({block:'start'});root.querySelector('#calendar-agenda-title').focus({preventScroll:true});}
    function focusMonth(){const heading=root.querySelector('#calendar-month-title-'+selectedMonth);heading.scrollIntoView({block:'start',behavior:'instant'});heading.focus({preventScroll:true});}
    function chooseMonth(month,day=''){
      selectedMonth=Math.max(1,Math.min(12,month));selectedDay=day;
      if(lastState.month&&Number(lastState.month)!==selectedMonth){onMonthChange(String(selectedMonth));selectedDay=day;}
      else render(lastTrips,lastState);
      if(day)focusAgenda();else focusMonth();
    }
    root.addEventListener('change',event=>{if(event.target.id==='calendar-month-select')chooseMonth(Number(event.target.value));});
    root.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.calendarTrip){openTrip(button.dataset.calendarTrip);return;}
      if(button.dataset.calendarEvent){const item=departures.find(d=>d.key===button.dataset.calendarEvent);if(item){if(item.trips.length===1)openTrip(item.trips[0].id);else chooseMonth(monthOf(item.date),item.date);}return;}
      if(button.dataset.calendarMonth){chooseMonth(Number(button.dataset.calendarMonth));return;}
      if(button.dataset.calendarDay){chooseMonth(monthOf(button.dataset.calendarDay),button.dataset.calendarDay);return;}
      if(button.dataset.calendarStep){chooseMonth(selectedMonth+Number(button.dataset.calendarStep));return;}
      if(button.dataset.calendarAction==='month'){chooseMonth(selectedMonth);return;}
      if(button.dataset.calendarAction==='reset'){onReset();return;}
      if(button.dataset.calendarAction==='year'){root.querySelector('#calendar-year-title').scrollIntoView({block:'start'});root.querySelector('#calendar-year-title').focus({preventScroll:true});}
    });
    return {render};
  }
  return {MONTHS,WEEKDAYS,buildDepartures,monthCells,create};
});
