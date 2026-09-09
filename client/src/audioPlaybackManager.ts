export type PlaybackMetrics = { interruptionAt: number | null; stoppedAt: number | null; stopLatencyMs: number | null; finalGeneration: number; passed: boolean | null };

export class AudioPlaybackManager {
  activeAudio: HTMLAudioElement | null = null;
  sessionId = '';
  generationId = 0;
  urls = new Set<string>();
  metrics: PlaybackMetrics = { interruptionAt: null, stoppedAt: null, stopLatencyMs: null, finalGeneration: 0, passed: null };
  private epoch = 0;
  private valid = false;
  private thresholdMs: number;
  private onChange: (m: PlaybackMetrics) => void;
  private onPlaying: (playing: boolean) => void;
  private onError: () => void;
  constructor(thresholdMs = 500, onChange: (m: PlaybackMetrics) => void = () => {},
    onPlaying: (playing: boolean) => void = () => {}, onError: () => void = () => {}) {
    this.thresholdMs = thresholdMs; this.onChange = onChange; this.onPlaying = onPlaying; this.onError = onError;
  }
  startGeneration(sessionId: string, generationId: number) {
    if (sessionId === this.sessionId && generationId <= this.generationId) return;
    this.stop(); this.sessionId = sessionId; this.generationId = generationId; this.valid = true;
    this.metrics.finalGeneration = generationId; this.onChange({ ...this.metrics });
  }
  interrupt() {
    this.metrics.interruptionAt = performance.now(); this.stop();
    this.metrics.stoppedAt = performance.now();
    this.metrics.stopLatencyMs = this.metrics.stoppedAt - this.metrics.interruptionAt;
    this.metrics.passed = this.metrics.stopLatencyMs <= this.thresholdMs; this.onChange({ ...this.metrics });
  }
  private stop() {
    this.epoch++; this.valid = false;
    const audio = this.activeAudio; this.activeAudio = null;
    if (audio) {
      audio.onended = null; audio.onerror = null; audio.onplaying = null; audio.pause();
      try { audio.currentTime = 0; } catch { /* Media may not have a seekable timeline yet. */ }
      audio.removeAttribute('src'); audio.load();
    }
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear(); this.onPlaying(false);
  }
  async play(blob: Blob, sessionId: string, generationId: number) {
    if (!this.valid || sessionId !== this.sessionId || generationId !== this.generationId) return false;
    const epoch = this.epoch, url = URL.createObjectURL(blob); this.urls.add(url);
    const audio = new Audio(url); this.activeAudio = audio;
    const current = () => this.valid && epoch === this.epoch && audio === this.activeAudio;
    const release = () => { URL.revokeObjectURL(url); this.urls.delete(url); if (audio === this.activeAudio) { this.activeAudio = null; this.onPlaying(false); } };
    audio.onplaying = () => { if (current()) this.onPlaying(true); else audio.pause(); };
    audio.onended = release;
    audio.onerror = () => { const active = current(); release(); if (active) this.onError(); };
    try {
      await audio.play();
      if (!current()) { audio.pause(); release(); return false; }
      return true;
    } catch (error) { const active = current(); release(); if (!active) return false; throw error; }
  }
  async mockLateResponse(sessionId: string, generationId: number, delayMs = 100) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return this.play(new Blob(['mock'], { type: 'audio/mpeg' }), sessionId, generationId);
  }
}
