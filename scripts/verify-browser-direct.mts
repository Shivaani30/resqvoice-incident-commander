import assert from 'node:assert/strict';
import { BrowserVoiceSession, type BrowserRecognition } from '../client/src/browserVoiceSession.ts';
import { AudioPlaybackManager } from '../client/src/audioPlaybackManager.ts';
import { command, getSession, interrupt } from '../server/src/engine.ts';
import { liveIntelligence } from '../client/src/lib/model.ts';
import { generateSummary } from '../client/src/lib/summary.ts';

const waitFor = async (check: () => boolean) => { for (let i = 0; i < 200; i++) { if (check()) return; await new Promise(r => setTimeout(r, 5)); } assert.fail('Timed out waiting for test state'); };
class Recognition implements BrowserRecognition {
  static instances: Recognition[] = [];
  continuous = false; interimResults = false; lang = ''; starts = 0; aborted = false;
  onstart: BrowserRecognition['onstart'] = null; onend: BrowserRecognition['onend'] = null;
  onspeechstart: BrowserRecognition['onspeechstart'] = null; onerror: BrowserRecognition['onerror'] = null;
  onresult: BrowserRecognition['onresult'] = null;
  results: { isFinal: boolean; 0: { transcript: string } }[] = [];
  constructor() { Recognition.instances.push(this); }
  start() { this.starts++; this.results = []; this.onstart?.(); }
  abort() { this.aborted = true; this.onend?.(); }
  final(text: string) { const resultIndex = this.results.length; this.results.push({ isFinal: true, 0: { transcript: text } }); this.onresult?.({ resultIndex, results: this.results }); }
  interim(text: string) { this.onresult?.({ resultIndex: this.results.length, results: [...this.results, { isFinal: false, 0: { transcript: text } }] }); }
}
class AudioElement {
  static instances: AudioElement[] = [];
  static deferred = false;
  resolve: (() => void) | null = null;
  paused = false; currentTime = 9; src: string;
  onplaying: (() => void) | null = null; onended: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(src: string) { this.src = src; AudioElement.instances.push(this); }
  async play() { if (AudioElement.deferred) await new Promise<void>(resolve => { this.resolve = resolve; }); this.onplaying?.(); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() {}
}
Object.assign(globalThis, { SpeechRecognition: Recognition, Audio: AudioElement });
const ttsRequests: { signal: AbortSignal; text: string }[] = [];
let holdTts = false;
let releaseTts: (() => void) | undefined;
globalThis.fetch = (async (input: string | URL | Request, options?: RequestInit) => {
  const url = String(input), body = JSON.parse(String(options?.body ?? '{}'));
  if (url === '/api/commands') return Response.json(await command(body.sessionId, body.turnId, body.command, 10));
  if (url.endsWith('/interrupt')) return Response.json(interrupt(url.split('/')[3]));
  if (url === '/api/tts') {
    ttsRequests.push({ signal: options!.signal as AbortSignal, text: body.text });
    if (holdTts) { holdTts = false; await new Promise<void>(resolve => { releaseTts = resolve; }); }
    // Deliberately ignore AbortSignal to prove late-result fencing independently of abort support.
    return new Response(new Blob(['synthetic test audio'], { type: 'audio/mpeg' }));
  }
  throw Error('Unexpected route in browser-direct test');
}) as typeof fetch;

const states: string[] = [], messages: string[] = [];
let listening = false, partial = '';
const sessionId = 'browser-direct-regression';
const controller = new BrowserVoiceSession(sessionId, { state: s => states.push(s), listening: s => { listening = s; },
  partial: s => { partial = s; }, message: s => messages.push(s), session: () => {}, metrics: () => {} });
await controller.startListening();
const recognition = Recognition.instances.at(-1)!;
assert.equal(recognition.continuous, true); assert.equal(recognition.interimResults, true); assert.equal(listening, true);
assert.equal(ttsRequests.length, 0);
recognition.interim("We're seeing checkout failures above forty percent."); assert.match(partial, /forty/);
const utterances = ["We're seeing checkout failures above forty percent.", 'The deployment finished about ten minutes before the spike.', 'Database CPU and connection counts look normal.'];
for (const [index, text] of utterances.entries()) {
  recognition.final(text);
  await waitFor(() => AudioElement.instances.length >= index + 1);
}
assert.equal(listening, true, 'STT stays active during Rime playback');
assert.equal(states.at(-1), 'AI Speaking');
assert.match(ttsRequests.at(-1)!.text, /deployment remains an active hypothesis/);
assert.equal(getSession(sessionId).intelligence.hypotheses.find(h => h.id === 'deployment')?.status, 'unconfirmed');
const oldAudio = AudioElement.instances.at(-1)!;
recognition.onspeechstart?.();
assert.equal(oldAudio.paused, true, 'Audio pauses synchronously on speech onset');
assert.equal(oldAudio.currentTime, 0); assert.equal(oldAudio.src, ''); assert.equal(listening, true);
recognition.final('Wait - errors are also occurring on the previous version.');
await waitFor(() => ttsRequests.at(-1)?.text.includes('New evidence weakens') ?? false);
await waitFor(() => states.at(-1) === 'AI Speaking');
const snapshot = structuredClone(getSession(sessionId));
assert.equal(snapshot.intelligence.hypotheses.find(h => h.id === 'deployment')?.status, 'disputed');
assert.equal(snapshot.intelligence.conflicts.length, 1);
assert.ok(snapshot.intelligence.facts.some(f => f.text.includes('forty percent')));
assert.ok(snapshot.intelligence.facts.every(f => f.status === 'reported'));
assert.equal(snapshot.turns.filter(t => t.role === 'commander').length, 4);
assert.match(generateSummary(snapshot, liveIntelligence(snapshot), false), /Root cause remains unconfirmed/);
console.log('PASS: interim/final STT -> deterministic intelligence -> Rime, continuous recognition, exact contradictory-evidence scenario');

holdTts = true;
const pending = controller.submit('Check the latest customer impact.');
await waitFor(() => Boolean(releaseTts));
const pendingRequest = ttsRequests.at(-1)!;
const audioCount = AudioElement.instances.length;
await controller.interrupt(); assert.equal(pendingRequest.signal.aborted, true);
releaseTts!(); releaseTts = undefined; await pending;
assert.equal(AudioElement.instances.length, audioCount, 'Late old TTS must never create an Audio element');
assert.equal(listening, true);
console.log('PASS: pending request aborted and late response fenced even when transport ignores abort');

AudioElement.deferred = true;
const manager = new AudioPlaybackManager(); manager.startGeneration('same-session', 1);
const pendingPlay = manager.play(new Blob(['test']), 'same-session', 1);
const delayedAudio = AudioElement.instances.at(-1)!; manager.interrupt(); delayedAudio.resolve!();
assert.equal(await pendingPlay, false); assert.equal(delayedAudio.paused, true);
assert.equal(await manager.play(new Blob(['test']), 'same-session', 1), false, 'Interrupted generation cannot restart');
manager.startGeneration('fresh-workspace', 1);
AudioElement.deferred = false;
assert.equal(await manager.play(new Blob(['new']), 'fresh-workspace', 1), true, 'New workspace can start at generation 1');
manager.interrupt();
console.log('PASS: unresolved play promise fenced; interrupted generation never resumes; workspace generation resets safely');

recognition.onend?.();
await waitFor(() => recognition.starts === 2);
controller.stopListening();
const starts = recognition.starts;
await new Promise(r => setTimeout(r, 400)); assert.equal(recognition.starts, starts); assert.equal(listening, false);
await controller.startListening();
await controller.endSession(); assert.equal(listening, false); assert.equal(states.at(-1), 'Idle');
controller.dispose();
console.log('PASS: bounded recognition restart, Stop Listening, End Session');

const unavailableStates: string[] = [];
delete (globalThis as any).SpeechRecognition;
const unavailable = new BrowserVoiceSession('unsupported', { state: s => unavailableStates.push(s), listening: () => {}, partial: () => {}, message: s => messages.push(s), session: () => {}, metrics: () => {} });
await unavailable.startListening(); assert.equal(unavailableStates.at(-1), 'Error'); assert.match(messages.at(-1)!, /unavailable/);
Object.assign(globalThis, { webkitSpeechRecognition: Recognition });
await unavailable.startListening();
Recognition.instances.at(-1)!.onerror?.({ error: 'not-allowed' });
assert.match(messages.at(-1)!, /permission denied/); unavailable.dispose();
console.log('PASS: unsupported browser, prefixed Web Speech API, permission error');

const conservative = await command('uncertainty-negative', 'negative', 'The deployment caused the outage.');
assert.equal(conservative.session.intelligence.hypotheses[0]?.status, 'unconfirmed');
assert.match(conservative.session.intelligence.snapshot, /unconfirmed/);
const original = await command('legacy', 'one', 'Create a P1 incident for database latency and notify backend.', 100);
await command('legacy', 'two', 'Change it to P2 and notify only payments.', 5);
await new Promise(r => setTimeout(r, 130));
assert.equal(original.session.incident?.severity, 'P2'); assert.equal(original.session.incident?.team, 'payments');
assert.ok(original.session.events.some(e => e.status === 'stale-discarded'));
console.log('PASS: uncertainty preserved and existing incident-command/intervention behavior retained');

let oldUpdates = 0;
const callbacks = { state: () => {}, listening: () => {}, partial: () => {}, message: () => {}, session: () => { oldUpdates++; }, metrics: () => {} };
const oldWorkspace = new BrowserVoiceSession('reset-old', callbacks);
await oldWorkspace.startListening();
const oldRecognizer = Recognition.instances.at(-1)!;
holdTts = true;
const oldWork = oldWorkspace.submit('Record the old workspace observation.');
await waitFor(() => Boolean(releaseTts));
const oldRequest = ttsRequests.at(-1)!;
oldWorkspace.dispose(); assert.equal(oldRecognizer.aborted, true); assert.equal(oldRequest.signal.aborted, true);
const updatesAtReset = oldUpdates, audioAtReset = AudioElement.instances.length;
const freshWorkspace = new BrowserVoiceSession('reset-new', { ...callbacks, session: () => {} });
assert.equal(getSession('reset-new').turns.length, 0);
await freshWorkspace.submit('Record the new workspace observation.');
releaseTts!(); releaseTts = undefined; await oldWork;
assert.equal(AudioElement.instances.length, audioAtReset + 1); assert.equal(oldUpdates, updatesAtReset);
freshWorkspace.dispose();
console.log('PASS: Reset Workspace aborts capture/request, clears session identity, ignores late old callbacks, and permits new audio');
