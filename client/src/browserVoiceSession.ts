import { AudioPlaybackManager, type PlaybackMetrics } from './audioPlaybackManager';
import type { Session } from './lib/model';

export type VoiceState = 'Idle' | 'Listening' | 'Processing' | 'AI Speaking' | 'Interrupted' | 'Error';
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
export interface BrowserRecognition {
  continuous: boolean; interimResults: boolean; lang: string;
  onstart: (() => void) | null; onend: (() => void) | null; onspeechstart: (() => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void; abort: () => void;
}
export function recognitionConstructor(): (new () => BrowserRecognition) | undefined {
  const browser = globalThis as typeof globalThis & { SpeechRecognition?: new () => BrowserRecognition; webkitSpeechRecognition?: new () => BrowserRecognition };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}
interface Callbacks {
  state: (state: VoiceState) => void; listening: (value: boolean) => void; partial: (text: string) => void;
  message: (text: string) => void; session: (session: Session) => void; metrics: (metrics: PlaybackMetrics) => void;
}
const recognitionErrors: Record<string, string> = {
  'not-allowed': 'Microphone permission denied. Allow microphone access in browser settings and retry.',
  'service-not-allowed': 'Speech recognition unavailable in this browser. Use typed commands.',
  'audio-capture': 'No microphone detected, or microphone capture failed. Check your input device.',
  network: 'Speech recognition network error. Check connectivity and retry.',
  'language-not-supported': 'Speech recognition language unavailable. Use typed commands.',
  aborted: 'Speech recognition ended. Click Microphone to resume.',
};

/** Browser STT and Rime playback share only lifecycle/generation fences, never a room provider. */
export class BrowserVoiceSession {
  readonly playback: AudioPlaybackManager;
  private callbacks: Callbacks;
  private sessionId: string;
  private recognizer: BrowserRecognition | null = null;
  private wanted = false;
  private listening = false;
  private disposed = false;
  private revision = 0;
  private lifecycle = 0;
  private responseActive = false;
  private aiSpeaking = false;
  private recognitionPaused = false;
  private intentionalRecognitionStop = false;
  private postPlaybackGuardUntil = 0;
  private readonly postPlaybackGuardMs = 500;
  private queue: Promise<unknown> = Promise.resolve();
  private tts: AbortController | null = null;
  private mutation: AbortController | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | undefined;
  private restarts = 0;
  private spoken = '';
  private spokenUntil = 0;

  constructor(sessionId: string, callbacks: Callbacks) {
    this.sessionId = sessionId; this.callbacks = callbacks;
    this.playback = new AudioPlaybackManager(500, m => { if (!this.disposed) callbacks.metrics(m); }, playing => {
      if (this.disposed) return;
      if (playing) this.state('AI Speaking');
      else if (this.aiSpeaking) this.finishAiSpeaking();
      else if (!this.responseActive) this.state(this.listening ? 'Listening' : 'Idle');
    }, () => this.fail('Audio playback failed. Check browser audio permissions and retry.'));
  }
  private state(value: VoiceState) { if (!this.disposed) this.callbacks.state(value); }
  private message(value: string) { if (!this.disposed) this.callbacks.message(value); }
  private fail(value: string) { this.state('Error'); this.message(value); }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work); this.queue = next.catch(() => {}); return next;
  }
  private invalidate() {
    this.revision++; this.responseActive = false;
    this.tts?.abort(); this.tts = null;
    // This is synchronous and also fences an unresolved HTMLAudioElement.play().
    this.playback.interrupt();
  }
  private pauseRecognitionForPlayback() {
    this.recognitionPaused = true;
    this.intentionalRecognitionStop = true;
    const recognizer = this.recognizer;
    this.recognizer = null;
    if (recognizer) {
      recognizer.onstart = null; recognizer.onend = null; recognizer.onresult = null;
      recognizer.onerror = null; recognizer.onspeechstart = null;
      try { recognizer.abort(); } catch { /* Recognition may already have ended. */ }
    }
    this.listening = false;
    this.callbacks.listening(false);
  }
  private finishAiSpeaking() {
    if (!this.aiSpeaking) return;
    this.aiSpeaking = false;
    this.postPlaybackGuardUntil = Date.now() + this.postPlaybackGuardMs;
    if (this.wanted && !this.disposed && this.recognitionPaused) {
      this.recognitionPaused = false;
      this.intentionalRecognitionStop = false;
      this.state('Listening');
      this.createAndStartRecognition();
    } else {
      this.recognitionPaused = false;
      this.intentionalRecognitionStop = false;
      this.state(this.wanted ? 'Listening' : 'Idle');
    }
  }
  private async post(path: string, body?: unknown) {
    const controller = new AbortController(); this.mutation = controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}), signal: controller.signal });
      if (!response.ok) throw new Error(`Incident API returned HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); if (this.mutation === controller) this.mutation = null; }
  }
  interrupt = async () => {
    this.state('Interrupted'); this.invalidate();
    const lifecycle = this.lifecycle;
    try {
      await this.enqueue(async () => {
        const session = await this.post(`/api/sessions/${this.sessionId}/interrupt`);
        if (!this.disposed && lifecycle === this.lifecycle) this.callbacks.session(session);
      });
    } catch { if (!this.disposed && lifecycle === this.lifecycle) this.fail('Local audio stopped; backend interruption failed. Check the backend connection.'); }
    // Recognition intentionally remains active for the replacement utterance.
  };
  submit = async (text: string) => {
    if (this.disposed || !text.trim()) return;
    this.invalidate(); this.responseActive = true; this.state('Processing'); this.message('');
    const revision = this.revision, lifecycle = this.lifecycle, endedAt = Date.now();
    const current = () => !this.disposed && lifecycle === this.lifecycle && revision === this.revision;
    try {
      const result = await this.enqueue(async () => {
        if (this.disposed || lifecycle !== this.lifecycle) return null;
        const value = await this.post('/api/commands', { sessionId: this.sessionId, turnId: crypto.randomUUID(), command: text });
        if (!this.disposed && lifecycle === this.lifecycle) this.callbacks.session(value.session);
        return value;
      });
      if (!result || !current()) return;
      this.callbacks.partial('');
      this.playback.startGeneration(this.sessionId, result.generationId);
      if (result.spoken) await this.speak(result.spoken, result.generationId, endedAt, current);
      else { this.responseActive = false; this.state(this.listening ? 'Listening' : 'Idle'); }
    } catch { if (current()) { this.responseActive = false; this.fail('Incident command failed. Check the backend connection and retry.'); } }
  };
  private async speak(text: string, generationId: number, userTurnEndedAt: number, current: () => boolean) {
    const controller = new AbortController(); this.tts = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    let stage = 'Rime request';
    try {
      const response = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, sessionId: this.sessionId, generationId, userTurnEndedAt }), signal: controller.signal });
      if (!current()) return;
      if (response.status === 409) { this.responseActive = false; this.state(this.listening ? 'Listening' : 'Idle'); return; }
      if (!response.ok) throw new Error(`Rime request failed (HTTP ${response.status}).`);
      const blob = await response.blob();
      if (!current() || controller.signal.aborted) return;
      stage = 'Audio playback';
      this.responseActive = false;
      this.aiSpeaking = true;
      this.pauseRecognitionForPlayback();
      this.spoken = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      this.spokenUntil = Date.now() + 15000;
      await this.playback.play(blob, this.sessionId, generationId);
    } catch {
      if (this.aiSpeaking) this.finishAiSpeaking();
      if (current()) { this.responseActive = false; this.fail(stage === 'Audio playback' ? 'Audio playback failed. Check browser audio permissions and retry.' : 'Rime request failed or timed out. Check Rime configuration and connectivity.'); }
    } finally { clearTimeout(timer); if (this.tts === controller) this.tts = null; }
  }
  startListening = async () => {
    if (this.disposed) return;
    if (this.aiSpeaking) { await this.interrupt(); return; }
    if (this.wanted) return;
    const Recognition = recognitionConstructor();
    if (!Recognition) { this.fail('Speech recognition unavailable in this browser. Use typed commands.'); return; }
    if (typeof window !== 'undefined' && !window.isSecureContext) { this.fail('Microphone requires HTTPS or localhost.'); return; }
    this.wanted = true; this.restarts = 0; this.message('');
    this.createAndStartRecognition();
  };
  private createAndStartRecognition() {
    const Recognition = recognitionConstructor();
    if (!Recognition || this.disposed || !this.wanted || this.aiSpeaking) return;
    let recognizer: BrowserRecognition;
    try { recognizer = new Recognition(); }
    catch { this.wanted = false; this.fail('Speech recognition unavailable in this browser. Use typed commands.'); return; }
    this.recognizer = recognizer;
    recognizer.continuous = true; recognizer.interimResults = true; recognizer.lang = 'en-US';
    let finalIndex = -1;
    recognizer.onstart = () => { if (!this.wanted || this.disposed || this.aiSpeaking || this.recognitionPaused) return; finalIndex = -1; this.listening = true; this.callbacks.listening(true); if (!this.responseActive && !this.playback.activeAudio) this.state('Listening'); this.message(''); };
    recognizer.onspeechstart = () => { /* Recognition is paused during AI output. */ };
    recognizer.onresult = event => {
      if (!this.wanted || this.disposed || this.aiSpeaking || this.recognitionPaused || Date.now() < this.postPlaybackGuardUntil) return;
      this.restarts = 0;
      const finals: string[] = [], partials: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index], transcript = result[0].transcript.trim();
        if (result.isFinal) { if (index > finalIndex) { finals.push(transcript); finalIndex = index; } }
        else partials.push(transcript);
      }
      const text = [...finals, ...partials].join(' ').trim();
      const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      // Conservative echo suppression; headphones are still needed for reliable barge-in.
      if (normalized.split(' ').length >= 5 && Date.now() < this.spokenUntil && this.spoken.includes(normalized)) return;
      if (text) this.callbacks.partial(text);
      if (finals.length) void this.submit(finals.join(' '));
    };
    recognizer.onerror = event => {
      if (!this.wanted || this.disposed) return;
      if (this.intentionalRecognitionStop || this.recognitionPaused || this.aiSpeaking) return;
      if (event.error === 'no-speech') { this.message('No speech detected. Listening will resume.'); return; }
      this.stopListening();
      this.fail(recognitionErrors[event.error] ?? 'Speech recognition error. Retry or use typed commands.');
    };
    recognizer.onend = () => {
      if (this.disposed) return;
      this.listening = false; this.callbacks.listening(false);
      if (!this.wanted || this.intentionalRecognitionStop || this.recognitionPaused || this.aiSpeaking) return;
      if (++this.restarts > 3) { this.wanted = false; this.fail('Speech recognition ended repeatedly. Click Microphone to retry.'); return; }
      if (!this.responseActive && !this.playback.activeAudio) this.state('Idle');
      this.message('Speech recognition ended. Restarting listening…');
      this.restartTimer = setTimeout(() => { if (this.wanted && !this.disposed) this.begin(recognizer); }, 350 * this.restarts);
    };
    // Start directly in the click gesture: no token or backend request gates microphone permission.
    this.begin(recognizer);
  }
  private begin(recognizer: BrowserRecognition) {
    try { recognizer.start(); }
    catch (error) {
      this.stopListening();
      this.fail(error instanceof Error && error.name === 'NotAllowedError'
        ? recognitionErrors['not-allowed'] : 'Speech recognition could not start. Check microphone permission and retry.');
    }
  }
  stopListening = () => {
    this.wanted = false; this.listening = false; clearTimeout(this.restartTimer);
    if (this.recognizer) {
      this.recognizer.onstart = null; this.recognizer.onend = null; this.recognizer.onresult = null;
      this.recognizer.onerror = null; this.recognizer.onspeechstart = null;
      try { this.recognizer.abort(); } catch { /* Already-ended recognition has no active capture to abort. */ }
      this.recognizer = null;
    }
    if (!this.disposed) { this.callbacks.listening(false); this.callbacks.partial(''); }
    if (!this.responseActive && !this.playback.activeAudio) this.state('Idle');
  };
  endSession = async () => {
    this.lifecycle++; this.stopListening(); this.mutation?.abort();
    const pending = this.interrupt(); this.state('Idle'); this.message('Session ended. Click Microphone to start again.');
    await pending;
  };
  dispose() {
    if (this.disposed) return;
    this.lifecycle++;
    this.stopListening();
    this.mutation?.abort();
    this.tts?.abort(); this.tts = null;
    this.playback.interrupt();
    this.aiSpeaking = false; this.responseActive = false; this.recognitionPaused = false;
    this.intentionalRecognitionStop = true; this.postPlaybackGuardUntil = 0;
    this.disposed = true;
  }
}
