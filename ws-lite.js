'use strict';
// Minimal, dependency-free WebSocket server for same-origin browser game rooms.
const crypto=require('crypto');const {EventEmitter}=require('events');
class Peer extends EventEmitter{
 constructor(socket,head){super();this.socket=socket;this.readyState=1;this.buffer=Buffer.alloc(0);this.fragment=null;socket.on('data',data=>this.receive(data));socket.on('error',()=>this.close());socket.on('close',()=>{this.readyState=3;this.emit('close');});if(head?.length)this.receive(head);}
 frame(op,payload){if(this.readyState!==1)return;payload=Buffer.isBuffer(payload)?payload:Buffer.from(payload||'');let head;if(payload.length<126){head=Buffer.from([0x80|op,payload.length]);}else if(payload.length<65536){head=Buffer.alloc(4);head[0]=0x80|op;head[1]=126;head.writeUInt16BE(payload.length,2);}else{head=Buffer.alloc(10);head[0]=0x80|op;head[1]=127;head.writeBigUInt64BE(BigInt(payload.length),2);}this.socket.write(Buffer.concat([head,payload]));}
 send(data){this.frame(1,String(data));}
 close(){if(this.readyState!==1)return;try{this.frame(8,Buffer.alloc(0));}catch{}this.readyState=3;this.socket.end();}
 receive(chunk){this.buffer=Buffer.concat([this.buffer,chunk]);if(this.buffer.length>1048576+100){this.close();return;}while(this.buffer.length>=2){const b=this.buffer,opcode=b[0]&15,fin=!!(b[0]&0x80),masked=!!(b[1]&0x80);if(!masked){this.close();return;}let len=b[1]&127,off=2;if(len===126){if(b.length<4)return;len=b.readUInt16BE(2);off=4;}else if(len===127){if(b.length<10)return;const size=b.readBigUInt64BE(2);if(size>1048576n){this.close();return;}len=Number(size);off=10;}if(len>1048576){this.close();return;}if(b.length<off+4+len)return;const mask=b.subarray(off,off+4);off+=4;let payload=Buffer.from(b.subarray(off,off+len));for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];this.buffer=b.subarray(off+len);
 if(opcode===8){this.close();return;}if(opcode===9){this.frame(10,payload);continue;}if(opcode===10)continue;if(opcode===1||opcode===0){if(opcode===1&&!fin){this.fragment=[payload];continue;}if(opcode===0&&this.fragment){this.fragment.push(payload);if(fin){payload=Buffer.concat(this.fragment);this.fragment=null;this.emit('message',payload);}continue;}if(opcode===1&&fin)this.emit('message',payload);}else{this.close();return;}
 }}
}
class WebSocketServer extends EventEmitter{
 constructor({server}){super();server.on('upgrade',(req,socket,head)=>{const key=req.headers['sec-websocket-key'];if(req.headers.upgrade?.toLowerCase()!=='websocket'||typeof key!=='string'||!/^\S{20,30}$/.test(key)){socket.destroy();return;}const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');this.emit('connection',new Peer(socket,head));});}
}
module.exports={WebSocketServer};
