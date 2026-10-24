'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
const files=['index.html','dashboard.css','dashboard.js','kalender.js','kombinationen.js','data.js','mein-schiff.js'];
// Keine rekursiven Löschungen und keine lokalen Betriebsdateien im Webpaket.
if(fs.existsSync(out)){
  if(fs.lstatSync(out).isSymbolicLink()||fs.realpathSync(out)!==out)throw Error('Unerwartetes Ausgabeziel');
  for(const name of fs.readdirSync(out)){
    if(![...files,'.nojekyll'].includes(name)||!fs.lstatSync(path.join(out,name)).isFile())throw Error('Unbekannter Inhalt in dist: '+name);
  }
}else fs.mkdirSync(out);
for(const name of files){const source=path.join(root,name);if(!fs.lstatSync(source).isFile()||fs.lstatSync(source).isSymbolicLink())throw Error('Keine reguläre Quelldatei: '+name);fs.copyFileSync(source,path.join(out,name));}
// Geänderte Dateien bekommen eine neue Browser-Cache-Adresse, auch bei Wochenupdates.
const versions=new Map(files.filter(name=>name!=='index.html').map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex').slice(0,16)]));
const referenced=new Set();
const html=fs.readFileSync(path.join(out,'index.html'),'utf8').replace(/\b(src|href)="([^"]+)"/g,(match,attribute,url)=>{
  if(!versions.has(url))return match;
  referenced.add(url);return attribute+'="'+url+'?v='+versions.get(url)+'"';
});
if(referenced.size!==versions.size)throw Error('Nicht alle Laufzeitdateien sind im Webpaket versioniert');
fs.writeFileSync(path.join(out,'index.html'),html);
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('GitHub-Pages-Paket: '+files.length+' Laufzeitdateien + .nojekyll');
