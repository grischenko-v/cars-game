export interface KeyState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  brake: boolean
  restart: boolean
  cameraToggle: boolean
}

type KeyBinding = keyof KeyState

export class KeyboardInput {
  readonly keys: KeyState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
    restart: false,
    cameraToggle: false,
  }

  private readonly bindings = new Map<string, KeyBinding>([
    ['ArrowUp', 'forward'],
    ['KeyW', 'forward'],
    ['ArrowDown', 'backward'],
    ['KeyS', 'backward'],
    ['ArrowLeft', 'left'],
    ['KeyA', 'left'],
    ['ArrowRight', 'right'],
    ['KeyD', 'right'],
    ['Space', 'brake'],
    ['KeyR', 'restart'],
    ['Enter', 'restart'],
    ['KeyV', 'cameraToggle'],
  ])

  constructor(private readonly target: Window = window) {
    this.target.addEventListener('keydown', this.handleKeyDown)
    this.target.addEventListener('keyup', this.handleKeyUp)
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown)
    this.target.removeEventListener('keyup', this.handleKeyUp)
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.setKey(event, true)
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.setKey(event, false)
  }

  private setKey(event: KeyboardEvent, pressed: boolean): void {
    const binding = this.bindings.get(event.code)
    if (!binding) return

    if (binding === 'cameraToggle') {
      if (pressed && !event.repeat) {
        this.keys.cameraToggle = true
      }

      event.preventDefault()
      return
    }

    this.keys[binding] = pressed
    event.preventDefault()
  }
}
