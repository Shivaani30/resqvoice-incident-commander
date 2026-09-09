import assert from 'node:assert/strict';
import { command, getSession } from '../server/src/engine.js';
import { classifyRoute } from '../server/src/qa.js';
const sid='intervention-test';
let r=await command(sid,'1',"We're seeing checkout failures above forty percent."); assert.equal(r.intervention.shouldSpeak,false); assert.equal(r.spoken,'');
r=await command(sid,'2','The deployment finished about ten minutes before the spike.'); assert.equal(r.intervention.shouldSpeak,false);
r=await command(sid,'3','Database CPU and connection counts look normal.'); assert.equal(r.intervention.shouldSpeak,false);
r=await command(sid,'4','Errors are also occurring on the previous version.'); assert.equal(r.intervention.shouldSpeak,true); assert.equal(r.intervention.reason,'CONTRADICTION');
r=await command(sid,'5','What do we still not know?'); assert.equal(classifyRoute('What do we still not know?'),'STATE_QUERY'); assert.equal(r.intervention.responseMode,'DETERMINISTIC'); assert.match(r.spoken,/root cause/i);
r=await command(sid,'6','What should we investigate next?'); assert.equal(classifyRoute('What should we investigate next?'),'INCIDENT_ANALYSIS'); assert.equal(r.intervention.responseMode,'LLM');
r=await command(sid,'7','Investigate the payment gateway.'); assert.equal(classifyRoute('Investigate the payment gateway.'),'ACTION'); assert.equal(r.intervention.shouldSpeak,false);
r=await command(sid,'8','The deployment definitely caused the outage.'); assert.equal(r.intervention.reason,'ROOT_CAUSE_SAFETY'); assert.match(r.spoken,/not confirmed|isn't confirmed/i);
const s=getSession(sid); assert.equal(s.intelligence.hypotheses.find(h=>h.id==='deployment')?.status,'disputed');
console.log('intervention policy verification passed');

