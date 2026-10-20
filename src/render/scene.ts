import {
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three'

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)

  const scene = new Scene()
  scene.background = new Color(0x86c1c6)
  scene.add(new HemisphereLight(0xffffff, 0x5a6b7a, 1.5))
  const sun = new DirectionalLight(0xffffff, 1.5)
  sun.position.set(30, 60, 20)
  scene.add(sun)

  const water = new Mesh(
    new PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
    new MeshLambertMaterial({ color: 0x6fb3c0 }),
  )
  scene.add(water)

  return { renderer, scene }
}
