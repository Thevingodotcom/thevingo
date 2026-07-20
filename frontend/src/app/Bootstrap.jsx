import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_URL } from '../config';
import logoIcon from '../assets/icons/Frame 123.svg';

const Splash = ({ isFadingOut }) => (
  <div className={`splash-screen ${isFadingOut ? 'splash-fade-out' : ''}`}>
    <img src={logoIcon} alt="Vingo Logo" className="splash-logo" />
  </div>
);

const Bootstrap = ({ children, setCurrentUser }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only intercept on the very first mount of Bootstrap.
    // In React Router v6, if this component wraps <Routes>, it stays mounted.
    // If the PWA is launched, it mounts.
    const initApp = async () => {
      // Prevent running this on subsequent internal navigation by using sessionStorage
      const hasInitialized = sessionStorage.getItem('app_initialized');
      
      if (hasInitialized) {
        // App was already initialized in this session tab, no need to intercept
        setIsInitializing(false);
        return;
      }

      const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      
      if (!isPWA) {
        // Normal browser visit: just restore state and let standard routing handle it
        const savedUser = localStorage.getItem('user');
        if (savedUser) setCurrentUser(JSON.parse(savedUser));
        setIsInitializing(false);
        sessionStorage.setItem('app_initialized', 'true');
        return;
      }

      sessionStorage.setItem('app_initialized', 'true');

      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          // No token, must login
          navigate('/login', { replace: true });
          return;
        }

        // Validate token (or just check if offline)
        const response = await fetch(`${API_URL}/api/menu/categories`, { // Using categories as a proxy for validation since validate endpoint might not exist
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => ({ ok: true, offline: true })); // Treat offline as valid if we have a token

        if (response.offline || response.ok) {
          const savedUser = localStorage.getItem('user');
          if (savedUser) setCurrentUser(JSON.parse(savedUser));
          
          navigate('/dashboard', { replace: true });
        } else {
          // Token is likely invalid/expired
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setCurrentUser(null);
          navigate('/login', { replace: true });
        }
      } catch (err) {
        navigate('/login', { replace: true });
      } finally {
        // Smooth fade out
        setIsFadingOut(true);
        setTimeout(() => {
          setIsInitializing(false);
        }, 300); // 300ms matches CSS transition
      }
    };
    
    // Add a minimum display time for the splash screen so it's not a flash
    const minSplashTime = new Promise(resolve => setTimeout(resolve, 800));
    const initTask = initApp();

    Promise.all([initTask, minSplashTime]);
  }, [navigate, setCurrentUser]);

  return (
    <>
      {isInitializing && <Splash isFadingOut={isFadingOut} />}
      <div style={{ opacity: isInitializing && !isFadingOut ? 0 : 1, transition: 'opacity 0.3s ease', height: '100%' }}>
        {(!isInitializing || isFadingOut) && children}
      </div>
    </>
  );
};

export default Bootstrap;
