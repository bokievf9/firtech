import type { MetadataRoute } from 'next'

// Web app manifest (served at /manifest.webmanifest, linked by Next). The icons are the file
// conventions next to it: icon.png (512), apple-icon.png (180), favicon.ico.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fir Tech',
    short_name: 'fir.tech',
    description: 'AI agents, Telegram bots and websites for small business',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0d0b',
    theme_color: '#0a0d0b',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
