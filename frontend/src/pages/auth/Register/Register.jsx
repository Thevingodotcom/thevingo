import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../../config';
import { haptics } from '../../../utils/haptics';
import './Register.css';
import logoIcon from '../../../assets/icons/Frame 123.svg';
import '../OTPVerification/OTPVerification.css'; // Import OTP styles

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
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // OTP State
  const [otp, setOtp] = useState(new Array(6).fill(''));
  const [activeOTPIndex, setActiveOTPIndex] = useState(0);
  const inputRef = useRef(null);

  // OTP handlers
  const handleOnChange = ({ target }) => {
    const { value } = target;
    const newOTP = [...otp];
    newOTP[activeOTPIndex] = value.substring(value.length - 1);

    setOtp(newOTP);

    if (value && activeOTPIndex < 5) {
      setActiveOTPIndex(activeOTPIndex + 1);
    }
  };

  const handleOnKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOTP = [...otp];
      newOTP[index] = '';
      setOtp(newOTP);
      if (activeOTPIndex > 0) {
        setActiveOTPIndex(activeOTPIndex - 1);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtp(digits);
      setActiveOTPIndex(5);
    }
  };

  useEffect(() => {
    if (step === 2) {
      inputRef.current?.focus();
    }
  }, [step, activeOTPIndex]);

  const handleNextStep = async (e) => {
    e.preventDefault();
    haptics.light();
    setError('');

    if (!name || !email || !contact || !password) {
      haptics.error();
      setError('All fields in Step 1 are required.');
      return;
    }

    setLoading(true);
    try {
      // 1. Check if email is available
      const checkRes = await fetch(`${API_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const checkData = await checkRes.json();
      if (!checkRes.ok) {
        throw new Error(checkData.message || 'Email check failed.');
      }

      // 2. Send OTP
      const otpRes = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'registration' })
      });

      const otpData = await otpRes.json();
      if (!otpRes.ok) {
        throw new Error(otpData.message || 'Failed to send OTP.');
      }

      haptics.success();
      setSuccess('OTP sent to your email.');
      setStep(2);
    } catch (err) {
      haptics.error();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e?.preventDefault();
    haptics.light();
    const otpValue = otp.join('');

    if (otpValue.length < 6) {
      haptics.error();
      setError('Please enter the complete 6-digit OTP.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpValue })
      });

      const data = await response.json();

      if (response.ok) {
        haptics.success();
        setSuccess('Email verified successfully!');
        setTimeout(() => {
          setSuccess('');
          setStep(3); // Proceed to Hotel Details
        }, 1000);
      } else {
        haptics.error();
        setError(data.message || 'Invalid OTP. Please try again.');
        setOtp(new Array(6).fill(''));
        setActiveOTPIndex(0);
      }
    } catch (err) {
      haptics.error();
      setError('Something went wrong. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    haptics.light();
    setResending(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'registration' })
      });

      const data = await response.json();
      if (response.ok) {
        haptics.success();
        setSuccess('A new OTP has been sent to your email.');
        setOtp(new Array(6).fill(''));
        setActiveOTPIndex(0);
      } else {
        haptics.error();
        setError(data.message || 'Failed to resend OTP.');
      }
    } catch (err) {
      haptics.error();
      setError('Something went wrong. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    haptics.light();
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

      haptics.success();

      // Store JWT token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      onRegister?.();
    } catch (err) {
      haptics.error();
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
          <h2 className="register-card__title landing_heading2">Create account</h2>
          <p className="register-card__subtitle landing_body">
            Free limited access to Vingo<br />menu card
          </p>
        </div>

        {/* Right Column (Form) */}
        {step === 1 && (
          <form className="register-card__right" onSubmit={handleNextStep}>
            {error && <div className="register-error-msg landing_body">{error}</div>}

            <div className="register-form-group">
              <input
                type="text"
                className="register-input landing_placeholder"
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
                className="register-input landing_placeholder"
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
                className="register-input landing_placeholder"
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
                className="register-input landing_placeholder"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="register-actions-row">
              <button type="submit" className="register-submit-btn landing_button" disabled={loading}>
                {loading ? 'Checking...' : 'Next'}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form className="register-card__right" onSubmit={handleVerifyOTP}>
            <h3 className="landing_heading2" style={{ marginBottom: '8px', color: '#1e293b' }}>Verify Your Email</h3>
            <p className="landing_body" style={{ color: '#64748b', marginBottom: '24px' }}>
              We sent a 6-digit code to <br /><span style={{ color: '#f97316', fontWeight: 'var(--weight-semibold)' }}>{email}</span>
            </p>

            {error && <div className="otp-error-message landing_body" style={{ width: '100%' }}>{error}</div>}
            {success && <div className="otp-success-message landing_body" style={{ width: '100%' }}>{success}</div>}

            <div className="otp-input-group" onPaste={handlePaste} style={{ width: '100%', justifyContent: 'flex-start' }}>
              {otp.map((_, index) => (
                <input
                  key={index}
                  ref={index === activeOTPIndex ? inputRef : null}
                  type="text"
                  className={`otp-input landing_placeholder ${otp[index] !== '' ? 'filled' : ''}`}
                  value={otp[index]}
                  onChange={handleOnChange}
                  onKeyDown={(e) => handleOnKeyDown(e, index)}
                  onFocus={() => setActiveOTPIndex(index)}
                  style={{ width: '40px', height: '48px' }}
                />
              ))}
            </div>

            <div className="register-actions-row">
              <button
                type="submit"
                className="register-submit-btn landing_button"
                disabled={loading || otp.join('').length < 6}
                style={{ padding: '10px 24px' }}
              >
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={loading}
                className="landing_anchor"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  marginLeft: '16px',
                  cursor: 'pointer'
                }}
              >
                Back to details
              </button>
            </div>

            <p className="otp-resend landing_body" style={{ marginTop: '16px' }}>
              Didn't receive the code?
              <button type="button" onClick={handleResendOTP} disabled={resending} className="landing_anchor">
                {resending ? 'Sending...' : 'Resend OTP'}
              </button>
            </p>
          </form>
        )}

        {step === 3 && (
          <form className="register-card__right" onSubmit={handleSubmit}>
            {error && <div className="register-error-msg landing_body">{error}</div>}
            {success && <div className="otp-success-message landing_body" style={{ marginBottom: '12px' }}>{success}</div>}

            <div className="register-form-group">
              <input
                type="text"
                className="register-input landing_placeholder"
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
                className="register-input landing_placeholder"
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
                className="register-input landing_placeholder"
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
                className="register-input landing_placeholder"
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
                className="register-input landing_placeholder"
                placeholder="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="register-actions-row">
              <button type="submit" className="register-submit-btn landing_button" style={{ padding: '10px 24px' }} disabled={loading}>
                {loading ? 'Creating...' : 'Create account'}
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={loading}
                className="landing_anchor"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  marginLeft: '16px',
                  cursor: 'pointer'
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
