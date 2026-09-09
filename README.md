# IncidentVoice Commander / ResQVoice

ResQVoice is a browser-direct voice incident workspace. The current UI, Demo Mode, deterministic incident commands, intelligence panels, interruption controls, and PDF export are retained.

## Actual architecture

```text
Browser microphone
  -> Browser Web Speech API (SpeechRecognition / webkitSpeechRecognition)
  -> Interim and final transcript
  -> Deterministic incident engine and evidence rules
  -> Facts, hypotheses, evidence, contradictions, unknowns, actions, decisions, risks
  -> Deterministic spoken intervention
  -> Server-side Rime TTS
  -> Browser audio playback
```

Rime is the primary spoken AI output. No LLM, browser speechSynthesis output, or external realtime room provider is used. The old LiveKit integration has been removed.

## Run

1. Install dependencies with `npm install`.
2. Create a root `.env` from `.env.example` and privately configure `RIME_API_KEY`.
3. Run `npm run dev`. Open `http://localhost:5173` in a browser supporting Web Speech recognition.
4. Open Live Voice Room, click Microphone, and allow microphone access. No room connection is required.

Server configuration:

```dotenv
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
RIME_API_KEY=<your private key>
RIME_MODEL_ID=mistv2
RIME_VOICE=astra
RIME_LANGUAGE=eng
RIME_ENDPOINT=https://users.rime.ai/v1/rime-tts
MOCK_TTS=false
```

Never put the key in a VITE_ variable. Restart the backend after changing `.env`. The dotenv path resolves to the project root in both development and the compiled server. Vite proxies `/api` and `/health` to port 3001; a production frontend host must provide equivalent routing.

`GET /health` reports `rimeConfigured`, `speechRecognition: "browser"`, `incidentEngine: "deterministic"`, and `voiceTransport: "browser-direct"`. Configured means required values are present, not that a paid-provider request has succeeded. `/api/rime/validate` provides configuration status; `/api/tts` generates real Rime audio. Demo Mode is local historical data, not a live audio test. Keep MOCK_TTS=false for real Rime output; no substitute speech provider is implemented.

## Controls and lifecycle

- Microphone starts continuous/interim recognition directly and shows Listening after the browser's start event.
- Stop Listening stops recognition without pretending to mute a published track.
- Interrupt response synchronously pauses/reset/releases audio, aborts pending TTS, and invalidates the server generation. Recognition stays active.
- End Session stops recognition and playback, cancels pending work, and returns to Overview. The incident record remains available for its PDF summary.
- Reset Workspace disposes the old voice controller, fences its results, and creates a fresh isolated incident session without reloading the page.
- Typed commands remain available when browser recognition is unsupported or fails.

Voice states are Idle, Listening, Processing, AI Speaking, Interrupted, and Error. Backend API availability is reported separately.

## Intelligence and uncertainty

The original create/severity/notification engine remains in place. Bounded deterministic observation rules now populate the live intelligence panels, which previously only had rich data in Demo Mode. Checkout impact and database health are attributed responder reports, not independently verified measurements. Deployment timing creates an unconfirmed hypothesis; failures on the previous version dispute a deployment-only explanation. Timing never confirms causation. Explicit decision/action/risk statements are recorded; other statements remain attributed reports, questions, or unconfirmed hypotheses. These are language rules, not general-purpose reasoning.

Risks appear as follow-up questions in the existing interface and have their own PDF section. The PDF renders current session intelligence, timeline, and transcript, preserving unconfirmed root cause. Notification actions remain the existing in-memory simulation; this project does not send real team messages.

## Interruption and browser limitations

Recognition remains enabled during Rime playback. A browser `speechstart` event, or non-echo interim/final text, immediately stops local audio before any network round trip. Serialized incident mutations, client revisions, workspace lifecycle identity, server generationId, AbortController, and playback epochs prevent old responses from resuming. Exact long matches against recently spoken Rime text are suppressed as likely echo.

Use headphones for the demo. Browser echo can still trigger speechstart before text exists, interrupting the AI's own output; text matching cannot reliably distinguish all echoes from a person. This implementation does not claim measured acoustic full duplex. SpeechRecognition's portable no-argument start() uses the browser's own microphone capture; it does not expose echoCancellation/noiseSuppression/autoGainControl constraints. Opening a separate getUserMedia stream would not guarantee those constraints apply to STT, so no unused parallel capture is opened.

Web Speech support is limited and may depend on the browser's network recognition service. It is not guaranteed offline/on-device. Use localhost or HTTPS. Recognition can end automatically; the app performs bounded restarts and reports permission, capture, service, and network errors. Speaker playback may be blocked by autoplay rules and is reported as an audio error. See [Web Speech start](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start) and [recognition errors](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error).

## Verification

```bash
npm run build --workspace @incidentvoice/server
npm run build --workspace @incidentvoice/client
node --import tsx scripts/verify-browser-direct.mts
node --import tsx scripts/verify-rime-cancellation.mts
```

See `BROWSER_DIRECT_VERIFICATION.md` for measured results and remaining manual checks. Automated speech/audio doubles test control flow; they do not prove microphone accuracy, acoustic barge-in latency, or audible playback on your hardware.
