import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { API_URL } from './config';
import './App.css';
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

// Route guards
import PrivateRoute from './routes/PrivateRoute';
import PublicRoute from './routes/PublicRoute';

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
const DashboardLayout = ({ currentUser, getInitials, handleLogout, isSidebarCollapsed, setIsSidebarCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef(null);
  const hamburgerRef = useRef(null);

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

  return (
    <div className="app-container">
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
          <div className="user-profile">
            <h4 className="user-name">{currentUser ? currentUser.username : 'Krishna Ram'}</h4>
            <p className="user-role">{currentUser ? currentUser.role : 'Admin'}</p>
          </div>
          <div className="user-avatar">
            {getInitials(currentUser ? currentUser.username : 'Krishna Ram')}
          </div>
          <button className="navbar-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Layout containing Sidebar + Content area */}
      <div className="main-layout">
        {/* Sidebar Nav */}
        <aside ref={sidebarRef} className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div
            className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard')}
          >
            <div className="sidebar-icon">
              <DashboardIcon />
            </div>
            <span className="sidebar-text">Dashboard</span>
          </div>

          <div
            className={`sidebar-item ${activeTab === 'kitchen' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard/kitchen-menu')}
          >
            <div className="sidebar-icon">
              <img src={kitchenMenuIcon} alt="Kitchen menu" style={{ width: '18px', height: '18px' }} />
            </div>
            <span className="sidebar-text">Kitchen menu</span>
          </div>

          <div
            className={`sidebar-item ${activeTab === 'offers' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard/offers')}
          >
            <div className="sidebar-icon">
              <img src={offerIcon} alt="Offers" style={{ width: '18px', height: '18px' }} />
            </div>
            <span className="sidebar-text">Offers</span>
          </div>

          <div
            className={`sidebar-item ${activeTab === 'distribution' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard/distribution')}
          >
            <div className="sidebar-icon">
              <img src={distributionIcon} alt="Distribution" style={{ width: '18px', height: '18px' }} />
            </div>
            <span className="sidebar-text">Distribution</span>
          </div>

          <div
            className={`sidebar-item ${activeTab === 'setting' ? 'active' : ''}`}
            onClick={() => navigate('/dashboard/settings')}
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

  // Logged-in User State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    navigate('/');
  };

  // Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth <= 768);

  // Initial Menu Categories & Items (Shared globally for stats + menu list)
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (!currentUser) {
      setCategories([]);
      return;
    }

    const fetchCategories = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/menu/categories`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          setCategories(data.categories);
        }
      } catch (err) {
        console.error('Failed to fetch menu categories:', err);
      }
    };

    fetchCategories();
  }, [currentUser]);

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

  // Shared Offers state
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    if (!currentUser) {
      setOffers([]);
      return;
    }

    const fetchOffers = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/offers`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          setOffers(data.offers);
        }
      } catch (err) {
        console.error('Failed to fetch offers:', err);
      }
    };

    fetchOffers();
  }, [currentUser]);

  return (
    <>
      <ScrollToTop />
      <Routes>
      {/* Landing Page */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/product" element={<ProductPage />} />
      <Route path="/menu/:userId" element={<PublicMenu />} />

      {/* Login Route (Protected by PublicRoute guard) */}
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login onLogin={() => {
              try {
                const saved = localStorage.getItem('user');
                if (saved) {
                  setCurrentUser(JSON.parse(saved));
                }
              } catch (e) {
                console.error(e);
              }
              navigate('/dashboard');
            }} />
          </PublicRoute>
        } 
      />

      <Route 
        path="/register" 
        element={
          <PublicRoute>
            <Register onRegister={() => {
              try {
                const saved = localStorage.getItem('user');
                if (saved) {
                  setCurrentUser(JSON.parse(saved));
                }
              } catch (e) {
                console.error(e);
              }
              navigate('/dashboard');
            }} />
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
              getInitials={getInitials} 
              handleLogout={handleLogout} 
              isSidebarCollapsed={isSidebarCollapsed} 
              setIsSidebarCollapsed={setIsSidebarCollapsed} 
            />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard categories={categories} offers={offers} />} />
        <Route path="kitchen-menu" element={<MenuList categories={categories} setCategories={setCategories} />} />
        <Route path="offers" element={<Offers offers={offers} setOffers={setOffers} />} />
        <Route path="distribution" element={<Distribution restaurantName={restaurantName} setRestaurantName={setRestaurantName} tagline={tagline} setTagline={setTagline} currentUser={currentUser} />} />
        <Route path="settings" element={<Settings currentUser={currentUser} setCurrentUser={setCurrentUser} restaurantName={restaurantName} setRestaurantName={setRestaurantName} tagline={tagline} setTagline={setTagline} hotelAddress={hotelAddress} setHotelAddress={setHotelAddress} hotelCity={hotelCity} setHotelCity={setHotelCity} hotelState={hotelState} setHotelState={setHotelState} />} />
      </Route>

      {/* Fallback redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

export default App;
