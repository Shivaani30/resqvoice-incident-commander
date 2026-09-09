import { useEffect, useRef, useState } from 'react';
import type { Session } from '../lib/model';
import type { PlaybackMetrics } from '../audioPlaybackManager';
import { BrowserVoiceSession, recognitionConstructor, type VoiceState } from '../browserVoiceSession';

const emptySession = (): Session => ({ generationId: 0, incident: null, events: [], turns: [] });
const emptyMetrics = (): PlaybackMetrics => ({ interruptionAt: null, stoppedAt: null, stopLatencyMs: null, finalGeneration: 0, passed: null });
export function useLiveSession() {
  const [sessionId, setSessionId] = useState(() => `workspace-${crypto.randomUUID()}`);
  const [session, setSession] = useState<Session>(emptySession);
  const [text, setText] = useState('');
  const [partial, setPartial] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('Idle');
  const speechSupported = Boolean(recognitionConstructor());
  const [message, setMessage] = useState(speechSupported ? '' : 'Speech recognition unavailable in this browser. Use typed commands.');
  const [rime, setRime] = useState({ configured: false, provider: 'Rime' });
  const [metrics, setMetrics] = useState<PlaybackMetrics>(emptyMetrics);
  const [connection, setConnection] = useState('Connecting');
  const voice = useRef<BrowserVoiceSession | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const accept = (next: Session) => { if (active) setSession(previous => next.generationId >= previous.generationId ? next : previous); };
    const current = new BrowserVoiceSession(sessionId, { state: setVoiceState, listening: setListening,
      partial: setPartial, message: setMessage, session: accept, metrics: setMetrics });
    voice.current = current;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Session unavailable');
        accept(await response.json());
        if (active) setConnection('Connected');
      } catch { if (active) setConnection('Disconnected'); }
    };
    void refresh();
    fetch('/api/rime/validate', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Rime validation unavailable');
      const value = await response.json(); if (active) setRime(value);
    }).catch(() => { if (active) { setRime({ configured: false, provider: 'Rime' }); setMessage('Rime validation unavailable. Check the backend connection.'); } });
    const timer = setInterval(refresh, 700);
    return () => { active = false; controller.abort(); clearInterval(timer); current.dispose(); if (voice.current === current) voice.current = null; };
  }, [sessionId]);

  const resetWorkspace = async () => {
    voice.current?.dispose(); voice.current = null;
    setListening(false); setPartial(''); setText(''); setSession(emptySession()); setMetrics(emptyMetrics());
    setVoiceState('Idle'); setConnection('Connecting'); setRime({ configured: false, provider: 'Rime' });
    setMessage(speechSupported ? '' : 'Speech recognition unavailable in this browser. Use typed commands.');
    setSessionId(`workspace-${crypto.randomUUID()}`);
  };
  return { session, text, setText, partial, listening, message, rime, metrics, connection, voiceState, speechSupported,
    submit: async () => { const command = text; if (!command.trim()) return; setText(''); await voice.current?.submit(command); },
    startListening: async () => { await voice.current?.startListening(); },
    stopListening: () => { voice.current?.stopListening(); },
    interrupt: async () => { await voice.current?.interrupt(); },
    endSession: async () => { await voice.current?.endSession(); },
    resetWorkspace,
  };
}
