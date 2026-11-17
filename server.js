'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('./ws-lite');const E=require('./engine');
const PORT=Number(process.env.PORT)||3000,root=__dirname,dbFile=process.env.DATA_FILE||path.join(root,'rooms-data.json');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end('Bad request');return;}
 if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,rooms:rooms.size}));return;}
 if(pathname==='/api/message' && req.method==='POST'){handleApi(req,res);return;}
 const filename=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=path.resolve(root,filename);
 const publicFiles=new Set(['index.html','style.css','app.js','engine.js']);
 if(!publicFiles.has(filename)||(file!==root&&!file.startsWith(root+path.sep))||!fs.existsSync(file)||!fs.statSync(file).isFile()){ 
  res.writeHead(404);res.end('Not found');return;
 }
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res);
});
const rooms=new Map();
try{const saved=JSON.parse(fs.readFileSync(dbFile,'utf8'));for(const r of saved){if(r.code&&r.host&&Array.isArray(r.players))rooms.set(r.code,{...r,sockets:new Map(),botBusy:false,updated:r.updated||Date.now()});}}catch{}
let saveTimer=null;function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{const records=[...rooms.values()].map(({sockets,botBusy,...r})=>r);const temp=dbFile+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(records));fs.renameSync(temp,dbFile);}catch(e){console.warn('Save failed:',e.message);}},120);}
const wss=new WebSocketServer({server});
const send=(ws,data)=>{if(ws?.readyState===1)ws.send(JSON.stringify(data));};
const pickRoom=()=>{let id;do{id=String(10000+crypto.randomInt(90000));}while(rooms.has(id));return id;};
function roomSnapshot(room){return {code:room.code,host:room.host,mode:room.mode,players:room.players.map(p=>({id:p.id,name:p.name,avatar:p.avatar,bot:p.bot,connected:!!p.bot||room.sockets.get(p.id)?.readyState===1||Boolean(p.lastSeen&&Date.now()-p.lastSeen<12000)})),game:room.game};}
function broadcast(room){room.updated=Date.now();const obj=roomSnapshot(room);for(const ws of room.sockets.values())send(ws,{type:'ROOM',room:obj});persist();}
// HTTPS fallback for mobile browsers or networks that block WebSocket upgrades.
function handleApi(req,res){
 let raw='',finished=false;
 const respond=(messages)=>{if(finished)return;finished=true;res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify({messages}));};
 req.on('data',chunk=>{raw+=chunk.toString();if(raw.length>65536){finished=true;res.writeHead(413);res.end();req.destroy();}});
 req.on('end',()=>{
  if(finished)return;
  try{
   const msg=JSON.parse(raw),type=String(msg.type||'');let room;
   const findAuth=()=>{const s=msg._session||{},r=rooms.get(String(s.code||'')),p=r?.players.find(p=>p.id===s.id&&p.token&&p.token===s.token);if(!r||!p)throw Error('Сессия комнаты не найдена. Создай новую комнату или войди по коду.');p.lastSeen=Date.now();r.updated=Date.now();return {r,p};};
   if(type==='CREATE'){
    const code=pickRoom(),id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex');
    room={code,host:id,mode:E.MODES[msg.mode]?msg.mode:'classic',players:[{id,name:String(msg.name||'Игрок').trim().slice(0,20),avatar:'🌙',token,lastSeen:Date.now()}],game:null,sockets:new Map(),botBusy:false,updated:Date.now()};
    rooms.set(code,room);broadcast(room);return respond([{type:'IDENTITY',id,code,token},{type:'ROOM',room:roomSnapshot(room)}]);
   }
   if(type==='JOIN'){
    room=rooms.get(String(msg.code||'').trim());if(!room)throw Error('Комната не найдена');if(room.game)throw Error('Партия уже началась');if(room.players.length>=E.MODES[room.mode].max)throw Error('Мест больше нет');
    const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex');
    room.players.push({id,token,name:String(msg.name||'Игрок').trim().slice(0,20),avatar:avatars[room.players.length%avatars.length],lastSeen:Date.now()});broadcast(room);
    return respond([{type:'IDENTITY',id,code:room.code,token},{type:'ROOM',room:roomSnapshot(room)}]);
   }
   if(type==='RESUME'||type==='POLL'){
    let auth;try{auth=findAuth();}catch(e){return respond([{type:'INVALID_SESSION'}]);}
    room=auth.r;
    return respond(type==='RESUME'?[{type:'IDENTITY',id:auth.p.id,code:room.code,token:auth.p.token},{type:'ROOM',room:roomSnapshot(room)}]:[{type:'ROOM',room:roomSnapshot(room)}]);
   }
   if(type==='START'){
    const {r,p}=findAuth();room=r;
    if(p.id!==room.host)throw Error('Только создатель начинает игру');if(room.game)throw Error('Партия уже идёт');
    const rules=E.MODES[room.mode],humans=room.players.length,available=rules.max-humans,botCount=Number(msg.botCount??0);
    if(!Number.isInteger(botCount)||botCount<0||botCount>available)throw Error(`Можно добавить от 0 до ${available} ботов`);
    if(humans+botCount<rules.min)throw Error(`Нужно минимум ${rules.min} участников`);
    const players=room.players.map(({token,lastSeen,...p})=>p);
    for(let j=0;j<botCount;j++){const i=players.length;players.push({id:'bot-'+j+'-'+room.code,name:['Алина','Даня','Саша','Мира'][j%4],avatar:avatars[i%avatars.length],bot:true});}
    room.players.push(...players.filter(p=>p.bot));room.game=E.create(players,room.mode);broadcast(room);runBots(room);
    return respond([{type:'ROOM',room:roomSnapshot(room)}]);
   }
   if(type==='ACT'){
    const {r,p}=findAuth();room=r;if(!room.game)throw Error('Партия ещё не началась');
    const action=String(msg.action||'');if(!/^[A-Z_]{2,25}$/.test(action))throw Error('Неверное действие');
    E.act(room.game,p.id,action,msg.args&&typeof msg.args==='object'?msg.args:{});broadcast(room);runBots(room);
    return respond([{type:'ROOM',room:roomSnapshot(room)}]);
   }
   if(type==='LEAVE'){
    const {r,p}=findAuth();room=r;
    if(room.game){p.lastSeen=0;broadcast(room);return respond([]);}
    room.players=room.players.filter(x=>x.id!==p.id);
    if(!room.players.length){rooms.delete(room.code);persist();}else{if(room.host===p.id)room.host=room.players[0].id;broadcast(room);}
    return respond([]);
   }
   throw Error('Неизвестная команда');
  }catch(e){respond([{type:'ERROR',message:e.message||'Ошибка сервера'}]);}
 });
 req.on('error',()=>{if(!finished){finished=true;res.destroy();}});
}
function runBots(room){if(!room?.game||room.botBusy||!E.current(room.game).bot)return;room.botBusy=true;let count=0;const run=()=>{
 if(!room.game||room.game.finished||!E.current(room.game).bot||count++>=20){room.botBusy=false;return;}
 try{E.botTurn(room.game);broadcast(room);}catch(e){console.error('Bot error',e);room.botBusy=false;return;}
 setTimeout(run,850);
};setTimeout(run,650);
}
function cleanConnection(ws){if(!ws.roomCode)return;const room=rooms.get(ws.roomCode);if(!room)return;if(room.sockets.get(ws.playerId)===ws){room.sockets.delete(ws.playerId);broadcast(room);}ws.roomCode=null;ws.playerId=null;}
const auth=ws=>{const room=rooms.get(ws.roomCode);if(!room||room.sockets.get(ws.playerId)!==ws)throw Error('Нужно войти в комнату');return room;};
const error=(ws,e)=>send(ws,{type:'ERROR',message:e.message||String(e)});
const avatars=['🌙','🦊','🐼','🌸','🐱'];
wss.on('connection',ws=>{
 ws.on('message',raw=>{
  let msg;try{msg=JSON.parse(String(raw));}catch{return;}
  try{
   if(msg.type==='CREATE'){
    cleanConnection(ws);const code=pickRoom(),id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex');
    const room={code,host:id,mode:E.MODES[msg.mode]?msg.mode:'classic',players:[{id,name:String(msg.name||'Игрок').trim().slice(0,20),avatar:'🌙',token}],game:null,sockets:new Map(),botBusy:false,updated:Date.now()};
    rooms.set(code,room);room.sockets.set(id,ws);ws.roomCode=code;ws.playerId=id;send(ws,{type:'IDENTITY',id,code,token});broadcast(room);
   }else if(msg.type==='JOIN'){
    const room=rooms.get(String(msg.code||'').trim());if(!room)throw Error('Комната не найдена');if(room.game)throw Error('Партия уже началась');if(room.players.length>=E.MODES[room.mode].max)throw Error('В этой комнате больше нет мест');
    cleanConnection(ws);const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex');room.players.push({id,token,name:String(msg.name||'Игрок').trim().slice(0,20),avatar:avatars[room.players.length]});room.sockets.set(id,ws);ws.roomCode=room.code;ws.playerId=id;send(ws,{type:'IDENTITY',id,code:room.code,token});broadcast(room);
   }else if(msg.type==='RESUME'){
    const room=rooms.get(String(msg.code||'')),p=room?.players.find(p=>p.id===String(msg.id));
    if(!room||!p||!p.token||p.token!==msg.token){send(ws,{type:'INVALID_SESSION'});return;}
    cleanConnection(ws);const previous=room.sockets.get(p.id);if(previous&&previous!==ws)previous.close();ws.roomCode=room.code;ws.playerId=p.id;room.sockets.set(p.id,ws);send(ws,{type:'IDENTITY',id:p.id,code:room.code,token:p.token});broadcast(room);runBots(room);
   }else if(msg.type==='START'){
    const room=auth(ws),rules=E.MODES[room.mode];if(ws.playerId!==room.host)throw Error('Только создатель начинает игру');if(room.game)throw Error('Партия уже идёт');
    const humans=room.players.length, available=rules.max-humans;
    const botCount=msg.botCount===undefined?(msg.addBots?Math.max(0,rules.min-humans):0):Number(msg.botCount);
    if(!Number.isInteger(botCount)||botCount<0||botCount>available)throw Error(`Можно добавить от 0 до ${available} ботов`);
    if(humans+botCount<rules.min)throw Error(`Для режима «${rules.label}» нужно минимум ${rules.min} участников`);
    const players=room.players.map(({token,...p})=>p);
    for(let j=0;j<botCount;j++){
     const i=players.length;players.push({id:'bot-'+j+'-'+room.code,name:['Алина','Даня','Саша','Мира'][j%4],avatar:avatars[i%avatars.length],bot:true});
    }
    room.players.push(...players.filter(p=>p.bot));room.game=E.create(players,room.mode);broadcast(room);runBots(room);
   }else if(msg.type==='ACT'){
    const room=auth(ws);if(!room.game)throw Error('Партия ещё не началась');const action=String(msg.action||'');if(!/^[A-Z_]{2,25}$/.test(action))throw Error('Неверное действие');E.act(room.game,ws.playerId,action,msg.args&&typeof msg.args==='object'?msg.args:{});broadcast(room);runBots(room);
   }else if(msg.type==='LEAVE'){
    const room=auth(ws);if(room.game){cleanConnection(ws);return;}
    room.players=room.players.filter(p=>p.id!==ws.playerId);const exiting=ws.playerId;room.sockets.delete(exiting);ws.roomCode=null;ws.playerId=null;
    if(!room.players.length){rooms.delete(room.code);persist();}
    else{if(room.host===exiting)room.host=room.players[0].id;broadcast(room);}
   }else if(msg.type==='PING')send(ws,{type:'PONG'});
  }catch(e){error(ws,e);}
 });ws.on('close',()=>cleanConnection(ws));
});
setInterval(()=>{const now=Date.now();for(const [code,room]of rooms)if(!room.sockets.size&&now-room.updated>48*3600000)rooms.delete(code);persist();},3600000);
server.listen(PORT,'0.0.0.0',()=>console.log(`Aurora City: http://localhost:${PORT}`));
