'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('./dashboard.js');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'data.js'),'utf8'),context);
const fullData = context.window.AIDA2027;
// Bestehende Hamburg-/Transit-Regressionen bleiben gegen ihren ursprünglichen Katalog abgegrenzt.
const data = {...fullData,trips:fullData.trips.filter(t=>t.inventoryTag!=='kiel-2027')};
const trips = data.trips;
assert.equal(data.people,2);
assert.equal(trips.filter(t=>t.scope==='hamburg').length,173,'Die zuvor zusammengestellte Hamburg-Liste muss vollständig bleiben.');
assert.equal(trips.filter(t=>t.scope==='incoming').length,6,'Die sechs recherchierten Auslands-Transitreisen fehlen.');
assert.equal(new Set(trips.map(t=>t.id)).size,trips.length,'Doppelte Reise-IDs.');
for(const t of fullData.trips){
  assert.ok(t.start.startsWith('2027-'));
  assert.equal((Date.parse(t.end)-Date.parse(t.start))/86400000,t.nights,t.id+': Datum und Nächte stimmen nicht überein.');
  assert.ok(t.startPort&&t.endPort&&t.sources.length,t.id+': Häfen oder Quellen fehlen.');
  if(t.scope==='incoming'){assert.ok(['Hamburg','Kiel'].includes(t.endPort));assert.notEqual(t.startPort,'Hamburg');}
  for(const s of t.sources){assert.ok(new URL(s.url).protocol==='https:');assert.ok(Number.isFinite(Date.parse(s.checkedAt)));}
  for(const o of t.offers){assert.ok(Number.isFinite(o.price)&&o.price>0);assert.ok(t.sources[o.source]);assert.equal(typeof o.flight,'boolean');}
}
const base={...core.defaults,scope:'hamburg'};
const byId=id=>trips.find(t=>t.id===id);
assert.equal(core.groupOf('Junior-Suite'),'junior');
assert.equal(core.groupOf('Suite am Bug mit privatem Sonnendeck SD'),'suite');
assert.equal(core.bestOffer(byId('LU07270531'),base),null,'Ausgebuchte Charterpreise dürfen nicht als aktuelle Ab-Preise erscheinen.');
assert.equal(core.bestOffer(byId('LU14270524'),base),null,'Kombinationspreise dürfen nicht aus Einzelpreisen erfunden werden.');
assert.ok(core.eligibleOffers(byId('PR20271105'),base).every(o=>!o.flight),'Flugpakete dürfen nicht in den Standardvergleich rutschen.');
const flightFixture={offers:[{cabin:'Innenkabine',tariff:'PREMIUM',price:1900,flight:true}]};
assert.ok(core.eligibleOffers(flightFixture,{...base,flights:true}).some(o=>o.flight),'Erfasste Flugpakete müssen separat auswählbar sein.');
const juniorFixture={offers:[{cabin:'Junior-Suite',tariff:'PREMIUM',price:1500,flight:false}]};
assert.ok(core.bestOffer(juniorFixture,base,'@junior'));
assert.equal(core.bestOffer(juniorFixture,base,'@suite'),null,'Eine Junior-Suite darf keine volle Suite ersetzen.');
const jan=core.filterTrips(trips,{...base,month:'1'});
assert.ok(jan.length&&jan.every(t=>t.scope==='hamburg'&&t.start.slice(5,7)==='01'));
const incoming=core.filterTrips(trips,{...base,scope:'incoming'});
assert.equal(incoming.length,6);
const budget=core.filterTrips(trips,{...base,budget:'1000'});
assert.ok(budget.every(t=>core.bestOffer(t,base).price<=1000));
const budgetFixture=[799,1400,null].map((price,i)=>({...trips[0],id:'budget-'+i,offers:price===null?[]:[{cabin:'Innenkabine',tariff:'PREMIUM',price,flight:false}]}));
assert.deepEqual(core.filterTrips(budgetFixture,{...base,budget:'1000'}).map(t=>t.id),['budget-0'],'Budgetfilter muss teure und fehlende Preise ausschließen.');
assert.equal(core.displayPrice(799,7,'cabin'),1598);
assert.equal(core.displayPrice(700,7,'night'),100);
assert.equal(core.csvEncode('=1+1'),'"\'=1+1"','CSV-Formelinhalte müssen neutralisiert werden.');
assert.equal(core.csvEncode('A;"B'),'"A;""B"');

const atlantic=core.filterTrips(trips,{...base,scope:'atlantic',flights:true});
assert.equal(atlantic.length,18,'Die 18 klassischen Atlantik-Angebote fehlen.');
assert.equal(new Set(atlantic.map(t=>t.ship)).size,5);
assert.ok(atlantic.every(t=>t.atlantic==='oneway'));
assert.ok(atlantic.some(t=>t.id==='BE29270327'),'Rückreisen nach Kiel müssen auch in der Atlantikansicht erscheinen.');
assert.ok(!atlantic.some(t=>t.id==='PR12270118'),'Eine Küstenreise ab Gran Canaria ist keine Atlantiküberquerung.');
assert.equal(core.filterTrips(trips,{...base,scope:'atlantic',atlanticType:'roundtrip'}).length,2);
assert.equal(core.filterTrips(trips,{...base,scope:'atlantic',atlanticType:'world'}).length,1);
assert.equal(core.filterTrips(trips,{...base,scope:'atlantic',atlanticType:'all'}).length,21);
assert.equal(core.filterTrips(trips,{...base,scope:'atlantic',ship:'AIDAprima'}).length,5);
assert.equal(core.filterTrips(trips,{...base,scope:'atlantic',month:'11'}).length,8);
assert.equal(byId('BE34271101').startPort,'Kiel','Der tatsächliche Starthafen ist Kiel, trotz abweichendem Anbietertitel.');
assert.equal(byId('PE37270225').end,'2027-04-03');
assert.ok(core.bestOffer(flightFixture,{...base,flights:true}));
assert.equal(core.bestOffer(flightFixture,base),null,'Erzwungene Flugpakete dürfen nicht als Kreuzfahrt ohne Flug erscheinen.');


const combos=core.buildCombinations(data),combinedTrips=[...trips,...combos];
const comboById=id=>combos.find(t=>t.id===id);
assert.equal(combos.length,5);
assert.equal(core.filterTrips(combinedTrips,{...base,scope:'roundtrip',roundtripType:'featured'}).length,5);
assert.equal(core.filterTrips(combinedTrips,{...base,scope:'roundtrip',roundtripType:'all'}).length,160);
assert.equal(core.filterTrips(combinedTrips,{...base,scope:'roundtrip',roundtripType:'combined'}).length,5);
assert.ok(core.filterTrips(combinedTrips,{...base,scope:'roundtrip',roundtripType:'all'}).every(t=>t.startPort==='Hamburg'&&t.endPort==='Hamburg'));
assert.ok(!core.filterTrips(combinedTrips,{...base,scope:'hamburg'}).some(t=>t.isCombination),'Berechnete Pläne dürfen die ursprüngliche Hamburg-Liste nicht verändern.');
assert.equal(data.supportingTrips.length,2);
assert.ok(data.supportingTrips.every(t=>t.start.startsWith('2028-')));
const luna64=comboById('COMBO-LU-64'),mar65=comboById('COMBO-MA-65'),winter=comboById('COMBO-PR20-BE28');
assert.deepEqual([luna64.nights,luna64.cruiseNights,luna64.stayNights],[64,64,0]);
assert.deepEqual([mar65.start,mar65.end,mar65.nights],['2027-11-05','2028-01-09',65]);
assert.deepEqual([winter.nights,winter.cruiseNights,winter.stayNights],[148,48,100]);
assert.deepEqual([comboById('COMBO-PR27-BE20').cruiseNights,comboById('COMBO-PR27-BE20').stayNights],[47,101]);
assert.equal(comboById('COMBO-PR34-BE28').stayNights,86);
// Preisregressionen verwenden feste Angebote; Live-Preise dürfen sich ändern.
const fixtureLeg=(id,start,end,startPort,endPort,offers)=>({id,ship:'Testschiff',start,end,startPort,endPort,nights:(Date.parse(end)-Date.parse(start))/86400000,offers,sources:[{url:'https://example.org/'+id,checkedAt:'2026-10-23T12:00:00Z'}]});
const fixtureOffer=(cabin,price,extra={})=>({cabin,price,tariff:'ANGEBOT',flight:false,source:0,...extra});
const fixtureData={trips:[fixtureLeg('a','2027-11-05','2027-11-25','Hamburg','La Romana',[fixtureOffer('Innenkabine',1620),fixtureOffer('Balkonkabine',2460),fixtureOffer('Meerblickkabine',2060),fixtureOffer('Innenkabine',100,{flight:true})]),fixtureLeg('b','2028-03-04','2028-04-01','La Romana','Hamburg',[fixtureOffer('Innenkabine',2380),fixtureOffer('Balkonkabine',4105),fixtureOffer('Meerblickkabine',3230),fixtureOffer('Suite',5000)])],combinations:[{id:'fixture',route:'Test',legIds:['a','b']}]};
const fixtureCombo=core.buildCombinations(fixtureData)[0];
assert.equal(core.bestOffer(fixtureCombo,{...base,flights:true}).price,4000,'Eine Rundreisensumme muss Flugpakete ausschließen.');
assert.equal(core.bestOffer(fixtureCombo,base,'@balcony').price,6565);
assert.equal(core.bestOffer(fixtureCombo,base,'@suite'),null,'Ein fehlender Suite-Teilpreis muss die Summe offen lassen.');
assert.equal(core.bestOffer(fixtureCombo,{...base,tariff:'PREMIUM'}),null);
assert.ok(core.bestOffer(fixtureCombo,base).components.every(o=>!o.flight));
const missingFixture=structuredClone(fixtureCombo);missingFixture.legs[1].offers=missingFixture.legs[1].offers.filter(o=>o.cabin!=='Innenkabine');
assert.equal(core.bestOffer(missingFixture,base),null,'Fehlende Innenkabine darf nicht durch Meerblick ersetzt werden.');
assert.equal(core.displayPrice(4000,core.priceNights(winter),'night'),4000/48,'Der Bordnachtpreis darf nicht durch die unbezahlten Hotelnächte verbilligt werden.');
const comboCsv=core.csvRowsForTrip(missingFixture,base);
assert.equal(comboCsv.length,5);
assert.ok(comboCsv.every(row=>row.length===23));
const missingInside=comboCsv.find(row=>row[7]==='Innenkabine');
assert.equal(missingInside[9],'');
assert.equal(missingInside[18],'1620,00');
assert.equal(missingInside[19],'');
const winterCsv=core.csvRowsForTrip(fixtureCombo,base).find(row=>row[7]==='Innenkabine');
assert.equal(winterCsv[9],'4000,00');assert.equal(winterCsv[10],'8000,00');assert.equal(winterCsv[15],48);assert.equal(winterCsv[16],100);
assert.ok(winterCsv[20].includes('Unterkunft'));
assert.ok(winterCsv[12].includes('example.org/a')&&winterCsv[12].includes('example.org/b'),'Beide Quellen müssen exportiert werden.');
assert.equal(core.filterTrips(combinedTrips,{...base,scope:'roundtrip',roundtripType:'combined',ship:'AIDAbella'}).length,3);
assert.throws(()=>core.buildCombinations({...data,combinations:[{id:'bad-port',route:'Test',legIds:['PR09271105','MA21271219']}]}),/Anschlusshäfen/);
for(const combo of combos){assert.equal(combo.nights,combo.cruiseNights+combo.stayNights);assert.ok(combo.legs.every(leg=>leg.sources.length));}

vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mein-schiff.js'),'utf8'),context);
const mein=context.window.MEINSCHIFF2027,all=[...trips,...mein.trips,...combos];
assert.equal(mein.trips.length,499);
assert.equal(new Set(mein.trips.map(t=>t.ship)).size,9);
assert.equal(new Set(all.map(t=>t.id)).size,all.length);
assert.equal(core.filterTrips(all,{...core.defaults}).length,690);
assert.equal(core.filterTrips(all,{...core.defaults,operator:'Mein Schiff'}).length,499);
assert.equal(core.filterTrips(all,{...core.defaults,operator:'AIDA'}).length,191);
assert.equal(core.filterTrips(all,{...base,operator:'Mein Schiff'}).length,31);
assert.equal(core.filterTrips(all,{...base,operator:'Mein Schiff',scope:'roundtrip',roundtripType:'all'}).length,21);
assert.equal(core.filterTrips(all,{...base,scope:'incoming',operator:'Mein Schiff'}).length,6);
assert.equal(core.filterTrips(all,{...base,scope:'atlantic',operator:'Mein Schiff'}).length,11);
assert.equal(core.filterTrips(all,{...base,scope:'atlantic',atlanticType:'roundtrip',operator:'Mein Schiff'}).length,2);
assert.equal(core.filterTrips(all,{...base,scope:'roundtrip',roundtripType:'combined',operator:'Mein Schiff'}).length,0);
for(const t of mein.trips){
  assert.equal(t.operator,'Mein Schiff');
  assert.ok(t.start.startsWith('2027-'));
  assert.equal((Date.parse(t.end)-Date.parse(t.start))/86400000,t.nights,t.id);
  assert.ok(t.startPort&&t.endPort&&t.bookingUrl.startsWith('https://www.mykreuzfahrt.de/'));
  for(const o of t.offers){assert.ok(o.price>0&&Number.isFinite(o.price));assert.ok(t.sources[o.source]);assert.equal(o.tariff,'ANGEBOT');assert.equal(typeof o.flight,'boolean');assert.notEqual(o.cabin,'Suite');assert.notEqual(o.cabin,'Junior-Suite');}
  for(const s of t.sources){assert.ok(s.url.startsWith('https://'));assert.ok(Number.isFinite(Date.parse(s.checkedAt)));}
}
const flow=mein.trips.find(t=>t.id==='MS-2050406');
assert.equal(core.bestOffer(flow,core.defaults,'Suite'),null);
assert.equal(core.bestOffer(flow,core.defaults,'Junior-Suite'),null);
assert.equal(core.groupOf('Suitenkategorie (Anbietergruppe)'),'suitegroup');
const suiteGroupFixture={...flow,offers:[{cabin:'Suitenkategorie (Anbietergruppe)',tariff:'ANGEBOT',price:3000,flight:false}]};
assert.ok(core.bestOffer(suiteGroupFixture,core.defaults,'@suitegroup'));
assert.ok(core.bestOffer(suiteGroupFixture,core.defaults,'@suites'));
assert.equal(core.bestOffer(flow,{...core.defaults,tariff:'PREMIUM'}),null);
const relaxed=mein.trips.find(t=>t.id==='MS-2012349');
const query=core.filterTrips(all,{...core.defaults,search:'Mein Schiff Norwegen Juli'});
assert.ok(query.length&&query.every(t=>core.operatorOf(t)==='Mein Schiff'&&t.start.slice(5,7)==='07'&&/Norwegen/i.test(t.route)));
const reversed=core.filterTrips(all,{...core.defaults,search:'JULI norwegen schiff mein'});
assert.deepEqual(query.map(t=>t.id),reversed.map(t=>t.id));
const dated=core.filterTrips(all,{...core.defaults,operator:'Mein Schiff',startPort:'Hamburg',endPort:'Hamburg',dateFrom:'2027-07-01',dateTo:'2027-07-31'});
assert.ok(dated.length&&dated.every(t=>t.startPort==='Hamburg'&&t.endPort==='Hamburg'&&t.start>='2027-07-01'&&t.start<='2027-07-31'));
assert.equal(core.filterTrips(all,{...core.defaults,dateFrom:'2027-08-01',dateTo:'2027-07-01'}).length,0);
assert.ok(core.portMatches('Hamburg / Deutschland','hamburg'));
assert.ok(!core.portMatches('Kiel','Hamburg'));
assert.ok(core.portMatches('Palma de Mallorca / Spanien','Palma'));
assert.ok(core.portMatches('Las Palmas / Gran Canaria','Gran Canaria'));
assert.ok(core.portMatches('Santa Cruz de Tenerife','Santa Cruz'));
assert.ok(!core.portMatches('Cape Liberty','New York City'),'Verschiedene Einschiffungshäfen im Großraum New York bleiben getrennt.');
const namedShip=core.filterTrips(all,{...core.defaults,search:'Mein Schiff 1'});
assert.equal(namedShip.length,44);assert.ok(namedShip.every(t=>t.ship==='Mein Schiff 1'));
assert.equal(core.filterTrips(all,{...core.defaults,search:'MeinSchiff 1'}).length,44);
const msCsv=core.csvRowsForTrip(flow,core.defaults);assert.ok(msCsv.every(row=>row.length===23&&row[22]==='Mein Schiff'));
assert.ok(core.filterTrips(all,{...core.defaults,operator:'Mein Schiff',budget:'1200',cabin:'@balcony',pricedOnly:true}).every(t=>core.bestOffer(t,{...core.defaults,cabin:'@balcony'}).price<=1200));

const calendar=require('./kalender.js');
const calendarHelpers={operatorOf:core.operatorOf,harborKey:core.harborKey};
const allCatalog=[...fullData.trips,...mein.trips],kielTrips=core.filterTrips(allCatalog,{...core.defaults,scope:'kiel'});
assert.equal(fullData.trips.length,320);
assert.equal(allCatalog.length,819);
assert.equal(kielTrips.length,168);
assert.equal(new Set(allCatalog.map(t=>t.id)).size,allCatalog.length,'Kiel-Ergänzungen dürfen keine Reisen doppelt erfassen.');
assert.equal(core.filterTrips(kielTrips,{...core.defaults,scope:'kiel',operator:'AIDA'}).length,132);
assert.equal(core.filterTrips(kielTrips,{...core.defaults,scope:'kiel',operator:'Mein Schiff'}).length,36);
assert.ok(kielTrips.every(t=>core.portMatches(t.startPort,'Kiel')));
assert.equal(fullData.kielInventory.sourceCount,132);
assert.equal(fullData.kielInventory.tripIds.length,132,'Alle Kiel-Reisevarianten der geprüften Quelle müssen zugeordnet sein.');
assert.ok(fullData.kielInventory.tripIds.every(id=>kielTrips.some(t=>t.id===id)));
const fullDepartures=calendar.buildDepartures(allCatalog,2027,calendarHelpers),kielDepartures=calendar.buildDepartures(kielTrips,2027,calendarHelpers);
assert.equal(fullDepartures.length,608);
assert.equal(kielDepartures.length,110);
assert.ok(kielDepartures.every(d=>core.portMatches(d.startPort,'Kiel')));
assert.equal(kielTrips.filter(t=>core.portMatches(t.endPort,'Kiel')).length,153);
const addedKiel=fullData.trips.filter(t=>t.inventoryTag==='kiel-2027');
assert.equal(addedKiel.length,129);
assert.ok(addedKiel.every(t=>t.code===t.id&&t.sources[0].url.includes('euresa-reisen.de')&&t.priceHistory.length));
const departureTrips=[...trips,...mein.trips],departures=calendar.buildDepartures(departureTrips,2027,calendarHelpers);
assert.equal(departures.length,531,'Reisevarianten dürfen keine mehrfachen Abfahrtstermine erzeugen.');
assert.equal(departures.reduce((sum,d)=>sum+d.trips.length,0),690);
assert.equal(new Set(departures.map(d=>d.ship)).size,17);
assert.equal(calendar.buildDepartures([...departureTrips,...departureTrips],2027,calendarHelpers).length,531);
assert.equal(calendar.buildDepartures(data.supportingTrips,2027,calendarHelpers).length,0,'Abfahrten 2028 gehören nicht in den Kalender 2027.');
const novaJan2=departures.find(d=>d.ship==='AIDAnova'&&d.date==='2027-01-02');
assert.ok(novaJan2&&novaJan2.trips.length===2);assert.equal(novaJan2.startPort,'Hamburg');
const januaryCells=calendar.monthCells(2027,1,departures),februaryCells=calendar.monthCells(2027,2,departures);
assert.equal(januaryCells.length,42);assert.equal(januaryCells.findIndex(Boolean),4,'Der 1. Januar 2027 ist ein Freitag.');
assert.equal(januaryCells.filter(Boolean).length,31);assert.equal(februaryCells.findIndex(Boolean),0);assert.equal(februaryCells.filter(Boolean).length,28);
assert.equal(calendar.monthCells(2028,2,[]).filter(Boolean).length,29);
const yearDays=Array.from({length:12},(_,i)=>calendar.monthCells(2027,i+1,departures)).flat().filter(Boolean);
assert.equal(yearDays.length,365);assert.equal(new Set(yearDays.map(d=>d.iso)).size,365);
assert.equal(yearDays.reduce((sum,d)=>sum+d.departures.length,0),531);
assert.ok(januaryCells.find(d=>d?.iso==='2027-01-02').weekend);
const comboStarts=calendar.buildDepartures(combos,2027,calendarHelpers);
assert.equal(comboStarts.length,3);assert.ok(comboStarts.every(d=>d.planned));
assert.ok(comboStarts.some(d=>d.ship==='AIDAprima'&&d.trips.length===3));
assert.ok(!comboStarts.some(d=>d.ship==='AIDAbella'),'Ein späterer Schiffwechsel ist keine gleichzeitige Abfahrt.');
const aliasOne={...novaJan2.trips[0],id:'calendar-alias-1',startPort:'Palma'};
const aliasTwo={...novaJan2.trips[0],id:'calendar-alias-2',startPort:'Palma de Mallorca / Spanien'};
assert.equal(calendar.buildDepartures([aliasOne,aliasTwo],2027,calendarHelpers).length,1);
assert.throws(()=>calendar.buildDepartures([{...aliasOne,start:'2027-02-30'}],2027,calendarHelpers),/Kalenderdatum/);


const renderRoot={innerHTML:'',addEventListener(){}};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const calendarUI=calendar.create({root:renderRoot,year:2027,...calendarHelpers,harborLabel:label=>label,bestOffer:core.bestOffer,displayPrice:core.displayPrice,priceNights:core.priceNights,money:value=>String(value)+' EUR',date:value=>value,escape:escapeHtml,tariffName:value=>value,cabinLabel:value=>value,openTrip(){},onMonthChange(){},onReset(){}});
calendarUI.render(departureTrips,core.defaults);
assert.equal((renderRoot.innerHTML.match(/class="calendar-event /g)||[]).length,531,'Alle Abfahrtstermine müssen direkt beschriftet sein.');
assert.ok(renderRoot.innerHTML.includes('<strong>AIDAnova</strong><span>ab Hamburg</span>'));
assert.ok(renderRoot.innerHTML.includes('<strong>Mein Schiff Relax</strong><span>ab Santa Cruz</span>'));
calendarUI.render(allCatalog,core.defaults);
assert.equal((renderRoot.innerHTML.match(/class="calendar-event /g)||[]).length,608);
assert.equal((renderRoot.innerHTML.match(/class="calendar-month-card/g)||[]).length,12,'Die Monatsübersicht muss alle zwölf Monate enthalten.');
const monthCounts=[...renderRoot.innerHTML.matchAll(/class="month-card-count"><strong>(\d+)<\/strong>/g)].map(m=>Number(m[1]));
assert.equal(monthCounts.reduce((sum,n)=>sum+n,0),608,'Monatskarten zählen Abfahrtstermine statt Reisevarianten.');
calendarUI.render(kielTrips,{...core.defaults,scope:'kiel'});
assert.equal((renderRoot.innerHTML.match(/class="calendar-event /g)||[]).length,110);
assert.ok(renderRoot.innerHTML.includes('<strong>AIDAnova</strong><span>ab Kiel</span>'));
assert.ok(renderRoot.innerHTML.includes('<strong>Mein Schiff 1</strong><span>ab Kiel</span>'));
const tuiHamburg=core.filterTrips(departureTrips,{...core.defaults,operator:'Mein Schiff',startPort:'Hamburg',endPort:'Hamburg'});
calendarUI.render(tuiHamburg,{...core.defaults,operator:'Mein Schiff',startPort:'Hamburg',endPort:'Hamburg'});
assert.equal((renderRoot.innerHTML.match(/class="calendar-event /g)||[]).length,21);
assert.ok(!/class="calendar-event aida"/.test(renderRoot.innerHTML));
const serverCore=require('./server.cjs');
assert.ok(serverCore.privateHost('192.168.50.10'));assert.ok(!serverCore.privateHost('0.0.0.0'));assert.ok(!serverCore.privateHost('203.0.113.10'));
assert.ok(serverCore.sameSubnet('192.168.50.20','192.168.50.10',24));assert.ok(!serverCore.sameSubnet('192.168.51.20','192.168.50.10',24));
async function checkLocalServer(){
  const server=serverCore.createDashboardServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    const page=await fetch(origin+'/');assert.equal(page.status,200);assert.ok((await page.text()).includes('kalender.js'));
    const health=await fetch(origin+'/healthz');assert.equal((await health.json()).app,'meerzeit-2027');
    const script=await fetch(origin+'/kalender.js');assert.equal(script.status,200);assert.ok(script.headers.get('content-type').includes('javascript'));
    for(const name of ['README.md','server.cjs','Start-WLAN.ps1','WLAN-Freigabe.ps1','rueckfall-vor-jahreskalender/data.js','%2e%2e/README.md'])assert.equal((await fetch(origin+'/'+name)).status,404,name+' darf nicht über das WLAN freigegeben sein.');
    const post=await fetch(origin+'/healthz',{method:'POST'});assert.equal(post.status,405);
    const head=await fetch(origin+'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  }finally{await new Promise(resolve=>server.close(resolve));}
}

const missing=fullData.trips.filter(t=>!t.offers.some(o=>!o.soldOut&&!o.onRequest));
checkLocalServer().then(()=>{console.log(JSON.stringify({status:'OK',reisenGesamt:allCatalog.length,aida:fullData.trips.length,meinSchiff:mein.trips.length,abfahrtstermine:fullDepartures.length,kielReisen:kielTrips.length,kielAbfahrten:kielDepartures.length,meinSchiffSchiffe:9,rundreisenHamburg:181,kombinationen:combos.length,teilreisen2028:data.supportingTrips.length,preisbelege:allCatalog.reduce((n,t)=>n+t.offers.length,0)+data.supportingTrips.reduce((n,t)=>n+t.offers.length,0),ohneAktuellenAidaPreis:missing.map(t=>t.id)},null,2));}).catch(error=>{console.error(error);process.exitCode=1;});
