import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { API_URL } from './config';
import logoIcon from './assets/icons/Frame 123.svg';

// SVG assets import
import kitchenMenuIcon from './assets/icons/kitchenMenu.svg';
import offerIcon from './assets/icons/offer.svg';
import distributionIcon from './assets/icons/distribution.svg';
import settingIcon from './assets/icons/setting.svg';

// Page components import
import Dashboard from './pages/dashboard/Dashboard/Dashboard';
import MenuList from './pages/kitchen-menu/MenuList/MenuList';
import Offers from './pages/offers/Offers/Offers';
import Distribution from './pages/distribution/Distribution/Distribution';
import Settings from './pages/settings/Settings/Settings';
import LandingPage from './pages/landingpage/LandingPage';
import Login from './pages/auth/Login/Login';
import PricingPage from './pages/pricing/PricingPage';
import ProductPage from './pages/product/ProductPage';
import Register from './pages/auth/Register/Register';
import PublicMenu from './pages/public-menu/PublicMenu';
import OTPVerification from './pages/auth/OTPVerification/OTPVerification';
import ResetPassword from './pages/auth/ResetPassword/ResetPassword';
import ForgotPassword from './pages/auth/ForgotPassword/ForgotPassword';
import TestPage from './pages/test/TestPage';

// Application Architecture & Route Guards
import Bootstrap from './app/Bootstrap';
import { useAuth } from './app/AuthContext';
import { ProtectedRoute as PrivateRoute, PublicRoute } from './app/RouteGuard';
import authStorage from './app/authStorage';
import UserMenu from './app/UserMenu';
import { useTheme } from './app/ThemeContext';
import { haptics } from './utils/haptics';

// Fetch JSON bypassing the HTTP cache; resolves null on non-2xx responses
const fetchJsonNoStore = async (url, headers) => {
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
};

// Ignore a refresh request if the shared data was fetched this recently (ms)
const DASHBOARD_REFRESH_MIN_INTERVAL = 2000;

// Custom Speedometer/Dashboard SVG Icon
const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15a8 8 0 1 1 16 0" />
    <path d="M12 15h.01" />
    <path d="M12 11V7" />
    <path d="M8 12l3-3" />
  </svg>
);

// Hamburger menu icon inline SVG
const HamburgerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

// Dashboard Layout Shell
const DashboardLayout = ({ currentUser, handleLogout, isSidebarCollapsed, setIsSidebarCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef(null);
  const hamburgerRef = useRef(null);
  // Dark mode is scoped to the dashboard app only (see ThemeContext.jsx): applying
  // it here, on .app-container, keeps the public site / auth pages untouched.
  const { theme } = useTheme();

  // Close sidebar drawer on click outside (mobile only)
  useEffect(() => {
    function handleClickOutside(event) {
      if (window.innerWidth <= 768 && !isSidebarCollapsed) {
        if (
          sidebarRef.current && 
          !sidebarRef.current.contains(event.target) &&
          hamburgerRef.current &&
          !hamburgerRef.current.contains(event.target)
        ) {
          setIsSidebarCollapsed(true);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarCollapsed, setIsSidebarCollapsed]);

  // Close sidebar drawer on page navigation (mobile only)
  useEffect(() => {
    if (window.innerWidth <= 768) {
      setIsSidebarCollapsed(true);
    }
  }, [location.pathname, setIsSidebarCollapsed]);

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/dashboard/kitchen-menu') return 'kitchen';
    if (path === '/dashboard/offers') return 'offers';
    if (path === '/dashboard/distribution') return 'distribution';
    if (path === '/dashboard/settings') return 'setting';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  const onLogoutClick = () => {
    haptics.warning();
    handleLogout();
  };

  return (
    <div className="app-container" data-theme={theme}>
      {/* Navbar Header */}
      <header className="navbar">
        <div className="navbar-left">
          <button ref={hamburgerRef} className="hamburger-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
            <HamburgerIcon />
          </button>
          <div 
            className="logo-container" 
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', marginLeft: '12px', cursor: 'pointer' }}
          >
            <img src={logoIcon} alt="TheVingo.com" style={{ height: '22px', display: 'block' }} />
          </div>
        </div>

        <div className="navbar-right">
          <UserMenu currentUser={currentUser} onLogout={onLogoutClick} />
        </div>
      </header>

      {/* Main Layout containing Sidebar + Content area */}
      <div className="main-layout">
        {/* Sidebar Nav */}
        <aside ref={sidebarRef} className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div
            className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              haptics.selection();
              navigate('/dashboard');
            }}
          >
            <div className="sidebar-icon">
              <DashboardIcon />
            </div>
            <span className="sidebar-text">Dashboard</span>
          </div>

          <div
            className={`sidebar-item ${activeTab === 'kitchen' ? 'active' : ''}`}
            onClick={() => {
              haptics.selection();
              navigate('/dashboard/kitchen-menu');
            }}
          >
            <div className="sidebar-icon">
              <img src={kitchenMenuIcon} alt="Kitchen menu" style={{ width: '18px', height: '18px' }} />
            </div>
            <span className="sidebar-text">Kitchen menu</span>
          </div>

          <div
            className={`sidebar-item ${activeTab === 'offers' ? 'active' : ''}`}
            onClick={() => {
              haptics.selection();
              navigate('/dashboard/offers');
            }}
          >
            <div className="sidebar-icon">
              <img src={offerIcon} alt="Offers" style={{ width: '18px', height: '18px' }} />
            </div>
            <span className="sidebar-text">Offers</span>
          </div>

          <div
            className={`sidebar-item ${activeTab === 'distribution' ? 'active' : ''}`}
            onClick={() => {
              haptics.selection();
              navigate('/dashboard/distribution');
            }}
          >
            <div className="sidebar-icon">
              <img src={distributionIcon} alt="Distribution" style={{ width: '18px', height: '18px' }} />
            </div>
            <span className="sidebar-text">Distribution</span>
          </div>

          <div
            className={`sidebar-item ${activeTab === 'setting' ? 'active' : ''}`}
            onClick={() => {
              haptics.selection();
              navigate('/dashboard/settings');
            }}
          >
            <div className="sidebar-icon">
              <img src={settingIcon} alt="Setting" style={{ width: '18px', height: '18px' }} />
            </div>
            <span className="sidebar-text">Setting</span>
          </div>
        </aside>

        {/* Content Area */}
        <main className="content-wrapper">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Kitchen menu route: Settings -> "Open Trash" navigates here with
// `state: { openTrash: true }`. The request is cleared (replace) once MenuList
// has handled it, so Back/refresh doesn't reopen Trash.
function KitchenMenuRoute({ categories, setCategories, onMenuRefresh }) {
  const location = useLocation();
  const navigate = useNavigate();
  const openTrashRequested = Boolean(location.state && location.state.openTrash);

  const handleTrashRequestHandled = useCallback(() => {
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [navigate, location.pathname, location.search]);

  return (
    <MenuList
      categories={categories}
      setCategories={setCategories}
      onMenuRefresh={onMenuRefresh}
      openTrashRequested={openTrashRequested}
      onTrashRequestHandled={handleTrashRequestHandled}
    />
  );
}

// Component to automatically scroll to the top of the page on route changes
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, login, logout } = useAuth();

  // Logout lands on the home page. The current (/dashboard...) history entry is
  // replaced so Back doesn't return to a dead protected page. logout() clears the
  // session synchronously and tells ProtectedRoute to send stragglers to '/' (not
  // /login), because router location updates are transitions and may commit after
  // the auth state update.
  const handleLogout = useCallback(() => {
    navigate('/', { replace: true });
    logout({ redirectTo: '/' });
  }, [navigate, logout]);

  // After Login/Register: sync the stored session into AuthContext and replace the
  // /login (or /register) entry, so Back from the dashboard goes to the page before it.
  const handleAuthSuccess = useCallback(() => {
    try {
      login(authStorage.getUser(), authStorage.getToken());
    } catch (e) {
      console.error(e);
    }
    navigate('/dashboard', { replace: true });
  }, [login, navigate]);

  // Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth <= 768);

  // Shared Data State
  const [categories, setCategoriesState] = useState([]);
  const [offers, setOffersState] = useState([]);
  const [scanCount, setScanCount] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Bumped whenever the session user changes, so responses for a previous user are dropped
  const dataGenerationRef = useRef(0);
  const lastDataFetchAtRef = useRef(0);
  // Bumped on every local edit (MenuList / Offers) so an in-flight refresh can't overwrite it
  const categoriesEditRef = useRef(0);
  const offersEditRef = useRef(0);

  const setCategories = useCallback((value) => {
    categoriesEditRef.current += 1;
    setCategoriesState(value);
  }, []);

  const setOffers = useCallback((value) => {
    offersEditRef.current += 1;
    setOffersState(value);
  }, []);

  // Fetch categories (dishes), offers and scan stats. `silent` keeps the current
  // counts on screen instead of showing the "..." loading placeholder.
  const loadDashboardData = useCallback(async ({ silent = false } = {}) => {
    const token = authStorage.getToken();
    if (!token) return;

    const generation = dataGenerationRef.current;
    const categoriesEdit = categoriesEditRef.current;
    const offersEdit = offersEditRef.current;
    lastDataFetchAtRef.current = Date.now();
    if (!silent) setIsDataLoading(true);

    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [catResult, offResult, statsResult] = await Promise.allSettled([
        fetchJsonNoStore(`${API_URL}/api/menu/categories`, headers),
        fetchJsonNoStore(`${API_URL}/api/offers`, headers),
        fetchJsonNoStore(`${API_URL}/api/auth/dashboard`, headers)
      ]);

      if (generation !== dataGenerationRef.current) return;

      if (catResult.status === 'fulfilled' && catResult.value && categoriesEdit === categoriesEditRef.current) {
        setCategoriesState(catResult.value.categories || []);
      }
      if (offResult.status === 'fulfilled' && offResult.value && offersEdit === offersEditRef.current) {
        setOffersState(offResult.value.offers || []);
      }
      if (statsResult.status === 'fulfilled' && typeof statsResult.value?.stats?.scanCount === 'number') {
        setScanCount(statsResult.value.stats.scanCount);
      }
      [catResult, offResult, statsResult].forEach((result) => {
        if (result.status === 'rejected') {
          console.error('Failed to fetch dashboard data:', result.reason);
        }
      });
    } finally {
      if (!silent && generation === dataGenerationRef.current) {
        setIsDataLoading(false);
      }
    }
  }, []);

  // Called when the dashboard index mounts so counts reflect edits made elsewhere
  const refreshDashboardData = useCallback(() => {
    if (Date.now() - lastDataFetchAtRef.current < DASHBOARD_REFRESH_MIN_INTERVAL) return;
    loadDashboardData({ silent: true });
  }, [loadDashboardData]);

  // After restoring dishes from Trash: reload categories so restored dishes
  // (and revived categories) appear without a page refresh.
  const refreshMenuData = useCallback(() => {
    loadDashboardData({ silent: true });
  }, [loadDashboardData]);

  const openDishTrash = useCallback(() => {
    navigate('/dashboard/kitchen-menu', { state: { openTrash: true } });
  }, [navigate]);

  // Shared Settings state
  const [restaurantName, setRestaurantName] = useState('thevingo.com');
  const [tagline, setTagline] = useState('Menu Card every restaurant need');
  const [hotelAddress, setHotelAddress] = useState('');
  const [hotelCity, setHotelCity] = useState('');
  const [hotelState, setHotelState] = useState('');

  useEffect(() => {
    if (currentUser) {
      setRestaurantName(currentUser.restaurant_name || 'thevingo.com');
      setTagline(currentUser.tagline || 'Menu Card every restaurant need');
      setHotelAddress(currentUser.hotel_address || '');
      setHotelCity(currentUser.hotel_city || '');
      setHotelState(currentUser.hotel_state || '');
    } else {
      setRestaurantName('thevingo.com');
      setTagline('Menu Card every restaurant need');
      setHotelAddress('');
      setHotelCity('');
      setHotelState('');
    }
  }, [currentUser]);

  // Key the shared-data effect on the session user's identity (not the object), so
  // unrelated profile updates (avatar, settings) or Bootstrap re-setting the same user
  // don't tear down the SSE stream and refetch everything.
  const sessionUserKey = currentUser ? String(currentUser.id ?? currentUser.email ?? 'user') : null;
  const scanStreamId = currentUser
    ? (currentUser.restaurant_name
      ? currentUser.restaurant_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : (currentUser.id ? currentUser.id.toString() : ''))
    : '';

  useEffect(() => {
    dataGenerationRef.current += 1;
    const generation = dataGenerationRef.current;

    if (!sessionUserKey) {
      setCategoriesState([]);
      setOffersState([]);
      setScanCount(0);
      setIsDataLoading(false);
      return;
    }

    loadDashboardData();

    // Dedicated silent fetcher for scan count updates (doesn't trigger full loading spinner)
    const fetchDashboardScanCount = async () => {
      try {
        const token = authStorage.getToken();
        if (!token) return;
        const res = await fetch(`${API_URL}/api/auth/dashboard?_t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (generation === dataGenerationRef.current && data?.stats && typeof data.stats.scanCount === 'number') {
            setScanCount(data.stats.scanCount);
          }
        }
      } catch {
        // Silent sync
      }
    };

    // 1. Server-Sent Events (SSE) for instant real-time scan count sync from any device
    let eventSource = null;
    if (scanStreamId && typeof EventSource !== 'undefined') {
      try {
        eventSource = new EventSource(`${API_URL}/api/menu/public/${scanStreamId}/stream`);
        eventSource.addEventListener('scan-updated', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && typeof data.scanCount === 'number') {
              setScanCount(data.scanCount);
            } else {
              fetchDashboardScanCount();
            }
          } catch {
            fetchDashboardScanCount();
          }
        });
      } catch {
        // SSE not supported or network error
      }
    }

    // 2. Same-browser instant cross-tab sync via BroadcastChannel
    let broadcastChannel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        broadcastChannel = new BroadcastChannel('thevingo_scan_updates');
        broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'SCAN_COUNT_UPDATED') {
            if (typeof event.data.scanCount === 'number') {
              setScanCount(event.data.scanCount);
            } else {
              fetchDashboardScanCount();
            }
          }
        };
      } catch {
        // BroadcastChannel ignored
      }
    }

    // 3. Revalidate scan count whenever user focuses or returns to the dashboard tab
    const handleRevalidation = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchDashboardScanCount();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleRevalidation);
      document.addEventListener('visibilitychange', handleRevalidation);
    }

    // 4. Fallback background polling (every 10 seconds while active)
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchDashboardScanCount();
      }
    }, 10000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (broadcastChannel) {
        broadcastChannel.close();
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleRevalidation);
        document.removeEventListener('visibilitychange', handleRevalidation);
      }
      clearInterval(pollInterval);
    };
  }, [sessionUserKey, scanStreamId, loadDashboardData]);

  return (
    <Bootstrap>
      <ScrollToTop />
      <Routes>
      {/* Landing Page */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/product" element={<ProductPage />} />
      <Route path="/menu/:userId" element={<PublicMenu />} />
      <Route path="/test" element={<TestPage />} />

      {/* Login Route (Protected by PublicRoute guard) */}
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login onLogin={handleAuthSuccess} />
          </PublicRoute>
        } 
      />

      <Route 
        path="/register" 
        element={
          <PublicRoute>
            <Register onRegister={handleAuthSuccess} />
          </PublicRoute>
        } 
      />

      <Route 
        path="/verify-otp" 
        element={
          <PublicRoute>
            <OTPVerification />
          </PublicRoute>
        } 
      />

      <Route 
        path="/forgot-password" 
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        } 
      />

      <Route 
        path="/reset-password" 
        element={
          <PublicRoute>
            <ResetPassword />
          </PublicRoute>
        } 
      />

      {/* Dashboard Routes (Protected by PrivateRoute guard) */}
      <Route 
        path="/dashboard" 
        element={
          <PrivateRoute>
            <DashboardLayout 
              currentUser={currentUser}
              handleLogout={handleLogout}
              isSidebarCollapsed={isSidebarCollapsed} 
              setIsSidebarCollapsed={setIsSidebarCollapsed} 
            />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard categories={categories} offers={offers} scanCount={scanCount} isDataLoading={isDataLoading} onRefresh={refreshDashboardData} />} />
        <Route path="kitchen-menu" element={<KitchenMenuRoute categories={categories} setCategories={setCategories} onMenuRefresh={refreshMenuData} />} />
        <Route path="offers" element={<Offers offers={offers} setOffers={setOffers} categories={categories} />} />
        <Route path="distribution" element={<Distribution restaurantName={restaurantName} setRestaurantName={setRestaurantName} tagline={tagline} setTagline={setTagline} currentUser={currentUser} />} />
        <Route path="settings" element={<Settings categories={categories} onOpenTrash={openDishTrash} currentUser={currentUser} setCurrentUser={setCurrentUser} restaurantName={restaurantName} setRestaurantName={setRestaurantName} tagline={tagline} setTagline={setTagline} hotelAddress={hotelAddress} setHotelAddress={setHotelAddress} hotelCity={hotelCity} setHotelCity={setHotelCity} hotelState={hotelState} setHotelState={setHotelState} />} />
      </Route>

      {/* Fallback redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Bootstrap>
  );
}

export default App;
