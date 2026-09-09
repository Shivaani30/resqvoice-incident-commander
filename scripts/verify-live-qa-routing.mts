import assert from 'node:assert/strict';
import { classifyRoute } from '../server/src/qa.ts';
import { command, getSession } from '../server/src/engine.ts';

assert.equal(classifyRoute('What do we still not know?'), 'STATE_QUERY');
assert.equal(classifyRoute("What don't we know yet?"), 'STATE_QUERY');
assert.equal(classifyRoute('Give me your assessment of the most likely cause and what we should investigate next.'), 'INCIDENT_ANALYSIS');
assert.equal(classifyRoute('What should we investigate next?'), 'INCIDENT_ANALYSIS');
assert.equal(classifyRoute('Investigate the payment gateway.'), 'ACTION');
assert.equal(classifyRoute('What should we check next?'), 'INCIDENT_ANALYSIS');
assert.equal(classifyRoute('Check the payment logs.'), 'ACTION');
assert.equal(classifyRoute('Is the incident resolved?'), 'STATE_QUERY');
assert.equal(classifyRoute('the incident rassol'), 'STATUS_CLARIFICATION');
assert.equal(classifyRoute('What evidence would strengthen the deployment hypothesis?'), 'INCIDENT_ANALYSIS');

process.env.LLM_PROVIDER = 'generic-chat-completions'; process.env.LLM_ENDPOINT = 'https://groq.test/openai/v1/chat/completions'; process.env.LLM_API_KEY = 'test-key'; process.env.LLM_MODEL = 'openai/gpt-oss-120b';
let calls = 0;
globalThis.fetch = (async (_input: string | URL, _options?: RequestInit) => { calls++; return Response.json({ choices: [{ message: { content: JSON.stringify({ answer: 'Assessment grounded in the current incident evidence.', answerType: 'INCIDENT_GROUNDED', confidence: 'MEDIUM', usesIncidentState: true }) } }] }); }) as typeof fetch;

const sessionId = `live-qa-${crypto.randomUUID()}`;
await command(sessionId, crypto.randomUUID(), 'The deployment finished before the spike.');
await command(sessionId, crypto.randomUUID(), 'Errors are also occurring on the previous version.');
const beforeQuery = JSON.stringify(getSession(sessionId).intelligence);
const unknown = await command(sessionId, crypto.randomUUID(), 'What do we still not know?');
assert.match(unknown.spoken, /confirmed root cause|disputed/i); assert.equal(JSON.stringify(getSession(sessionId).intelligence), beforeQuery);
const analysis = await command(sessionId, crypto.randomUUID(), 'Give me your assessment of the most likely cause and what we should investigate next.');
assert.match(analysis.spoken, /Assessment/); assert.equal(calls, 1); assert.equal(JSON.stringify(getSession(sessionId).intelligence), beforeQuery);
const action = await command(sessionId, crypto.randomUUID(), 'Investigate the payment gateway.'); assert.match(action.spoken, /Action recorded/); assert.equal(getSession(sessionId).intelligence.actions.length, 1);
const clarification = await command(sessionId, crypto.randomUUID(), 'the incident rassol'); assert.match(clarification.spoken, /Did you mean/); assert.equal(getSession(sessionId).intelligence.actions.length, 1); assert.equal(getSession(sessionId).incident?.status, undefined);
const resolved = await command(sessionId, crypto.randomUUID(), 'Yes, mark it resolved.'); assert.match(resolved.spoken, /marked resolved/); assert.equal(getSession(sessionId).incident?.status, undefined);
// No incident record existed in this isolated sequence, so confirmation cannot fabricate one.
const incidentId = `live-status-${crypto.randomUUID()}`;
await command(incidentId, crypto.randomUUID(), 'We are seeing checkout failures above 40%.');
await command(incidentId, crypto.randomUUID(), 'the incident rassol');
await command(incidentId, crypto.randomUUID(), 'Yes, mark it resolved.');
assert.equal(getSession(incidentId).incident?.status, 'Resolved');
console.log('PASS: live state-query routing, analysis-vs-action precedence, ambiguous status clarification, and confirmation safety');
