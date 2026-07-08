import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../../config';
import './Register.css';
import logoIcon from '../../../assets/icons/Frame 123.svg';

const Register = ({ onRegister }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  
  const [hotelName, setHotelName] = useState('');
  const [hotelAddress, setHotelAddress] = useState('');
  const [hotelCity, setHotelCity] = useState('');
  const [hotelState, setHotelState] = useState('');
  const [tagline, setTagline] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNextStep = async (e) => {
    e.preventDefault();
    setError('');
    // Input validation for step 1
    if (!name || !email || !contact || !password) {
      setError('All fields in Step 1 are required.');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Email check failed.');
      }

      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          contact,
          password,
          restaurant_name: hotelName,
          tagline: tagline || null,
          hotel_address: hotelAddress || null,
          hotel_city: hotelCity || null,
          hotel_state: hotelState || null
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed.');
      }

      // Store JWT token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      onRegister?.();
    } catch (err) {
      setError(err.message);
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
          <h2 className="register-card__title">Create account</h2>
          <p className="register-card__subtitle">
            Free limited access to Vingo<br />menu card
          </p>
        </div>

        {/* Right Column (Form) */}
        {step === 1 ? (
          <form className="register-card__right" onSubmit={handleNextStep}>
            {error && <div className="register-error-msg">{error}</div>}
            
            <div className="register-form-group">
              <input
                type="text"
                className="register-input"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="register-form-group">
              <input
                type="email"
                className="register-input"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="register-form-group">
              <input
                type="text"
                className="register-input"
                placeholder="Contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="register-form-group">
              <input
                type="password"
                className="register-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="register-actions-row">
              <button type="submit" className="register-submit-btn" disabled={loading}>
                {loading ? 'Checking...' : 'Next'}
              </button>
            </div>
          </form>
        ) : (
          <form className="register-card__right" onSubmit={handleSubmit}>
            {error && <div className="register-error-msg">{error}</div>}
            
            <div className="register-form-group">
              <input
                type="text"
                className="register-input"
                placeholder="Hotel name"
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="register-form-group">
              <input
                type="text"
                className="register-input"
                placeholder="Hotel address"
                value={hotelAddress}
                onChange={(e) => setHotelAddress(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="register-form-group">
              <input
                type="text"
                className="register-input"
                placeholder="Hotel located city"
                value={hotelCity}
                onChange={(e) => setHotelCity(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="register-form-group">
              <input
                type="text"
                className="register-input"
                placeholder="Hotel located state"
                value={hotelState}
                onChange={(e) => setHotelState(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="register-form-group">
              <input
                type="text"
                className="register-input"
                placeholder="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="register-actions-row">
              <button type="submit" className="register-submit-btn" style={{ padding: '10px 24px' }} disabled={loading}>
                {loading ? 'Creating...' : 'Create account'}
              </button>
              <button 
                type="button" 
                className="register-back-btn" 
                onClick={() => setStep(1)} 
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7c7c7c',
                  marginLeft: '16px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Register;
