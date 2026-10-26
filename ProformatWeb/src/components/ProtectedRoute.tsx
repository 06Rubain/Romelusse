import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Permission } from '../lib/types';

// scope "company" : espace entreprise ; scope "platform" : console OmniCom
export default function ProtectedRoute({ scope, permissions }: { scope?: 'company' | 'platform'; permissions?: Permission[] }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loading">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (scope === 'company' && user.isSuperAdmin) return <Navigate to="/platform" replace />;
  if (scope === 'platform' && !user.isSuperAdmin) return <Navigate to="/dashboard" replace />;
  if (permissions && !can(...permissions)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
