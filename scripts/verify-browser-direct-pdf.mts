import fs from 'node:fs';
import assert from 'node:assert/strict';
import { command } from '../server/src/engine.ts';
import { liveIntelligence } from '../client/src/lib/model.ts';
import { generateSummary } from '../client/src/lib/summary.ts';
import { createPdfReport } from '../client/src/lib/pdfSummary.ts';
import mupdf from '../client/tmp/pdf-qa/node_modules/mupdf/dist/mupdf.js';

let result;
for (const [index, text] of ["We're seeing checkout failures above forty percent.", 'The deployment finished about ten minutes before the spike.', 'Database CPU and connection counts look normal.', 'Wait - errors are also occurring on the previous version.'].entries()) {
  result = await command('pdf-current-scenario', `turn-${index}`, text);
}
const session = result!.session;
const report = generateSummary(session, liveIntelligence(session), false);
const font = new Uint8Array(fs.readFileSync('client/public/fonts/ResQVoiceReport.ttf'));
const pdf = createPdfReport(report, session.incident?.id, font);
const bytes = new Uint8Array(pdf.output('arraybuffer'));
assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
fs.mkdirSync('output/pdf', { recursive: true }); fs.mkdirSync('tmp/pdfs/browser-direct', { recursive: true });
fs.writeFileSync('output/pdf/browser-direct-current-incident.pdf', bytes);
const document = mupdf.Document.openDocument(bytes, 'application/pdf');
let text = '';
for (let index = 0; index < document.countPages(); index++) {
  const page = document.loadPage(index);
  text += page.toStructuredText('preserve-whitespace').asText();
  fs.writeFileSync(`tmp/pdfs/browser-direct/page-${index + 1}.png`, page.toPixmap(mupdf.Matrix.scale(1.1, 1.1), mupdf.ColorSpace.DeviceRGB, false).asPNG());
}
const normalized = text.replace(/\s+/g, ' ');
for (const expected of ['forty percent', 'previous version', 'disputed', 'Root cause remains unconfirmed.', 'Risks', 'Contradictions / Disputed Claims']) assert.ok(normalized.includes(expected), expected);
assert.ok(!normalized.includes('DEMO DATA'));
console.log(`PASS: current live scenario PDF, ${document.countPages()} rendered pages, ${bytes.length} bytes; contradiction and uncertainty retained`);
