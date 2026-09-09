import assert from 'node:assert/strict';
import { command, getSession } from '../server/src/engine.ts';

const sessionId = `claim-state-${crypto.randomUUID()}`;
const turn = async (text: string) => command(sessionId, crypto.randomUUID(), text);

const first = await turn('The deployment finished about ten minutes before the spike.');
assert.equal(getSession(sessionId).intelligence.hypotheses.find(item => item.id === 'deployment')?.status, 'unconfirmed');
assert.match(first.spoken, /active hypothesis/);

const second = await turn('Errors are also occurring on the previous version.');
assert.equal(getSession(sessionId).intelligence.hypotheses.find(item => item.id === 'deployment')?.status, 'disputed');
assert.match(second.spoken, /weakens the deployment hypothesis/);
assert.equal(getSession(sessionId).intelligence.conflicts.length, 1);

const third = await turn('Database CPU and connection counts look normal.');
const intelligence = getSession(sessionId).intelligence;
assert.equal(intelligence.hypotheses.find(item => item.id === 'deployment')?.status, 'disputed');
assert.equal(intelligence.conflicts.length, 1);
assert.ok(intelligence.facts.some(item => item.originalText === 'Errors are also occurring on the previous version.'));
assert.equal(third.spoken, 'Database health evidence recorded. The deployment hypothesis remains disputed. Root cause remains unconfirmed.');
assert.match(intelligence.snapshot, /New evidence weakens the deployment hypothesis/);
assert.doesNotMatch(intelligence.snapshot, /deployment remains an active hypothesis/i);
console.log('PASS: three-turn claim state remains disputed and database response reflects current status');
