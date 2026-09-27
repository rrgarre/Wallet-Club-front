import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import { RegistroPWA } from './components/pwa.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        {/* Service worker (PWA) + aviso «nueva versión → Recargar» */}
        <RegistroPWA />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
