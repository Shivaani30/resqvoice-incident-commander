# ResQVoice command center

## Run
From the project root run `npm run dev`. Open http://localhost:5173/?demo=1 for the complete demo or http://localhost:5173/?demo=0 for the existing live session. The UI mode switch changes the query parameter. Optionally put `VITE_DEMO_MODE=true` in client/.env.local; explicit query parameters override it. No secret belongs in VITE variables.

Demo initially displays the complete scenario for immediate presentation. Run Demo Incident replays nine events at three-second intervals. Pause/Resume retains the current step; Reset Demo returns to the empty scenario. Playback is opt-in, including with reduced motion.

## Architecture and changed files
- Modified src/main.tsx: separate Live and Demo component mounts, mode selection.
- Modified src/style.css: semantic light/dark tokens, responsive grids, reduced motion, state/voice transitions, layered surfaces.
- Modified index.html: ResQVoice document title.
- Created src/hooks/useLiveSession.tsx: extracted existing polling, commands, speech recognition and Rime playback; adds cleanup and error feedback.
- Created src/lib/model.ts: actual client session contract and honest live presentation adapter.
- Created src/demo/demoIncident.ts and useDemo.ts: centralized deterministic snapshots, participants and local playback.
- Created src/components/CommandCenter.tsx: command header, metrics, transcript, timeline, search, focus, voice presentation.
- Created src/components/IntelligencePanel.tsx: reusable panels, claims, evidence details and copy feedback.
- Created src/components/SummaryDownloadButton.tsx and src/lib/summary.ts: current-state Markdown export using Blob downloads.
- Created verify.ts: deterministic scenario, uncertainty, report and existing audio-fence checks.
- Created DEMO_GUIDE.md: this guide.

Server, shared code, AudioPlaybackManager, dependency manifests and backend environment configuration are unchanged. No Git operations were run. No dependencies were added. The server still handles its original command vocabulary and generation-fenced tools; this UI does not add an AI extraction backend.

## Information integrity
Live mode uses real session polling and command endpoints. Facts, hypotheses, questions, decisions and participants are absent from the current backend contract and are never invented. Tool events appear as actions using the original statuses. Demo mode mounts no live-session hook, performs no API requests, and uses no microphone/TTS. Leaving live mode stops recognition/audio and polling; already submitted server commands may finish normally, but cannot start audio after unmount.

Demo INC-2047: checkout payment failures (P1, Investigating), deployment association explicitly unconfirmed, database-timeout contradiction, rollback approval, recovery observation. Recorded demo evidence is illustrative and marked DEMO DATA in the UI and export.

The summary exports full current structured state, evidence, sources, owners, timestamps, chronology and the latest 20 transcript turns. It always preserves unconfirmed root cause. Filename: INC-2047-incident-summary.md (or the live incident ID). Browser download completion means the download was initiated; browsers do not expose whether the user saved the file.

## Validation performed
- Root npm run build: passed (server and client TypeScript plus Vite); required permission to write server/dist outside the client workspace.
- Frontend TypeScript/build: passed.
- node --import tsx verify.ts: passed (requires normal Windows user access).
- Existing backend /health, proxied session API and frontend: HTTP 200.
- No lint script/configuration exists; lint not run.
- No browser automation connection available: rendered layout, actual download interaction, console, microphone and Rime playback need manual verification.

## Manual acceptance steps
1. Start the existing root dev command. Open /?demo=1. Check title, P1, DEMO DATA and all nine transcript entries.
2. Open evidence details and confirm the deployment hypothesis is unconfirmed and database hypothesis disputed.
3. Reset Demo: transcript/intelligence clear while scenario metadata remains. Run Demo: one event appears every three seconds. Pause, wait, resume, then reset while running.
4. In DevTools Network, filter /api: demo mode should make no requests. Switch to Live: session polling should begin. Return to Demo: polling should stop.
5. Search for rollback; verify transcript, claims, actions, decisions and timeline filter locally. Clear search. Use transcript category and timeline type filters.
6. Scroll to older transcript entries during playback; new entries must not pull the scroll down. Select Jump to latest to resume following.
7. Toggle Commander View and Full Workspace. Expand evidence and use copy controls; verify clipboard and feedback.
8. Download Summary at partial playback, then full playback. Open the .md file; check ID, demo marker, owners, timestamps, decisions, evidence, current snapshot and Root cause remains unconfirmed. Partial exports must contain only revealed intelligence.
9. Switch to Live. Submit Create a P1 incident for checkout payment failures. Confirm real incident and transcript updates. Test Change it to P2. No fabricated intelligence/participants should appear.
10. In a browser supporting speech recognition, allow microphone access, use Push to talk, and test Interrupt. Check audio diagnostics and typed fallback when permission is denied.
11. With existing server-side Rime configuration, confirm spoken response and interruption/stale-audio behavior. Without configuration, confirm visible unavailable/error state. Agora is not implemented in this project.
12. Stop the backend temporarily: verify Disconnected/recovery message and automatic recovery when restarted. Test command failures.
13. Check dark/light themes at 1920, 1440, 1280, 1024, 768 and 375 CSS pixels. Verify no page overflow or clipped controls; columns should stack.
14. Enable prefers-reduced-motion: ambient/entry/voice CSS animations stop, playback controls remain usable. Tab through skip link, controls, evidence and transcript; verify focus rings.
15. Check browser console for runtime errors; inspect downloaded file and keyboard interactions in the actual target hackathon browser.

## Existing limitations
The backend is an in-memory deterministic command prototype, not a persistent multiuser incident-intelligence engine. It has no Agora, SSE/WebSocket transport, participant metadata or structured claim extraction. shared/types.ts differs from actual engine responses. The root .env.example comment says Rime is not wired, but server/src/tts.ts does implement it; MOCK_TTS does not bypass its real synthesis path. No backend configuration was changed. Port 5173 was already serving the project during validation, so no second dev server was started. Visual reference URL was unavailable.


## Workspace UX update

The previous card-grid layout and Commander View toggle have been replaced by six shared Live/Demo destinations. Overview is now the commander brief. Navigate directly with these URLs:
- /?demo=1#overview
- /?demo=1#voice
- /?demo=1#intelligence
- /?demo=1#actions
- /?demo=1#timeline
- /?demo=1#summary

CommandCenter.tsx now owns the shell/navigation/theme only. New VoiceRoom.tsx owns voice presentation (the live hook is unchanged). New Workspaces.tsx contains Overview, Intelligence, Actions, Timeline and Summary presentation. IntelligencePanel.tsx now displays divider-based rows through shell styles. Summary generation includes dedicated Incident Details and Participants sections; the preview renders the same generated text as the Markdown download. No HTML from incident content is injected.

Theme buttons explicitly select Light or Dark. Saved preference wins; otherwise the OS preference is applied before the application loads. Storage failures fall back safely. Desktop sidebar navigation becomes an inline expandable menu on tablet/small screens, without overlaying content.

Additional manual checks:
1. Follow each navigation link; the current destination must have an accent edge, bold label, arrow and aria-current=page. Browser Back/Forward should follow hash navigation.
2. Overview must not show the full transcript or microphone. Open Live Voice Room to find the transcript, participants and microphone control bar. Confirm live capture continues to use the existing hook.
3. In Intelligence switch all five sections and select a row; its source, timestamp, status and evidence must update in the detail region.
4. Review the Actions table, Decisions list and Timeline filters.
5. Open Summary, inspect the report, then download it. Confirm the current data and uncertainty match the preview.
6. Choose Light/Dark and reload. Clear only the resq-theme localStorage key, set the OS preference and reload to check first-visit behavior.
7. At 1024px and below, open Navigate to reveal all six destinations; selecting one collapses the menu without covering content. At 375px, tables may scroll within their own region; the page must not scroll horizontally.

Validation: root/server/client build and TypeScript passed; existing deterministic checks passed; verify-workspaces.tsx passes server-rendering assertions for workspace separation, overview without transcript, intelligence detail, actions table, timeline and report content. These are not browser interaction or visual tests. No browser is connected, so screenshots, actual download interaction, theme rendering and hardware audio remain manual acceptance items. No dependencies or Git operations were introduced.

## Selective cards refinement
Overview now has six actionable summary cards plus two grouped knowledge sections. Shortcuts deep-link to the appropriate Intelligence tab (for example #intelligence/Open%20Questions), Actions or Voice Room. The main sidebar remains the primary navigation. Participant groups of 1-6 use compact cards; larger groups remain rows. Intelligence elevates only the selected claim, with a restrained conflict accent. Executive Summary, Incident Details and Current Incident State receive grouped surfaces in the report preview; the downloaded text is unchanged. Cards use semantic theme colors, keyboard focus and reduced-motion support.

Check each Overview shortcut, browser Back/Forward between Intelligence tabs, small/large participant presentation, and responsive card grids (3 columns desktop, 2 medium, 1 small). These presentation changes do not modify live/demo data sources, voice logic, backend APIs or summary accuracy.

## Pre-incident hero
The full-screen entry experience appears only on Live Overview when no incident exists and the first session check has completed (including a backend-unavailable result). Existing active incidents, demo incidents and all other workspaces bypass it. Open /?demo=0#overview with an empty live session to see it. No reset/deletion of live data is performed to force the hero.

Start Incident pre-fills the existing command input and opens Voice Room; it does not submit or create anything. Join Live Room opens that existing shared-session workspace (there is no new authentication or multi-room backend). Run Demo Incident switches to the centralized demo and starts playback; with blocked sessionStorage, demo still opens but automatic playback may need its Run button.

Created EntryHero.tsx, ThemeToggleBar.tsx and components/hero.css. Updated CommandCenter.tsx, main.tsx, style.css and index.html. The shared visible theme toggle retains saved and OS preference behavior. Instrument Serif is hero-only; Manrope supplies UI labels/navigation, Cabin controls, and Inter body content. Google Fonts uses display=swap with system/Georgia fallbacks.

The supplied remote MP4 is decorative, muted, looping, inline and metadata-preloaded. It exists only while the hero is mounted. A gradient is always behind it; network/media failure leaves content usable. A Pause/Play background control is provided. Reduced motion omits the video and removes parallax, tilt and entrance movement. The video URL returned HTTP 200, video/mp4, approximately 28 MB; actual streaming/autoplay depends on the browser/network.

The abstract product visual is explicitly labeled NOT LIVE DATA. Its CSS depth and requestAnimationFrame pointer tilt are desktop-only (maximum 1.5/2 degrees). No fake incident values or charts are introduced. Light mode uses localized near-white backing and light navigation; dark mode uses restrained purple glass over the existing deep background. No full-screen dark overlay is applied.

Manual hero acceptance:
1. With no live incident, open /?demo=0#overview. Confirm the hero. With an existing incident, confirm the operational Overview appears instead.
2. Start Incident: Voice Room opens with an editable create-command prefix. Finish the incident title and submit. Return to Overview: hero must be absent.
3. Open each direct operational hash while there is no incident: no hero should appear.
4. Run Demo Incident: local playback starts in operational Overview; confirm no hero video remains mounted.
5. Switch Light/Dark, reload, test OS preference with no saved key. Block fonts/video to confirm fallbacks.
6. Test Pause/Play background and reduced motion. Confirm reduced motion causes no video element and no pointer tilt.
7. At 375, 768, 1024, 1440 and 1920px check headline wrapping, CTA stacking, video cover and no page overflow. Mobile menu opens inline and Escape closes it and returns focus.
8. Actual browser visuals, video playback and hardware audio remain manual: no connected browser is available in this session. Build/TypeScript validation passed; server and voice transport logic are unchanged.
