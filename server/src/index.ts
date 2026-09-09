import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import { command, getSession, interrupt } from './engine.js'
import { cancelTts, getRimeValidation, synthesize } from './tts.js'
import { answerWithLLM, classifyRoute } from './qa.js'
import { isLLMConfigured } from './llm.js'

dotenv.config({ path: new URL('../../.env', import.meta.url) })

const app = express()
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '32kb' }))

app.get('/health', (_request, response) => response.json({ status: 'ok', rimeConfigured: getRimeValidation().configured, speechRecognition: 'browser', incidentEngine: 'deterministic', voiceTransport: 'browser-direct', rime: getRimeValidation() }))
app.get('/api/rime/validate', (_request, response) => response.json(getRimeValidation()))
app.post('/api/ai/answer', async (request, response) => { const body = request.body ?? {}; const sessionId = String(body.sessionId ?? 'demo'); const question = String(body.question ?? ''); if (!question.trim()) return response.status(400).json({ answer: 'A question is required.', grounded: true }); const session = getSession(sessionId); try { const result = await answerWithLLM(question, session.intelligence, null, session.turns.slice(-8).map(turn => ({ role: turn.role, text: turn.text })), undefined, classifyRoute(question) === 'GENERAL_KNOWLEDGE'); response.json({ ...result, grounded: result.usesIncidentState }); } catch { response.status(503).json({ answer: 'The answer request was cancelled or unavailable.', grounded: false }); } })
app.post('/api/commands', async (request, response) => {
  const body = request.body ?? {}
  cancelTts(body.sessionId ?? 'demo')
  response.json(await command(body.sessionId ?? 'demo', body.turnId ?? crypto.randomUUID(), body.command ?? '', body.notifyDelayMs ?? 3000))
})
app.get('/api/sessions/:id', (request, response) => response.json(getSession(request.params.id)))
app.get('/api/sessions/:id/events', (request, response) => response.json(getSession(request.params.id).events))
app.post('/api/sessions/:id/interrupt', (request, response) => {
  cancelTts(request.params.id)
  response.json(interrupt(request.params.id))
})
app.post('/api/tts', async (request, response) => {
  const { text, sessionId, generationId, userTurnEndedAt } = request.body ?? {}
  if (!text || !sessionId || !Number.isInteger(generationId)) return response.status(400).json({ provider: 'Rime', status: 'failed', message: 'text, sessionId, and generationId are required' })
  const controller = new AbortController()
  const disconnected = () => { if (!response.writableEnded) controller.abort() }
  response.on('close', disconnected)
  try {
    const result = await synthesize(String(text), String(sessionId), Number(generationId), controller.signal)
    if (response.destroyed) return
    response.setHeader('Content-Type', 'audio/mpeg')
    response.setHeader('X-Rime-Metadata', Buffer.from(JSON.stringify({ ...result.metadata, sessionId, generationId, userTurnEndedAt: userTurnEndedAt ?? null })).toString('base64url'))
    response.send(result.audio)
  } catch (error) {
    if (response.destroyed) return
    const message = error instanceof Error ? error.message : 'Rime unavailable'
    response.status(message === 'Stale generation' ? 409 : 503).json({ provider: 'Rime', status: message === 'Stale generation' ? 'stale-discarded' : 'unavailable', message })
  } finally { response.off('close', disconnected) }
})

const port = Number(process.env.PORT || 3001)
app.listen(port, () => { console.log(`IncidentVoice API listening on http://localhost:${port}`); console.log(`Rime: ${getRimeValidation().configured ? 'configured' : 'not configured'}`); console.log(`LLM: ${isLLMConfigured() ? 'configured' : 'not configured'}`) })
