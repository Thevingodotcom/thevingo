import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { initializeApp } from './AppInitializer';
import logoIcon from '../assets/icons/Frame 123.svg';

const Splash = ({ isFadingOut }) => (
  <div className={`splash-screen ${isFadingOut ? 'splash-fade-out' : ''}`}>
    <div className="splash-logo-wrapper">
      <img src={logoIcon} alt="Vingo Logo" className="splash-logo" />
      <div className="splash-loader-dots">
        <span className="splash-dot"></span>
        <span className="splash-dot"></span>
        <span className="splash-dot"></span>
      </div>
    </div>
  </div>
);

const Bootstrap = ({ children }) => {
  const { 
    isInitializing, 
    setIsInitializing, 
    isFadingOut, 
    setIsFadingOut, 
    setCurrentUser, 
    logout 
  } = useAuth();
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const startAppBootstrap = async () => {
      // Minimum display time for splash to prevent jarring flashes (750ms)
      const minDisplayPromise = new Promise(resolve => setTimeout(resolve, 750));

      try {
        // Run full initialization: load token, user session, settings, theme, validate JWT
        const initResult = await initializeApp();

        await minDisplayPromise;

        if (!isMounted) return;

        // Determine launch routing:
        // Fresh PWA / App Launch must never restore previously opened pages.
        // It always starts from startup flow and navigates to /dashboard if logged in, or /login if not.
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        const hasSessionLaunched = sessionStorage.getItem('vingo_session_launched');

        if (initResult.isValid) {
          if (initResult.user) {
            setCurrentUser(initResult.user);
          }

          // On fresh launch or standalone PWA launch, force route to /dashboard
          if (!hasSessionLaunched || isStandalone) {
            sessionStorage.setItem('vingo_session_launched', 'true');
            // If on a public marketing page or auth page during fresh launch, go to /dashboard
            const isPublicPage = ['/login', '/register', '/verify-otp', '/forgot-password', '/reset-password', '/'].includes(location.pathname);
            if (isPublicPage || isStandalone) {
              navigate('/dashboard', { replace: true });
            }
          }
        } else {
          // Token is invalid, expired, or missing: purge auth state & navigate to /login
          await logout();
          sessionStorage.setItem('vingo_session_launched', 'true');

          // For protected routes or PWA standalone launch, redirect to /login
          const isProtectedRoute = location.pathname.startsWith('/dashboard');
          if (isProtectedRoute || isStandalone) {
            navigate('/login', { replace: true });
          }
        }
      } catch (err) {
        console.error('App bootstrap error:', err);
        if (isMounted) {
          await logout();
          navigate('/login', { replace: true });
        }
      } finally {
        if (isMounted) {
          // Trigger smooth CSS fade-out transition
          setIsFadingOut(true);
          setTimeout(() => {
            if (isMounted) {
              setIsInitializing(false);
            }
          }, 350); // Matches CSS opacity transition
        }
      }
    };

    startAppBootstrap();

    return () => {
      isMounted = false;
    };
  }, []); // Run once on mount

  return (
    <>
      {isInitializing && <Splash isFadingOut={isFadingOut} />}
      <div 
        className="app-main-content-wrapper"
        style={{ 
          opacity: isInitializing && !isFadingOut ? 0 : 1, 
          transition: 'opacity 0.35s ease-in-out', 
          minHeight: '100vh',
          width: '100%' 
        }}
      >
        {children}
      </div>
    </>
  );
};

export default Bootstrap;
