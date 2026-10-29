import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Info, X, XCircle } from 'lucide-react';
import { Modal } from './ui';

interface ConfirmOptions { title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean }
interface PromptOptions extends ConfirmOptions { label?: string; placeholder?: string; type?: 'text' | 'password'; minLength?: number }
type ToastTone = 'success' | 'error' | 'info';

interface FeedbackApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
  toast: (message: string, tone?: ToastTone) => void;
}

type Pending =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

interface Toast { id: number; message: string; tone: ToastTone }

const FeedbackContext = createContext<FeedbackApi | null>(null);

const TOAST_ICONS = { success: CheckCircle2, error: XCircle, info: Info };

function PromptBody({ options, onDone }: { options: PromptOptions; onDone: (value: string | null) => void }) {
  const [value, setValue] = useState('');
  const tooShort = Boolean(options.minLength && value.length < options.minLength);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (value.trim() && !tooShort) onDone(value); }}>
      <label className="input-group">
        {options.label && <span className="label">{options.label}</span>}
        <input className="input-field" type={options.type || 'text'} value={value} placeholder={options.placeholder}
          onChange={(e) => setValue(e.target.value)} autoFocus autoComplete="off" />
        {options.minLength && <small className="muted">{options.minLength} caractères minimum</small>}
      </label>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={() => onDone(null)}>Annuler</button>
        <button type="submit" className={`btn ${options.danger ? 'btn-danger' : 'btn-primary'}`} disabled={!value.trim() || tooShort}>
          {options.confirmLabel || 'Valider'}
        </button>
      </div>
    </form>
  );
}

// Fenêtres de confirmation et notifications intégrées à l'application (remplacent confirm/prompt/alert du navigateur)
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ kind: 'confirm', options, resolve })), []);
  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) => setPending({ kind: 'prompt', options, resolve })), []);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++nextId.current;
    setToasts((list) => [...list.slice(-3), { id, message, tone }]);
    setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500);
  }, [dismiss]);

  const close = (value: boolean | string | null) => {
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(Boolean(value));
    else pending.resolve(typeof value === 'string' ? value : null);
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={{ confirm, prompt, toast }}>
      {children}
      {pending && (
        <Modal title={pending.options.title} onClose={() => close(pending.kind === 'confirm' ? false : null)} width={440}>
          <div className="dialog">
            <div className={`dialog-icon ${pending.options.danger ? 'danger' : ''}`}>
              {pending.options.danger ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
            </div>
            {pending.options.message && <p>{pending.options.message}</p>}
            {pending.kind === 'prompt' ? (
              <PromptBody options={pending.options} onDone={close} />
            ) : (
              <ConfirmButtons options={pending.options} onDone={close} />
            )}
          </div>
        </Modal>
      )}
      <div className="toasts no-print" aria-live="polite">
        {toasts.map((t) => {
          const Icon = TOAST_ICONS[t.tone];
          return (
            <div key={t.id} className={`toast ${t.tone}`} role="status">
              <Icon size={18} />
              <span>{t.message}</span>
              <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Fermer"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}

function ConfirmButtons({ options, onDone }: { options: ConfirmOptions; onDone: (value: boolean) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="modal-actions">
      <button type="button" className="btn btn-ghost" onClick={() => onDone(false)}>Annuler</button>
      <button ref={ref} type="button" className={`btn ${options.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => onDone(true)}>
        {options.confirmLabel || 'Confirmer'}
      </button>
    </div>
  );
}

// eslint-disable-next-line react/only-export-components
export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback doit être utilisé dans FeedbackProvider');
  return ctx;
}
