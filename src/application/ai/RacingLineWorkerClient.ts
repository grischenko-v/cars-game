import * as THREE from 'three'
import type { Road } from '../../world/Road'
import type {
  RacingLinePlan,
  RacingLineSnapshot,
  RacingLineWorkerResponse,
} from './RacingLinePlan'

const RACING_LINE_SAMPLE_SPACING = 6

export class RacingLineWorkerClient {
  buildPlan(road: Road): Promise<RacingLinePlan> {
    const snapshot = this.createSnapshot(road)

    return new Promise((resolve, reject) => {
      let worker: Worker

      try {
        worker = new Worker(new URL('./workers/racingLine.worker.ts', import.meta.url), {
          type: 'module',
        })
      } catch (error) {
        reject(error)
        return
      }

      worker.onmessage = (event: MessageEvent<RacingLineWorkerResponse>) => {
        worker.terminate()
        resolve(event.data.plan)
      }

      worker.onerror = (event) => {
        worker.terminate()
        reject(event.error ?? new Error(event.message))
      }

      worker.postMessage(snapshot, [
        snapshot.centerX.buffer,
        snapshot.centerZ.buffer,
        snapshot.tangentX.buffer,
        snapshot.tangentZ.buffer,
        snapshot.halfWidth.buffer,
      ])
    })
  }

  private createSnapshot(road: Road): RacingLineSnapshot {
    const sampleCount = Math.max(128, Math.ceil(road.totalLength / RACING_LINE_SAMPLE_SPACING))
    const sampleSpacing = road.totalLength / sampleCount
    const centerX = new Float32Array(sampleCount)
    const centerZ = new Float32Array(sampleCount)
    const tangentX = new Float32Array(sampleCount)
    const tangentZ = new Float32Array(sampleCount)
    const halfWidth = new Float32Array(sampleCount)
    const point = new THREE.Vector3()
    const tangent = new THREE.Vector3()

    for (let i = 0; i < sampleCount; i += 1) {
      const distance = i * sampleSpacing

      road.sampleCenterlineByDistance(distance, point, tangent)
      centerX[i] = point.x
      centerZ[i] = point.z
      tangentX[i] = tangent.x
      tangentZ[i] = tangent.z
      halfWidth[i] = road.getTrackHalfWidthAtDistance(distance)
    }

    return {
      sampleSpacing,
      totalLength: road.totalLength,
      centerX,
      centerZ,
      tangentX,
      tangentZ,
      halfWidth,
    }
  }
}
