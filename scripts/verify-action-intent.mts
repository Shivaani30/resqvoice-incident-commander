import assert from 'node:assert/strict';
import { emptyIntelligence, observe } from '../server/src/intelligence.ts';

const actionInputs = [
  "Let's investigate the payment gateway.",
  "let's investigat the payment gateway",
  "let's investigatti payment gateway",
  "let's navigate to sorry let investigat the payment gateway",
  'Please check payment logs.',
  'We should monitor checkout failures.',
  "I'll verify database connections.",
  "Let's compare the previous version.",
  'Prepare a rollback.',
];
for (const [index, input] of actionInputs.entries()) {
  const intelligence = emptyIntelligence();
  const spoken = observe(intelligence, input, `action-${index}`, new Date().toISOString());
  assert.equal(intelligence.actions.length, 1, input);
  assert.equal(intelligence.actions[0].kind, 'action');
  assert.equal(intelligence.actions[0].status, 'pending');
  assert.equal(intelligence.actions[0].originalText, input);
  assert.match(spoken, /^Action recorded:/, input);
}

for (const [index, input] of [
  'The payment gateway is failing.',
  'The payment gateway might be failing.',
  'Something about the payment gateway.',
].entries()) {
  const intelligence = emptyIntelligence();
  observe(intelligence, input, `non-action-${index}`, new Date().toISOString());
  assert.equal(intelligence.actions.length, 0, input);
}
const question = emptyIntelligence();
observe(question, 'Should we investigate the payment gateway?', 'question', new Date().toISOString());
assert.equal(question.actions.length, 0);
assert.equal(question.questions.some(item => item.originalText === 'Should we investigate the payment gateway?'), true);
console.log('PASS: bounded noisy action variants, provenance, and false-positive safeguards');
