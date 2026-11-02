import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { downloadCsv, formatMoney } from '../lib/format';
import { parseCsv, readCatalog, TEMPLATE_HEADERS, TEMPLATE_ROWS, type ImportedProduct } from '../lib/catalogImport';
import { Alert, Modal } from './ui';

// Import du catalogue de l'entreprise depuis Excel / Google Sheets (fichier CSV)
export default function CatalogImport({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<ImportedProduct[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [ignored, setIgnored] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const read = async (file?: File) => {
    if (!file) return;
    setError('');
    setProducts(null);
    if (/\.xlsx?$/i.test(file.name)) {
      setError('Dans Excel : Fichier → Enregistrer sous → « CSV (séparateur : point-virgule) », puis choisissez ce fichier.');
      return;
    }
    const result = readCatalog(parseCsv(await file.text()));
    if (result.missingName) {
      setError('Colonne « Nom » introuvable : la première ligne doit contenir les titres (Nom, Catégorie, Prix, Devise, Unité, Référence). Partez du modèle.');
      return;
    }
    setFileName(file.name);
    setIgnored(result.ignored);
    setProducts(result.products);
  };

  const submit = async () => {
    if (!products?.length) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ created: number; skipped: number }>('/products/bulk', { products });
      onDone(`${res.created} produit(s) ajouté(s)${res.skipped ? `, ${res.skipped} déjà présent(s) ignoré(s)` : ''}.`);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal title="Importer votre catalogue" onClose={onClose} width={680}>
      <ol className="import-steps">
        <li>
          Téléchargez le modèle et remplissez-le dans Excel ou Google Sheets : une ligne par produit ou service.
          <button type="button" className="btn btn-sm btn-outline" onClick={() => downloadCsv('modele-catalogue.csv', TEMPLATE_HEADERS, TEMPLATE_ROWS)}>
            <Download size={15} /> Télécharger le modèle
          </button>
        </li>
        <li>Enregistrez-le au format <strong>CSV</strong>, puis choisissez le fichier. Un export du catalogue depuis cette page fonctionne aussi.</li>
      </ol>
      <button type="button" className="import-drop" onClick={() => fileRef.current?.click()}>
        <FileSpreadsheet size={28} />
        <strong>{fileName || 'Choisir le fichier CSV'}</strong>
        <span className="muted small">Colonnes reconnues : Nom, Catégorie, Prix (ou « Sur devis »), Devise (USD ou FC), Unité, Référence</span>
      </button>
      <input ref={fileRef} type="file" accept=".csv,text/csv,.xlsx,.xls" hidden onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }} />
      <Alert>{error}</Alert>

      {products && (
        <>
          <p className="strong" style={{ margin: '14px 0 6px' }}>
            {products.length} produit(s) prêt(s) à importer{ignored ? ` · ${ignored} ligne(s) sans nom ignorée(s)` : ''}
          </p>
          <div className="table-container import-preview">
            <table>
              <thead><tr><th>Nom</th><th>Catégorie</th><th className="num">Prix</th><th>Unité</th></tr></thead>
              <tbody>
                {products.slice(0, 8).map((p, i) => (
                  <tr key={`${p.name}-${i}`}><td>{p.name}</td><td>{p.category}</td><td className="num">{p.priceOnQuote ? 'Sur devis' : formatMoney(p.unitPrice, p.currency)}</td><td>{p.unit}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {products.length > 8 && <p className="muted small">… et {products.length - 8} autre(s).</p>}
        </>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button type="button" className="btn btn-primary" disabled={!products?.length || busy} onClick={submit}>
          <Upload size={16} /> {busy ? 'Import…' : products?.length ? `Importer ${products.length} produit(s)` : 'Importer'}
        </button>
      </div>
    </Modal>
  );
}
