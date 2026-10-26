import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3, FileText, Users, Package, Wallet, Receipt, PieChart, UserCog, Settings as SettingsIcon,
  History, LogOut, Menu, X, User as UserIcon, FilePlus2, ShieldCheck, Building2, LayoutTemplate,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { APP_NAME, type Permission } from '../lib/types';

interface NavItem { to: string; label: string; icon: typeof BarChart3; permissions?: Permission[] }

const COMPANY_SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: 'Pilotage', items: [
    { to: '/dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { to: '/reports', label: 'Rapports', icon: PieChart, permissions: ['reports.view'] },
  ] },
  { title: 'Ventes', items: [
    { to: '/invoice', label: 'Nouvelle facture', icon: FilePlus2, permissions: ['invoices.create'] },
    { to: '/invoices', label: 'Factures & proformas', icon: FileText },
    { to: '/payments', label: 'Encaissements', icon: Wallet },
    { to: '/clients', label: 'Clients', icon: Users },
  ] },
  { title: 'Opérations', items: [
    { to: '/products', label: 'Produits & stock', icon: Package },
    { to: '/expenses', label: 'Dépenses', icon: Receipt, permissions: ['expenses.manage'] },
  ] },
  { title: 'Administration', items: [
    { to: '/users', label: 'Utilisateurs', icon: UserCog, permissions: ['users.manage'] },
    { to: '/roles', label: 'Rôles & permissions', icon: ShieldCheck, permissions: ['roles.manage'] },
    { to: '/activities', label: 'Journal d\'activité', icon: History, permissions: ['activities.view'] },
    { to: '/settings', label: 'Entreprise & logo', icon: SettingsIcon, permissions: ['settings.manage'] },
    { to: '/template', label: 'Modèle de facture', icon: LayoutTemplate, permissions: ['settings.manage'] },
  ] },
];

const PLATFORM_SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: 'Plateforme OmniCom', items: [
    { to: '/platform', label: 'Entreprises', icon: Building2 },
    { to: '/platform/team', label: 'Équipe OmniCom', icon: ShieldCheck },
    { to: '/platform/activities', label: 'Journal plateforme', icon: History },
  ] },
];

export default function Layout() {
  const { user, company, logout, can, acting, exitCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const inPlatform = Boolean(user?.isSuperAdmin && !acting);
  const sections = inPlatform ? PLATFORM_SECTIONS : COMPANY_SECTIONS;
  const title = inPlatform ? 'OmniCom' : company?.name || APP_NAME;

  const backToPlatform = () => {
    exitCompany();
    navigate('/platform');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-container">
      <header className="mobile-topbar no-print">
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu size={22} /></button>
        <strong>{title}</strong>
        <span style={{ width: 22 }} />
      </header>

      {open && <div className="sidebar-backdrop no-print" onClick={() => setOpen(false)} />}

      <aside className={`sidebar nav-sidebar no-print ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand">
            {company?.logo && <img src={company.logo} alt="" className="brand-logo" />}
            <div style={{ minWidth: 0 }}>
              <div className="brand-name">{title}</div>
              <span className="muted small">{inPlatform ? 'Console plateforme' : APP_NAME}</span>
            </div>
          </div>
          <button className="icon-btn mobile-only" onClick={() => setOpen(false)} aria-label="Fermer le menu"><X size={20} /></button>
        </div>

        <nav className="nav">
          {sections.map((section) => {
            const items = section.items.filter((i) => !i.permissions || can(...i.permissions));
            if (!items.length) return null;
            return (
              <div key={section.title} className="nav-section">
                <div className="nav-title">{section.title}</div>
                {items.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} end={to === '/invoice' || to === '/platform'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setOpen(false)}>
                    <Icon size={18} /> <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setOpen(false)}>
            <UserIcon size={18} />
            <span className="user-chip">
              <span>{user?.displayName || user?.email}</span>
              <small className="muted">{user?.roleName}</small>
            </span>
          </NavLink>
          <button className="nav-link danger" onClick={handleLogout}>
            <LogOut size={18} /> <span>Déconnexion</span>
          </button>
          <div className="powered muted small">{APP_NAME}</div>
        </div>
      </aside>

      <main className="main-content">
        {acting && (
          <div className="acting-banner no-print">
            <span><Building2 size={16} /> Mode OmniCom : vous êtes dans la console de <strong>{company?.name || '…'}</strong>. Vos actions sont enregistrées dans son journal.</span>
            <button className="btn btn-sm btn-outline" onClick={backToPlatform}>Revenir à la plateforme</button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
