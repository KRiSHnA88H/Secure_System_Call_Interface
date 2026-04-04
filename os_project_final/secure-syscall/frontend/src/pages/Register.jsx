import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

function getPasswordStrength(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthClasses = ['', 'active-weak', 'active-fair', 'active-good', 'active-strong'];

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const strength = getPasswordStrength(form.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      return setError('Passwords do not match.');
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
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
              <rect x="2" y="2" width="28" height="28" rx="6" stroke="url(#g1r)" strokeWidth="1.5" />
              <path d="M8 16l4 4 8-8" stroke="url(#g2r)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="g1r" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#5865f2"/><stop offset="1" stopColor="#a855f7"/>
                </linearGradient>
                <linearGradient id="g2r" x1="8" y1="12" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#5865f2"/><stop offset="1" stopColor="#00d4ff"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="brand-name">SecureSysCall</span>
        </div>

        <div className="auth-hero">
          <h1 className="auth-headline">
            Join the<br />
            <span className="gradient-text">Secure Shell</span><br />
            Network.
          </h1>
          <p className="auth-sub">
            Create your account and gain access to the sandboxed Linux system call
            executor. Every operation is tracked, audited, and secured.
          </p>
        </div>

        <div className="auth-features">
          {[
            { icon: '🔐', text: 'Encrypted Passwords' },
            { icon: '📊', text: 'Personal Dashboards' },
            { icon: '🔍', text: 'Execution History' },
            { icon: '🧱', text: 'Sandboxed Commands' },
          ].map((f) => (
            <div className="feature-pill" key={f.text}>
              <span>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        <div className="info-cards">
          <div className="info-card">
            <div className="info-card-icon">📁</div>
            <div>
              <div className="info-card-title">Filesystem Commands</div>
              <div className="info-card-desc">ls, pwd, df, du, mount</div>
            </div>
          </div>
          <div className="info-card">
            <div className="info-card-icon">⚙️</div>
            <div>
              <div className="info-card-title">System Info</div>
              <div className="info-card-desc">uname, uptime, hostname, free</div>
            </div>
          </div>
          <div className="info-card">
            <div className="info-card-icon">🌐</div>
            <div>
              <div className="info-card-title">Network Commands</div>
              <div className="info-card-desc">ifconfig, ip addr, netstat, ss</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right">
        <div className="auth-form-container animate-fade-up">
          <div className="auth-form-header">
            <h2>Create account</h2>
            <p>Set up your secure terminal access</p>
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
              <label className="form-label">Username</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  className="input-field with-icon"
                  placeholder="johndoe"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  minLength={3}
                  required
                />
              </div>
            </div>

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
                  placeholder="john@example.com"
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
              {form.password && (
                <div className="password-strength">
                  <div className="strength-bars">
                    {[1,2,3,4].map((n) => (
                      <div
                        key={n}
                        className={`strength-bar ${strength >= n ? strengthClasses[strength] : ''}`}
                      />
                    ))}
                  </div>
                  <div className="strength-text">{strengthLabels[strength]}</div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M13 7L6 14l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  type="password"
                  className={`input-field with-icon ${form.confirm && form.confirm !== form.password ? 'input-mismatch' : ''}`}
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary btn-full" disabled={loading}>
              {loading ? <><span className="spinner" /> Creating account...</> : 'Create Account →'}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <p className="auth-switch">
            Already have an account?{' '}
            <Link to="/login">Sign in →</Link>
          </p>

          <div className="auth-footer-note">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 5.5v3M6 4h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            By registering, you agree to responsible system usage
          </div>
        </div>
      </div>
    </div>
  );
}
