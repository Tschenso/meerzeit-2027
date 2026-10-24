#!/usr/bin/env node
'use strict';
// Einmaliger Quellenabgleich. Reisen und vorhandene Verläufe werden erhalten.
const fs=require('node:fs'),path=require('node:path'),p=require('./preise-aktualisieren.cjs');
const ROOT=path.resolve(__dirname,'..');
function parseInventory(html){
  const starts=[...html.matchAll(/<div[^>]+wire:key="cruise-panel-cruises-(\d+)"[^>]*>/g)];
  if(!starts.length)throw Error('Keine EURESA-Reisekarten erkannt');
  const rows=starts.map((m,i)=>{
    const block=html.slice(m.index,starts[i+1]?.index||html.length),plain=p.text(block);
    const code=block.match(/\/reisesuche\/([A-Z0-9]+)\?/i)?.[1],ship=plain.match(/(\d+) Nächte mit (Mein Schiff (?:[1-7]|Relax|Flow))\b/);
    const dates=plain.match(/(\d{2})\.(\d{2})\.(2027) bis (\d{2})\.(\d{2})\.(2027)/);
    if(!code||!ship||!dates)throw Error('Unvollständige EURESA-Reisekarte');
    return {code,ship:ship[2],nights:Number(ship[1]),start:`${dates[3]}-${dates[2]}-${dates[1]}`,end:`${dates[6]}-${dates[5]}-${dates[4]}`};
  });
  const pages=Math.max(1,...[...html.matchAll(/paginator-page-page(\d+)/g)].map(m=>Number(m[1])),...[...html.matchAll(/gotoPage\((\d+), 'page'\)/g)].map(m=>Number(m[1])));
  return {rows,pages};
}
const key=t=>[t.ship,t.start,t.end,t.nights].join('|');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'Meerzeit2027/1.0 (public cruise price comparison)','Accept-Language':'de-DE'}});if(!r.ok)throw Error('HTTP '+r.status);return r.text();}
async function main(){
  const catalogOnly=process.argv.includes('--catalog-only');
  if(process.argv.slice(2).some(a=>a!=='--catalog-only'))throw Error('Unbekannte Option');
  const data=p.readData('mein-schiff.js','MEINSCHIFF2027'),rows=new Map();
  const base='https://euresa-reisen.de/reisesuche?org%5B0%5D=2&start=2027-01-01&end=2027-12-31&priceView=pax';
  let pages=1;
  for(let page=1;page<=pages;page++){
    const found=parseInventory(await get(base+'&page='+page));pages=found.pages;
    if(pages>100)throw Error('Unerwartet große EURESA-Jahresliste');
    for(const row of found.rows){if(rows.has(row.code))throw Error('Doppelte EURESA-Reise über mehrere Seiten');rows.set(row.code,row);}
    if(page%10===0)console.log('EURESA-Katalog: '+page+'/'+pages+' Seiten');
    await new Promise(r=>setTimeout(r,200));
  }
  const candidates=new Map();for(const row of rows.values()){if(!candidates.has(key(row)))candidates.set(key(row),[]);candidates.get(key(row)).push(row);}
  const report={checkedAt:new Date().toISOString(),sourceUrl:base,inventoryCount:rows.size,matched:0,candidates:0,unmatched:[]};
  for(const trip of data.trips){
    const matches=candidates.get(key(trip))||[];
    if(matches.length!==1){report.unmatched.push({id:trip.id,reason:matches.length?'Mehrdeutige Reiseidentität':'Nicht in EURESA-Jahresliste gefunden'});continue;}
    const code=matches[0].code,url='https://euresa-reisen.de/reisesuche/'+code+'?priceView=pax';
    if(catalogOnly){trip.euresaCandidate={code,url,catalogCheckedAt:report.checkedAt};report.candidates++;continue;}
    try{
      const offers=p.parseMeinSchiffEuresa(await get(url),{...trip,euresaCode:code}),at=new Date().toISOString();
      p.seed(trip);trip.euresaCode=code;
      let index=trip.sources.findIndex(s=>s.url===url);
      if(index<0){index=trip.sources.length;trip.sources.push({label:'EURESA Reisen · Mein Schiff',url,checkedAt:at});}
      p.replaceSource(trip,index,offers,at);
      for(let i=0;i<trip.sources.length;i++)if(new URL(trip.sources[i].url).hostname==='www.mykreuzfahrt.de'){
        trip.sources[i].updateStatus='archived';trip.sources[i].updateError='Historische Preisquelle; aktuelle Angebote stammen von EURESA';
        trip.offers.filter(o=>o.source===i).forEach(o=>{o.stale=true;});
      }
      trip.bookingUrl=url;
      trip.note='Aktuelle EURESA-Kabinenpreise mit benanntem Mein-Schiff-PRO-, PLUS- oder PUR-Tarif. Der Anbieter bestimmt, ob ein Flugpaket erforderlich ist. Frühere mykreuzfahrt-Angebote bleiben mit ihrer eigenen Kabinen-, Tarif- und Quellenzuordnung im Verlauf erhalten. Die frühere Anbietergruppe Suite kann Junior-Suiten enthalten.';
      report.matched++;
    }catch(error){report.unmatched.push({id:trip.id,reason:error.message});if(/HTTP (403|429)/.test(error.message))throw error;}
    if((report.matched+report.unmatched.length)%25===0)console.log('Mein Schiff: '+report.matched+' Quellen bestätigt');
    await new Promise(r=>setTimeout(r,200));
  }
  if(report.matched+report.candidates<Math.floor(data.trips.length*.8))throw Error('Zu wenige eindeutig zugeordnete Reisen; Datendatei bleibt erhalten: '+JSON.stringify(report));
  data.euresaInventory=report;
  if(!catalogOnly)data.lastUpdate={attemptedAt:report.checkedAt,ok:report.matched,errors:report.unmatched.length,manual:0,skipped:0};
  const dest=path.join(ROOT,'mein-schiff.js');fs.writeFileSync(dest+'.tmp','window.MEINSCHIFF2027 = '+JSON.stringify(data)+';\n');fs.renameSync(dest+'.tmp',dest);
  console.log(JSON.stringify(report));
}
module.exports={parseInventory,key};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
