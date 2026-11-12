// ═══════════ عُدّة three.js المشتركة (المسرح، الإضاءة، النجمة، السلسلة، المكعبات) ═══════════
// كل المجسمات هنا procedural (من غير ملفات .glb) فالمشروع بيشتغل من أول تشغيل.
// لو عايز تبدّل النجمة بموديل .glb: حمّله بـ GLTFLoader + DRACOLoader وحطه مكان buildStar().
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

export const { lerp, clamp } = THREE.MathUtils
/** smoothstep(a, b, x) */
export const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b)
export const ease = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t) }
/** مثلث: 1 عند center وبيقل لحد 0 على بُعد width */
export const tri = (x: number, center: number, width: number) => clamp(1 - Math.abs(x - center) / width, 0, 1)

// ─────────────────────────── المسرح (renderer + composer) ───────────────────────────

export type Stage = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  composer: EffectComposer | null
  bloom: UnrealBloomPass | null
  after: AfterimagePass | null
  mobile: boolean
  resize: () => void
  render: () => void
  dispose: () => void
}

type StageOptions = { canvas: HTMLCanvasElement; mobile: boolean; alpha?: boolean; post?: boolean; fov?: number; env?: boolean }

export function createStage({ canvas, mobile, alpha = false, post = true, fov = 40, env = true }: StageOptions): Stage {
  // الموبايل: من غير bloom ولا post-processing، وDPR أقل
  const usePost = post && !mobile && !alpha
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !usePost, alpha, powerPreference: 'high-performance' })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  if (alpha) renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 220)
  const envTexture = env ? makeEnvironment(renderer) : null
  if (envTexture) scene.environment = envTexture

  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  let after: AfterimagePass | null = null
  if (usePost) {
    // MSAA على الـ render target عشان الحواف تبقى ناعمة حتى مع الـ bloom
    const target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 })
    composer = new EffectComposer(renderer, target)
    composer.addPass(new RenderPass(scene, camera))
    after = new AfterimagePass(0.8) // «motion blur» بالـ afterimage — بيتفعّل بس في الحركة السريعة
    after.enabled = false
    composer.addPass(after)
    bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.3, 0.55, 0.85)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
  }

  const dpr = () => Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2) // سقف DPR = 2

  const resize = () => {
    const w = Math.max(1, canvas.clientWidth)
    const h = Math.max(1, canvas.clientHeight)
    renderer.setPixelRatio(dpr())
    renderer.setSize(w, h, false)
    composer?.setPixelRatio(dpr())
    composer?.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  return {
    renderer, scene, camera, composer, bloom, after, mobile, resize,
    render: () => (composer ? composer.render() : renderer.render(scene, camera)),
    dispose: () => {
      disposeTree(scene)
      envTexture?.dispose()
      composer?.dispose()
      renderer.dispose()
    },
  }
}

/** استوديو افتراضي (HDRI procedural): ألواح إضاءة بيضا + شريط أحمر + شريط سيان، عشان الكروم يلمع. */
function makeEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const room = new THREE.Scene()
  room.background = new THREE.Color(0x060709)
  const panel = (w: number, h: number, color: number, intensity: number, pos: [number, number, number]) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }))
    mesh.position.set(...pos)
    mesh.lookAt(0, 0, 0)
    room.add(mesh)
  }
  panel(16, 3.2, 0xffffff, 7, [0, 9, 2])
  panel(3, 14, 0xffffff, 5, [-9, 0, 3])
  panel(3, 14, 0xffffff, 3.5, [9, 0, -2])
  panel(18, 2, 0xff1e2d, 4.5, [0, -6, 6])
  panel(2, 12, 0x19f0ff, 5.5, [7, 2, -8])
  panel(12, 12, 0xffffff, 1.1, [0, 0, 13])
  const pmrem = new THREE.PMREMGenerator(renderer)
  const target = pmrem.fromScene(room, 0.02)
  pmrem.dispose()
  disposeTree(room)
  return target.texture
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    mesh.geometry?.dispose?.()
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) {
      for (const value of Object.values(m) as unknown[]) if (value instanceof THREE.Texture) value.dispose()
      m.dispose()
    }
  })
}

// ─────────────────────────── النجمة الكروم (8 أطراف) + shader التحطّم ───────────────────────────

export type StarHandle = { mesh: THREE.Mesh; uniforms: { uShatter: { value: number }; uTime: { value: number } } }

/**
 * نجمة 8 أطراف مدبّبة (ثنائية الهرم). كل وجه بيتقسّم لـ 3 شظايا، وكل شظية ليها مركز واتجاه عشوائي،
 * فـ vertex shader بيفرّق الشظايا ويلفّها حسب uShatter (0 = سليمة، 1 = متحطمة) من غير ما نعمل mesh لكل شظية.
 */
export function buildStar(radius = 2.5, inner = 0.46, depth = 0.5): StarHandle {
  const ring: THREE.Vector3[] = []
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? radius : radius * inner
    const a = (i / 16) * Math.PI * 2 + Math.PI / 2
    ring.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0))
  }
  const top = new THREE.Vector3(0, 0, depth)
  const bottom = new THREE.Vector3(0, 0, -depth)

  const pos: number[] = []
  const centroid: number[] = []
  const dir: number[] = []
  const rnd: number[] = []
  const rand = mulberry(7)

  const pushFace = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const center = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3)
    // تقسيم الوجه لـ 3 مثلثات حوالين المركز (نفس المستوى، فالشكل مبيتغيرش وهو سليم)
    const tris: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [[a, b, center], [b, c, center], [c, a, center]]
    for (const [p, q, r] of tris) {
      const c3 = new THREE.Vector3().add(p).add(q).add(r).multiplyScalar(1 / 3)
      const d = c3.clone().add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.4)).normalize()
      const k = rand()
      for (const v of [p, q, r]) {
        pos.push(v.x, v.y, v.z)
        centroid.push(c3.x, c3.y, c3.z)
        dir.push(d.x, d.y, d.z)
        rnd.push(k)
      }
    }
  }
  for (let i = 0; i < 16; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % 16]
    pushFace(top, p, q)
    pushFace(bottom, q, p)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('aCentroid', new THREE.Float32BufferAttribute(centroid, 3))
  geo.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3))
  geo.setAttribute('aRnd', new THREE.Float32BufferAttribute(rnd, 1))
  geo.computeVertexNormals() // geometry non-indexed => faceted (flat) normals

  const uniforms = { uShatter: { value: 0 }, uTime: { value: 0 } }
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9dde4, metalness: 1, roughness: 0.13 })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uShatter = uniforms.uShatter
    shader.uniforms.uTime = uniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aCentroid; attribute vec3 aDir; attribute float aRnd;
        uniform float uShatter; uniform float uTime;
        vec3 rotAx(vec3 v, vec3 ax, float a){ float c = cos(a); float s = sin(a); return v*c + cross(ax, v)*s + ax*dot(ax, v)*(1.0 - c); }
        float shAng(){ return uShatter * (2.0 + aRnd * 5.0) + uShatter * sin(uTime * 0.8 + aRnd * 6.283) * 0.5; }
        vec3 shAx(){ return normalize(cross(aDir, vec3(0.31, 0.87, 0.38)) + vec3(0.0001)); }`,
      )
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n objectNormal = rotAx(objectNormal, shAx(), shAng());`)
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
        {
          vec3 l = position - aCentroid;
          l = rotAx(l, shAx(), shAng());
          float e = uShatter;
          vec3 drift = aDir * (e * (2.2 + aRnd * 3.4)) + vec3(0.0, sin(uTime * 0.7 + aRnd * 9.0) * 0.14 * e, 0.0);
          transformed = aCentroid + l * (1.0 - 0.1 * e) + drift;
        }`,
      )
  }
  return { mesh: new THREE.Mesh(geo, mat), uniforms }
}

// ─────────────────────────── مكعبات وشظايا حمرا (InstancedMesh) ───────────────────────────

export type DebrisParams = { sphere: number; ring: number; disperse: number; scale: number; spin: number; time: number }

/** مكعبات + شظايا: بتبدأ متبعثرة، بعدين كورة، بعدين حلقة. حاجة واحدة InstancedMesh لكل نوع. */
export class Debris {
  group = new THREE.Group()
  private cubes: THREE.InstancedMesh
  private shards: THREE.InstancedMesh
  private nCubes: number
  private total: number
  private scatter: Float32Array
  private sphere: Float32Array
  private ringPos: Float32Array
  private seed: Float32Array
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private p = new THREE.Vector3()
  private s = new THREE.Vector3()

  constructor(nCubes: number, nShards: number, ringRadius = 3.6) {
    this.nCubes = nCubes
    this.total = nCubes + nShards
    const rand = mulberry(21)
    const red = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.55, roughness: 0.3 })
    this.cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), red, nCubes)
    this.shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.2), red.clone(), nShards)
    const palette = [0xe5101f, 0xe5101f, 0xff2a3a, 0xb30b17, 0x16161a, 0xd5d8de].map((c) => new THREE.Color(c))
    for (let i = 0; i < this.total; i++) {
      const mesh = i < this.nCubes ? this.cubes : this.shards
      mesh.setColorAt(i < this.nCubes ? i : i - this.nCubes, palette[Math.floor(rand() * palette.length)])
    }
    this.scatter = new Float32Array(this.total * 3)
    this.sphere = new Float32Array(this.total * 3)
    this.ringPos = new Float32Array(this.total * 3)
    this.seed = new Float32Array(this.total * 4)
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < this.total; i++) {
      // 1) متبعثرة في حجم كبير
      this.scatter.set([(rand() - 0.5) * 22, (rand() - 0.5) * 14, (rand() - 0.5) * 10 - 1], i * 3)
      // 2) كورة (Fibonacci sphere)
      const y = 1 - (i / (this.total - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const th = golden * i
      this.sphere.set([Math.cos(th) * r * 3, y * 3, Math.sin(th) * r * 3], i * 3)
      // 3) حلقة في مستوى XY
      const a = (i / this.total) * Math.PI * 2
      const rr = ringRadius + (rand() - 0.5) * 0.7
      this.ringPos.set([Math.cos(a) * rr, Math.sin(a) * rr, (rand() - 0.5) * 0.9], i * 3)
      this.seed.set([rand(), rand(), rand(), 0.6 + rand() * 1.1], i * 4)
    }
    this.group.add(this.cubes, this.shards)
  }

  update({ sphere, ring, disperse, scale, spin, time }: DebrisParams) {
    const a = ease(sphere)
    const b = ease(ring)
    for (let i = 0; i < this.total; i++) {
      const i3 = i * 3
      const i4 = i * 4
      let x = lerp(this.scatter[i3], this.sphere[i3], a)
      let y = lerp(this.scatter[i3 + 1], this.sphere[i3 + 1], a)
      let z = lerp(this.scatter[i3 + 2], this.sphere[i3 + 2], a)
      x = lerp(x, this.ringPos[i3], b)
      y = lerp(y, this.ringPos[i3 + 1], b)
      z = lerp(z, this.ringPos[i3 + 2], b)
      const sd = this.seed
      const wob = Math.sin(time * (0.6 + sd[i4]) + sd[i4 + 1] * 6.28) * 0.06
      this.p.set(x + wob, y + wob, z)
      if (disperse > 0) this.p.addScaledVector(this.p.clone().normalize(), disperse * (1 + sd[i4 + 2] * 2.2))
      this.e.set(time * sd[i4] * 0.9 + sd[i4 + 1] * 6, time * sd[i4 + 1] * 0.8, time * sd[i4 + 2] * 0.7)
      this.q.setFromEuler(this.e)
      const k = sd[i4 + 3] * scale
      this.s.set(k, k, k)
      this.m.compose(this.p, this.q, this.s)
      if (i < this.nCubes) this.cubes.setMatrixAt(i, this.m)
      else this.shards.setMatrixAt(i - this.nCubes, this.m)
    }
    this.cubes.instanceMatrix.needsUpdate = true
    this.shards.instanceMatrix.needsUpdate = true
    this.group.rotation.z = time * 0.08 * spin
  }
}

// ─────────────────────────── السلسلة (Instanced torus links على CatmullRomCurve3) ───────────────────────────

export type ChainPath = { pos: Float32Array; n: number; length: number }

/** بنحوّل CatmullRomCurve3 لجدول نقاط متساوية المسافة (بنستعمله بدل ما نحسب المنحنى كل فريم) */
export function makePath(points: THREE.Vector3[], samples = 420): ChainPath {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)
  const pts = curve.getSpacedPoints(samples - 1)
  const pos = new Float32Array(pts.length * 3)
  pts.forEach((p, i) => pos.set([p.x, p.y, p.z], i * 3))
  return { pos, n: pts.length, length: curve.getLength() }
}

export type ChainUpdate = {
  a: ChainPath; b: ChainPath
  mix: number        // 0 = المسار a ... 1 = المسار b (بنمزج بين مسارين بسلاسة)
  phase: number      // بتتحرك بالسكرول/الوقت: اللينكات بتمشي على المنحنى
  grow: number       // 0..1 طول السلسلة الظاهر
  edge: number       // 0..1 تلاشي الأطراف (1 = اللينكات بتصغر عند الأطراف)
  sway: number       // تمايل (للسلسلة المعلّقة)
  time: number
}

export class Chain {
  mesh: THREE.InstancedMesh
  material: THREE.MeshStandardMaterial
  readonly pitch: number
  readonly linkScale: number
  /** آخر لينك (للبادج المعلّق) */
  tail = new THREE.Vector3()
  tailDir = new THREE.Vector3(0, -1, 0)
  private max: number
  private m = new THREE.Matrix4()
  private basis = new THREE.Matrix4()
  private Q = new THREE.Quaternion()
  private S = new THREE.Vector3()
  private P = new THREE.Vector3()   // موضع اللينك
  private T = new THREE.Vector3()   // الاتجاه (tangent)
  private ahead = new THREE.Vector3()
  private behind = new THREE.Vector3()
  private ref = new THREE.Vector3()
  private B0 = new THREE.Vector3()
  private N0 = new THREE.Vector3()
  private negB = new THREE.Vector3()
  private va = new THREE.Vector3()
  private vb = new THREE.Vector3()

  constructor(max: number, linkScale: number, mobile: boolean) {
    // لينك واحد = torus مفلطح (بيضاوي) — الأطول على محور Y. المسافة بين اللينكات = pitch عشان يتشبكوا.
    const geo = new THREE.TorusGeometry(0.5, 0.13, mobile ? 8 : 14, mobile ? 18 : 34)
    geo.scale(0.78, 1.5, 1)
    this.material = new THREE.MeshStandardMaterial({ color: 0x9ea2aa, metalness: 1, roughness: 0.24 })
    this.mesh = new THREE.InstancedMesh(geo, this.material, max)
    this.mesh.frustumCulled = false
    this.max = max
    this.linkScale = linkScale
    this.pitch = 1.08 * linkScale
  }

  /** موضع نقطة على المسار عند t (0..1)، ممزوج بين مسارين */
  private at(u: ChainUpdate, t: number, out: THREE.Vector3) {
    const read = (path: ChainPath, v: THREE.Vector3) => {
      const f = clamp(t, 0, 1) * (path.n - 1)
      const i0 = Math.min(Math.floor(f), path.n - 2)
      const w = f - i0
      const o = i0 * 3
      v.set(lerp(path.pos[o], path.pos[o + 3], w), lerp(path.pos[o + 1], path.pos[o + 4], w), lerp(path.pos[o + 2], path.pos[o + 5], w))
    }
    read(u.a, this.va)
    read(u.b, this.vb)
    out.lerpVectors(this.va, this.vb, u.mix)
  }

  update(u: ChainUpdate) {
    const nFull = lerp(u.a.length, u.b.length, u.mix) / this.pitch
    const count = clamp(Math.floor(nFull * u.grow), 0, this.max)
    this.mesh.count = count
    if (count === 0) return
    const ph = ((u.phase % 1) + 1) % 1
    const d = 0.35 / nFull // خطوة صغيرة لحساب الاتجاه
    for (let i = 0; i < count; i++) {
      const t = (i + ph) / nFull
      this.at(u, t, this.P)
      this.at(u, Math.min(t + d, 1), this.ahead)
      this.at(u, Math.max(t - d, 0), this.behind)
      this.T.copy(this.ahead).sub(this.behind)
      if (this.T.lengthSq() < 1e-10) this.T.set(0, -1, 0)
      this.T.normalize()
      if (u.sway > 0) {
        this.P.x += Math.sin(u.time * 1.1 + t * 5) * u.sway * t * 0.5
        this.P.z += Math.cos(u.time * 0.9 + t * 4) * u.sway * t * 0.35
      }
      // إطار ثابت: كل لينك تاني بيتلف 90° حوالين الـ tangent (ده اللي بيدّي شكل الشبك الحقيقي)
      this.ref.set(0, 0, 1)
      if (Math.abs(this.T.z) > 0.9) this.ref.set(0, 1, 0)
      this.B0.crossVectors(this.T, this.ref).normalize()
      this.N0.crossVectors(this.B0, this.T).normalize()
      if (i % 2 === 0) this.basis.makeBasis(this.B0, this.T, this.N0)
      else this.basis.makeBasis(this.N0, this.T, this.negB.copy(this.B0).negate())
      this.Q.setFromRotationMatrix(this.basis)
      const edge = smooth(0, 0.035, t) * smooth(0, 0.035, 1 - t)
      const k = this.linkScale * lerp(1, edge, u.edge)
      this.S.set(k, k, k)
      this.m.compose(this.P, this.Q, this.S)
      this.mesh.setMatrixAt(i, this.m)
      if (i === count - 1) {
        this.tail.copy(this.P)
        this.tailDir.copy(this.T)
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}

// ─────────────────────────── نسيج (textures) procedural ───────────────────────────

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  draw(ctx, w, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** هالة ضوء ناعمة (sprite) — للتوهج الأحمر خلف النجمة ولتوهج اللمبة */
export function makeGlow(color: string, size = 6): THREE.Sprite {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, color)
    g.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.28)'))
    g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, opacity: 0 })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(size, size, 1)
  return sprite
}

/** نجمة 2D (للبادج والكروت) */
export function drawStar2D(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, color: string) {
  ctx.beginPath()
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? R : R * 0.36
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

// مولّد أرقام عشوائية ثابت (نفس الشكل كل مرة)
export function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
