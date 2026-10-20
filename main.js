/* NÉBULA — main.js (module) */
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

if (!window.gsap || !window.ScrollTrigger) {
  $("#loader")?.remove();
  document.body.classList.remove("is-loading");
  document.documentElement.classList.add("no-fx");
  throw new Error("GSAP indisponível — animações desativadas");
}

gsap.registerPlugin(ScrollTrigger);
if (window.CustomEase) {
  gsap.registerPlugin(CustomEase);
  CustomEase.create("wipe", "0.76,0,0.24,1");     // squared-media loader curtain
  CustomEase.create("radial", "0.25,0.1,0,1");    // squared-media reveals
  CustomEase.create("soft", "0.52,0,0.48,1");     // future-human appear
}
const EASE = (name, fallback) => (window.CustomEase ? name : fallback);
gsap.defaults({ ease: "expo.out", duration: 1.2 });
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

/* ============ Smooth scroll ============ */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.3 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const scrollToTarget = (target) => {
  if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else if (target === 0) window.scrollTo({ top: 0, behavior: "smooth" });
  else target.scrollIntoView({ behavior: "smooth" });
};
$$('a[href^="#"]').forEach((a) =>
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id === "#top" ? 0 : id.length > 1 ? $(id) : null;
    if (target === null) return;
    e.preventDefault();
    if (menuOpen) toggleMenu(false);
    scrollToTarget(target);
  })
);

/* ============ Text splitting ============ */
function splitChars(el) {
  const chars = [];
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(" ")); return; }
          const w = document.createElement("span");
          w.className = "w";
          [...part].forEach((c) => {
            const s = document.createElement("span");
            s.className = "ch"; s.textContent = c;
            w.append(s); chars.push(s);
          });
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
  return chars;
}
$$("[data-chars]").forEach((el) => splitChars(el));
$$("[data-split] .line").forEach((l) => (l.innerHTML = `<span class="line__in">${l.innerHTML}</span>`));
const words = $("[data-words]");
if (words) words.innerHTML = words.textContent.trim().split(/\s+/).map((w) => `<span class="word">${w}</span>`).join(" ");

/* ============ Hero media: Flow/Veo video, 3D scene as fallback ============ */
let scene = null, heroVideo = null;

function loadScene() {
  document.body.classList.add("hero-3d");
  return import("./scene.js")
    .then(({ createScene }) => {
      scene = createScene($("#gl"), { reduce });
      gsap.ticker.add(scene.render);
    })
    .catch((err) => console.warn("Cena 3D indisponível:", err));
}

// The Veo clip is a constant dolly-in, so a plain restart "jumps" the zoom back.
// Measured zoom of the clip relative to t=0 (fitted frame-to-frame; centre ≈ 87.5% / 45%):
const ZOOM = [[0, 1], [1, 1.04], [2, 1.084], [3, 1.128], [4.4, 1.208], [5.6, 1.288], [6.6, 1.351], [7.4, 1.432]];
const ZOOM_CENTER = [0.875, 0.45];
const zoomAt = (t) => {
  for (let i = 1; i < ZOOM.length; i++) {
    if (t <= ZOOM[i][0]) {
      const [t0, z0] = ZOOM[i - 1], [t1, z1] = ZOOM[i], f = (t - t0) / (t1 - t0);
      return Math.exp(Math.log(z0) + (Math.log(z1) - Math.log(z0)) * f);
    }
  }
  return ZOOM[ZOOM.length - 1][1];
};
const easeSine = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

// Two stacked <video>s crossfade, but the image never jumps:
// 1. each clip is counter-scaled so 85% of the dolly is cancelled (a gentle forward drift remains);
// 2. during the crossfade the incoming clip is scaled to match the outgoing framing exactly,
//    so both layers overlap pixel-aligned and only the liquid/particles dissolve;
// 3. the tiny leftover (~3%) relaxes with a sine ease over the following seconds.
function createLoop(a, b, T = 4.4, XF = 2.2) {
  const KEEP = 0.85;
  const S0 = Math.pow(zoomAt(T + XF), KEEP);
  const base = (v) => S0 * Math.pow(zoomAt(v.currentTime), -KEEP);
  const extra = new Map([[a, 1], [b, 1]]);
  let front = a, back = b, fading = false, playing = false, relaxFrom = 1;
  gsap.set(b, { opacity: 0 });

  const setOrigin = () => {
    for (const v of [a, b]) {
      if (!v.videoWidth) continue;
      const ew = v.clientWidth, eh = v.clientHeight;
      const sc = Math.max(ew / v.videoWidth, eh / v.videoHeight);
      const dw = v.videoWidth * sc, dh = v.videoHeight * sc;
      const [px, py] = getComputedStyle(v).objectPosition.split(" ").map((p) => parseFloat(p) / 100);
      v.style.transformOrigin = `${(ZOOM_CENTER[0] * dw + (ew - dw) * px).toFixed(1)}px ${(ZOOM_CENTER[1] * dh + (eh - dh) * py).toFixed(1)}px`;
    }
  };
  a.addEventListener("loadedmetadata", setOrigin);
  addEventListener("resize", debounce(setOrigin));
  setOrigin();

  gsap.ticker.add(() => {
    if (!front.duration) return;
    if (playing && !fading && front.currentTime >= T) {
      fading = true;
      back.currentTime = 0;
      back.play().catch(() => {});
      back.classList.add("is-front"); front.classList.remove("is-front");
    }
    if (fading) {
      // keep the incoming clip locked to what the outgoing one is showing
      const shownFront = zoomAt(front.currentTime) * base(front) * extra.get(front);
      extra.set(back, shownFront / (zoomAt(back.currentTime) * base(back)));
      const p = back.currentTime / XF;
      back.style.opacity = easeSine(p).toFixed(3);
      if (p >= 1 || front.ended) {
        front.pause(); front.style.opacity = 0; extra.set(front, 1);
        [front, back] = [back, front];
        relaxFrom = extra.get(front);
        fading = false;
      }
    } else {
      const r = (front.currentTime - XF) / Math.max(0.5, T - XF);
      extra.set(front, 1 + (relaxFrom - 1) * (1 - easeSine(r)));
    }
    for (const v of [a, b]) v.style.transform = `scale(${(base(v) * extra.get(v)).toFixed(4)})`;
  });
  // background tabs throttle the ticker: never get stuck on the last frame
  [a, b].forEach((v) => v.addEventListener("ended", () => { if (v === front && !fading) { v.currentTime = 0; v.play().catch(() => {}); } }));
  return {
    play() { playing = true; front.play().catch(() => {}); if (fading) back.play().catch(() => {}); },
    pause() { playing = false; a.pause(); b.pause(); },
  };
}

function setupHeroVideo() {
  const [a, b] = $$(".hero__video");
  const small = innerWidth < 900 || navigator.connection?.saveData;
  const url = `assets/video/hero-${small ? 1280 : 1920}.mp4`;
  // Download the clip once and share it between both <video>s (the crossfade needs two)
  return fetch(url)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
    .then((blob) => new Promise((resolve, reject) => {
      a.src = b.src = URL.createObjectURL(blob);
      const t = setTimeout(resolve, 4000);
      a.addEventListener("canplaythrough", () => { clearTimeout(t); resolve(); }, { once: true });
      a.addEventListener("error", () => { clearTimeout(t); reject(a.error); }, { once: true });
    })).then(() => {
    heroVideo = createLoop(a, b);
    let inView = true;
    const sync = () => (inView && !document.hidden && !reduce ? heroVideo.play() : heroVideo.pause());
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (started) sync(); }).observe($(".hero"));
    document.addEventListener("visibilitychange", () => started && sync());
    let started = false;
    heroVideo.start = () => { started = true; sync(); };
  });
}

const heroPromise = setupHeroVideo().catch((err) => {
  console.warn("Vídeo do hero indisponível, usando a cena 3D:", err);
  $(".hero__media").remove();
  return loadScene();
});

/* ============ Pointer + cursor ============ */
const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
const heroEl = $(".hero");
const parallax = fine && !reduce && $(".hero__zoom") ? {
  x: gsap.quickTo(".hero__zoom", "x", { duration: 1.6, ease: "power3.out" }),
  y: gsap.quickTo(".hero__zoom", "y", { duration: 1.6, ease: "power3.out" }),
} : null;
window.addEventListener("pointermove", (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (parallax) {
    parallax.x(((e.clientX / innerWidth) - 0.5) * -28);
    parallax.y(((e.clientY / innerHeight) - 0.5) * -18);
  }
  if (scene) {
    scene.state.mx = (e.clientX / innerWidth) * 2 - 1;
    scene.state.my = -((e.clientY / innerHeight) * 2 - 1);
    const r = heroEl.getBoundingClientRect();
    scene.state.hover = e.clientY < r.bottom ? 1 : 0;
  }
}, { passive: true });

if (fine) {
  const cur = $(".cursor"), dot = $(".cursor__dot"), ring = $(".cursor__ring"), label = $(".cursor__label");
  const r = { x: mouse.x, y: mouse.y };
  const setDot = { x: gsap.quickSetter(dot, "x", "px"), y: gsap.quickSetter(dot, "y", "px") };
  const setRing = { x: gsap.quickSetter(ring, "x", "px"), y: gsap.quickSetter(ring, "y", "px") };
  window.addEventListener("pointermove", () => cur.classList.add("is-on"), { once: true });
  document.addEventListener("pointerleave", () => cur.classList.remove("is-on"));
  document.addEventListener("pointerenter", () => cur.classList.add("is-on"));
  window.addEventListener("pointerdown", () => cur.classList.add("is-down"));
  window.addEventListener("pointerup", () => cur.classList.remove("is-down"));
  gsap.ticker.add((_, dt) => {
    if (Math.abs(mouse.x - r.x) < 0.05 && Math.abs(mouse.y - r.y) < 0.05) return; // idle: no style writes
    const k = 1 - Math.pow(0.82, dt / 16.67);
    r.x = lerp(r.x, mouse.x, k); r.y = lerp(r.y, mouse.y, k);
    setDot.x(mouse.x); setDot.y(mouse.y);
    setRing.x(r.x); setRing.y(r.y);
  });
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest("[data-cursor], a, button, [role=link]");
    cur.classList.toggle("is-label", !!t?.dataset.cursor);
    cur.classList.toggle("is-hover", !!t && !t.dataset.cursor);
    if (t?.dataset.cursor) label.textContent = t.dataset.cursor;
  });
}

/* ============ Magnetic ============ */
if (fine && !reduce) {
  $$("[data-magnetic]").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.8, ease: "elastic.out(1, 0.35)" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.8, ease: "elastic.out(1, 0.35)" });
    el.addEventListener("pointermove", (e) => {
      const b = el.getBoundingClientRect();
      xTo((e.clientX - b.left - b.width / 2) * 0.3);
      yTo((e.clientY - b.top - b.height / 2) * 0.4);
    });
    el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
  });
}

/* ============ Clock ============ */
const clock = $("#clock");
const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const tick = () => (clock.textContent = fmt.format(new Date()));
tick(); setInterval(tick, 1000);

/* ============ Mobile menu ============ */
const menu = $("#menu"), menuBtn = $(".nav__menu");
let menuOpen = false, menuTl = null;
function toggleMenu(open = !menuOpen) {
  menuOpen = open;
  menuBtn.textContent = open ? "Fechar" : "Menu";
  menuBtn.setAttribute("aria-expanded", open);
  menu.setAttribute("aria-hidden", !open);
  menuTl?.kill();
  document.documentElement.style.overflow = open ? "hidden" : "";
  if (open) {
    lenis?.stop();
    menuTl = gsap.timeline()
      .set(menu, { visibility: "visible" })
      .to(menu, { clipPath: "circle(150% at calc(100% - 40px) 40px)", duration: 1.1, ease: "expo.inOut" })
      .fromTo(".menu__links a", { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.06, duration: 1 }, "-=0.55");
  } else {
    lenis?.start();
    menuTl = gsap.timeline()
      .to(menu, { clipPath: "circle(0% at calc(100% - 40px) 40px)", duration: 0.9, ease: "expo.inOut" })
      .set(menu, { visibility: "hidden" });
  }
}
menuBtn.addEventListener("click", () => toggleMenu());
matchMedia("(min-width: 901px)").addEventListener("change", (e) => e.matches && menuOpen && toggleMenu(false));
addEventListener("keydown", (e) => e.key === "Escape" && menuOpen && toggleMenu(false));

/* ============ Canvases ============ */
function reelCanvas() {
  const c = $("#reel"), ctx = c.getContext("2d");
  const resize = () => { c.width = Math.min(innerWidth, 960); c.height = Math.round(c.width * 9 / 16); };
  resize(); addEventListener("resize", debounce(resize));
  const blobs = [
    { h: "232,162,92", s: 0.6, o: 0 }, { h: "229,128,106", s: 0.45, o: 2 },
    { h: "186,254,2", s: 0.22, o: 4, a: 0.22 }, { h: "60,30,170", s: 0.75, o: 1 },
  ];
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(c);
  gsap.ticker.add((time) => {
    if (!visible) return;
    const { width: w, height: h } = c;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#07070a"; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    blobs.forEach((b) => {
      const x = w * (0.5 + 0.35 * Math.sin(time * 0.35 + b.o));
      const y = h * (0.5 + 0.3 * Math.cos(time * 0.27 + b.o * 1.3));
      const r = Math.max(w, h) * b.s;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${b.h},${b.a ?? 0.5})`); g.addColorStop(1, `rgba(${b.h},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(239,232,220,0.07)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 16; i++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 24) {
        const y = h * (i / 16) + Math.sin(x * 0.005 + time * 0.8 + i * 0.45) * 22;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function skyCanvas() {
  const c = $("#sky"), ctx = c.getContext("2d");
  const host = c.parentElement;
  let w = 0, h = 0, dpr = 1, stars = [], bg = null;

  // Star colours by temperature (mostly white/cream, some blue, ~6% orange)
  const TEMPS = [[200, 220, 255], [236, 240, 255], [255, 247, 232], [255, 230, 196], [255, 196, 140]];
  const pickTemp = () => { const r = Math.random(); return r < 0.12 ? 0 : r < 0.45 ? 1 : r < 0.78 ? 2 : r < 0.94 ? 3 : 4; };

  // Real constellations: centre (fraction of the canvas) + size (fraction of its shorter side),
  // so the shapes keep their proportions on any screen. Revealed near the cursor.
  const NAMED = [
    { name: "Crux · Cruzeiro do Sul", c: [0.2, 0.34], size: 0.34, alpha: 0,
      pts: [[0.5, 0], [0.45, 1], [0.05, 0.42], [0.9, 0.5], [0.66, 0.66]], edges: [[0, 1], [2, 3]] },
    { name: "Órion · Três Marias", c: [0.8, 0.68], size: 0.38, alpha: 0,
      pts: [[0.1, 0.05], [0.9, 0.12], [0.38, 0.5], [0.5, 0.47], [0.62, 0.44], [0.15, 0.95], [0.85, 0.9]],
      edges: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]] },
  ];

  // Pre-rendered sprites: soft glow, diffraction spikes, glow tinted per temperature
  const sprite = (size, draw) => { const s = document.createElement("canvas"); s.width = s.height = size; draw(s.getContext("2d"), size); return s; };
  const glow = sprite(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.12, "rgba(255,255,255,0.75)");
    gr.addColorStop(0.35, "rgba(255,255,255,0.16)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  const spikes = sprite(128, (g, s) => {
    g.translate(s / 2, s / 2);
    for (const [len, wid, rot] of [[s / 2, 1.2, 0], [s / 2, 1.2, Math.PI / 2], [s / 3.4, 0.7, Math.PI / 4], [s / 3.4, 0.7, -Math.PI / 4]]) {
      g.save(); g.rotate(rot);
      const lg = g.createLinearGradient(-len, 0, len, 0);
      lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, "rgba(255,255,255,0.9)"); lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg; g.fillRect(-len, -wid / 2, len * 2, wid); g.restore();
    }
  });
  const tinted = TEMPS.map((t) => sprite(64, (g, s) => {
    g.drawImage(glow, 0, 0); g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgb(${t[0]},${t[1]},${t[2]})`; g.fillRect(0, 0, s, s);
  }));

  // Nebula clouds + Milky Way band, rendered once per resize
  function buildBackground() {
    bg = document.createElement("canvas");
    bg.width = Math.round(w * dpr * 1.1); bg.height = Math.round(h * dpr * 1.1);
    const g = bg.getContext("2d"), W = bg.width, H = bg.height;
    g.fillStyle = "#050507"; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    const cloud = (x, y, r, col, a) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.5, `rgba(${col},${a * 0.35})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const ang = -0.42, cx = W * 0.52, cy = H * 0.5, ux = Math.cos(ang), uy = Math.sin(ang);
    for (let i = 0; i < 26; i++) {
      const t = (i / 25 - 0.5) * 1.5 * W, off = (Math.random() - 0.5) * H * 0.12;
      cloud(cx + ux * t - uy * off, cy + uy * t + ux * off, H * (0.16 + Math.random() * 0.14), i % 3 ? "90,78,170" : "170,120,96", 0.085);
    }
    cloud(W * 0.22, H * 0.3, H * 0.55, "60,28,150", 0.12);
    cloud(W * 0.78, H * 0.72, H * 0.5, "232,140,90", 0.07);
    cloud(W * 0.62, H * 0.22, H * 0.38, "229,110,120", 0.05);
    cloud(W * 0.35, H * 0.85, H * 0.4, "40,70,140", 0.07);
    g.globalCompositeOperation = "source-over";
    for (let i = 0; i < 4200; i++) {
      const t = (Math.random() - 0.5) * 1.6 * W, off = (Math.random() + Math.random() + Math.random() - 1.5) * H * 0.09;
      const x = cx + ux * t - uy * off, y = cy + uy * t + ux * off, tp = TEMPS[pickTemp()];
      const sz = Math.random() < 0.9 ? dpr * 0.8 : dpr * 1.4;
      g.fillStyle = `rgba(${tp[0]},${tp[1]},${tp[2]},${0.1 + Math.random() * 0.4})`;
      g.fillRect(x, y, sz, sz);
    }
    // faint dark dust lane along the band (one continuous stroke, no blotches)
    g.save();
    g.translate(cx, cy); g.rotate(ang);
    const lane = g.createLinearGradient(0, -H * 0.05, 0, H * 0.05);
    lane.addColorStop(0, "rgba(5,5,7,0)"); lane.addColorStop(0.5, "rgba(5,5,7,0.35)"); lane.addColorStop(1, "rgba(5,5,7,0)");
    g.fillStyle = lane; g.filter = `blur(${Math.round(H * 0.01)}px)`;
    g.fillRect(-W, -H * 0.03, W * 2, H * 0.08);
    g.restore();
  }

  const resize = () => {
    if (c.clientWidth === w && Math.abs(c.clientHeight - h) < 120) return;
    dpr = Math.min(devicePixelRatio, innerWidth < 760 ? 1.5 : 2);
    w = c.clientWidth; h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(520, Math.floor((w * h) / 3200));
    stars = Array.from({ length: count }, () => {
      const m = Math.pow(Math.random(), 3.2); // magnitude: many faint, few bright
      return {
        x: Math.random() * w, y: Math.random() * h, z: 0.25 + Math.random() * 0.75,
        r: 0.35 + m * 2.1, m, temp: pickTemp(),
        tw: Math.random() * 10, tws: 0.6 + Math.random() * 1.8, glow: 0, ox: 0, oy: 0, px: 0, py: 0,
      };
    });
    edges.clear();
    buildBackground();
  };

  // Pointer, with an idle "ghost" that wanders so touch users also see constellations form
  const P = { x: 0, y: 0, sx: 0, sy: 0, active: false, last: 0, power: 0 };
  host.addEventListener("pointermove", (e) => {
    const b = c.getBoundingClientRect();
    P.x = e.clientX - b.left; P.y = e.clientY - b.top; P.active = true; P.last = performance.now();
  });
  host.addEventListener("pointerleave", () => { P.active = false; });

  const edges = new Map(); // "i-j" -> alpha (fast fade-in, slow fade-out trail)
  const shots = [];
  let nextShot = 2.5 + Math.random() * 3, visible = false;
  // Nebula + 4k background stars are only built when the section gets close (keeps page load light)
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    resize(); P.sx = w / 2; P.sy = h / 2;
    addEventListener("resize", debounce(resize));
  }, { rootMargin: "100% 0px" }).observe(c);
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(c);

  // Prim's minimum spanning tree over nearby bright stars: sparse, natural constellation shapes
  function mst(ids) {
    const out = [];
    if (ids.length < 2) return out;
    const inT = new Set([ids[0]]);
    while (inT.size < ids.length) {
      let best = null, bd = Infinity;
      for (const a of inT) for (const b of ids) {
        if (inT.has(b)) continue;
        const d = (stars[a].px - stars[b].px) ** 2 + (stars[a].py - stars[b].py) ** 2;
        if (d < bd) { bd = d; best = [a, b]; }
      }
      if (!best || bd > 160 * 160) break;
      inT.add(best[1]); out.push(best[0] < best[1] ? best : [best[1], best[0]]);
    }
    return out;
  }

  gsap.ticker.add((time, dtMs) => {
    if (!visible || !w) return;
    const dt = Math.min(dtMs, 50) / 1000;
    const k = 1 - Math.pow(0.0005, dt);
    const R = Math.min(260, Math.max(170, w * 0.17));

    const idle = !P.active || performance.now() - P.last > 2500;
    const tx = idle ? w * (0.5 + 0.32 * Math.sin(time * 0.17)) : P.x;
    const ty = idle ? h * (0.5 + 0.26 * Math.sin(time * 0.23 + 1.3)) : P.y;
    const follow = idle ? 0.25 : 1;
    P.sx += (tx - P.sx) * k * follow;
    P.sy += (ty - P.sy) * k * follow;
    P.power += ((idle ? 0.55 : 1) - P.power) * k * 0.5;
    const mx = P.sx / w - 0.5, my = P.sy / h - 0.5;

    // background (slight parallax)
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(bg, -w * 0.05 - mx * w * 0.03, -h * 0.05 - my * h * 0.03, w * 1.1, h * 1.1);

    // telescope lens glow following the pointer
    ctx.globalCompositeOperation = "lighter";
    const lens = ctx.createRadialGradient(P.sx, P.sy, 0, P.sx, P.sy, R * 1.2);
    lens.addColorStop(0, `rgba(232,170,110,${0.1 * P.power})`);
    lens.addColorStop(0.5, `rgba(120,90,200,${0.05 * P.power})`);
    lens.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = lens; ctx.fillRect(P.sx - R * 1.2, P.sy - R * 1.2, R * 2.4, R * 2.4);

    // stars
    const near = [];
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      if (!reduce) { s.x += 0.012 * s.z; if (s.x > w + 4) s.x = -4; }
      const bx = s.x - mx * 40 * s.z, by = s.y - my * 30 * s.z;
      const dx = bx - P.sx, dy = by - P.sy, d = Math.hypot(dx, dy) || 1;
      const inR = d < R ? 1 - d / R : 0;
      // gentle gravitational pull towards the lens centre
      s.ox += ((-dx / d) * inR * 10 * P.power - s.ox) * k * 0.6;
      s.oy += ((-dy / d) * inR * 10 * P.power - s.oy) * k * 0.6;
      s.px = bx + s.ox; s.py = by + s.oy;
      s.glow += (inR * P.power - s.glow) * k * 0.7;
      if (inR > 0.05 && s.m > 0.12) near.push(i);

      const tw = 0.55 + 0.45 * Math.sin(time * s.tws + s.tw);
      const a = Math.min(1, (0.3 + s.m * 0.9) * tw + s.glow * 0.8);
      const size = (s.r * 5 + s.glow * 10 * (0.4 + s.m)) * (0.8 + s.z * 0.4);
      ctx.globalAlpha = a;
      ctx.drawImage(tinted[s.temp], s.px - size / 2, s.py - size / 2, size, size);
      if (s.m > 0.45 || s.glow > 0.35) {
        const sp = (14 + s.m * 30 + s.glow * 26) * (0.7 + tw * 0.3);
        ctx.globalAlpha = Math.max(0, Math.min(0.8, (s.m - 0.3) * 0.9 + s.glow * 0.6)) * tw;
        ctx.drawImage(spikes, s.px - sp / 2, s.py - sp / 2, sp, sp);
      }
    }

    // procedural constellations around the pointer (they yield when a named one lights up)
    const namedFocus = Math.max(...NAMED.map((n) => n.alpha));
    const yieldK = Math.min(1, Math.max(0, 1 - (namedFocus - 0.2) * 2.5));
    near.sort((a, b) => stars[b].glow - stars[a].glow);
    const current = new Set(mst(near.slice(0, 11)).map(([a, b]) => `${a}-${b}`));
    current.forEach((key) => { if (!edges.has(key)) edges.set(key, 0); });
    ctx.lineCap = "round";
    ctx.globalAlpha = 1;
    for (const [key, alpha] of edges) {
      const on = current.has(key);
      const na = alpha + ((on ? 1 : 0) - alpha) * k * (on ? 0.9 : 0.18);
      if (!on && na < 0.01) { edges.delete(key); continue; }
      edges.set(key, na);
      const [a, b] = key.split("-").map(Number), A = stars[a], B = stars[b];
      if (!A || !B) { edges.delete(key); continue; }
      const va = na * yieldK;
      if (va < 0.01) continue;
      const gr = ctx.createLinearGradient(A.px, A.py, B.px, B.py);
      gr.addColorStop(0, `rgba(255,236,210,${0.55 * va})`);
      gr.addColorStop(0.5, `rgba(232,162,92,${0.35 * va})`);
      gr.addColorStop(1, `rgba(255,236,210,${0.55 * va})`);
      ctx.strokeStyle = gr; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(A.px, A.py); ctx.lineTo(B.px, B.py); ctx.stroke();
      ctx.strokeStyle = `rgba(255,236,210,${0.3 * va})`; ctx.lineWidth = 0.6;
      for (const S of [A, B]) { ctx.beginPath(); ctx.arc(S.px, S.py, 4.5 + S.m * 3, 0, Math.PI * 2); ctx.stroke(); }
    }

    // named constellations
    ctx.font = "500 10px 'Geist Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    for (const n of NAMED) {
      const S = Math.min(w, h) * n.size, ccx = w * n.c[0], ccy = h * n.c[1];
      const pts = n.pts.map(([px, py]) => [ccx + (px - 0.5) * S - mx * 30, ccy + (py - 0.5) * S - my * 22]);
      const prox = Math.max(0, 1 - Math.hypot(P.sx - ccx, P.sy - ccy) / (R * 1.6)) * P.power;
      n.alpha += (0.12 + prox * 0.88 - n.alpha) * k * 0.5;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(232,162,92,${0.6 * n.alpha})`; ctx.lineWidth = 0.9;
      ctx.setLineDash([2, 5]);
      for (const [a, b] of n.edges) { ctx.beginPath(); ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); ctx.stroke(); }
      ctx.setLineDash([]);
      pts.forEach(([x, y], i) => {
        const sz = 9 + n.alpha * 16 + (i === 0 ? 4 : 0);
        ctx.globalAlpha = 0.5 + n.alpha * 0.5;
        ctx.drawImage(tinted[i % 2 ? 2 : 1], x - sz / 2, y - sz / 2, sz, sz);
        if (n.alpha > 0.3) {
          const sp = 18 + n.alpha * 22;
          ctx.globalAlpha = n.alpha * 0.55;
          ctx.drawImage(spikes, x - sp / 2, y - sp / 2, sp, sp);
        }
      });
      if (n.alpha > 0.2) {
        const low = pts.reduce((m, p) => (p[1] > m[1] ? p : m));
        ctx.globalAlpha = Math.min(1, (n.alpha - 0.2) * 1.6);
        ctx.fillStyle = "#efe8dc";
        ctx.fillText(n.name.toUpperCase(), low[0], low[1] + 26);
      }
    }

    // shooting stars
    if (time > nextShot && !reduce) {
      const ang = (14 + Math.random() * 16) * Math.PI / 180;
      shots.push({ x: Math.random() * w * 0.6, y: Math.random() * h * 0.35, ang, life: 0, dur: 0.7 + Math.random() * 0.4, len: 180 + Math.random() * 160, speed: w * 0.8 });
      nextShot = time + 3 + Math.random() * 6;
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.life += dt;
      const q = s.life / s.dur;
      if (q >= 1) { shots.splice(i, 1); continue; }
      const hx = s.x + Math.cos(s.ang) * s.speed * s.life, hy = s.y + Math.sin(s.ang) * s.speed * s.life;
      const tx2 = hx - Math.cos(s.ang) * s.len, ty2 = hy - Math.sin(s.ang) * s.len;
      const al = q < 0.55 ? 1 : 1 - (q - 0.55) / 0.45;
      const g = ctx.createLinearGradient(tx2, ty2, hx, hy);
      g.addColorStop(0, "rgba(255,236,210,0)"); g.addColorStop(0.8, `rgba(232,162,92,${0.35 * al})`); g.addColorStop(1, `rgba(255,250,240,${al})`);
      ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.globalAlpha = al; ctx.drawImage(glow, hx - 14, hy - 14, 28, 28);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  });
}

/* ============ Work hover preview ============ */
function workPreview() {
  if (!fine) return;
  const prev = $(".work__preview"), inner = $(".work__preview-inner"), title = $(".work__preview-title");
  const p = { x: mouse.x - 160, y: mouse.y - 200, rot: 0 };
  let lastX = mouse.x, active = false;
  gsap.set(prev, { scale: 0.6, x: p.x, y: p.y });
  const setX = gsap.quickSetter(prev, "x", "px"), setY = gsap.quickSetter(prev, "y", "px"), setR = gsap.quickSetter(prev, "rotation", "deg");
  const show = () => { active = true; gsap.to(prev, { opacity: 1, scale: 1, duration: 0.7, overwrite: "auto" }); };
  const hide = () => { active = false; gsap.to(prev, { opacity: 0, scale: 0.6, duration: 0.5, overwrite: "auto" }); };
  gsap.ticker.add((_, dt) => {
    if (!active && +gsap.getProperty(prev, "opacity") === 0) return;
    const k = 1 - Math.pow(0.88, dt / 16.67);
    p.x = lerp(p.x, mouse.x - 160, k); p.y = lerp(p.y, mouse.y - 200, k);
    p.rot = lerp(p.rot, (mouse.x - lastX) * 0.5, 0.08); lastX = mouse.x;
    setX(p.x); setY(p.y); setR(gsap.utils.clamp(-12, 12, p.rot));
  });
  ScrollTrigger.create({ trigger: ".work__list", start: "top bottom", end: "bottom top", onLeave: hide, onLeaveBack: hide });
  $$(".work__item").forEach((item) => {
    item.addEventListener("pointerenter", () => {
      const hue = +item.dataset.hue;
      inner.style.background = `radial-gradient(circle at 30% 28%, hsl(${hue} 92% 66%), transparent 58%),
        radial-gradient(circle at 72% 78%, hsl(${(hue + 60) % 360} 80% 46%), transparent 55%),
        linear-gradient(160deg, hsl(${hue} 40% 12%), #050506)`;
      title.textContent = item.querySelector("h3").textContent;
      show();
    });
    item.addEventListener("pointerleave", hide);
  });
}

/* ============ Variable-weight letters (Plus Jakarta Sans 200–800) ============ */
function weightHover() {
  if (!fine || reduce) return;
  $$("[data-weight]").forEach((el) => {
    const chars = $$(".ch", el).map((ch) => ({ ch, to: gsap.quickTo(ch, "fontWeight", { duration: 0.5, ease: "power2.out" }) }));
    let rects = [];
    const measure = () => (rects = chars.map(({ ch }) => { const b = ch.getBoundingClientRect(); return b.left + b.width / 2; }));
    el.closest("footer").addEventListener("pointerenter", measure);
    el.closest("footer").addEventListener("pointermove", (e) => {
      chars.forEach(({ to }, i) => to(Math.round(800 - Math.min(1, Math.abs(e.clientX - rects[i]) / 520) * 550)));
    });
    el.closest("footer").addEventListener("pointerleave", () => chars.forEach(({ to }) => to(600)));
  });
}
weightHover();

/* ============ Card spotlight ============ */
$$(".card").forEach((card) =>
  card.addEventListener("pointermove", (e) => {
    const b = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - b.left}px`);
    card.style.setProperty("--my", `${e.clientY - b.top}px`);
  })
);

/* ============ Theme ============ */
function setTheme(t) {
  document.body.dataset.theme = t;
  $('meta[name="theme-color"]').content = t === "light" ? "#efe8dc" : "#050506";
}

/* ============ Scroll choreography ============ */
function scrollAnims() {
  // Pinned sections first so later triggers include their spacing
  const services = $(".services"), track = $(".services__track");
  const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
  gsap.to(track, {
    x: () => -dist(), ease: "none",
    scrollTrigger: {
      trigger: services, start: () => (services.offsetHeight < innerHeight ? "center center" : "top top"),
      end: () => `+=${dist()}`, pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
    },
  });

  const frame = $(".showreel__frame");
  const small = () => innerWidth < 700;
  gsap.fromTo(frame,
    { width: () => innerWidth * (small() ? 0.84 : 0.36), height: () => innerWidth * (small() ? 0.4725 : 0.2025), borderRadius: 24 },
    { width: () => document.documentElement.clientWidth, height: () => innerHeight, borderRadius: 0, ease: "none",
      scrollTrigger: { trigger: ".showreel", start: "top top", end: "+=130%", pin: ".showreel__pin", scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 } });
  gsap.to(".showreel__label", { opacity: 0, y: -20, ease: "none", scrollTrigger: { trigger: ".showreel", start: "top top", end: "+=25%", scrub: true } });
  gsap.from(".showreel__title", { scale: 0.75, opacity: 0.3, transformOrigin: "left top", ease: "none", scrollTrigger: { trigger: ".showreel", start: "top top", end: "+=130%", scrub: 0.6 } });

  // Headline reveals (masked lines)
  $$(".h2[data-split]").forEach((h) =>
    gsap.from($$(".line__in", h), { yPercent: 115, rotate: 4, transformOrigin: "0 100%", duration: 1.5, stagger: 0.09, scrollTrigger: { trigger: h, start: "top 85%" } })
  );
  $$(".eyebrow:not(.hero__eyebrow)").forEach((e) =>
    gsap.from(e, { opacity: 0, x: -20, duration: 1, scrollTrigger: { trigger: e, start: "top 90%" } })
  );

  // Manifesto words light up
  gsap.to(".manifesto__text .word", {
    opacity: 1, stagger: 0.05, ease: "none",
    scrollTrigger: { trigger: ".manifesto__text", start: "top 78%", end: "bottom 50%", scrub: 0.5 },
  });

  // Counters
  $$(".stat__num").forEach((n) => {
    const o = { v: 0 };
    gsap.to(o, { v: +n.dataset.count, duration: 2.4, ease: "power3.out", onUpdate: () => (n.textContent = Math.round(o.v)), scrollTrigger: { trigger: n, start: "top 90%" } });
  });

  // Cards
  gsap.from(".card", { x: 100, opacity: 0, stagger: 0.07, duration: 1.4, clearProps: "transform,opacity", scrollTrigger: { trigger: ".services__track", start: "top 85%" } });

  // Work list
  gsap.fromTo(".work__item", { y: 50, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.07, duration: 1.2, clearProps: "transform,opacity,visibility", scrollTrigger: { trigger: ".work__list", start: "top 85%" } });

  // Steps
  $$(".step").forEach((s) => gsap.from(s, { y: 70, opacity: 0, duration: 1.3, clearProps: "transform,opacity", scrollTrigger: { trigger: s, start: "top 90%" } }));

  // CTA + footer
  gsap.from(".cta__in", { yPercent: 110, duration: 1.6, stagger: 0.1, scrollTrigger: { trigger: ".cta", start: "top 70%" } });
  gsap.from(".footer__giant .ch", { yPercent: 105, duration: 1.4, stagger: 0.05, scrollTrigger: { trigger: ".footer", start: "top 92%" } });

  // Theme: light zone from Process to the end
  ScrollTrigger.create({
    trigger: ".process", start: "top 55%",
    onEnter: () => setTheme("light"), onLeaveBack: () => setTheme("dark"),
  });

  // Hero exit parallax + scene scroll state
  gsap.to(".hero__inner", { yPercent: -16, opacity: 0, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  ScrollTrigger.create({ trigger: ".hero", start: "top top", end: "bottom top", onUpdate: (s) => scene && (scene.state.scroll = s.progress) });
  if ($(".hero__media")) gsap.to(".hero__media", { scale: 1.14, yPercent: 10, opacity: 0.25, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

  // Marquee velocity skew
  const skewTo = gsap.quickTo(".marquee__skew", "skewX", { duration: 0.6, ease: "power3" });
  ScrollTrigger.create({ onUpdate: (s) => skewTo(gsap.utils.clamp(-10, 10, s.getVelocity() / -350)) });

  // Read progress
  gsap.to(".progress span", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

  // Nav hide on scroll down
  const nav = $(".nav");
  nav.addEventListener("focusin", () => nav.classList.remove("is-hidden"));
  ScrollTrigger.create({ onUpdate: (s) => nav.classList.toggle("is-hidden", s.direction === 1 && s.scroll() > 240 && !menuOpen) });
}

/* ============ Loader + intro ============ */
function revealStatic() {
  $("#loader").remove();
  document.body.classList.remove("is-loading");
  heroPromise.then(() => scene && (scene.state.intro = 1));
  $$(".manifesto__text .word").forEach((w) => (w.style.opacity = 1));
  $$(".stat__num").forEach((n) => (n.textContent = n.dataset.count));
}

function intro() {
  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  gsap.set("#loader", { clipPath: "inset(0% 0% 0% 0%)" });
  tl.to(".loader__word, .loader__subin", { yPercent: -110, duration: 0.9, ease: "power3.in", stagger: 0.06 })
    .to(".loader__ring", { scale: 1.5, opacity: 0, duration: 1.1, ease: "expo.inOut" }, 0)
    .to(".loader__top, .loader__foot, .loader__bar", { opacity: 0, duration: 0.5, ease: "power2.out" }, 0)
    .add(() => { document.body.classList.remove("is-loading"); lenis?.start(); }, 0.7)
    .to("#loader", { clipPath: "inset(0% 0% 100% 0%)", duration: 1.25, ease: EASE("wipe", "expo.inOut") }, 0.55)
    .to(".loader__center", { y: "-12vh", opacity: 0, duration: 1.25, ease: EASE("wipe", "expo.inOut") }, 0.55)
    .add(() => scene && gsap.to(scene.state, { intro: 1, duration: 3.2, ease: "expo.out" }), 0.85)
    .add(() => heroVideo?.start(), 0.55)
    .fromTo(".hero__zoom", { scale: 1.25, opacity: 0 }, { scale: 1.03, opacity: 1, duration: 3.2, ease: "expo.out" }, 0.6)
    .from(".hero__title .ch", { yPercent: 120, rotate: 7, transformOrigin: "0% 100%", duration: 1.7, stagger: 0.022 }, 1.15)
    .from(".hero__eyebrow .line__in", { yPercent: 110, duration: 1.2 }, 1.35)
    .fromTo(".hero .fade-in", { y: 14, opacity: 0, filter: "blur(6px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 1.3, ease: EASE("radial", "power3.out"), stagger: 0.1, clearProps: "filter" }, 1.45)
    .from(".nav > *", { y: -24, opacity: 0, duration: 1.2, stagger: 0.05 }, 1.4)
    .set("#loader", { display: "none" });
}

function loader() {
  const count = $("#loaderCount"), bar = $("#loaderBar"), prog = $(".loader__prog"), orbit = $(".loader__orbit"), msg = $("#loaderMsg");
  const messages = ["Calibrando o céu", "Alinhando órbitas", "Acendendo estrelas"];
  // Weighted real progress (page 30 / fonts 20 / hero video or 3D 50) with an asymptotic
  // creep so the counter never stalls, a 1.6s minimum and a 6s safety net.
  let loaded = 0, shown = 0, msgIndex = 0, done = false, forced = false, msgTl = null;
  const t0 = performance.now(), MIN = 1600;
  const add = (w) => () => (loaded += w);
  // the font stylesheet is non-blocking: wait for it, then for the font files themselves
  new Promise((res) => {
    const l = $("#fontcss");
    if (!l || l.media === "all") return res();
    l.addEventListener("load", res, { once: true });
    setTimeout(res, 3000);
  }).then(() => document.fonts.ready).then(() => { add(20)(); ScrollTrigger.refresh(); });
  heroPromise.then(add(50));
  if (document.readyState === "complete") loaded += 30; else addEventListener("load", add(30), { once: true });
  setTimeout(() => (forced = true), 6000);

  const update = () => {
    if (done) return;
    const t = performance.now() - t0;
    const all = forced || loaded >= 100;
    const creep = all ? 100 : Math.min(99, loaded + (100 - loaded) * 0.6 * (1 - Math.exp(-t / 2200)));
    const goal = Math.min(creep, (t / MIN) * 100) / 100;
    shown += (goal - shown) * (all ? 0.14 : 0.08);
    if (all && goal >= 1 && shown > 0.996) shown = 1;
    count.textContent = String(Math.round(shown * 100)).padStart(3, "0");
    bar.style.transform = `scaleX(${shown})`;
    prog.style.strokeDashoffset = 1 - shown;
    orbit.style.transform = `rotate(${shown * 360}deg)`;
    const mi = Math.min(messages.length - 1, Math.floor(shown * messages.length));
    if (mi !== msgIndex) {
      msgIndex = mi;
      msgTl?.kill();
      msgTl = gsap.timeline()
        .to(msg, { yPercent: -110, duration: 0.35, ease: "power2.in" })
        .add(() => (msg.textContent = messages[mi]))
        .fromTo(msg, { yPercent: 110 }, { yPercent: 0, duration: 0.6 });
    }
    if (shown === 1) {
      done = true; gsap.ticker.remove(update);
      setTimeout(() => { msgTl?.progress(1).kill(); intro(); }, 220);
    }
  };
  gsap.from(".loader__word, .loader__subin", { yPercent: 110, duration: 1.2, stagger: 0.08, delay: 0.1 });
  gsap.from(".loader__ring", { scale: 0.85, opacity: 0, duration: 1.6, ease: "expo.out" });
  gsap.ticker.add(update);
}

reelCanvas();
skyCanvas();
if (reduce) { revealStatic(); scrollAnimsReduced(); }
else {
  // Scroll choreography is built behind the loader, before window "load", so ScrollTrigger
  // measures everything in a single batched refresh instead of ~25 forced layouts at intro time.
  scrollAnims();
  workPreview();
  loader();
}

function scrollAnimsReduced() {
  ScrollTrigger.create({
    trigger: ".process", start: "top 55%",
    onEnter: () => setTheme("light"), onLeaveBack: () => setTheme("dark"),
  });
  $(".showreel__frame").style.cssText = "width:min(90vw,1100px);height:auto;aspect-ratio:16/9";
  $(".services").style.overflowX = "auto";
}
