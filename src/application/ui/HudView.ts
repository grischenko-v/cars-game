import { createApp, h, reactive } from '@vue/runtime-dom'
import type { VNode } from '@vue/runtime-dom'

interface HudState {
  speed: number
  rpm: number
  gear: number
}

interface GaugeOptions {
  title: string
  value: string
  unit: string
  color: string
  dashOffset: number
  center: VNode[]
}

export class HudView {
  private readonly element: HTMLDivElement
  private readonly state = reactive<HudState>({
    speed: 0,
    rpm: 900,
    gear: 1,
  })

  constructor(parent: HTMLElement = document.body) {
    this.element = document.createElement('div')
    this.element.style.position = 'fixed'
    this.element.style.right = '16px'
    this.element.style.bottom = '16px'
    this.element.style.width = '344px'
    this.element.style.padding = '12px'
    this.element.style.background = 'linear-gradient(145deg, rgba(13,15,18,0.72), rgba(32,36,40,0.56))'
    this.element.style.backdropFilter = 'blur(8px)'
    this.element.style.color = '#fff'
    this.element.style.fontFamily = 'system-ui, sans-serif'
    this.element.style.fontSize = '15px'
    this.element.style.border = '1px solid rgba(255,255,255,0.12)'
    this.element.style.borderRadius = '22px'
    this.element.style.boxShadow = '0 18px 44px rgba(0,0,0,0.34)'
    this.element.style.zIndex = '10'
    this.element.style.userSelect = 'none'
    parent.appendChild(this.element)

    createApp({
      setup: () => () => this.render(),
    }).mount(this.element)
  }

  updateInstruments(kmh: number, rpm: number, gear: number): void {
    this.state.speed = kmh
    this.state.rpm = rpm
    this.state.gear = gear
  }

  private render() {
    const rpmRatio = Math.min(this.state.rpm / 7200, 1)
    const rpmColor = rpmRatio > 0.86 ? '#ff6b55' : '#f3e7a4'
    const speedRatio = Math.min(this.state.speed / 240, 1)

    return h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
        },
      },
      [
        this.renderGauge({
          title: 'SPEED',
          value: String(this.state.speed),
          unit: 'km/h',
          color: '#85d7ff',
          dashOffset: 276 - 276 * speedRatio,
          center: [
            h('div', { style: this.centerValueStyle(40) }, this.state.speed),
            h('div', { style: this.centerUnitStyle() }, 'km/h'),
          ],
        }),
        this.renderGauge({
          title: 'TACH',
          value: Math.round(this.state.rpm).toString(),
          unit: 'rpm',
          color: rpmColor,
          dashOffset: 276 - 276 * rpmRatio,
          center: [
            h('div', { style: { ...this.centerValueStyle(34), color: rpmColor } }, this.state.gear),
            h('div', { style: this.centerUnitStyle() }, 'GEAR'),
            h(
              'div',
              { style: { marginTop: '3px', fontSize: '12px', opacity: '0.82' } },
              Math.round(this.state.rpm)
            ),
          ],
        }),
      ]
    )
  }

  private renderGauge(options: GaugeOptions) {
    return h(
      'div',
      {
        style: {
          position: 'relative',
          height: '150px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 50% 56%, rgba(255,255,255,0.12) 0 2px, transparent 3px), radial-gradient(circle at 50% 50%, rgba(6,7,9,0.98) 0 54%, rgba(37,42,47,0.94) 55% 68%, rgba(8,10,12,0.96) 70%)',
          boxShadow:
            'inset 0 12px 22px rgba(255,255,255,0.08), inset 0 -18px 34px rgba(0,0,0,0.7), 0 8px 18px rgba(0,0,0,0.32)',
          overflow: 'hidden',
        },
      },
      [
        this.renderGaugeSvg(options),
        h(
          'div',
          {
            style: {
              position: 'absolute',
              inset: '0',
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              textShadow: '0 2px 10px rgba(0,0,0,0.78)',
            },
          },
          [
            h('div', [
              h(
                'div',
                { style: { fontSize: '10px', letterSpacing: '0.16em', opacity: '0.54' } },
                options.title
              ),
              ...options.center,
            ]),
          ]
        ),
        h(
          'div',
          {
            style: {
              position: 'absolute',
              left: '50%',
              bottom: '17px',
              transform: 'translateX(-50%)',
              fontSize: '10px',
              letterSpacing: '0.14em',
              opacity: '0.58',
              textTransform: 'uppercase',
            },
          },
          `${options.value} ${options.unit}`
        ),
      ]
    )
  }

  private renderGaugeSvg(options: GaugeOptions) {
    return h(
      'svg',
      {
        viewBox: '0 0 160 160',
        style: {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
        },
      },
      [
        h('circle', {
          cx: '80',
          cy: '80',
          r: '58',
          fill: 'none',
          stroke: 'rgba(255,255,255,0.1)',
          'stroke-width': '12',
          'stroke-linecap': 'round',
          'stroke-dasharray': '276 365',
          transform: 'rotate(132 80 80)',
        }),
        h('circle', {
          cx: '80',
          cy: '80',
          r: '58',
          fill: 'none',
          stroke: options.color,
          'stroke-width': '12',
          'stroke-linecap': 'round',
          'stroke-dasharray': '276 365',
          'stroke-dashoffset': options.dashOffset,
          transform: 'rotate(132 80 80)',
          style: {
            filter: `drop-shadow(0 0 5px ${options.color})`,
            transition: 'stroke-dashoffset 90ms linear',
          },
        }),
        h('circle', {
          cx: '80',
          cy: '80',
          r: '43',
          fill: 'rgba(0,0,0,0.2)',
          stroke: 'rgba(255,255,255,0.1)',
        }),
      ]
    )
  }

  private centerValueStyle(size: number) {
    return {
      fontSize: `${size}px`,
      fontWeight: '900',
      lineHeight: '0.92',
    }
  }

  private centerUnitStyle() {
    return {
      fontSize: '11px',
      letterSpacing: '0.12em',
      opacity: '0.72',
    }
  }
}
