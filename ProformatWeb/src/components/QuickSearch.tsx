import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, FileText, Search, Users, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import type { Client, Invoice, Paginated } from '../lib/types';

export interface SearchAction { to: string; label: string; icon: LucideIcon }
interface Result { key: string; to: string; label: string; hint?: string; icon: LucideIcon }

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Recherche rapide (Ctrl + K) : pages, clients et documents de l'entreprise
export default function QuickSearch({ actions, searchData, onClose }: { actions: SearchAction[]; searchData: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Result[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const q = query.trim();
    if (!searchData || q.length < 2) { setFound([]); return; }
    const timer = setTimeout(() => {
      Promise.all([
        api.get<Paginated<Invoice>>('/invoices', { search: q, limit: 5 }).catch(() => null),
        api.get<Client[]>('/clients', { search: q }).catch(() => null),
      ]).then(([invoices, clients]) => setFound([
        ...(clients || []).slice(0, 4).map((c) => ({ key: `c${c._id}`, to: `/clients?open=${c._id}`, label: c.name, hint: 'Client', icon: Users })),
        ...(invoices?.items || []).map((i) => ({
          key: `i${i._id}`, to: `/invoice/${i._id}`, label: `${i.number} — ${i.client}`,
          hint: `${i.type} · ${formatMoney(i.totalAmount, i.currency)} · ${i.status}`, icon: FileText,
        })),
      ]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, searchData]);

  const results = useMemo<Result[]>(() => {
    const q = normalize(query.trim());
    const pages = actions.filter((a) => !q || normalize(a.label).includes(q)).map((a) => ({ key: a.to, to: a.to, label: a.label, icon: a.icon }));
    return [...pages, ...found];
  }, [actions, query, found]);

  useEffect(() => { setActive(0); }, [query]);

  const go = (r?: Result) => {
    if (!r) return;
    onClose();
    navigate(r.to);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette card" role="dialog" aria-modal="true" aria-label="Recherche rapide">
        <div className="palette-input">
          <Search size={18} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchData ? 'Page, client, n° de facture…' : 'Aller à…'}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
            }} />
          <kbd>Échap</kbd>
        </div>
        <div className="palette-results">
          {results.map((r, i) => (
            <button key={r.key} className={i === active ? 'active' : ''} onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
              <r.icon size={17} />
              <span className="palette-label">{r.label}{r.hint && <small>{r.hint}</small>}</span>
              {i === active && <CornerDownLeft size={14} className="muted" />}
            </button>
          ))}
          {results.length === 0 && <div className="muted palette-empty">Aucun résultat pour « {query} ».</div>}
        </div>
      </div>
    </div>
  );
}
