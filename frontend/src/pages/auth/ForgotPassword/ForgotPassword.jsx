import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../../../config';
import logoIcon from '../../../assets/icons/Frame 123.svg';
import '../Register/Register.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'reset' })
      });

      const data = await response.json();
      if (response.ok) {
        navigate('/verify-otp', { state: { email, type: 'reset' } });
      } else {
        setError(data.message || 'Failed to send OTP. Please check your email and try again.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page-container">
      {/* Logo Above Card */}
      <div className="register-logo-wrapper">
        <Link to="/">
          <img src={logoIcon} alt="thevingo.com logo" className="register-logo-img" />
        </Link>
      </div>

      {/* Main Card */}
      <div className="register-card">
        {/* Left Column (Headers) */}
        <div className="register-card__left">
          <h2 className="register-card__title">Forgot password</h2>
          <p className="register-card__subtitle">
            Enter your email to receive an OTP<br />to reset your password
          </p>
        </div>

        {/* Right Column (Form) */}
        <form className="register-card__right" onSubmit={handleSubmit}>
          {error && <div className="register-error-msg">{error}</div>}
          
          <div className="register-form-group">
            <input
              type="email"
              className="register-input"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="register-actions-row">
            <button 
              type="submit" 
              className="register-submit-btn"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
            <Link to="/login" className="login-forgot-link" style={{ marginLeft: '16px', textDecoration: 'none', color: '#7c7c7c', fontSize: 'var(--label-size)' }}>
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
