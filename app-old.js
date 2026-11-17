(function(){
'use strict';
const E=window.AuroraEngine,$=s=>document.querySelector(s),app=$('#app'),fx=$('#fx-layer');
const state={view:'home',name:'',mode:'classic',botCount:2,roomBots:null,game:null,meId:'me',room:null,ws:null,connected:false,transport:'none',online:false,modal:null,tile:0,selectedBuff:null,tradeTo:'',tradeGive:'',tradeGet:'',tradeCash:0,animating:false,caseAnimation:false,sound:false,vibration:true,reduced:false,lastSeq:0};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const h=(str)=>esc(str);const C=n=>E.coins(n);const mine=()=>state.game?.players.find(p=>p.id===state.meId);const turn=()=>state.game&&E.current(state.game);const isMyTurn=()=>turn()?.id===state.meId;const onboard=()=>state.online&&state.room;
const mem=(key,value)=>{try{if(value===undefined)return localStorage.getItem(key);localStorage.setItem(key,value);}catch{return null;}};
state.name=mem('aurora_name')||'';state.sound=mem('aurora_sound')==='yes';state.vibration=mem('aurora_vibration')!=='no';state.reduced=mem('aurora_reduced')==='yes';
const queryRoom=new URLSearchParams(location.search).get('room');
let pendingRoom=queryRoom&&/^\d{5}$/.test(queryRoom)?queryRoom:'';
let hasSaved=false;try{hasSaved=!!JSON.parse(mem('aurora_local')||'null')?.game?.players;}catch{}
function toast(message){const el=document.createElement('div');let wrap=$('.toast-stack');if(!wrap){wrap=document.createElement('div');wrap.className='toast-stack';document.body.appendChild(wrap);}el.className='toast';el.textContent=message;wrap.prepend(el);setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300);},3100);}
function vibrate(ms=35){if(state.vibration&&navigator.vibrate)navigator.vibrate(ms);}
function ping(high=false){if(!state.sound)return;try{let AC=window.AudioContext||window.webkitAudioContext;const ctx=new AC(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(high?740:470,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(high?1030:320,ctx.currentTime+.13);gain.gain.setValueAtTime(.055,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.18);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.18);osc.onended=()=>ctx.close();}catch{}}
function readName(){let el=$('#playerName');let name=(el?.value||state.name||'Игрок').trim().slice(0,20)||'Игрок';state.name=name;mem('aurora_name',name);return name;}
function cardMode(key){let m=E.MODES[key];return `<button type="button" class="mode-item ${state.mode===key?'selected':''}" data-action="mode" data-mode="${key}"><span class="mode-icon">${m.icon}</span><div class="mode-title">${m.label}</div><div class="mode-detail">${m.detail}</div></button>`;}
function header(){let p=mine(),money=p?`<span class="coin-pill">🪙 <b>${C(p.cash)}</b></span>`:'';return `<header class="topbar"><div><div class="logo">✦ Aurora City</div><div class="brand-sub">город твоих правил</div></div><div class="flex">${money}<button class="icon-btn" data-action="settings" aria-label="Настройки">☰</button></div></header>`;}
function home(){return `<main class="app-shell">${header()}<section class="intro"><div class="eyebrow">Приватная экономическая игра</div><h1>Собери свой город.<br>Забери всё.</h1><p>Улицы, кубики, бесплатные кейсы, улучшения и кредиты. Играйте с друзьями и ботами одновременно — с разных телефонов.</p><div class="intro-glow"><span class="orbit-ring"></span><span class="intro-die">🎲</span></div></section><section class="home-panel"><label class="input-label" for="playerName">Как тебя зовут в игре?</label><input id="playerName" maxlength="20" placeholder="Твой ник" value="${h(state.name)}"><div class="section-head"><h2 class="section-title">Выбери режим</h2><span class="tag">5 режимов</span></div><div class="mode-grid">${Object.keys(E.MODES).map(cardMode).join('')}</div><label class="input-label" for="botCount">Количество соперников-ботов</label><select id="botCount" ${E.MODES[state.mode].min===E.MODES[state.mode].max?'disabled':''}><option value="1" ${state.botCount===1?'selected':''}>1 бот</option><option value="2" ${state.botCount===2||E.MODES[state.mode].min===3?'selected':''}>2 бота</option><option value="3" ${state.botCount===3?'selected':''}>3 бота</option><option value="4" ${state.botCount===4?'selected':''}>4 бота</option></select>${E.MODES[state.mode].min===3?'<div class="tip">В этом режиме играют ровно трое. Для игры с ботами добавлю двух соперников. В комнате нужен третий участник или бот.</div>':''}<div class="btn-row"><button class="btn primary" data-action="start-local">🎮 Играть с ботами</button><button class="btn gold-btn" data-action="create-room">👥 С друзьями и ботами</button></div>${hasSaved?'<button class="btn ghost full" data-action="continue">↩ Продолжить сохранённую партию</button>':''}<div class="divider-text">Есть код комнаты?</div><div class="flex"><input id="roomCode" inputmode="numeric" maxlength="5" placeholder="Код из 5 цифр" value="${h(pendingRoom)}"><button class="btn sm" data-action="join-room">Войти</button></div><div class="tip">💜 Создай приватную комнату и поделись ссылкой с друзьями. Для сетевой игры сайт должен быть размещён на сервере.</div></section></main>`;}
function lobby(){
 const r=state.room, rules=E.MODES[r.mode], humans=r.players.filter(p=>!p.bot).length;
 const capacity=Math.max(0,rules.max-humans), required=Math.max(0,rules.min-humans);
 if(state.roomBots===null)state.roomBots=required;
 state.roomBots=Math.max(0,Math.min(state.roomBots,capacity));
 const total=humans+state.roomBots,canStart=total>=rules.min&&total<=rules.max;
 const botsSelect=Array.from({length:capacity+1},(_,n)=>`<option value="${n}" ${state.roomBots===n?'selected':''}>${n} ${n===1?'бот':n>=2&&n<=4?'бота':'ботов'}</option>`).join('');
 return `<main class="app-shell">${header()}<div class="intro" style="padding-top:24px"><div class="eyebrow">Приватная комната</div><h1>Собираем компанию</h1><p>Пригласи друзей по ссылке и добавь ботов в эту же партию. С друзьями и ботами можно играть одновременно.</p></div><section class="home-panel"><div class="small" style="text-align:center">КОД КОМНАТЫ</div><div class="room-code">${h(r.code)}</div><button class="btn full gold-btn" data-action="copy-link">🔗 Скопировать приглашение</button><div class="section-head"><h2 class="section-title">Люди ${humans}/${rules.max}</h2><span class="tag">${rules.label}</span></div>${r.players.map(p=>`<div class="lobby-user"><span class="avatar">${p.avatar}</span><strong class="name">${h(p.name)}</strong><span class="tag">${p.bot?'Бот':p.id===r.host?'Создатель':p.connected?'В сети':'Отключён'}</span></div>`).join('')} ${r.host===state.meId?`<label class="input-label" for="roomBots" style="margin-top:16px">🤖 Сколько ботов добавить к друзьям?</label><select id="roomBots">${botsSelect}</select><div class="room-count">В партии: <strong>${humans} ${humans===1?'человек':'чел.'} + ${state.roomBots} ${state.roomBots===1?'бот':'ботов'} = ${total} игрока(ов)</strong></div><div class="tip">${canStart?'Можно начинать. Боты будут ходить автоматически после игроков.':`Для режима «${rules.label}» нужно ${rules.min===rules.max?rules.min:`от ${rules.min} до ${rules.max}`} участников. Добавь ботов или пригласи друзей.`}</div><button class="btn primary full" data-action="start-room" ${canStart?'':'disabled'}>✨ Начать игру вместе</button>`:`<div class="tip">Создатель комнаты выберет количество ботов и начнёт партию. Все игроки будут на одном поле.</div><div class="small" style="text-align:center;padding:15px">Ожидаем начала партии…</div>`}<button class="btn ghost full" style="margin-top:8px" data-action="home">← В меню</button></section></main>`;
}
function boardTile(t){let i=t.id,row,col;if(i<=10){row=1;col=i+1;}else if(i<=20){row=i-9;col=11;}else if(i<=30){row=11;col=31-i;}else{row=41-i;col=1;}
 const special=t.price===0;let owners=state.game.players.filter(p=>!p.bankrupt&&p.pos===i);const owner=state.game.players.find(p=>p.id===t.ownerId);return `<button type="button" class="tile ${special?'special-tile':''} ${[0,10,20,30].includes(i)?'corner':''} ${t.ownerId?'own':''} ${state.game.phase==='decision'&&state.game.players[state.game.active].pos===i?'glowing':''}" style="grid-row:${row};grid-column:${col};--tile-color:${t.color};--owner-color:${owner?.color||'#fff'}" data-action="tile" data-tile="${i}" title="${h(t.name)} — ${C(t.price)}"><span class="bar"></span><span class="t-symbol">${t.symbol}</span><span class="t-short">${h(shortTile(t))}</span>${t.price?`<span class="t-cost">${C(t.price)}</span>`:''}${owner?'<span class="owner-dot"></span>':''}${t.level?`<span class="build-dots">${Array.from({length:t.level},()=>'<i></i>').join('')}</span>`:''}${t.buffs.length?'<span class="buff-indicator">✨</span>':''}${owners.length?`<span class="tokens">${owners.map(p=>`<span class="mini-token" title="${h(p.name)}">${p.avatar}</span>`).join('')}</span>`:''}${t.mortgage?`<span class="mort-icon" title="Залог">🔒${E.mortgageRemaining(state.game,t)===null?'':' '+E.mortgageRemaining(state.game,t)}</span>`:''}</button>`;}
function game(){let g=state.game,p=mine(),cp=turn(),isTurn=isMyTurn(),tile=g.tiles[cp.pos];let tiles=g.tiles.map(boardTile).join('');let status=(g.finished?'Партия закончена':g.phase==='roll'?`Ходит ${cp.name}`:g.phase==='decision'?`Покупка: ${tile.name}`:g.phase==='bus'?`Автобус: ${cp.name} выбирает маршрут`:`${cp.name} завершает ход`);let rollText=(!isTurn?'Ждём ход':g.phase==='roll'?'Бросить':g.phase==='decision'?'Купить':g.phase==='bus'?'Маршрут':g.phase==='end'?'Завершить':'Готово');let rollAction=(!isTurn?'none':g.phase==='roll'?'roll':g.phase==='decision'?'buy':g.phase==='bus'?'none':'end');let actionDisabled=!isTurn||state.animating||g.finished||g.phase==='bus';
 return `<main class="app-shell">${header()}<div class="game-controls"><span class="tag">${E.MODES[g.mode].icon} ${E.MODES[g.mode].label}</span><span class="status-line">Раунд · ${g.round||1}</span>${onboard()?`<button class="btn ghost" data-action="share">🔗 Код ${state.room.code}</button>`:'<button class="btn ghost" data-action="home-ask">🏠 Меню</button>'}</div><div class="player-row">${g.players.map(x=>`<div class="player-card ${cp.id===x.id?'active':''} ${x.bankrupt?'dead':''}" style="border-bottom:2px solid ${x.color}"><div class="avatar">${x.avatar}</div><div><div class="p-name">${h(x.name)} ${x.id===state.meId?'· ты':''}</div><div class="p-cash">${C(x.cash)}</div></div></div>`).join('')}</div><div class="board-wrap"><div class="board-frame"><div class="board">${tiles}<div class="board-center"><div class="city-lines"></div><div class="center-star"></div><div class="center-content"><span class="subtitle">Город твоих правил</span><div class="city-logo">Aurora City</div><div class="dice-emoji">🎲</div><div class="center-status">${h(status)}</div></div></div></div></div></div><div class="status-row"><div><div class="status-title">📍 ${h(cp.name)}</div><div class="status-value">${h(tile.name)}</div></div><div><div class="status-title">🪙 Касса ${h(p?.name||'')}</div><div class="status-value gold">${C(p?.cash)}</div></div><div><div class="status-title">🎁 Бесплатные кейсы</div><div class="status-value">${p?.cases??0} шт.</div></div></div><div class="action-row"><button class="btn" data-action="inventory"><span class="em">🎁</span>Кейсы</button><button class="btn" data-action="bank"><span class="em">🏦</span>Банк</button><button class="btn main ${g.phase==='end'?'turn-end':''}" data-action="${rollAction}" ${actionDisabled?'disabled':''}><span class="em">${g.phase==='end'?'✓':g.phase==='decision'?'🏙️':'🎲'}</span>${rollText}</button><button class="btn" data-action="properties"><span class="em">🏘️</span>Улицы</button><button class="btn" data-action="trade"><span class="em">🤝</span>Обмен</button></div>${g.phase==='bus'&&isTurn?`<div class="tip" style="max-width:690px;margin:10px auto;text-align:center">🚌 ВЫБЕРИ МАРШРУТ АВТОБУСА<div class="btn-row" style="margin-top:9px">${g.pendingRoll.options.map((steps,i)=>`<button class="btn primary" data-action="bus-select" data-choice="${i}" ${state.animating?'disabled':''}>${steps} клеток</button>`).join('')}</div></div>`:''}${g.phase==='decision'&&isTurn?`<div class="btn-row" style="max-width:690px;margin:10px auto"><button class="btn gold-btn" data-action="buy">Купить ${h(tile.name)} · ${C(tile.price)}</button><button class="btn ghost" data-action="skip">Пропустить</button></div>`:''}${g.offer&&g.offer.to===state.meId?`<div class="tip" style="max-width:690px;margin:10px auto"><b>🤝 ${h(g.players.find(x=>x.id===g.offer.from)?.name)} предлагает обмен:</b><br>${h(g.tiles[g.offer.give].name)} ↔ ${h(g.tiles[g.offer.get].name)} ${g.offer.cash?'и '+C(g.offer.cash):''}<div class="btn-row"><button class="btn primary" data-action="accept-trade">Принять</button><button class="btn ghost" data-action="decline-trade">Отказаться</button></div></div>`:''}<div class="feed"><div class="feed-title"><b>✨ События города</b><button class="btn ghost sm" data-action="help">Правила</button></div>${g.events.slice(-4).reverse().map(e=>`<div class="feed-entry">${h(e.message)}</div>`).join('')}</div></main>`;
}
function modalShell(title,inner){return `<div class="overlay" data-action="close" id="modalOverlay"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-action="close" aria-label="Закрыть">×</button></div>${inner}</section></div>`;}
function propertyRow(t,btn='tile',extra='Подробнее'){return `<div class="property-entry"><div class="property-icon" style="--tile-color:${t.color}">${t.symbol}</div><div class="property-info"><b>${h(t.name)}</b><span class="small">${C(t.price)} · Доход ${C(E.rent(t))} · ${t.level?'🏙️ '+t.level+' ур.':'Без здания'} ${t.buffs.length?'✨ '+t.buffs.reduce((s,b)=>s+b.value,0)+'%':''}${t.mortgage?' · 🔒 '+(E.mortgageRemaining(state.game,t)===null?'Без срока':'Осталось '+E.mortgageRemaining(state.game,t)+' раунд.') : ''}</span></div><button class="btn sm ghost" data-action="${btn}" data-tile="${t.id}">${extra}</button></div>`;}
function tileModal(){let g=state.game,t=g.tiles[state.tile],owner=g.players.find(p=>p.id===t.ownerId),me=mine(),own=me?.id===t.ownerId,isTurn=isMyTurn();let inner=`<div class="data-panel" style="text-align:center;border-top:6px solid ${t.color}"><div style="font-size:50px">${t.symbol}</div><div class="big">${t.price?C(t.price):'Событие'}</div><div class="small">${owner?`Владелец: ${h(owner.name)}`:t.price?'Свободная недвижимость':'Специальная клетка'}</div></div>`;
 if(t.price){inner+=`<div class="data-grid"><div><div class="small">Аренда за посещение</div><strong>${C(E.rent(t))}</strong></div><div><div class="small">Строительство</div><strong>${t.level===5?'Максимум':C(E.buildingCost(t))}</strong></div><div><div class="small">Уровень зданий</div><strong>${t.level} из 5</strong></div><div><div class="small">Усиление улицы</div><strong>+${t.buffs.reduce((s,b)=>s+b.value,0)}%</strong></div></div>`;}
 if(t.mortgage){const remaining=E.mortgageRemaining(g,t);inner+=`<div class="tip">🔒 Улица заложена. ${remaining===null?'Срок выкупа не ограничен.':`Осталось ${remaining} раунд. до возврата банку.`} Выкуп: ${C(Math.round(t.price*.65))}.</div>`;}
 if(own&&isTurn){inner+=`<div class="tip">🏗️ Можно улучшать сразу после покупки. Собирать все улицы одной группы не нужно.</div><div class="btn-row"><button class="btn primary" data-action="upgrade" data-tile="${t.id}" ${t.level>=5||t.mortgage||me.cash<E.buildingCost(t)?'disabled':''}>🏗️ Улучшить</button>${t.mortgage?`<button class="btn ghost" data-action="unmortgage" data-tile="${t.id}">🔓 Выкупить</button>`:`<button class="btn ghost" data-action="mortgage" data-tile="${t.id}">🔒 Заложить</button>`}</div><button class="btn ghost full" data-action="sell" data-tile="${t.id}">Продать улицу банку</button>`;}
 if(!t.ownerId&&t.price&&isTurn&&g.phase==='decision'&&turn().pos===t.id){inner+=`<div class="btn-row"><button class="btn primary" data-action="buy">Купить</button><button class="btn ghost" data-action="skip">Пропустить</button></div>`;}
 return modalShell(h(t.name),inner);
}
function bankModal(){let p=mine();return modalShell('🏦 Городской банк',`<div class="data-panel"><div class="small">Твои деньги</div><div class="big">${C(p.cash)}</div><p class="small">Кредит можно взять во время своего хода. Комиссия 15%, срок — 7 твоих ходов.</p></div><h3>Взять кредит</h3><div class="btn-row">${[1000,2000,3000].map(x=>`<button class="btn sm gold-btn" data-action="loan" data-amount="${x}" ${!isMyTurn()?'disabled':''}>+${C(x)}</button>`).join('')}</div><h3>Активные кредиты</h3>${p.loans.length?p.loans.map((l,i)=>`<div class="property-entry"><div class="property-info"><b>Вернуть ${C(l.due)}</b><div class="small">Осталось ходов: ${l.left}</div></div><button class="btn sm ghost" data-action="repay" data-index="${i}" ${!isMyTurn()||p.cash<l.due?'disabled':''}>Погасить</button></div>`).join(''):'<p class="small">Сейчас кредитов нет.</p>'}<div class="tip">Если к сроку не хватит денег, банк продаст улицы для покрытия долга. Кредит доступен бесплатно всем игрокам.</div>`);}
function inventoryModal(){let p=mine(),ts=E.owned(state.game,p);let body=`<div class="case-display"><span class="case-art ${state.caseAnimation?'opening':''}">🎁</span></div><div class="small" style="text-align:center">Бесплатные кейсы: <b>${p.cases}</b></div><div class="btn-row"><button class="btn primary full" data-action="open-case" ${p.cases<=0||!isMyTurn()?'disabled':''}>✨ Открыть бесплатный кейс</button></div><div class="tip">Кейс даёт баф для одной улицы: +2,5%, +10%, +20%, +33% или +50% к доходу. Получай новые кейсы на бонусных клетках и каждые 4 своих хода.</div><div class="section-head"><h3>Карточки усиления (${p.inventory.length})</h3></div>`;
 if(!p.inventory.length)body+='<p class="small">Карточек пока нет. Открой кейс!</p>';else body+=p.inventory.map(b=>`<div class="buff-card"><div><div class="small">${h(b.rarity)}</div><div class="buff-number">+${b.value}%</div><div class="small">Доход выбранной улицы</div></div><div class="flex"><span class="buff-icon">✨</span><button class="btn sm primary" data-action="select-buff" data-buff="${h(b.id)}">Установить</button></div></div>`).join('');
 if(state.selectedBuff){let b=p.inventory.find(b=>b.id===state.selectedBuff);body+=`<h3>Выбери улицу для +${b?.value}%</h3>${ts.filter(t=>t.buffs.length<2).map(t=>propertyRow(t,'apply-buff','Усилить')).join('')||'<p class="small">Подходящих улиц нет.</p>'}`;}
 return modalShell('🎁 Кейсы и бафы',body);
}
function propertiesModal(){let p=mine(),ts=E.owned(state.game,p);return modalShell('🏘️ Моя недвижимость',`<div class="data-panel"><div class="small">Улиц в собственности</div><div class="big">${ts.length}</div><div class="small">Общий доход за посещение: ${C(ts.reduce((s,t)=>s+E.rent(t),0))}</div></div>${ts.map(t=>propertyRow(t)).join('')||'<p class="small">Купи первую улицу, когда фишка на неё попадёт.</p>'}`);}
function tradeModal(){let p=mine(),ours=E.owned(state.game,p),others=state.game.players.filter(x=>x.id!==p.id&&!x.bankrupt&&!x.bot);let target=state.tradeTo||others[0]?.id;let targetOwned=state.game.tiles.filter(t=>t.ownerId===target);let options=(arr,sel)=>arr.map(t=>`<option value="${t.id}" ${String(t.id)===String(sel)?'selected':''}>${h(t.name)}</option>`).join('');return modalShell('🤝 Обмен улицами',`<p class="small">Предложи другу обменять одну твою улицу на его улицу. Друг должен принять сделку.</p><label class="input-label">Кому</label><select id="tradeTo">${others.map(x=>`<option value="${h(x.id)}" ${x.id===target?'selected':''}>${h(x.name)}</option>`).join('')}</select><label class="input-label" style="margin-top:12px">Моя улица</label><select id="tradeGive">${options(ours,state.tradeGive)}</select><label class="input-label" style="margin-top:12px">Хочу получить</label><select id="tradeGet">${options(targetOwned,state.tradeGet)}</select><label class="input-label" style="margin-top:12px">Доплата с моей стороны (в k)</label><input id="tradeCash" type="number" min="0" step="100" value="${state.tradeCash||0}"><button class="btn primary full" style="margin-top:15px" data-action="offer" ${!isMyTurn()||!ours.length||!targetOwned.length?'disabled':''}>Отправить предложение</button>${!targetOwned.length?'<div class="tip">У выбранного игрока пока нет улиц.</div>':''}`);}
function settingsModal(){return modalShell('⚙️ Настройки',`<label class="check-list"><input type="checkbox" id="sound" ${state.sound?'checked':''}> 🔊 Звуковые эффекты</label><label class="check-list"><input type="checkbox" id="vibration" ${state.vibration?'checked':''}> 📳 Вибрация на телефоне</label><label class="check-list"><input type="checkbox" id="reduced" ${state.reduced?'checked':''}> 🌿 Упрощённые анимации</label><div class="tip">Музыку игра сама не включает. Эффекты можно отключить, чтобы играть под свои треки. Параметры сохраняются на этом устройстве.</div><button class="btn ghost full" style="margin-top:13px" data-action="help">❔ Как играть</button>`);}
function helpModal(){return modalShell('📖 Как играть',`<p>🎲 Бросай кубики и перемещай фишку. Свободные улицы можно покупать, с чужих улиц списывается аренда.</p><p>🏗️ Улучшай любую купленную улицу сразу, даже если остальные улицы её цветовой группы тебе не принадлежат. Максимум — пять уровней зданий. Каждое улучшение повышает аренду; заложенные улицы улучшать нельзя.</p><p>🎁 Бесплатные кейсы попадаются на бонусных клетках и за активность. Карточки из кейсов увеличивают доход выбранных улиц.</p><p>🏦 Банк выдаёт кредиты с комиссией 15% на семь твоих ходов. Кредит можно погасить заранее.</p><p>🔒 Залог улицы даёт 55% стоимости, выкуп — 65%. В обычной игре срок выкупа 15 раундов, в «Перестановке 3» — 7. Если срок вышел, улица возвращается банку. В ретро, быстрой игре и «Раскладе» пока нет ограничения по сроку. Один раунд — полный круг ходов всех игроков.</p><p>👥 В игре с друзьями ход, покупки, деньги и обмены синхронизируются через сервер. Нет рейтинга или случайных соперников.</p><p class="small">Режимы: Обычная — 2 кубика; Быстрая — 3-й особый кубик и больше стартовых денег; Ретро — 2 кубика, уменьшены стартовые деньги и зарплата; Расклад — 3 игрока, все улицы случайно розданы; Перестановка 3 — 3 игрока, перетасованы клетки поля.</p><p class="small">Правила адаптированы для Aurora City, поэтому могут отличаться от Monopoly One. Всё бесплатно и без рейтингов.</p>`);}
function shareModal(){return modalShell('🔗 Пригласи друзей',`<div class="room-code">${state.room.code}</div><p class="small">Отправь код комнаты или ссылку. Для входа друзья должны открыть адрес работающего сервера.</p><button class="btn primary full" data-action="copy-link">Скопировать ссылку</button>`);}
function render(){if(state.view==='home')app.innerHTML=home();else if(state.view==='lobby'&&state.room)app.innerHTML=lobby();else if(state.view==='game'&&state.game)app.innerHTML=game();else app.innerHTML=home();if(state.modal){let body={tile:tileModal,bank:bankModal,inventory:inventoryModal,properties:propertiesModal,trade:tradeModal,settings:settingsModal,help:helpModal,share:shareModal};if(body[state.modal])app.insertAdjacentHTML('beforeend',body[state.modal]());}}
function saveLocal(){if(!state.online&&state.game)mem('aurora_local',JSON.stringify({game:state.game,meId:state.meId}));}
function setGame(g,opts={}){let old=state.lastSeq;let first=!state.game||opts.first;state.game=g;state.view='game';state.lastSeq=g.seq;saveLocal();if(first){render();return;}let ev=g.events.filter(e=>e.seq>old);if(ev.some(e=>e.kind==='roll')&&!state.reduced)state.animating=true;render();if(ev.length)animateEvents(ev);}
function animateEvents(events){if(state.reduced){state.animating=false;render();for(const e of events)if(['open','build','buff','buy','loan'].includes(e.kind))toast(e.message);return;}
 let dice=events.find(e=>e.kind==='roll');if(dice){rollFx(dice);}
 for(let e of events){if(e.kind==='roll')continue;const delay=dice?1200:80;setTimeout(()=>{
  if(e.kind==='build')buildingFx(e.tile,e.level);
  else if(e.kind==='buy')moneyFx(e.tile,12);
  else if(e.kind==='sell')sellFx(e.tile);
  else if(e.kind==='trade')tradeFx();
  else if(e.kind==='lose')lossFx();
  else if(e.kind==='open')caseFx(e.buff?.value);
  else if(e.kind==='buff')buffFx(e.tile,e.buff?.value);
  else if(e.kind==='money'||e.kind==='rent'||e.kind==='loan')floatingFx(e);
  else if(e.kind==='portal')sparkAtTile(e.tile,20,'#c58cff');
  else if(e.kind==='bus')trail(e);
  else if(e.kind==='case')caseFx();
  else if(e.kind==='win')victoryFx();
  if(['buy','build','open','buff','loan','win','trade'].includes(e.kind)){toast(e.message);if(e.kind!=='trade')ping(true);}
 },delay);
 }
}
function coordsTile(id){let el=$(`.tile[data-tile="${id}"]`);if(!el)return {x:innerWidth/2,y:innerHeight/2};let r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}
function addFx(cls,html,style={},duration=1600){let x=document.createElement('div');x.className=cls;x.innerHTML=html;Object.assign(x.style,style);fx.append(x);setTimeout(()=>x.remove(),duration);return x;}
function spark(x,y,count=14,color='#e7b0ff'){for(let i=0;i<count;i++){let a=Math.PI*2*i/count,r=42+Math.random()*78;addFx('spark','',{left:x+'px',top:y+'px','--spark-color':color,'--tx':Math.cos(a)*r+'px','--ty':Math.sin(a)*r+'px'},850);}}
function sparkAtTile(id,count=16,color){let p=coordsTile(id);spark(p.x,p.y,count,color);}
function moneyFx(tileId,count=10){let p=coordsTile(tileId);spark(p.x,p.y,15,'#ffd9a4');for(let i=0;i<count;i++){let a=Math.random()*Math.PI*2,r=70+Math.random()*85;addFx('coin-fx','₭',{left:p.x+'px',top:p.y+'px','--tx':Math.cos(a)*r+'px','--ty':Math.sin(a)*r+'px'},1250);}vibrate(50);}
function buildingFx(id,level){let p=coordsTile(id);addFx('build-fx',level>=5?'🌆':'🏢',{left:p.x+'px',top:p.y+'px'},1250);spark(p.x,p.y,19,'#f3ce81');vibrate(70);}
function buffFx(id,v){let p=coordsTile(id);addFx('buff-fx',`✨${v?'<small>+'+v+'%</small>':''}`,{left:p.x+'px',top:p.y+'px'},1650);spark(p.x,p.y,22,'#dd99ff');vibrate([60,35,60]);}
function sellFx(id){let p=coordsTile(id);addFx('build-fx','💰',{left:p.x+'px',top:p.y+'px'},1150);moneyFx(id,7);}
function tradeFx(){let x=innerWidth/2,y=innerHeight*.45;addFx('trade-fx','🤝',{left:x+'px',top:y+'px'},1650);spark(x,y,28,'#ffe2ba');vibrate([40,20,40]);}
function lossFx(){let x=innerWidth/2,y=innerHeight*.45;addFx('trade-fx','💔',{left:x+'px',top:y+'px'},1700);spark(x,y,16,'#ff7598');vibrate(90);}
function victoryFx(){let x=innerWidth/2,y=innerHeight*.37;addFx('victory-fx','🏆<span>ПОБЕДА!</span>',{},2250);for(let i=0;i<5;i++)setTimeout(()=>spark(x+(Math.random()-.5)*innerWidth*.6,y+(Math.random()-.5)*180,23,'#ffdb8a'),i*200);vibrate([70,35,70,35,100]);}

function caseFx(value){const x=innerWidth/2,y=innerHeight*.44;addFx('case-halo','',{},1300);addFx('case-fx',value?'🎴':'🎁',{},1450);spark(x,y,32,'#f3beff');vibrate([60,40,80]);}
function floatingFx(e){const p=e.tile!==undefined?coordsTile(e.tile):{x:innerWidth/2,y:innerHeight*.44};const v=e.amount;addFx('floating-text',e.kind==='loan'?'🏦 Кредит':(typeof v==='number'?(v>0?'+':'')+C(v):'🪙'),{left:p.x+'px',top:p.y+'px'},1700);if(e.kind==='rent')spark(p.x,p.y,8,'#f4c384');}
function faces(n){if(typeof n==='string')return Array.from({length:6},(_,j)=>`<div class="die-face face-${j+1} special-die">${n==='BUS'?'🚌':'M1'}</div>`).join('');const coords={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};return `<div class="die-face face-${n}">${Array.from({length:9},(_,i)=>coords[n].includes(i+1)?'<span class="pip"></span>':'<span></span>').join('')}</div>`;}
function rollFx(e){ping();vibrate([30,20,40]);const dice=e.dice||[1,1],container=addFx('fx-dice-screen',`<div class="fx-dice-head">🎲 Бросок кубиков</div><div class="fx-dice-row">${dice.map((n,i)=>`<div class="dice-unit spin" data-dice="${i}" style="animation-delay:${i*0.06}s">${typeof n==='string'?faces(n):Array.from({length:6},(_,j)=>faces(j+1)).join('')}</div>`).join('')}</div><div class="roll-result" style="opacity:0">${dice.join(' + ')} = ${e.steps}</div>`,{},1800);
 const angles={1:'rotateX(0deg) rotateY(0deg)',2:'rotateY(180deg)',3:'rotateY(-90deg)',4:'rotateY(90deg)',5:'rotateX(-90deg)',6:'rotateX(90deg)'};
 setTimeout(()=>{container.querySelectorAll('.dice-unit').forEach((el,i)=>{el.classList.remove('spin');el.style.transform=angles[dice[i]]||'rotateX(0deg) rotateY(0deg)';});let r=container.querySelector('.roll-result');r.style.opacity='1';r.style.animation='scalePop .35s';ping(true);vibrate(60);},900);
 if(e.steps>0)setTimeout(()=>trail(e),1080);setTimeout(()=>{state.animating=false;render();},1830);
}
function trail(e){const start=e.from,steps=e.steps,count=Math.min(steps,20);let idx=0;const origin=coordsTile(start);if(!steps)return;let token=addFx('trail-token',state.game.players.find(p=>p.id===e.playerId)?.avatar||'🌟',{left:origin.x+'px',top:origin.y+'px'},count*63+150);let clock=setInterval(()=>{idx++;let p=coordsTile((start+idx)%40);token.style.left=p.x-9+'px';token.style.top=p.y-9+'px';if(idx>=count){clearInterval(clock);spark(p.x,p.y,10,'#d99cff');}},63);}
function openModal(which){state.modal=which;render();}
function localStart(){const name=readName(),mode=E.MODES[state.mode],n=mode.min===mode.max?mode.min-1:state.botCount,players=[{id:'me',name,avatar:'🌙',bot:false},...Array.from({length:n},(_,i)=>({id:'bot'+(i+1),name:['Алина','Даня','Саша','Мира'][i],avatar:['🦊','🐼','🐱','🌸'][i],bot:true}))];state.online=false;state.room=null;state.meId='me';state.modal=null;state.lastSeq=0;setGame(E.create(players,state.mode),{first:true});toast('🎉 Партия началась! Ты ходишь первой.');}
function apply(action,args={}){if(state.animating)return;if(state.online){if(!state.connected){toast('Нет соединения с сервером');return;}send({type:'ACT',action,args});return;}try{E.act(state.game,state.meId,action,args);setGame(state.game);if(['END','SKIP','BUY'].includes(action))scheduleBots();}catch(e){toast(e.message);}}
let botTimer=0;
function scheduleBots(){clearTimeout(botTimer);if(!state.game||state.online)return;if(turn().bot){botTimer=setTimeout(()=>{if(!state.game||!turn().bot||state.game.finished)return;E.botTurn(state.game);setGame(state.game);if(turn().bot)scheduleBots();},state.animating?2100:950);}}
function receiveNetwork(msg){
 if(msg.type==='ERROR'){toast(msg.message);return;}
 if(msg.type==='INVALID_SESSION'){mem('aurora_online','');state.online=false;state.room=null;state.meId='me';state.view='home';state.game=null;render();return;}
 if(msg.type==='IDENTITY'){state.meId=msg.id;state.online=true;mem('aurora_online',JSON.stringify({code:msg.code,id:msg.id,token:msg.token}));}
 if(msg.type==='ROOM'){
  // Polling must not redraw the screen when nothing has changed.
  if(state.room&&JSON.stringify(state.room)===JSON.stringify(msg.room))return;
  state.room=msg.room;state.online=true;
  if(msg.room.game){const first=!state.game||state.view!=='game';setGame(msg.room.game,{first});}
  else{state.game=null;state.view='lobby';render();}
 }
}
async function sendHttp(data){
 try{
  const saved=JSON.parse(mem('aurora_online')||'null');
  const r=await fetch('/api/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,_session:saved}),cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const output=await r.json();for(const msg of output.messages||[])receiveNetwork(msg);
  return true;
 }catch(e){toast('Ошибка подключения: '+e.message);return false;}
}
function send(data){
 if(state.transport==='ws'&&state.ws?.readyState===1){state.ws.send(JSON.stringify(data));return true;}
 if(state.transport==='http'&&state.connected){sendHttp(data);return true;}
 toast('Подключаемся к серверу. Попробуй ещё раз.');return false;
}
let reconnectTimer=0,startedHttp=false;
async function initHttp(){
 if(state.transport==='ws'||location.protocol==='file:')return;
 try{
  const r=await fetch('/healthz',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Сервер временно недоступен');
  if(state.transport==='ws')return;
  state.connected=true;state.transport='http';
  if(!startedHttp){startedHttp=true;setInterval(()=>{if(state.transport==='http'&&state.online&&mem('aurora_online'))sendHttp({type:'POLL'});},1400);}
  const saved=mem('aurora_online');if(saved){try{const o=JSON.parse(saved);if(!pendingRoom||pendingRoom===o.code)sendHttp({type:'RESUME'});}catch{}}
 }catch(e){if(state.transport!=='ws')state.connected=false;setTimeout(initHttp,6000);}
}
function connect(){
 if(location.protocol==='file:')return;
 if(state.ws&&(state.ws.readyState===0||state.ws.readyState===1))return;
 const protocol=location.protocol==='https:'?'wss:':'ws:';
 try{
  const ws=new WebSocket(protocol+'//'+location.host);state.ws=ws;
  let connectionTimer=setTimeout(()=>{if(ws.readyState!==1)initHttp();},2500);
  ws.onopen=()=>{
   clearTimeout(connectionTimer);state.connected=true;state.transport='ws';clearTimeout(reconnectTimer);
   const saved=mem('aurora_online');if(saved){try{const o=JSON.parse(saved);if(!pendingRoom||pendingRoom===o.code)send({type:'RESUME',code:o.code,id:o.id,token:o.token});}catch{}}
  };
  ws.onclose=()=>{clearTimeout(connectionTimer);if(state.ws!==ws)return;
   if(state.transport==='ws'){state.connected=false;state.transport='none';}
   initHttp();reconnectTimer=setTimeout(connect,8000);
  };
  ws.onerror=()=>{};
  ws.onmessage=e=>{let msg;try{msg=JSON.parse(e.data);}catch{return;}receiveNetwork(msg);};
 }catch{initHttp();}
}
function leaveToHome(){if(state.online){send({type:'LEAVE'});mem('aurora_online','');state.online=false;state.room=null;state.roomBots=null;state.meId='me';if(state.ws&&state.ws.readyState===1){state.ws.close();setTimeout(connect,300);}}state.game=null;state.view='home';state.modal=null;state.lastSeq=0;render();}
async function copyInvite(){const url=location.origin+location.pathname+'?room='+state.room.code;try{await navigator.clipboard.writeText(url);toast('Ссылка скопирована!');}catch{prompt('Скопируй приглашение:',url);}}
app.addEventListener('click',e=>{
 const target=e.target.closest('[data-action]');if(!target)return;const a=target.dataset.action;
 if(a==='close'&&e.target.closest('.modal')&&!e.target.closest('.icon-btn'))return;
 if(a==='mode'){readName();state.mode=target.dataset.mode;render();return;}
 if(a==='start-local'){localStart();return;}
 if(a==='continue'){try{const o=JSON.parse(mem('aurora_local'));state.online=false;state.room=null;state.meId=o.meId;state.lastSeq=0;setGame(o.game,{first:true});}catch{toast('Не удалось открыть сохранение');}return;}
 if(a==='create-room'||a==='join-room'){
  const name=readName();if(!state.connected){initHttp();toast('Подключаемся к игровому серверу — попробуй ещё раз');return;}if(a==='create-room'){state.roomBots=null;send({type:'CREATE',mode:state.mode,name});}else{const code=($('#roomCode')?.value||pendingRoom||'').trim();if(!/^\d{5}$/.test(code)){toast('Введи код из 5 цифр');return;}send({type:'JOIN',code,name});}return;
 }
 if(a==='start-room'){send({type:'START',botCount:Number($('#roomBots')?.value??state.roomBots??0)});return;}
 if(a==='copy-link'){copyInvite();return;}
 if(a==='home'){leaveToHome();return;}
 if(a==='home-ask'){if(confirm('Вернуться в меню? Текущая партия сохранена.')){state.view='home';state.game=null;state.lastSeq=0;hasSaved=true;render();}return;}
 if(a==='share'){openModal('share');return;}
 if(['inventory','bank','properties','trade','settings','help'].includes(a)){openModal(a);return;}
 if(a==='tile'){state.tile=Number(target.dataset.tile);openModal('tile');return;}
 if(a==='close'){state.modal=null;render();return;}
 if(a==='roll'){apply('ROLL');return;}
 if(a==='buy'){state.tile=turn().pos;state.modal='tile';apply('BUY');return;}
 if(a==='skip'){apply('SKIP');state.modal=null;render();return;}
 if(a==='end'){apply('END');return;}
 if(a==='bus-select'){apply('BUS_SELECT',{choice:Number(target.dataset.choice)});return;}
 if(['upgrade','mortgage','unmortgage','sell'].includes(a)){const actions={upgrade:'UPGRADE',mortgage:'MORTGAGE',unmortgage:'UNMORTGAGE',sell:'SELL'};if(a==='sell'&&!confirm('Продать эту улицу банку?'))return;apply(actions[a],{tile:Number(target.dataset.tile)});return;}
 if(a==='loan'){apply('LOAN',{amount:Number(target.dataset.amount)});return;}
 if(a==='repay'){apply('REPAY',{index:Number(target.dataset.index)});return;}
 if(a==='open-case'){apply('OPEN_CASE');return;}
 if(a==='select-buff'){state.selectedBuff=target.dataset.buff;render();return;}
 if(a==='apply-buff'){apply('APPLY_BUFF',{tile:Number(target.dataset.tile),buffId:state.selectedBuff});state.selectedBuff=null;return;}
 if(a==='offer'){apply('OFFER',{to:$('#tradeTo')?.value,give:Number($('#tradeGive')?.value),get:Number($('#tradeGet')?.value),cash:Number($('#tradeCash')?.value||0)});return;}
 if(a==='accept-trade'){apply('ACCEPT');return;}
 if(a==='decline-trade'){apply('DECLINE');return;}
});
app.addEventListener('change',e=>{const id=e.target.id;if(id==='botCount')state.botCount=Number(e.target.value);if(id==='roomBots')state.roomBots=Number(e.target.value);if(id==='tradeTo'){state.tradeTo=e.target.value;state.tradeGet='';render();}if(id==='sound'){state.sound=e.target.checked;mem('aurora_sound',state.sound?'yes':'no');}if(id==='vibration'){state.vibration=e.target.checked;mem('aurora_vibration',state.vibration?'yes':'no');}if(id==='reduced'){state.reduced=e.target.checked;mem('aurora_reduced',state.reduced?'yes':'no');}});
app.addEventListener('input',e=>{if(e.target?.id==='playerName'){state.name=e.target.value.slice(0,20);mem('aurora_name',state.name);}});
if(pendingRoom)toast('Введи ник и присоединяйся к комнате '+pendingRoom);
connect();render();
})();
