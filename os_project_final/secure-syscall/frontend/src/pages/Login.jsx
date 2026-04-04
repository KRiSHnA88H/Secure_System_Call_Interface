import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="grid-bg" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Left Panel */}
      <div className="auth-left">
        <div className="auth-brand">
          <div className="brand-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="6" stroke="url(#g1)" strokeWidth="1.5" />
              <path d="M8 16l4 4 8-8" stroke="url(#g2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="g1" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#5865f2"/>
                  <stop offset="1" stopColor="#a855f7"/>
                </linearGradient>
                <linearGradient id="g2" x1="8" y1="12" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#5865f2"/>
                  <stop offset="1" stopColor="#00d4ff"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="brand-name">SecureSysCall</span>
        </div>

        <div className="auth-hero">
          <h1 className="auth-headline">
            Execute Linux<br />
            <span className="gradient-text">System Calls</span><br />
            Securely.
          </h1>
          <p className="auth-sub">
            A sandboxed environment for authorized kernel-level operations
            with complete audit logging and real-time monitoring.
          </p>
        </div>

        <div className="auth-features">
          {[
            { icon: '🔒', text: 'JWT Authentication' },
            { icon: '📋', text: 'Complete Audit Logs' },
            { icon: '🛡️', text: 'Command Whitelist' },
            { icon: '⚡', text: 'Real-time Execution' },
          ].map((f) => (
            <div className="feature-pill" key={f.text}>
              <span>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        <div className="terminal-preview">
          <div className="terminal-bar">
            <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
            <span className="terminal-title">syscall@secure:~$</span>
          </div>
          <div className="terminal-body">
            <div className="term-line"><span className="prompt">$</span> uname -a</div>
            <div className="term-output">Linux secure-host 6.1.0 #1 SMP x86_64 GNU/Linux</div>
            <div className="term-line"><span className="prompt">$</span> free -h</div>
            <div className="term-output">              total   used   free</div>
            <div className="term-output">Mem:           16G    4.2G   11G</div>
            <div className="term-line"><span className="prompt">$</span> <span className="cursor-blink">█</span></div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="auth-right">
        <div className="auth-form-container animate-fade-up">
          <div className="auth-form-header">
            <h2>Welcome back</h2>
            <p>Sign in to your secure terminal</p>
          </div>

          {error && (
            <div className="auth-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 4l6 5 6-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  type="email"
                  className="input-field with-icon"
                  placeholder="admin@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 7V5a3 3 0 116 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  type="password"
                  className="input-field with-icon"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary btn-full" disabled={loading}>
              {loading ? <><span className="spinner" /> Authenticating...</> : 'Sign In →'}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/register">Create account →</Link>
          </p>

          <div className="auth-footer-note">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 5.5v3M6 4h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            All commands are logged and monitored for security
          </div>
        </div>
      </div>
    </div>
  );
}
