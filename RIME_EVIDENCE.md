# Rime evidence

## Primary spoken output

Browser microphone -> Browser Web Speech API -> live transcript -> deterministic ResQVoice incident engine -> evidence-aware intervention -> server-side Rime TTS -> browser AudioPlaybackManager.

No LLM or external realtime room provider is used. Rime remains the primary spoken output, with no browser speechSynthesis fallback. Demo Mode uses explicitly simulated historical dialogue and is not evidence of a live Rime call.

## Configuration

Only the server reads RIME_API_KEY. Use RIME_MODEL_ID=mistv2, RIME_VOICE=astra, RIME_LANGUAGE=eng, RIME_ENDPOINT=https://users.rime.ai/v1/rime-tts, MOCK_TTS=false. GET /api/rime/validate checks presence; successful synthesis must be verified separately.

## Interruption and recovery

SpeechRecognition stays active while Rime speaks. Speech onset or recognized non-echo text synchronously pauses current audio, resets currentTime, removes its source, releases its object URL, and invalidates the playback epoch. Pending client TTS requests are aborted. Server cancellation is triggered by command replacement, explicit interruption, or the TTS response connection closing. The upstream Rime request uses an AbortController and a timeout. Aborted/old generations cannot send playable audio.

Client revisions guard delayed command/TTS responses; lifecycle identity guards End Session and Reset Workspace. AudioPlaybackManager also guards delayed audio.play() completion, including interruption before the server acknowledges the next generation. Server generationId and turnId remain in the incident flow. Recognition does not stop when the user presses Interrupt response.

## Evidence procedure

1. Run the four utterances in DEMO_SCRIPT.md in Live mode with headphones.
2. Confirm a real POST /api/tts succeeds and browser audio is audible.
3. While Rime speaks, say the previous-version contradiction.
4. Verify audio stops, the transcript updates, deployment becomes disputed, and the next Rime response retains unconfirmed root cause.
5. Repeat with End Session and Reset Workspace during a pending response; old audio must not resume.

The regression tests exercise these state and cancellation boundaries with synthetic speech/audio and a fake Rime transport. Real-provider API results and browser checks are recorded separately in BROWSER_DIRECT_VERIFICATION.md. Local audio-stop metrics measure the code's stop operation, not speech-detection or acoustic output latency. Full-duplex acoustic performance has not been measured in this environment.

## Limitations

Browser STT may use a browser-vendor network service and is not universally supported. Continuous recognition may end and need bounded restart. The portable SpeechRecognition API does not accept capture constraints; no claim is made that a separate getUserMedia stream controls its echo cancellation. Exact long response-text matches are filtered as likely echo, but speaker feedback can still interrupt playback before text recognition. Use headphones. An interrupted response stays in the transcript as generated text; it should not be interpreted as having been fully spoken.
