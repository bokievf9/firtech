import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { formatUsd } from '@/lib/pricing'
import { lowestPrice } from '@/lib/seo'

export const alt = 'Fir Tech: AI agents, Telegram bots and websites for small business'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Latin-only text: the built-in OG font has no Cyrillic, and the card reads the same in both languages.
export default async function OpengraphImage() {
  // The brand wordmark font (OFL); the card is rendered at build time.
  const brand = await readFile(join(process.cwd(), 'assets/fonts/Unbounded-Bold.ttf'))
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
        <div style={{ display: 'flex', fontFamily: 'Unbounded', fontSize: 54, letterSpacing: -2.5 }}>
          <span>fir</span>
          <span style={{ color: '#b5eb6a' }}>.</span>
          <span>tech</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <span style={{ fontSize: 76, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05 }}>
            AI agents, Telegram bots and websites
          </span>
          <span style={{ fontSize: 36, color: '#b5eb6a' }}>{`From ${formatUsd(lowestPrice)}. Fixed price before we start.`}</span>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Unbounded', data: brand, weight: 700, style: 'normal' }] },
  )
}
