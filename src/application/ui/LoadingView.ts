export class LoadingView {
  private readonly element: HTMLDivElement
  private readonly title: HTMLDivElement
  private readonly details: HTMLDivElement

  constructor(parent: HTMLElement = document.body) {
    this.element = document.createElement('div')
    this.title = document.createElement('div')
    this.details = document.createElement('div')

    this.element.style.position = 'fixed'
    this.element.style.inset = '0'
    this.element.style.display = 'flex'
    this.element.style.flexDirection = 'column'
    this.element.style.alignItems = 'center'
    this.element.style.justifyContent = 'center'
    this.element.style.gap = '14px'
    this.element.style.background =
      'radial-gradient(circle at center, rgba(26,31,36,0.82), rgba(9,12,15,0.94))'
    this.element.style.color = '#fff'
    this.element.style.fontFamily = 'system-ui, sans-serif'
    this.element.style.zIndex = '30'
    this.element.style.userSelect = 'none'

    this.title.style.fontSize = 'clamp(48px, 11vw, 132px)'
    this.title.style.fontWeight = '800'
    this.title.style.letterSpacing = '0.04em'
    this.title.style.textShadow = '0 10px 34px rgba(0,0,0,0.38)'

    this.details.style.fontSize = 'clamp(16px, 2vw, 24px)'
    this.details.style.opacity = '0.82'

    this.element.append(this.title, this.details)
    parent.appendChild(this.element)
  }

  showLoading(progress: number | null): void {
    this.element.style.display = 'flex'
    this.title.textContent = 'Загрузка'
    this.details.textContent =
      progress === null
        ? 'Подготавливаем Mustang...'
        : `Модель машины: ${Math.round(progress * 100)}%`
  }

  showCountdown(label: string): void {
    this.element.style.display = 'flex'
    this.title.textContent = label
    this.details.textContent = label === 'GO!' ? 'Поехали!' : 'Старт через...'
  }

  showError(message: string): void {
    this.element.style.display = 'flex'
    this.title.textContent = 'Ошибка'
    this.details.textContent = message
  }

  hide(): void {
    this.element.style.display = 'none'
  }
}
