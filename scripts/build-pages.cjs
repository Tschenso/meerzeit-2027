'use strict';
const fs=require('node:fs'),path=require('node:path');
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
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('GitHub-Pages-Paket: '+files.length+' Laufzeitdateien + .nojekyll');
