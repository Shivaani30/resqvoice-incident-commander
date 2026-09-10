# IncidentVoice Commander / ResQVoice

ResQVoice is a browser-direct voice incident workspace designed to turn live incident conversation into structured incident intelligence.

It tracks facts, hypotheses, evidence, contradictions, unknowns, actions, decisions, risks, and timeline events. Routine updates can change state silently; direct requests and selected operational events can trigger spoken responses.

## 1. Project Overview

Incident responders must track changing observations, competing explanations, and decisions while coordinating work. Voice lets a responder contribute without typing every turn. ResQVoice maintains structured incident state and evidence provenance alongside the transcript. Uncertainty is explicit: responder reports are not independent production measurements.

The implementation combines bounded deterministic incident rules with optional LLM analysis. It does not rely solely on chat history to represent the incident.

## 2. Tech Stack

| Area | Implementation |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| Backend | Node.js, Express 5, TypeScript, dotenv, CORS |
| Speech input | Browser Web Speech API: SpeechRecognition / webkitSpeechRecognition |
| Voice output | Server-side Rime TTS |
| Incident intelligence | Deterministic engine; process-local in-memory sessions |
| AI reasoning | Optional chat-completions provider; local configuration uses Groq openai/gpt-oss-120b |
| Playback / export | Browser HTMLAudioElement, Blob/object URLs; jsPDF summaries |
| Development | npm workspaces, concurrently, tsx |

## 3. Actual Architecture

```text
Browser microphone
  -> Web Speech recognition (en-US)
      -> interim transcript displayed locally
      -> final transcript (or typed command)
  -> POST /api/commands -> request / intent router
      -> statements/actions/decisions: deterministic incident engine
      -> state queries: deterministic answers
      -> analysis/general questions: optional grounded LLM
  -> intervention policy + limited answer safety / generation checks
      -> silent state/UI update
      OR
      -> response text recorded in transcript
      -> POST /api/tts -> server-side Rime HTTPS request
      -> complete audio buffered and generation checked
      -> browser Blob -> object URL -> Audio playback
         (recognition paused during playback)

Authoritative server session
  -> facts / hypotheses / evidence / conflicts / questions
  -> actions / decisions / risks / event timeline
  -> browser session polling -> intelligence panels / PDF summary
```

`server/src/engine.ts` owns authoritative state in a Map; `intelligence.ts` applies evidence rules. `qa.ts` routes requests and builds LLM context. LLM answers do not directly mutate intelligence or execute recommendations. The browser polls session state every 700 ms. Interim speech is not committed to the engine.

Rime is requested only for nonempty spoken responses. The browser handles STT; no separate STT endpoint or external real-time room provider is needed.

## 4. Third-Party Services

### Rime

These values match `.env.example` and inspected non-secret local configuration. The helper requires all five RIME variables; these are configuration values, not hardcoded fallbacks.

| Setting | Value |
| --- | --- |
| Provider | Rime |
| Model ID | `mistv2` |
| Speaker / Voice | `astra` |
| Language | `eng` |
| Endpoint | `https://users.rime.ai/v1/rime-tts` |
| Audio format | Requested `Accept: audio/mpeg`; backend-served `Content-Type: audio/mpeg` |
| Sampling rate | Requested `22050` Hz |
| Transport | HTTPS POST from Node/Express; full response buffered before browser delivery |
| Authentication | Server-side `Authorization: Bearer <RIME_API_KEY>` |
| Playback | `/api/tts` -> `response.blob()` -> object URL -> `new Audio(url)` |

Exact request shape from `server/src/tts.ts` with the configuration above:

```json
{
  "text": "<response text sliced to 500 JavaScript string units>",
  "modelId": "mistv2",
  "speaker": "astra",
  "lang": "eng",
  "samplingRate": 22050
}
```

Headers also include `Content-Type: application/json`. There is no JSON audio-format selector. The server reads `response.arrayBuffer()` and labels the bytes `audio/mpeg` without checking upstream Content-Type or validating the encoded audio. This is the requested/served MPEG audio contract, not an independently verified provider codec or returned sample rate. Playback is buffered, not progressive streaming or WebSocket transport.

`GET /api/rime/validate` and `GET /health` check configuration presence, not successful synthesis. `MOCK_TTS` only changes reported `mockMode`; synthesis has no mock branch. Keep it `false`. There is no alternate TTS provider or browser speech-synthesis fallback.

### Groq

LLM reasoning is implemented and enabled by the inspected local configuration. A fresh `.env.example` leaves it disabled until all four LLM variables are filled. There is no hardcoded model/endpoint fallback.

| Setting | Inspected configuration |
| --- | --- |
| Provider | Groq through GenericChatCompletionsProvider |
| LLM_PROVIDER | `generic-chat-completions` (presence gate, not a provider registry) |
| Endpoint | `https://api.groq.com/openai/v1/chat/completions` |
| Model | `openai/gpt-oss-120b` |
| API / transport | OpenAI-compatible chat completions; non-streaming HTTPS POST |
| Authentication | Server-side Bearer LLM_API_KEY |
| Purpose | Incident analysis and broader knowledge questions; state queries bypass it |

Requests contain `model`, `temperature: 0.15`, and system/user messages. Context includes structured incident state and up to eight recent turns. Even general-knowledge requests currently receive incident context. The prompt requests JSON with an answer, grounding, confidence, and optional recommendation; nonempty plain text is also accepted.

The prompt prohibits invented facts and unsupported confirmation. A narrow post-check replaces certain unsupported deployment-causation claims; this is not comprehensive factual validation. The separate `/api/ai/answer` endpoint returns analysis text and does not invoke Rime.

### Browser Web Speech API

Recognition uses `continuous = true`, `interimResults = true`, and `lang = 'en-US'`. No separate STT key is needed. Use a compatible Chromium-based browser on localhost or HTTPS and allow microphone access. Support varies; recognition may use a browser-managed network service and is not guaranteed offline/on-device.

## 5. Setup Instructions

Prerequisites:

- Node.js 22.12+ and npm (installed Vite also supports Node 20.19+).
- A browser supporting Web Speech recognition and a microphone for voice input.
- A Rime API key for speech output.
- A Groq API key only for optional broader analysis/knowledge answers.

```bash
git clone https://github.com/Shivaani30/resqvoice-incident-commander.git
cd resqvoice-incident-commander
npm install
```

Copy `.env.example` to root `.env`. In PowerShell:

```powershell
Copy-Item .env.example .env
```

Current `.env.example` contents:

```dotenv
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
RIME_API_KEY=your_rime_api_key
RIME_MODEL_ID=mistv2
RIME_VOICE=astra
RIME_LANGUAGE=eng
RIME_ENDPOINT=https://users.rime.ai/v1/rime-tts
MOCK_TTS=false

LLM_PROVIDER=
LLM_ENDPOINT=
LLM_API_KEY=
LLM_MODEL=
```

To enable the current Groq configuration, replace the blank LLM entries:

```dotenv
LLM_PROVIDER=generic-chat-completions
LLM_ENDPOINT=https://api.groq.com/openai/v1/chat/completions
LLM_API_KEY=your_groq_api_key
LLM_MODEL=openai/gpt-oss-120b
```

Use private keys; never use a `VITE_` variable for server secrets. Restart the backend after `.env` changes. Dotenv resolves the root file in development and compiled execution.

## 6. Running the Application

Backend at `http://localhost:3001`:

```bash
npm run dev --workspace @incidentvoice/server
```

Frontend in a second terminal, at `http://localhost:5173`:

```bash
npm run dev --workspace @incidentvoice/client
```

Or start both through concurrently:

```bash
npm run dev
```

Open Live Voice Incident Room, click **Microphone**, and grant permission. Vite proxies `/api` and `/health` to port 3001. Changing the backend port requires matching proxy configuration; a production frontend host needs equivalent routing.

## 7. Core Voice Lifecycle

- **Microphone** starts recognition directly without waiting for a backend token. Listening activates on the browser start event.
- **Stop Listening** aborts recognition and disables automatic restart; it does not itself cancel an AI response.
- Interim text appears locally; final text submits a command. Typed input and **Send** use the same command path.
- **AI Speaking** pauses recognition before playback. Recognition is recreated afterward if listening is still requested.
- **Interrupt response** stops playback and invalidates response work. Recognition resumes if previously requested; for a typed-only session, click Microphone to begin listening.
- **End Session** stops recognition/playback, aborts local pending work, requests server interruption, and returns to Overview. The in-memory record remains available for summary/PDF export.
- **Reset Workspace** disposes the old controller and creates a fresh session ID without reloading. It isolates the new workspace; it does not delete old server records or guarantee immediate cancellation of all old server work.

Voice states: `Idle`, `Listening`, `Processing`, `AI Speaking`, `Interrupted`, `Error`. Backend availability is reported separately.

## 8. Incident Intelligence and Uncertainty

| Item | Implemented meaning |
| --- | --- |
| Fact | Attributed responder observation, normally status reported, with original text/provenance |
| Hypothesis | Possible explanation, initially unconfirmed; bounded rules recognize deployment/gateway and tentative statements |
| Evidence | Original reports and claim evidence arrays; no independent telemetry verification |
| Contradiction | Conflict such as previous-version failures weakening an existing deployment hypothesis |
| Action | Recognized operational instruction recorded as pending |
| Decision | Recognized commitment such as approving rollback, recorded as recorded |
| Unknown | Unresolved question, including what evidence establishes root cause |
| Risk | Potential consequence such as checkout purchase impact; also exposed as follow-up questions |

Timing does not establish causation. Previous-version failure reports can mark an existing deployment hypothesis disputed; without that hypothesis, the report does not create a conflict. Ambiguous version references can create clarification questions, though intervention policy may keep that update silent.

Checkout impact and database health remain responder-reported. Mitigation decisions and reported recovery do not prove root cause. Deterministic Q&A does not mutate intelligence. LLM recommendations remain answer text and do not automatically become actions. Explicit incident creation, severity/status changes, and simulated notification events are supported; production remediation is not.

## 9. Selective AI Intervention

“Listening and understanding happen continuously. Speaking happens selectively.” This describes the intervention principle while recognition is active; recognition pauses during AI playback.

| Input | Expected current behavior |
| --- | --- |
| “We're seeing checkout failures above forty percent.” | Record report/risk; silent routine update |
| “What do we know so far?” | Deterministic state query; spoken answer |
| “What should we investigate next?” | Optional grounded LLM analysis; spoken answer or availability fallback |
| “Errors are also occurring on the previous version.” | With an existing deployment hypothesis: dispute it, add conflict, and potentially speak |
| “Investigate the payment gateway.” | Record pending action; normally silent |

Speaking reasons implemented in the command path include user requests, contradictions, root-cause safety, ambiguous incident status, status changes/clarification responses, and decision confirmation. Routine updates are low priority, requests/decisions medium, and conflicts/safety/status high. Identical repeated contradiction and root-cause warnings have 20-second and 30-second cooldowns. Other reason names exist in types but are not all emitted by the current path.

## 10. Interruption and Recovery

This is **controlled interruption / barge-in with recovery**, using **Interrupt response**. Recognition is paused during playback; `onspeechstart` does not interrupt audio. Speaking over the AI is not supported acoustic full-duplex.

Local interruption synchronously pauses audio, resets position, removes its source, reloads the element, revokes object URLs, and advances the playback epoch. Client TTS fetches are aborted. Client revisions fence obsolete response output; lifecycle identity isolates end-session/disposed work. Playback checks session/generation/epoch, including delayed `audio.play()` completion.

The server interrupt route cancels TTS, aborts the current generation controller (including command-path LLM work), marks pending tools cancelled, and increments generationId. Replacement commands also invalidate previous generations. TTS checks generations before requesting and after buffering; browser disconnection aborts upstream TTS.

Client command and interrupt POSTs are serialized: a pending command can delay server interruption. Local audio stops immediately, but immediate upstream LLM cancellation is not guaranteed. Obsolete speech is fenced while waiting. The standalone `/api/ai/answer` route lacks a session-generation cancellation signal and is not the live voice path.

Recognition resumes only if requested. A 500 ms post-playback guard drops recognition results; long matches against recent response text are filtered as likely echo. Wait briefly after interruption before speaking. Generated text stays in the transcript even if interrupted or truncated; it does not prove the whole answer was spoken.

## 11. Failure Behavior

### Rime failure

Commands and response text are recorded before synthesis. Missing configuration, HTTP errors, and timeouts produce a Rime error; state and typed interaction remain available. No alternate TTS is used. Server requests have a 25-second timeout; client TTS waits have a 30-second timeout. These are configured limits, not latency measurements.

### LLM/Groq failure

Missing configuration/provider failure returns an explicit inability-to-answer message rather than fabricated analysis. Deterministic observations and state queries remain available. Aborted/stale command-path model output is suppressed. The LLM helper has no independent timeout; the browser command has a 15-second limit, and disconnecting it does not itself abort server LLM work.

### Speech Recognition failure

Unsupported recognition, permission, capture, language, service, and network errors produce messages; typed commands remain available. Most errors stop listening until retry. No-speech permits recovery. Unexpected endings trigger up to three restarts with increasing delays; receiving results resets the counter. Repeated endings require clicking Microphone again.

### Audio playback failure

Autoplay restrictions, decoding, or playback errors produce an audio-permission/retry message. Text/state remain available. Recognition resumes after playback termination if requested.

### Interrupted/stale response

Stale TTS returns HTTP 409 and is ignored; other synthesis failures return 503. Revisions and epochs suppress obsolete audio. Failed backend interruption is reported separately from successful local audio stopping. Cancellation does not undo already-recorded mutations.

## 12. Known Limitations

- Web Speech support/accuracy depend on browser, microphone, accent, noise, and network; no guaranteed offline recognition.
- Recognition pauses during AI speech. Echo filtering is heuristic and may suppress legitimate repeated words. Headphones are recommended. STT capture/echo-cancellation constraints are not configured.
- Rime and optional Groq depend on network/provider availability. TTS sends only the first 500 string units; audio may be shorter than displayed text.
- Deterministic rules and limited LLM safety checks are not universal reasoning or comprehensive factual validation.
- Sessions are in memory; server restart loses records. No durable database or connected-responder conferencing is implemented.
- Notifications are delayed in-memory simulations, not real messages. No connected production telemetry or automatic remediation is implemented.
- Several older verification expectations conflict with current policy. No measured acoustic/provider latency or performance claim is made.

## 13. Verification

Build both workspaces, or individually:

```bash
npm run build
npm run build --workspace @incidentvoice/server
npm run build --workspace @incidentvoice/client
```

Existing checks that passed in this documentation review (2026-09-10):

```bash
node --import tsx scripts/verify-rime-cancellation.mts
node --import tsx scripts/verify-intervention-policy.mts
node --import tsx scripts/verify-request-intent.mts
node --import tsx scripts/verify-action-intent.mts
```

These verify synthetic Rime request/cancellation fences, intervention/contradiction state, request classification, and noisy action-intent/provenance safeguards respectively. They do not make real provider requests.

These existing checks were also run but **failed**:

```bash
node --import tsx scripts/verify-browser-direct.mts
node --import tsx scripts/verify-rime-echo.mts
node --import tsx scripts/verify-live-qa-routing.mts
node --import tsx scripts/verify-groq-qa.mts
node --import tsx scripts/verify-intelligence.mts
node --import tsx scripts/verify-claim-state-consistency.mts
node --import tsx scripts/verify-state-query-improvement.mts
```

The first six expect audio/acknowledgments for now-silent observations or actions. Browser-direct also retains an obsolete recognition-during-playback expectation. State-query rejects the word “confirmed” even in “isn't confirmed.” Later assertions in failing scripts are not verified. Tests/runtime were not changed to hide failures.

Also present, not run: `scripts/verify-browser-direct-pdf.mts` (requires local `client/tmp/pdf-qa` MuPDF dependency) and `scripts/run-stress-test.ts` (requires a running server and inspects notification events). Builds were not run for this documentation-only change.

See [RIME_EVIDENCE.md](RIME_EVIDENCE.md). Automated doubles cannot prove microphone accuracy, actual Rime codec, audible playback, or acoustic latency.

## 14. Project Structure

```text
README.md
RIME_EVIDENCE.md
.env.example
package.json                     workspace commands
server/src/
  index.ts                       Express routes/environment
  engine.ts                      sessions, commands, generations
  intelligence.ts                claims/evidence rules
  qa.ts                          routing, state answers, grounding
  llm.ts                         chat-completions provider
  intervention.ts                selective speaking policy
  tts.ts                         Rime payload/buffering/cancellation
client/
  vite.config.ts                 API proxy
  src/browserVoiceSession.ts     recognition/lifecycle
  src/audioPlaybackManager.ts    playback/epoch fencing
  src/hooks/useLiveSession.tsx    polling/workspace reset
  src/components/VoiceRoom.tsx    controls/transcript
  src/components/IntelligencePanel.tsx
  src/demo/                      simulated incident data
  src/lib/                       model/text/PDF summaries
scripts/                         verification/stress scripts
```

## 15. Security

Keys remain server-side. `.env` is ignored and must never be committed; `.env.example` contains placeholders/empty secret fields only. Never expose a secret through VITE_ variables. Rime receives response text; the LLM receives incident/conversation context. Browser STT may send speech to its managed service.

Express routes have no implemented authentication or per-user session authorization. CORS is not access control; this is a local prototype, not a secured multi-user deployment.

## 16. Demo Mode

Demo Mode contains local simulated/historical sample data and responder dialogue. Displayed responders are not live connected people, and claims are not live external telemetry. Demo playback has no microphone and is not proof of a real Rime request. Use Live mode for evidence testing. PDF summaries include session intelligence, timeline, transcript, risks, and uncertainty.

## 17. Repository

https://github.com/Shivaani30/resqvoice-incident-commander

“From live incident conversation to continuously evolving operational intelligence.”
