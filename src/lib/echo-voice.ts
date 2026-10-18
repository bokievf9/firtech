// Voice out for Echo, one function for the page: speak(text). It tries the server's neural voice
// (/api/admin/echo/tts, only there when ECHO_TTS_URL is set on the server) and falls back to the
// browser's speechSynthesis. The environment is injected, so the logic is tested with fakes.

export type SpeakMode = 'remote' | 'browser'
export type SpeakHooks = {
  onStart?: (mode: SpeakMode) => void
  onBoundary?: () => void // a word was spoken (browser voice only)
}
export type Playback = { stop(): void; done: Promise<void> }
export type VoiceEnv = {
  fetch: (url: string, init: RequestInit) => Promise<Response>
  // Plays an audio blob; calls onStart when sound begins.
  playBlob: (blob: Blob, onStart: () => void) => Playback
  // The browser voice; null when speechSynthesis is missing.
  browserSpeak: ((text: string, hooks: SpeakHooks) => Playback) | null
}

export function createSpeaker(env: VoiceEnv, endpoint = '/api/admin/echo/tts') {
  // unknown until the first try; 404 means the server has no neural voice, so we stop asking.
  let remote: 'unknown' | 'yes' | 'no' = 'unknown'
  let current: Playback | null = null
  let ticket = 0

  const cancel = () => {
    ticket++
    current?.stop()
    current = null
  }

  async function viaServer(text: string, mine: number, hooks: SpeakHooks) {
    if (remote === 'no') return false
    try {
      const res = await env.fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.status === 404) {
        remote = 'no'
        return false
      }
      if (!res.ok) return false
      const blob = await res.blob()
      if (mine !== ticket) return true // cancelled while loading: nothing to play, nothing to fall back to
      remote = 'yes'
      current = env.playBlob(blob, () => hooks.onStart?.('remote'))
      await current.done
      return true
    } catch {
      return false
    }
  }

  async function speak(text: string, hooks: SpeakHooks = {}): Promise<SpeakMode | null> {
    cancel()
    const mine = ticket
    if (!text.trim()) return null
    if (await viaServer(text, mine, hooks))
      return mine === ticket || remote === 'yes' ? 'remote' : null
    if (mine !== ticket || !env.browserSpeak) return null
    current = env.browserSpeak(text, { ...hooks, onStart: () => hooks.onStart?.('browser') })
    await current.done
    return 'browser'
  }

  return {
    speak,
    cancel,
    get remote() {
      return remote
    },
  }
}

// The real browser environment, used by the page.
export function browserEnv(): VoiceEnv {
  const synth =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  return {
    fetch: (url, init) => fetch(url, init),
    playBlob: (blob, onStart) => {
      const audio = new Audio(URL.createObjectURL(blob))
      const done = new Promise<void>((resolve) => {
        const end = () => {
          URL.revokeObjectURL(audio.src)
          resolve()
        }
        audio.onplaying = onStart
        audio.onended = audio.onerror = end
        void audio.play().catch(end)
      })
      return { stop: () => audio.pause(), done }
    },
    browserSpeak: synth
      ? (text, hooks) => {
          synth.cancel()
          const u = new SpeechSynthesisUtterance(text)
          u.lang = 'ru-RU'
          u.rate = 1.04
          u.pitch = 0.92
          const voices = synth.getVoices().filter((v) => v.lang.startsWith('ru'))
          u.voice =
            voices.find((v) => /Yuri|Dmitri|Pavel|Maxim|male|муж/i.test(v.name)) ??
            voices[0] ??
            null
          const done = new Promise<void>((resolve) => {
            u.onstart = () => hooks.onStart?.('browser')
            u.onboundary = () => hooks.onBoundary?.()
            u.onend = u.onerror = () => resolve()
          })
          synth.speak(u)
          return { stop: () => synth.cancel(), done }
        }
      : null,
  }
}
