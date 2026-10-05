import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/app.css';
import './styles/dashboard.css';
import './styles/aichat.css';

/* A direct refresh of an SPA path first receives public/404.html on GitHub
   Pages. That page returns to the app shell and leaves the intended URL here. */
const pendingPath = sessionStorage.getItem('neighbor-cart:pending-path');
if (pendingPath) {
  sessionStorage.removeItem('neighbor-cart:pending-path');
  window.history.replaceState(null, '', pendingPath);
}

createRoot(document.getElementById('root')).render(<App />);
