'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const PUBLIC_FILES=new Set(['index.html','dashboard.css','dashboard.js','kalender.js','kombinationen.js','data.js','mein-schiff.js','dashboard-vorschau.png']);
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png'};
const ipNumber=ip=>ip.split('.').reduce((value,part)=>((value<<8)>>>0)+Number(part),0)>>>0;
function privateHost(host){if(!net.isIPv4(host))return false;const [a,b]=host.split('.').map(Number);return a===127||a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);}
function sameSubnet(address,host,prefixLength){
  const ip=String(address||'').replace(/^::ffff:/,'');if(!net.isIPv4(ip))return false;
  const mask=(0xffffffff<<(32-prefixLength))>>>0;
  return (ipNumber(ip)&mask)===(ipNumber(host)&mask);
}
function createDashboardServer({host='127.0.0.1',prefixLength=24}={}){
  if(!privateHost(host)||!Number.isInteger(prefixLength)||prefixLength<8||prefixLength>32)throw Error('Nur eine konkrete lokale IPv4-Adresse und ein gültiges lokales Subnetz sind erlaubt.');
  const root=fs.realpathSync(__dirname);
  return http.createServer((req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
    if(!sameSubnet(req.socket.remoteAddress,host,prefixLength)){res.writeHead(403);res.end('Nur im lokalen WLAN erreichbar.');return;}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end('Method not allowed');return;}
    let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://dashboard.local').pathname);}catch{res.writeHead(400);res.end('Bad request');return;}
    if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(req.method==='HEAD'?undefined:JSON.stringify({app:'meerzeit-2027',serverVersion:1}));return;}
    const name=pathname==='/'?'index.html':pathname.slice(1);
    if(!PUBLIC_FILES.has(name)){res.writeHead(404);res.end('Not found');return;}
    const file=path.join(root,name);
    let real,stat;try{real=fs.realpathSync(file);stat=fs.statSync(real);}catch{res.writeHead(404);res.end('Not found');return;}
    const relative=path.relative(root,real);
    if(path.isAbsolute(relative)||relative==='..'||relative.startsWith('..'+path.sep)||!stat.isFile()){res.writeHead(403);res.end('Forbidden');return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(name)],'Content-Length':stat.size});
    if(req.method==='HEAD'){res.end();return;}
    const stream=fs.createReadStream(real);stream.on('error',()=>res.destroy());stream.pipe(res);
  });
}
if(require.main===module){
  try{
    const values={};for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i];if(!['--host','--port','--prefix-length'].includes(key)||!process.argv[i+1])throw Error('Ungültige Startargumente.');values[key]=process.argv[i+1];}
    const host=values['--host']||'127.0.0.1',port=Number(values['--port']||8787),prefixLength=Number(values['--prefix-length']||24);
    if(!Number.isInteger(port)||port<1||port>65535)throw Error('Ungültiger Port.');
    const server=createDashboardServer({host,prefixLength});server.on('error',error=>{console.error('Dashboard-Server: '+error.message);process.exitCode=1;});
    server.listen(port,host,()=>console.log('MEERZEIT: http://'+host+':'+port+'/#kalender'));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={createDashboardServer,privateHost,sameSubnet};
