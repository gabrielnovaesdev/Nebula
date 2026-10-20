/* NÉBULA — hero 3D scene (Three.js)
   Iridescent liquid orb + planetary particle ring + star dust. */
import * as THREE from "three";

const NOISE = /* glsl */ `
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

const ORB_VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform vec3 uPointer;
uniform float uPointerForce;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
${NOISE}
float field(vec3 p){
  float n = snoise(p * uFreq + vec3(0.0, uTime * 0.22, uTime * 0.12));
  n += 0.18 * snoise(p * uFreq * 2.1 - vec3(uTime * 0.16));
  return n;
}
vec3 displace(vec3 p){
  vec3 dir = normalize(p);
  float n = field(p);
  float pull = (1.0 - smoothstep(0.0, 1.1, distance(dir, uPointer))) * uPointerForce;
  return p + dir * (n * uAmp + pull * 0.2);
}
void main(){
  vec3 n = normalize(normal);
  vec3 t = normalize(abs(n.y) > 0.99 ? cross(n, vec3(1.0, 0.0, 0.0)) : cross(n, vec3(0.0, 1.0, 0.0)));
  vec3 b = normalize(cross(n, t));
  float e = 0.012;
  vec3 p0 = displace(position);
  vec3 p1 = displace(position + t * e);
  vec3 p2 = displace(position + b * e);
  vec3 dn = normalize(cross(p1 - p0, p2 - p0));
  if (dot(dn, n) < 0.0) dn = -dn;
  vNoise = field(position);
  vec4 mv = modelViewMatrix * vec4(p0, 1.0);
  vView = -mv.xyz;
  vNormal = normalize(normalMatrix * dn);
  gl_Position = projectionMatrix * mv;
}`;

const ORB_FRAG = /* glsl */ `
uniform float uTime;
uniform float uIntro;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
vec3 ramp(float t){
  vec3 c0 = vec3(0.10, 0.04, 0.42);  // indigo
  vec3 c1 = vec3(0.90, 0.50, 0.42);  // coral
  vec3 c2 = vec3(0.91, 0.64, 0.36);  // amber
  vec3 c3 = vec3(0.73, 1.00, 0.01);  // lime
  t = fract(t) * 4.0;
  if (t < 1.0) return mix(c0, c1, smoothstep(0.0, 1.0, t));
  if (t < 2.0) return mix(c1, c2, smoothstep(1.0, 2.0, t));
  if (t < 3.0) return mix(c2, c3, smoothstep(2.0, 3.0, t) * 0.3);
  return mix(mix(c2, c3, 0.3), c0, smoothstep(3.0, 4.0, t));
}
void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vView);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.6);
  vec3 L = normalize(vec3(0.6, 0.8, 0.7));
  vec3 H = normalize(L + V);
  float diff = clamp(dot(N, L), 0.0, 1.0);
  float spec = pow(clamp(dot(N, H), 0.0, 1.0), 64.0);
  vec3 L2 = normalize(vec3(-0.8, -0.3, 0.4));
  float back = pow(clamp(dot(N, L2), 0.0, 1.0), 3.0);

  vec3 irid = ramp(ndv * 0.9 + vNoise * 0.22 + uTime * 0.03);
  vec3 base = vec3(0.025, 0.022, 0.03);
  vec3 col = mix(base, irid * 0.85, 0.18 + diff * 0.45);
  col += irid * fres * 1.05;
  col += vec3(0.29, 0.13, 0.95) * back * 0.35;
  col += vec3(1.0, 0.95, 0.88) * spec * 0.9;
  col *= uIntro;
  gl_FragColor = vec4(col, 1.0);
}`;

const RING_VERT = /* glsl */ `
uniform float uTime;
uniform float uIntro;
uniform float uPixel;
uniform float uSpread;
attribute float aRadius;
attribute float aAngle;
attribute float aHeight;
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
void main(){
  float r = aRadius * mix(0.2, 1.0, uIntro) * uSpread;
  float a = aAngle + uTime * 0.55 / pow(aRadius, 1.5);
  vec3 p = vec3(cos(a) * r, aHeight * (0.6 + uSpread * 0.4), sin(a) * r);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixel * (30.0 / -mv.z);
  vColor = aColor;
  vAlpha = uIntro * smoothstep(-14.0, -6.0, mv.z);
}`;

const POINT_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.05, 0.5, d);
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

const DUST_VERT = /* glsl */ `
uniform float uTime;
uniform float uPixel;
uniform float uIntro;
attribute float aSize;
attribute float aPhase;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * uPixel * (46.0 / -mv.z), 6.0 * uPixel);
  vColor = vec3(0.94, 0.91, 0.86);
  vAlpha = uIntro * (0.35 + 0.65 * abs(sin(uTime * 0.8 + aPhase)));
}`;

const GLOW_FRAG = /* glsl */ `
uniform float uIntro;
varying vec2 vUv;
void main(){
  float d = length(vUv - 0.5);
  float g = 1.0 - smoothstep(0.0, 0.5, d);
  vec3 col = mix(vec3(0.13, 0.03, 0.55), vec3(0.91, 0.55, 0.35), g * g);
  gl_FragColor = vec4(col, g * g * 0.55 * uIntro);
}`;

export function createScene(canvas, { reduce = false } = {}) {
  const small = window.innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  const dpr = Math.min(window.devicePixelRatio, small ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  const root = new THREE.Group();
  scene.add(root);

  /* Orb */
  const orbUniforms = {
    uTime: { value: 0 }, uAmp: { value: 0.18 }, uFreq: { value: 0.72 },
    uPointer: { value: new THREE.Vector3(0, 0, 1) }, uPointerForce: { value: 0 }, uIntro: { value: 0 },
  };
  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.05, small ? 26 : 44),
    new THREE.ShaderMaterial({ uniforms: orbUniforms, vertexShader: ORB_VERT, fragmentShader: ORB_FRAG })
  );
  root.add(orb);

  /* Glow billboard */
  const glowUniforms = { uIntro: { value: 0 } };
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.ShaderMaterial({
      uniforms: glowUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: GLOW_FRAG,
    })
  );
  glow.position.z = -2;
  root.add(glow);

  /* Ring */
  const RING = small ? 4000 : 7000;
  const ringGeo = new THREE.BufferGeometry();
  const radius = new Float32Array(RING), angle = new Float32Array(RING), height = new Float32Array(RING),
    size = new Float32Array(RING), color = new Float32Array(RING * 3);
  const palette = [[0.94, 0.91, 0.86], [0.91, 0.64, 0.36], [0.90, 0.50, 0.42], [0.73, 1.0, 0.01]];
  for (let i = 0; i < RING; i++) {
    const band = Math.random();
    radius[i] = 1.75 + Math.pow(Math.random(), 1.7) * 1.9 + (band > 0.82 ? 0.28 : 0);
    angle[i] = Math.random() * Math.PI * 2;
    const g = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    height[i] = g * 0.07 * radius[i];
    size[i] = Math.random() * 1.6 + 0.4;
    const c = palette[Math.random() < 0.62 ? 0 : Math.random() < 0.6 ? 1 : Math.random() < 0.7 ? 2 : 3];
    color.set(c, i * 3);
  }
  ringGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(RING * 3), 3));
  ringGeo.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
  ringGeo.setAttribute("aAngle", new THREE.BufferAttribute(angle, 1));
  ringGeo.setAttribute("aHeight", new THREE.BufferAttribute(height, 1));
  ringGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  ringGeo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  ringGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
  const ringUniforms = { uTime: { value: 0 }, uIntro: { value: 0 }, uPixel: { value: dpr }, uSpread: { value: 1 } };
  const ring = new THREE.Points(ringGeo, new THREE.ShaderMaterial({
    uniforms: ringUniforms, vertexShader: RING_VERT, fragmentShader: POINT_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const ringPivot = new THREE.Group();
  ringPivot.rotation.set(1.18, 0, 0.32);
  ringPivot.add(ring);
  root.add(ringPivot);

  /* Dust */
  const DUST = small ? 700 : 1400;
  const dustPos = new Float32Array(DUST * 3), dustSize = new Float32Array(DUST), dustPhase = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const r = 8 + Math.random() * 22, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    dustPos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph) - 10], i * 3);
    dustSize[i] = Math.random() * 1.4 + 0.3;
    dustPhase[i] = Math.random() * 10;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute("aSize", new THREE.BufferAttribute(dustSize, 1));
  dustGeo.setAttribute("aPhase", new THREE.BufferAttribute(dustPhase, 1));
  const dustUniforms = { uTime: { value: 0 }, uPixel: { value: dpr }, uIntro: { value: 0 } };
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    uniforms: dustUniforms, vertexShader: DUST_VERT, fragmentShader: POINT_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(dust);

  /* State driven from outside (GSAP tweens these) */
  const state = { intro: 0, scroll: 0, mx: 0, my: 0, hover: 0 };
  const smooth = { mx: 0, my: 0, scroll: 0, hover: 0 };
  const pointer = new THREE.Vector3();

  const layout = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const mobile = w < 760;
    root.userData.baseX = mobile ? 0 : w / h > 1.6 ? 2.3 : 1.7;
    root.userData.baseY = mobile ? 1.25 : 0.35;
    root.userData.baseScale = mobile ? 0.62 : 1;
  };
  layout();
  window.addEventListener("resize", layout);

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  let elapsed = 0;
  function render() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;
    elapsed += reduce ? 0 : dt;
    const k = 1 - Math.pow(0.001, dt); // frame-rate independent smoothing
    smooth.mx += (state.mx - smooth.mx) * k * 0.9;
    smooth.my += (state.my - smooth.my) * k * 0.9;
    smooth.scroll += (state.scroll - smooth.scroll) * k;
    smooth.hover += (state.hover - smooth.hover) * k * 0.6;
    const s = smooth.scroll, intro = state.intro;

    orbUniforms.uTime.value = elapsed;
    orbUniforms.uIntro.value = intro;
    orbUniforms.uAmp.value = 0.17 + s * 0.3 + smooth.hover * 0.05;
    orbUniforms.uFreq.value = 0.72 + s * 0.5;
    pointer.set(smooth.mx, smooth.my, 0.85).normalize();
    orbUniforms.uPointer.value.copy(pointer);
    orbUniforms.uPointerForce.value = smooth.hover;
    ringUniforms.uTime.value = elapsed;
    ringUniforms.uIntro.value = intro;
    ringUniforms.uSpread.value = 1 + s * 0.6;
    dustUniforms.uTime.value = elapsed;
    dustUniforms.uIntro.value = intro;
    glowUniforms.uIntro.value = intro;

    const { baseX, baseY, baseScale } = root.userData;
    root.position.set(baseX * (1 - s * 0.6), baseY + s * 1.6, 0);
    const sc = baseScale * (0.55 + 0.45 * intro) * (1 - s * 0.25);
    root.scale.setScalar(sc);
    orb.rotation.y = elapsed * 0.12 + smooth.mx * 0.5;
    orb.rotation.x = smooth.my * -0.35;
    ringPivot.rotation.x = 1.18 + smooth.my * 0.18 - s * 0.35;
    ringPivot.rotation.z = 0.32 + smooth.mx * 0.12;
    dust.rotation.y = elapsed * 0.01 + smooth.mx * 0.05;
    dust.rotation.x = smooth.my * 0.04;
    camera.position.z = 10.5 + (1 - intro) * 6;
    camera.position.x = smooth.mx * 0.35;
    camera.position.y = smooth.my * 0.25;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  renderer.compile(scene, camera);
  render();
  return { state, render };
}
