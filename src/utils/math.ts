import * as THREE from 'three'

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target
  return current + Math.sign(target - current) * maxDelta
}

export function expLerpFactor(sharpness: number, delta: number): number {
  return 1 - Math.exp(-sharpness * delta)
}

export function lerpAngle(current: number, target: number, t: number): number {
  const delta =
    THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) -
    Math.PI
  return current + delta * t
}
