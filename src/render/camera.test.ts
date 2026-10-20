import { describe, expect, it } from 'vitest'
import { rotateYaw, START_YAW } from './camera'

describe('rotateYaw', () => {
  it('returns to the start after four E steps', () => {
    let yaw = START_YAW
    for (let i = 0; i < 4; i++) yaw = rotateYaw(yaw, 1)
    expect(yaw).toBe(START_YAW)
  })

  it('undoes one E step with one Q step', () => {
    expect(rotateYaw(rotateYaw(START_YAW, 1), -1)).toBe(START_YAW)
  })

  it('changes the yaw by 90° per step', () => {
    expect(rotateYaw(START_YAW, 1)).toBe(START_YAW + 90)
    expect(rotateYaw(START_YAW, -1)).toBe(START_YAW + 270)
    expect(rotateYaw(315, 1)).toBe(45)
  })
})
