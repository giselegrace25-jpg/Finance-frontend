import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/login/LoginPage';
import Prospera from './pages/prospera/Prospera';
import AdminPage from './pages/admin/AdminPage';

function Protected({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" replace />;
}

export default function App() {
  const showAdminLogin = window.location.search === '?admin=1';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={showAdminLogin ? <AdminPage /> : <LoginPage />} />
        <Route path="/app" element={<Protected><Prospera /></Protected>} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
