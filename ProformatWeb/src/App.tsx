import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
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
import Activities from './pages/Activities';
import SettingsPage from './pages/Settings';
import Profile from './pages/Profile';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoice" element={<InvoiceGenerator />} />
              <Route path="/invoice/:id" element={<InvoiceGenerator />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/products" element={<ProductsList />} />
              <Route path="/profile" element={<Profile />} />
              <Route element={<ProtectedRoute roles={['admin', 'manager']} />}>
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/activities" element={<Activities />} />
              </Route>
              <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="/users" element={<UsersList />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
