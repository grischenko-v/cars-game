export interface RacingLinePlan {
  sampleSpacing: number
  totalLength: number
  x: Float32Array
  z: Float32Array
  tangentX: Float32Array
  tangentZ: Float32Array
  halfWidth: Float32Array
  speedFactor: Float32Array
  curveAmount: Float32Array
}

export interface RacingLineSnapshot {
  sampleSpacing: number
  totalLength: number
  centerX: Float32Array
  centerZ: Float32Array
  tangentX: Float32Array
  tangentZ: Float32Array
  halfWidth: Float32Array
}

export interface RacingLineWorkerResponse {
  type: 'racing-line-ready'
  plan: RacingLinePlan
}
