import { useState } from 'react';
import { ShieldCheck, User as UserIcon } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../lib/format';
import { ROLE_LABELS, type User } from '../lib/types';
import { Alert, Field, PageHeader } from '../components/ui';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [qr, setQr] = useState<{ qrCodeImage: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setError('');
    setMessage('');
    try {
      await fn();
      await refreshUser();
      setMessage(success);
    } catch (err) { setError(errorMessage(err)); }
  };

  if (!user) return null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 760 }}>
      <PageHeader title="Mon profil" />
      <Alert>{error}</Alert>
      <Alert tone="success">{message}</Alert>

      <div className="card profile-head">
        <div className="avatar"><UserIcon size={36} /></div>
        <div>
          <h2 style={{ margin: 0 }}>{user.displayName || user.email}</h2>
          <div className="muted">{user.email} · {ROLE_LABELS[user.role]} · membre depuis le {formatDate(user.createdAt)}</div>
        </div>
      </div>

      <div className="grid-2 even" style={{ marginTop: 24 }}>
        <form className="card" onSubmit={(e) => { e.preventDefault(); run(() => api.patch<User>('/auth/me', { displayName }), 'Profil mis à jour.'); }}>
          <h3>Informations</h3>
          <Field label="Nom complet"><input className="input-field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></Field>
          <button className="btn btn-primary" type="submit">Enregistrer</button>
        </form>

        <form className="card" onSubmit={(e) => {
          e.preventDefault();
          run(async () => { await api.post('/auth/change-password', { currentPassword, newPassword }); setCurrentPassword(''); setNewPassword(''); }, 'Mot de passe modifié.');
        }}>
          <h3>Mot de passe</h3>
          <Field label="Mot de passe actuel"><input type="password" className="input-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required /></Field>
          <Field label="Nouveau mot de passe" hint="8 caractères minimum"><input type="password" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" required /></Field>
          <button className="btn btn-primary" type="submit">Changer le mot de passe</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3><ShieldCheck size={18} /> Double authentification (2FA)</h3>
        {user.twoFactorEnabled ? (
          <form onSubmit={(e) => { e.preventDefault(); run(() => api.post('/auth/2fa/disable', { password: disablePassword }), '2FA désactivée.'); setDisablePassword(''); }}>
            <p className="text-success">Activée : un code de votre application est demandé à chaque connexion.</p>
            <div className="manual-line">
              <input type="password" className="input-field" placeholder="Mot de passe pour désactiver" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} required />
              <button className="btn btn-outline" type="submit">Désactiver</button>
            </div>
          </form>
        ) : qr ? (
          <form onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post('/auth/2fa/enable', { code }); setQr(null); setCode(''); }, '2FA activée.'); }}>
            <p className="muted">1. Scannez ce QR code avec Google Authenticator, Authy ou Microsoft Authenticator.</p>
            <div className="qr"><img src={qr.qrCodeImage} alt="QR code 2FA" /></div>
            <p className="muted small">Clé manuelle : <code>{qr.secret}</code></p>
            <p className="muted">2. Saisissez le code à 6 chiffres affiché :</p>
            <div className="manual-line">
              <input className="input-field code-input" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
              <button className="btn btn-primary" type="submit" disabled={code.length !== 6}>Valider</button>
              <button className="btn btn-outline" type="button" onClick={() => setQr(null)}>Annuler</button>
            </div>
          </form>
        ) : (
          <>
            <p className="muted">Protégez votre compte avec un code temporaire en plus du mot de passe.</p>
            <button className="btn btn-primary" onClick={async () => {
              setError('');
              try { setQr(await api.post('/auth/2fa/setup')); } catch (err) { setError(errorMessage(err)); }
            }}>Activer la 2FA</button>
          </>
        )}
      </div>
    </div>
  );
}
