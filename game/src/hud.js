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
    minimap: $('minimap'),
    radioLog: $('radio-log'),
    planLine: $('plan-line'),
    grenades: $('grenades-line'),
    flashOverlay: $('flash-overlay'),
  };
  let hitTimer = 0;
  let bannerTimer = 0;
  let last = { mag: -1, reserve: -1, hp: -1, armor: -1, money: -1, timer: '', score: '', grenades: '' };
  // Minimap state: wall rects once, live dots every tick.
  const mm = els.minimap ? els.minimap.getContext('2d') : null;
  let mmWalls = [];

  function drawMinimap(data) {
    if (!mm) return;
    const W = 150;
    const H = 118;
    const s = 4.1;
    const ox = (W - 36.4 * s) / 2;
    const oz = (H - 28.4 * s) / 2;
    const X = (x) => ox + (x + 18.2) * s;
    const Z = (z) => oz + (z + 14.2) * s;
    mm.clearRect(0, 0, W, H);
    mm.fillStyle = 'rgba(12, 9, 7, 0.82)';
    mm.fillRect(0, 0, W, H);
    mm.fillStyle = '#8a6a45';
    for (const r of mmWalls) mm.fillRect(X(r.x - r.w / 2), Z(r.z - r.d / 2), r.w * s, r.d * s);
    // Site circles + letters.
    mm.font = 'bold 11px "Segoe UI", sans-serif';
    mm.textAlign = 'center';
    mm.textBaseline = 'middle';
    for (const [letter, cx, cz, color] of [['A', -12, -9, '#ff8c2e'], ['B', 12, -9, '#2fd4e8']]) {
      mm.beginPath();
      mm.arc(X(cx), Z(cz), 4.5 * s, 0, Math.PI * 2);
      mm.fillStyle = `${color}33`;
      mm.fill();
      mm.strokeStyle = color;
      mm.lineWidth = 1.5;
      mm.stroke();
      mm.fillStyle = color;
      mm.fillText(letter, X(cx), Z(cz));
    }
    // Bomb: orange square while carried/dropped, blinking when planted.
    if (data.bomb) {
      mm.fillStyle = data.bomb.planted ? '#ff2a1a' : '#ffb45e';
      mm.fillRect(X(data.bomb.x) - 3, Z(data.bomb.z) - 3, 6, 6);
    }
    // Last-seen Ashen dots, fading with age.
    if (data.ashen) {
      for (const a of data.ashen) {
        mm.globalAlpha = Math.max(0.25, 1 - a.age / 4);
        mm.fillStyle = '#2fd4e8';
        mm.beginPath();
        mm.arc(X(a.x), Z(a.z), 3, 0, Math.PI * 2);
        mm.fill();
      }
      mm.globalAlpha = 1;
    }
    // Ember teammates.
    if (data.ember) {
      mm.fillStyle = '#ff8c2e';
      for (const e of data.ember) {
        mm.beginPath();
        mm.arc(X(e.x), Z(e.z), 3, 0, Math.PI * 2);
        mm.fill();
      }
    }
    // The player: a white arrow that turns with the view.
    if (data.player) {
      const px = X(data.player.x);
      const pz = Z(data.player.z);
      const a = -data.player.yaw;
      mm.save();
      mm.translate(px, pz);
      mm.rotate(a);
      mm.fillStyle = '#ffffff';
      mm.beginPath();
      mm.moveTo(0, -6);
      mm.lineTo(4.5, 5);
      mm.lineTo(-4.5, 5);
      mm.closePath();
      mm.fill();
      mm.restore();
    }
  }

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  return {
    setMinimapWalls(rects) { mmWalls = rects; },
    setMinimap(data) { drawMinimap(data); },
    setPlan(text) {
      els.planLine.textContent = text;
    },
    setGrenades(counts) {
      const text = `4 FRAG ${counts.frag} · SMOKE ${counts.smoke} · FLASH ${counts.flash} · MOLOTOV ${counts.molotov}`;
      if (text === last.grenades) return;
      last.grenades = text;
      els.grenades.textContent = text;
    },
    // Radio log: the last 4 callouts, team-coloured, fading after 9 s.
    radio(text, team) {
      if (!els.radioLog) return;
      const row = document.createElement('div');
      row.className = `radio-row ${team === 'ember' ? 'radio-ember' : 'radio-ashen'}`;
      row.textContent = text;
      els.radioLog.prepend(row);
      while (els.radioLog.children.length > 4) els.radioLog.lastChild.remove();
      setTimeout(() => row.remove(), 9000);
    },
    flash() {
      els.flashOverlay.style.opacity = '0.85';
      setTimeout(() => { els.flashOverlay.style.opacity = '0'; }, 80);
    },
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
    showBuy(weapons, money, ownedId, hasArmor, grenades = []) {
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
      // Grenades: 4 frag, 5 smoke, 6 flash, 7 molotov. Max 2 of each per round.
      for (const g of grenades) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'buy-card grenade-card';
        const full = g.count >= 2;
        card.disabled = full || money < g.price;
        card.innerHTML = `<b>${g.name} <span class="g-key">[${g.key}]</span></b><span>$${g.price}</span><i>${full ? 'FULL — 2 carried' : g.blurb}</i>`;
        card.addEventListener('click', () => this._onBuy && this._onBuy(g.id));
        els.buyGrid.appendChild(card);
      }
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
