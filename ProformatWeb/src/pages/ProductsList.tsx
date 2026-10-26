import { useMemo, useState } from 'react';
import { Boxes, Download, Edit2, Plus, Search, Trash2, Upload } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useAuth } from '../auth/AuthContext';
import { downloadCsv, formatDateTime, formatMoney } from '../lib/format';
import type { Currency, Paginated, Product, StockMovement } from '../lib/types';
import { Alert, EmptyRow, Field, Modal, PageHeader, Pagination } from '../components/ui';
import { PRICE_GRID_2026 } from '../utils/priceGrid';

interface ProductForm {
  name: string; description: string; category: string; sku: string; unit: string; unitPrice: string;
  currency: Currency; priceOnQuote: boolean; trackStock: boolean; minStock: string; initialStock: string; isActive: boolean;
}

const EMPTY: ProductForm = {
  name: '', description: '', category: 'Général', sku: '', unit: 'pièce', unitPrice: '', currency: 'USD',
  priceOnQuote: false, trackStock: false, minStock: '0', initialStock: '0', isActive: true,
};

const MOVEMENT_LABELS = { in: 'Entrée', out: 'Sortie', adjust: 'Inventaire' };

export default function ProductsList() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'manager');
  const [tab, setTab] = useState<'catalog' | 'movements'>('catalog');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; form: ProductForm } | null>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, loading, reload } = useFetch(() => api.get<Product[]>('/products', { search, category, lowStock: lowOnly ? 'true' : '' }), [search, category, lowOnly]);
  const categories = useFetch(() => api.get<string[]>('/products/categories'), [data]);

  const stockValue = useMemo(() => (data || []).filter((p) => p.trackStock && p.stockQuantity > 0)
    .reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.currency]: (acc[p.currency] || 0) + p.stockQuantity * p.unitPrice }), {}), [data]);

  const openEdit = (p?: Product) => setEditing(p ? {
    id: p._id,
    form: { ...EMPTY, ...p, unitPrice: String(p.unitPrice), minStock: String(p.minStock), initialStock: '0' },
  } : { id: null, form: EMPTY });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const f = editing.form;
    const body = { ...f, unitPrice: parseFloat(f.unitPrice.replace(',', '.')) || 0, minStock: parseFloat(f.minStock) || 0, initialStock: parseFloat(f.initialStock) || 0 };
    setError('');
    try {
      if (editing.id) await api.put(`/products/${editing.id}`, body);
      else await api.post('/products', body);
      setEditing(null);
      reload();
    } catch (err) { setError(errorMessage(err)); }
  };

  const remove = async (p: Product) => {
    if (!window.confirm(`Supprimer le produit ${p.name} ? Les factures existantes ne sont pas modifiées.`)) return;
    try { await api.del(`/products/${p._id}`); reload(); } catch (err) { setError(errorMessage(err)); }
  };

  const importGrid = async () => {
    if (!window.confirm('Importer la grille tarifaire 2026 ? Les produits déjà présents (même nom) seront ignorés.')) return;
    setBusy(true);
    try {
      const res = await api.post<{ created: number; skipped: number }>('/products/bulk', { products: PRICE_GRID_2026 });
      window.alert(`${res.created} produit(s) importé(s), ${res.skipped} déjà présent(s).`);
      reload();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  const exportCsv = () => downloadCsv('produits.csv', ['Nom', 'Catégorie', 'Référence', 'Prix', 'Devise', 'Unité', 'Stock', 'Seuil', 'Actif'],
    (data || []).map((p) => [p.name, p.category, p.sku, p.priceOnQuote ? 'Sur devis' : p.unitPrice, p.currency, p.unit, p.trackStock ? p.stockQuantity : '', p.trackStock ? p.minStock : '', p.isActive ? 'oui' : 'non']));

  const setField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setEditing((prev) => (prev ? { ...prev, form: { ...prev.form, [key]: value } } : prev));

  return (
    <div className="animate-fade-in">
      <PageHeader title="Produits & stock" subtitle={data ? `${data.length} article(s) · valeur du stock : ${Object.entries(stockValue).map(([c, v]) => formatMoney(v, c)).join(' · ') || '—'}` : undefined}
        actions={<>
          <button className="btn btn-outline" onClick={exportCsv}><Download size={18} /> Exporter</button>
          {canEdit && <button className="btn btn-outline" onClick={importGrid} disabled={busy}><Upload size={18} /> {busy ? 'Import…' : 'Grille 2026'}</button>}
          {canEdit && <button className="btn btn-primary" onClick={() => openEdit()}><Plus size={18} /> Nouveau produit</button>}
        </>} />
      <Alert>{error}</Alert>

      <div className="tabs">
        <button className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>Catalogue</button>
        <button className={tab === 'movements' ? 'active' : ''} onClick={() => setTab('movements')}>Mouvements de stock</button>
      </div>

      {tab === 'catalog' ? (
        <>
          <div className="toolbar card">
            <div className="search-box"><Search size={16} /><input className="input-field" placeholder="Nom, référence…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Toutes les catégories</option>
              {categories.data?.map((c) => <option key={c}>{c}</option>)}
            </select>
            <label className="checkbox"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Stock bas uniquement</label>
          </div>
          <div className="card">
            <div className="table-container">
              <table>
                <thead><tr><th>Produit</th><th>Catégorie</th><th className="num">Prix</th><th className="num">Stock</th>{canEdit && <th className="actions">Actions</th>}</tr></thead>
                <tbody>
                  {data?.map((p) => {
                    const low = p.trackStock && p.stockQuantity <= p.minStock;
                    return (
                      <tr key={p._id} style={{ opacity: p.isActive ? 1 : 0.5 }}>
                        <td><div className="strong">{p.name}</div><div className="muted small">{[p.sku, p.description].filter(Boolean).join(' · ')}</div></td>
                        <td className="muted">{p.category}</td>
                        <td className="num strong text-primary">{p.priceOnQuote ? 'Sur devis' : formatMoney(p.unitPrice, p.currency)}<div className="muted small">/ {p.unit}</div></td>
                        <td className={`num ${low ? (p.stockQuantity <= 0 ? 'text-danger' : 'text-warning') : ''}`}>
                          {p.trackStock ? <>{p.stockQuantity} <span className="muted small">(min. {p.minStock})</span></> : <span className="muted">—</span>}
                        </td>
                        {canEdit && (
                          <td className="actions">
                            {p.trackStock && <button className="icon-btn" title="Mouvement de stock" onClick={() => setStockFor(p)}><Boxes size={16} /></button>}
                            <button className="icon-btn" title="Modifier" onClick={() => openEdit(p)}><Edit2 size={16} /></button>
                            <button className="icon-btn text-danger" title="Supprimer" onClick={() => remove(p)}><Trash2 size={16} /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {!loading && data?.length === 0 && <EmptyRow colSpan={5}>Aucun produit.</EmptyRow>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : <Movements />}

      {editing && (
        <Modal title={editing.id ? 'Modifier le produit' : 'Nouveau produit'} onClose={() => setEditing(null)} width={640}>
          <form onSubmit={save}>
            <Field label="Nom *"><input className="input-field" value={editing.form.name} onChange={(e) => setField('name', e.target.value)} required autoFocus /></Field>
            <div className="form-grid">
              <Field label="Catégorie">
                <input className="input-field" list="categories" value={editing.form.category} onChange={(e) => setField('category', e.target.value)} />
                <datalist id="categories">{categories.data?.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Référence (SKU)"><input className="input-field" value={editing.form.sku} onChange={(e) => setField('sku', e.target.value)} /></Field>
              <Field label="Prix unitaire"><input className="input-field" inputMode="decimal" value={editing.form.unitPrice} onChange={(e) => setField('unitPrice', e.target.value)} disabled={editing.form.priceOnQuote} /></Field>
              <Field label="Devise">
                <select className="input-field" value={editing.form.currency} onChange={(e) => setField('currency', e.target.value as Currency)}>
                  <option value="USD">USD</option><option value="FC">FC</option>
                </select>
              </Field>
              <Field label="Unité"><input className="input-field" value={editing.form.unit} onChange={(e) => setField('unit', e.target.value)} placeholder="pièce, m², feuille…" /></Field>
            </div>
            <Field label="Description"><input className="input-field" value={editing.form.description} onChange={(e) => setField('description', e.target.value)} /></Field>
            <div className="checkbox-row">
              <label className="checkbox"><input type="checkbox" checked={editing.form.priceOnQuote} onChange={(e) => setField('priceOnQuote', e.target.checked)} /> Prix sur devis</label>
              <label className="checkbox"><input type="checkbox" checked={editing.form.trackStock} onChange={(e) => setField('trackStock', e.target.checked)} /> Suivre le stock</label>
              <label className="checkbox"><input type="checkbox" checked={editing.form.isActive} onChange={(e) => setField('isActive', e.target.checked)} /> Actif</label>
            </div>
            {editing.form.trackStock && (
              <div className="form-grid">
                <Field label="Seuil d'alerte"><input type="number" min="0" className="input-field" value={editing.form.minStock} onChange={(e) => setField('minStock', e.target.value)} /></Field>
                {!editing.id && <Field label="Stock initial"><input type="number" className="input-field" value={editing.form.initialStock} onChange={(e) => setField('initialStock', e.target.value)} /></Field>}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}

      {stockFor && <StockModal product={stockFor} onClose={() => setStockFor(null)} onSaved={reload} />}
    </div>
  );
}

function StockModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<'in' | 'out' | 'adjust'>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/products/${product._id}/stock`, { type, quantity: parseFloat(quantity), reason, reference });
      onSaved();
      onClose();
    } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <Modal title={`Stock — ${product.name}`} onClose={onClose}>
      <p className="muted">Stock actuel : <strong>{product.stockQuantity} {product.unit}</strong></p>
      <Alert>{error}</Alert>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Mouvement">
            <select className="input-field" value={type} onChange={(e) => setType(e.target.value as 'in' | 'out' | 'adjust')}>
              <option value="in">Entrée (achat, réception)</option>
              <option value="out">Sortie (perte, usage interne)</option>
              <option value="adjust">Inventaire (quantité réelle)</option>
            </select>
          </Field>
          <Field label={type === 'adjust' ? 'Quantité comptée' : 'Quantité'}>
            <input type="number" step="any" min="0" className="input-field" value={quantity} onChange={(e) => setQuantity(e.target.value)} required autoFocus />
          </Field>
        </div>
        <Field label="Motif"><input className="input-field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex : achat fournisseur, casse…" /></Field>
        <Field label="Référence (bon, facture fournisseur…)"><input className="input-field" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary">Valider</button>
        </div>
      </form>
    </Modal>
  );
}

function Movements() {
  const [page, setPage] = useState(1);
  const { data, loading } = useFetch(() => api.get<Paginated<StockMovement>>('/products/movements', { page }), [page]);
  return (
    <div className="card">
      <div className="table-container">
        <table>
          <thead><tr><th>Date</th><th>Produit</th><th>Type</th><th className="num">Quantité</th><th className="num">Stock après</th><th>Motif / réf.</th><th>Par</th></tr></thead>
          <tbody>
            {data?.items.map((m) => (
              <tr key={m._id}>
                <td className="muted">{formatDateTime(m.createdAt)}</td>
                <td className="strong">{m.productName}</td>
                <td><span className={`badge ${m.type === 'in' ? 'badge-success' : m.type === 'out' ? 'badge-warning' : 'badge-neutral'}`}>{MOVEMENT_LABELS[m.type]}</span></td>
                <td className={`num strong ${m.quantity < 0 ? 'text-danger' : 'text-success'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                <td className="num">{m.stockAfter}</td>
                <td className="muted small">{[m.reason, m.reference].filter(Boolean).join(' · ')}</td>
                <td className="muted small">{m.createdBy}</td>
              </tr>
            ))}
            {!loading && data?.items.length === 0 && <EmptyRow colSpan={7}>Aucun mouvement de stock.</EmptyRow>}
          </tbody>
        </table>
      </div>
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </div>
  );
}
