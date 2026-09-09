import { useState } from 'react';
import type { Claim, Intelligence, Session } from '../lib/model';
import { time } from '../lib/model';
import { Copy, Claims } from './IntelligencePanel';
import { generateSummary } from '../lib/summary';
import { SummaryDownloadButton } from './SummaryDownloadButton';
export function Overview({ data, session, navigate }: {
    data: Intelligence;
    session: Session;
    navigate: (page: string) => void;
}) {
    const pending = data.actions.filter(c => c.status === 'pending');
    const shortcuts = [
        { label: 'Established Information', count: data.facts.length, note: 'Reported observations', target: 'intelligence/Established' },
        { label: 'Open Questions', count: data.questions.length, note: 'Unresolved investigation', target: 'intelligence/Open%20Questions' },
        { label: 'Active Hypotheses', count: data.hypotheses.filter(c => c.status === 'unconfirmed' || c.status === 'disputed').length, note: 'Not confirmed as facts', target: 'intelligence/Hypotheses' },
        { label: 'Pending Actions', count: pending.length, note: 'Awaiting an update', target: 'actions' },
        { label: 'Contradictions', count: data.conflicts.filter(c => c.status !== 'resolved').length, note: 'Conflicting information', target: 'intelligence/Contradictions' },
        { label: 'Participants', count: data.participants.length || 'Not provided', note: data.participants.length ? 'Recorded responders' : 'Metadata not provided', target: 'voice' }
    ];
    return <><section className="overview-state"><span className="eyebrow accent">CURRENT INCIDENT STATE</span><h2>{data.snapshot}</h2><Copy text={data.snapshot}/><dl className="state-details"><div><dt>Severity</dt><dd>{session.incident?.severity ?? 'Not recorded'}</dd></div><div><dt>Status</dt><dd>{session.incident?.status ?? 'Standby'}</dd></div><div><dt>Root cause</dt><dd>Unconfirmed</dd></div><div><dt>Next recorded action</dt><dd>{pending[0]?.text ?? 'No pending action recorded'}</dd></div></dl></section><div className="overview-shortcuts" aria-label="Incident workspace shortcuts">{shortcuts.map(item => <a className="summary-shortcut" href={`#${item.target}`} key={item.label}><span className="shortcut-label">{item.label}</span><strong>{item.count}</strong><small>{item.note}</small><span className="shortcut-arrow" aria-hidden="true">&#8599;</span></a>)}</div><div className="brief-split knowledge-cards"><section><h2>What We Know</h2><Brief items={data.facts.slice(0, 3)} empty="No observations recorded."/></section><section><h2>What We Don't Know</h2><Brief items={[...data.questions, ...data.hypotheses.filter(c => c.status === 'unconfirmed')].slice(0, 3)} empty="Root cause remains unconfirmed."/></section></div><div className="brief-split"><section><div className="section-title"><h2>Critical Actions</h2><button className="text-button" onClick={() => navigate('actions')}>All actions</button></div><Brief items={pending.slice(0, 3)} empty="No pending actions recorded."/><h3>Latest Decision</h3><Brief items={data.decisions.slice(-1)} empty="No decisions recorded."/></section><section><div className="section-title"><h2>Active Contradictions</h2><button className="text-button" onClick={() => navigate('intelligence/Contradictions')}>Inspect intelligence</button></div><Brief items={data.conflicts.slice(0, 2)} empty="No active contradictions recorded."/><h3>Recent Timeline</h3>{session.events.slice(-3).map(e => <p className="brief-event" key={e.id}><time>{time(e.timestamp)}</time>{e.message}</p>)}{!session.events.length && <p className="empty">No incident events yet.</p>}</section></div></>;
}
function Brief({ items, empty }: {
    items: Claim[];
    empty: string;
}) { return items.length ? <ul className="brief-list">{items.map(c => <li key={c.id}>{c.text}<small>{c.status}{c.owner && ` / ${c.owner}`}</small></li>)}</ul> : <p className="empty">{empty}</p>; }
export function IntelligenceWorkspace({ data, initialTab = 'Established', onTab }: {
    data: Intelligence;
    initialTab?: string;
    onTab?: (tab: string) => void;
}) {
    const [tab, setTab] = useState(['Established', 'Hypotheses', 'Open Questions', 'Evidence', 'Contradictions'].includes(initialTab) ? initialTab : 'Established'), [selected, setSelected] = useState<string | null>(null), [query, setQuery] = useState('');
    const groups: Record<string, Claim[]> = { Established: data.facts, Hypotheses: data.hypotheses, 'Open Questions': data.questions, Evidence: [...data.facts, ...data.hypotheses, ...data.decisions].filter(c => c.evidence?.length), Contradictions: data.conflicts };
    const items = groups[tab].filter(c => (c.text + ' ' + c.status + ' ' + (c.source ?? '')).toLowerCase().includes(query.toLowerCase()));
    const claim = items.find(c => c.id === selected) ?? items[0];
    return <><div className="workspace-tabs" aria-label="Intelligence sections">{Object.entries(groups).map(([name, items]) => <button key={name} aria-pressed={tab === name} className={tab === name ? 'active' : ''} onClick={() => { setTab(name); setSelected(null); onTab?.(name); }}>{name}<span>{items.length}</span></button>)}</div><label className="search-label">Search {tab.toLowerCase()}<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search claims, sources or status"/></label><div className="master-detail"><section className="claim-master" aria-label={tab}><h2>{tab === 'Established' ? 'Established Information' : tab}</h2><p className="subtitle">{tab === 'Established' ? 'Reported observations; inspect source and evidence before confirming.' : 'Select a row to inspect the recorded context.'}</p>{items.map(c => <button key={c.id} className={`claim-select ${claim?.id === c.id ? 'active' : ''}`} aria-pressed={claim?.id === c.id} onClick={() => setSelected(c.id)}><span>{c.text}</span><small>{c.status} / {time(c.timestamp)}</small></button>)}{!items.length && <p className="empty">{query ? 'No matching records.' : 'No information recorded in this section.'}</p>}</section><aside className={`claim-detail selected-claim ${tab === 'Contradictions' ? 'conflict-detail' : ''}`}><span className="eyebrow">CONTEXT & EVIDENCE</span>{claim ? <><h2>{claim.text}</h2><dl><dt>Claim state</dt><dd><span className={`tag ${claim.status}`}>{claim.status}</span></dd><dt>Source</dt><dd>{claim.source ?? 'Not recorded'}</dd><dt>Timestamp</dt><dd>{claim.timestamp ?? 'Not recorded'}</dd></dl><h3>Evidence</h3>{claim.evidence?.length ? <ul>{claim.evidence.map(e => <li key={e}>{e}</li>)}</ul> : <p className="empty">No evidence attached.</p>}<Copy text={claim.text}/></> : <p className="empty">Select a claim when information becomes available.</p>}</aside></div></>;
}
export function ActionsWorkspace({ data }: {
    data: Intelligence;
}) {
    const [query, setQuery] = useState('');
    const actions = data.actions.filter(a => (a.text + ' ' + a.owner + ' ' + a.status).toLowerCase().includes(query.toLowerCase()));
    return <><label className="search-label">Search actions<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Action, owner or status"/></label><div className="table-scroll"><table><thead><tr><th>Action</th><th>Owner</th><th>Priority</th><th>Status</th><th>Recorded</th></tr></thead><tbody>{actions.map(a => <tr key={a.id}><td>{a.text}<Copy text={a.text}/></td><td>{a.owner ?? 'Not recorded'}</td><td>{a.priority ?? 'Not recorded'}</td><td><span className={`tag ${a.status}`}>{a.status}</span></td><td>{time(a.timestamp)}</td></tr>)}</tbody></table>{!actions.length && <p className="empty">No matching actions recorded.</p>}</div><section className="record-section"><h2>Decisions</h2><Claims items={data.decisions} empty="No decisions recorded."/></section><section className="record-section"><h2>Needs Follow-up</h2><p className="subtitle">Pending actions appear above. Unresolved questions requiring investigation:</p><Brief items={data.questions} empty="No unresolved questions recorded."/></section></>;
}
export function TimelineWorkspace({ session }: {
    session: Session;
}) {
    const [filter, setFilter] = useState('All'), [query, setQuery] = useState('');
    const events = [...session.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).filter(e => (filter === 'All' || filter === e.type) && e.message.toLowerCase().includes(query.toLowerCase()));
    return <><div className="workspace-tabs">{['All', ...new Set(session.events.map(e => e.type))].map(type => <button key={type} className={filter === type ? 'active' : ''} aria-pressed={filter === type} onClick={() => setFilter(type)}>{type.replaceAll('_', ' ')}</button>)}</div><label className="search-label">Search timeline<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find an incident event"/></label><div className="timeline full-timeline">{events.map(e => <article key={e.id}><time>{time(e.timestamp)}</time><div><span className="eyebrow">{e.type.replaceAll('_', ' ')} / {e.status}</span><p>{e.message}</p></div></article>)}{!events.length && <p className="empty">No matching events recorded.</p>}</div></>;
}
export function SummaryWorkspace({ session, data, demo }: {
    session: Session;
    data: Intelligence;
    demo: boolean;
}) {
    const summary = generateSummary(session, data, demo);
    const sections = summary.split(/(?=^## )/m);
    return <><div className="report-toolbar"><p>Review the current incident record. The PDF uses this content with a print-friendly layout.</p><SummaryDownloadButton session={session} data={data} demo={demo} reportText={summary}/></div><article className="report-preview">{sections.map((section, sectionIndex) => {
            const title = section.split('\n')[0].replace(/^## /, '');
            const elevated = ['Executive Summary', 'Incident Details', 'Current Incident State'].includes(title);
            return <section className={elevated ? 'report-section report-highlight' : 'report-section'} key={sectionIndex}>{section.split('\n').map((line, index) => line.startsWith('# ') ? <h2 key={index}>{line.slice(2)}</h2> : line.startsWith('## ') ? <h3 key={index}>{line.slice(3)}</h3> : line.trim().startsWith('- ') ? <p key={index} className={line.startsWith('  ') ? 'report-detail' : 'report-item'}>{line.trim().slice(2)}</p> : line ? <p key={index}>{line}</p> : null)}</section>;
        })}</article></>;
}
