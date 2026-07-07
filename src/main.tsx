import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppThemeProvider } from './theme';
import { AuthProvider } from './auth/AuthProvider';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppThemeProvider>
      <AuthProvider>
        {/* HashRouter avoids GitHub Pages 404-on-refresh under the subpath. */}
        <HashRouter>
          <App />
        </HashRouter>
      </AuthProvider>
    </AppThemeProvider>
  </React.StrictMode>
);
