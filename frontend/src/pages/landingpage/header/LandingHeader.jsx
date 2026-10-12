import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import useIsLoggedIn from '../useIsLoggedIn';
import './LandingHeader.css';
import logoIcon from '../../../assets/icons/Frame 123.svg';

const LandingHeader = () => {
  const isLoggedIn = useIsLoggedIn();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="landing-header" id="landing-header">
      <div className="landing-header__inner">
        {/* Logo */}
        <Link to="/" className="landing-header__logo" onClick={closeMobileMenu}>
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
              <a href="#contact" className="landing-header__nav-link landing_anchor">Contact sales</a>
            </li>
          </ul>

          <div className="landing-header__actions">
            {isLoggedIn ? (
              <Link to="/dashboard" className="landing-header__btn landing-header__btn--primary landing_button">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="landing-header__btn landing-header__btn--outline landing_button">
                  Login
                </Link>
                <Link to="/register" className="landing-header__btn landing-header__btn--primary landing_button">
                  Create account
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>

      {/* Mobile Navigation Panel */}
      {isMobileMenuOpen && (
        <div className="landing-header__mobile-menu">
          <ul className="landing-header__mobile-list">
            <li>
              <NavLink to="/" end className="landing-header__mobile-link landing_anchor" onClick={closeMobileMenu}>Home</NavLink>
            </li>
            <li>
              <NavLink to="/product" className="landing-header__mobile-link landing_anchor" onClick={closeMobileMenu}>Product</NavLink>
            </li>
            <li>
              <NavLink to="/pricing" className="landing-header__mobile-link landing_anchor" onClick={closeMobileMenu}>Pricing</NavLink>
            </li>
            <li>
              <a href="#contact" className="landing-header__mobile-link landing_anchor" onClick={closeMobileMenu}>Contact sales</a>
            </li>
            <li className="mobile-actions-divider"></li>
            {isLoggedIn ? (
              <li style={{ width: '100%' }}>
                <Link to="/dashboard" className="landing-header__mobile-btn primary landing_button" onClick={closeMobileMenu}>
                  Go to dashboard
                </Link>
              </li>
            ) : (
              <>
                <li style={{ width: '100%' }}>
                  <Link to="/register" className="landing-header__mobile-btn primary landing_button" onClick={closeMobileMenu}>
                    Create account
                  </Link>
                </li>
                <li style={{ width: '100%', marginTop: '10px' }}>
                  <Link to="/login" className="landing-header__mobile-btn outline landing_button" onClick={closeMobileMenu}>
                    Login
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </header>
  );
};

export default LandingHeader;
