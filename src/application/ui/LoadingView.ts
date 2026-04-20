import { createApp, reactive } from 'vue'
import LoadingOverlay from './components/LoadingOverlay.vue'

interface LoadingState {
  visible: boolean
  title: string
  details: string
  mode: 'loading' | 'countdown' | 'error'
}

export class LoadingView {
  private readonly state = reactive<LoadingState>({
    visible: true,
    title: 'Загрузка',
    details: 'Подготавливаем Mustang...',
    mode: 'loading',
  })

  constructor(parent: HTMLElement = document.body) {
    const mountElement = document.createElement('div')
    parent.appendChild(mountElement)

    createApp(LoadingOverlay, {
      state: this.state,
    }).mount(mountElement)
  }

  showLoading(progress: number | null): void {
    this.state.visible = true
    this.state.mode = 'loading'
    this.state.title = 'Загрузка'
    this.state.details =
      progress === null
        ? 'Подготавливаем машины...'
        : `Модели машин: ${Math.round(progress * 100)}%`
  }

  showCountdown(label: string): void {
    this.state.visible = true
    this.state.mode = 'countdown'
    this.state.title = label
    this.state.details = label === 'GO!' ? 'Поехали!' : 'Старт через...'
  }

  showError(message: string): void {
    this.state.visible = true
    this.state.mode = 'error'
    this.state.title = 'Ошибка'
    this.state.details = message
  }

  hide(): void {
    this.state.visible = false
  }
}
