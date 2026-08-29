import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import LandingHeader from '../landingpage/header/LandingHeader';
import LandingFooter from '../landingpage/footer/LandingFooter';

const TestPage = () => {
  const [backendMessage, setBackendMessage] = useState('Loading...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTestData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/test`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.text();
        setBackendMessage(data);
      } catch (err) {
        console.error('Error fetching test route:', err);
        setError(err.message);
      }
    };

    fetchTestData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--color-bg, #0B0F19)', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}>
      <LandingHeader />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '40px', maxWidth: '500px', width: '100%', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '20px', fontWeight: '700', background: 'linear-gradient(135deg, #6366F1, #A855F7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Backend Integration Test
          </h2>
          
          <div style={{ margin: '20px 0', padding: '15px', borderRadius: '8px', background: error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: error ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)' }}>
            <p style={{ fontSize: '0.9rem', color: '#9CA3AF', textTransform: 'uppercase', tracking: '0.05em', marginBottom: '5px' }}>
              Backend Response Status
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: '600', color: error ? '#EF4444' : '#10B981' }}>
              {error ? 'Failed Connection' : 'Connected Successfully'}
            </p>
          </div>

          <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'left', fontFamily: 'monospace' }}>
            <p style={{ margin: 0, color: '#9CA3AF' }}>GET {API_URL}/api/test</p>
            <hr style={{ borderColor: 'rgba(255, 255, 255, 0.05)', margin: '10px 0' }} />
            <p style={{ margin: 0, color: error ? '#EF4444' : '#F3F4F6', fontSize: '1rem', wordBreak: 'break-all' }}>
              {error ? `Error: ${error}` : backendMessage}
            </p>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};

export default TestPage;
