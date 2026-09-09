import type { Intelligence } from './intelligence.js';
import type { Route } from './qa.js';

export type InterventionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InterventionResponseMode = 'NONE' | 'DETERMINISTIC' | 'LLM';
export type InterventionReason = 'USER_REQUEST' | 'CONTRADICTION' | 'SAFETY_WARNING' | 'SOP_CONFLICT' | 'AMBIGUITY' | 'CRITICAL_UNKNOWN' | 'DECISION_CONFIRMATION' | 'INCIDENT_STATUS_CHANGE' | 'ROOT_CAUSE_SAFETY' | 'ROUTINE_UPDATE';
export type InterventionDecision = { shouldSpeak: boolean; priority: InterventionPriority; reason: InterventionReason; responseMode: InterventionResponseMode; interruptCurrentSpeech: boolean; suppressionReason?: string };

export type InterventionInput = { transcript: string; intent: Route; events: string[]; incidentState: Intelligence; aiSpeaking?: boolean };

/** Central policy: state updates are silent by default; only meaningful events or requests reach Rime. */
export function evaluateIntervention(input: InterventionInput): InterventionDecision {
  const { transcript, intent, events, aiSpeaking = false } = input;
  if (intent === 'STATE_QUERY') return { shouldSpeak: true, priority: 'MEDIUM', reason: 'USER_REQUEST', responseMode: 'DETERMINISTIC', interruptCurrentSpeech: aiSpeaking };
  if (intent === 'INCIDENT_ANALYSIS' || intent === 'GENERAL_KNOWLEDGE') return { shouldSpeak: true, priority: 'MEDIUM', reason: 'USER_REQUEST', responseMode: 'LLM', interruptCurrentSpeech: aiSpeaking };
  if (intent === 'STATUS_CLARIFICATION') return { shouldSpeak: true, priority: 'HIGH', reason: 'AMBIGUITY', responseMode: 'DETERMINISTIC', interruptCurrentSpeech: aiSpeaking };
  if (events.includes('ROOT_CAUSE_SAFETY')) return { shouldSpeak: true, priority: 'HIGH', reason: 'ROOT_CAUSE_SAFETY', responseMode: 'DETERMINISTIC', interruptCurrentSpeech: aiSpeaking };
  if (events.includes('CONFLICT_DETECTED')) return { shouldSpeak: true, priority: 'HIGH', reason: 'CONTRADICTION', responseMode: 'DETERMINISTIC', interruptCurrentSpeech: aiSpeaking };
  if (intent === 'STATUS_COMMAND' || intent === 'CLARIFICATION_RESPONSE') return { shouldSpeak: true, priority: 'HIGH', reason: 'INCIDENT_STATUS_CHANGE', responseMode: 'DETERMINISTIC', interruptCurrentSpeech: aiSpeaking };
  if (intent === 'DECISION') return { shouldSpeak: true, priority: 'MEDIUM', reason: 'DECISION_CONFIRMATION', responseMode: 'DETERMINISTIC', interruptCurrentSpeech: aiSpeaking };
  return { shouldSpeak: false, priority: 'LOW', reason: 'ROUTINE_UPDATE', responseMode: 'NONE', interruptCurrentSpeech: false, suppressionReason: transcript.trim() ? 'ROUTINE_UPDATE' : 'LOW_SIGNIFICANCE' };
}

export class InterventionManager {
  private recent = new Map<string, number>();
  decide(input: InterventionInput): InterventionDecision {
    const decision = evaluateIntervention(input);
    if (!decision.shouldSpeak) return decision;
    const fingerprint = `${decision.reason}:${input.transcript.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
    const now = Date.now();
    const cooldown = decision.reason === 'CONTRADICTION' ? 20_000 : decision.reason === 'ROOT_CAUSE_SAFETY' ? 30_000 : decision.reason === 'CRITICAL_UNKNOWN' ? 90_000 : 0;
    const previous = this.recent.get(fingerprint);
    if (previous !== undefined && now - previous < cooldown) return { ...decision, shouldSpeak: false, responseMode: 'NONE', suppressionReason: cooldown ? 'COOLDOWN' : 'DUPLICATE' };
    this.recent.set(fingerprint, now);
    return decision;
  }
}
