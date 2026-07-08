import { useState, useEffect } from 'react';
import { API_URL } from '../../../config';

// Custom inline SVG icons for dashboard circles
const PercentBadgeIcon = () => (
  <span style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'sans-serif' }}>%</span>
);

const QRBadgeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 3h3v3h-3v-3zm3 3h3v2h-3v-2zm-3-3h-2v2h2v-2zm6-3h-2v2h2v-2z" />
  </svg>
);

const DishBadgeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 1 6 6v1H6V9a6 6 0 0 1 6-6z" fill="currentColor" />
    <line x1="2" y1="14" x2="22" y2="14" strokeWidth="2.5" />
    <path d="M5 14v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" fill="currentColor" />
    <circle cx="12" cy="2" r="1.2" fill="currentColor" />
  </svg>
);

const CategoryBadgeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

const ChevronIcon = () => (
  <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 9L5 5L1 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function Dashboard({ categories, offers }) {
  const [stats, setStats] = useState({
    activeOffers: 0,
    scanCount: 0,
    dishCount: 0,
    categoryCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/auth/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="dashboard-page-container">
      <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 24px 0' }}>Dashboard</h2>

      {/* Stats Cards Grid Layout */}
      <div className="dash-stats-grid">
        {/* Card 1: Active Offer */}
        <div className="dash-stat-card">
          <div className="dash-card-left">
            <div className="dash-card-icon-badge">
              <PercentBadgeIcon />
            </div>
            <div className="dash-card-text">
              <span className="dash-card-count">{loading ? '...' : stats.activeOffers}</span>
              <span className="dash-card-label">Active offer</span>
            </div>
          </div>
          <div className="dash-card-right">
            <ChevronIcon />
          </div>
        </div>

        {/* Card 2: Total Scan */}
        <div className="dash-stat-card">
          <div className="dash-card-left">
            <div className="dash-card-icon-badge">
              <QRBadgeIcon />
            </div>
            <div className="dash-card-text">
              <span className="dash-card-count">{loading ? '...' : stats.scanCount}</span>
              <span className="dash-card-label">Total Scan</span>
            </div>
          </div>
          <div className="dash-card-right">
            <ChevronIcon />
          </div>
        </div>

        {/* Card 3: Dish */}
        <div className="dash-stat-card">
          <div className="dash-card-left">
            <div className="dash-card-icon-badge">
              <DishBadgeIcon />
            </div>
            <div className="dash-card-text">
              <span className="dash-card-count">{loading ? '...' : stats.dishCount}</span>
              <span className="dash-card-label">Dish</span>
            </div>
          </div>
          <div className="dash-card-right">
            <ChevronIcon />
          </div>
        </div>

        {/* Card 4: Category */}
        <div className="dash-stat-card">
          <div className="dash-card-left">
            <div className="dash-card-icon-badge">
              <CategoryBadgeIcon />
            </div>
            <div className="dash-card-text">
              <span className="dash-card-count">{loading ? '...' : stats.categoryCount}</span>
              <span className="dash-card-label">Category</span>
            </div>
          </div>
          <div className="dash-card-right">
            <ChevronIcon />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
