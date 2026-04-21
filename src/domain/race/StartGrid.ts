import * as THREE from 'three'

export interface StartGridTrack {
  startAngle: number
  totalLength: number
  nominalLaneWidth: number
  getTrackHalfWidthAtDistance(distance: number): number
}

export interface StartGridSlot {
  index: number
  distanceOffset: number
  lateralOffset: number
  length: number
  width: number
}

export const START_GRID_OPPONENT_COUNT = 6
export const START_GRID_PLAYER_SLOT_INDEX = START_GRID_OPPONENT_COUNT

const FIRST_SLOT_DISTANCE_OFFSET = -5.1
const SLOT_ROW_SPACING = 7.2
const SLOT_LENGTH = 6.2
const SLOT_WIDTH = 3.65
const EDGE_CLEARANCE = 0.55

export function getStartDistance(track: StartGridTrack): number {
  return (
    (THREE.MathUtils.euclideanModulo(track.startAngle, Math.PI * 2) / (Math.PI * 2)) *
    track.totalLength
  )
}

export function getStartGridSlot(track: StartGridTrack, index: number): StartGridSlot {
  const distanceOffset = FIRST_SLOT_DISTANCE_OFFSET - SLOT_ROW_SPACING * index
  const distance = getStartDistance(track) + distanceOffset
  const halfWidth = track.getTrackHalfWidthAtDistance(distance)
  const laneCenterOffset = track.nominalLaneWidth * 0.5
  const maxOffset = Math.max(0, halfWidth - SLOT_WIDTH * 0.5 - EDGE_CLEARANCE)
  const lateralOffset = THREE.MathUtils.clamp(
    laneCenterOffset,
    0,
    maxOffset
  ) * (index % 2 === 0 ? -1 : 1)

  return {
    index,
    distanceOffset,
    lateralOffset,
    length: SLOT_LENGTH,
    width: SLOT_WIDTH,
  }
}

export function getStartGridSlots(
  track: StartGridTrack,
  slotCount = START_GRID_OPPONENT_COUNT + 1
): StartGridSlot[] {
  return Array.from({ length: slotCount }, (_, index) => getStartGridSlot(track, index))
}
