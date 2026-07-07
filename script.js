const canvas = document.getElementById("sky");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

let width, height;
function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

const DINO_EMOJIS = ["🦕", "🦖"];
const DINO_COUNT = 6;
const METEOR_EMOJI = "☄️";
const HIT_RADIUS = 45;

let score = 0;
let dinos = [];
let meteors = [];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function makeDino() {
  return {
    emoji: DINO_EMOJIS[Math.floor(Math.random() * DINO_EMOJIS.length)],
    x: rand(60, width - 60),
    y: rand(80, height - 80),
    vx: rand(-1, 1) || 0.5,
    vy: rand(-0.5, 0.5),
    size: rand(40, 64),
    bob: rand(0, Math.PI * 2),
    rotation: 0,
    spin: 0,
    hit: false,
    hitTimer: 0,
  };
}

function makeMeteor() {
  return {
    x: rand(0, width),
    y: -40,
    vx: rand(-1.5, 1.5),
    vy: rand(4, 8),
    size: rand(28, 42),
    rotation: rand(0, Math.PI * 2),
  };
}

for (let i = 0; i < DINO_COUNT; i++) dinos.push(makeDino());

let meteorTimer = 0;

canvas.addEventListener("click", (e) => {
  meteors.push({
    x: e.clientX,
    y: -20,
    vx: rand(-1, 1),
    vy: rand(5, 9),
    size: rand(30, 44),
    rotation: 0,
  });
});

function updateDino(d) {
  if (d.hit) {
    d.hitTimer--;
    d.x += d.vx;
    d.y += d.vy;
    d.vy += 0.15; // gravity while flying off
    d.rotation += d.spin;
    if (d.hitTimer <= 0 || d.x < -100 || d.x > width + 100 || d.y > height + 100) {
      Object.assign(d, makeDino());
    }
    return;
  }

  d.bob += 0.05;
  d.x += d.vx;
  d.y += d.vy + Math.sin(d.bob) * 0.3;

  if (d.x < 40 || d.x > width - 40) d.vx *= -1;
  if (d.y < 60 || d.y > height - 60) d.vy *= -1;
}

function updateMeteor(m) {
  m.x += m.vx;
  m.y += m.vy;
  m.rotation += 0.1;
}

function checkCollisions() {
  for (const m of meteors) {
    for (const d of dinos) {
      if (d.hit) continue;
      const dx = d.x - m.x;
      const dy = d.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < HIT_RADIUS) {
        d.hit = true;
        d.hitTimer = 90;
        const angle = Math.atan2(dy, dx) + rand(-0.3, 0.3);
        const power = rand(6, 11);
        d.vx = Math.cos(angle) * power;
        d.vy = Math.sin(angle) * power - 3;
        d.spin = rand(-0.4, 0.4);
        score++;
        scoreEl.textContent = `맞은 공룡 수: ${score}`;
      }
    }
  }
  meteors = meteors.filter((m) => m.y < height + 60);
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  for (const d of dinos) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rotation);
    ctx.font = `${d.size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = d.hit ? Math.max(0.2, d.hitTimer / 90) : 1;
    ctx.fillText(d.emoji, 0, 0);
    ctx.restore();
  }

  for (const m of meteors) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rotation);
    ctx.font = `${m.size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(METEOR_EMOJI, 0, 0);
    ctx.restore();
  }
}

function loop() {
  meteorTimer--;
  if (meteorTimer <= 0) {
    meteors.push(makeMeteor());
    meteorTimer = Math.floor(rand(40, 90));
  }

  dinos.forEach(updateDino);
  meteors.forEach(updateMeteor);
  checkCollisions();
  draw();

  requestAnimationFrame(loop);
}

loop();
