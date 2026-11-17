(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.AuroraEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MODES={
 classic:{label:'Обычная',icon:'🎩',detail:'2 кубика · свободные улицы · классическая партия',min:2,max:5,cash:15000,salary:2000,three:false,mortgageRounds:15},
 fast:{label:'Быстрая игра',icon:'⚡',detail:'3-й особый кубик · быстрый старт · больше событий',min:2,max:5,cash:17500,salary:2000,three:true,mortgageRounds:null},
 retro:{label:'Ретро',icon:'📼',detail:'2 кубика · старт 15 000k · старые темпы игры',min:2,max:5,cash:15000,salary:1500,three:false,mortgageRounds:null},
 layout:{label:'Расклад',icon:'🃏',detail:'3 игрока · каждому случайный бюджет · улицы розданы',min:3,max:3,cash:15000,salary:2000,three:true,mortgageRounds:null},
 shuffle:{label:'Перестановка 3',icon:'🔀',detail:'3 игрока · старт 25 000k · случайный порядок клеток',min:3,max:3,cash:25000,salary:2000,three:true,mortgageRounds:7}
};
const defs=[
['Старт',0,'start','🚀'],['Шанс',0,'chance','❔'],['American Airlines',2200,'air','✈️'],['Банковская премия',0,'bonus','💵'],['Taxi Max',2600,'transport','🚕'],['Шанс',0,'chance','❔'],['Chanel',600,'fashion','✿'],['Hugo Boss',600,'fashion','♛'],['Lufthansa',2200,'air','🛫'],['Шанс',0,'chance','❔'],['Сладкий приз',0,'bonus','🍩'],
['Apple',3500,'tech','◉'],['Adidas',1000,'sport','◢'],['Шанс',0,'chance','❔'],['Сити Бонус',1400,'special','✚'],['Mercedes',2000,'auto','✧'],['Puma',1000,'sport','🐆'],['Lacoste',1200,'sport','🐊'],['Coca-Cola',1800,'drinks','🥤'],['Holiday Inn',3000,'hotel','🏨'],['Портал',0,'portal','🌀'],
['Шанс',0,'chance','❔'],['Radisson',3000,'hotel','🏙️'],['Rockstar',1500,'games','⭐'],['Friender',1400,'special','💬'],['Pepsi',1800,'drinks','🔵'],['Rovio',1500,'games','🐦'],['British Airways',2400,'air','✈️'],['Audi',2000,'auto','◉'],['Burger King',2600,'food','🍔'],['Полиция',0,'police','👮'],
['Алмаз',0,'case','💎'],['KFC',2800,'food','🍗'],['Nokia',4000,'tech','📱'],['Ключ',1600,'special','🗝️'],['Ford',2000,'auto','🚙'],['Novotel',3200,'hotel','🛎️'],['Шанс',0,'chance','❔'],['Land Rover',2000,'auto','🚘'],['Fanta',2000,'drinks','🍊']
];
const COLORS={air:'#89c46e',transport:'#4cc9ee',fashion:'#f47ab9',tech:'#a6a9b0',sport:'#f6b84f',auto:'#fa6674',drinks:'#38bba3',hotel:'#ad8ae9',games:'#e2724a',food:'#67c5ef',special:'#55c9a7'};
const BUFFS=[{value:2.5,rarity:'Обычная',weight:37},{value:10,rarity:'Редкая',weight:28},{value:20,rarity:'Эпическая',weight:19},{value:33,rarity:'Легендарная',weight:11},{value:50,rarity:'Мифическая',weight:5}];
const coins=n=>`${Math.round(n||0).toLocaleString('ru-RU')}k`;
const rnd=n=>Math.floor(Math.random()*n);
const allDefs=()=>defs.map((a,i)=>({id:i,name:a[0],price:a[1],type:a[2],symbol:a[3],color:COLORS[a[2]]||'#9ea3bb',ownerId:null,level:0,buffs:[],mortgage:false,mortgageDueRound:null}));
const shuffle=a=>{for(let i=a.length-1;i>0;i--){let j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
function log(g,kind,message,extra={}){g.seq++;g.events.push({seq:g.seq,kind,message,...extra});if(g.events.length>100)g.events.shift();}
function create(people,mode='classic'){
 if(!MODES[mode])mode='classic';const rule=MODES[mode];if(!Array.isArray(people)||people.length<rule.min||people.length>rule.max)throw Error(`Для режима «${rule.label}» нужно игроков: ${rule.min===rule.max?rule.min:`от ${rule.min} до ${rule.max}`}`);
 const ids=people.map(x=>String(x.id));if(new Set(ids).size!==ids.length)throw Error('ID игроков должны отличаться');
 const tiles=allDefs();if(mode==='shuffle'){
  const positions=tiles.filter(t=>![0,10,20,30].includes(t.id)).map(t=>t.id);
  const pool=shuffle(positions.map(i=>tiles[i]));positions.forEach((id,i)=>{tiles[id]={...pool[i],id};});
 }
 const layoutBudgets=mode==='layout'?shuffle(Array.from({length:21},(_,i)=>15000+i*500)).slice(0,people.length):null;
 const players=people.map((o,i)=>({id:String(o.id),name:String(o.name||'Игрок '+(i+1)).replace(/[<>]/g,'').slice(0,22),avatar:['🌙','🦊','🐼','🌸','🐱'][i],color:['#ce9dff','#6de5dd','#ffbe89','#f79dce','#ffe078'][i],bot:!!o.bot,cash:layoutBudgets?layoutBudgets[i]:rule.cash,pos:0,cases:1,inventory:[],loans:[],bankrupt:false,turns:0}));
 const g={mode,tiles,players,active:0,phase:'roll',turn:1,round:1,seq:0,events:[],lastRoll:null,pendingRoll:null,offer:null,finished:false};
 if(mode==='layout'){
  const pool=shuffle(tiles.filter(t=>t.price>0));pool.forEach((t,i)=>{t.ownerId=players[(i%6<3)?i%3:2-i%3].id;});
  log(g,'layout','Все улицы распределены между тремя игроками; стартовый бюджет каждого определён случайно');
 }
 if(mode==='shuffle')log(g,'shuffle','Клетки поля переставлены случайным образом');
 log(g,'start',`Партия «${rule.label}» началась`);
 return g;
}
const current=g=>g.players[g.active];
const owned=(g,p)=>g.tiles.filter(t=>t.ownerId===p.id);
const buildingCost=t=>Math.round(t.price*(.32+t.level*.055));
const rent=t=>!t.price||t.mortgage?0:Math.round(t.price*([.09,.18,.36,.68,1.1,1.65][t.level]||1.65)*(1+t.buffs.reduce((a,b)=>a+b.value,0)/100));
function netWorth(g,p){return p.cash+owned(g,p).reduce((s,t)=>s+t.price+Array.from({length:t.level},(_,i)=>buildingCost({...t,level:i})).reduce((a,b)=>a+b,0),0)-p.loans.reduce((s,l)=>s+l.due,0);}
function release(g,p,creditor){for(const t of owned(g,p)){t.ownerId=creditor?.id||null;t.mortgage=false;t.mortgageDueRound=null;t.level=0;t.buffs=[];}p.bankrupt=true;p.cash=0;log(g,'lose',`${p.name} обанкротился`,{playerId:p.id});}
function liquidate(g,p,needed){
 const assets=owned(g,p).sort((a,b)=>b.price-a.price);
 for(const t of assets){if(p.cash>=needed)break;const proceeds=Math.round(t.price*.65+Array.from({length:t.level},(_,i)=>buildingCost({...t,level:i})).reduce((a,b)=>a+b,0)*(g.mode==='layout'?.75:1));p.cash+=proceeds;t.ownerId=null;t.level=0;t.buffs=[];t.mortgage=false;t.mortgageDueRound=null;log(g,'sell',`${p.name} продал ${t.name}, чтобы покрыть долг (${coins(proceeds)})`,{tile:t.id,playerId:p.id});}
}
function pay(g,p,amount,reason,creditor=null){
 if(amount<=0)return;
 if(p.cash<amount)liquidate(g,p,amount);
 const given=Math.max(0,Math.min(p.cash,amount));p.cash-=given;if(creditor)creditor.cash+=given;
 log(g,'rent',`${p.name}: −${coins(given)} · ${reason}`,{playerId:p.id,toId:creditor?.id,amount:-given});
 if(given<amount){release(g,p,creditor);}
}
function gain(g,p,amount,reason){if(amount<0)return pay(g,p,-amount,reason);p.cash+=amount;log(g,'money',`${p.name}: +${coins(amount)} · ${reason}`,{playerId:p.id,amount});}
function move(g,p,steps){const from=p.pos;const next=from+steps;p.pos=((next%40)+40)%40;if(steps>0&&next>=40)gain(g,p,MODES[g.mode].salary,'зарплата за круг');return {from,to:p.pos,steps};}
function land(g,p,depth=0){if(depth>2||p.bankrupt)return;const t=g.tiles[p.pos];
 if(t.price>0){
  if(t.ownerId&&t.ownerId!==p.id&&!t.mortgage){const other=g.players.find(x=>x.id===t.ownerId);if(other&&!other.bankrupt)pay(g,p,rent(t),`аренда ${t.name}`,other);}
  else if(!t.ownerId){if(p.cash>=t.price){g.phase='decision';log(g,'offer',`Доступна ${t.name} за ${coins(t.price)}`,{tile:t.id,playerId:p.id});}else log(g,'tile',`Не хватает средств на ${t.name}`,{tile:t.id});}
  else log(g,'tile',`${p.name} попал на свою улицу ${t.name}`,{tile:t.id});
 }else if(t.type==='chance'){
  const options=g.mode==='retro'?[['Удача в лотерее',400],['Штраф',-300],['Премия',600],['Налог',-400]]:[['Выигрыш в лотерее',600],['Штраф за парковку',-380],['Прибыль по акциям',950],['Налог на недвижимость',-500],['Возврат за покупки',420]];
  const [msg,amount]=options[rnd(options.length)];gain(g,p,amount,msg);
 }else if(t.type==='bonus'){
  if(rnd(2)===0)gain(g,p,550,'городской бонус');else{p.cases++;log(g,'case',`${p.name} получил бесплатный кейс`,{playerId:p.id,tile:t.id});}
 }else if(t.type==='case'){
  p.cases++;log(g,'case',`${p.name} получил бесплатный кейс`,{playerId:p.id,tile:t.id});
 }else if(t.type==='portal'){
  const steps=(rnd(2)===0?-1:1)*(3+rnd(5));const m=move(g,p,steps);log(g,'portal',`${p.name} перенесён порталом на ${Math.abs(steps)} клеток ${steps>0?'вперёд':'назад'}`,{playerId:p.id,tile:m.to});land(g,p,depth+1);
 }else if(t.type==='police')pay(g,p,400,'штраф полиции');
 else log(g,'tile',`${p.name} попал на «${t.name}»`,{tile:t.id});
}
function finalize(g){
 const alive=g.players.filter(x=>!x.bankrupt);if(alive.length===1){g.finished=true;g.phase='finished';log(g,'win',`Победитель — ${alive[0].name}!`,{playerId:alive[0].id});}
}
// Each round is one complete cycle of player turns, even when some players are bankrupt.
function mortgageRemaining(g,t){
 if(!t.mortgage)return null;
 const limit=MODES[g.mode].mortgageRounds;
 if(limit==null)return null;
 return Math.max(0,(Number.isInteger(t.mortgageDueRound)?t.mortgageDueRound:(g.round||1)+limit)-(g.round||1));
}
function expireMortgages(g){
 const limit=MODES[g.mode].mortgageRounds;
 if(limit==null)return;
 for(const t of g.tiles){
  if(!t.mortgage||!t.ownerId)continue;
  // Mortgages made before this feature get a fresh full term when an old save resumes.
  if(!Number.isInteger(t.mortgageDueRound)){t.mortgageDueRound=g.round+limit;continue;}
  if(g.round<t.mortgageDueRound)continue;
  const oldOwner=g.players.find(x=>x.id===t.ownerId);
  t.ownerId=null;t.mortgage=false;t.mortgageDueRound=null;t.level=0;t.buffs=[];
  log(g,'sell',`${oldOwner?.name||'Игрок'} не выкупил ${t.name} за ${limit} раундов — улица вернулась банку`,{tile:t.id,playerId:oldOwner?.id});
 }
}
function nextPlayer(g){
 if(!Number.isInteger(g.round))g.round=Math.max(1,Math.ceil(g.turn/g.players.length));
 let wrapped=false;
 let tries=0;do{g.active=(g.active+1)%g.players.length;if(g.active===0)wrapped=true;tries++;}while(current(g).bankrupt&&tries<=g.players.length);
 if(tries>g.players.length){finalize(g);return;}
 if(wrapped){g.round++;expireMortgages(g);}
 g.phase='roll';g.pendingRoll=null;g.turn++;const p=current(g);p.turns++;
 for(let i=p.loans.length-1;i>=0;i--){let l=p.loans[i];l.left--;if(l.left<=0){p.loans.splice(i,1);pay(g,p,l.due,'возврат кредита');log(g,'loan',`${p.name}: наступил срок погашения`,{playerId:p.id});if(p.bankrupt)break;}}
 if(p.bankrupt){finalize(g);if(!g.finished)nextPlayer(g);return;}
 if(p.turns>0&&p.turns%(g.mode==='fast'?3:4)===0){p.cases++;log(g,'case',`${p.name} получил бесплатный кейс за активность`,{playerId:p.id});}
 log(g,'turn',`Ход игрока ${p.name}`,{playerId:p.id});
}
function act(g,actorId,type,args={}){
 if(g.finished)throw Error('Партия закончилась');const p=g.players.find(x=>x.id===String(actorId));if(!p||p.bankrupt)throw Error('Игрок недоступен');const cp=current(g);const only=()=>{if(cp.id!==p.id)throw Error('Сейчас ход другого игрока');};
 const tile=()=>{const id=Number(args.tile);if(!Number.isInteger(id)||id<0||id>=40)throw Error('Неверная клетка');return g.tiles[id];};
 switch(type){
 case 'ROLL':{
  only();if(g.phase!=='roll')throw Error('Сейчас нельзя бросить кубики');let dice=[rnd(6)+1,rnd(6)+1];
  if(MODES[g.mode].three){const bonus=[1,2,3,'BUS','M1'];dice.push(bonus[rnd(bonus.length)]);}
  const from=p.pos;let steps=dice[0]+dice[1];if(typeof dice[2]==='number')steps+=dice[2];
  if(dice[2]==='BUS'){
   g.pendingRoll={from,dice,options:[dice[0],dice[1],dice[0]+dice[1]]};g.phase='bus';g.lastRoll={playerId:p.id,dice,from,to:from,steps:0};log(g,'roll',`${p.name} выбросил ${dice.join(' + ')} · выбери маршрут автобуса`,{playerId:p.id,dice,from,to:from,steps:0});
  }else{
   const moved=move(g,p,steps);g.phase='end';g.lastRoll={playerId:p.id,dice,...moved};log(g,'roll',`${p.name} выбросил ${dice.join(' + ')} · ход на ${steps}`,{playerId:p.id,dice,...moved});
   if(dice[2]==='M1'){
    let candidate=null;for(let n=1;n<40;n++){const t=g.tiles[(p.pos+n)%40];if(t.price>0&&!t.ownerId){candidate=(p.pos+n)%40;break;}}
    if(candidate===null){for(let n=1;n<40;n++){const t=g.tiles[(p.pos+n)%40];if(t.price>0&&t.ownerId!==p.id&&!t.mortgage){candidate=(p.pos+n)%40;break;}}}
    if(candidate!==null){const onward=(candidate-p.pos+40)%40;move(g,p,onward);log(g,'portal',`M1 перенёс ${p.name} на ${g.tiles[candidate].name}`,{playerId:p.id,tile:candidate});}
   }
   land(g,p);
  }
  break;
 }
 case 'BUS_SELECT':{
  only();if(g.phase!=='bus'||!g.pendingRoll)throw Error('Автобус сейчас не доступен');const i=Number(args.choice);if(![0,1,2].includes(i))throw Error('Неверный маршрут');const pending=g.pendingRoll;const moved=move(g,p,pending.options[i]);g.pendingRoll=null;g.phase='end';log(g,'bus',`${p.name}: автобус — ${moved.steps} клеток`,{playerId:p.id,...moved});land(g,p);break;
 }
 case 'BUY':{
  only();if(g.phase!=='decision')throw Error('Сейчас нельзя купить улицу');const t=g.tiles[p.pos];if(t.ownerId||!t.price||p.cash<t.price)throw Error('Покупка недоступна');p.cash-=t.price;t.ownerId=p.id;g.phase='end';log(g,'buy',`${p.name} купил ${t.name} за ${coins(t.price)}`,{tile:t.id,playerId:p.id});break;
 }
 case 'SKIP':only();if(g.phase!=='decision')throw Error('Нет ожидающей покупки');g.phase='end';log(g,'tile',`${p.name} отказался от покупки`);break;
 case 'END':only();if(g.phase!=='end')throw Error('Нельзя завершить ход сейчас');nextPlayer(g);break;
 case 'UPGRADE':{
  only();const t=tile();if(t.ownerId!==p.id||t.mortgage||t.level>=5)throw Error('Улучшение недоступно');const cost=buildingCost(t);if(p.cash<cost)throw Error('Не хватает денег');p.cash-=cost;t.level++;log(g,'build',`${p.name} построил ${t.level===5?'небоскрёб':'здание'} на ${t.name} · уровень ${t.level}`,{tile:t.id,playerId:p.id,level:t.level});break;
 }
 case 'MORTGAGE':{
  only();const t=tile();if(t.ownerId!==p.id||t.mortgage)throw Error('Улицу нельзя заложить');t.mortgage=true;t.mortgageDueRound=MODES[g.mode].mortgageRounds==null?null:(g.round||1)+MODES[g.mode].mortgageRounds;p.cash+=Math.round(t.price*.55);log(g,'money',`${p.name} заложил ${t.name}`,{tile:t.id,playerId:p.id,amount:Math.round(t.price*.55)});break;
 }
 case 'UNMORTGAGE':{
  only();const t=tile(),cost=Math.round(t.price*.65);if(t.ownerId!==p.id||!t.mortgage||p.cash<cost)throw Error('Не удалось выкупить улицу');p.cash-=cost;t.mortgage=false;t.mortgageDueRound=null;log(g,'buy',`${p.name} выкупил ${t.name}`,{tile:t.id,playerId:p.id});break;
 }
 case 'SELL':{
  only();const t=tile();if(t.ownerId!==p.id)throw Error('Улица тебе не принадлежит');const buildValue=Array.from({length:t.level},(_,i)=>buildingCost({...t,level:i})).reduce((a,b)=>a+b,0);const proceeds=Math.round(t.price*.7+buildValue*(g.mode==='layout'?.75:1));t.ownerId=null;t.level=0;t.buffs=[];t.mortgage=false;t.mortgageDueRound=null;p.cash+=proceeds;log(g,'sell',`${p.name} продал ${t.name} за ${coins(proceeds)}`,{tile:t.id,playerId:p.id});break;
 }
 case 'LOAN':{
  only();const amount=Number(args.amount);if(![1000,2000,3000].includes(amount))throw Error('Некорректная сумма');const debt=p.loans.reduce((s,x)=>s+x.due,0);if(debt+Math.round(amount*1.15)>7000)throw Error('Лимит кредитов — 7000k с процентами');p.cash+=amount;p.loans.push({amount,due:Math.round(amount*1.15),left:7});log(g,'loan',`${p.name} получил кредит ${coins(amount)} · срок 7 своих ходов`,{amount,playerId:p.id});break;
 }
 case 'REPAY':{
  only();const index=Number(args.index),l=p.loans[index];if(!l)throw Error('Кредит не найден');if(p.cash<l.due)throw Error('Не хватает денег');p.cash-=l.due;p.loans.splice(index,1);log(g,'loan',`${p.name} погасил кредит ${coins(l.due)}`,{playerId:p.id});break;
 }
 case 'OPEN_CASE':{
  only();if(p.cases<1)throw Error('Кейсов пока нет');p.cases--;let r=rnd(100),buff=BUFFS.find(b=>{r-=b.weight;return r<0;})||BUFFS[0];const reward={id:'b'+g.seq+'_'+rnd(999999),value:buff.value,rarity:buff.rarity};p.inventory.push(reward);log(g,'open',`${p.name} открыл кейс: баф +${buff.value}% (${buff.rarity})`,{playerId:p.id,buff:reward});break;
 }
 case 'APPLY_BUFF':{
  only();const t=tile();if(t.ownerId!==p.id||t.mortgage)throw Error('Выбери свою незаложенную улицу');if(t.buffs.length>=2)throw Error('Максимум 2 бафа на улицу');const i=p.inventory.findIndex(b=>b.id===String(args.buffId));if(i<0)throw Error('Баф не найден');const b=p.inventory.splice(i,1)[0];t.buffs.push(b);log(g,'buff',`${p.name} усилил ${t.name} на +${b.value}%`,{tile:t.id,playerId:p.id,buff:b});break;
 }
 case 'OFFER':{
  only();const to=g.players.find(x=>x.id===String(args.to));const give=g.tiles[Number(args.give)];const get=g.tiles[Number(args.get)];const cash=Number(args.cash)||0;if(!to||to.id===p.id||to.bot||to.bankrupt||!give||give.ownerId!==p.id||!get||get.ownerId!==to.id||!Number.isFinite(cash)||cash<0||p.cash<cash)throw Error('Обмен недоступен');g.offer={from:p.id,to:to.id,give:give.id,get:get.id,cash};log(g,'trade',`${p.name} предложил обмен игроку ${to.name}`,{playerId:p.id});break;
 }
 case 'ACCEPT':{
  if(!g.offer||g.offer.to!==p.id)throw Error('Нет предложения');const o=g.offer,sender=g.players.find(x=>x.id===o.from),a=g.tiles[o.give],b=g.tiles[o.get];if(!sender||a.ownerId!==sender.id||b.ownerId!==p.id||sender.cash<o.cash){g.offer=null;throw Error('Сделка устарела');}a.ownerId=p.id;b.ownerId=sender.id;sender.cash-=o.cash;p.cash+=o.cash;g.offer=null;log(g,'trade',`${p.name} и ${sender.name} обменялись улицами`,{tile:a.id});break;
 }
 case 'DECLINE':if(!g.offer||g.offer.to!==p.id)throw Error('Нет предложения');g.offer=null;log(g,'trade',`${p.name} отказался от обмена`);break;
 default:throw Error('Неизвестное действие');
 }
 finalize(g);return g;
}
function botTurn(g){if(!g||g.finished)return false;const p=current(g);if(!p.bot)return false;
 try{
  if(g.phase==='roll')act(g,p.id,'ROLL');
  if(g.phase==='bus')act(g,p.id,'BUS_SELECT',{choice:2});
  if(g.phase==='decision'){const t=g.tiles[p.pos];act(g,p.id,p.cash-t.price>3500?'BUY':'SKIP');}
  if(g.phase==='end'&&!p.bankrupt){
   if(p.cases>0&&rnd(4)===0)act(g,p.id,'OPEN_CASE');
   const t=owned(g,p).find(x=>x.level<3&&!x.mortgage&&p.cash>buildingCost(x)+4000);if(t&&rnd(3)===0)act(g,p.id,'UPGRADE',{tile:t.id});
   const b=p.inventory[0],bt=owned(g,p).find(x=>!x.mortgage&&x.buffs.length<2);if(b&&bt)act(g,p.id,'APPLY_BUFF',{tile:bt.id,buffId:b.id});
   act(g,p.id,'END');
  }
 }catch(e){if(g.phase==='decision')g.phase='end';if(g.phase==='bus')g.phase='end';if(g.phase==='end')nextPlayer(g);}return true;
}
return {MODES,defs,COLORS,BUFFS,create,act,botTurn,current,owned,rent,buildingCost,coins,netWorth,mortgageRemaining};
});
