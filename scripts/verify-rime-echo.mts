import assert from 'node:assert/strict';
import { BrowserVoiceSession, type BrowserRecognition } from '../client/src/browserVoiceSession.ts';
import { command, getSession, interrupt } from '../server/src/engine.ts';

class FakeRecognition implements BrowserRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false; interimResults = false; lang = '';
  onstart: BrowserRecognition['onstart'] = null; onend: BrowserRecognition['onend'] = null; onspeechstart: BrowserRecognition['onspeechstart'] = null;
  onresult: BrowserRecognition['onresult'] = null; onerror: BrowserRecognition['onerror'] = null;
  starts = 0; aborted = false; results: Array<{ isFinal: boolean; 0: { transcript: string } }> = [];
  constructor() { FakeRecognition.instances.push(this); }
  start() { this.starts++; this.results = []; this.onstart?.(); }
  abort() { this.aborted = true; this.onend?.(); }
  final(transcript: string) { const resultIndex = this.results.length; this.results.push({ isFinal: true, 0: { transcript } }); this.onresult?.({ resultIndex, results: this.results }); }
  interim(transcript: string) { this.onresult?.({ resultIndex: this.results.length, results: [...this.results, { isFinal: false, 0: { transcript } }] }); }
}
class FakeAudio {
  static instances: FakeAudio[] = [];
  paused = false; currentTime = 12; src: string;
  onplaying: (() => void) | null = null; onended: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(src: string) { this.src = src; FakeAudio.instances.push(this); }
  async play() { this.onplaying?.(); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() {}
  finish() { this.onended?.(); }
}
Object.assign(globalThis, { SpeechRecognition: FakeRecognition, URL: { createObjectURL: () => `blob:${FakeAudio.instances.length}`, revokeObjectURL: () => {} }, Audio: FakeAudio });

const requests: Array<{ text: string; signal: AbortSignal }> = [];
globalThis.fetch = (async (input: string | URL, options?: RequestInit) => {
  const url = String(input), body = JSON.parse(String(options?.body ?? '{}'));
  if (url === '/api/commands') return Response.json(await command(body.sessionId, body.turnId, body.command));
  if (url.includes('/api/sessions/') && url.endsWith('/interrupt')) return Response.json(interrupt(url.split('/')[3]));
  if (url === '/api/tts') {
    requests.push({ text: body.text, signal: options?.signal as AbortSignal });
    return new Response(new Blob(['rime-audio'], { type: 'audio/mpeg' }));
  }
  throw new Error(`Unexpected URL ${url}`);
}) as typeof fetch;
const wait = () => new Promise(resolve => setTimeout(resolve, 0));
const waitFor = async (predicate: () => boolean) => { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); } assert.fail('Timed out waiting for voice state'); };

const states: string[] = [], messages: string[] = [], sessionId = 'rime-echo-regression';
const voice = new BrowserVoiceSession(sessionId, { state: state => states.push(state), listening: () => {}, partial: () => {}, message: message => messages.push(message), session: () => {}, metrics: () => {} });
await voice.startListening();
let recognition = FakeRecognition.instances.at(-1)!;
assert.equal(recognition.continuous, true); assert.equal(recognition.interimResults, true);
const oldResultHandler = recognition.onresult!;
recognition.final('The deployment finished about ten minutes before the spike.');
await waitFor(() => requests.length === 1 && FakeAudio.instances.length === 1);
const firstAudio = FakeAudio.instances[0];
assert.equal(recognition.aborted, true, 'recognition is stopped before Rime playback');
assert.equal(states.at(-1), 'AI Speaking');
const commanderTurnsBeforeEcho = getSession(sessionId).turns.filter(turn => turn.role === 'commander').length;
oldResultHandler({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: requests[0].text } }] });
assert.equal(getSession(sessionId).turns.filter(turn => turn.role === 'commander').length, commanderTurnsBeforeEcho, 'late Rime result is discarded by aiSpeaking guard');
firstAudio.finish(); await waitFor(() => FakeRecognition.instances.length === 2);
recognition = FakeRecognition.instances.at(-1)!; assert.equal(states.at(-1), 'Listening');
const delayedHandler = recognition.onresult!;
delayedHandler({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: requests[0].text } }] });
assert.equal(getSession(sessionId).turns.filter(turn => turn.role === 'commander').length, commanderTurnsBeforeEcho, 'post-playback guard discards delayed echo');
await new Promise(resolve => setTimeout(resolve, 520));

recognition.final('Wait, on the previous version.');
await waitFor(() => requests.length === 2 && FakeAudio.instances.length === 2);
const clarificationAudio = FakeAudio.instances[1];
assert.match(requests[1].text, /Are you reporting that the failures also occur/);
assert.equal(getSession(sessionId).turns.filter(turn => turn.role === 'commander').length, 2);
clarificationAudio.finish(); await waitFor(() => FakeRecognition.instances.length === 3);
recognition = FakeRecognition.instances.at(-1)!;
await new Promise(resolve => setTimeout(resolve, 520));
recognition.final('Yes, errors are happening there too.');
await waitFor(() => requests.length === 3 && FakeAudio.instances.length === 3);
assert.equal(getSession(sessionId).intelligence.hypotheses.find(h => h.id === 'deployment')?.status, 'disputed');
assert.equal(getSession(sessionId).intelligence.conflicts.length, 1);
assert.equal(getSession(sessionId).turns.filter(turn => turn.role === 'commander').length, 3);
assert.equal(getSession(sessionId).turns.filter(turn => turn.role === 'commander' && turn.text.includes('Are you reporting')).length, 0);
console.log('PASS: clarification Rime output never becomes Commander evidence; positive confirmation disputes deployment');

const interrupted = FakeAudio.instances[2];
const beforeInterruptGeneration = getSession(sessionId).generationId;
await voice.interrupt();
assert.equal(interrupted.paused, true); assert.equal(interrupted.currentTime, 0); assert.ok(getSession(sessionId).generationId > beforeInterruptGeneration);
await waitFor(() => FakeRecognition.instances.length === 4); assert.equal(states.includes('Interrupted'), true); assert.equal(states.at(-1), 'Listening');
await new Promise(resolve => setTimeout(resolve, 520));
recognition = FakeRecognition.instances.at(-1)!;
const commanderCountBeforeNewSpeech = getSession(sessionId).turns.filter(turn => turn.role === 'commander').length;
recognition.final('The payment gateway is also timing out.');
await waitFor(() => getSession(sessionId).turns.filter(turn => turn.role === 'commander').length === commanderCountBeforeNewSpeech + 1);
console.log('PASS: interrupt stops/reset audio, invalidates generation, resumes recognition, and accepts new Commander speech');

voice.stopListening(); voice.dispose();
console.log('PASS: echo regression, controlled half-duplex lifecycle, and reset cleanup');
