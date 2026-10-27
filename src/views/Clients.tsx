import { useMemo, useState } from 'react';
import { useEditor } from '../components/Editor';
import { Kanban } from '../components/Kanban';
import { Avatar, Icon } from '../components/ui';
import { OFFERS } from '../lib/config';
import { useData } from '../lib/data';
import { fmtMoney, newClient } from '../lib/factory';
import { fmtDate, todayIn } from '../lib/time';
import type { Client, Offer } from '../lib/types';
import { useConfig } from '../lib/useConfig';

export function Clients() {
  const { db, me, save } = useData();
  const open = useEditor();
  const [offer, setOffer] = useState<Offer>('business');
  const cfg = useConfig();
  const today = todayIn(cfg.memberOf(me)?.tz ?? cfg.team[0].tz);
  const stages = cfg.stages[offer];
  const team = cfg.team;

  const list = useMemo(() => db.clients.filter((c) => c.offer === offer), [db.clients, offer]);

  const stats = useMemo(() => {
    const stage = (c: Client) => stages.find((s) => s.id === c.stage);
    const active = list.filter((c) => stage(c)?.won && !stage(c)?.closed);
    const pipeline = list.filter((c) => !stage(c)?.won && !stage(c)?.closed);
    const load = team.map((m) => ({ name: m.name, n: active.filter((c) => c.csm === m.name).length }));
    return {
      active: active.length,
      won: active.reduce((s, c) => s + c.setup_value, 0),
      mrr: active.reduce((s, c) => s + c.monthly, 0),
      pipe: pipeline.reduce((s, c) => s + c.setup_value, 0),
      pipeN: pipeline.length,
      load,
    };
  }, [list, stages, team]);

  return (
    <div className="page page-wide">
      <header className="page-head">
        <div>
          <h1>Clients</h1>
          <p className="sub">Business builds and high ticket agency students, from first call to live.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'client', isNew: true, row: newClient(offer, stages[0].id, { csm: me }) })}>
          <Icon name="plus" size={16} /> New client
        </button>
      </header>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Offer">
          {OFFERS.map((o) => (
            <button key={o.id} type="button" role="tab" aria-selected={offer === o.id} className={offer === o.id ? 'is-on' : ''} onClick={() => setOffer(o.id)}>
              {o.label}
              <span className="chip-n">{db.clients.filter((c) => c.offer === o.id).length}</span>
            </button>
          ))}
        </div>
      </div>

      <dl className="stats">
        <div>
          <dt>Active</dt>
          <dd>{stats.active}</dd>
        </div>
        <div>
          <dt>{offer === 'agency' ? 'Program revenue' : 'Setup won'}</dt>
          <dd>{fmtMoney(stats.won)}</dd>
        </div>
        <div>
          <dt>Monthly retainers</dt>
          <dd>{fmtMoney(stats.mrr)}</dd>
        </div>
        {offer === 'business' && (
          <div>
            <dt>In pipeline</dt>
            <dd>
              {fmtMoney(stats.pipe)} <small>{stats.pipeN} {stats.pipeN === 1 ? 'deal' : 'deals'}</small>
            </dd>
          </div>
        )}
        <div>
          <dt>CSM load</dt>
          <dd className="load">
            {stats.load.map((l) => (
              <span key={l.name}>
                <Avatar name={l.name} size={18} /> {l.n}
              </span>
            ))}
          </dd>
        </div>
      </dl>

      <Kanban<Client>
        label="Client pipeline"
        columns={stages}
        items={list}
        columnOf={(c) => (stages.some((s) => s.id === c.stage) ? c.stage : stages[0].id)}
        onMove={(c, stage) => save('clients', { ...c, stage })}
        onOpen={(c) => open({ kind: 'client', row: c })}
        onAdd={(stage) => open({ kind: 'client', isNew: true, row: newClient(offer, stage, { csm: me }) })}
        renderCard={(c) => {
          const late = !!c.next_date && c.next_date < today;
          return (
            <>
              <span className="card-title">{c.name}</span>
              {c.company && <span className="card-sub">{c.company}</span>}
              {c.next_action && <span className="card-next">{c.next_action}</span>}
              <span className="card-meta">
                {c.setup_value > 0 && <span className="tag">{fmtMoney(c.setup_value)}</span>}
                {c.monthly > 0 && <span className="tag">{fmtMoney(c.monthly)} a month</span>}
                {c.next_date && <span className={`due${late ? ' is-late' : ''}`}>{fmtDate(c.next_date)}</span>}
                <span className="spacer" />
                <Avatar name={c.csm} size={20} />
              </span>
            </>
          );
        }}
      />
    </div>
  );
}
