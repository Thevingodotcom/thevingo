import React from 'react';
import { Link } from 'react-router-dom';
import LandingHeader from '../landingpage/header/LandingHeader';
import LandingFooter from '../landingpage/footer/LandingFooter';
import './PricingPage.css';

const PricingPage = () => {
  return (
    <div className="pricing-page">
      <LandingHeader />

      <section className="pricing-section">
        <div className="pricing-section__inner">
          <h2 className="pricing-section__title landing_heading1">Plans and pricing</h2>
          <div className="pricing-section__cards">
            {/* Starters Card */}
            <div className="pricing-section__card">
              <h3 className="pricing-section__plan-name landing_heading2">Starters</h3>
              <p className="pricing-section__plan-desc landing_body">Free limited access to Vingo menu card</p>
              <Link to="/register" className="pricing-section__cta-btn landing_button">Start for free</Link>
              <ul className="pricing-section__features landing_body">
                <li><span className="pricing-section__check">✓</span> Dynamic price change</li>
                <li><span className="pricing-section__check">✓</span> Add up to 30 items in you menu card</li>
                <li><span className="pricing-section__check">✓</span> Print menu card</li>
                <li><span className="pricing-section__check">✓</span> Import menu from csv to digital menu</li>
                <li><span className="pricing-section__check">✓</span> Qr menu card and menu card link available</li>
              </ul>
            </div>

            {/* Restaurant Card (Coming Soon) */}
            <div className="pricing-section__card pricing-section__card--coming">
              <h3 className="pricing-section__plan-name landing_heading2">Restaurant</h3>
              <p className="pricing-section__plan-desc landing_body">Soon to arrive</p>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default PricingPage;
