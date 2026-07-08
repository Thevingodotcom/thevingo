import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { API_URL } from '../../../config';
import logoIcon from '../../../assets/icons/Frame 123.svg';
import '../Register/Register.css'; // Re-use the exact same layout classes

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email;
  const otp = location.state?.otp;

  useEffect(() => {
    if (!email || !otp) {
      navigate('/login');
    }
  }, [email, otp, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError('Please fill in both fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword: password })
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess('Password reset successfully!');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        setError(data.message || 'Failed to reset password.');
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
          <h2 className="register-card__title">Reset password</h2>
          <p className="register-card__subtitle">
            Change password of your vingo<br />account
          </p>
        </div>

        {/* Right Column (Form) */}
        <form className="register-card__right" onSubmit={handleSubmit}>
          {error && <div className="register-error-msg">{error}</div>}
          {success && <div className="register-error-msg" style={{ color: '#16a34a' }}>{success}</div>}
          
          <div className="register-form-group">
            <input
              type="password"
              className="register-input"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="register-form-group">
            <input
              type="password"
              className="register-input"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="register-actions-row">
            <button 
              type="submit" 
              className="register-submit-btn"
              disabled={loading}
            >
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
