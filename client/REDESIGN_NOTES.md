# ResQVoice purple UI and PDF redesign

## Architecture preserved
React/Vite/TypeScript mounts Live and Demo separately in src/main.tsx. CommandCenter owns six hash destinations (Overview, Live Voice Room, Intelligence, Actions, Timeline, Summary) and the no-incident hero gate. useLiveSession owns polling, commands, browser speech recognition and Rime playback. AudioPlaybackManager fences stale audio. The Express backend owns commands, session state and server-side Rime TTS. Shared types exist but differ from the engine's actual contract. No backend, voice hook, playback manager or demo fixture was modified.

There is no Agora, authentication, SSE or WebSocket implementation in this version. Live structured claims/participants remain honest empty states where the API supplies no data. Existing tool events remain actions. Demo snapshots remain local and deterministic.

## Backup and manual restore
Backup: client/ui-backup-before-orbit-redesign/ (outside active src).
Original files copied before editing:
- client/src/main.tsx
- client/src/lib/summary.ts
- client/src/components/SummaryDownloadButton.tsx
- client/src/components/Workspaces.tsx
- client/package.json
- client/verify-workspaces.tsx
- package-lock.json at project root

The backup preserves those relative paths. It excludes secrets, environments, node_modules, dist and Git data. RESTORE_INSTRUCTIONS.md explains how to stop the app, copy originals back, remove only the newly introduced files manually, and reinstall from the restored manifests. Do not copy the backup itself into src. No automated restore or Git command was run.

## Files created
- src/orbit-theme.css: centralized semantic purple palette and presentation refinements.
- src/lib/pdfSummary.ts: lazy PDF rendering, local font loading, pagination and filename sanitization.
- public/fonts/ResQVoiceReport.ttf and OFL.txt: open-license Noto Sans font embedded in reports.
- verify-pdf.ts: demo/live/long-record PDF regression checks.
- REDESIGN_NOTES.md: this document.
- output/pdf/: generated validation samples.
- tmp/pdf-qa/: standalone MuPDF tooling used only to inspect test PDFs; not an application dependency.
- tmp/pdfs/: rendered QA pages.

Modified files are exactly the backed-up files above. Existing src/style.css and hero.css remain unchanged; the new theme is imported after them for easy rollback.

## Design
The interface retains its original ResQVoice layout and assets. The Orbit reference could not be fetched; the design follows the user's described visual principles without copying assets or layout.

Core tokens: --brand-primary #7b39fc, --brand-secondary #2b2344, plus semantic background/surface/border/text/status/glow/shadow tokens. Existing variable names alias those tokens. Dark surfaces use graphite and purple-black; light surfaces use warm off-white with dark-purple headings. Status colors are semantic exceptions. Small text uses a brighter/darker accessible purple variant rather than forcing the primary CTA color everywhere.

The existing Light/Dark bar, localStorage persistence and first-visit OS preference remain unchanged. The new tokens apply across hero, navigation, participants, transcript, actions, intelligence, report preview and errors. PDFs always use light print styling regardless of UI theme.

Spatial effects: active navigation elevation, 3px shortcut hover lift with a 0.7-degree tilt, layered incident-state surface, selected-claim emphasis and microphone waveform glow driven by existing listening state. No participant speaking state is invented. Control transitions are 180-240ms; workspace transitions are 320ms. The ambient grid changes only opacity/transform slowly. Reduced motion disables movement and transitions.

Cards remain selective: Overview shortcuts, paired knowledge groups, small participant groups, selected intelligence detail and report highlights. Transcript, full actions and timeline remain continuous streams/tables/lists. Navigation and deep links retain their behavior.

## PDF architecture
Download PDF produces an actual application/pdf Blob using jsPDF, not browser print or Markdown download. jsPDF is the only new runtime library explicitly added. Its dependency tree includes optional HTML-rendering packages; this implementation draws PDF text directly and does not invoke HTML screenshot conversion. The PDF module is loaded only after download is requested. The local Noto Sans font is fetched and cached then embedded/subsetted.

The Summary preview and PDF use the same generateSummary content. On click, content and incident ID are captured before asynchronous loading so playback/polling cannot mix snapshots. Generated reports include metadata, start/duration when available, current state, facts, hypotheses, questions, actions/owners/status/priority/timestamps, decisions, evidence, contradictions, timeline, participants, root-cause/resolution status and generation time. No inference changes hypotheses into facts. Root cause remains unconfirmed.

Filename: <sanitized-incident-id>-ResQVoice-Incident-Summary.pdf, for example INC-2047-ResQVoice-Incident-Summary.pdf. Unsupported filename punctuation is replaced and length bounded. Missing ID uses incident.

PDFs have purple section headings, dark-purple text, white pages, shaded metadata rows, wrapping, page numbers and generation time in footers. States: Download PDF / Generating PDF... / PDF Downloaded / PDF Generation Failed. Failure displays recovery text; retry is enabled. Downloaded means the browser download was initiated, not confirmation that the user saved it.

## Validation completed
- npm run build --workspace @incidentvoice/client: passed (TypeScript + Vite).
- Root npm run build: passed (server TypeScript and client build).
- verify.ts: passed demo progression/reset, report uncertainty, live isolation and stale audio fence.
- verify-workspaces.tsx: passed separate Voice Room, Overview without transcript, intelligence detail, action table, timeline and PDF-preview controls.
- verify-pdf.ts: passed real PDF signature, required text, duration, demo labeling, empty-live isolation, Unicode Latin names, filename sanitization and ten-page long-record pagination.
- Full demo PDF: 5 pages. Empty live PDF: 2 pages. Long-record PDF: 10 pages.
- Rendered demo and empty-live pages reviewed; long-record first/last pages inspected. Fixed an orphaned section heading. No clipping observed on inspected pages.
- No lint script/configuration exists; no invented lint command was run.
- No browser/app is connected to the automation tool, so web UI visuals and interactions were not certified.

## Manual acceptance checklist
1. Open /?demo=0#overview with an empty live session: inspect hero, video fallback, Light/Dark and reduced motion. Active incident Overview must bypass the hero.
2. Use Start Incident to open Voice Room and complete the existing command. Inspect real polling and incident updates; do not expect new AI extraction capabilities.
3. Open /?demo=1#overview. Check purple summary cards, paired knowledge groups, current-state hierarchy and all shortcut destinations.
4. Run, pause, resume and reset the demo. Network tools should show no live API requests while demo is mounted.
5. Visit #voice: microphone, typed input, Interrupt, Rime status, transcript filters, intelligent scrolling and participant presentation. Test microphone permission denial and configured Rime playback. Agora is not present.
6. Visit #intelligence: all five tabs, selected detail, evidence/source/status, questions and contradictions. Check hypotheses remain unconfirmed/disputed.
7. Visit #actions: search, owner/priority/status columns and decisions/follow-up. Visit #timeline: chronological events and type/search filters.
8. Visit #summary: preview the complete state, click Download PDF, open the .pdf and check filename, snapshot, evidence, decision owners, timestamps, uncertainty and demo marker. Repeat midway through demo playback and in Live Mode.
9. Block the local report font request to test a visible PDF failure, then unblock and retry. Confirm no Markdown/TXT file is downloaded.
10. Toggle Light/Dark on all destinations; reload to confirm persistence and clear only resq-theme to check OS default.
11. Check widths 1920, 1440, 1280, 1024, 768 and 375px: no page overflow, readable cards/table, visible microphone, usable PDF button, and inline mobile navigation. Tables may scroll inside their own region.
12. Navigate with keyboard, verify focus, tab filters and disabled/loading PDF state. Enable reduced motion; decorative movement must stop.
13. Simulate backend unavailability and restore it. Confirm connection/error states remain visible and polling recovers. Inspect console for runtime errors.

## Limits
Browser visual/interaction checks, real microphone/Rime playback and actual browser save behavior still require manual testing. The bundled report font supports the current English scenario and many Unicode names, but it is not a universal CJK/complex-script font. Remote hero video and Google UI fonts retain their prior network dependence/fallbacks. The demo snapshot already contains a literal question-mark separator between its 43% and 12% values; it was preserved rather than silently rewriting source data during this presentation change. Server persistence/classification limitations remain unchanged.
