import type { Intelligence, Session, Claim } from '../lib/model';
const at = (time: string) => `2026-09-09T${time}:00+05:30`;
export const participants = [{ name: 'Maya Chen', role: 'Incident Commander' }, { name: 'Alex Rivera', role: 'Backend Engineer' }, { name: 'Priya Shah', role: 'SRE / DevOps' }, { name: 'Noah Williams', role: 'Database Engineer' }, { name: 'Sam Taylor', role: 'Support' }];
const script = [
    ['09:42', 'Priya Shah', 'Observation', "We're seeing checkout errors climb above forty percent. The alert dashboard reports 43%."],
    ['09:44', 'Maya Chen', 'Decision', 'Declare P1. Checkout payments are affected. Support, please track customer impact.'],
    ['09:46', 'Alex Rivera', 'Hypothesis', 'Deployment v2.18 completed ten minutes before the spike. It may be related; causation is not confirmed.'],
    ['09:48', 'Noah Williams', 'Evidence', 'Database CPU and connection counts look normal. The database health dashboard shows no saturation.'],
    ['09:50', 'Sam Taylor', 'Hypothesis', 'Some customer reports mention database timeouts. Could the database be failing?'],
    ['09:52', 'Noah Williams', 'Evidence', 'Direct database probes are succeeding. This contradicts the database failure theory; the application timeout origin is still unknown.'],
    ['09:55', 'Alex Rivera', 'Action', "Let's prepare a rollback to v2.17 but hold execution until approval."],
    ['09:57', 'Maya Chen', 'Decision', 'I approve the rollback. Priya, execute it and monitor checkout recovery.'],
    ['10:01', 'Priya Shah', 'Observation', 'Rollback completed. Error rate is beginning to fall, now 12%. We need sustained recovery before resolution.']
];
export const demoLength = script.length;
export function demoSnapshot(step: number): {
    session: Session;
    intelligence: Intelligence;
} {
    const turns = script.slice(0, step).map(([t, name, category, text], i) => ({ id: `turn-${i}`, name, role: participants.find(p => p.name === name)!.role, category, text, timestamp: at(t), generation: i + 1 }));
    const claim = (id: string, text: string, status: string, index: number, evidence?: string[]): Claim => ({ id, text, status, timestamp: at(script[index][0]), source: script[index][1], evidence });
    const facts: Claim[] = [];
    const hypotheses: Claim[] = [];
    const questions: Claim[] = [];
    const actions: Claim[] = [];
    const decisions: Claim[] = [];
    const conflicts: Claim[] = [];
    if (step >= 1)
        facts.push(claim('f1', 'Checkout payment failures reached 43%.', 'confirmed', 0, ['Alert dashboard reports 43% checkout errors.']));
    if (step >= 2) {
        decisions.push(claim('d1', 'Declare a P1 incident for checkout payments.', 'recorded', 1));
        actions.push({ ...claim('a1', 'Track affected customers and support impact.', 'pending', 1), owner: 'Sam Taylor', priority: 'High' });
    }
    if (step >= 3) {
        hypotheses.push(claim('h1', 'Recent deployment may be associated with payment failures.', 'unconfirmed', 2, ['Deployment preceded the error spike; temporal association does not establish causation.']));
        questions.push(claim('q1', 'Which change caused payment requests to fail?', 'unresolved', 2));
    }
    if (step >= 4)
        facts.push(claim('f2', 'Database CPU and connection counts are normal.', 'confirmed', 3, ['Database health dashboard checked by Noah Williams.']));
    if (step >= 5)
        hypotheses.push(claim('h2', 'Database failure may explain application timeouts.', step >= 6 ? 'disputed' : 'unconfirmed', 4, ['Customer reports describe timeouts.', ...(step >= 6 ? ['Contradicting evidence: direct database probes succeed.'] : [])]));
    if (step >= 6)
        conflicts.push(claim('c1', 'Application timeout reports conflict with healthy database probes.', 'disputed', 5, ['Sam Taylor: customers report database timeouts.', 'Noah Williams: direct database probes succeed; CPU and connections normal.']));
    if (step >= 7)
        actions.push({ ...claim('a2', 'Prepare rollback to v2.17.', step >= 9 ? 'completed' : step >= 8 ? 'completed' : 'pending', 6), owner: 'Alex Rivera', priority: 'High' });
    if (step >= 8) {
        decisions.push(claim('d2', 'Approve rollback to v2.17 and monitor recovery.', 'approved', 7, ['Rollback is a mitigation; root cause remains unconfirmed.']));
        actions.push({ ...claim('a3', 'Execute rollback and monitor checkout recovery.', step >= 9 ? 'completed' : 'pending', 7), owner: 'Priya Shah', priority: 'High' });
    }
    if (step >= 9) {
        facts.push(claim('f3', 'Error rate declined to 12% after rollback.', 'confirmed', 8, ['SRE reports declining error rate; sustained recovery is not yet established.']));
        questions.push(claim('q2', 'Will checkout recovery remain stable under normal traffic?', 'unresolved', 8));
    }
    return { session: { generationId: step, incident: { id: 'INC-2047', title: 'Checkout Payment Failure', severity: 'P1', status: 'Investigating', team: 'Payments', startedAt: at('09:42') }, turns, events: turns.map(t => ({ id: `event-${t.id}`, timestamp: t.timestamp, message: t.text, status: 'recorded', generationId: t.generation, type: t.category! })) }, intelligence: { facts, hypotheses, questions, actions, decisions, conflicts, participants, snapshot: step >= 9 ? 'Checkout failures are declining after rollback (43% ? 12%). Recovery is not yet sustained. Database health checks challenge the database failure theory. Root cause remains unconfirmed.' : step >= 1 ? 'Checkout payments are experiencing elevated failures. Responders are investigating deployment timing and database health. Root cause remains unconfirmed.' : 'Scenario ready. Run the demo to reveal the conversation and its structured incident intelligence.' } };
}
