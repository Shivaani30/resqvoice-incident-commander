import assert from 'node:assert/strict';
import { classifyRoute } from '../server/src/qa.js';
const analysis=['Brief me on the incident.','Give me the short version.','Bring me up to speed.','Assess the situation.','Your assessment of the situation.','Compare our leading theories.','Challenge the current hypothesis.','Recommend our next investigation step.','Prioritize what the team should check.','Prepare a handoff for the next engineer.','Separate facts from assumptions.','Tell me if the evidence is strong enough.','Can we rule out the database?','Is the incident getting better?','ResQVoice, brief me.'];
for(const text of analysis) assert.equal(classifyRoute(text),'INCIDENT_ANALYSIS',text);
assert.equal(classifyRoute('Investigate the gateway.'),'ACTION'); assert.equal(classifyRoute('Check the payment logs.'),'ACTION'); assert.equal(classifyRoute('Prepare a rollback.'),'ACTION'); assert.equal(classifyRoute('Approve rollback.'),'DECISION');
for(const text of ['Database latency is normal.','Latency jumped again.','The gateway might be responsible.']) assert.equal(classifyRoute(text),'INCIDENT_STATEMENT',text);
console.log('request intent verification passed');
