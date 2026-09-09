import { useEffect, useRef } from 'react';

export function ResetWorkspaceDialog({ demo, state, error, onCancel, onConfirm }: {
    demo: boolean;
    state: 'idle' | 'resetting' | 'success' | 'error';
    error?: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    const confirmRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        cancelRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && state !== 'resetting') onCancel();
            if (event.key === 'Tab') {
                const focusables = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
                if (!focusables.length) return;
                const first = focusables[0], last = focusables[focusables.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onCancel, state]);
    const busy = state === 'resetting';
    return <div className="dialog-scrim" role="presentation">
        <section className="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-workspace-title">
            <span className="dialog-icon" aria-hidden="true">↻</span>
            <h2 id="reset-workspace-title">Reset Workspace?</h2>
            <p>{demo ? 'This will return the demo incident to its initial playback state and clear the current workspace view.' : 'This will clear the current incident workspace, including transcript, intelligence, actions, decisions, evidence and timeline currently loaded in this session.'}</p>
            <p className="dialog-note">{demo ? 'Your theme preference will remain unchanged.' : 'If a voice session is active, local playback and speech recognition will stop. Application files, configuration, backups and theme preferences are not affected.'}</p>
            {state === 'error' && <p className="dialog-error" role="alert">{error ?? 'Reset failed. Please try again.'}</p>}
            {state === 'success' && <p className="dialog-success" role="status">Workspace Reset</p>}
            <div className="dialog-actions">
                <button ref={cancelRef} className="ghost" onClick={onCancel} disabled={busy}>Cancel</button>
                <button ref={confirmRef} className="danger-button" onClick={onConfirm} disabled={busy || state === 'success'}>{busy ? 'Resetting…' : state === 'success' ? 'Workspace Reset' : 'Reset Workspace'}</button>
            </div>
        </section>
    </div>;
}
