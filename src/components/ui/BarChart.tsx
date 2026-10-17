import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

/** `id` estável é a chave React (nomes podem se repetir); sem ele, vale a posição. */
export type BarSeries = { id?: string; name: string; color: string; values: number[] }

type Props = {
  /** Rótulo curto de cada grupo (eixo X), ex.: "out.". */
  labels: string[]
  /** 1 a 6 séries; cada uma com um valor por rótulo. */
  series: BarSeries[]
  /** Formata os valores do balão e da tabela. */
  format: (v: number) => string
  /** Formata os rótulos do eixo Y (ex.: forma compacta). Padrão: `format`. */
  formatTick?: (v: number) => string
  /** Título de cada grupo no balão e na tabela (ex.: "outubro de 2026"). Padrão: `labels`. */
  titles?: string[]
  /** "Ocultar valores": esconde os rótulos do eixo Y e mascara balão e tabela. */
  hidden?: boolean
  /** Altura da área das barras em px. Padrão 200. */
  height?: number
  ariaLabel: string
}

const MASK = '••••'
const MAX_BAR = 24
const BAR_GAP = 2
const RADIUS = 4
const PAD_TOP = 8
const TOOLTIP_SHADOW = '0 0 0 1px rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px -4px rgb(0 0 0 / 0.12), 0 12px 32px -8px rgb(0 0 0 / 0.08)'

/** Passo "redondo" (1, 2, 2,5 ou 5 × 10ⁿ) para ~`count` linhas de grade até `max`. */
function niceStep(max: number, count: number): number {
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return nice * mag
}

/** Barra com os cantos de cima arredondados e a base reta na linha de base. */
function barPath(x: number, y: number, w: number, base: number): string {
  const h = base - y
  if (h <= 0 || w <= 0) return `M${x} ${base}H${x + w}`
  const r = Math.min(RADIUS, h, w / 2)
  return `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${base}Z`
}

/**
 * Gráfico de barras agrupadas em SVG próprio: uma coluna por série em cada rótulo, linha de base,
 * grade discreta, balão ao passar o mouse/dedo ou focar (setas entre grupos), legenda com 2+ séries
 * e uma tabela visualmente oculta com os dados.
 */
export function BarChart({ labels, series, format, formatTick = format, titles = labels, hidden = false, height = 200, ariaLabel }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [active, setActive] = useState<number | null>(null)
  const tipId = useId()

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    if (el.clientWidth) setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = labels.length
  const m = series.length
  const max = Math.max(0, ...series.flatMap((s) => s.values))
  const { step, top } = useMemo(() => {
    if (max <= 0) return { step: 1, top: 1 }
    const s = niceStep(max, 4)
    return { step: s, top: Math.ceil(max / s) * s }
  }, [max])
  const ticks = useMemo(() => {
    const out: number[] = []
    for (let v = step; v <= top + step / 2; v += step) out.push(v)
    return out
  }, [step, top])

  // Rótulos do eixo Y ficam numa calha à esquerda (nenhuma quando os valores estão ocultos).
  const tickTexts = ticks.map((v) => formatTick(v))
  const gutter = hidden || max <= 0 ? 0 : Math.ceil(Math.max(...tickTexts.map((s) => s.length)) * 6.4) + 10
  const plotW = Math.max(1, width - gutter)
  const base = height
  const band = n > 0 ? plotW / n : plotW
  const barW = Math.max(2, Math.min(MAX_BAR, (band * 0.72 - BAR_GAP * (m - 1)) / Math.max(1, m)))
  const groupW = barW * m + BAR_GAP * (m - 1)
  const yOf = (v: number) => base - (Math.max(0, v) / top) * (base - PAD_TOP)
  const centerOf = (i: number) => gutter + band * i + band / 2

  // Rótulos do eixo X: afina quando não cabem, sempre mantendo o último (mês atual).
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 36))))
  const shown = labels.map((_, i) => (n - 1 - i) % every === 0)

  function indexAt(clientX: number): number {
    const rect = root.current!.getBoundingClientRect()
    const x = clientX - rect.left - gutter
    return Math.max(0, Math.min(n - 1, Math.floor(x / band)))
  }
  function onPointer(e: PointerEvent<HTMLDivElement>) {
    if (n === 0 || !root.current) return
    setActive(indexAt(e.clientX))
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (n === 0) return
    const cur = active ?? n - 1
    let next: number
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(n - 1, cur + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, cur - 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else if (e.key === 'Escape') { setActive(null); return }
    else return
    e.preventDefault()
    setActive(next)
  }

  const value = (v: number) => (hidden ? MASK : format(v))
  const activeX = active !== null ? centerOf(active) : 0
  const tipOnLeft = active !== null && activeX > width / 2

  return (
    <div className="w-full select-none">
      <div
        ref={root}
        role="img"
        aria-label={ariaLabel}
        aria-describedby={active !== null ? tipId : undefined}
        tabIndex={0}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null) }}
        onFocus={() => setActive((a) => a ?? n - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
        className="relative w-full touch-pan-y rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        style={{ height }}
      >
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"
          style={{ overflow: 'visible' }}>
          {active !== null && (
            <rect data-testid="bar-highlight" x={gutter + band * active + 2} y={0} width={Math.max(0, band - 4)} height={base}
              rx={8} fill="var(--surface-2)" />
          )}
          {ticks.map((v, i) => (
            <g key={v}>
              <line x1={gutter} x2={width} y1={yOf(v)} y2={yOf(v)} stroke="var(--line)" strokeWidth={1} />
              {gutter > 0 && (
                <text x={gutter - 10} y={yOf(v)} dy="0.32em" textAnchor="end" fill="var(--muted)"
                  className="num text-[11px] font-medium">{tickTexts[i]}</text>
              )}
            </g>
          ))}
          {labels.map((_, i) => {
            const x0 = centerOf(i) - groupW / 2
            return (
              <g key={i}>
                {series.map((s, j) => (
                  <path key={j} data-bar="" d={barPath(x0 + j * (barW + BAR_GAP), yOf(s.values[i] ?? 0), barW, base)}
                    fill={s.color} />
                ))}
              </g>
            )
          })}
          <line x1={gutter} x2={width} y1={base - 0.5} y2={base - 0.5} stroke="var(--muted)" strokeOpacity={0.45} strokeWidth={1} />
        </svg>

        {active !== null && (
          <div id={tipId} role="tooltip"
            className="pointer-events-none absolute top-0 z-20 grid min-w-36 gap-1.5 rounded-xl bg-bg px-3 py-2 text-xs dark:bg-surface-2"
            style={{
              left: activeX,
              transform: tipOnLeft ? `translateX(calc(-100% - ${groupW / 2 + 12}px))` : `translateX(${groupW / 2 + 12}px)`,
              boxShadow: TOOLTIP_SHADOW,
            }}>
            <span className="whitespace-nowrap font-bold text-fg">{titles[active]}</span>
            {series.map((s, j) => (
              <span key={s.id ?? j} className="flex items-center gap-2 leading-none">
                <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <span className="whitespace-nowrap text-muted">{s.name}</span>
                <span className={`num ml-auto whitespace-nowrap pl-3 font-bold text-fg ${hidden ? 'tracking-[0.18em]' : ''}`}>
                  {value(s.values[active] ?? 0)}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="relative mt-2 h-4" aria-hidden="true">
        {labels.map((label, i) => {
          if (!shown[i]) return null
          // Nas pontas, com faixas estreitas, o rótulo alinha para dentro (como no LineChart).
          const narrow = band < 48
          const edge = narrow && i === 0 ? 'start' : narrow && i === n - 1 ? 'end' : 'center'
          const left = edge === 'start' ? gutter + band * i : edge === 'end' ? gutter + band * (i + 1) : centerOf(i)
          const shift = edge === 'start' ? 'translate-x-0' : edge === 'end' ? '-translate-x-full' : '-translate-x-1/2'
          return (
            <span key={i} className={`absolute top-0 whitespace-nowrap text-[11px] font-medium leading-none ${shift} ${
              i === active ? 'font-bold text-fg' : 'text-muted'}`} style={{ left }}>
              {label}
            </span>
          )
        })}
      </div>

      {m > 1 && (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2" aria-hidden="true">
          {series.map((s, j) => (
            <li key={s.id ?? j} className="flex items-center gap-2 text-[13px] font-semibold text-muted">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}

      {/* O invólucro (não a tabela) é que fica oculto: tabela não encolhe e alargaria a página. */}
      <div className="sr-only">
      <table>
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col"></th>
            {series.map((s, j) => <th key={s.id ?? j} scope="col">{s.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {labels.map((_, i) => (
            <tr key={i}>
              <th scope="row">{titles[i]}</th>
              {series.map((s, j) => <td key={s.id ?? j}>{value(s.values[i] ?? 0)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
