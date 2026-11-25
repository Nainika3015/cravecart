/* ============================================================
   CraveCart - main.jsx
   Vite entry: styles, BrowserRouter, Toast, Auth and I18n.
   I18nProvider sits inside AuthProvider so the language choice can
   be mirrored into the signed-in user's preferences.
   ============================================================ */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './styles/global.css';
import './styles/user.css';
import './styles/admin.css';
import './styles/auth.css';
import './styles/phase3.css';
import './index.css';
import './styles/refine.css';

import App from './App.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { I18nProvider } from './i18n/I18nContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <I18nProvider>
            <App />
          </I18nProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
