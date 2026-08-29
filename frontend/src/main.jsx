import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI Runtime Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, color: 'white', fontFamily: 'sans-serif', textAlign: 'center' }}>
          <div style={{ background: 'rgba(20,24,38,0.9)', border: '1px solid rgba(254,44,85,0.4)', borderRadius: 16, padding: 32, maxWidth: 440 }}>
            <h2 style={{ color: '#FE2C55', marginBottom: 12 }}>Application Reload Required</h2>
            <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>
              {this.state.error?.message || 'An unexpected rendering issue occurred.'}
            </p>
            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{ background: '#FE2C55', color: 'white', border: 'none', borderRadius: 8, padding: '12px 20px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Reset Session & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
