import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import './LandingHeader.css';
import logoIcon from '../../../assets/icons/Frame 123.svg';

const LandingHeader = () => {
  const token = localStorage.getItem('token');
  const startPath = token ? '/dashboard' : '/login';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="landing-header" id="landing-header">
      <div className="landing-header__inner">
        {/* Logo */}
        <Link to="/" className="landing-header__logo" onClick={() => setIsMobileMenuOpen(false)}>
          <img src={logoIcon} alt="thevingo.com" className="landing-header__logo-img" />
        </Link>

        {/* Hamburger Menu Toggle (mobile only) */}
        <button 
          className={`landing-header__hamburger ${isMobileMenuOpen ? 'is-active' : ''}`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle navigation"
        >
          <span className="hamburger-bar"></span>
          <span className="hamburger-bar"></span>
          <span className="hamburger-bar"></span>
        </button>

        {/* Navigation */}
        <nav className="landing-header__nav">
          <ul className="landing-header__nav-list">
            <li className="landing-header__nav-item">
              <NavLink to="/" end className="landing-header__nav-link">Home</NavLink>
            </li>
            <li className="landing-header__nav-item">
              <NavLink to="/product" className="landing-header__nav-link">Product</NavLink>
            </li>
            <li className="landing-header__nav-item">
              <NavLink to="/pricing" className="landing-header__nav-link">Pricing</NavLink>
            </li>
            <li className="landing-header__nav-item">
              <NavLink to="/login" className="landing-header__nav-link">Login</NavLink>
            </li>
          </ul>

          <div className="landing-header__actions">
            <a href="#contact" className="landing-header__btn landing-header__btn--outline">
              Contact sales
            </a>
            <Link to="/pricing" className="landing-header__btn landing-header__btn--primary">
              Get started for free
            </Link>
          </div>
        </nav>
      </div>

      {/* Mobile Navigation Panel */}
      {isMobileMenuOpen && (
        <div className="landing-header__mobile-menu">
          <ul className="landing-header__mobile-list">
            <li>
              <NavLink to="/" end className="landing-header__mobile-link" onClick={() => setIsMobileMenuOpen(false)}>Home</NavLink>
            </li>
            <li>
              <NavLink to="/product" className="landing-header__mobile-link" onClick={() => setIsMobileMenuOpen(false)}>Product</NavLink>
            </li>
            <li>
              <NavLink to="/pricing" className="landing-header__mobile-link" onClick={() => setIsMobileMenuOpen(false)}>Pricing</NavLink>
            </li>
            <li>
              <NavLink to="/login" className="landing-header__mobile-link" onClick={() => setIsMobileMenuOpen(false)}>Login</NavLink>
            </li>
            <li className="mobile-actions-divider"></li>
            <li style={{ width: '100%' }}>
              <a href="#contact" className="landing-header__mobile-btn outline" onClick={() => setIsMobileMenuOpen(false)}>
                Contact sales
              </a>
            </li>
            <li style={{ width: '100%', marginTop: '10px' }}>
              <Link to="/pricing" className="landing-header__mobile-btn primary" onClick={() => setIsMobileMenuOpen(false)}>
                Get started for free
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
};

export default LandingHeader;
