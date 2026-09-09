import { useEffect, useState } from 'react';
import { demoLength, demoSnapshot } from './demoIncident';
export function useDemo() {
    const [step, setStep] = useState(demoLength), [running, setRunning] = useState(false);
    useEffect(() => { if (!running)
        return; const timer = setInterval(() => setStep(s => { if (s >= demoLength) {
        setRunning(false);
        return s;
    } return s + 1; }), 3000); return () => clearInterval(timer); }, [running]);
    return { ...demoSnapshot(step), step, running, run: () => { if (step === demoLength)
            setStep(0); setRunning(true); }, pause: () => setRunning(false), reset: () => { setRunning(false); setStep(0); } };
}
