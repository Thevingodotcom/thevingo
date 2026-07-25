import React from 'react';
import './LandingPage.css';
import LandingHeader from './header/LandingHeader';
import LandingFooter from './footer/LandingFooter';

import heroVisualImg from '../../assets/images/Group 54.svg';
import ellipseAvatar from '../../assets/icons/Ellipse 26.svg';
import featureMenu from '../../assets/icons/Frame 54 (1).svg';
import featureMoney from '../../assets/icons/Frame 151.svg';
import { Link } from 'react-router-dom';
import featureUpload from '../../assets/icons/Frame 54.svg';
import featureHybrid from '../../assets/icons/Frame 50.svg';
import featureReprint from '../../assets/icons/Frame 54 (2).svg';

const LandingPage = () => {
  const token = localStorage.getItem('token');
  const startPath = token ? '/dashboard' : '/login';

  return (
    <div className="landing-page" id="landing-page">
      {/* Header */}
      <LandingHeader />

      {/* Hero Section */}
      <section className="landing-hero" id="landing-hero">
        <div className="landing-hero__inner">
          <div className="landing-hero__content">
            <h1 className="landing_heading1">
              Start Your Free Journey Today
            </h1>
            <p className="landing_body2">
              Affordable, customizable digital menus for Cafes. Switch to QR or print your own in seconds, for free
            </p>
            <div className="landing-hero__buttons">
              <Link to="/register" className="landing-hero__btn landing-hero__btn--primary landing_button">
                Create account
              </Link>
              <Link to="/product#how-it-works" className="landing-hero__btn landing-hero__btn--outline landing_button">
                See how it works
              </Link>
            </div>
          </div>
          <div className="landing-hero__visual">
            <img
              src={heroVisualImg}
              alt="TheVingo Dashboard Spec"
              className="landing-hero__mockup-group"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-features" id="landing-features">
        <div className="landing-features__inner">
          <h2 className="landing_heading1">Features</h2>
          <div className="landing-features__grid">
            <div className="landing-features__item">
              <div className="landing-features__icon-wrapper">
                <img src={featureHybrid} alt="Build Your Menu" className="landing-features__icon" />
              </div>
              <p className="landing_body">
                Build Your Menu<br />in Minutes
              </p>
            </div>
            <div className="landing-features__item">
              <div className="landing-features__icon-wrapper">
                <img src={featureMoney} alt="Menu Magic" className="landing-features__icon" />
              </div>
              <p className="landing_body">
                Menu Magic on<br />the Fly
              </p>
            </div>
            <div className="landing-features__item">
              <div className="landing-features__icon-wrapper">
                <img src={featureUpload} alt="Bulk Upload" className="landing-features__icon" />
              </div>
              <p className="landing_body">
                Bulk Upload in a<br />Snap.
              </p>
            </div>
            <div className="landing-features__item">
              <div className="landing-features__icon-wrapper">
                <img src={featureMenu} alt="Hybrid Flexibility" className="landing-features__icon" />
              </div>
              <p className="landing_body">
                Hybrid Flexibility
              </p>
            </div>
            <div className="landing-features__item">
              <div className="landing-features__icon-wrapper">
                <img src={featureReprint} alt="No More Reprinting Fees" className="landing-features__icon" />
              </div>
              <p className="landing_body">
                No More<br />Reprinting Fees
              </p>
            </div>
          </div>
          <a href="#features" className="landing-features__detail-link landing_anchor">
            Know feature in detail
          </a>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="landing-testimonials" id="landing-testimonials">
        <div className="landing-testimonials__inner">
          <h2 className="landing-testimonials__title landing_heading1">Customer testimonials</h2>
          <div className="landing-testimonials__card">
            <div className="landing-testimonials__avatar-wrapper">
              <img
                src={ellipseAvatar}
                alt="Customer"
                className="landing-testimonials__avatar"
              />
            </div>
            <blockquote className="landing-testimonials__quote landing_body2">
              "I was struggling with the cost and hassle of physical menus
              until I found the Vingo. It's super easy to set up, saves me
              money on reprinting, and my customers love the option to
              scan a QR code or grab a fresh printout."
            </blockquote>
            <p className="landing-testimonials__author landing_body">–Mukesh sharonna</p>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="landing-howitworks" id="landing-howitworks">
        <div className="landing-howitworks__inner">
          <div className="landing-howitworks__content">
            <h2 className="landing-howitworks__title landing_heading1">How it Work</h2>
            <div className="landing-howitworks__steps">
              <div className="landing-howitworks__step">
                <h4 className="landing-howitworks__step-label landing_heading2">Step one:</h4>
                <p className="landing-howitworks__step-desc landing_body">
                  Create your free account right here in seconds.
                </p>
              </div>
              <div className="landing-howitworks__step">
                <h4 className="landing-howitworks__step-label landing_heading2">Step two:</h4>
                <p className="landing-howitworks__step-desc landing_body">
                  Add your menu items and customize them as you like
                </p>
              </div>
              <div className="landing-howitworks__step">
                <h4 className="landing-howitworks__step-label landing_heading2">Step three:</h4>
                <p className="landing-howitworks__step-desc landing_body">
                  Download your QR code or print your menu on the go.
                </p>
              </div>
            </div>
          </div>
          <div className="landing-howitworks__visual">
            <div className="landing-howitworks__placeholder"></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
