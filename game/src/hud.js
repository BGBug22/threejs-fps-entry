// The DOM HUD: crosshair, hit marker, health, armour, ammo, money, round timer,
// score, alive pips, kill feed, buy menu, banners and the overlays. It never touches
// the simulation; main.js pushes numbers in and reads callbacks out.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    overlay: $('overlay'),
    title: $('overlay-title'),
    copy: $('overlay-copy'),
    play: $('play'),
    ammoMag: $('ammo-mag'),
    ammoReserve: $('ammo-reserve'),
    ammo: $('ammo'),
    weaponName: $('weapon-name'),
    healthFill: $('health-fill'),
    healthNum: $('health-num'),
    armorNum: $('armor-num'),
    money: $('money-value'),
    timer: $('timer-value'),
    scoreEmber: $('score-ember'),
    scoreAshen: $('score-ashen'),
    roundLabel: $('round-label'),
    aliveEmber: $('alive-ember'),
    aliveAshen: $('alive-ashen'),
    killfeed: $('killfeed'),
    banner: $('banner'),
    bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'),
    hitmarker: $('hitmarker'),
    crosshair: $('crosshair'),
    buyMenu: $('buy-menu'),
    buyGrid: $('buy-grid'),
    buyMoney: $('buy-money'),
    plantBar: $('plant-bar'),
    plantFill: $('plant-fill'),
    plantLabel: $('plant-label'),
    damage: $('damage-flash'),
    spectate: $('spectate'),
    bombStatus: $('bomb-status'),
    keys: $('keys'),
  };
  let hitTimer = 0;
  let bannerTimer = 0;
  let last = { mag: -1, reserve: -1, hp: -1, armor: -1, money: -1, timer: '', score: '' };

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  return {
    setAmmo(mag, reserve, name) {
      if (mag === last.mag && reserve === last.reserve) return;
      last.mag = mag;
      last.reserve = reserve;
      els.ammoMag.textContent = String(mag);
      els.ammoReserve.textContent = `/ ${reserve}`;
      els.ammo.classList.toggle('empty', mag === 0);
      if (name) els.weaponName.textContent = name;
    },
    setHealth(hp, armor) {
      if (hp === last.hp && armor === last.armor) return;
      last.hp = hp;
      last.armor = armor;
      els.healthFill.style.width = `${Math.max(0, hp)}%`;
      els.healthFill.classList.toggle('low', hp <= 30);
      els.healthNum.textContent = String(Math.max(0, Math.ceil(hp)));
      els.armorNum.textContent = armor > 0 ? `+${Math.ceil(armor)}` : '';
    },
    setMoney(value) {
      if (value === last.money) return;
      last.money = value;
      els.money.textContent = `$${value}`;
      els.buyMoney.textContent = `$${value}`;
    },
    setTimer(seconds, phase) {
      const s = Math.max(0, Math.ceil(seconds));
      const text = phase === 'freeze' ? `BUY ${s}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (text === last.timer) return;
      last.timer = text;
      els.timer.textContent = text;
      els.timer.classList.toggle('urgent', phase === 'live' && s <= 15);
    },
    setScore(ember, ashen, round) {
      const text = `${ember}-${ashen}|${round}`;
      if (text === last.score) return;
      last.score = text;
      els.scoreEmber.textContent = String(ember);
      els.scoreAshen.textContent = String(ashen);
      els.roundLabel.textContent = `ROUND ${round}`;
    },
    setAlive(ember, ashen) {
      els.aliveEmber.textContent = '●'.repeat(ember) + '○'.repeat(Math.max(0, 5 - ember));
      els.aliveAshen.textContent = '●'.repeat(ashen) + '○'.repeat(Math.max(0, 5 - ashen));
    },
    setBombStatus(text) {
      els.bombStatus.textContent = text;
    },
    killfeed(killer, victim, headshot, killerTeam) {
      const row = document.createElement('div');
      row.className = 'feed-row';
      const k = document.createElement('span');
      k.className = killerTeam === 'ember' ? 'feed-ember' : 'feed-ashen';
      k.textContent = killer;
      const v = document.createElement('span');
      v.className = victim === 'You' ? 'feed-ember' : 'feed-ashen';
      v.textContent = victim;
      row.append(k, document.createTextNode(headshot ? ' ☠ ' : ' ✕ '), v);
      els.killfeed.prepend(row);
      while (els.killfeed.children.length > 5) els.killfeed.lastChild.remove();
      setTimeout(() => row.remove(), 7000);
    },
    hitMarker(killed, holdMs = 90) {
      els.hitmarker.classList.add('on');
      els.hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.3)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        els.hitmarker.classList.remove('on');
        els.hitmarker.style.transform = '';
      }, holdMs);
    },
    setCrosshairSpread(px) {
      els.crosshair.style.setProperty('--gap', `${px}px`);
    },
    damageFlash() {
      els.damage.style.opacity = '0.55';
      setTimeout(() => { els.damage.style.opacity = '0'; }, 140);
    },
    banner(title, sub, ms = 2600) {
      els.bannerTitle.textContent = title;
      els.bannerSub.textContent = sub;
      show(els.banner);
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => hide(els.banner), ms);
    },
    hideBanner() { hide(els.banner); },
    plantProgress(frac, label) {
      if (frac === null) { hide(els.plantBar); return; }
      show(els.plantBar);
      els.plantFill.style.width = `${Math.round(frac * 100)}%`;
      els.plantLabel.textContent = label;
    },
    showBuy(weapons, money, ownedId, hasArmor) {
      els.buyGrid.innerHTML = '';
      for (const w of weapons) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'buy-card';
        const owned = w.id === ownedId;
        const afford = money >= w.price;
        card.disabled = owned || !afford;
        card.innerHTML = `<b>${w.name}</b><span>$${w.price}</span><i>${owned ? 'EQUIPPED' : w.blurb}</i>`;
        card.addEventListener('click', () => this._onBuy && this._onBuy(w.id));
        els.buyGrid.appendChild(card);
      }
      const armor = document.createElement('button');
      armor.type = 'button';
      armor.className = 'buy-card';
      armor.disabled = hasArmor || money < 650;
      armor.innerHTML = `<b>Plated Vest</b><span>$650</span><i>${hasArmor ? 'EQUIPPED' : '50 armour, absorbs half of every hit.'}</i>`;
      armor.addEventListener('click', () => this._onBuy && this._onBuy('armor'));
      els.buyGrid.appendChild(armor);
      show(els.buyMenu);
    },
    hideBuy() { hide(els.buyMenu); },
    setSpectate(name) {
      if (!name) { hide(els.spectate); return; }
      els.spectate.textContent = `Spectating ${name} — click to cycle`;
      show(els.spectate);
    },
    showOverlay(mode, score) {
      const COPY = {
        start: { title: 'EMBERLINE', copy: 'Round-based tactical FPS. Plant the Spark at Foundry or Silos, or eliminate the Ashen team. First to 5 rounds takes the yard.', action: 'Click to play' },
        paused: { title: 'EMBERLINE', copy: 'Paused. Click to resume.', action: 'Click to resume' },
        dead: { title: 'You are down', copy: 'Your team fights on. Watch a teammate and wait for the next round.', action: 'Spectate' },
        end: { title: 'Match over', copy: `Final score ${score}.`, action: 'Play again' },
      };
      const text = COPY[mode];
      if (!text) return;
      els.title.textContent = text.title;
      els.copy.textContent = text.copy;
      els.play.textContent = text.action;
      show(els.overlay);
    },
    hideOverlay() { hide(els.overlay); },
    onPlay(handler) { els.play.addEventListener('click', handler); },
    onBuy(handler) { this._onBuy = handler; },
  };
}
