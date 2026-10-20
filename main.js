/* NÉBULA — main.js (module) */
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;

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

/* ============ 3D scene ============ */
let scene = null;
const scenePromise = import("./scene.js")
  .then(({ createScene }) => {
    scene = createScene($("#gl"), { reduce });
    gsap.ticker.add(scene.render);
  })
  .catch((err) => console.warn("Cena 3D indisponível:", err));

/* ============ Pointer + cursor ============ */
const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
const heroEl = $(".hero");
window.addEventListener("pointermove", (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
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
  resize(); addEventListener("resize", resize);
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
  let w = 0, h = 0, stars = [];
  const local = { x: -9999, y: -9999, sx: -9999, sy: -9999 };
  const resize = () => {
    if (c.clientWidth === w && Math.abs(c.clientHeight - h) < 120) return;
    const dpr = Math.min(devicePixelRatio, 2);
    w = c.clientWidth; h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.min(420, Math.floor((w * h) / 4800)) }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.25,
      vx: (Math.random() - 0.5) * 0.06, vy: (Math.random() - 0.5) * 0.06, tw: Math.random() * 6, ox: 0, oy: 0,
    }));
  };
  resize(); addEventListener("resize", resize);
  const host = c.parentElement;
  host.addEventListener("pointermove", (e) => { const b = c.getBoundingClientRect(); local.x = e.clientX - b.left; local.y = e.clientY - b.top; });
  host.addEventListener("pointerleave", () => { local.x = local.y = -9999; });
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(c);
  const R = 180;
  const near = [];
  // Shooting stars (mapadoastro): every 3–9s, 0.6–0.95s life, 12–30° angle
  const shots = [];
  let nextShot = 3.5 + Math.random() * 3;
  const drawShots = (time, dt) => {
    if (time > nextShot && !reduce) {
      const ang = (12 + Math.random() * 18) * Math.PI / 180;
      shots.push({ x: Math.random() * w * 0.7, y: Math.random() * h * 0.4, ang, life: 0, dur: 0.6 + Math.random() * 0.35, len: 160 + Math.random() * 140, speed: w * 0.9 });
      nextShot = time + 3 + Math.random() * 6;
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.life += dt;
      const k = s.life / s.dur;
      if (k >= 1) { shots.splice(i, 1); continue; }
      const hx = s.x + Math.cos(s.ang) * s.speed * s.life, hy = s.y + Math.sin(s.ang) * s.speed * s.life;
      const tx = hx - Math.cos(s.ang) * s.len, ty = hy - Math.sin(s.ang) * s.len;
      const alpha = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      const g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, "rgba(239,232,220,0)"); g.addColorStop(1, `rgba(255,248,235,${alpha})`);
      ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = `rgba(255,248,235,${alpha})`;
      ctx.beginPath(); ctx.arc(hx, hy, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  };
  gsap.ticker.add((time, dtMs) => {
    if (!visible) return;
    if (local.x < -999) { local.sx = local.x; local.sy = local.y; }
    else if (local.sx < -999) { local.sx = local.x; local.sy = local.y; }
    else { local.sx = lerp(local.sx, local.x, 0.15); local.sy = lerp(local.sy, local.y, 0.15); }
    ctx.clearRect(0, 0, w, h);
    let nn = 0;
    for (const s of stars) {
      if (!reduce) { s.x += s.vx; s.y += s.vy; }
      if (s.x < 0) s.x = w; else if (s.x > w) s.x = 0;
      if (s.y < 0) s.y = h; else if (s.y > h) s.y = 0;
      const dx = s.x - local.sx, dy = s.y - local.sy, d = Math.hypot(dx, dy) || 1;
      const f = d < R ? (1 - d / R) * 16 : 0;
      s.ox = lerp(s.ox, (dx / d) * f, 0.12); s.oy = lerp(s.oy, (dy / d) * f, 0.12);
      const x = s.x + s.ox, y = s.y + s.oy;
      const a = 0.3 + 0.7 * Math.abs(Math.sin(time * 0.9 + s.tw));
      if (d < R) { const o = near[nn] || (near[nn] = { x: 0, y: 0 }); o.x = x; o.y = y; nn++; }
      ctx.fillStyle = d < R ? `rgba(186,254,2,${0.5 + a * 0.5})` : `rgba(239,232,220,${a * 0.75})`;
      ctx.beginPath(); ctx.arc(x, y, d < R ? s.r + 0.7 : s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineWidth = 0.6;
    for (let i = 0; i < nn; i++) {
      for (let j = i + 1; j < nn; j++) {
        const dd = Math.hypot(near[i].x - near[j].x, near[i].y - near[j].y);
        if (dd < 95) {
          ctx.strokeStyle = `rgba(232,162,92,${(1 - dd / 95) * 0.65})`;
          ctx.beginPath(); ctx.moveTo(near[i].x, near[i].y); ctx.lineTo(near[j].x, near[j].y); ctx.stroke();
        }
      }
    }
    drawShots(time, Math.min(dtMs, 50) / 1000);
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
  scenePromise.then(() => scene && (scene.state.intro = 1));
  $$(".manifesto__text .word").forEach((w) => (w.style.opacity = 1));
  $$(".stat__num").forEach((n) => (n.textContent = n.dataset.count));
}

function intro() {
  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  gsap.set("#loader", { clipPath: "inset(0% 0% 0% 0%)" });
  tl.to(".loader__word, .loader__subin", { yPercent: -110, duration: 0.9, ease: "power3.in", stagger: 0.06 })
    .to(".loader__ring", { scale: 1.5, opacity: 0, duration: 1.1, ease: "expo.inOut" }, 0)
    .to(".loader__top, .loader__foot, .loader__bar", { opacity: 0, duration: 0.5, ease: "power2.out" }, 0)
    .add(() => { document.body.classList.remove("is-loading"); lenis?.start(); ScrollTrigger.refresh(); }, 0.7)
    .to("#loader", { clipPath: "inset(0% 0% 100% 0%)", duration: 1.25, ease: EASE("wipe", "expo.inOut") }, 0.55)
    .to(".loader__center", { y: "-12vh", opacity: 0, duration: 1.25, ease: EASE("wipe", "expo.inOut") }, 0.55)
    .add(() => scene && gsap.to(scene.state, { intro: 1, duration: 3.2, ease: "expo.out" }), 0.85)
    .from(".hero__title .ch", { yPercent: 120, rotate: 7, transformOrigin: "0% 100%", duration: 1.7, stagger: 0.022 }, 1.15)
    .from(".hero__eyebrow .line__in", { yPercent: 110, duration: 1.2 }, 1.35)
    .fromTo(".hero .fade-in", { y: 14, opacity: 0, filter: "blur(6px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 1.3, ease: EASE("radial", "power3.out"), stagger: 0.1, clearProps: "filter" }, 1.45)
    .from(".nav > *", { y: -24, opacity: 0, duration: 1.2, stagger: 0.05 }, 1.4)
    .set("#loader", { display: "none" });
  scrollAnims();
  workPreview();
  ScrollTrigger.refresh();
}

function loader() {
  const count = $("#loaderCount"), bar = $("#loaderBar"), prog = $(".loader__prog"), orbit = $(".loader__orbit"), msg = $("#loaderMsg");
  const messages = ["Calibrando o céu", "Alinhando órbitas", "Acendendo estrelas"];
  // Weighted real progress (page 30 / fonts 20 / 3D scene 50) with an asymptotic
  // creep so the counter never stalls, a 1.6s minimum and a 6s safety net.
  let loaded = 0, shown = 0, msgIndex = 0, done = false, forced = false, msgTl = null;
  const t0 = performance.now(), MIN = 1600;
  const add = (w) => () => (loaded += w);
  document.fonts.ready.then(add(20));
  scenePromise.then(add(50));
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
if (reduce) { revealStatic(); scrollAnimsReduced(); } else loader();

function scrollAnimsReduced() {
  ScrollTrigger.create({
    trigger: ".process", start: "top 55%",
    onEnter: () => setTheme("light"), onLeaveBack: () => setTheme("dark"),
  });
  $(".showreel__frame").style.cssText = "width:min(90vw,1100px);height:auto;aspect-ratio:16/9";
  $(".services").style.overflowX = "auto";
}
