import assert from 'node:assert/strict';
import { command, getSession } from '../server/src/engine.ts';
import { emptyIntelligence, normalizeSpeech, observe } from '../server/src/intelligence.ts';

const now = new Date().toISOString();
assert.equal(normalizeSpeech('we are seeing check-out failure above 40%'), 'we are seeing checkout failures above 40 percent');
assert.equal(normalizeSpeech('data base errors after the old release'), 'database errors after the previous version');

const run = async (text: string, id = crypto.randomUUID()) => command(id, crypto.randomUUID(), text);
const checkout = await run("We're seeing checkout failures above forty percent.");
assert.ok(checkout.session.intelligence.facts.some(f => f.originalText === "We're seeing checkout failures above forty percent."));
assert.match(checkout.spoken, /approximately 40%/);
assert.match(checkout.spoken, /unconfirmed/);
const variants = ['we are seeing check out failure above 40%', 'checkout failure is about 40 percent', 'check-out errors are around forty percent', 'Payments are failing for roughly forty percent of checkouts.', 'Checkout is failing.', 'Payment failures have reached 42%.', "Customers can't complete checkout."];
for (const text of variants) {
  const result = await run(text);
  assert.ok(result.session.intelligence.facts.some(f => f.originalText === text), text);
  assert.ok(result.session.intelligence.facts.every(f => f.status === 'reported'));
  assert.match(result.spoken, /Checkout|failures recorded/);
}

const sequenceId = 'intelligence-acceptance';
const deployment = await run('The deployment finished ten minutes before the spike.', sequenceId);
assert.equal(deployment.session.intelligence.hypotheses.find(h => h.id === 'deployment')?.status, 'unconfirmed');
assert.match(deployment.spoken, /active hypothesis/);
const deployed = await run('We deployed shortly before the errors.', 'deployment-variant');
assert.equal(deployed.session.intelligence.hypotheses.find(h => h.id === 'deployment')?.status, 'unconfirmed');
const db = await run('Database CPU and connection counts look normal.', sequenceId);
assert.ok(db.session.intelligence.facts.some(f => /Database CPU/.test(f.originalText ?? '')));
assert.match(db.spoken, /Database health evidence recorded/);
const contradiction = await run('Wait, errors are also occurring on the previous version.', sequenceId);
assert.equal(contradiction.session.intelligence.hypotheses.find(h => h.id === 'deployment')?.status, 'disputed');
assert.equal(contradiction.session.intelligence.conflicts.length, 1);
assert.match(contradiction.spoken, /weakens the deployment hypothesis/);
const oldVersion = await run('The old version is failing too.', 'old-version-variant');
assert.equal(oldVersion.session.intelligence.conflicts.length, 0, 'without an existing deployment hypothesis, retain the report but do not invent a contradiction');

const action = await run("Let's investigate the payment gateway.");
assert.equal(action.session.intelligence.actions[0].status, 'pending');
assert.match(action.spoken, /Action recorded/);
const decision = await run('Approve the rollback.');
assert.equal(decision.session.intelligence.decisions[0].status, 'recorded');
assert.match(decision.spoken, /mitigation decision/);
const latency = await run('Latency jumped to 900 milliseconds.');
assert.match(latency.spoken, /900 milliseconds/);
const cpu = await run('CPU reached 95 percent.');
assert.match(cpu.spoken, /95%/);
const question = await run('What caused the outage?');
assert.match(question.spoken, /does not establish a root cause/);
assert.ok(question.session.intelligence.hypotheses.every(h => h.status !== 'confirmed'));

const releaseTiming = emptyIntelligence();
const releaseResponse = observe(releaseTiming, 'The release went out shortly before the failures.', 'direct', now);
assert.equal(releaseTiming.hypotheses[0].status, 'unconfirmed');
assert.equal(releaseTiming.facts[0].originalText, 'The release went out shortly before the failures.');
assert.equal(releaseTiming.facts[0].normalizedText, 'the deployment went out shortly before the failures.');
assert.match(releaseResponse, /active hypothesis/);

const ambiguous = emptyIntelligence();
observe(ambiguous, 'The deployment finished before the spike.', 'setup', now);
const clarificationResponse = observe(ambiguous, 'weight on the previous version', 'ambiguous', now);
assert.equal(ambiguous.hypotheses.find(h => h.id === 'deployment')?.status, 'unconfirmed');
assert.equal(ambiguous.conflicts.length, 0);
assert.ok(ambiguous.clarification?.kind === 'previous-version');
assert.match(clarificationResponse, /Are you reporting that the failures also occur/);
assert.equal(ambiguous.facts.at(-1)?.originalText, 'weight on the previous version');
const confirmedResponse = observe(ambiguous, 'yes, errors are happening there too', 'confirm', now);
assert.equal(ambiguous.hypotheses.find(h => h.id === 'deployment')?.status, 'disputed');
assert.equal(ambiguous.conflicts.length, 1);
assert.equal(ambiguous.clarification, undefined);
assert.match(confirmedResponse, /weakens the deployment hypothesis/);

const direct = emptyIntelligence();
observe(direct, 'The deployment finished before the spike.', 'setup', now);
const directResponse = observe(direct, 'Errors are also occurring on the previous version.', 'direct', now);
assert.equal(direct.hypotheses.find(h => h.id === 'deployment')?.status, 'disputed');
assert.equal(direct.conflicts.length, 1);
assert.equal(direct.clarification, undefined);
assert.match(directResponse, /weakens the deployment hypothesis/);

const negative = emptyIntelligence();
observe(negative, 'The deployment finished before the spike.', 'setup', now);
observe(negative, 'previous version', 'ambiguous', now);
const negativeResponse = observe(negative, 'no they are not', 'negative', now);
assert.equal(negative.hypotheses.find(h => h.id === 'deployment')?.status, 'unconfirmed');
assert.equal(negative.conflicts.length, 0);
assert.equal(negative.clarification, undefined);
assert.match(negativeResponse, /No contradictory evidence/);
const healthy = emptyIntelligence();
observe(healthy, 'The deployment finished before the spike.', 'setup', now);
observe(healthy, 'previous version', 'ambiguous', now);
observe(healthy, 'the previous version is fine', 'healthy', now);
assert.equal(healthy.hypotheses.find(h => h.id === 'deployment')?.status, 'unconfirmed');
assert.equal(healthy.conflicts.length, 0);
assert.equal(healthy.facts.at(-1)?.originalText, 'the previous version is fine');

const noHypothesis = emptyIntelligence();
const noHypothesisResponse = observe(noHypothesis, 'previous version', 'unscoped', now);
assert.equal(noHypothesis.hypotheses.length, 0);
assert.equal(noHypothesis.conflicts.length, 0);
assert.ok(noHypothesis.clarification);
assert.equal(noHypothesis.facts.at(-1)?.originalText, 'previous version');
assert.match(noHypothesisResponse, /Are you reporting/);
console.log('PASS: normalization, checkout variants, deployment timing, database health, contradictions, actions, decisions, metrics, questions, provenance, and uncertainty');
