import * as THREE from 'three'

/**
 * حروف «RTX SHOP» مرسومة يدوياً بحواف حادة زي الكريستال (ارتفاع الحرف = 1).
 * من غير ملف خط خارجي، فمفيش طلبات شبكة ولا مشاكل CSP.
 */
type P = [number, number][]
const S = 0.22

const path = <T extends THREE.Path>(target: T, pts: P): T => {
  pts.forEach(([x, y], i) => (i ? target.lineTo(x, y) : target.moveTo(x, y)))
  target.closePath()
  return target
}
const shape = (outer: P, holes: P[] = []) => {
  const s = path(new THREE.Shape(), outer)
  s.holes = holes.map((h) => path(new THREE.Path(), h))
  return s
}

export const GLYPHS: Record<string, { w: number; build: () => THREE.Shape }> = {
  R: {
    w: 0.84,
    build: () =>
      shape(
        [[0, 0], [S, 0], [S, 0.38], [0.38, 0.38], [0.58, 0], [0.84, 0], [0.62, 0.4], [0.8, 0.46], [0.84, 0.56], [0.84, 0.84], [0.72, 1], [0, 1]],
        [[[0.22, 0.6], [0.56, 0.6], [0.62, 0.66], [0.62, 0.74], [0.56, 0.8], [0.22, 0.8]]],
      ),
  },
  T: { w: 0.9, build: () => shape([[0, 1], [0.9, 1], [0.9, 1 - S], [0.45 + S / 2, 1 - S], [0.45 + S / 2, 0], [0.45 - S / 2, 0], [0.45 - S / 2, 1 - S], [0, 1 - S]]) },
  X: { w: 0.95, build: () => shape([[0, 0], [0.26, 0], [0.475, 0.36], [0.69, 0], [0.95, 0], [0.675, 0.5], [0.95, 1], [0.69, 1], [0.475, 0.64], [0.26, 1], [0, 1], [0.275, 0.5]]) },
  S: { w: 0.8, build: () => shape([[0, 0], [0.8, 0], [0.8, 0.61], [S, 0.61], [S, 0.78], [0.8, 0.78], [0.8, 1], [0, 1], [0, 0.39], [0.58, 0.39], [0.58, S], [0, S]]) },
  O: { w: 0.8, build: () => shape([[0.12, 0], [0.68, 0], [0.8, 0.12], [0.8, 0.88], [0.68, 1], [0.12, 1], [0, 0.88], [0, 0.12]], [[[S, S], [0.58, S], [0.58, 0.78], [S, 0.78]]]) },
  P: { w: 0.76, build: () => shape([[0, 0], [S, 0], [S, 0.4], [0.62, 0.4], [0.76, 0.5], [0.76, 0.9], [0.66, 1], [0, 1]], [[[S, 0.6], [0.54, 0.6], [0.54, 0.8], [S, 0.8]]]) },
  H: { w: 0.85, build: () => shape([[0, 0], [S, 0], [S, 0.39], [0.85 - S, 0.39], [0.85 - S, 0], [0.85, 0], [0.85, 1], [0.85 - S, 1], [0.85 - S, 0.61], [S, 0.61], [S, 1], [0, 1]]) },
  E: { w: 0.75, build: () => shape([[0, 0], [0.75, 0], [0.75, S], [S, S], [S, 0.39], [0.65, 0.39], [0.65, 0.61], [S, 0.61], [S, 1 - S], [0.75, 1 - S], [0.75, 1], [0, 1]]) },
  M: { w: 1.15, build: () => shape([[0, 0], [S, 0], [S, 0.55], [0.575, 0.17], [0.93, 0.55], [0.93, 0], [1.15, 0], [1.15, 1], [0.93, 1], [0.575, 0.43], [S, 1], [0, 1]]) },
  A: {
    w: 0.95,
    build: () =>
      shape([[0, 0], [0.24, 0], [0.3, 0.2], [0.65, 0.2], [0.71, 0], [0.95, 0], [0.615, 1], [0.335, 1]], [[[0.37, 0.38], [0.58, 0.38], [0.475, 0.8]]]),
  },
}

export const GAP = 0.16
export const SPACE = 0.55

export type Glyph = { char: string; x: number; w: number }
export type Line = { glyphs: Glyph[]; width: number }

/** بيوزّع الحروف على سطر أو أكتر (سطرين على الشاشات الطولية) */
export function layoutLines(lines: string[]): Line[] {
  return lines.map((text) => {
    let x = 0
    const glyphs: Glyph[] = []
    for (const char of text) {
      if (char === ' ') {
        x += SPACE
        continue
      }
      const g = GLYPHS[char]
      if (!g) continue
      glyphs.push({ char, x, w: g.w })
      x += g.w + GAP
    }
    return { glyphs, width: x - GAP }
  })
}

export function buildGeometry(char: string) {
  const geometry = new THREE.ExtrudeGeometry(GLYPHS[char].build(), {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 1,
    curveSegments: 1,
  })
  geometry.translate(0, 0, -0.13)
  return geometry
}
