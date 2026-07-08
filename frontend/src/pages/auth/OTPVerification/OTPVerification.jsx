import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_URL } from '../../../config';
import './OTPVerification.css';

const OTPVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState(new Array(6).fill(''));
  const [activeOTPIndex, setActiveOTPIndex] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  
  const inputRef = useRef(null);

  // Extract email and type from navigation state
  const email = location.state?.email || 'noreply@thevingo.com';
  const type = location.state?.type || 'registration';

  const handleOnChange = ({ target }) => {
    const { value } = target;
    const newOTP = [...otp];
    newOTP[activeOTPIndex] = value.substring(value.length - 1); // Keep only the last character entered
    
    if (!value) setOtp(newOTP);
    else setOtp(newOTP);

    // Auto focus to next input
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
    const pastedData = e.clipboardData.getData('text/plain').slice(0, 6).split('');
    if (pastedData.length > 0) {
      const newOTP = [...otp];
      let lastIndex = 0;
      pastedData.forEach((char, index) => {
        if (index < 6 && /^[a-zA-Z0-9]+$/.test(char)) {
          newOTP[index] = char;
          lastIndex = index;
        }
      });
      setOtp(newOTP);
      setActiveOTPIndex(lastIndex < 5 ? lastIndex + 1 : 5);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeOTPIndex]);

  const verifyOTP = async (e) => {
    e?.preventDefault();
    const otpValue = otp.join('');
    
    if (otpValue.length < 6) {
      setError('Please enter the complete 6-digit OTP.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpValue })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess('OTP verified successfully!');
        // Small delay to show success message before redirecting
        setTimeout(() => {
          if (type === 'reset') {
            navigate('/reset-password', { state: { email, otp: otpValue } });
          } else {
            navigate('/login');
          }
        }, 1500);
      } else {
        setError(data.message || 'Invalid OTP. Please try again.');
        setOtp(new Array(6).fill(''));
        setActiveOTPIndex(0);
      }
    } catch (err) {
      setError('Something went wrong. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    setResending(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type })
      });
      
      const data = await response.json();
      if (response.ok) {
        setSuccess('A new OTP has been sent to your email.');
        setOtp(new Array(6).fill(''));
        setActiveOTPIndex(0);
      } else {
        setError(data.message || 'Failed to resend OTP.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="otp-verification-container">
      <div className="otp-verification-card">
        <div className="otp-verification-icon">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        
        <h2>Verify Your Email</h2>
        <p className="otp-verification-subtitle">
          We've sent a 6-digit verification code to<br />
          <span>{email}</span>
        </p>

        {error && <div className="otp-error-message">{error}</div>}
        {success && <div className="otp-success-message">{success}</div>}

        <form onSubmit={verifyOTP}>
          <div className="otp-input-group" onPaste={handlePaste}>
            {otp.map((_, index) => (
              <input
                key={index}
                ref={index === activeOTPIndex ? inputRef : null}
                type="text"
                className={`otp-input ${otp[index] !== '' ? 'filled' : ''}`}
                value={otp[index]}
                onChange={handleOnChange}
                onKeyDown={(e) => handleOnKeyDown(e, index)}
                onFocus={() => setActiveOTPIndex(index)}
              />
            ))}
          </div>

          <button 
            type="submit" 
            className="otp-verify-button"
            disabled={loading || otp.join('').length < 6}
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <p className="otp-resend">
          Didn't receive the code? 
          <button onClick={resendOTP} disabled={resending}>
            {resending ? 'Sending...' : 'Resend OTP'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default OTPVerification;
