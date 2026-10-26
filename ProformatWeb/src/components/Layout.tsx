import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3, FileText, Users, Package, Wallet, Receipt, PieChart, UserCog, Settings as SettingsIcon,
  History, LogOut, Menu, X, User as UserIcon, FilePlus2,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS, type Role } from '../lib/types';

interface NavItem { to: string; label: string; icon: typeof BarChart3; roles?: Role[] }

const SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: 'Pilotage', items: [
    { to: '/dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { to: '/reports', label: 'Rapports', icon: PieChart, roles: ['admin', 'manager'] },
  ] },
  { title: 'Ventes', items: [
    { to: '/invoice', label: 'Nouvelle facture', icon: FilePlus2 },
    { to: '/invoices', label: 'Factures & proformas', icon: FileText },
    { to: '/payments', label: 'Encaissements', icon: Wallet },
    { to: '/clients', label: 'Clients', icon: Users },
  ] },
  { title: 'Opérations', items: [
    { to: '/products', label: 'Produits & stock', icon: Package },
    { to: '/expenses', label: 'Dépenses', icon: Receipt, roles: ['admin', 'manager'] },
  ] },
  { title: 'Administration', items: [
    { to: '/users', label: 'Équipe', icon: UserCog, roles: ['admin'] },
    { to: '/activities', label: 'Journal d\'activité', icon: History, roles: ['admin', 'manager'] },
    { to: '/settings', label: 'Paramètres', icon: SettingsIcon, roles: ['admin'] },
  ] },
];

export default function Layout() {
  const { user, settings, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-container">
      <header className="mobile-topbar no-print">
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu size={22} /></button>
        <strong className="gradient-text">{settings?.companyName || 'Mélanine Print'}</strong>
        <span style={{ width: 22 }} />
      </header>

      {open && <div className="sidebar-backdrop no-print" onClick={() => setOpen(false)} />}

      <aside className={`sidebar nav-sidebar no-print ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div>
            <h2 className="gradient-text" style={{ margin: 0 }}>{settings?.companyName || 'Mélanine Print'}</h2>
            <span className="muted small">ERP — Gestion commerciale</span>
          </div>
          <button className="icon-btn mobile-only" onClick={() => setOpen(false)} aria-label="Fermer le menu"><X size={20} /></button>
        </div>

        <nav className="nav">
          {SECTIONS.map((section) => {
            const items = section.items.filter((i) => !i.roles || (user && i.roles.includes(user.role)));
            if (!items.length) return null;
            return (
              <div key={section.title} className="nav-section">
                <div className="nav-title">{section.title}</div>
                {items.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} end={to === '/invoice'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setOpen(false)}>
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
              <small className="muted">{user ? ROLE_LABELS[user.role] : ''}</small>
            </span>
          </NavLink>
          <button className="nav-link danger" onClick={handleLogout}>
            <LogOut size={18} /> <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
