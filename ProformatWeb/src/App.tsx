import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { FeedbackProvider } from './components/feedback';
import UpdateBar from './components/UpdateBar';
import { PageLoader } from './components/ui';
import Login from './pages/Login';
// Page chargée à la demande. Après un déploiement, une ancienne page peut avoir disparu du serveur :
// on recharge alors une fois l'application (nouvelle version) au lieu d'afficher une erreur.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = <P extends Record<string, any>>(load: () => Promise<{ default: ComponentType<P> }>) => lazy(() => load()
  .then((mod) => { try { sessionStorage.removeItem('page-reload'); } catch { /* ignoré */ } return mod; })
  .catch((err) => {
    try {
      if (!sessionStorage.getItem('page-reload')) {
        sessionStorage.setItem('page-reload', '1');
        window.location.reload();
        return new Promise<never>(() => {});
      }
    } catch { /* stockage indisponible */ }
    throw err;
  }));

// Pages chargées à la demande : l'ouverture de l'application ne télécharge que la connexion et le tableau de bord
const PublicInvoice = page(() => import('./pages/PublicInvoice'));
const Installer = page(() => import('./pages/Installer'));
import Dashboard from './pages/Dashboard';
const Invoices = page(() => import('./pages/Invoices'));
const InvoiceGenerator = page(() => import('./pages/InvoiceGenerator'));
const Payments = page(() => import('./pages/Payments'));
const Deliveries = page(() => import('./pages/Deliveries'));
const DeliveryNotePage = page(() => import('./pages/DeliveryNote'));
const Clients = page(() => import('./pages/Clients'));
const ProductsList = page(() => import('./pages/ProductsList'));
const Expenses = page(() => import('./pages/Expenses'));
const Treasury = page(() => import('./pages/Treasury'));
const DailyReport = page(() => import('./pages/DailyReport'));
const Reports = page(() => import('./pages/Reports'));
const UsersList = page(() => import('./pages/UsersList'));
const Roles = page(() => import('./pages/Roles'));
const Activities = page(() => import('./pages/Activities'));
const SettingsPage = page(() => import('./pages/Settings'));
const TemplateEditor = page(() => import('./pages/TemplateEditor'));
const Profile = page(() => import('./pages/Profile'));
const PlatformCompanies = page(() => import('./pages/PlatformCompanies'));
const PlatformTeam = page(() => import('./pages/PlatformTeam'));
import './index.css';

function Home() {
  const { user, acting } = useAuth();
  return <Navigate to={user?.isSuperAdmin && !acting ? '/platform' : '/dashboard'} replace />;
}

function App() {
  return (
    <AuthProvider>
      <FeedbackProvider>
        <UpdateBar />
        <Router>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/p/:token" element={<PublicInvoice />} />
            <Route path="/installer" element={<Installer />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/profile" element={<Profile />} />
  
                {/* Console OmniCom */}
                <Route element={<ProtectedRoute scope="platform" />}>
                  <Route path="/platform" element={<PlatformCompanies />} />
                  <Route path="/platform/team" element={<PlatformTeam />} />
                  <Route path="/platform/activities" element={<Activities endpoint="/platform/activities" title="Journal plateforme" />} />
                </Route>
  
                {/* Espace entreprise */}
                <Route element={<ProtectedRoute scope="company" />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/invoice/:id" element={<InvoiceGenerator />} />
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/deliveries" element={<Deliveries />} />
                  <Route path="/delivery/:id" element={<DeliveryNotePage />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/products" element={<ProductsList />} />
                  <Route element={<ProtectedRoute permissions={['invoices.create']} />}>
                    <Route path="/invoice" element={<InvoiceGenerator />} />
                    <Route path="/delivery/new" element={<DeliveryNotePage />} />
                  </Route>
                  <Route element={<ProtectedRoute permissions={['payments.create', 'expenses.manage', 'reports.view']} />}>
                    <Route path="/treasury" element={<Treasury />} />
                    <Route path="/daily" element={<DailyReport />} />
                  </Route>
                  <Route element={<ProtectedRoute permissions={['expenses.manage']} />}>
                    <Route path="/expenses" element={<Expenses />} />
                  </Route>
                  <Route element={<ProtectedRoute permissions={['reports.view']} />}>
                    <Route path="/reports" element={<Reports />} />
                  </Route>
                  <Route element={<ProtectedRoute permissions={['activities.view']} />}>
                    <Route path="/activities" element={<Activities />} />
                  </Route>
                  <Route element={<ProtectedRoute permissions={['users.manage']} />}>
                    <Route path="/users" element={<UsersList />} />
                  </Route>
                  <Route element={<ProtectedRoute permissions={['roles.manage']} />}>
                    <Route path="/roles" element={<Roles />} />
                  </Route>
                  <Route element={<ProtectedRoute permissions={['settings.manage']} />}>
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/template" element={<TemplateEditor />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
          </Suspense>
        </Router>
      </FeedbackProvider>
    </AuthProvider>
  );
}

export default App;
