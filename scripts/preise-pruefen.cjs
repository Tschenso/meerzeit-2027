'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const p=require('./preise-aktualisieren.cjs'),core=require('../dashboard.js');
const offer={cabin:'Innenkabine',tariff:'PREMIUM',price:1000,flight:false,soldOut:false,source:0};
const trip={offers:[{...offer}],sources:[{url:'https://example.org/reise',checkedAt:'2026-10-23T12:00:00Z'}]};
p.seed(trip);p.seed(trip);assert.equal(trip.priceHistory[0].points.length,1,'Seeding muss idempotent sein');
p.replaceSource(trip,0,[{...offer,price:900}],'2026-10-24T12:00:00Z');
assert.deepEqual(trip.priceHistory[0].points.map(p=>p[1]),[1000,900]);
p.replaceSource(trip,0,[{...offer,price:900}],'2026-10-24T13:00:00Z');assert.equal(trip.priceHistory[0].points.length,2,'Gleicher Tagespreis wird verdichtet');
p.replaceSource(trip,0,[{...offer,price:950}],'2026-10-24T14:00:00Z');assert.equal(trip.priceHistory[0].points.length,3,'Änderungen am selben Tag bleiben erhalten');
p.replaceSource(trip,0,[{...offer,price:1400,flight:true}],'2026-10-25T12:00:00Z');
assert.equal(trip.priceHistory.length,2,'Flugpakete brauchen eine getrennte Reihe');assert.equal(trip.priceHistory[0].points.at(-1)[1],null,'Entfallene Kategorie ist kein Nullpreis');
assert.equal(core.historyStats(trip.priceHistory[0]).last,null);
const count=trip.priceHistory[1].points.length,checked=trip.sources[0].checkedAt;
p.failSource(trip,0,'HTTP 503','2026-10-26T12:00:00Z');
assert.equal(trip.sources[0].checkedAt,checked,'Ein Fehler darf den bestätigten Abrufzeitpunkt nicht erneuern');
assert.equal(trip.priceHistory[1].points.length,count);assert.ok(trip.offers[0].stale);
assert.equal(core.bestOffer(trip,{...core.defaults,flights:true}),null,'Unbestätigte alte Preise gehören nicht in den aktuellen Vergleich');
p.replaceSource(trip,0,[{...offer,price:1100,flight:true}],'2026-10-27T12:00:00Z');assert.ok(!trip.offers[0].stale);
assert.equal(core.bestOffer(trip,{...core.defaults,flights:true}).price,1100);
assert.equal(core.currentHistoryOffer(trip,trip.priceHistory[1]).price,1100,'Der aktuelle Verlauf muss zum gleichen Kabinenangebot passen');
assert.equal(core.currentHistoryOffer(trip,trip.priceHistory[0]),null,'Historische Kabinen ohne aktuelles Angebot dürfen nicht als bestätigt gelten');
trip.offers[0].stale=true;assert.equal(core.currentHistoryOffer(trip,trip.priceHistory[1]),null,'Ein Abruffehler macht den Preis historisch');delete trip.offers[0].stale;
assert.equal(core.currentHistoryOffer(trip,{...trip.priceHistory[1],sourceUrl:'https://example.org/andere-quelle'}),null,'Die Preisquelle gehört zur Vergleichsidentität');
assert.equal(p.euro('1.234,50 €'),1234.5);assert.equal(p.euro('ab 999 €'),null);
const annual='<article class="card s2-card"><a href="/tui-cruises/test/123" class="s2-imgwrap"></a><span>01.01.2027</span><i data-lucide="ship"></i><span>Mein Schiff 1</span><span>01.01.2027 – 08.01.2027</span><span class="price-value">799 €</span><p class="s2-pricebox__title s2-pricebox__title--flug">Mit Flug</p><ul><li><span>Innen</span><strong>1.599 €</strong></li></ul></article>';
const card=p.parseAnnual(annual)[0];assert.equal(card.offers.length,1);assert.equal(card.offers[0].price,1599);assert.equal(card.offers[0].flight,true,'Headline-Preis darf keine Innenkabine ohne Flug werden');
assert.throws(()=>p.parseAnnual('<html>Wartung</html>'),/Keine Jahreslisten/);
const euresaTrip={code:'TEST',ship:'AIDAnova',start:'2027-01-01',end:'2027-01-08'};
const snapshot=data=>'wire:snapshot="'+JSON.stringify(data).replaceAll('"','&quot;')+'"';
const info={data:{...euresaTrip,cruiseCode:'TEST',shipName:'AIDAnova'}};
const meta={data:{cruiseCode:'TEST',adults:2,children:0,juveniles:0,priceView:'pax',transportationType:1,flightPriceMandatory:true},memo:{name:'website.cruise-search.details-prices'}};
const html=snapshot(info)+snapshot(meta)+'<img alt="Kabinenkategorie Innenkabine"><a href="https://aida.euresa-reisen.de/TEST/IND/1"><span>AIDA PREMIUM</span><span class="text-lg font-bold">1.299 €</span></a>';
assert.equal(p.parseEuresa(html,euresaTrip)[0].flight,true);
assert.throws(()=>p.parseEuresa(html,{...euresaTrip,start:'2027-02-01'}),/Reise oder Belegung/);
assert.throws(()=>p.parseEuresa(html.replace('&quot;adults&quot;:2','&quot;adults&quot;:1'),euresaTrip),/Reise oder Belegung/);
const msTrip={operator:'Mein Schiff',euresaCode:'MS-TEST',ship:'Mein Schiff 1',start:'2027-01-01',end:'2027-01-08',nights:7,startPort:'Kiel',endPort:'Kiel'};
const msInfo={data:{...msTrip,cruiseCode:'MS-TEST',shipName:'Mein Schiff 1',shipXmlId:101,organizerId:2,duration:7,startPortName:'Kiel',endPortName:'Kiel',transportationType:0}};
const msMeta={data:{...meta.data,cruiseCode:'MS-TEST',transportationType:0,flightPriceMandatory:false},memo:meta.memo};
const msHtml=snapshot(msInfo)+snapshot(msMeta)+'<img alt="Kabinenkategorie Junior Suite Balkon"><a href="https://tuic.euresa-reisen.de/de/angebot?cruise_id=101-270101-7&amp;erw=2"><span>Mein Schiff PRO-Tarif</span><span class="text-lg font-bold">2.499 €</span></a>';
const msOffer=p.parseEuresa(msHtml,msTrip)[0];assert.equal(msOffer.cabin,'Junior Suite Balkon');assert.equal(msOffer.tariff,'MEIN SCHIFF PRO');assert.equal(msOffer.flight,false);
assert.equal(core.bestOffer({offers:[msOffer]},core.defaults,'Junior-Suite').price,2499,'Benannte Mein-Schiff-Tarife gehören in den Standardvergleich');
assert.throws(()=>p.parseEuresa(msHtml,{...msTrip,endPort:'Hamburg'}),/Häfen oder Belegung/);
assert.throws(()=>p.parseEuresa(msHtml.replace('101-270101-7','101-270102-7'),msTrip),/Buchungslink/);
assert.throws(()=>p.parseEuresa(msHtml.replace('&quot;adults&quot;:2','&quot;adults&quot;:1'),msTrip),/Häfen oder Belegung/);
const historicMs={offers:[{...msOffer,source:0}],sources:[{url:'https://example.org/alter-anbieter',checkedAt:'2026-10-23T12:00:00Z'},{url:'https://example.org/neuer-anbieter',checkedAt:'2026-10-24T12:00:00Z'}]};
p.seed(historicMs);p.replaceSource(historicMs,1,[msOffer],'2026-10-24T12:00:00Z');assert.equal(historicMs.priceHistory.length,2,'Ein Anbieterwechsel beginnt eine eigene Preisreihe');
let series=0,points=0;
for(const [file,global] of [['data.js','AIDA2027'],['mein-schiff.js','MEINSCHIFF2027']]){
  const d=p.readData(file,global);
  for(const t of [...d.trips,...(d.supportingTrips||[])]){
    const keys=new Set();
    for(const s of t.priceHistory||[]){
      const key=JSON.stringify([s.cabin,s.tariff,s.flight,s.sourceUrl]);assert.ok(!keys.has(key),t.id+': doppelte Reihe');keys.add(key);
      assert.equal(s.people,2);assert.equal(s.currency,'EUR');assert.equal(new URL(s.sourceUrl).protocol,'https:');
      let previous=0;for(const [at,price,status] of s.points){assert.ok(Date.parse(at)>=previous);previous=Date.parse(at);assert.ok(['available','unavailable','request','soldout'].includes(status));assert.ok(price===null||Number.isFinite(price)&&price>0);points++;}series++;
    }
    if(d.lastUpdate)assert.ok((t.priceHistory||[]).length||!t.offers.length,t.id+': Historie fehlt');
  }
}
console.log(JSON.stringify({status:'OK',preisreihen:series,beobachtungen:points,pruefungen:'Parser, Identität, Belegung, Flugtrennung, Fehler, Lücken, Tagesverdichtung, Verlauf'}));
