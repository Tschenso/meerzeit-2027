#!/usr/bin/env node
'use strict';
// Öffentliche Preisangaben; keine Anmeldung, Buchung oder Browser-Sitzung.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const ANNUAL='https://www.mykreuzfahrt.de/tui-cruises/mein-schiff-2027/';
const text=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&(#x[\da-f]+|#\d+|quot|amp|nbsp|ndash|middot|apos|#039);/gi,(_,e)=>({quot:'"',amp:'&',nbsp:' ',ndash:'–',middot:'·',apos:"'"}[e]||(e.startsWith('#x')?String.fromCodePoint(parseInt(e.slice(2),16)):String.fromCodePoint(+e.slice(1))))).replace(/\s+/g,' ').trim();
const euro=s=>{const t=text(s);return /^\d[\d. ]*(?:,\d{2})?\s*€$/.test(t)?Number(t.replace(/[. €]/g,'').replace(',','.')):null;};
function readData(file,global){const c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(ROOT,file),'utf8'),c,{timeout:3000});return JSON.parse(JSON.stringify(c.window[global]));}
const sourceKey=url=>url.includes('mykreuzfahrt.de/landingpage.php')||url===ANNUAL?ANNUAL:url;
const status=o=>o.soldOut?'soldout':o.onRequest?'request':'available';
function observe(trip,offer,url,at,price=offer.price,state=status(offer)){
  if(!Number.isFinite(Date.parse(at)))throw Error('Ungültiger Beobachtungszeitpunkt');
  const key=sourceKey(url);trip.priceHistory||=[];
  let series=trip.priceHistory.find(s=>s.cabin===offer.cabin&&s.tariff===offer.tariff&&s.flight===!!offer.flight&&s.sourceUrl===key);
  if(!series){series={cabin:offer.cabin,tariff:offer.tariff,flight:!!offer.flight,sourceUrl:key,people:2,currency:'EUR',points:[]};trip.priceHistory.push(series);}
  const point=[at,price,state],last=series.points.at(-1);
  if(last&&Date.parse(at)<Date.parse(last[0]))return;
  if(last&&last[0]===at&&last[1]===price&&last[2]===state)return;
  // Gleicher Tagespreis wird verdichtet, echte Änderungen am selben Tag bleiben erhalten.
  if(last&&last[0].slice(0,10)===at.slice(0,10)&&last[1]===price&&last[2]===state)series.points[series.points.length-1]=point;
  else series.points.push(point);
}
function seed(trip){for(const o of trip.offers)observe(trip,o,trip.sources[o.source].url,trip.sources[o.source].checkedAt);}
function replaceSource(trip,index,offers,at){
  const source=trip.sources[index],old=trip.offers.filter(o=>o.source===index);
  const keys=new Set(offers.map(o=>JSON.stringify([o.cabin,o.tariff,!!o.flight])));
  for(const o of old)if(!keys.has(JSON.stringify([o.cabin,o.tariff,!!o.flight])))observe(trip,o,source.url,at,null,'unavailable');
  trip.offers=trip.offers.filter(o=>o.source!==index).concat(offers.map(o=>({...o,source:index})));
  source.checkedAt=at;source.updateStatus='ok';delete source.updateError;
  for(const o of offers)observe(trip,o,source.url,at);
}
function failSource(trip,index,message,at,state='error'){
  const source=trip.sources[index];source.updateStatus=state;source.updateError=message;source.attemptedAt=at;
  for(const o of trip.offers.filter(o=>o.source===index))o.stale=true;
  // Fehler erzeugen weder neue Preisbeobachtungen noch einen Preis von 0 €.
}
function parseEuresa(html,trip){
  if(trip.operator==='Mein Schiff')return parseMeinSchiffEuresa(html,trip);
  const snapshots=[...html.matchAll(/wire:snapshot="([^"]+)"/g)].map(m=>JSON.parse(text(m[1])));
  const info=snapshots.find(s=>s.data?.cruiseCode===trip.code&&s.data?.shipName)?.data;
  const data=snapshots.find(s=>s.memo?.name==='website.cruise-search.details-prices')?.data;
  if(!info||!data||info.start!==trip.start||info.end!==trip.end||info.shipName!==trip.ship||data.cruiseCode!==trip.code||data.adults!==2||data.children!==0||data.juveniles!==0||data.priceView!=='pax')throw Error('Reise oder Belegung nicht eindeutig bestätigt');
  if(![0,1].includes(data.transportationType))throw Error('Unbekannte Transportart');
  if(data.flightPriceMandatory&&data.transportationType!==1)throw Error('Flugpflicht und Preisart widersprechen sich');
  const categories=[...html.matchAll(/alt="Kabinenkategorie ([^"]+)"/g)];
  if(!categories.length)throw Error('Keine Kabinenpreistabelle erkannt');
  const offers=[];
  for(let i=0;i<categories.length;i++){
    const cabin=text(categories[i][1]),block=html.slice(categories[i].index,categories[i+1]?.index||html.length);
    for(const a of block.matchAll(/<a\b[^>]*href="https:\/\/aida\.euresa-reisen\.de\/([^"/]+)\/[^" ]+"[^>]*>([\s\S]*?)<\/a>/g)){
      if(a[1]!==trip.code)continue;
      const tariff=text(a[2]).match(/\bAIDA (COMFORT ALL IN|PREMIUM ALL IN|CLASSIC ALL IN|PREMIUM|CLASSIC|LIGHT|PAUSCHAL)\b/)?.[1];
      const priceMatch=a[2].match(/<span[^>]*class="[^"]*text-lg font-bold[^"]*"[^>]*>([\d.,\s]+€)<\/span>/);
      if(!tariff||!priceMatch)continue;
      const price=euro(priceMatch[1]);if(!(price>0))throw Error('Ungültiger Kategoriepreis');
      offers.push({cabin,tariff,price,flight:data.transportationType===1,soldOut:false});
    }
  }
  if(!offers.length)throw Error('Keine eindeutigen Kategoriepreise erkannt');
  if(new Set(offers.map(o=>[o.cabin,o.tariff,o.flight].join('|'))).size!==offers.length)throw Error('Mehrdeutige Kategoriepreise');
  return offers;
}
function parseMeinSchiffEuresa(html,trip){
  const snapshots=[...html.matchAll(/wire:snapshot="([^"]+)"/g)].map(m=>JSON.parse(text(m[1])));
  const info=snapshots.find(s=>s.data?.cruiseCode===trip.euresaCode&&s.data?.shipName)?.data;
  const data=snapshots.find(s=>s.memo?.name==='website.cruise-search.details-prices')?.data;
  const {harborKey}=require('../dashboard.js');
  if(!trip.euresaCode||!info||!data||info.start!==trip.start||info.end!==trip.end||info.shipName!==trip.ship||info.duration!==trip.nights||String(info.organizerId)!=='2'||data.cruiseCode!==trip.euresaCode||data.adults!==2||data.children!==0||data.juveniles!==0||data.priceView!=='pax'||harborKey(info.startPortName)!==harborKey(trip.startPort)||harborKey(info.endPortName)!==harborKey(trip.endPort))throw Error('Mein-Schiff-Reise, Häfen oder Belegung nicht eindeutig bestätigt');
  if(![0,1].includes(data.transportationType)||info.transportationType!==data.transportationType||data.flightPriceMandatory&&data.transportationType!==1)throw Error('Mein-Schiff-Fluggrundlage nicht eindeutig');
  const expected=[info.shipXmlId,trip.start.slice(2).replaceAll('-',''),trip.nights].join('-');
  const categories=[...html.matchAll(/alt="Kabinenkategorie ([^"]+)"/g)],offers=[];
  for(let i=0;i<categories.length;i++){
    const cabin=text(categories[i][1]),block=html.slice(categories[i].index,categories[i+1]?.index||html.length);
    for(const a of block.matchAll(/<a\b[^>]*href="(https:\/\/tuic\.euresa-reisen\.de\/de\/angebot\?[^" ]+)"[^>]*>([\s\S]*?)<\/a>/g)){
      const url=new URL(text(a[1]));if(url.searchParams.get('cruise_id')!==expected||url.searchParams.get('erw')!=='2')throw Error('Mein-Schiff-Buchungslink passt nicht zur Reise');
      const tariff=text(a[2]).match(/Mein Schiff (PRO|PLUS|PUR)-Tarif/)?.[1];
      const value=a[2].match(/<span[^>]*class="[^"]*text-lg font-bold[^"]*"[^>]*>([\d.,\s]+€)<\/span>/)?.[1];
      if(!tariff||!value)continue;
      const price=euro(value);if(!(price>0))throw Error('Ungültiger Mein-Schiff-Kategoriepreis');
      offers.push({cabin,tariff:'MEIN SCHIFF '+tariff,price,flight:data.transportationType===1,soldOut:false});
    }
  }
  if(!offers.length)throw Error('Keine eindeutigen Mein-Schiff-Kategoriepreise erkannt');
  if(new Set(offers.map(o=>[o.cabin,o.tariff,o.flight].join('|'))).size!==offers.length)throw Error('Mehrdeutige Mein-Schiff-Kategoriepreise');
  return offers;
}
const CABINS={Innen:'Innenkabine','Außen':'Meerblickkabine',Balkon:'Balkonkabine',Suite:'Suitenkategorie (Anbietergruppe)'};
function parseAnnual(html){
  const cards=[...html.matchAll(/<article class="card s2-card">([\s\S]*?)<\/article>/g)];
  if(!cards.length)throw Error('Keine Jahreslisten-Karten erkannt');
  return cards.map(([,card])=>{
    const id=card.match(/class="s2-imgwrap"/)&&card.match(/href="[^"#]+\/(\d+)"/)?.[1];
    const ship=text(card.match(/data-lucide="ship"[^>]*><\/i>\s*<span>([^<]+)<\/span>/)?.[1]);
    const dates=[...card.matchAll(/\b(\d{2})\.(\d{2})\.(202[78])\b/g)].map(m=>`${m[3]}-${m[2]}-${m[1]}`);
    if(!id||!ship||dates.length<3)throw Error('Ungültige Reiseidentität in Jahresliste');
    const offers=[];
    for(const [,classes,body] of card.matchAll(/<p class="s2-pricebox__title([^"]*)">[\s\S]*?<\/p>\s*<ul[^>]*>([\s\S]*?)<\/ul>/g)){
      for(const [,label,value] of body.matchAll(/<li><span>([^<]+)<\/span><strong>([^<]+)<\/strong><\/li>/g)){
        const cabin=CABINS[text(label)],price=euro(value);if(!cabin||!(price>0))throw Error('Unbekannte Kabine oder Preis in Jahresliste');
        offers.push({cabin,tariff:'ANGEBOT',price,flight:classes.includes('flug'),soldOut:false});
      }
    }
    if(!offers.length)throw Error('Kategoriepreistabelle fehlt: '+id);
    return {id,ship,start:dates[1],end:dates[2],offers};
  });
}
function parseMykDetail(html,trip){
  const date=trip.start.split('-').reverse().join('.');
  const title=text(html.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
  if(!title.includes(trip.ship)||!title.includes(date)||!title.includes(trip.nights+' Nächte'))throw Error('Detailseite passt nicht zur Reise');
  const names={innen:'Innenkabine',aussen:'Meerblickkabine',balkon:trip.offers.find(o=>/Veranda/.test(o.cabin))?.cabin||'Balkonkabine',suite:'Suitenkategorie (Anbietergruppe)'};
  const offers=[];
  for(const [tag,key] of [...html.matchAll(/<button\b[^>]*data-cabin-class="([^"]+)"[^>]*>/g)].map(m=>[m[0],m[1]])){
    if(!names[key])throw Error('Unbekannte Kabinenklasse');
    for(const [attribute,flight] of [['co',false],['wf',true]]){
      const value=tag.match(new RegExp('data-price-'+attribute+'="([^"]*)"'))?.[1],price=euro(value);
      if(price>0)offers.push({cabin:names[key],tariff:'ANGEBOT',price,flight,soldOut:false});
    }
  }
  if(!offers.length)throw Error('Keine eindeutigen Kabinenpreise auf Detailseite');return offers;
}
async function get(url){
  const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'Meerzeit2027/1.0 (public cruise price comparison)','Accept-Language':'de-DE'}});
  if(!r.ok)throw Error('HTTP '+r.status);return {html:await r.text(),more:r.headers.get('x-has-more')};
}
async function main(args=process.argv.slice(2)){
  if(args.includes('--help')){console.log('node scripts/preise-aktualisieren.cjs [--dry-run] [--source=euresa] [--operator=aida|mein-schiff] [--limit=N]\nOhne Optionen: alle vorhandenen Reisen aktualisieren. Kein Zeitplan.');return;}
  if(args.some(a=>!/^--(?:dry-run|source=euresa|operator=(?:aida|mein-schiff)|limit=[1-9]\d*)$/.test(a)))throw Error('Unbekannte Option; --help zeigt die Verwendung.');
  const euresaOnly=args.includes('--source=euresa');
  const dry=args.includes('--dry-run'),operator=args.find(a=>a.startsWith('--operator='))?.split('=')[1],limit=+(args.find(a=>a.startsWith('--limit='))?.split('=')[1]||Infinity);
  const datasets=[['data.js','AIDA2027',readData('data.js','AIDA2027'),'aida'],['mein-schiff.js','MEINSCHIFF2027',readData('mein-schiff.js','MEINSCHIFF2027'),'mein-schiff']];
  for(const [,global,data,op] of datasets){
    if(operator&&operator!==op)continue;
    if(data.people!==2||data.currency!=='EUR')throw Error('Nicht unterstützte Belegung oder Währung: '+op);
    const all=[...data.trips,...(data.supportingTrips||[])];all.forEach(seed);
    const at=new Date().toISOString(),report={attemptedAt:at,ok:0,errors:0,manual:0,skipped:0};let count=0;
    let annual=new Map(),annualError=null;
    if(op==='mein-schiff'&&!euresaOnly&&all.some(t=>t.sources.some(s=>new URL(s.url).hostname==='www.mykreuzfahrt.de'&&s.updateStatus!=='archived'))){
      try{
        for(let page=1;page<=40;page++){
          const url=page===1?ANNUAL:'https://www.mykreuzfahrt.de/landingpage.php?'+new URLSearchParams({url:'/tui-cruises/mein-schiff-2027/',sort:'date',dir:'asc',seite:String(page),ajax:'1',append:'1'});
          const result=await get(url),rows=parseAnnual(result.html);
          for(const row of rows){if(annual.has(row.id))throw Error('Doppelte Reise über mehrere Seiten');annual.set(row.id,row);}
          if(page>1&&result.more==='0')break;
          if(page===40)throw Error('Jahresliste nicht vollständig paginiert');
          await new Promise(resolve=>setTimeout(resolve,200));
        }
        if(annual.size<Math.floor(data.trips.length*.8))throw Error('Jahresliste unerwartet stark verkürzt');
        report.inventoryCount=annual.size;
      }catch(error){annualError=error.message;}
    }
    for(const trip of all){
      let newlyConfirmed=-1;
      if(op==='mein-schiff'&&trip.euresaCandidate&&count<limit){
        const candidate=trip.euresaCandidate;count++;
        try{
          const url=new URL(candidate.url);
          if(url.origin!=='https://euresa-reisen.de'||url.pathname!=='/reisesuche/'+candidate.code)throw Error('Unerwartetes Ziel für Quellenzuordnung');
          const offers=parseMeinSchiffEuresa((await get(url.href)).html,{...trip,euresaCode:candidate.code});
          const checkedAt=new Date().toISOString();trip.euresaCode=candidate.code;
          newlyConfirmed=trip.sources.length;trip.sources.push({label:'EURESA Reisen · Mein Schiff',url:url.href,checkedAt});
          replaceSource(trip,newlyConfirmed,offers,checkedAt);report.ok++;
          for(let i=0;i<newlyConfirmed;i++)if(new URL(trip.sources[i].url).hostname==='www.mykreuzfahrt.de'){
            trip.sources[i].updateStatus='archived';trip.sources[i].updateError='Historische Preisquelle; aktuelle Angebote stammen von EURESA';trip.offers.filter(o=>o.source===i).forEach(o=>{o.stale=true;});
          }
          trip.bookingUrl=url.href;
          trip.note='Aktuelle EURESA-Kabinenpreise mit benanntem Mein-Schiff-PRO-, PLUS- oder PUR-Tarif. Erforderliche Flugpakete sind gekennzeichnet. Frühere mykreuzfahrt-Angebote bleiben mit ihrer eigenen Kabinen-, Tarif- und Quellenzuordnung im Verlauf erhalten; die frühere Anbietergruppe Suite kann Junior-Suiten enthalten.';
          delete trip.euresaCandidate;
        }catch(error){
          if(/HTTP (403|429)/.test(error.message))throw error;
          candidate.updateError=error.message;candidate.attemptedAt=at;report.errors++;console.error(trip.id+': '+error.message);
        }
        await new Promise(resolve=>setTimeout(resolve,200));
      }
      for(let index=0;index<trip.sources.length;index++){
        if(index===newlyConfirmed)continue;
        const source=trip.sources[index],host=new URL(source.url).hostname;
        if(source.updateStatus==='archived'){report.archived=(report.archived||0)+1;continue;}
        if(euresaOnly&&host!=='euresa-reisen.de'){failSource(trip,index,'Kein automatischer Cloud-Abruf für diese Quelle; letzter bestätigter Stand bleibt historisch',at,'manual');report.manual++;continue;}
        if(count>=limit){report.skipped++;continue;}
        count++;
        try{
          let offers;
          if(op==='mein-schiff'&&host==='www.mykreuzfahrt.de'){
            if(annualError)throw Error(annualError);
            const row=annual.get(trip.code);
            if(!row)throw Error('Reise fehlt in aktueller Jahresliste; bisheriger Stand bleibt historisch');
            if(row.ship!==trip.ship||row.start!==trip.start||row.end!==trip.end)throw Error('Reiseidentität hat sich geändert');
            offers=row.offers;
          }else if(host==='euresa-reisen.de')offers=parseEuresa((await get(source.url)).html,trip);
          else if(host==='www.mykreuzfahrt.de')offers=parseMykDetail((await get(source.url)).html,trip);
          else{failSource(trip,index,'Manuelle Prüfung beim Veranstalter erforderlich',at,'manual');report.manual++;continue;}
          replaceSource(trip,index,offers,new Date().toISOString());report.ok++;
        }catch(error){if(host==='euresa-reisen.de'&&/HTTP (403|429)/.test(error.message))throw error;failSource(trip,index,error.message,at);report.errors++;console.error(trip.id+': '+error.message);}
        if(host==='euresa-reisen.de'||(op==='aida'&&host==='www.mykreuzfahrt.de'))await new Promise(resolve=>setTimeout(resolve,200));
      }
      if(count&&count%25===0)console.log(op+': '+report.ok+' Quellen aktualisiert');
    }
    if(op==='mein-schiff'&&data.euresaInventory)data.euresaInventory.confirmedCount=all.filter(t=>t.euresaCode&&t.sources.some(s=>new URL(s.url).hostname==='euresa-reisen.de'&&s.updateStatus==='ok')).length;
    data.lastUpdate=report;
    if(!report.ok)throw Error(op+': Kein erfolgreicher Preisabruf; bestehende Dateien werden erhalten.');
    // generatedAt bleibt der Katalogstand; einzelne Quellen tragen den Preisabruf.
    console.log(JSON.stringify({operator:op,dryRun:dry,...report}));
  }
  if(!dry){
    // Erst nach vollständiger Verarbeitung schreiben; .tmp wird atomar umbenannt.
    for(const [file,global,data,op] of datasets){if(operator&&operator!==op)continue;const dest=path.join(ROOT,file),temp=dest+'.tmp';fs.writeFileSync(temp,'window.'+global+' = '+JSON.stringify(data)+';\n');fs.renameSync(temp,dest);}
  }
}
module.exports={text,euro,parseEuresa,parseMeinSchiffEuresa,parseAnnual,parseMykDetail,observe,seed,replaceSource,failSource,sourceKey,readData,main};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
