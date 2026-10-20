import { OrthographicCamera } from 'three'

export const START_YAW = 45
export const PITCH = 35
const DISTANCE = 100
const VIEW_HEIGHT = 40

// Turns the yaw (degrees) by 90° per step. E is +1, Q is -1. Result is in [0, 360).
export function rotateYaw(yaw: number, steps: number): number {
  return (((yaw + steps * 90) % 360) + 360) % 360
}

export function createCamera(aspect: number) {
  const camera = new OrthographicCamera()
  let yaw = START_YAW

  function place() {
    const y = (yaw * Math.PI) / 180
    const p = (PITCH * Math.PI) / 180
    const flat = DISTANCE * Math.cos(p)
    camera.position.set(flat * Math.sin(y), DISTANCE * Math.sin(p), flat * Math.cos(y))
    camera.lookAt(0, 0, 0)
  }

  function resize(newAspect: number) {
    camera.left = (-VIEW_HEIGHT * newAspect) / 2
    camera.right = (VIEW_HEIGHT * newAspect) / 2
    camera.top = VIEW_HEIGHT / 2
    camera.bottom = -VIEW_HEIGHT / 2
    camera.near = 0.1
    camera.far = DISTANCE * 3
    camera.updateProjectionMatrix()
  }

  function rotate(steps: number) {
    yaw = rotateYaw(yaw, steps)
    place()
  }

  place()
  resize(aspect)
  return { camera, resize, rotate }
}
