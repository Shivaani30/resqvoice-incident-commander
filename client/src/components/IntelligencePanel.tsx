import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Claim } from '../lib/model';
import { time } from '../lib/model';
export function Panel({ title, kicker, children, className = '' }: {
    title: string;
    kicker?: string;
    children: ReactNode;
    className?: string;
}) { return <section className={`panel ${className}`}><div className="panel-heading"><h2>{title}</h2>{kicker && <span className="eyebrow">{kicker}</span>}</div>{children}</section>; }
export function Copy({ text }: {
    text: string;
}) { const [state, setState] = useState('Copy'); return <button className="copy" aria-label={`${state}: ${text}`} onClick={() => navigator.clipboard.writeText(text).then(() => setState('Copied')).catch(() => setState('Copy failed'))}>{state}</button>; }
export function Claims({ items, empty }: {
    items: Claim[];
    empty: string;
}) { return <div className="claims">{items.length ? items.map(c => <article className={`claim ${c.status}`} key={c.id}><div className="claim-top"><span className={`tag ${c.status}`}>{c.status}</span><span>{time(c.timestamp)}</span></div><p>{c.text}</p>{(c.owner || c.source) && <small>{c.owner ? `Owner: ${c.owner}` : c.source}{c.priority && `  /  ${c.priority} priority`}</small>}{c.evidence?.length ? <details><summary>{c.evidence.length} evidence item{c.evidence.length > 1 ? 's' : ''}</summary>{c.evidence.map(e => <p className="evidence" key={e}>{e}</p>)}</details> : null}<Copy text={c.text}/></article>) : <p className="empty">{empty}</p>}</div>; }
