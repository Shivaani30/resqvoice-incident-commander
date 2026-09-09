import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CommandCenter } from './components/CommandCenter';
import { useLiveSession } from './hooks/useLiveSession';
import { useDemo } from './demo/useDemo';
import { demoLength } from './demo/demoIncident';
import { liveIntelligence } from './lib/model';
import './style.css';
import './orbit-theme.css';

function Live({ onMode }: { onMode: () => void }) { const live = useLiveSession(); return <CommandCenter session={live.session} data={liveIntelligence(live.session)} demo={false} connection={live.connection} voice={live} onMode={onMode} onResetWorkspace={live.resetWorkspace}/>; }
function Demo({ onMode }: { onMode: () => void }) { const demo = useDemo(); useEffect(() => { try { if (sessionStorage.getItem('resq-run-demo') === 'true') { sessionStorage.removeItem('resq-run-demo'); demo.run(); } } catch { } }, []); return <CommandCenter session={demo.session} data={demo.intelligence} demo connection="Local" onMode={onMode} onResetWorkspace={demo.reset} demoControls={<div className="button-row"><span role="status" className="mono">{demo.running ? 'Running' : demo.step === 0 ? 'Ready' : demo.step === demoLength ? 'Complete' : 'Paused'} / {demo.step}/{demoLength}</span><button className="primary" onClick={demo.running ? demo.pause : demo.run}>{demo.running ? 'Pause Demo' : demo.step > 0 && demo.step < demoLength ? 'Resume Demo' : 'Run Demo Incident'}</button><button className="ghost" onClick={demo.reset}>Reset Demo</button></div>}/>; }
function App() { const [demo, setDemo] = useState(() => { const value = new URLSearchParams(location.search).get('demo'); return value !== null ? value === '1' : import.meta.env.VITE_DEMO_MODE === 'true'; }); const toggle = () => { const url = new URL(location.href); url.searchParams.set('demo', demo ? '0' : '1'); history.replaceState(null, '', url); setDemo(!demo); }; return demo ? <Demo onMode={toggle}/> : <Live onMode={toggle}/>; }
createRoot(document.getElementById('root')!).render(<App />);
