import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CallProvider } from './context/CallContext.jsx';
import './index.css';

// Note: intentionally not using React.StrictMode here. StrictMode double-invokes
// effects in development to help catch bugs in pure UI code, but this app opens
// live connections (Socket.io, WebRTC peer connections) inside effects - double-
// invoking those means joining the call room twice, which is what was causing
// duplicate video tiles for the same participant.
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <CallProvider>
        <App />
      </CallProvider>
    </AuthProvider>
  </BrowserRouter>
);
