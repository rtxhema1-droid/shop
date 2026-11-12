// ═══════════ مشهد الترحيب بعد تسجيل الدخول ═══════════
// سلسلة بتنزل من فوق شايلة بادج بإسم العميل، حواليه حلقة مكعبات حمرا ونجمة كروم، وإضاءة نيون سيان.
import * as THREE from 'three'
import { Chain, Debris, buildStar, canvasTexture, clamp, disposeTree, drawStar2D, makeGlow, makePath, roundRectPath, type ChainPath, type Stage, type StarHandle } from './kit'
import { displayFont } from './env'

export type WelcomeState = { y: number; sway: number; sphere: number; ring: number; star: number; glow: number; mx: number; my: number }
export const createWelcomeState = (): WelcomeState => ({ y: 20, sway: 1.5, sphere: 0, ring: 0, star: 0, glow: 0, mx: 0, my: 0 })

export class WelcomeScene {
  group = new THREE.Group()
  private chain: Chain
  private path: ChainPath
  private badge: THREE.Mesh
  private star: StarHandle
  private debris: Debris
  private glowRed = makeGlow('rgba(255,26,43,1)', 20)
  private glowCyan = makeGlow('rgba(25,240,255,1)', 14)
  private rim = new THREE.DirectionalLight(0x19f0ff, 6)
  private key = new THREE.DirectionalLight(0xff5a60, 1.4)
  private hemi = new THREE.HemisphereLight(0xffffff, 0x330000, 0.2)
  private time = 0
  private hx = -3.2
  private fit = 1

  constructor(private stage: Stage, name: string) {
    const family = displayFont()
    this.path = this.buildPath(this.hx)
    this.chain = new Chain(stage.mobile ? 60 : 90, stage.mobile ? 0.6 : 0.42, stage.mobile)
    this.chain.material.color.setRGB(0.93, 0.94, 0.97)
    this.chain.material.roughness = 0.08

    const map = canvasTexture(640, 900, (ctx, w, h) => drawWelcomeBadge(ctx, w, h, name, family))
    this.badge = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.5), new THREE.MeshBasicMaterial({ map, transparent: true, fog: false, toneMapped: false, side: THREE.DoubleSide }))

    this.star = buildStar(1.8)
    this.star.mesh.scale.setScalar(0)
    this.debris = new Debris(stage.mobile ? 50 : 120, stage.mobile ? 20 : 40, 3.1)

    this.glowRed.position.set(this.hx, 0.4, -3)
    this.glowCyan.position.set(this.hx + 2, -1, -4)
    this.rim.position.set(-4, 3, -5)
    this.key.position.set(4, 4, 6)

    this.group.add(this.hemi, this.key, this.rim, this.glowRed, this.glowCyan, this.star.mesh, this.debris.group, this.chain.mesh, this.badge)
    stage.scene.background = new THREE.Color('#12030a')
    stage.scene.fog = new THREE.FogExp2('#12030a', 0.02)
    stage.scene.environmentIntensity = 0.9
    stage.scene.add(this.group)
  }

  private buildPath(x: number) {
    const V = (a: number, b: number, c: number) => new THREE.Vector3(a, b, c)
    return makePath([V(x, 24, 0), V(x + 0.02, 14, 0.1), V(x - 0.04, 7, -0.05), V(x, 2.7, 0)], 300)
  }

  layout(aspect: number) {
    const portrait = aspect < 1
    this.fit = portrait ? 0.7 : 1
    this.hx = portrait ? 0 : -3.3 * clamp(aspect / 1.78, 0.6, 1.1)
    this.path = this.buildPath(this.hx)
    this.glowRed.position.x = this.hx
    this.glowCyan.position.x = this.hx + 2
    this.stage.camera.position.set(0, portrait ? 2.2 : 1, portrait ? 14 : 10)
  }

  update(W: WelcomeState, dt: number) {
    this.time += dt
    const t = this.time
    const { camera } = this.stage
    camera.position.x = W.mx * 0.5
    camera.lookAt(0, portraitLookY(camera.position.y), 0)

    this.group.position.y = W.y
    this.chain.update({ a: this.path, b: this.path, mix: 0, phase: 0, grow: 1, edge: 0, sway: W.sway, time: t })
    this.badge.position.copy(this.chain.tail).addScaledVector(this.chain.tailDir, this.chain.pitch * 0.5 + 1.45)
    this.badge.rotation.z = Math.sin(t * 1.6) * 0.07 * (0.4 + W.sway)
    this.badge.rotation.y = W.mx * 0.25 + Math.sin(t * 0.7) * 0.08

    this.star.mesh.position.set(this.badge.position.x, this.badge.position.y, -1.2)
    this.star.mesh.scale.setScalar(W.star * 0.8 * this.fit)
    this.star.mesh.rotation.set(Math.sin(t * 0.4) * 0.1, t * 0.35, t * 0.08)
    this.star.uniforms.uTime.value = t
    this.debris.group.position.set(this.badge.position.x, this.badge.position.y, -0.6)
    this.debris.group.scale.setScalar(0.8 * this.fit)
    this.debris.update({ sphere: W.sphere, ring: W.ring, disperse: 0, scale: 1, spin: 2, time: t })

    ;(this.glowRed.material as THREE.SpriteMaterial).opacity = W.glow * 0.9
    ;(this.glowCyan.material as THREE.SpriteMaterial).opacity = W.glow * 0.5
    if (this.stage.bloom) this.stage.bloom.strength = 0.85
  }

  dispose() {
    this.stage.scene.remove(this.group)
    disposeTree(this.group)
  }
}

const portraitLookY = (camY: number) => (camY > 1.5 ? 1.2 : 0.8)

function drawWelcomeBadge(ctx: CanvasRenderingContext2D, w: number, h: number, name: string, family: string) {
  ctx.clearRect(0, 0, w, h)
  roundRectPath(ctx, 14, 14, w - 28, h - 28, 54)
  ctx.fillStyle = '#09090b'
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(25,240,255,0.75)'
  ctx.stroke()
  roundRectPath(ctx, w / 2 - 54, 44, 108, 26, 13)
  ctx.fillStyle = '#26272c'
  ctx.fill()
  roundRectPath(ctx, 70, 120, w - 140, w - 140, 40)
  ctx.fillStyle = '#e5101f'
  ctx.fill()
  drawStar2D(ctx, w / 2, 120 + (w - 140) / 2, (w - 140) * 0.4, '#09090b')
  ctx.textAlign = 'center'
  ctx.fillStyle = '#19f0ff'
  ctx.font = `800 40px ${family}`
  ctx.fillText('WELCOME', w / 2, 120 + (w - 140) + 70)
  ctx.fillStyle = '#fff'
  ctx.direction = 'rtl'
  let size = 84
  const label = `أهلاً ${name}`.slice(0, 22)
  ctx.font = `900 ${size}px ${family}`
  while (ctx.measureText(label).width > w - 110 && size > 36) {
    size -= 4
    ctx.font = `900 ${size}px ${family}`
  }
  ctx.fillText(label, w / 2, 120 + (w - 140) + 170)
  ctx.direction = 'ltr'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `700 28px ${family}`
  ctx.fillText('RTX SHOP', w / 2, h - 72)
}
