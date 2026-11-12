// ═══════════ مشهد العرض الترويجي (Scroll-driven) ═══════════
// المشهد بيقرا كائن حالة واحد (PromoState) والـ GSAP master timeline هو اللي بيحرّكه مع السكرول.
import * as THREE from 'three'
import { Chain, Debris, buildStar, canvasTexture, clamp, disposeTree, drawStar2D, ease, lerp, makeGlow, makePath, roundRectPath, tri, type ChainPath, type Stage, type StarHandle } from './kit'
import { displayFont, nextFrame } from './env'

/** كل القيم اللي الـ timeline بيحرّكها (والـ render loop بيقراها) */
export type PromoState = {
  cx: number; cy: number; cz: number          // موضع الكاميرا
  lx: number; ly: number; lz: number          // نقطة النظر
  theme: number                               // 0..4 (القسم) — بيتحوّل لألوان
  shatter: number; sphere: number; ring: number
  disperse: number; debrisScale: number; spin: number
  path: number; chainGrow: number; chainSpeed: number; chainSilver: number; sway: number; scrollGain: number
  cards: number; scroll: number
  starScale: number; introCam: number
  blur: number; neon: number; badge: number
  mx: number; my: number                      // موضع الماوس (-1..1) بعد التنعيم
  boost: number                               // دفعة للسلسلة عند hover على عناصر القايمة
}

export const createPromoState = (): PromoState => ({
  cx: 0, cy: 0, cz: 10.5, lx: 0, ly: 0, lz: 0,
  theme: 0, shatter: 0, sphere: 0, ring: 0, disperse: 0, debrisScale: 1, spin: 1,
  path: 0, chainGrow: 0, chainSpeed: 0.35, chainSilver: 0, sway: 0, scrollGain: 55,
  cards: 1, scroll: 0, starScale: 0, introCam: 1, blur: 0, neon: 0, badge: 0, mx: 0, my: 0, boost: 0,
})

// ألوان كل قسم: الخلفية، الإضاءة، الـ fog، الـ bloom… والـ render بيمزج بينهم بسلاسة
type ThemeDef = { bg: string; key: string; keyI: number; rim: string; rimI: number; accent: string; accentI: number; env: number; bloom: number; fog: number; glow: number; glow2: number; text: string; textA: number; exposure: number }
const THEME_DEFS: ThemeDef[] = [
  /* HERO     */ { bg: '#eceef1', key: '#ffffff', keyI: 2.6, rim: '#ffffff', rimI: 0.8, accent: '#ff2233', accentI: 0, env: 1.15, bloom: 0.1, fog: 0.008, glow: 0, glow2: 0, text: '#0a0a0c', textA: 1, exposure: 1.3 },
  /* WORK     */ { bg: '#25272a', key: '#ffffff', keyI: 2.2, rim: '#9fb0ff', rimI: 1.4, accent: '#ff2233', accentI: 6, env: 0.85, bloom: 0.25, fog: 0.018, glow: 0.15, glow2: 0, text: '#ffffff', textA: 0.05, exposure: 1.05 },
  /* SERVICES */ { bg: '#050404', key: '#ffffff', keyI: 1.6, rim: '#ffffff', rimI: 1.6, accent: '#ff1a2b', accentI: 16, env: 0.75, bloom: 0.5, fog: 0.028, glow: 0.9, glow2: 0, text: '#ffffff', textA: 0, exposure: 1 },
  /* SHOWCASE */ { bg: '#1a0206', key: '#ff3b4a', keyI: 1.4, rim: '#19f0ff', rimI: 8, accent: '#ff1a2b', accentI: 12, env: 0.95, bloom: 0.9, fog: 0.026, glow: 0.6, glow2: 0.55, text: '#ffffff', textA: 0, exposure: 1 },
  /* FOOTER   */ { bg: '#3a040a', key: '#ff5a60', keyI: 1.3, rim: '#19f0ff', rimI: 3.5, accent: '#ff2233', accentI: 7, env: 0.65, bloom: 0.55, fog: 0.018, glow: 0.5, glow2: 0.25, text: '#ffffff', textA: 0, exposure: 1 },
]
const THEMES = THEME_DEFS.map((t) => ({
  ...t,
  bgC: new THREE.Color(t.bg), keyC: new THREE.Color(t.key), rimC: new THREE.Color(t.rim), accC: new THREE.Color(t.accent), textC: new THREE.Color(t.text),
}))

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function buildPaths(hangX: number): ChainPath[] {
  // 0) تلتف حوالين النجمة (حلقات)  1) تعدّي الشاشة  2) خدمات (فضّية)  3) سريعة قدّام الكاميرا  4) معلّقة من فوق
  const wrap: THREE.Vector3[] = [V(-14, -6, 2), V(-9, -3.5, 1.5)]
  const N = 26
  for (let k = 0; k <= N; k++) {
    const th = -0.6 + (k / N) * Math.PI * 2 * 2.3
    const R = 3.1 + 0.35 * Math.sin(th * 2)
    wrap.push(V(Math.cos(th) * R, Math.sin(th) * R * 0.92, Math.sin(th * 1.5) * 1.5))
  }
  wrap.push(V(9, 4, -1), V(14, 6.5, -2))
  return [
    makePath(wrap),
    makePath([V(-15, -4, 3), V(-9, -2, 1.5), V(-4, 0.2, 3), V(1, -1.2, 3.8), V(6, 1.2, 2.2), V(11, 2.6, 0.5), V(16, 4, -1)]),
    makePath([V(-16, 3, 2), V(-8, 1.6, 3.5), V(-1, 2.4, 4), V(6, 0.4, 3), V(11, -1.2, 1.5), V(17, -0.5, 0)]),
    makePath([V(-15, -4, -2), V(-8, 3, 3), V(-2, -2, 5.5), V(3, 3, 3), V(8, -2.4, 5), V(12, 2, 1), V(17, 3, -2)]),
    makePath([V(hangX, 17, 0), V(hangX + 0.02, 11, 0.1), V(hangX - 0.04, 6, -0.05), V(hangX, 2.6, 0)]),
  ]
}

type CardSpec = { title: string; sub: string; a: string; b: string; ink: string; sec: number; pos: [number, number, number]; size: [number, number]; ry: number; par: number; big?: string }
const CARD_SPECS: CardSpec[] = [
  { title: 'كاش عند الاستلام', sub: 'PAY ON DELIVERY', a: '#e5101f', b: '#3a0208', ink: '#fff', sec: 1, pos: [-5.6, 1.3, -1.2], size: [2.3, 2.9], ry: 0.28, par: 1.3 },
  { title: 'شحن لكل المحافظات', sub: 'EGYPT-WIDE', a: '#1b1c20', b: '#34363d', ink: '#fff', sec: 1, pos: [5.9, -1.5, -0.6], size: [2.6, 1.8], ry: -0.3, par: 0.8 },
  { title: 'RTX', sub: 'SHOP', a: '#f6f7f9', b: '#c6cad2', ink: '#0b0b0d', sec: 1, pos: [-3.3, -2.6, 1.2], size: [1.7, 2.1], ry: 0.2, par: 1.7, big: 'RTX' },
  { title: 'أقسام ومنتجات', sub: 'CATEGORIES', a: '#e5101f', b: '#16161a', ink: '#fff', sec: 1, pos: [4.3, 2.4, 0.4], size: [2, 2.5], ry: -0.22, par: 1.1 },
  { title: 'طلباتك في مكان واحد', sub: 'YOUR ORDERS', a: '#19f0ff', b: '#06323a', ink: '#021014', sec: 3, pos: [-5.2, 0.6, 0.4], size: [2.4, 3], ry: 0.3, par: 1.2 },
  { title: 'ادخل المتجر', sub: 'ENTER', a: '#e5101f', b: '#52030b', ink: '#fff', sec: 3, pos: [5.4, 1.7, 1], size: [2.4, 2.4], ry: -0.28, par: 1.5 },
  { title: 'كاش · شحن · توصيل', sub: 'RTX SHOP', a: '#0c0c0f', b: '#25262b', ink: '#fff', sec: 3, pos: [-1.8, -2.8, 2.4], size: [2.3, 1.5], ry: 0.15, par: 1.9 },
  { title: 'حسابك. طلباتك.', sub: 'ACCOUNT', a: '#19f0ff', b: '#e5101f', ink: '#050505', sec: 3, pos: [3, -1.1, 3.2], size: [1.5, 1.9], ry: -0.18, par: 2.2 },
]

type Card = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; spec: CardSpec; base: THREE.Vector3 }

export class PromoScene {
  group = new THREE.Group()
  star: StarHandle
  debris: Debris
  chain: Chain
  /** هل الخلفية فاتحة؟ (الـ UI بيقلب لون النص حسبها) */
  lightBg = true

  private paths: ChainPath[]
  private glowRed = makeGlow('rgba(255,26,43,1)', 22)
  private glowCyan = makeGlow('rgba(25,240,255,1)', 18)
  private title: THREE.Mesh
  private titleMat: THREE.MeshBasicMaterial
  private cards: Card[] = []
  private badge: THREE.Mesh | null = null
  private key = new THREE.DirectionalLight(0xffffff, 2)
  private rim = new THREE.DirectionalLight(0x19f0ff, 1)
  private accent = new THREE.PointLight(0xff2233, 0, 0, 2)
  private hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.25)
  private bg = new THREE.Color()
  private phase = 0
  private prevScroll = 0
  private fit = 1
  private zMul = 1
  private aspect = 1.78
  private mobile: boolean
  private time = 0

  constructor(private stage: Stage) {
    this.mobile = stage.mobile
    const scene = stage.scene
    scene.background = new THREE.Color('#eceef1')
    scene.fog = new THREE.FogExp2('#eceef1', 0.01)

    this.star = buildStar()
    this.star.mesh.scale.setScalar(0)
    this.debris = new Debris(this.mobile ? 90 : 260, this.mobile ? 30 : 90)
    this.chain = new Chain(this.mobile ? 90 : 190, this.mobile ? 0.7 : 0.42, this.mobile)
    this.paths = buildPaths(0)

    // النص الضخم «RTX SHOP» جوه المشهد (ورا الأجسام) كـ plane عليه texture
    this.titleMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, toneMapped: false })
    this.title = new THREE.Mesh(new THREE.PlaneGeometry(17, 4.6), this.titleMat)
    this.title.position.set(0, 0.2, -5)
    this.title.renderOrder = -2

    this.glowRed.position.set(0, 0, -3)
    this.glowCyan.position.set(4, -1, -4.5)
    this.key.position.set(3, 5, 6)
    this.rim.position.set(-5, 2, -4)
    this.accent.position.set(0, 0, 3.4)

    this.group.add(this.hemi, this.key, this.rim, this.accent, this.glowRed, this.glowCyan, this.title, this.star.mesh, this.debris.group, this.chain.mesh)
    scene.add(this.group)
  }

  /** بنبني الـ textures على دفعات (lazy) وبنبلّغ بالتقدّم عشان عدّاد الـ preloader */
  async loadAssets(onProgress: (p: number) => void) {
    const family = displayFont()
    const tex = canvasTexture(2600, 700, (ctx, w, h) => {
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      let size = 560
      ctx.font = `900 ${size}px ${family}`
      while (ctx.measureText('RTX SHOP').width > w * 0.96 && size > 100) {
        size -= 20
        ctx.font = `900 ${size}px ${family}`
      }
      ctx.fillText('RTX SHOP', w / 2, h / 2 + size * 0.04)
    })
    this.titleMat.map = tex
    this.titleMat.needsUpdate = true
    onProgress(0.2)
    await nextFrame()

    for (let i = 0; i < CARD_SPECS.length; i++) {
      const spec = CARD_SPECS[i]
      const map = canvasTexture(512, Math.round(512 * (spec.size[1] / spec.size[0])), (ctx, w, h) => drawCard(ctx, w, h, spec, family))
      const mat = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.size[0], spec.size[1]), mat)
      mesh.visible = false
      this.group.add(mesh)
      this.cards.push({ mesh, mat, spec, base: new THREE.Vector3(...spec.pos) })
      onProgress(0.2 + ((i + 1) / CARD_SPECS.length) * 0.55)
      await nextFrame()
    }

    const badgeMat = new THREE.MeshBasicMaterial({ map: canvasTexture(640, 900, (ctx, w, h) => drawBadge(ctx, w, h, family)), transparent: true, fog: false, toneMapped: false, side: THREE.DoubleSide })
    this.badge = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.5), badgeMat)
    this.badge.scale.setScalar(0)
    this.group.add(this.badge)
    onProgress(1)
    this.layout(this.aspect)
  }

  /** بنظبط الأحجام والمواضع حسب نسبة الشاشة (موبايل بورتريه / ديسكتوب) */
  layout(aspect: number) {
    this.aspect = aspect
    const portrait = aspect < 1
    this.fit = portrait ? 0.62 : aspect < 1.4 ? 0.85 : 1
    this.zMul = portrait ? 1.6 : aspect < 1.4 ? 1.2 : 1
    const visW = 2 * 15 * Math.tan(THREE.MathUtils.degToRad(this.stage.camera.fov / 2)) * aspect
    this.title.scale.setScalar(Math.min(1, (visW * 0.96) / 17))
    // الصفحة RTL: النص على اليمين والبادج على الشمال
    this.paths[4] = buildPaths(portrait ? 0 : -3.2 * clamp(aspect / 1.78, 0.6, 1.1))[4]
    const xs = clamp(aspect / 1.78, 0.42, 1.1)
    for (const c of this.cards) {
      c.base.set(c.spec.pos[0] * xs, c.spec.pos[1] * (portrait ? 1.25 : 1), c.spec.pos[2])
      c.mesh.scale.setScalar(portrait ? 0.62 : 1)
    }
  }

  update(S: PromoState, dt: number) {
    this.time += dt
    const t = this.time
    const { camera, scene } = this.stage

    // ── الثيم الحالي (مزج بين قسمين)
    const i = Math.min(Math.floor(S.theme), THEMES.length - 2)
    const f = ease(S.theme - i)
    const A = THEMES[Math.max(0, i)]
    const B = THEMES[Math.max(0, i) + 1]
    this.bg.copy(A.bgC).lerp(B.bgC, f)
    ;(scene.background as THREE.Color).copy(this.bg)
    const fog = scene.fog as THREE.FogExp2
    fog.color.copy(this.bg)
    fog.density = lerp(A.fog, B.fog, f)
    scene.environmentIntensity = lerp(A.env, B.env, f)
    this.stage.renderer.toneMappingExposure = lerp(A.exposure, B.exposure, f)
    this.key.color.copy(A.keyC).lerp(B.keyC, f)
    this.key.intensity = lerp(A.keyI, B.keyI, f)
    this.rim.color.copy(A.rimC).lerp(B.rimC, f)
    this.rim.intensity = lerp(A.rimI, B.rimI, f)
    this.accent.color.copy(A.accC).lerp(B.accC, f)
    this.accent.intensity = lerp(A.accentI, B.accentI, f) * (1 + Math.sin(t * 1.7) * 0.12)
    this.accent.position.x = Math.sin(t * 0.6) * 3
    this.accent.position.y = Math.cos(t * 0.5) * 1.6
    ;(this.glowRed.material as THREE.SpriteMaterial).opacity = lerp(A.glow, B.glow, f)
    ;(this.glowCyan.material as THREE.SpriteMaterial).opacity = lerp(A.glow2, B.glow2, f)
    this.titleMat.color.copy(A.textC).lerp(B.textC, f)
    this.titleMat.opacity = lerp(A.textA, B.textA, f) * clamp(S.starScale * 2, 0, 1)
    this.title.visible = this.titleMat.opacity > 0.003
    this.lightBg = this.bg.r * 0.299 + this.bg.g * 0.587 + this.bg.b * 0.114 > 0.17 // خلفية فاتحة؟ (قيمة linear)

    // ── الكاميرا + باراللاكس الماوس
    camera.position.set(S.cx + S.mx * 0.7, S.cy - S.my * 0.4, S.cz * this.zMul + S.introCam * 8)
    camera.lookAt(S.lx, S.ly, S.lz)

    // ── النجمة الكروم (بتتحطم بـ shader)
    const star = this.star
    star.mesh.scale.setScalar(S.starScale * this.fit)
    star.mesh.rotation.set(-S.my * 0.25 + Math.sin(t * 0.3) * 0.08, t * 0.25 + S.mx * 0.45, t * 0.05)
    star.uniforms.uShatter.value = S.shatter
    star.uniforms.uTime.value = t
    star.mesh.visible = S.starScale > 0.001

    // ── المكعبات والشظايا
    this.debris.group.scale.setScalar(this.fit)
    this.debris.update({ sphere: S.sphere, ring: S.ring, disperse: S.disperse, scale: S.debrisScale, spin: S.spin, time: t })

    // ── السلسلة: بتتحرك على المنحنى مع السكرول (+ وقت)
    const dScroll = S.scroll - this.prevScroll
    this.prevScroll = S.scroll
    this.phase += dScroll * S.scrollGain + dt * (S.chainSpeed + S.boost * 2)
    const pa = Math.min(Math.floor(S.path), this.paths.length - 2)
    const pf = ease(S.path - pa)
    const anchor = clamp(S.path - 3, 0, 1)
    this.chain.update({ a: this.paths[pa], b: this.paths[pa + 1], mix: pf, phase: anchor > 0.98 ? 0 : this.phase * (1 - anchor), grow: S.chainGrow, edge: 1 - anchor, sway: S.sway, time: t })
    const mat = this.chain.material
    mat.color.setRGB(lerp(0.56, 0.93, S.chainSilver), lerp(0.58, 0.94, S.chainSilver), lerp(0.62, 0.97, S.chainSilver))
    mat.roughness = lerp(0.26, 0.07, S.chainSilver)
    mat.emissive.setRGB(0.02 * S.neon, 0.6 * S.neon * 0.35, 0.7 * S.neon * 0.35)

    // ── البادج المعلّق في آخر السلسلة (الفوتر)
    if (this.badge) {
      const k = S.badge * this.fit
      this.badge.scale.setScalar(Math.max(0.0001, k))
      this.badge.visible = S.badge > 0.01
      if (this.badge.visible) {
        this.badge.position.copy(this.chain.tail).addScaledVector(this.chain.tailDir, this.chain.pitch * 0.5 + 1.45 * this.fit)
        this.badge.rotation.z = Math.sin(t * 1.1) * 0.06 * (0.3 + S.sway)
        this.badge.rotation.y = S.mx * 0.25 + Math.sin(t * 0.7) * 0.08
      }
    }

    // ── كروت الصور العايمة: باراللاكس + ظهور/اختفاء حسب القسم
    this.cards.forEach((c, n) => {
      const win = tri(S.theme, c.spec.sec, 0.85)
      const o = win * S.cards
      c.mat.opacity = o
      c.mesh.visible = o > 0.01
      if (!c.mesh.visible) return
      const par = c.spec.par
      c.mesh.position.set(
        c.base.x + S.mx * par * 0.45,
        c.base.y + Math.sin(t * 0.6 + n * 1.3) * 0.18 + (S.theme - c.spec.sec) * par * 2.6,
        c.base.z,
      )
      c.mesh.rotation.set(Math.sin(t * 0.35 + n) * 0.04, c.spec.ry + S.mx * 0.18 + Math.sin(t * 0.4 + n) * 0.05, Math.sin(t * 0.3 + n * 2) * 0.03)
      c.mesh.scale.setScalar((this.mobile && this.aspect < 1 ? 0.62 : 1) * lerp(0.86, 1, win))
    })

    // ── post-processing
    const { bloom, after } = this.stage
    if (bloom) bloom.strength = lerp(A.bloom, B.bloom, f) + S.blur * 0.2
    if (after) {
      const damp = clamp(S.blur, 0, 0.9)
      after.enabled = damp > 0.05
      const u = (after as unknown as { uniforms?: { damp?: { value: number } } }).uniforms
      if (u?.damp) u.damp.value = damp
    }
  }

  dispose() {
    this.stage.scene.remove(this.group)
    disposeTree(this.group)
  }
}

// ─────────────────────────── رسم الكروت والبادج (canvas 2D) ───────────────────────────

function drawCard(ctx: CanvasRenderingContext2D, w: number, h: number, s: CardSpec, family: string) {
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  roundRectPath(ctx, 6, 6, w - 12, h - 12, 34)
  ctx.clip()
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, s.a)
  g.addColorStop(1, s.b)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // شبكة خفيفة
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 1
  for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
  drawStar2D(ctx, w * 0.5, h * 0.4, Math.min(w, h) * 0.34, 'rgba(255,255,255,0.13)')
  if (s.big) {
    ctx.fillStyle = s.ink
    ctx.font = `900 ${w * 0.34}px ${family}`
    ctx.textAlign = 'center'
    ctx.fillText(s.big, w / 2, h * 0.5)
  }
  ctx.fillStyle = s.ink
  ctx.textAlign = 'left'
  ctx.font = `700 ${w * 0.05}px ${family}`
  ctx.globalAlpha = 0.75
  ctx.fillText(s.sub, 34, 62)
  ctx.globalAlpha = 1
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.font = `800 ${w * 0.1}px ${family}`
  wrapText(ctx, s.title, w - 36, h - 74, w - 72, w * 0.12)
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = 2
  roundRectPath(ctx, 6, 6, w - 12, h - 12, 34)
  ctx.stroke()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word } else line = test
  }
  lines.push(line)
  lines.forEach((l, i) => ctx.fillText(l, x, y - (lines.length - 1 - i) * lh))
}

function drawBadge(ctx: CanvasRenderingContext2D, w: number, h: number, family: string) {
  ctx.clearRect(0, 0, w, h)
  roundRectPath(ctx, 14, 14, w - 28, h - 28, 54)
  ctx.fillStyle = '#0a0a0c'
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(25,240,255,0.7)'
  ctx.stroke()
  // ثقب الحبل
  roundRectPath(ctx, w / 2 - 54, 44, 108, 26, 13)
  ctx.fillStyle = '#26272c'
  ctx.fill()
  // مربع أحمر بالنجمة
  roundRectPath(ctx, 70, 120, w - 140, w - 140, 40)
  ctx.fillStyle = '#e5101f'
  ctx.fill()
  drawStar2D(ctx, w / 2, 120 + (w - 140) / 2, (w - 140) * 0.4, '#0a0a0c')
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.font = `900 92px ${family}`
  ctx.fillText('RTX SHOP', w / 2, 120 + (w - 140) + 130)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = `600 30px ${family}`
  ctx.fillText('MEMBER ACCESS', w / 2, h - 90)
  ctx.fillStyle = '#19f0ff'
  ctx.fillRect(w / 2 - 60, h - 64, 120, 6)
}
