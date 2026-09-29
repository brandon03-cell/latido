/* ==========================================================================
   Latido — hero
   Glóbulos rojos que fluyen por un vaso sanguíneo (canvas 2D) y titular
   que aparece letra a letra.
   ========================================================================== */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');

  /* ---------- Titular letra a letra ---------- */
  function splitHeadline() {
    let index = 0;
    document.querySelectorAll('[data-split]').forEach((line) => {
      const words = line.textContent.trim().split(/\s+/);
      line.textContent = '';
      words.forEach((word, wi) => {
        const w = document.createElement('span');
        w.className = 'word';
        for (const ch of word) {
          const c = document.createElement('span');
          c.className = 'char';
          c.textContent = ch;
          c.style.setProperty('--i', String(index++));
          w.appendChild(c);
        }
        line.appendChild(w);
        if (wi < words.length - 1) line.appendChild(document.createTextNode(' '));
      });
      index += 4; // pausa breve entre líneas
      line.classList.add('is-split');
    });
  }
  splitHeadline();

  /* ---------- Canvas de glóbulos ---------- */
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return;
  const hero = canvas.parentElement;

  let W = 0;
  let H = 0;
  let DPR = 1;
  let cells = [];
  let specks = [];
  let rafId = 0;
  let last = 0;
  let running = false;
  let inView = true;
  const pointer = { x: -1e5, y: -1e5 };

  // Disco bicóncavo visto de frente: centro hundido y más oscuro, anillo brillante.
  function paintCell(g, r) {
    const body = g.createRadialGradient(r, r, 0, r, r, r);
    body.addColorStop(0, '#7A0714');
    body.addColorStop(0.3, '#8E0A1C');
    body.addColorStop(0.58, '#C81F36');
    body.addColorStop(0.78, '#D9304A');
    body.addColorStop(0.93, '#A0102A');
    body.addColorStop(1, 'rgba(110, 6, 20, 0)');
    g.fillStyle = body;
    g.beginPath();
    g.arc(r, r, r, 0, TAU);
    g.fill();

    const light = g.createRadialGradient(r * 0.62, r * 0.5, r * 0.05, r * 0.62, r * 0.5, r * 0.78);
    light.addColorStop(0, 'rgba(255, 196, 206, 0.55)');
    light.addColorStop(0.5, 'rgba(255, 150, 165, 0.12)');
    light.addColorStop(1, 'rgba(255, 150, 165, 0)');
    g.fillStyle = light;
    g.beginPath();
    g.arc(r, r, r * 0.97, 0, TAU);
    g.fill();

    const dimple = g.createRadialGradient(r * 1.06, r * 1.08, 0, r, r, r * 0.46);
    dimple.addColorStop(0, 'rgba(45, 0, 8, 0.5)');
    dimple.addColorStop(1, 'rgba(45, 0, 8, 0)');
    g.fillStyle = dimple;
    g.beginPath();
    g.arc(r, r, r * 0.5, 0, TAU);
    g.fill();
  }

  function makeSprites() {
    const size = 128;
    const r = size / 2;
    const sharp = document.createElement('canvas');
    sharp.width = sharp.height = size;
    paintCell(sharp.getContext('2d'), r);

    const blurred = (amount) => {
      const pad = amount * 3;
      const c = document.createElement('canvas');
      c.width = c.height = size + pad * 2;
      const g = c.getContext('2d');
      const filter = 'blur(' + amount + 'px)';
      g.filter = filter;
      if (g.filter === filter) {
        g.drawImage(sharp, pad, pad);
      } else {
        // Navegadores sin ctx.filter: disco más tenue con halo suave.
        g.globalAlpha = 0.8;
        g.drawImage(sharp, pad, pad);
        g.globalAlpha = 1;
        const cx = c.width / 2;
        const halo = g.createRadialGradient(cx, cx, r * 0.6, cx, cx, r + pad);
        halo.addColorStop(0, 'rgba(180, 20, 40, 0.3)');
        halo.addColorStop(1, 'rgba(180, 20, 40, 0)');
        g.fillStyle = halo;
        g.fillRect(0, 0, c.width, c.height);
      }
      return { img: c, scale: c.width / size };
    };

    return {
      sharp: { img: sharp, scale: 1 },
      soft: blurred(5),
      blur: blurred(12)
    };
  }
  const sprites = makeSprites();

  const rand = (a, b) => a + Math.random() * (b - a);

  function makeCell() {
    const z = Math.random();
    const k = Math.min(1.15, Math.max(0.6, W / 1400));
    let r;
    let sprite;
    let alpha;
    if (z < 0.45) {        // fondo, desenfocado
      r = rand(5, 13);
      sprite = 'blur';
      alpha = rand(0.3, 0.55);
    } else if (z < 0.92) { // plano de enfoque
      r = rand(14, 30);
      sprite = 'sharp';
      alpha = rand(0.8, 1);
    } else {               // primer plano, muy cerca de la cámara
      r = rand(46, 76);
      sprite = 'soft';
      alpha = rand(0.45, 0.65);
    }
    return {
      z,
      r: r * k,
      sprite,
      alpha,
      x: rand(0, W),
      y: rand(0, H),
      vx: (16 + z * 74) * rand(0.8, 1.2) * k,
      vy: rand(-6, 6),
      rot: rand(0, TAU),
      vrot: rand(-0.35, 0.35),
      tilt: rand(0, TAU),
      vtilt: rand(0.25, 0.9) * (Math.random() < 0.5 ? -1 : 1),
      phase: rand(0, TAU),
      amp: rand(4, 16),
      freq: rand(0.3, 0.8),
      ox: 0,
      oy: 0
    };
  }

  function makeSpeck() {
    const platelet = Math.random() < 0.55;
    return {
      x: rand(0, W),
      y: rand(0, H),
      r: platelet ? rand(1.4, 3.2) : rand(0.6, 1.4),
      vx: rand(30, 110),
      vy: rand(-4, 4),
      rot: rand(0, TAU),
      color: platelet ? 'rgba(255, 214, 150, 0.5)' : 'rgba(255, 170, 185, 0.35)'
    };
  }

  function populate() {
    const area = W * H;
    const nCells = Math.round(Math.min(70, Math.max(18, area / 17000)));
    const nSpecks = Math.round(Math.min(90, Math.max(20, area / 12000)));
    cells = Array.from({ length: nCells }, makeCell).sort((a, b) => a.z - b.z);
    specks = Array.from({ length: nSpecks }, makeSpeck);
  }

  function update(dt, t) {
    const R = 190;
    for (const c of cells) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vrot * dt;
      c.tilt += c.vtilt * dt;

      const m = c.r * 2.5;
      if (c.x - m > W) {
        c.x = -m;
        c.y = rand(0, H);
      }
      if (c.y < -m) c.y = H + m;
      else if (c.y > H + m) c.y = -m;

      let tx = 0;
      let ty = 0;
      if (c.z >= 0.45) {
        const px = c.x + c.ox;
        const py = c.y + Math.sin(t * c.freq + c.phase) * c.amp + c.oy;
        const dx = px - pointer.x;
        const dy = py - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / R) * 70 * c.z;
          tx = (dx / d) * f;
          ty = (dy / d) * f;
        }
      }
      const ease = Math.min(1, dt * 4);
      c.ox += (tx - c.ox) * ease;
      c.oy += (ty - c.oy) * ease;
    }

    for (const s of specks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += dt;
      if (s.x - 4 > W) {
        s.x = -4;
        s.y = rand(0, H);
      }
      if (s.y < -4) s.y = H + 4;
      else if (s.y > H + 4) s.y = -4;
    }
  }

  function draw(t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.globalAlpha = 1;
    for (const s of specks) {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.62, s.rot, 0, TAU);
      ctx.fill();
    }

    for (const c of cells) {
      const sp = sprites[c.sprite];
      const size = c.r * 2 * sp.scale;
      const x = c.x + c.ox;
      const y = c.y + Math.sin(t * c.freq + c.phase) * c.amp + c.oy;
      const squash = Math.max(0.22, Math.abs(Math.cos(c.tilt)));
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.translate(x, y);
      ctx.rotate(c.rot);
      ctx.scale(1, squash);
      ctx.drawImage(sp.img, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  function frame(ts) {
    rafId = 0;
    if (!running) return;
    const t = ts / 1000;
    const dt = last ? Math.min(0.05, t - last) : 1 / 60;
    last = t;
    update(dt, t);
    draw(t);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || motion.matches || !inView || document.hidden || !W) return;
    running = true;
    last = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function resize() {
    const rect = hero.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (!w || !h) return;
    const oldW = W;
    const oldH = H;
    W = w;
    H = h;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);

    if (!cells.length || Math.abs(W - oldW) > 40) {
      populate();
    } else if (oldH && oldH !== H) {
      // Solo cambió la altura (p. ej. la barra del navegador móvil): se reescala en vertical.
      const k = H / oldH;
      cells.forEach((c) => { c.y *= k; });
      specks.forEach((s) => { s.y *= k; });
    }
    draw(performance.now() / 1000);
    start();
  }

  if ('ResizeObserver' in window) {
    let pending = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(resize);
    }).observe(hero);
  } else {
    window.addEventListener('resize', resize);
  }
  resize();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      if (inView) start();
      else stop();
    }).observe(hero);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  const onMotionChange = () => {
    if (motion.matches) {
      stop();
      draw(0);
    } else {
      start();
    }
  };
  if (motion.addEventListener) motion.addEventListener('change', onMotionChange);
  else if (motion.addListener) motion.addListener(onMotionChange);

  hero.addEventListener('pointermove', (e) => {
    if (!finePointer.matches) return;
    const rect = hero.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
  });
  hero.addEventListener('pointerleave', () => {
    pointer.x = -1e5;
    pointer.y = -1e5;
  });
})();
