export type ClaimKind = 'fact' | 'hypothesis' | 'question' | 'action' | 'decision' | 'risk' | 'contradiction';
export interface Claim { id: string; text: string; originalText?: string; normalizedText?: string; status: string; kind?: ClaimKind; evidence?: string[]; source?: string; timestamp?: string; owner?: string; priority?: string; metric?: { previous?: number; current: number; unit: string; direction?: 'increase' | 'decrease' } }
export interface ClarificationContext { kind: 'previous-version'; question: string; askedAt: string; sourceText: string }
export interface Intelligence { facts: Claim[]; hypotheses: Claim[]; questions: Claim[]; actions: Claim[]; decisions: Claim[]; conflicts: Claim[]; risks: Claim[]; participants: { name: string; role: string }[]; snapshot: string; clarification?: ClarificationContext }
export const emptyIntelligence = (): Intelligence => ({ facts: [], hypotheses: [], questions: [], actions: [], decisions: [], conflicts: [], risks: [], participants: [], snapshot: 'No incident observations recorded. Root cause remains unconfirmed.' });

const words: Record<string, string> = { zero:'0', one:'1', two:'2', three:'3', four:'4', five:'5', six:'6', seven:'7', eight:'8', nine:'9', ten:'10', eleven:'11', twelve:'12', thirteen:'13', fourteen:'14', fifteen:'15', sixteen:'16', seventeen:'17', eighteen:'18', nineteen:'19', twenty:'20', thirty:'30', forty:'40', fifty:'50', sixty:'60', seventy:'70', eighty:'80', ninety:'90' };
/** Matching-only normalization; original spoken text remains on every extracted claim. */
export function normalizeSpeech(originalText: string) {
  let n = originalText.normalize('NFKC').toLowerCase().replace(/[‐‑‒–—-]/g, ' ');
  n = n.replace(/\bcheck\s+out\b/g, 'checkout').replace(/\bdata\s+base\b/g, 'database').replace(/\b(previous|old|prior)\s+(release|version)\b/g, 'previous version').replace(/\b(deploy|deployed|deploying|release|released|pushed|push)\b/g, 'deployment').replace(/\b(failure|failed)\b/g, 'failures').replace(/\berror\b/g, 'errors').replace(/\b(about|around|roughly|approximately)\b/g, 'approximately');
  for (const [word, value] of Object.entries(words)) n = n.replace(new RegExp(`\\b${word}\\b`, 'g'), value);
  return n.replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 percent').replace(/\s+/g, ' ').trim();
}
const has = (text: string, pattern: RegExp) => pattern.test(text);
const short = (text: string) => { const value = text.replace(/\s+/g, ' ').trim(); return value.length <= 100 ? value : `${value.slice(0, 97).trim()}...`; };
/** Bounded action-only normalization. The original transcript remains untouched. */
function normalizeActionText(text: string) {
  return text
    .replace(/\b(investigat(?:e|ing)?|investigatti|investigation)\b/g, 'investigate')
    .replace(/\b(checking)\b/g, 'check')
    .replace(/\b(monitoring)\b/g, 'monitor')
    .replace(/\b(preparing)\b/g, 'prepare')
    .replace(/\b(inspecting)\b/g, 'inspect')
    .replace(/\b(verifying)\b/g, 'verify')
    .replace(/\b(comparing)\b/g, 'compare')
    .replace(/\b(reviewing)\b/g, 'review')
    .replace(/\b(rolling\s+back)\b/g, 'roll back')
    .replace(/\b(?:sorry|i mean|uh|um)\b/g, ' ')
    .replace(/\b(let'?s)(?:\s+\1)+\b/g, '$1')
    .replace(/\s+/g, ' ').trim();
}
function actionSummary(text: string) {
  const normalized = normalizeActionText(text).replace(/^(?:let'?s|let us|please|we should|we need to|i'll|i will|can you|someone)\s+/i, '');
  const match = normalized.match(/\b(investigate|check|monitor|prepare|inspect|verify|compare|review|rollback|roll back)\b\s*(.*)$/i);
  return short(match ? `${match[1].toLowerCase()} ${match[2]}`.replace(/[.!?]+$/, '').trim() : normalized.replace(/[.!?]+$/, ''));
}
type MetricChange = { previous?: number; current: number; direction?: 'increase' | 'decrease' };
function metricChange(text: string, unitPattern: string): MetricChange | undefined {
  const fromTo = text.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(?:${unitPattern})\\s+to\\s+(\\d+(?:\\.\\d+)?)\\s*(?:${unitPattern})\\b`));
  const single = text.match(new RegExp(`\\b(?:to|at)\\s+(\\d+(?:\\.\\d+)?)\\s*(?:${unitPattern})\\b`));
  const direction = /\b(?:decreased|dropped|fallen|fell|improved|reduced)\b/.test(text) ? 'decrease' : /\b(?:increased|rose|jumped)\b/.test(text) ? 'increase' : undefined;
  if (fromTo) return { previous: Number(fromTo[1]), current: Number(fromTo[2]), direction };
  if (single) return { current: Number(single[1]), direction };
  return undefined;
}
function queryKind(text: string) {
  if (/\bwhat\s+(?:evidence\s+)?establish(?:es)?\s+the\s+root\s+cause\b|\bwhat\s+evidence\s+do\s+we\s+have\b/.test(text)) return 'evidence';
  if (/\bwhat\s+(?:do\s+we\s+know|is\s+known)|\bwhat\s+is\s+known\b/.test(text)) return 'known';
  if (/\bwhat\s+(?:don'?t|do\s+not)\s+we\s+know\b|\bwhat\s+is\s+unknown\b|\bwhat\s+remains\s+unknown\b/.test(text)) return 'unknown';
  if (/\bwhat\s+hypotheses?\s+are\s+active\b|\bwhat\s+hypothesis\s+is\s+active\b/.test(text)) return 'hypotheses';
  if (/\bwhat\s+actions?\s+(?:are\s+pending|do\s+we\s+have)\b/.test(text)) return 'actions';
  if (/\bwhat\s+decisions?\s+(?:have\s+been\s+made|did\s+we\s+make)\b/.test(text)) return 'decisions';
  if (/\b(?:what\s+)?(?:caused?|cause)\s+the\s+(?:outage|incident)\b|\bwhat\s+is\s+the\s+root\s+cause\b/.test(text)) return 'root-cause';
  if (/\b(?:is|does)\s+(?:the\s+)?(?:deployment|payment\s+gateway|gateway)\b.*\broot\s+cause\b|\b(?:so\s+)?(?:deployment|payment\s+gateway|gateway)\b.*\b(?:definitely|caused)\b/.test(text)) return 'entity-root-cause';
  if (/\b(?:is|has)\s+the\s+incident\s+(?:resolved|closed)\b/.test(text)) return 'incident-status';
  return undefined;
}
function stateQueryResponse(data: Intelligence, kind: string, incidentStatus = 'Investigating', queryText = '') {
  const deployment = data.hypotheses.find(item => item.id === 'deployment');
  const evidence = data.facts.filter(item => item.kind === 'fact' && item.id !== 'root-cause-unknown');
  const checkout = evidence.find(item => /checkout|payment/.test(item.normalizedText ?? '') && /failure|error|failing/.test(item.normalizedText ?? ''));
  const database = evidence.find(item => /database|db/.test(item.normalizedText ?? '') && /normal|healthy|fine/.test(item.normalizedText ?? ''));
  const previous = data.conflicts.length > 0 || evidence.some(item => /previous|old|prior|rollback version/.test(item.normalizedText ?? '') && /error|failure|failing|same/.test(item.normalizedText ?? ''));
  const metric = checkout?.metric;
  const checkoutText = checkout ? metric?.current !== undefined ? `checkout failures reached approximately ${metric.current}%` : 'checkout failures were reported' : '';
  const known = [checkoutText, database ? 'database health was reported normal' : '', previous ? 'failures were also reported on the previous version' : ''].filter(Boolean);
  if (kind === 'known') return known.length ? `We know ${known.join(', ')}. ${deployment ? deployment.status === 'disputed' ? 'The deployment hypothesis is disputed.' : 'The deployment remains an unconfirmed hypothesis.' : ''} Root cause remains unconfirmed.` : 'No confirmed incident evidence has been recorded yet. Root cause remains unconfirmed.';
  if (kind === 'unknown') return `The root cause remains unknown. ${deployment ? deployment.status === 'disputed' ? 'The deployment hypothesis is disputed.' : `The deployment remains ${deployment.status === 'confirmed' ? 'confirmed.' : 'unconfirmed.'}` : 'Investigation remains open.'}`;
  if (kind === 'hypotheses') return data.hypotheses.length ? `Hypotheses include ${data.hypotheses.map(item => `the ${item.id === 'deployment' ? 'deployment' : item.id} hypothesis is ${item.status}`).join('; ')}.` : 'No active hypotheses have been recorded.';
  if (kind === 'actions') { const pending = data.actions.filter(item => item.status === 'pending' || item.status === 'in-progress'); return pending.length ? `Pending actions include ${pending.map(item => item.text).join(', ')}.` : 'No pending actions are currently recorded.'; }
  if (kind === 'decisions') return data.decisions.length ? `Decisions recorded include ${data.decisions.map(item => item.text.replace(/^.*?\b(approve|approved|decided|proceed)\b\s*/i, '').trim()).join(', ')}.` : 'No incident decisions have been recorded.';
  if (kind === 'evidence') return evidence.length ? `Recorded evidence includes ${evidence.slice(-4).map(item => short(item.originalText ?? item.text)).join('; ')}. ${deployment?.status === 'disputed' ? 'The deployment hypothesis remains disputed.' : 'Current evidence does not establish a root cause.'}` : 'Current evidence does not establish a root cause.';
  if (kind === 'incident-status') return incidentStatus.toLowerCase() === 'resolved' ? 'The incident is marked resolved.' : incidentStatus.toLowerCase() === 'mitigating' ? 'The incident is being mitigated and has not been marked resolved.' : incidentStatus.toLowerCase() === 'monitoring' ? 'The incident is being monitored and has not been marked resolved.' : 'The incident remains under investigation.';
  if (kind === 'entity-root-cause') { const deploymentQuery = /deployment/.test(queryText); const entity = deploymentQuery ? deployment : data.hypotheses.find(item => /gateway|payment/.test(item.id)); const label = deploymentQuery ? 'the deployment' : 'the payment gateway'; return entity ? `Current evidence does not establish ${label} as the root cause. ${entity.status === 'disputed' ? 'The deployment hypothesis remains disputed.' : entity.status === 'confirmed' ? `${label[0].toUpperCase()}${label.slice(1)} is confirmed by the recorded evidence.` : `The ${label.replace(/^the /, '')} remains an unconfirmed hypothesis.`}` : `Current evidence does not establish ${label} as the root cause.`; }
  return deployment ? `Current evidence does not establish a root cause. ${deploymentStateText(deployment)}` : 'Current evidence does not establish a root cause.';
}
function deploymentStateText(deployment?: Claim) {
  if (!deployment || deployment.status === 'unconfirmed' || deployment.status === 'active') return 'The deployment remains an active hypothesis. Current evidence does not confirm it as the root cause.';
  if (deployment.status === 'disputed') return 'The deployment hypothesis remains disputed. Root cause remains unconfirmed.';
  if (deployment.status === 'rejected') return 'The deployment hypothesis has been rejected based on the recorded evidence. Root cause remains unconfirmed.';
  if (deployment.status === 'confirmed') return 'The deployment is confirmed as the root cause based on the recorded evidence.';
  return `The deployment hypothesis is ${deployment.status}. Root cause remains unconfirmed.`;
}

function finish(data: Intelligence, spoken: string) {
  for (const risk of data.risks) { const id = `follow-up-${risk.id}`; if (!data.questions.some(item => item.id === id)) data.questions.push({ ...risk, id, text: `Risk to investigate: ${risk.text}`, status: 'unresolved', kind: 'question' }); }
  const deployment = data.hypotheses.find(item => item.id === 'deployment');
  const deploymentSnapshot = deployment ? deployment.status === 'disputed' ? 'New evidence weakens the deployment hypothesis.' : deploymentStateText(deployment) : '';
  const rootCauseSuffix = deployment?.status === 'disputed' ? 'Root cause remains unconfirmed.' : '';
  data.snapshot = [data.facts.at(-1)?.text ?? 'Incident investigation in progress.', deploymentSnapshot, rootCauseSuffix].filter(Boolean).join(' ');
  return spoken;
}

/** Deterministic, bounded classification. Ambiguous version references require clarification. */
export function observe(data: Intelligence, originalText: string, turnId: string, timestamp: string, incidentStatus = 'Investigating') {
  const normalizedText = normalizeSpeech(originalText), source = 'Browser responder report';
  const make = (id: string, text: string, status: string, kind: ClaimKind, evidence = [originalText]): Claim => ({ id, text, originalText, normalizedText, status, kind, source, timestamp, evidence });
  const add = (list: Claim[], item: Claim) => { if (!list.some(existing => existing.id === item.id)) list.push(item); };
  add(data.questions, make('root-cause-unknown', 'What evidence establishes the root cause?', 'unresolved', 'question', []));
  const version = has(normalizedText, /\b(?:previous|old|prior|rollback) version\b/) || has(normalizedText, /\b(?:previous|old) release\b/);
  const directContradiction = has(normalizedText, /(?:errors|failures|failing).*(?:previous|old|prior|rollback) version|(?:previous|old|prior|rollback) version.*(?:errors|failures|failing)|(?:previous|old|prior) release.*(?:same|errors|failures)|same (?:checkout )?(?:issue|errors|failures)/);
  const positiveConfirmation = has(normalizedText, /^(?:yes|correct|that's right|that is right|confirmed)\b/) || has(normalizedText, /(?:errors|failures|failing).*(?:there|too|also)|(?:there|too|also).*(?:errors|failures|failing)/);
  const negativeConfirmation = has(normalizedText, /^(?:no|no they (?:are not|aren't)|that's not what i said|that is not what i said)\b/) || has(normalizedText, /(?:previous|old|prior) version.*(?:fine|healthy|normal|okay|ok)/);
  const deployment = data.hypotheses.find(item => item.id === 'deployment');
  const activeDeployment = deployment && (deployment.status === 'unconfirmed' || deployment.status === 'active');
  const impact = has(normalizedText, /(?:checkout|payments?).*(?:failures|errors|failing)|(?:failures|errors).*(?:checkout|payments?)/) || has(normalizedText, /customers?.*(?:cannot|can not|can['’]?t|cant|unable).*(?:checkout|complete (?:a )?payment)|checkout.*(?:cannot|can not|can['’]?t|cant|unable)/);
  const timing = has(normalizedText, /(?:deployment|release|version).*(?:before|preceded|shortly before|prior to|after).*(?:spike|errors|failures|incident)|(?:spike|errors|failures|incident).*(?:after|before|following).*(?:deployment|release|version)/);
  const db = has(normalizedText, /(?:database|db).*(?:normal|healthy|fine|succeeding|no saturation)|(?:normal|healthy|fine|succeeding).*(?:database|db)|database.*metrics.*(?:normal|healthy|fine)/);
  const actionText = normalizeActionText(normalizedText);
  const question = normalizedText.endsWith('?') || /^(what|why|which|how|is|are|could|can|does|did|should we)\b/.test(normalizedText);
  const decision = has(normalizedText, /\b(?:approve|approved|decided|decision|proceed|declare|we will)\b/) && has(normalizedText, /rollback|roll back|p[123]|incident/);
  const actionVerb = has(actionText, /\b(?:investigate|check|monitor|prepare|inspect|verify|compare|review|rollback|roll back)\b/);
  const commandSignal = has(actionText, /\b(?:let'?s|let us|please|we should|we need to|i'll|i will|can you|someone)\b/) || /^(?:prepare|investigate|monitor|inspect|verify|review|compare|check|rollback|roll back)\b/.test(actionText);
  const isolatedRollback = /^rollback(?:\s+only)?[.!?]*$/.test(actionText);
  const action = !question && !isolatedRollback && actionVerb && commandSignal;
  const hypothesis = has(normalizedText, /\b(?:may|might|could|suspect|hypothesis|responsible|caused|causing)\b/) && !question;
  const query = queryKind(normalizedText);
  const gatewayHypothesis = /\b(?:payment\s+gateway|gateway)\b/.test(normalizedText) && hypothesis && /\b(?:caus(?:e|ing)|responsible|related)\b/.test(normalizedText);
  const rootCauseUnknown = /\b(?:root cause|cause)\b.*\b(?:unknown|unconfirmed|not established|hasn't been established|not known)\b|\b(?:we do not|we don't) know the root cause\b/.test(normalizedText);
  const statusConstraint = /\bdo not declare (?:the )?incident resolved\b|\bdo not mark (?:the )?incident resolved\b/.test(normalizedText);

  if (version && negativeConfirmation && !data.clarification) {
    add(data.facts, make(`previous-version-negative-${turnId}`, originalText, 'reported', 'fact'));
    return finish(data, 'Previous-version health report recorded. No contradictory evidence was added.');
  }
  const clarificationActive = data.clarification?.kind === 'previous-version' && Date.now() - Date.parse(data.clarification.askedAt) <= 120_000;
  if (!clarificationActive && data.clarification) data.clarification = undefined;
  if (clarificationActive && (positiveConfirmation || negativeConfirmation)) {
    if (negativeConfirmation) {
      if (version) add(data.facts, make(`previous-version-negative-${turnId}`, originalText, 'reported', 'fact'));
      data.clarification = undefined;
      return finish(data, version ? 'Previous-version health report recorded. No contradictory evidence was added.' : 'Clarification noted. No contradictory evidence was added.');
    }
    add(data.facts, make(`previous-version-confirmed-${turnId}`, originalText, 'reported', 'fact'));
    if (deployment) { deployment.status = 'disputed'; deployment.evidence ??= []; deployment.evidence.push(`Confirmed previous-version failures: ${originalText}`); add(data.conflicts, make(`deployment-conflict-${turnId}`, 'Failures on the previous version weaken a deployment-only explanation.', 'disputed', 'contradiction')); }
    data.clarification = undefined;
    return finish(data, 'New evidence weakens the deployment hypothesis. Root cause remains unconfirmed.');
  }
  if (directContradiction) {
    add(data.facts, make(`previous-version-${turnId}`, originalText, 'reported', 'fact'));
    if (deployment) { deployment.status = 'disputed'; deployment.evidence ??= []; if (!deployment.evidence.includes(`Contradicting report: ${originalText}`)) deployment.evidence.push(`Contradicting report: ${originalText}`); add(data.conflicts, make(`deployment-conflict-${turnId}`, 'Failures on the previous version weaken a deployment-only explanation.', 'disputed', 'contradiction')); }
    data.clarification = undefined;
    return finish(data, 'New evidence weakens the deployment hypothesis. Root cause remains unconfirmed.');
  }
  // Queries are handled before observations so a question can never become a fact.
  if (query) { add(data.questions, make(`query-${turnId}`, originalText, 'unresolved', 'question')); return finish(data, stateQueryResponse(data, query, incidentStatus, normalizedText)); }
  // An explicit operational command takes precedence over an otherwise ambiguous version reference.
  if (action) { const text = actionSummary(actionText); add(data.actions, { ...make(`action-${turnId}`, originalText, 'pending', 'action'), text }); return finish(data, `Action recorded: ${text}.`); }
  if (version) {
    add(data.facts, make(`previous-version-ambiguous-${turnId}`, originalText, 'reported', 'fact'));
    const clarification = 'Are you reporting that the failures also occur on the previous version?';
    add(data.questions, make(`previous-version-question-${turnId}`, clarification, 'unresolved', 'question', [originalText]));
    data.clarification = { kind: 'previous-version', question: clarification, askedAt: timestamp, sourceText: originalText };
    return finish(data, `I heard a reference to the previous version. ${clarification}`);
  }
  if (decision) { add(data.decisions, make(`decision-${turnId}`, originalText, 'recorded', 'decision')); return finish(data, 'Decision recorded. This is a mitigation decision; root cause remains unconfirmed.'); }
  if (question) { add(data.questions, make(`question-${turnId}`, originalText, 'unresolved', 'question')); const currentDeployment = data.hypotheses.find(item => item.id === 'deployment'); return finish(data, currentDeployment ? `Current evidence does not establish a root cause. ${deploymentStateText(currentDeployment)}` : 'Current evidence does not establish a root cause. Investigation remains open.'); }
  if (statusConstraint) { add(data.questions, make(`status-constraint-${turnId}`, originalText, 'unresolved', 'question')); return finish(data, 'The incident remains open.'); }
  if (rootCauseUnknown) { add(data.questions, make(`root-cause-unknown-report-${turnId}`, originalText, 'unresolved', 'question')); return finish(data, 'Root cause remains unknown. Investigation remains open.'); }
  if (gatewayHypothesis) { const gateway = make('payment-gateway', 'The payment gateway may be associated with the failures; evidence is not yet sufficient to establish causation.', 'unconfirmed', 'hypothesis', [originalText]); add(data.hypotheses, gateway); return finish(data, 'The payment gateway is an unconfirmed hypothesis. Current evidence does not establish it as the root cause.'); }
  if (timing || hypothesis && has(normalizedText, /deployment|release|version/)) { add(data.facts, make(`timing-${turnId}`, originalText, 'reported', 'fact')); let h = data.hypotheses.find(item => item.id === 'deployment'); if (!h) { h = make('deployment', 'The deployment may be associated with the failures; timing does not establish causation.', 'unconfirmed', 'hypothesis', []); add(data.hypotheses, h); } h.evidence ??= []; if (!h.evidence.includes(originalText)) h.evidence.push(originalText); return finish(data, deploymentStateText(h)); }
  if (db) { add(data.facts, make(`database-${turnId}`, originalText, 'reported', 'fact')); add(data.questions, make('database-scope', 'Do database observations cover failing requests and the affected time window?', 'unresolved', 'question', [])); const currentDeployment = data.hypotheses.find(item => item.id === 'deployment'); const deploymentContext = currentDeployment?.status === 'disputed' ? 'The deployment hypothesis remains disputed. Root cause remains unconfirmed.' : currentDeployment ? 'The deployment remains an active hypothesis, not a confirmed cause.' : 'Root cause remains unconfirmed.'; return finish(data, `Database health evidence recorded. ${deploymentContext}`); }
  if (impact) { const metric = metricChange(normalizedText, 'percent'); const value = metric?.current ?? Number(normalizedText.match(/\b(\d+(?:\.\d+)?)\s*percent\b/)?.[1]); const claim = make(`impact-${turnId}`, originalText, 'reported', 'fact'); if (Number.isFinite(value)) claim.metric = { ...metric, current: value, unit: 'percent' }; add(data.facts, claim); add(data.risks, make('checkout-impact', 'Checkout failures may prevent customers from completing purchases; scope remains under investigation.', 'unconfirmed', 'risk')); const change = metric?.previous !== undefined && metric.direction ? `Checkout failures ${metric.direction === 'decrease' ? 'decreased' : 'increased'} from approximately ${metric.previous}% to ${metric.current}%. Root cause remains unconfirmed.` : value ? `Checkout impact recorded at approximately ${value}%. Root cause remains unconfirmed.` : 'Checkout failures recorded. Scope and root cause remain under investigation.'; return finish(data, change); }
  if (has(normalizedText, /\b(?:latency|response time)\b/) || has(normalizedText, /\b(?:cpu|utilization)\b.*\b\d+(?:\.\d+)?\s*percent\b/)) { const metric = metricChange(normalizedText, 'milliseconds?|ms|seconds?'); const claim = make(`observation-${turnId}`, originalText, 'reported', 'fact'); const value = metric?.current !== undefined ? metric.current : Number(normalizedText.match(/\b\d+(?:\.\d+)?\s*(?:milliseconds?|ms|seconds?)\b/)?.[0]); const cpu = normalizedText.match(/\b(\d+(?:\.\d+)?)\s*percent\b/)?.[1]; if (Number.isFinite(value)) claim.metric = { ...metric, current: value, unit: /seconds?\b/.test(normalizedText) ? 'seconds' : 'milliseconds' }; add(data.facts, claim); const change = metric?.previous !== undefined && metric.direction ? `Latency ${metric.direction === 'decrease' ? 'decreased' : 'increased'} from ${metric.previous} to ${metric.current} milliseconds.` : Number.isFinite(value) ? `Latency increase recorded at ${value} milliseconds.` : cpu ? `CPU utilization report recorded at ${cpu}%.` : `Observation recorded: ${short(originalText)}.`; return finish(data, change); }
  if (has(normalizedText, /\b(?:create|change it to|notify)\b/)) return finish(data, '');
  add(hypothesis ? data.hypotheses : data.facts, make(`${hypothesis ? 'hypothesis' : 'observation'}-${turnId}`, originalText, hypothesis ? 'unconfirmed' : 'reported', hypothesis ? 'hypothesis' : 'fact'));
  return finish(data, hypothesis ? 'Hypothesis recorded as unconfirmed.' : `Observation recorded: ${short(originalText)}.`);
}
