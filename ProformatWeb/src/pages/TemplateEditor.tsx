import { useEffect, useMemo, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, FileUp, RotateCcw, Save } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { toInputDate } from '../lib/format';
import {
  TEMPLATE_FONTS, TEMPLATE_LABELS, ZONE_LABELS,
  type InvoiceTemplate, type TemplateLabel, type Zone, type ZoneKey,
} from '../lib/types';
import { Alert, Field, PageHeader } from '../components/ui';
import TemplateDocument, { type DocumentData } from '../components/TemplateDocument';
import InvoiceDocument from '../components/InvoiceDocument';

const SAMPLE_ITEMS = [
  'Impression A4 sur papier doré 280 g', 'Cartes de visite recto-verso', 'Bâche 1 × 1 m', 'Roll-up 85 × 200 cm',
  'Flyers A5 quadri', 'Autocollants vinyle', 'Affiches A2', 'Chemises à rabats', 'Carnets de factures', 'Badges PVC',
];

// Disposition de départ proposée après un import (ou pour revenir en arrière)
const DEFAULT_ZONES: Record<ZoneKey, Zone> = {
  meta: { x: 55, y: 6, w: 40, h: 9, visible: true, align: 'right' },
  client: { x: 6, y: 17, w: 50, h: 8, visible: true, align: 'left' },
  items: { x: 6, y: 27, w: 88, h: 38, visible: true, align: 'left' },
  totals: { x: 54, y: 66, w: 40, h: 10, visible: true, align: 'right' },
  words: { x: 6, y: 77, w: 60, h: 6, visible: true, align: 'left' },
  notes: { x: 6, y: 84, w: 55, h: 6, visible: true, align: 'left' },
  stamp: { x: 64, y: 78, w: 30, h: 10, visible: true, align: 'center' },
  signature: { x: 66, y: 84, w: 28, h: 9, visible: true, align: 'center' },
  payment: { x: 6, y: 90, w: 56, h: 7, visible: true, align: 'left' },
};

export default function TemplateEditor() {
  const { company } = useAuth();
  const [template, setTemplate] = useState<InvoiceTemplate | null>(null);
  const [selected, setSelected] = useState<ZoneKey | null>('items');
  const [lineCount, setLineCount] = useState(4);
  const [sampleType, setSampleType] = useState<'Facture' | 'Proforma'>('Facture');
  const [samplePaid, setSamplePaid] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [overflow, setOverflow] = useState<ZoneKey[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<InvoiceTemplate>('/company/template').then(setTemplate).catch((err) => setError(errorMessage(err)));
  }, []);

  // Données d'exemple : le nombre de lignes montre l'adaptation automatique du tableau
  const sample: DocumentData = useMemo(() => ({
    type: sampleType,
    number: sampleType === 'Facture' ? 'FAC-2026-0042' : 'PRO-2026-0017',
    client: 'Credo Création',
    clientActivity: 'Agence de communication',
    issueDate: toInputDate(),
    dueDate: toInputDate(new Date(Date.now() + 30 * 86400000)),
    currency: 'USD',
    lines: Array.from({ length: lineCount }, (_, i) => ({ name: SAMPLE_ITEMS[i % SAMPLE_ITEMS.length], quantity: (i + 1) * 10, unitPrice: 0.4 + i * 1.5 })),
    discount: 5,
    paid: samplePaid && sampleType === 'Facture',
    cancelled: false,
    notes: 'Paiement à 30 jours. Merci de votre confiance.',
  }), [sampleType, lineCount, samplePaid]);

  if (!template) return <div className="muted">{error || 'Chargement…'}</div>;

  const update = (patch: Partial<InvoiceTemplate>) => setTemplate({ ...template, ...patch });
  const updateZone = (key: ZoneKey, patch: Partial<Zone>) => update({ zones: { ...template.zones, [key]: { ...template.zones[key], ...patch } } });
  const updateStyle = (patch: Partial<InvoiceTemplate['style']>) => update({ style: { ...template.style, ...patch } });

  const importFile = async (file?: File) => {
    if (!file) return;
    setError('');
    setMessage('');
    setBusy('Conversion du modèle…');
    try {
      // pdf.js n'est chargé qu'au moment d'un import
      const { importTemplateFile } = await import('../lib/pdf');
      const pageImage = await importTemplateFile(file);
      const firstImport = !template.background;
      setTemplate({ ...template, mode: 'custom', background: pageImage.dataUrl, pageSize: pageImage.pageSize, zones: firstImport ? DEFAULT_ZONES : template.zones });
      setMessage('Modèle importé : placez maintenant les zones sur votre modèle, puis enregistrez.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    setError('');
    setMessage('');
    setBusy('Enregistrement…');
    try {
      setTemplate(await api.put<InvoiceTemplate>('/company/template', template));
      setMessage('Modèle enregistré : il s\'applique à toutes les factures et proformas, y compris les réimpressions.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const zone = selected ? template.zones[selected] : null;
  const custom = template.mode === 'custom';

  return (
    <div className="animate-fade-in">
      <PageHeader title="Modèle de facture" subtitle="Importez votre propre modèle et adaptez la mise en page"
        actions={<button className="btn btn-primary" onClick={save} disabled={!!busy}><Save size={18} /> {busy || 'Enregistrer'}</button>} />
      <Alert>{error}</Alert>
      <Alert tone="success">{message}</Alert>

      <div className="tpl-layout">
        <div className="tpl-panel">
          <div className="card">
            <h3>Type de modèle</h3>
            <label className="radio-card">
              <input type="radio" checked={!custom} onChange={() => update({ mode: 'standard' })} />
              <span><strong>Modèle standard</strong><small className="muted">Généré avec votre logo et vos couleurs</small></span>
            </label>
            <label className="radio-card">
              <input type="radio" checked={custom} disabled={!template.background} onChange={() => update({ mode: 'custom' })} />
              <span><strong>Mon modèle importé</strong><small className="muted">{template.background ? 'Votre propre mise en page' : 'Importez d\'abord un fichier'}</small></span>
            </label>
            <button className="btn btn-outline btn-block" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              <FileUp size={18} /> {template.background ? 'Remplacer le modèle' : 'Importer mon modèle'}
            </button>
            <input ref={fileRef} type="file" hidden accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ''; }} />
            <p className="muted small" style={{ marginBottom: 0 }}>PDF (1re page), PNG ou JPEG. Utilisez une page vierge : en-tête, pied de page, filigrane… Les informations de la facture sont placées par-dessus.</p>
          </div>

          {custom && (
            <>
              <div className="card">
                <h3>Page</h3>
                <Field label="Format">
                  <select className="input-field" value={template.pageSize} onChange={(e) => update({ pageSize: e.target.value as 'A4' | 'A5' })}>
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="A5">A5 (148 × 210 mm)</option>
                  </select>
                </Field>
                <button className="btn btn-ghost btn-sm" onClick={() => update({ zones: DEFAULT_ZONES })}><RotateCcw size={16} /> Réinitialiser les zones</button>
              </div>

              <div className="card">
                <h3>Zones</h3>
                <p className="muted small">Faites glisser une zone sur l'aperçu pour la déplacer ; tirez le coin pour la redimensionner.</p>
                {(Object.keys(ZONE_LABELS) as ZoneKey[]).map((key) => (
                  <div key={key} className={`zone-row ${selected === key ? 'active' : ''}`} onClick={() => setSelected(key)}>
                    <input type="checkbox" checked={template.zones[key].visible} onClick={(e) => e.stopPropagation()} onChange={(e) => updateZone(key, { visible: e.target.checked })} aria-label={`Afficher ${ZONE_LABELS[key]}`} />
                    <span>{ZONE_LABELS[key]}</span>
                  </div>
                ))}
                {selected && zone && (
                  <div className="zone-detail">
                    <div className="row-gap" style={{ marginBottom: 10 }}>
                      {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([align, Icon]) => (
                        <button key={align} className={`icon-btn ${zone.align === align ? 'text-primary' : ''}`} onClick={() => updateZone(selected, { align })} aria-label={`Aligner ${align}`}><Icon size={16} /></button>
                      ))}
                    </div>
                    <div className="zone-grid">
                      {(['x', 'y', 'w', 'h'] as const).map((k) => (
                        <label key={k} className="color-field">{{ x: 'Gauche %', y: 'Haut %', w: 'Largeur %', h: 'Hauteur %' }[k]}
                          <input type="number" className="input-field input-sm" step="0.5" min="0" max="100" value={zone[k]}
                            onChange={(e) => updateZone(selected, { [k]: parseFloat(e.target.value) || 0 })} />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <h3>Style</h3>
                <Field label="Police">
                  <select className="input-field" value={template.style.fontFamily} onChange={(e) => updateStyle({ fontFamily: e.target.value })}>
                    {TEMPLATE_FONTS.map((f) => <option key={f} value={f}>{f.split(',')[0].replace(/'/g, '')}</option>)}
                  </select>
                </Field>
                <Field label={`Taille du texte : ${template.style.fontSize} pt`}>
                  <input type="range" min="6" max="20" step="0.5" value={template.style.fontSize} onChange={(e) => updateStyle({ fontSize: parseFloat(e.target.value) })} />
                </Field>
                <div className="color-row">
                  {([['textColor', 'Texte'], ['headerBg', 'En-tête tableau'], ['headerText', 'Texte en-tête'], ['borderColor', 'Bordures']] as const).map(([key, label]) => (
                    <label key={key} className="color-field">{label}
                      <input type="color" value={template.style[key]} onChange={(e) => updateStyle({ [key]: e.target.value })} />
                    </label>
                  ))}
                </div>
                <label className="checkbox"><input type="checkbox" checked={template.style.showBorders} onChange={(e) => updateStyle({ showBorders: e.target.checked })} /> Bordures du tableau</label>
              </div>

              <details className="card">
                <summary><strong>Libellés</strong> <span className="muted small">— adaptez les textes (ex. « FACTURE D'ACHAT N° »)</span></summary>
                <div className="form-grid" style={{ marginTop: 12 }}>
                  {(Object.keys(TEMPLATE_LABELS) as TemplateLabel[]).map((key) => (
                    <Field key={key} label={TEMPLATE_LABELS[key]}>
                      <input className="input-field" value={template.labels[key]} maxLength={60} onChange={(e) => update({ labels: { ...template.labels, [key]: e.target.value } })} />
                    </Field>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>

        <div className="tpl-preview-col">
          <div className="toolbar card">
            <select className="input-field" value={sampleType} onChange={(e) => setSampleType(e.target.value as 'Facture' | 'Proforma')} aria-label="Type d'aperçu">
              <option value="Facture">Aperçu : facture</option>
              <option value="Proforma">Aperçu : proforma</option>
            </select>
            <label className="color-field" style={{ flex: 1, minWidth: 180 }}>Lignes d'exemple : {lineCount}
              <input type="range" min="1" max="30" value={lineCount} onChange={(e) => setLineCount(parseInt(e.target.value, 10))} />
            </label>
            <label className="checkbox"><input type="checkbox" checked={samplePaid} onChange={(e) => setSamplePaid(e.target.checked)} /> Payée</label>
          </div>
          {custom && overflow.length > 0 && (
            <Alert tone="info">Contenu trop long pour : {overflow.map((k) => ZONE_LABELS[k]).join(', ')}. Agrandissez la zone ou réduisez la taille du texte.</Alert>
          )}
          <div className="editor-preview tpl-preview">
            <div className="preview-fit">
              {custom ? (
                <TemplateDocument template={template} data={sample} company={company} editable selected={selected} onSelect={setSelected} onZoneChange={(key, z) => updateZone(key, z)} onOverflowChange={setOverflow} />
              ) : (
                <InvoiceDocument {...sample} company={company} printFormat="A4" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
