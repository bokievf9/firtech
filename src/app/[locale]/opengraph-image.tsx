import { ImageResponse } from 'next/og'

export const alt = 'Fir Tech: websites, Telegram bots, apps and automation'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Latin-only text: the built-in OG font has no Cyrillic, and the card reads the same in both languages.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(150deg, #0a0d0b 55%, #1d3a2a 100%)',
          color: '#edf2ea',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="9" fill="#b5eb6a" />
            <path d="M16 6.5 21 12h-10z" fill="#0d1408" />
            <path d="M16 10.5 23 18H9z" fill="#0d1408" />
            <path d="M16 14.5 25 24.5H7z" fill="#0d1408" />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 600 }}>Fir Tech</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <span style={{ fontSize: 76, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05 }}>
            Websites, bots, apps and automation
          </span>
          <span style={{ fontSize: 36, color: '#b5eb6a' }}>From $100. Fixed price before we start.</span>
        </div>
      </div>
    ),
    size,
  )
}
