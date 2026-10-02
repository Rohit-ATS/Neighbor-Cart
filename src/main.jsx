import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/ui.css';
import './styles/screens.css';

createRoot(document.getElementById('root')).render(<App />);
