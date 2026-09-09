import { useEffect, useRef, useState } from 'react';
import type { Intelligence, Session } from '../lib/model';
import { generateSummary } from '../lib/summary';
export function SummaryDownloadButton({ session, data, demo, reportText }: {
    session: Session;
    data: Intelligence;
    demo: boolean;
    reportText?: string;
}) {
    const [state, setState] = useState<'default' | 'busy' | 'success' | 'error'>('default');
    const [error, setError] = useState('');
    const working = useRef(false);
    useEffect(() => { if (!working.current)
        setState('default'); }, [session.generationId, session.turns.length]);
    const labels = { default: 'Download PDF', busy: 'Generating PDF...', success: 'PDF Downloaded', error: 'PDF Generation Failed' };
    const download = async () => {
        if (working.current)
            return;
        working.current = true;
        setState('busy');
        setError('');
        // Freeze this click's data before the lazy module/font loads or polling advances.
        const content = reportText ?? generateSummary(session, data, demo), id = session.incident?.id;
        try {
            const { createPdfReport, loadReportFont, pdfFilename } = await import('../lib/pdfSummary');
            const font = await loadReportFont();
            const pdf = createPdfReport(content, id, font);
            const blob = pdf.output('blob');
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = pdfFilename(id);
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            setState('success');
        }
        catch (cause) {
            setState('error');
            setError(cause instanceof Error ? cause.message : 'Unable to create the report. Please retry.');
        }
        finally {
            working.current = false;
        }
    };
    return <div className="pdf-download-control"><button className="primary pdf-button" data-state={state} aria-label={labels[state]} aria-busy={state === 'busy'} disabled={state === 'busy'} onClick={download}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M14 3H6v18h12V7zM14 3v5h4M9 12h6M9 16h6"/></svg><span role="status">{labels[state]}</span></button>{error && <p className="pdf-error" role="alert">{error} Select the button to retry.</p>}</div>;
}
