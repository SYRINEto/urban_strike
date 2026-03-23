// ─────────────────────────────────────────────────────
//  URBAN STRIKE — game.js
//  Logique du jeu + gestion du popup Guide
// ─────────────────────────────────────────────────────

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ─── ÉTAT DU JEU ─────────────────────────────────────
let state = 'idle'; // idle | playing | levelclear | gameover | win
let score = 0;
let lives = 3;
let currentLevel = 1;

let player, bullets, enemies, enemyBullets, particles, explosions;
let keys          = {};
let shootCooldown = 0;
let levelConfig;
let enemySpeedMult  = 1;
let enemyShootTimer = 0;
let stars     = [];
let buildings = [];

// ─── CONFIGURATION DES NIVEAUX ───────────────────────
const levels = [
  { level: 1, rows: 2, cols: 6, enemySpeed: 0.4, enemyShootInterval: 130, enemyBulletSpeed: 2 },
  { level: 2, rows: 3, cols: 7, enemySpeed: 0.6, enemyShootInterval: 95,  enemyBulletSpeed: 3 },
  { level: 3, rows: 4, cols: 8, enemySpeed: 0.9, enemyShootInterval: 65,  enemyBulletSpeed: 4 },
];

// ─── GUIDE POPUP ─────────────────────────────────────
const guideOverlay   = document.getElementById('guideOverlay');
const guideBtn       = document.getElementById('guideBtn');
const closeGuideBtn  = document.getElementById('closeGuideBtn');
const closeGuideBtn2 = document.getElementById('closeGuideBtn2');

function openGuide() {
  guideOverlay.classList.add('visible');
}

function closeGuide() {
  guideOverlay.classList.remove('visible');
}

guideBtn.addEventListener('click', openGuide);
closeGuideBtn.addEventListener('click', closeGuide);
closeGuideBtn2.addEventListener('click', closeGuide);

// Fermer en cliquant sur le fond
guideOverlay.addEventListener('click', (e) => {
  if (e.target === guideOverlay) closeGuide();
});

// Fermer avec la touche Échap
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && guideOverlay.classList.contains('visible')) {
    closeGuide();
  }
});

// ─── INITIALISATION ───────────────────────────────────

function initStars() {
  stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push({
      x:  Math.random() * W,
      y:  Math.random() * H * 0.6,
      r:  Math.random() * 1.5 + 0.3,
      a:  Math.random() * 0.8 + 0.2,
      tw: Math.random() * 200
    });
  }
}

function initBuildings() {
  buildings = [];
  let x = 0;
  while (x < W) {
    let w = 30 + Math.random() * 50;
    let h = 60 + Math.random() * 120;
    buildings.push({ x, y: H - h, w, h });
    x += w + 2 + Math.random() * 10;
  }
}

function initGame(lvl) {
  currentLevel    = lvl;
  levelConfig     = levels[lvl - 1];
  player          = { x: W / 2 - 20, y: H - 70, w: 40, h: 30, speed: 6 };
  bullets         = [];
  enemies         = [];
  enemyBullets    = [];
  particles       = [];
  explosions      = [];
  shootCooldown   = 0;
  enemyShootTimer = 0;
  enemySpeedMult  = 1;

  let cfg    = levelConfig;
  let startX = (W - cfg.cols * 55) / 2;

  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      enemies.push({
        x: startX + c * 55,
        y: 50 + r * 45,
        w: 36, h: 22,
        type:   r === 0 ? 'elite' : r < 2 ? 'medium' : 'basic',
        points: r === 0 ? 30     : r < 2  ? 20       : 10,
        alive:  true,
        dx:     cfg.enemySpeed
      });
    }
  }

  if (!stars.length)     initStars();
  if (!buildings.length) initBuildings();
}

// ─── EFFETS VISUELS ──────────────────────────────────

function spawnParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    let angle = Math.random() * Math.PI * 2;
    let speed = 1 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.02 + Math.random() * 0.03,
      size: 2 + Math.random() * 3,
      color
    });
  }
}

function spawnExplosion(x, y, big = false) {
  explosions.push({ x, y, r: big ? 30 : 18, maxR: big ? 60 : 36, life: 1, big });
  spawnParticles(x, y, big ? '#ff6b00' : '#00f5ff', big ? 20 : 10);
}

// ─── MISE À JOUR (LOGIQUE) ────────────────────────────

function update() {
  if (state !== 'playing') return;

  if (keys['ArrowLeft']  || keys['a']) player.x = Math.max(0, player.x - player.speed);
  if (keys['ArrowRight'] || keys['d']) player.x = Math.min(W - player.w, player.x + player.speed);

  if (shootCooldown > 0) shootCooldown--;
  if ((keys[' '] || keys['Space']) && shootCooldown === 0) {
    bullets.push({ x: player.x + player.w / 2 - 2, y: player.y, w: 4, h: 14, speed: 11 });
    shootCooldown = 8;
  }

  bullets      = bullets.filter(b => { b.y -= b.speed; return b.y + b.h > 0; });
  enemyBullets = enemyBullets.filter(b => { b.y += b.speed; return b.y < H; });

  let liveEnemies = enemies.filter(e => e.alive);
  if (liveEnemies.length === 0) { levelClear(); return; }

  let leftmost  = Math.min(...liveEnemies.map(e => e.x));
  let rightmost = Math.max(...liveEnemies.map(e => e.x + e.w));
  let hitWall   = rightmost >= W - 4 || leftmost <= 4;

  enemies.forEach(e => { if (e.alive) e.x += e.dx * enemySpeedMult; });

  if (hitWall) {
    enemies.forEach(e => { if (e.alive) { e.dx *= -1; e.y += 12; } });
    enemySpeedMult += 0.02;
  }

  if (liveEnemies.some(e => e.y + e.h > H - 80)) { loseLife(); return; }

  enemyShootTimer++;
  if (enemyShootTimer >= levelConfig.enemyShootInterval) {
    enemyShootTimer = 0;
    let cols = {};
    liveEnemies.forEach(e => {
      let col = Math.round(e.x / 55);
      if (!cols[col] || e.y > cols[col].y) cols[col] = e;
    });
    let shooters = Object.values(cols);
    let shooter  = shooters[Math.floor(Math.random() * shooters.length)];
    if (shooter) {
      enemyBullets.push({
        x: shooter.x + shooter.w / 2 - 2,
        y: shooter.y + shooter.h,
        w: 5, h: 12,
        speed: levelConfig.enemyBulletSpeed
      });
    }
  }

  bullets.forEach(b => {
    enemies.forEach(e => {
      if (!e.alive) return;
      if (b.x < e.x+e.w && b.x+b.w > e.x && b.y < e.y+e.h && b.y+b.h > e.y) {
        e.alive = false;
        b.y     = -999;
        score  += e.points;
        updateHUD();
        spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, e.type === 'elite');
      }
    });
  });

  enemyBullets.forEach(b => {
    if (b.x < player.x+player.w && b.x+b.w > player.x &&
        b.y < player.y+player.h && b.y+b.h > player.y) {
      b.y = H + 100;
      spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, true);
      loseLife();
    }
  });

  particles = particles.filter(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.1;
    p.life -= p.decay;
    return p.life > 0;
  });

  explosions = explosions.filter(ex => {
    ex.r   += (ex.maxR - ex.r) * 0.15;
    ex.life -= 0.06;
    return ex.life > 0;
  });

  stars.forEach(s => s.tw++);
}

// ─── VIES / FIN DE NIVEAU ────────────────────────────

function loseLife() {
  lives--;
  updateHUD();
  if (lives <= 0) {
    state = 'gameover';
    document.getElementById('finalScoreGO').textContent = 'SCORE FINAL : ' + score;
    document.getElementById('gameOverScreen').style.display = 'flex';
  } else {
    enemyBullets = [];
    player.x = W / 2 - 20;
  }
}

function levelClear() {
  if (currentLevel >= 3) {
    state = 'win';
    document.getElementById('finalScoreWin').textContent = 'SCORE : ' + score;
    document.getElementById('winScreen').style.display = 'flex';
  } else {
    state = 'levelclear';
    document.getElementById('levelClearMsg').textContent = 'Préparation niveau ' + (currentLevel + 1) + '...';
    document.getElementById('finalScore').textContent    = 'SCORE : ' + score;
    document.getElementById('levelScreen').style.display = 'flex';
  }
}

function updateHUD() {
  document.getElementById('scoreDisplay').textContent = score;
  document.getElementById('levelDisplay').textContent = currentLevel;
  const hearts = ['♥ ♥ ♥', '♥ ♥ ♡', '♥ ♡ ♡', '♡ ♡ ♡'];
  document.getElementById('livesDisplay').textContent = hearts[Math.max(0, 3 - lives)];
}

// ─── RENDU (DESSIN) ───────────────────────────────────

function draw() {
  ctx.clearRect(0, 0, W, H);

  let sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  sky.addColorStop(0, '#030612');
  sky.addColorStop(1, '#0a0f28');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.7);

  ctx.fillStyle = '#080d1a';
  ctx.fillRect(0, H * 0.7, W, H * 0.3);

  let glow = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, 300);
  glow.addColorStop(0, 'rgba(0,100,255,0.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  stars.forEach(s => {
    let twinkle = 0.4 + 0.6 * Math.abs(Math.sin(s.tw * 0.03));
    ctx.globalAlpha = s.a * twinkle;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  buildings.forEach(b => {
    ctx.fillStyle = '#060c1a';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    for (let wy = b.y + 8; wy < H - 10; wy += 14) {
      for (let wx = b.x + 5; wx < b.x + b.w - 8; wx += 10) {
        if (Math.sin(wx * 3.7 + wy * 2.1) > 0.2) {
          ctx.fillStyle = Math.sin(wx + wy) > 0.5
            ? 'rgba(255,200,80,0.7)'
            : 'rgba(80,180,255,0.5)';
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
    ctx.strokeStyle = 'rgba(255,50,50,0.6)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w / 2, b.y);
    ctx.lineTo(b.x + b.w / 2, b.y - 10);
    ctx.stroke();
    if (Math.floor(Date.now() / 600) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,50,50,0.9)';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y - 10, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.strokeStyle = 'rgba(0,245,255,0.15)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, H - 50);
  ctx.lineTo(W, H - 50);
  ctx.stroke();

  enemies.forEach(e => { if (e.alive) drawEnemy(e); });

  bullets.forEach(b => {
    ctx.save();
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#00f5ff';
    ctx.fillStyle   = '#00f5ff';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle   = 'rgba(0,245,255,0.3)';
    ctx.fillRect(b.x - 2, b.y, b.w + 4, b.h);
    ctx.restore();
  });

  enemyBullets.forEach(b => {
    ctx.save();
    ctx.shadowBlur  = 10;
    ctx.shadowColor = '#ff1744';
    ctx.fillStyle   = '#ff1744';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.restore();
  });

  explosions.forEach(ex => {
    ctx.save();
    ctx.globalAlpha = ex.life * 0.5;
    let eg = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, ex.r);
    eg.addColorStop(0,   ex.big ? 'rgba(255,150,0,1)'   : 'rgba(0,245,255,1)');
    eg.addColorStop(0.5, ex.big ? 'rgba(255,50,0,0.6)'  : 'rgba(0,150,255,0.4)');
    eg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  if (state === 'playing') drawPlayer();
}

function drawPlayer() {
  ctx.save();
  ctx.shadowBlur  = 20;
  ctx.shadowColor = '#00f5ff';

  let px = player.x, py = player.y, pw = player.w, ph = player.h;

  let tg = ctx.createLinearGradient(px + pw / 2, py + ph, px + pw / 2, py + ph + 20);
  tg.addColorStop(0, 'rgba(0,200,255,0.8)');
  tg.addColorStop(1, 'rgba(0,0,255,0)');
  ctx.fillStyle = tg;
  ctx.fillRect(px + pw / 2 - 6, py + ph, 12, 18 + Math.random() * 8);

  ctx.fillStyle = '#0e2a4a';
  ctx.beginPath();
  ctx.moveTo(px + pw / 2,    py);
  ctx.lineTo(px + pw,        py + ph);
  ctx.lineTo(px + pw * 0.75, py + ph * 0.7);
  ctx.lineTo(px + pw / 2,    py + ph * 0.85);
  ctx.lineTo(px + pw * 0.25, py + ph * 0.7);
  ctx.lineTo(px,             py + ph);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#00f5ff';
  ctx.beginPath();
  ctx.moveTo(px + pw / 2,    py + 4);
  ctx.lineTo(px + pw * 0.65, py + ph * 0.5);
  ctx.lineTo(px + pw / 2,    py + ph * 0.4);
  ctx.lineTo(px + pw * 0.35, py + ph * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,245,255,0.6)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath(); ctx.moveTo(px + pw * 0.25, py + ph * 0.7); ctx.lineTo(px, py + ph); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px + pw * 0.75, py + ph * 0.7); ctx.lineTo(px + pw, py + ph); ctx.stroke();

  ctx.restore();
}

function drawEnemy(e) {
  ctx.save();
  const colors = { basic: '#ff1744', medium: '#ff6b00', elite: '#ff00ff' };
  let c = colors[e.type];

  ctx.shadowBlur  = 12;
  ctx.shadowColor = c;

  ctx.fillStyle = '#1a0a0a';
  ctx.fillRect(e.x + 6, e.y + 4, e.w - 12, e.h - 6);

  ctx.fillStyle = c;
  ctx.fillRect(e.x + e.w / 2 - 5, e.y + e.h / 2 - 5, 10, 10);

  let rot = Date.now() * 0.005;
  for (let i = 0; i < 4; i++) {
    let angle = rot + i * Math.PI / 2;
    let rx = e.x + e.w / 2 + Math.cos(angle) * 13;
    let ry = e.y + e.h / 2 + Math.sin(angle) * 7;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(rx, ry, 5, 2, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = c;
  ctx.lineWidth   = 1.5;
  ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(e.x + e.w / 2, e.y + e.h / 2); ctx.lineTo(e.x + 4, e.y + e.h / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(e.x + e.w / 2, e.y + e.h / 2); ctx.lineTo(e.x + e.w - 4, e.y + e.h / 2); ctx.stroke();

  if (e.type === 'elite') {
    ctx.globalAlpha = 1;
    ctx.fillStyle   = '#ff00ff';
    ctx.beginPath();
    ctx.arc(e.x + e.w / 2, e.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── BOUCLE PRINCIPALE ────────────────────────────────

let lastTime = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  if (ts - lastTime < 16) return;
  lastTime = ts;
  update();
  draw();
}

// ─── CONTRÔLES CLAVIER ────────────────────────────────

document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ') e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

// ─── BOUTONS ──────────────────────────────────────────

document.getElementById('startBtn').onclick = () => {
  score = 0; lives = 3;
  document.getElementById('startScreen').style.display = 'none';
  initGame(1);
  updateHUD();
  state = 'playing';
};

document.getElementById('nextLevelBtn').onclick = () => {
  document.getElementById('levelScreen').style.display = 'none';
  initGame(currentLevel + 1);
  updateHUD();
  state = 'playing';
};

document.getElementById('restartBtn').onclick = () => {
  score = 0; lives = 3;
  document.getElementById('gameOverScreen').style.display = 'none';
  initGame(1);
  updateHUD();
  state = 'playing';
};

document.getElementById('winRestartBtn').onclick = () => {
  score = 0; lives = 3;
  document.getElementById('winScreen').style.display = 'none';
  initGame(1);
  updateHUD();
  state = 'playing';
};

// ─── DÉMARRAGE ────────────────────────────────────────

initStars();
initBuildings();
requestAnimationFrame(loop);
