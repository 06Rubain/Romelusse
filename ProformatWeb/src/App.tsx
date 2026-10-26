import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import InvoiceGenerator from './pages/InvoiceGenerator';
import Payments from './pages/Payments';
import Clients from './pages/Clients';
import ProductsList from './pages/ProductsList';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import UsersList from './pages/UsersList';
import Roles from './pages/Roles';
import Activities from './pages/Activities';
import SettingsPage from './pages/Settings';
import TemplateEditor from './pages/TemplateEditor';
import Profile from './pages/Profile';
import PlatformCompanies from './pages/PlatformCompanies';
import PlatformTeam from './pages/PlatformTeam';
import './index.css';

function Home() {
  const { user, acting } = useAuth();
  return <Navigate to={user?.isSuperAdmin && !acting ? '/platform' : '/dashboard'} replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
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
                <Route path="/clients" element={<Clients />} />
                <Route path="/products" element={<ProductsList />} />
                <Route element={<ProtectedRoute permissions={['invoices.create']} />}>
                  <Route path="/invoice" element={<InvoiceGenerator />} />
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
      </Router>
    </AuthProvider>
  );
}

export default App;
