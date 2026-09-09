# ResQVoice browser-direct + Rime demo

## Preparation

Run npm run dev. Confirm /health says voiceTransport=browser-direct and rimeConfigured=true. Use a Web Speech-capable browser on localhost or HTTPS, set MOCK_TTS=false, and use headphones. Open Live Voice Room and click Microphone. Allow microphone permission. Listening should appear with no realtime-room connection stage.

## Live scenario

1. Say: "We're seeing checkout failures above forty percent."
   - Interim and final transcript appear. The impact is recorded as an attributed responder report. A checkout incident record and live intelligence appear; severity is not invented.
2. Say: "The deployment finished about ten minutes before the spike."
   - Timing is recorded as evidence. Deployment becomes an unconfirmed hypothesis, not an established root cause.
3. Say: "Database CPU and connection counts look normal."
   - Database evidence updates. Rime says: "The deployment remains an active hypothesis. Current evidence does not confirm it as the root cause."
4. While Rime is speaking, say: "Wait - errors are also occurring on the previous version."
   - Current audio stops locally. Pending requests are cancelled/fenced. Recognition remains active. The new transcript adds contradictory evidence and marks the deployment hypothesis disputed.
   - Rime says: "New evidence weakens the deployment hypothesis. Root cause remains unconfirmed."
5. Inspect facts, hypotheses, evidence, contradictions, open questions, timeline, and summary. Download PDF and verify current contradiction and unconfirmed root cause.
6. Demonstrate Interrupt response, Stop Listening, End Session, and Reset Workspace. Reset should clear the workspace and stop old audio without reloading.

The phrase matcher is deterministic; other wording is recorded conservatively and is not guaranteed to trigger the same rule. Typed commands can demonstrate the same incident-state transitions when browser recognition is unavailable, but must not be presented as a microphone test.

## Historical Demo Mode

Switch to Demo Mode to run the existing checkout scenario. Speakers are marked SIMULATED / DEMO MODE and Historical dialogue. They are not connected participants. The historical demo is separate from the live microphone/Rime scenario above.

## Honest presentation

Only claim successful microphone capture, audible Rime playback, and acoustic barge-in after testing on the presentation device. Automated event/Audio doubles validate cancellation and stale-result logic, not real-world full duplex. Browser speaker echo may stop the AI's own audio; headphones reduce this risk. Backend notification actions remain simulated in-memory operations.
