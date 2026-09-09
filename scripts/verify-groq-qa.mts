import assert from 'node:assert/strict';
import { classifyRoute, answerStateQuery, answerWithLLM, buildIncidentContext } from '../server/src/qa.ts';
import { emptyIntelligence, observe } from '../server/src/intelligence.ts';
import { command, getSession, interrupt } from '../server/src/engine.ts';

assert.equal(classifyRoute('What is a rollback?'), 'GENERAL_KNOWLEDGE');
assert.equal(classifyRoute('Explain circuit breaking.'), 'GENERAL_KNOWLEDGE');
assert.equal(classifyRoute('What should we investigate next?'), 'INCIDENT_ANALYSIS');
assert.equal(classifyRoute('Investigate the payment gateway.'), 'ACTION');
assert.equal(classifyRoute('What do we know so far?'), 'STATE_QUERY');
assert.equal(classifyRoute('The deployment definitely caused the outage, right?'), 'STATE_QUERY');
assert.equal(classifyRoute('Errors are also occurring on the previous version.'), 'INCIDENT_STATEMENT');

const state = emptyIntelligence();
observe(state, 'The deployment finished before the spike.', 'one', new Date().toISOString());
observe(state, 'Errors are also occurring on the previous version.', 'two', new Date().toISOString());
const before = JSON.stringify(state);
assert.match(answerStateQuery('What do we know so far?', state), /previous|deployment|root cause/i);
assert.equal(JSON.stringify(state), before, 'state query must not mutate intelligence');
assert.match(buildIncidentContext(state, null).contradictions.join(' '), /deployment/i);

delete process.env.LLM_PROVIDER; delete process.env.LLM_ENDPOINT; delete process.env.LLM_API_KEY; delete process.env.LLM_MODEL;
const fallback = await answerWithLLM('What is a rollback?', state, null, [], undefined, true);
assert.match(fallback.answer, /unable to answer/i);

process.env.LLM_PROVIDER = 'generic-chat-completions'; process.env.LLM_ENDPOINT = 'https://groq.test/openai/v1/chat/completions'; process.env.LLM_API_KEY = 'test-key'; process.env.LLM_MODEL = 'openai/gpt-oss-120b';
let received = '';
globalThis.fetch = (async (_input: string | URL, options?: RequestInit) => { received = String(options?.body ?? ''); return Response.json({ choices: [{ message: { content: JSON.stringify({ answer: 'The deployment definitely caused the outage.', answerType: 'INCIDENT_GROUNDED', confidence: 'HIGH', usesIncidentState: true }) } }] }); }) as typeof fetch;
const unsafe = await answerWithLLM('Why is the deployment disputed?', state, null, []);
assert.match(unsafe.answer, /does not establish|No\./i); assert.match(received, /disputed/);

const sessionId = `qa-${crypto.randomUUID()}`;
const deterministic = await command(sessionId, crypto.randomUUID(), 'What actions are pending?');
assert.match(deterministic.spoken, /No pending actions/);
const statement = await command(sessionId, crypto.randomUUID(), 'Checkout failures are above 40%.');
assert.match(statement.spoken, /Checkout/);

let resolveLLM: (() => void) | undefined;
globalThis.fetch = (async (_input: string | URL, options?: RequestInit) => { await new Promise<void>(resolve => { resolveLLM = resolve; options?.signal?.addEventListener('abort', resolve); }); return Response.json({ choices: [{ message: { content: JSON.stringify({ answer: 'late answer', answerType: 'INCIDENT_GROUNDED', confidence: 'LOW', usesIncidentState: true }) } }] }); }) as typeof fetch;
const pending = command(sessionId, crypto.randomUUID(), 'Why is deployment less likely now?');
await new Promise(resolve => setTimeout(resolve, 10)); interrupt(sessionId); resolveLLM?.(); const result = await pending; assert.equal(result.spoken, '', 'interrupted LLM result must be stale');
console.log('PASS: routing, immutable state queries, Groq-shaped grounding, fallback, and cancellation');
