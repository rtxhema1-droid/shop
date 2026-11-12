// ═══════════ مشهد اللمبة (بوابة الدخول) ═══════════
// نفس لمبة in.html لكن ثلاثية الأبعاد، والسلسلة ملفوفة حوالين الساق وحوالين الأباجورة.
// شدّ الخيط = تشغيل النور (بيفتح نموذج الدخول).
import * as THREE from 'three'
import { Chain, clamp, disposeTree, ease, lerp, makeGlow, makePath, type ChainPath, type Stage } from './kit'

export type LampState = {
  on: number        // 0..1 النور (بيتحرك بالـ tween)
  show: number      // 0..1 ظهور المشهد
  grow: number      // 0..1 طول السلسلة
  pull: number      // 0..1 شد الخيط
  success: number   // 0..1 وميض نجاح الدخول
  dolly: number     // 0..1 اقتراب الكاميرا
  mx: number; my: number
}
export const createLampState = (): LampState => ({ on: 0, show: 0, grow: 0, pull: 0, success: 0, dolly: 0, mx: 0, my: 0 })

const BG_OFF = new THREE.Color('#0b0d10')
const BG_ON = new THREE.Color('#1c1f24')
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

const CORD_X = 1.25
const CORD_TOP = 0.56
const CORD_LEN = 1.7

export class LampScene {
  group = new THREE.Group()
  chain: Chain
  private lamp = new THREE.Group()
  private shade: THREE.Mesh
  private shadeMat: THREE.MeshStandardMaterial
  private under: THREE.Mesh
  private underMat: THREE.MeshStandardMaterial
  private bulbMat: THREE.MeshStandardMaterial
  private glow = makeGlow('rgba(255,214,120,1)', 14)
  private light = new THREE.PointLight(0xffd678, 0, 0, 2)
  private fill = new THREE.DirectionalLight(0x9fb6ff, 0.6)
  private cord: THREE.Mesh
  private bead: THREE.Mesh
  private hit: THREE.Mesh
  private ray = new THREE.Raycaster()
  private phase = 0
  private time = 0
  private baseScale = 1
  private mobile: boolean
  private paths: ChainPath

  constructor(private stage: Stage) {
    this.mobile = stage.mobile
    const cream = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, metalness: 1, roughness: 0.22 })

    // الأباجورة: lathe (شكل قبة زي الـ SVG)
    const profile: THREE.Vector2[] = []
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * (Math.PI / 2)
      profile.push(new THREE.Vector2(Math.max(0.02, 1.7 * Math.pow(Math.cos(a), 0.85)), 0.55 + 1.6 * Math.pow(Math.sin(a), 0.8)))
    }
    this.shadeMat = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.15, roughness: 0.55, side: THREE.DoubleSide, emissive: new THREE.Color(1, 0.93, 0.78), emissiveIntensity: 0 })
    this.shade = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), this.shadeMat)

    // قاع الأباجورة (الجزء اللي بيوهّج من تحت)
    this.underMat = new THREE.MeshStandardMaterial({ color: 0x6e6444, roughness: 0.8, emissive: new THREE.Color(1, 0.82, 0.45), emissiveIntensity: 0, side: THREE.DoubleSide })
    this.under = new THREE.Mesh(new THREE.CircleGeometry(1.69, 64), this.underMat)
    this.under.rotation.x = Math.PI / 2
    this.under.position.y = 0.55

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.95, 28), cream)
    stem.position.y = -0.92
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.12, 0.18, 56), cream)
    base.position.y = -2.42
    this.bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: new THREE.Color(1, 0.85, 0.5), emissiveIntensity: 0.1, roughness: 0.3 })
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 16), this.bulbMat)
    bulb.position.y = 0.3

    // الخيط والخرزة
    const cordGeo = new THREE.CylinderGeometry(0.014, 0.014, 1, 8)
    cordGeo.translate(0, -0.5, 0) // الأعلى ثابت، والطول بيتمدد لتحت
    this.cord = new THREE.Mesh(cordGeo, new THREE.MeshStandardMaterial({ color: 0x8d8676, roughness: 0.8 }))
    this.cord.position.set(CORD_X, CORD_TOP, 0)
    this.bead = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), new THREE.MeshStandardMaterial({ color: 0xc9905a, metalness: 0.6, roughness: 0.3 }))
    // منطقة لمس أكبر من الخيط (شفافة)
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, CORD_LEN + 0.6, 0.9), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
    this.hit.position.set(CORD_X, CORD_TOP - CORD_LEN / 2, 0)

    this.glow.position.set(0, 0.2, 0.3)
    this.light.position.set(0, 0.28, 0)
    this.fill.position.set(-4, 3, 6)

    this.lamp.add(this.shade, this.under, stem, base, bulb, this.cord, this.bead, this.hit, this.glow, this.light)

    // السلسلة: ملفوفة على الساق (لولب) ← حلقة حوالين الأباجورة ← ذيل بيتدلّى
    const pts: THREE.Vector3[] = []
    const turns = 3.2
    for (let k = 0; k <= 30; k++) {
      const u = k / 30
      const a = u * Math.PI * 2 * turns
      pts.push(V(Math.cos(a) * 0.27, -2.2 + u * 2.7, Math.sin(a) * 0.27))
    }
    pts.push(V(0.6, 0.62, 0.35), V(1.35, 0.7, 0.5))
    for (let k = 0; k <= 22; k++) {
      const a = (k / 22) * Math.PI * 2 + 0.4
      pts.push(V(Math.cos(a) * 1.78, 0.5 - Math.sin(k / 22 * Math.PI) * 0.1, Math.sin(a) * 1.78))
    }
    pts.push(V(2.1, -0.2, 0.7), V(1.95, -1.2, 1), V(1.4, -2.2, 0.9))
    const path = makePath(pts, 600)
    this.chain = new Chain(this.mobile ? 100 : 150, this.mobile ? 0.2 : 0.17, this.mobile)
    this.paths = path

    this.lamp.position.y = 0
    this.group.add(this.lamp, this.chain.mesh, this.fill)
    this.group.visible = false
    stage.scene.add(this.group)
  }

  /** بنوزّع المشهد: ديسكتوب = اللمبة على الشمال والنموذج يمين، موبايل = اللمبة فوق */
  layout(aspect: number) {
    const portrait = aspect < 1
    const dist = 11
    const visW = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.stage.camera.fov / 2)) * aspect
    this.baseScale = portrait ? clamp(aspect * 1.05, 0.45, 0.8) : aspect < 1.4 ? 0.85 : 1
    this.group.position.set(portrait ? 0 : -visW * 0.2, portrait ? 1.7 : -0.1, 0)
  }

  /** هل الضغطة (إحداثيات NDC) على الخيط؟ */
  pick(x: number, y: number): boolean {
    this.group.updateMatrixWorld(true)
    this.ray.setFromCamera(new THREE.Vector2(x, y), this.stage.camera)
    return this.ray.intersectObject(this.hit, false).length > 0
  }

  update(L: LampState, dt: number) {
    this.time += dt
    const t = this.time
    const { camera, scene } = this.stage
    this.group.visible = true

    const on = L.on
    const boost = 1 + L.success * 2.4
    scene.background = scene.background instanceof THREE.Color ? scene.background : new THREE.Color()
    ;(scene.background as THREE.Color).copy(BG_OFF).lerp(BG_ON, on)
    scene.fog = scene.fog instanceof THREE.FogExp2 ? scene.fog : new THREE.FogExp2('#0b0d10', 0.02)
    ;(scene.fog as THREE.FogExp2).color.copy(scene.background as THREE.Color)
    ;(scene.fog as THREE.FogExp2).density = 0.016
    scene.environmentIntensity = lerp(0.3, 0.85, on)
    this.stage.renderer.toneMappingExposure = 1

    // الكاميرا
    camera.position.set(L.mx * 0.5, 0.3 - L.my * 0.25, 11 - L.dolly * 3.2)
    camera.lookAt(this.group.position.x * 0.5, 0.1 + (this.group.position.y > 1 ? 1.1 : 0), 0)

    // ظهور المشهد
    const s = this.baseScale * ease(L.show) * (1 + L.success * 0.06)
    this.group.scale.setScalar(Math.max(0.0001, s))
    this.lamp.rotation.y = L.mx * 0.2
    this.lamp.rotation.x = -L.my * 0.05

    // النور
    this.shadeMat.emissiveIntensity = on * 0.9 * boost
    this.shadeMat.color.setRGB(lerp(0.69, 1, on), lerp(0.69, 1, on), lerp(0.69, 1, on))
    this.underMat.emissiveIntensity = on * 1.6 * boost
    this.underMat.color.setRGB(lerp(0.17, 0.79, on), lerp(0.14, 0.68, on), lerp(0.07, 0.38, on))
    this.bulbMat.emissiveIntensity = 0.1 + on * 4 * boost
    this.light.intensity = on * 38 * boost * (1 + Math.sin(t * 9) * 0.01)
    ;(this.glow.material as THREE.SpriteMaterial).opacity = on * 0.85 * clamp(boost, 1, 1.6)
    this.fill.intensity = 0.5 + on * 0.4

    // الخيط (بيتشد لتحت وبيرجع)
    const len = CORD_LEN + L.pull * 0.42
    this.cord.scale.y = len
    this.bead.position.set(CORD_X, CORD_TOP - len, 0)

    // السلسلة بتنزلق حوالين اللمبة ببطء، وبتسرّع عند النجاح
    this.phase += dt * (0.5 + on * 0.6 + L.success * 6)
    const p = this.paths
    this.chain.update({ a: p, b: p, mix: 0, phase: this.phase, grow: L.grow, edge: 1, sway: 0, time: t })
    const m = this.chain.material
    m.emissive.setRGB(1, 0.72, 0.28).multiplyScalar(on * 0.07 * boost)
    m.roughness = lerp(0.3, 0.14, on)

    const { bloom } = this.stage
    if (bloom) bloom.strength = 0.18 + on * 0.55 + L.success * 1.4
    if (this.stage.after) this.stage.after.enabled = false
  }

  hide() {
    this.group.visible = false
  }

  dispose() {
    this.stage.scene.remove(this.group)
    disposeTree(this.group)
  }
}
