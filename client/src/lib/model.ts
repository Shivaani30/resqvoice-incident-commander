export interface Turn {
    id: string;
    role: string;
    text: string;
    timestamp: string;
    generation: number;
    name?: string;
    category?: string;
}
export interface Incident {
    id: string;
    title: string;
    severity: string;
    status: string;
    team: string;
    startedAt?: string;
}
export interface IncidentEvent {
    id: string;
    timestamp: string;
    message: string;
    status: string;
    generationId: number;
    type: string;
    tool?: string;
}
export interface Session {
    intelligence?: Intelligence;
    generationId: number;
    incident: Incident | null;
    turns: Turn[];
    events: IncidentEvent[];
}
export interface Claim {
    id: string;
    text: string;
    status: string;
    evidence?: string[];
    source?: string;
    timestamp?: string;
    owner?: string;
    priority?: string;
}
export interface Intelligence {
    risks?: Claim[];
    facts: Claim[];
    hypotheses: Claim[];
    questions: Claim[];
    actions: Claim[];
    decisions: Claim[];
    conflicts: Claim[];
    participants: {
        name: string;
        role: string;
    }[];
    snapshot: string;
}
export function liveIntelligence(session: Session): Intelligence {
    if (session.intelligence) return { ...session.intelligence, participants: [], actions: [...session.intelligence.actions, ...session.events.filter(e => e.type === 'tool').map(e => ({ id: e.id, text: e.message, status: e.status, timestamp: e.timestamp }))] };
    return { facts: [], hypotheses: [], questions: [], decisions: [], conflicts: [], participants: [],
        actions: session.events.filter(e => e.type === 'tool').map(e => ({ id: e.id, text: e.message, status: e.status, timestamp: e.timestamp })),
        snapshot: session.incident ? `${session.incident.title}. Severity ${session.incident.severity}; ${session.incident.status.toLowerCase()}. Assigned team: ${session.incident.team}. Root cause remains unconfirmed.` : 'No incident has been declared. Create an incident using a voice or typed command.' };
}
export const time = (value?: string) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Not recorded';
