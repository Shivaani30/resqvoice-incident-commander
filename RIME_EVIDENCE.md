# Rime Voice Evidence — ResQVoice

## 1. Hard Voice Claim

ResQVoice implements controlled interruption and recovery of Rime-generated speech: **Interrupt response** stops local playback, cancels or fences obsolete response work, and permits replacement input without replaying old audio. Recognition pauses during playback and resumes on interruption if listening was previously requested. This is supported by code inspection; full browser acceptance remains unverified below.

## 2. Why This Matters

New evidence can arrive while the AI speaks. Continuing an obsolete answer can mislead responders after the incident picture changes.

## 3. Acceptance Test

PASS only if all conditions hold in Live mode:

1. A real Rime request succeeds and speech is audible.
2. Clicking **Interrupt response** before completion stops audio.
3. Recognition resumes when previously enabled, and replacement speech or typed input is accepted.
4. New evidence reaches the engine and updates the relevant state.
5. Obsolete TTS/model/tool work is cancelled or generation-fenced; old audio does not resume and obsolete model output is not spoken later.
6. A new state query reflects the latest evidence and preserves unconfirmed root cause.

Local stopping is synchronous. Server interruption is queued behind pending client commands, so immediate upstream LLM cancellation is not required; stale speech must still be fenced. Cancellation does not undo completed mutations.

## 4. Reproduction Procedure

1. Follow [README setup](README.md#5-setup-instructions), configure real Rime credentials, and run `npm run dev`.
2. Use Live mode and a fresh workspace. Open **Live Voice Incident Room**, click **Microphone**, and allow access. Use headphones.
3. Say “We're seeing checkout failures above forty percent.” Wait for the report; this is normally silent.
4. Say “The deployment finished about ten minutes before the spike.” Verify an unconfirmed deployment hypothesis; this is also normally silent.
5. Ask “What do we know so far?” Confirm a successful `/api/tts` response and audible Rime speech.
6. During playback click **Interrupt response**. Wait for listening and the 500 ms post-playback guard, then say “Wait — errors are also occurring on the previous version.” Typed input with **Send** is also supported.
7. Verify playback stopped, the report appears, deployment becomes disputed, and a conflict records that previous-version failures weaken a deployment-only explanation. Root cause must remain unconfirmed.
8. After the new response ends, ask “What do we know so far?” Verify the latest evidence is represented and old audio never resumes.

Speaking over playback alone is not this test: recognition is paused. For typed-only sessions, start Microphone separately if speech is wanted. Transcript text is not proof every generated word was audible.

## 5. Result

Documentation review, 2026-09-10:

- **PASS, automated:** synthetic Rime request shape, client-disconnect abort, explicit cancellation, post-buffer generation fencing, and already-stale rejection (`verify-rime-cancellation.mts`).
- **PASS, automated:** intervention/contradiction state, request classification, and action-intent checks.
- **NOT PASS, full lifecycle suite:** `verify-rime-echo.mts` and `verify-browser-direct.mts` time out waiting for now-suppressed routine-update audio; later interruption assertions were not reached. `verify-groq-qa.mts` fails before its cancellation assertion because it expects a spoken routine update.
- **Manual browser/provider result:** requires real microphone input, Rime bytes, audible playback, and the acceptance procedure. No completed acoustic verification or measured provider/interruption latency is claimed.

## 6. Repeatable Verification

From the root after `npm install`:

```bash
node --import tsx scripts/verify-rime-cancellation.mts
node --import tsx scripts/verify-intervention-policy.mts
node --import tsx scripts/verify-request-intent.mts
node --import tsx scripts/verify-action-intent.mts
npm run build
```

The four scripts cover TTS fences, speaking policy/contradictions, request intent, and action classification respectively. They use synthetic transport or deterministic engine calls, not real provider audio. Build compiles both workspaces; it was not run in this documentation review. [README verification](README.md#13-verification) lists other existing checks and failures.

## 7. Exact Rime Configuration

| Field | Shipped example / inspected configuration |
| --- | --- |
| Model ID | `mistv2` |
| Speaker / Voice | `astra` |
| Language | `eng` |
| Endpoint | `https://users.rime.ai/v1/rime-tts` |
| Audio format | Requested and backend-served `audio/mpeg`; upstream codec/bytes are not validated |
| Sampling rate | Requested `22050` Hz; returned rate not independently checked |
| Transport | Node/Express HTTPS POST; whole response buffered, then browser HTTP response/Blob playback |
| Authentication location | Server-side Bearer RIME_API_KEY |

Exact payload shape from `server/src/tts.ts`:

```json
{"text":"<response text sliced to 500 string units>","modelId":"mistv2","speaker":"astra","lang":"eng","samplingRate":22050}
```

Headers: `Content-Type: application/json`, `Accept: audio/mpeg`, and server-side Bearer authorization. No JSON format field is sent. The backend uses `response.arrayBuffer()` and returns `Content-Type: audio/mpeg`; the browser uses `response.blob()`, an object URL, and `new Audio(url)`. No progressive playback or WebSocket transport is implemented.

Values come from RIME_MODEL_ID, RIME_VOICE, RIME_LANGUAGE, and RIME_ENDPOINT; the helper requires these plus the key. MOCK_TTS=false is the example setting; this flag only changes validation metadata, not synthesis. Configuration validation is not proof of a provider request.

## 8. Limitations

- Web Speech support, microphone accuracy, and browser-managed network STT vary; offline operation is not guaranteed.
- Controlled interruption, not acoustic full-duplex. Echo guards are heuristic; headphones are recommended. The post-playback guard can discard speech started too soon.
- Rime and optional Groq require network access; latency varies. TTS truncates text at 500 string units.
- Generation/playback fences exist, but current full lifecycle scripts do not pass. Automated doubles do not prove audible playback, provider codec, microphone accuracy, or acoustic timing.
