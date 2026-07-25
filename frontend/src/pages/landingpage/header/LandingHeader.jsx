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
              <NavLink to="/" end className="landing-header__nav-link landing_anchor">Home</NavLink>
            </li>
            <li className="landing-header__nav-item">
              <NavLink to="/product" className="landing-header__nav-link landing_anchor">Product</NavLink>
            </li>
            <li className="landing-header__nav-item">
              <NavLink to="/pricing" className="landing-header__nav-link landing_anchor">Pricing</NavLink>
            </li>
            <li className="landing-header__nav-item">
              <NavLink to="/login" className="landing-header__nav-link landing_anchor">Login</NavLink>
            </li>
          </ul>

          <div className="landing-header__actions">
            <a href="#contact" className="landing-header__btn landing-header__btn--outline landing_button">
              Contact sales
            </a>
            <Link to="/pricing" className="landing-header__btn landing-header__btn--primary landing_button">
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
              <NavLink to="/" end className="landing-header__mobile-link landing_anchor" onClick={() => setIsMobileMenuOpen(false)}>Home</NavLink>
            </li>
            <li>
              <NavLink to="/product" className="landing-header__mobile-link landing_anchor" onClick={() => setIsMobileMenuOpen(false)}>Product</NavLink>
            </li>
            <li>
              <NavLink to="/pricing" className="landing-header__mobile-link landing_anchor" onClick={() => setIsMobileMenuOpen(false)}>Pricing</NavLink>
            </li>
            <li>
              <NavLink to="/login" className="landing-header__mobile-link landing_anchor" onClick={() => setIsMobileMenuOpen(false)}>Login</NavLink>
            </li>
            <li className="mobile-actions-divider"></li>
            <li style={{ width: '100%' }}>
              <a href="#contact" className="landing-header__mobile-btn outline landing_button" onClick={() => setIsMobileMenuOpen(false)}>
                Contact sales
              </a>
            </li>
            <li style={{ width: '100%', marginTop: '10px' }}>
              <Link to="/pricing" className="landing-header__mobile-btn primary landing_button" onClick={() => setIsMobileMenuOpen(false)}>
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
