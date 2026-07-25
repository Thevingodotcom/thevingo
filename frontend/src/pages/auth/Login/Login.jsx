import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../../config';
import { haptics } from '../../../utils/haptics';
import './Login.css';
import logoIcon from '../../../assets/icons/Frame 123.svg';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    haptics.light();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usernameOrEmail: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid username/email or password.');
      }

      // Haptics on Login Success
      haptics.success();

      // Store JWT token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      onLogin?.();
    } catch (err) {
      // Haptics on Login Failed
      haptics.error();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      {/* Logo Above Card */}
      <div className="login-logo-wrapper">
        <Link to="/">
          <img src={logoIcon} alt="thevingo.com logo" className="login-logo-img" />
        </Link>
      </div>

      {/* Main Card */}
      <div className="login-card">
        {/* Left Column (Headers) */}
        <div className="login-card__left">
          <h2 className="login-card__title landing_heading2">Login</h2>
          <p className="login-card__subtitle landing_body">Login to your vingo account</p>
        </div>

        {/* Right Column (Form) */}
        <form className="login-card__right" onSubmit={handleSubmit}>
          {error && <div className="login-error-msg landing_body">{error}</div>}

          <div className="login-form-group">
            <input
              type="text"
              className="login-input landing_placeholder"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="login-form-group">
            <input
              type="password"
              className="login-input landing_placeholder"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="login-actions-row">
            <button type="submit" className="login-submit-btn landing_button" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <Link to="/forgot-password" className="login-forgot-link landing_anchor">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
