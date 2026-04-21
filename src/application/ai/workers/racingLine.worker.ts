import type {
  RacingLinePlan,
  RacingLineSnapshot,
  RacingLineWorkerResponse,
} from '../RacingLinePlan'

const CURVE_NORMALIZER = 0.78
const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<RacingLineSnapshot>) => void) | null
  postMessage: (message: RacingLineWorkerResponse, transfer?: Transferable[]) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function euclideanModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo
}

function angleBetweenTangents(
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const turnSign = ax * bz - az * bx
  const tangentDot = clamp(ax * bx + az * bz, -1, 1)

  return Math.atan2(turnSign, tangentDot)
}

function sampleIndex(index: number, count: number): number {
  return euclideanModulo(index, count)
}

function getSignedCurve(snapshot: RacingLineSnapshot, index: number, sampleOffset: number): number {
  const count = snapshot.centerX.length
  const a = sampleIndex(index, count)
  const b = sampleIndex(index + sampleOffset, count)

  return angleBetweenTangents(
    snapshot.tangentX[a],
    snapshot.tangentZ[a],
    snapshot.tangentX[b],
    snapshot.tangentZ[b]
  )
}

function getCurveAmount(snapshot: RacingLineSnapshot, index: number, sampleOffset: number): number {
  return clamp(Math.abs(getSignedCurve(snapshot, index, sampleOffset)) / CURVE_NORMALIZER, 0, 1)
}

function buildPlan(snapshot: RacingLineSnapshot): RacingLinePlan {
  const count = snapshot.centerX.length
  const x = new Float32Array(count)
  const z = new Float32Array(count)
  const tangentX = new Float32Array(count)
  const tangentZ = new Float32Array(count)
  const halfWidth = new Float32Array(count)
  const speedFactor = new Float32Array(count)
  const curveAmount = new Float32Array(count)
  const offset44 = Math.max(1, Math.round(44 / snapshot.sampleSpacing))
  const offset72 = Math.max(1, Math.round(72 / snapshot.sampleSpacing))
  const offset118 = Math.max(1, Math.round(118 / snapshot.sampleSpacing))
  const offset170 = Math.max(1, Math.round(170 / snapshot.sampleSpacing))
  const offset224 = Math.max(1, Math.round(224 / snapshot.sampleSpacing))

  for (let i = 0; i < count; i += 1) {
    const tx = snapshot.tangentX[i]
    const tz = snapshot.tangentZ[i]
    const sideX = -tz
    const sideZ = tx
    const safeHalfWidth = snapshot.halfWidth[i] * 0.64
    const entryCurve = getSignedCurve(snapshot, i, offset72)
    const apexCurve = getSignedCurve(snapshot, i, offset118)
    const exitCurve = getSignedCurve(snapshot, i, offset170)
    const dominantCurve = Math.abs(apexCurve) >= Math.abs(entryCurve) ? apexCurve : entryCurve
    const insideSign = dominantCurve < 0 ? 1 : -1
    const entryAmount = clamp(Math.abs(entryCurve) / CURVE_NORMALIZER, 0, 1)
    const apexAmount = clamp(Math.abs(apexCurve) / CURVE_NORMALIZER, 0, 1)
    const exitAmount = clamp(Math.abs(exitCurve) / CURVE_NORMALIZER, 0, 1)
    const idealOffset =
      -insideSign * safeHalfWidth * entryAmount * 0.36 +
      insideSign * safeHalfWidth * apexAmount * 0.58 -
      insideSign * safeHalfWidth * exitAmount * 0.24
    const lookaheadCurve = Math.max(
      getCurveAmount(snapshot, i, offset44),
      getCurveAmount(snapshot, i, offset72),
      getCurveAmount(snapshot, i, offset118),
      getCurveAmount(snapshot, i, offset170),
      getCurveAmount(snapshot, i, offset224)
    )
    const turnSpeedFactor = 1 - lookaheadCurve * 0.2

    x[i] = snapshot.centerX[i] + sideX * clamp(idealOffset, -safeHalfWidth, safeHalfWidth)
    z[i] = snapshot.centerZ[i] + sideZ * clamp(idealOffset, -safeHalfWidth, safeHalfWidth)
    tangentX[i] = tx
    tangentZ[i] = tz
    halfWidth[i] = snapshot.halfWidth[i]
    curveAmount[i] = lookaheadCurve
    speedFactor[i] = clamp(turnSpeedFactor, 0.82, 1)
  }

  return {
    sampleSpacing: snapshot.sampleSpacing,
    totalLength: snapshot.totalLength,
    x,
    z,
    tangentX,
    tangentZ,
    halfWidth,
    speedFactor,
    curveAmount,
  }
}

workerScope.onmessage = (event: MessageEvent<RacingLineSnapshot>) => {
  const plan = buildPlan(event.data)
  const response: RacingLineWorkerResponse = {
    type: 'racing-line-ready',
    plan,
  }

  workerScope.postMessage(response, [
    plan.x.buffer,
    plan.z.buffer,
    plan.tangentX.buffer,
    plan.tangentZ.buffer,
    plan.halfWidth.buffer,
    plan.speedFactor.buffer,
    plan.curveAmount.buffer,
  ])
}
