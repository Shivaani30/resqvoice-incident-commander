import { getSession } from './engine.js'

type RimeConfig = {
  apiKey: string
  modelId: string
  voice: string
  language: string
  endpoint: string
}

const activeRequests = new Map<string, AbortController>()

export function getRimeValidation() {
  const names = ['RIME_API_KEY', 'RIME_MODEL_ID', 'RIME_VOICE', 'RIME_LANGUAGE', 'RIME_ENDPOINT'] as const
  const missing = names.filter((name) => !process.env[name]?.trim())
  return {
    provider: 'Rime',
    configured: missing.length === 0,
    mockMode: process.env.MOCK_TTS === 'true',
    missing,
    audioFormat: 'audio/mpeg',
    transport: 'HTTPS streaming response buffered behind generation fence',
  }
}

function readConfig(): RimeConfig {
  const validation = getRimeValidation()
  if (!validation.configured) throw new Error(`Missing Rime configuration: ${validation.missing.join(', ')}`)
  return {
    apiKey: process.env.RIME_API_KEY!,
    modelId: process.env.RIME_MODEL_ID!,
    voice: process.env.RIME_VOICE!,
    language: process.env.RIME_LANGUAGE!,
    endpoint: process.env.RIME_ENDPOINT!,
  }
}

export function cancelTts(sessionId: string) {
  activeRequests.get(sessionId)?.abort()
  activeRequests.delete(sessionId)
}

export async function synthesize(text: string, sessionId: string, generationId: number, signal?: AbortSignal) {
  if (getSession(sessionId).generationId !== generationId) throw new Error('Stale generation')
  if (signal?.aborted) throw new Error('Stale generation')
  const config = readConfig()
  cancelTts(sessionId)
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  activeRequests.set(sessionId, controller)
  const requestStartedAt = Date.now()
  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]),
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: text.slice(0, 500), modelId: config.modelId, speaker: config.voice, lang: config.language, samplingRate: 22050 }),
    })
    const firstAudioByteAt = Date.now()
    if (!response.ok) throw new Error(`Rime returned HTTP ${response.status}`)
    const audio = Buffer.from(await response.arrayBuffer())
    if (controller.signal.aborted || getSession(sessionId).generationId !== generationId) throw new Error('Stale generation')
    return { audio, metadata: { provider: 'Rime', modelId: config.modelId, voice: config.voice, language: config.language, audioFormat: 'audio/mpeg', requestStartedAt, firstAudioByteAt, firstAudioByteLatencyMs: firstAudioByteAt - requestStartedAt } }
  } catch (error) {
    if (controller.signal.aborted || getSession(sessionId).generationId !== generationId) throw new Error('Stale generation')
    if (error instanceof Error && /^Rime returned HTTP \d+$/.test(error.message)) throw error
    throw new Error('Rime request failed or timed out')
  } finally {
    signal?.removeEventListener('abort', abort)
    if (activeRequests.get(sessionId) === controller) activeRequests.delete(sessionId)
  }
}
