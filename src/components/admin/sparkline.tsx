// Tiny inline chart: daily counts as a line with a soft area, the last day marked.
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const width = 120
  const height = 36
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? width / (values.length - 1) : width
  const points = values.map((v, i) => [i * step, height - 3 - (v / max) * (height - 6)] as const)
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = points.at(-1) ?? [width, height - 3]
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <polygon
        points={`0,${height} ${line} ${width},${height}`}
        fill="var(--color-accent-text)"
        opacity="0.1"
      />
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-accent-text)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--color-accent-text)" />
    </svg>
  )
}
