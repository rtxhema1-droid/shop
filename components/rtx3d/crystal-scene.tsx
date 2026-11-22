'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges, Environment, Lightformer, MeshTransmissionMaterial, PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { buildGeometry, layoutLines } from './crystal-letters'
import { fx } from './fx-store'

export type Tier = 'high' | 'low'

const CYAN = new THREE.Color('#4FE3C6')
const GOLD = new THREE.Color('#FFB86B')
const BLUE = new THREE.Color('#6FA3FF')
const VIOLET = new THREE.Color('#5E7F9E')
const WHITE = new THREE.Color('#ffffff')
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** نسخة ثابتة من Math.random عشان شكل الشظايا يفضل نفسه في كل تحميل */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ───────── الكاميرا والتحكم في التقدّم ─────────
function Rig() {
  useFrame((state, dt) => {
    // تقدّم الهيرو الفعلي: لو الهيرو مش ظاهر (قسم/بحث/بوابة الدخول) الكريستال بيبعد لجنب بنعومة
    const target = fx.ambient || !fx.heroVisible ? 1 : fx.scroll.p
    const current = state.scene.userData.p as number | undefined
    const p = current === undefined ? target : THREE.MathUtils.damp(current, target, 4, dt)
    state.scene.userData.p = p

    fx.scroll.v *= Math.pow(0.04, dt) // السرعة بتهدى لوحدها لما التمرير يقف

    const cam = state.camera
    cam.position.x = THREE.MathUtils.damp(cam.position.x, fx.pointer.x * 0.7, 3, dt)
    cam.position.y = THREE.MathUtils.damp(cam.position.y, fx.pointer.y * 0.45, 3, dt)
    cam.position.z = 7 + fx.intro.z + fx.fly.z + p * 1.2
    cam.lookAt(0, 0, 0)

    state.gl.domElement.style.opacity = String(1 - p * 0.55)
  })
  return null
}

// ───────── الكريستال المركزي ─────────
function Crystal({ tier, degraded }: { tier: Tier; degraded: boolean }) {
  const group = useRef<THREE.Group>(null)
  const material = useRef<THREE.Material & { color: THREE.Color }>(null)
  const tint = useMemo(() => new THREE.Color(), [])
  const geometry = useMemo(() => {
    const profile = [new THREE.Vector2(0, -1.55), new THREE.Vector2(0.62, -0.62), new THREE.Vector2(0.62, 0.62), new THREE.Vector2(0, 1.55)]
    const lathe = new THREE.LatheGeometry(profile, 6)
    const flat = lathe.toNonIndexed() // وجوه مسطّحة = حواف كريستال حادة
    flat.computeVertexNormals()
    lathe.dispose()
    return flat
  }, [])
  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    const p = state.scene.userData.p ?? 0
    g.rotation.set(Math.sin(t * 0.4) * 0.12 + fx.pointer.y * 0.25, t * 0.35 + fx.fly.spin + fx.pointer.x * 0.4, 0.18)
    g.scale.setScalar(0.82 * (1 - p * 0.5))
    g.position.set(p * 2.4, Math.sin(t * 0.8) * 0.08 + p * 0.5, -p * 1.6)
    if (material.current) material.current.color.copy(tint.copy(CYAN).lerp(VIOLET, fx.fly.hue).lerp(WHITE, 0.55))
  })

  const high = tier === 'high' && !degraded
  return (
    <group ref={group}>
      <mesh geometry={geometry}>
        <MeshTransmissionMaterial
          ref={material as never}
          transmission={1}
          thickness={1.5}
          roughness={0.02}
          ior={2.3}
          chromaticAberration={1}
          anisotropicBlur={0.2}
          distortion={0.25}
          distortionScale={0.4}
          temporalDistortion={0.12}
          backside={high}
          backsideThickness={0.8}
          samples={high ? 6 : 3}
          resolution={high ? 512 : 256}
          attenuationColor="#5E7F9E"
          attenuationDistance={2.4}
          envMapIntensity={1.6}
          toneMapped
        />
      </mesh>
      {/* قلب مضيء بيتشاف من جوه الكريستال وبيطلّع البلوم */}
      <mesh scale={0.55}>
        <icosahedronGeometry args={[0.6, 0]} />
        <meshBasicMaterial color={[0.1, 2.2, 2.6]} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ───────── الشظايا العايمة ─────────
function Shards({ count }: { count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const data = useMemo(() => {
    const r = rng(7)
    return Array.from({ length: count }, () => {
      const radius = 3.2 + r() * 7
      const angle = r() * Math.PI * 2
      return {
        x: Math.cos(angle) * radius,
        y: (r() - 0.5) * 10,
        z: -r() * 9 + 1.5,
        s: 0.1 + Math.pow(r(), 2) * 0.55,
        rx: r() * 6, ry: r() * 6, rz: r() * 6,
        speed: 0.15 + r() * 0.5,
        phase: r() * 6,
        color: r() < 0.45 ? 0 : r() < 0.85 ? 1 : 2,
      }
    })
  }, [count])

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const palette = [CYAN.clone().multiplyScalar(0.9), VIOLET.clone().lerp(new THREE.Color('#ffffff'), 0.25), new THREE.Color('#dfe9ff')]
    data.forEach((d, i) => m.setColorAt(i, palette[d.color]))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [data])

  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const t = state.clock.elapsedTime
    const stretch = 1 + Math.min(Math.abs(fx.scroll.v), 3) * 0.4
    data.forEach((d, i) => {
      const depth = 0.3 + (d.z + 7.5) / 9 // الأقرب بيتحرك أكتر (بارالاكس)
      const rise = fx.scroll.y * depth * 2.2
      const y = ((((d.y + rise + 5) % 10) + 10) % 10) - 5
      dummy.position.set(d.x + fx.pointer.x * depth * 0.9, y + fx.pointer.y * depth * 0.6 + Math.sin(t * d.speed + d.phase) * 0.25, d.z + fx.fly.z * 0.35)
      dummy.rotation.set(d.rx + t * d.speed * 0.6, d.ry + t * d.speed * 0.4, d.rz)
      dummy.scale.set(d.s, d.s * 1.6 * stretch, d.s)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshPhysicalMaterial color="#ffffff" metalness={0.7} roughness={0.12} iridescence={1} iridescenceIOR={1.6} clearcoat={1} envMapIntensity={1.4} />
    </instancedMesh>
  )
}

// ───────── الكتابة ثلاثية الأبعاد «RTX SHOP» ─────────
function Title({ tier }: { tier: Tier }) {
  const { size } = useThree()
  const group = useRef<THREE.Group>(null)
  // حجم الشاشة عند مستوى z=0 والكاميرا على بعد 7 (من غير ما نتأثر بمشهد الدخول)
  const viewport = useMemo(() => {
    const height = 2 * 7 * Math.tan(THREE.MathUtils.degToRad(20))
    return { height, width: (height * size.width) / size.height }
  }, [size.width, size.height])
  const portrait = viewport.width / viewport.height < 0.9
  const lines = useMemo(() => layoutLines(portrait ? ['RTX', 'SHOP'] : ['RTX SHOP']), [portrait])
  const geometries = useMemo(() => {
    const map = new Map<string, THREE.ExtrudeGeometry>()
    for (const line of lines) for (const g of line.glyphs) if (!map.has(g.char)) map.set(g.char, buildGeometry(g.char))
    return map
  }, [lines])
  useLayoutEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])

  const widest = Math.max(...lines.map((l) => l.width))
  const fit = Math.min(1.25, (viewport.width * (portrait ? 0.8 : 0.84)) / widest)
  const total = lines.reduce((n, l) => n + l.glyphs.length, 0)

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const p = state.scene.userData.p ?? 0
    g.visible = p < 0.97
    g.position.y = viewport.height * 0.3 + p * 2.2
    g.scale.setScalar(fit * (1 - p * 0.3))
    g.rotation.y = fx.pointer.x * 0.12
    g.rotation.x = -fx.pointer.y * 0.06
  })

  let index = 0
  return (
    <group ref={group}>
      {lines.map((line, row) => (
        <group key={row} position={[-line.width / 2, (lines.length - 1) * 0.6 - row * 1.25 - 0.5, 0]}>
          {line.glyphs.map((glyph) => {
            const color = index++ < 3 ? GOLD.clone() : CYAN.clone().lerp(BLUE, (index - 4) / Math.max(1, total - 4))
            return (
              <mesh key={`${row}-${glyph.x}`} geometry={geometries.get(glyph.char)} position={[glyph.x, 0, 0]}>
                <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.9} metalness={1} roughness={0.18} envMapIntensity={1.6} clearcoat={1} />
                {tier === 'high' && <Edges threshold={20} color="#D7FFF6" />}
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

function Post({ tier }: { tier: Tier }) {
  const bloom = useRef<{ intensity: number } | null>(null)
  useFrame(() => {
    if (bloom.current) bloom.current.intensity = 1.05 + fx.fly.flash * 1.6
  })
  return (
    <EffectComposer multisampling={tier === 'high' ? 4 : 0}>
      <Bloom ref={bloom as never} mipmapBlur luminanceThreshold={0.35} luminanceSmoothing={0.2} intensity={1.05} />
      <Vignette eskil={false} offset={0.2} darkness={0.7} />
    </EffectComposer>
  )
}

export default function CrystalScene({ tier, onReady }: { tier: Tier; onReady: () => void }) {
  const [dpr, setDpr] = useState(tier === 'high' ? 1.5 : 1)
  const [degraded, setDegraded] = useState(false)

  return (
    <Canvas
      className="fx-canvas"
      dpr={dpr}
      camera={{ position: [0, 0, 15], fov: 40, near: 0.1, far: 60 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
        fx.intro.z = 8
        // مشهد الدخول: الكاميرا بتقرب من بعيد (الحركة المميزة الوحيدة اللي بتشتغل لوحدها)
        import('gsap').then(({ default: gsap }) => gsap.to(fx.intro, { z: 0, duration: 2.2, ease: 'expo.out' }))
        onReady()
      }}
    >
      <PerformanceMonitor
        onChange={({ factor }) => setDpr(Math.round((0.9 + (tier === 'high' ? 0.8 : 0.4) * factor) * 100) / 100)}
        onDecline={() => setDegraded(true)}
      />
      <Rig />
      <ambientLight intensity={0.15} />
      <pointLight position={[-4, 2.5, 3]} color="#4FE3C6" intensity={90} distance={14} decay={2} />
      <pointLight position={[4, -2, 3]} color="#5E7F9E" intensity={80} distance={14} decay={2} />
      <pointLight position={[0, 4, -3]} color="#ffffff" intensity={25} distance={12} decay={2} />
      {/* بيئة انعكاسات مصنوعة من أضواء (مفيش تحميل HDR من الإنترنت) */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={6} color="#4FE3C6" position={[-5, 2, -2]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={5} color="#5E7F9E" position={[5, -1, -3]} scale={[8, 4, 1]} />
        <Lightformer form="ring" intensity={4} color="#ffffff" position={[0, 4, 2]} scale={4} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, -5, 1]} scale={[10, 1, 1]} />
      </Environment>
      <Crystal tier={tier} degraded={degraded} />
      <Shards count={tier === 'high' && !degraded ? 36 : 16} />
      <Title tier={tier} />
      <Post tier={tier} />
    </Canvas>
  )
}
