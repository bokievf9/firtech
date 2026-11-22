'use client'

import { useEffect, useRef, useState } from 'react'
import { admin } from '@/content/admin'
import { columnChart, labelIndexes, type Column } from '@/lib/shell-dashboard'

const d = admin.hq.dashboard

export type ChartPoint = { label: string; short: string; value: number; text: string }

// The width of an element, tracked with a ResizeObserver, so the SVG is drawn 1:1 in CSS pixels (text never scales).
function useWidth(initial = 320) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setWidth(Math.max(200, Math.round(el.getBoundingClientRect().width)))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

// A column's path: square at the baseline, a 2px rounded data end (marks-and-anatomy of the dataviz skill).
function columnPath(c: Column, base: number) {
  const r = Math.min(2, c.w / 2, c.h)
  return `M${c.x},${base} V${c.y + r} Q${c.x},${c.y} ${c.x + r},${c.y} H${c.x + c.w - r} Q${c.x + c.w},${c.y} ${c.x + c.w},${c.y + r} V${base} Z`
}

// One-series column chart in the Shell's tokens: one accent hue (`accent-text`: dark green on light, lime on dark), a hairline
// grid, 3 value ticks, a few x labels, a hover/arrow-key crosshair with a tooltip, and the same numbers as a table under
// «Show as a table». `unit` prefixes the tooltip and tick values (`$`).
export function ColumnsChart({ title, points, unit = '', valueLabel, rowLabel, empty, height = 132 }: { title: string; points: ChartPoint[]; unit?: string; valueLabel: string; rowLabel: string; empty: string; height?: number }) {
  const { ref, width } = useWidth()
  const [active, setActive] = useState<number | null>(null)
  const chart = columnChart(points.map((p) => ({ label: p.label, value: p.value })), width, height)
  const keep = labelIndexes(points.length)
  const summary = `${title}: ${points.map((p) => `${p.label} ${unit}${p.text}`).join(', ')}`
  const pitch = points.length ? (chart.width - 38) / points.length : 0
  const tip = active !== null ? points[active] : null

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1))
    else if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1))
    else if (e.key === 'Escape') setActive(null)
    else return
    e.preventDefault()
  }

  return (
    <figure className="m-0" data-chart={title}>
      <div ref={ref} className="relative">
        <svg
          width={chart.width}
          height={chart.height}
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="img"
          aria-label={summary}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="block max-w-full rounded-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-text"
        >
          {chart.ticks.map((t) => {
            const y = chart.baseline - (t / chart.max) * (chart.baseline - chart.top)
            return (
              <g key={t}>
                <line x1={34} x2={chart.width - 4} y1={y} y2={y} stroke="var(--color-line)" strokeWidth={1} />
                <text x={30} y={y + 3.5} textAnchor="end" fontSize={10} fill="var(--color-muted)" className="font-mono">
                  {Number.isInteger(t) ? t : t.toFixed(1)}
                </text>
              </g>
            )
          })}
          {chart.columns.map((c, i) => (
            <g key={c.label + i}>
              {c.h > 0 ? <path d={columnPath(c, chart.baseline)} fill="var(--color-accent-text)" opacity={active === null || active === i ? 1 : 0.45} /> : null}
              {keep.has(i) ? (
                <text x={c.x + c.w / 2} y={chart.height - 4} textAnchor="middle" fontSize={10} fill="var(--color-muted)" className="font-mono">
                  {points[i]!.short}
                </text>
              ) : null}
              <rect x={34 + i * pitch} y={chart.top} width={pitch} height={chart.baseline - chart.top} fill="transparent" onPointerEnter={() => setActive(i)} onPointerMove={() => setActive(i)} />
            </g>
          ))}
          {active !== null && chart.columns[active] ? <line x1={chart.columns[active]!.x + chart.columns[active]!.w / 2} x2={chart.columns[active]!.x + chart.columns[active]!.w / 2} y1={chart.top} y2={chart.baseline} stroke="var(--color-line-strong)" strokeWidth={1} /> : null}
        </svg>
        {tip && active !== null && chart.columns[active] ? (
          <div
            role="status"
            data-chart-tip
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-hairline border-glass-line bg-elevated px-2 py-1 text-caption shadow-float"
            style={{ left: Math.min(Math.max(chart.columns[active]!.x + chart.columns[active]!.w / 2, 56), chart.width - 56) }}
          >
            <span className="text-muted">{tip.label}</span> <span className="font-mono tabular-nums text-fg">{unit}{tip.text}</span>
          </div>
        ) : null}
        {chart.empty ? <p className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-footnote text-muted">{empty}</p> : null}
      </div>
      <details className="mt-1.5 text-footnote text-muted">
        <summary className="inline-flex min-h-8 cursor-pointer items-center rounded-full hover:text-fg">{d.openTable}</summary>
        <table className="mt-1 w-full text-left text-footnote">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th className="py-1 pr-3 font-normal">{rowLabel}</th>
              <th className="py-1 text-right font-normal">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label} className="border-t border-hairline border-line">
                <td className="py-1 pr-3">{p.label}</td>
                <td className="py-1 text-right font-mono tabular-nums">{unit}{p.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
