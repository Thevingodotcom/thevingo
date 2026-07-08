import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LandingHeader from '../landingpage/header/LandingHeader';
import LandingFooter from '../landingpage/footer/LandingFooter';
import './ProductPage.css';

const ProductPage = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.substring(1));
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  }, [location]);
  return (
    <div className="product-page">
      <LandingHeader />

      <main className="product-main">
        {/* Hero */}
        <section className="product-hero">
          <h1 className="product-hero__title">Digital Menu Management for Modern Eateries</h1>
          <p className="product-hero__desc">
            Vingo is your all-in-one digital menu management system designed specifically for MSMEs and Quick Service Restaurants. We help you digitize your customer experience, eliminate recurring printing costs, and gain full control over your menu in real-time.
          </p>
        </section>

        {/* Key Features */}
        <section className="product-features">
          <h2 className="product-section-title">Key Features</h2>
          <ul className="product-features__list">
            <li>
              <strong>Build Your Menu in Minutes:</strong> Easily create, update, and publish your menu items in seconds. No more waiting for design proofs or print shop lead times.
            </li>
            <li>
              <strong>Hybrid Flexibility:</strong> Seamlessly switch between dine-in, takeaway, and delivery menu configurations to suit your operational needs.
            </li>
            <li>
              <strong>Bulk Upload in a Snap:</strong> Don't spend hours typing in data. Upload your entire inventory instantly using a simple CSV file import.
            </li>
            <li>
              <strong>No More Printing Fees:</strong> Go paperless! Update your pricing, add specials, or remove out-of-stock items on the fly without spending a penny on reprinting menus.
            </li>
            <li>
              <strong>Menu Magic on the Fly:</strong> Make instant changes across all your digital platforms, ensuring your customers always see the most accurate information.
            </li>
          </ul>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="product-howitworks">
          <h2 className="product-section-title">How It Works <span className="product-section-subtitle">(The three step menu card in your hand)</span></h2>
          <ol className="product-howitworks__steps">
            <li>
              <strong>Create Your Account:</strong> Sign up in seconds with just your name, email, and restaurant name.
            </li>
            <li>
              <strong>Add Your Items:</strong> Input your menu details and customize them to fit your restaurant's unique style.
            </li>
            <li>
              <strong>Go Live:</strong> Instantly generate a QR code for your tables or print your menu on the go.
            </li>
          </ol>
        </section>

        {/* Customer Testimonials */}
        <section className="product-testimonials">
          <h2 className="product-section-title">Customer Testimonials</h2>
          <blockquote className="product-testimonials__quote">
            "Vingo has been a game-changer for our restaurant. We update our specials daily in seconds, and our customers love the ease of scanning the QR code."
          </blockquote>
        </section>

        {/* FAQ */}
        <section className="product-faq">
          <h2 className="product-section-title">Frequently Asked Questions (FAQ)</h2>
          <div className="product-faq__list">
            <div className="product-faq__item">
              <h4 className="product-faq__question">Is my data secure?</h4>
              <p className="product-faq__answer">
                Yes, we take your data privacy seriously and utilize industry-standard security protocols to keep your information and menu details safe.
              </p>
            </div>
            <div className="product-faq__item">
              <h4 className="product-faq__question">Can I update my menu on the go?</h4>
              <p className="product-faq__answer">
                Absolutely! Vingo is designed to be accessible anywhere, so you can make updates from your phone or laptop whenever you need to.
              </p>
            </div>
            <div className="product-faq__item">
              <h4 className="product-faq__question">What if I need help?</h4>
              <p className="product-faq__answer">
                We offer a dedicated support section, including direct email support, a helpful phone contact line, and a comprehensive FAQ to guide you through any questions.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="product-cta">
          <h2 className="product-cta__title">Ready to Get Started?</h2>
          <Link to="/login" className="product-cta__btn">Start Your Free Journey Today</Link>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
};

export default ProductPage;
