import type { Claim, Intelligence } from './intelligence.js';
import { createLLMProvider, type LLMResponse } from './llm.js';

export type Route = 'CLARIFICATION_RESPONSE' | 'STATUS_COMMAND' | 'STATUS_CLARIFICATION' | 'DECISION' | 'ACTION' | 'STATE_QUERY' | 'INCIDENT_ANALYSIS' | 'GENERAL_KNOWLEDGE' | 'INCIDENT_STATEMENT' | 'UNKNOWN';
export interface IncidentContext { incident: { id?: string; title?: string; severity?: string; status?: string } | null; rootCauseStatus: string; facts: unknown[]; observations: unknown[]; hypotheses: unknown[]; evidence: string[]; contradictions: string[]; unknowns: string[]; questions: string[]; actions: unknown[]; decisions: unknown[]; risks: unknown[]; summary: string }

export function classifyRoute(text: string): Route {
  const value = text.trim().toLowerCase();
  if (/^(yes|no|correct|that's right|that is right)\b/.test(value)) return 'CLARIFICATION_RESPONSE';
  if (/\b(?:incident|outage|issue)\b.*\b(?:rassol|resol|resolve|result)\b/.test(value)) return 'STATUS_CLARIFICATION';
  if (/^(approve|approved|proceed|declare)\b.*\b(?:rollback|incident|p[123])\b|\bwe (?:will|decided to) rollback\b/.test(value)) return 'DECISION';
  if (/\b(?:do not|don't) (?:declare|mark) (?:the )?incident resolved\b|^(?:mark|resolve) (?:the )?incident resolved\b|^the incident (?:is )?resolved\b|^yes,?\s*(?:mark|resolve) (?:the )?incident resolved\b/.test(value)) return 'STATUS_COMMAND';
  const question = /\?$/.test(value) || /^(what|why|which|how|is|are|could|can|does|did|should we|so|explain|define|meaning of)\b/.test(value);
  if (/\b(?:what do we know|what is known|what (?:do we )?still not know|what don't we know|what do we not know|what is unknown|what is unresolved|what are the open questions|what hypotheses? (?:are )?(?:active|disputed)|what actions? (?:are pending|do we have)|what decisions? (?:have been made|did we make)|what evidence (?:do we have|establishes? the root cause)|what contradictions?|what caused? the (?:outage|incident)|what is the root cause|what is the incident status|is .* root cause|does .* prove|is the incident (?:resolved|closed)|(?:deployment|gateway) .*definitely .*caused)\b/.test(value)) return 'STATE_QUERY';
  const analysisSignal = /\b(?:give me (?:your )?assessment|assessment of|assess|most likely cause|what should we|what do you think|recommend|based on the evidence|given the evidence|explain the incident|how has the .* evidence changed)\b/.test(value);
  if (analysisSignal) return 'INCIDENT_ANALYSIS';
  if (question) {
    if (/^(?:what is|what does|define|explain|meaning of)\b/.test(value) && /\b(?:rollback|connection pool exhaustion|circuit breaking|http 503|p[123])\b/.test(value)) return 'GENERAL_KNOWLEDGE';
    return 'INCIDENT_ANALYSIS';
  }
  const actionVerb = /\b(?:investigate|check|monitor|prepare|inspect|verify|compare|review|roll back)\b/.test(value);
  const command = /\b(?:let'?s|let us|please|we should|we need to|i'll|i will|can you|someone)\b/.test(value) || /^(?:investigate|check|monitor|prepare|inspect|verify|compare|review|roll back)\b/.test(value);
  if (actionVerb && command) return 'ACTION';
  if (value.trim()) return 'INCIDENT_STATEMENT';
  return 'UNKNOWN';
}

export function buildIncidentContext(state: Intelligence, incident: IncidentContext['incident']): IncidentContext {
  const facts = state.facts.map(({ text, status, originalText, metric }) => ({ text, status, originalText, metric }));
  return { incident, rootCauseStatus: state.hypotheses.find(item => item.id === 'root-cause')?.status ?? 'UNCONFIRMED', facts, observations: facts.filter(item => item.status === 'reported'), hypotheses: state.hypotheses.map(({ text, status, evidence }) => ({ text, status, evidence })), evidence: facts.map(item => item.originalText ?? item.text), contradictions: state.conflicts.map(item => item.text), unknowns: state.questions.filter(item => item.status === 'unresolved').map(item => item.text), questions: state.questions.filter(item => item.status === 'unresolved').map(item => item.text), actions: state.actions.map(({ text, status }) => ({ text, status })), decisions: state.decisions.map(({ text, status }) => ({ text, status })), risks: state.risks.map(({ text, status }) => ({ text, status })), summary: state.snapshot };
}

function deploymentPhrase(state: Intelligence) {
  const deployment = state.hypotheses.find(item => item.id === 'deployment');
  return deployment?.status === 'disputed' ? 'The deployment hypothesis remains disputed.' : deployment ? 'The deployment remains an unconfirmed hypothesis.' : '';
}
export function answerStateQuery(question: string, state: Intelligence, incidentStatus = 'Investigating') {
  const value = question.toLowerCase();
  const deployment = state.hypotheses.find(item => item.id === 'deployment');
  if (/what (?:do we know|is known)/.test(value)) { const facts = state.facts.filter(item => item.status === 'reported').slice(-4).map(item => item.text); return facts.length ? `Known observations include ${facts.join('; ')}. ${deploymentPhrase(state)} Root cause remains unconfirmed.` : 'No confirmed incident evidence has been recorded yet. Root cause remains unconfirmed.'; }
  if (/what (?:do we )?still not know|what (?:don't|do not) we know|what is unknown|what remains unknown|what is unresolved|what are the open questions/.test(value)) return `We still do not have a confirmed root cause. ${deploymentPhrase(state) || 'Additional evidence is needed.'}`;
  if (/what hypotheses? .*disputed/.test(value)) { const disputed = state.hypotheses.filter(item => item.status === 'disputed'); return disputed.length ? `Disputed hypotheses include ${disputed.map(item => item.text).join('; ')}.` : 'No disputed hypotheses have been recorded.'; }
  if (/what hypotheses?/.test(value)) return state.hypotheses.length ? `Hypotheses include ${state.hypotheses.map(item => `${item.text} (${item.status})`).join('; ')}.` : 'No active hypotheses have been recorded.';
  if (/what actions?/.test(value)) { const actions = state.actions.filter(item => item.status === 'pending' || item.status === 'in-progress'); return actions.length ? `Pending actions include ${actions.map(item => item.text).join(', ')}.` : 'No pending actions are currently recorded.'; }
  if (/what decisions?/.test(value)) return state.decisions.length ? `Recorded decisions include ${state.decisions.map(item => item.text).join('; ')}.` : 'No incident decisions have been recorded.';
  if (/what contradictions?/.test(value)) return state.conflicts.length ? `Recorded contradictions include ${state.conflicts.map(item => item.text).join('; ')}.` : 'No contradictions have been recorded.';
  if (/what hypotheses? .*disputed/.test(value)) { const disputed = state.hypotheses.filter(item => item.status === 'disputed'); return disputed.length ? `Disputed hypotheses include ${disputed.map(item => item.text).join('; ')}.` : 'No disputed hypotheses have been recorded.'; }
  if (/what contradictions?/.test(value)) return state.conflicts.length ? `Recorded contradictions include ${state.conflicts.map(item => item.text).join('; ')}.` : 'No contradictions have been recorded.';
  if (/what evidence/.test(value)) return state.facts.length ? `Recorded evidence includes ${state.facts.slice(-4).map(item => item.originalText ?? item.text).join('; ')}. ${deploymentPhrase(state) || 'Current evidence does not establish a root cause.'}` : 'Current evidence does not establish a root cause.';
  if (/incident (?:resolved|closed)/.test(value)) return incidentStatus.toLowerCase() === 'resolved' ? 'The incident is marked resolved.' : incidentStatus.toLowerCase() === 'mitigating' ? 'The incident is being mitigated and has not been marked resolved.' : incidentStatus.toLowerCase() === 'monitoring' ? 'The incident is being monitored and has not been marked resolved.' : 'The incident remains under investigation.';
  if (/deployment/.test(value)) return `Current evidence does not establish the deployment as the root cause. ${deployment?.status === 'disputed' ? 'The deployment hypothesis remains disputed.' : deployment ? 'The deployment remains an unconfirmed hypothesis.' : ''}`.trim();
  return deployment ? `Current evidence does not establish a root cause. ${deploymentPhrase(state)}` : 'Current evidence does not establish a root cause. Investigation remains open.';
}

function unsafe(answer: string, state: Intelligence) {
  const lower = answer.toLowerCase(), deployment = state.hypotheses.find(item => item.id === 'deployment');
  if ((!deployment || deployment.status !== 'confirmed') && /deployment.{0,60}(?:caused|confirmed|definitely the cause|root cause)/.test(lower)) return true;
  return false;
}
export async function answerWithLLM(question: string, state: Intelligence, incident: IncidentContext['incident'], conversationContext: Array<{ role: string; text: string }>, signal?: AbortSignal, generalKnowledge = false): Promise<LLMResponse> {
  const provider = createLLMProvider();
  if (!provider) return { answer: generalKnowledge ? 'I\'m unable to answer that broader question right now.' : 'I\'m unable to generate broader analysis right now. The structured incident state remains available.', answerType: generalKnowledge ? 'GENERAL_KNOWLEDGE' : 'INCIDENT_GROUNDED', confidence: 'LOW', usesIncidentState: !generalKnowledge };
  try { const result = await provider.generateAnswer({ question, incidentContext: buildIncidentContext(state, incident), conversationContext, signal }); return unsafe(result.answer, state) ? { answer: 'No. The current evidence does not establish that as the confirmed root cause.', answerType: 'INCIDENT_GROUNDED', confidence: 'HIGH', usesIncidentState: true } : result; }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw error; return { answer: generalKnowledge ? 'I\'m unable to answer that broader question right now.' : 'I\'m unable to generate broader analysis right now. The structured incident state remains available.', answerType: generalKnowledge ? 'GENERAL_KNOWLEDGE' : 'INCIDENT_GROUNDED', confidence: 'LOW', usesIncidentState: !generalKnowledge }; }
}
