import * as THREE from 'three'
import { createApp, h, reactive } from '@vue/runtime-dom'

interface HudState {
  speed: number
  rpm: number
  gear: number
}

interface AnalogGaugeOptions {
  title: string
  unit: string
  value: number
  maxValue: number
  majorStep: number
  minorStep: number
  accentColor: string
  dangerFrom?: number
  bottomLabel?: string
}

const START_ANGLE = -132
const SWEEP_ANGLE = 264
const CENTER = 80

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
    this.element.style.width = '352px'
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
    if (
      this.state.speed === kmh &&
      this.state.gear === gear &&
      Math.abs(this.state.rpm - rpm) < 35
    ) {
      return
    }

    this.state.speed = kmh
    this.state.rpm = rpm
    this.state.gear = gear
  }

  private render() {
    const rpmInThousands = this.state.rpm / 1000

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
        this.renderAnalogGauge({
          title: 'SPEED',
          unit: 'km/h',
          value: this.state.speed,
          maxValue: 240,
          majorStep: 40,
          minorStep: 20,
          accentColor: '#85d7ff',
          bottomLabel: `${this.state.speed} km/h`,
        }),
        this.renderAnalogGauge({
          title: 'RPM',
          unit: 'x1000',
          value: rpmInThousands,
          maxValue: 8,
          majorStep: 1,
          minorStep: 0.5,
          accentColor: this.state.rpm > 6200 ? '#ff6b55' : '#f3e7a4',
          dangerFrom: 6.4,
          bottomLabel: String(this.state.gear),
        }),
      ]
    )
  }

  private renderAnalogGauge(options: AnalogGaugeOptions) {
    const clampedValue = Math.max(0, Math.min(options.value, options.maxValue))
    const needleAngle = this.valueToAngle(clampedValue, options.maxValue)

    return h(
      'div',
      {
        style: {
          position: 'relative',
          height: '158px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 50% 48%, rgba(255,255,255,0.14) 0 2px, transparent 3px), radial-gradient(circle at 50% 52%, rgba(5,6,8,0.98) 0 52%, rgba(36,41,47,0.96) 54% 70%, rgba(7,9,12,0.98) 72%)',
          boxShadow:
            'inset 0 13px 24px rgba(255,255,255,0.08), inset 0 -20px 36px rgba(0,0,0,0.76), 0 8px 18px rgba(0,0,0,0.32)',
          overflow: 'hidden',
        },
      },
      [
        h(
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
            this.renderScaleRing(),
            ...this.renderTicks(options),
            options.dangerFrom ? this.renderDangerArc(options) : null,
            this.renderNeedle(needleAngle, options.accentColor),
            h('circle', {
              cx: CENTER,
              cy: CENTER,
              r: '6.5',
              fill: '#16191d',
              stroke: options.accentColor,
              'stroke-width': '2',
            }),
          ]
        ),
        h(
          'div',
          {
            style: {
              position: 'absolute',
              left: '50%',
              top: '31px',
              transform: 'translateX(-50%)',
              fontSize: '10px',
              fontWeight: '800',
              letterSpacing: '0.18em',
              opacity: '0.62',
            },
          },
          options.title
        ),
        h(
          'div',
          {
            style: {
              position: 'absolute',
              left: '50%',
              bottom: '24px',
              transform: 'translateX(-50%)',
              minWidth: '54px',
              padding: '3px 8px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: options.accentColor,
              fontSize: '10px',
              fontWeight: '900',
              letterSpacing: '0.12em',
              textAlign: 'center',
            },
          },
          options.bottomLabel ?? options.unit
        ),
      ]
    )
  }

  private renderScaleRing() {
    return h('circle', {
      cx: CENTER,
      cy: CENTER,
      r: '59',
      fill: 'rgba(0,0,0,0.16)',
      stroke: 'rgba(255,255,255,0.1)',
      'stroke-width': '2',
    })
  }

  private renderTicks(options: AnalogGaugeOptions) {
    const ticks = []
    const totalTicks = Math.round(options.maxValue / options.minorStep)

    for (let i = 0; i <= totalTicks; i++) {
      const value = i * options.minorStep
      const isMajor = Math.abs(value / options.majorStep - Math.round(value / options.majorStep)) < 0.001
      const angle = this.valueToAngle(value, options.maxValue)
      const tickColor = options.dangerFrom && value >= options.dangerFrom
        ? '#ff6b55'
        : 'rgba(255,255,255,0.78)'
      const outer = this.pointOnGauge(angle, 60)
      const inner = this.pointOnGauge(angle, isMajor ? 49 : 54)

      ticks.push(
        h('line', {
          x1: outer.x,
          y1: outer.y,
          x2: inner.x,
          y2: inner.y,
          stroke: tickColor,
          'stroke-width': isMajor ? 2.4 : 1.1,
          'stroke-linecap': 'round',
        })
      )

      if (isMajor) {
        const labelPoint = this.pointOnGauge(angle, 38)
        ticks.push(
          h(
            'text',
            {
              x: labelPoint.x,
              y: labelPoint.y,
              fill: tickColor,
              'font-size': options.maxValue <= 10 ? '8' : '7',
              'font-weight': '800',
              'text-anchor': 'middle',
              'dominant-baseline': 'middle',
            },
            String(Math.round(value))
          )
        )
      }
    }

    return ticks
  }

  private renderDangerArc(options: AnalogGaugeOptions) {
    if (!options.dangerFrom) return null

    const start = this.valueToAngle(options.dangerFrom, options.maxValue)
    const end = this.valueToAngle(options.maxValue, options.maxValue)
    const startPoint = this.pointOnGauge(start, 63)
    const endPoint = this.pointOnGauge(end, 63)
    const largeArc = end - start > 180 ? 1 : 0

    return h('path', {
      d: `M ${startPoint.x} ${startPoint.y} A 63 63 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`,
      fill: 'none',
      stroke: '#ff6b55',
      'stroke-width': '4',
      'stroke-linecap': 'round',
      opacity: '0.72',
    })
  }

  private renderNeedle(angle: number, color: string) {
    const tip = this.pointOnGauge(angle, 50)
    const tail = this.pointOnGauge(angle + 180, 12)

    return h('g', { style: { transition: 'transform 80ms linear' } }, [
      h('line', {
        x1: tail.x,
        y1: tail.y,
        x2: tip.x,
        y2: tip.y,
        stroke: color,
        'stroke-width': '3',
        'stroke-linecap': 'round',
        style: {
          filter: `drop-shadow(0 0 4px ${color})`,
        },
      }),
    ])
  }

  private valueToAngle(value: number, maxValue: number): number {
    return START_ANGLE + (value / maxValue) * SWEEP_ANGLE
  }

  private pointOnGauge(angleDeg: number, radius: number): { x: number; y: number } {
    const radians = THREE.MathUtils.degToRad(angleDeg - 90)

    return {
      x: CENTER + Math.cos(radians) * radius,
      y: CENTER + Math.sin(radians) * radius,
    }
  }
}
