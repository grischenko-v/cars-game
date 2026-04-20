export interface DriveControls {
  throttle: number
  steer: number
  brake: boolean
  canDrive: boolean
  maxForwardSpeed: number
  accelerationFactor?: number
  handlingFactor?: number
  gripFactor?: number
  extraRideHeight: number
}
