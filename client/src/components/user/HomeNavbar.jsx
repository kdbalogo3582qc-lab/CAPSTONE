import React, { useState } from 'react';
import Logo from '../../assets/logo.svg';

function HomeNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className='flex items-center justify-center bg-transparent px-4'>
      <nav className="home-navbar flex justify-between items-center w-full max-w-6xl py-4 px-6 md:px-10 bg-white rounded-full shadow-md mt-4 relative">
        <div className="home-navbar-left flex items-center gap-2">
          <img src={Logo} alt="Logo" className="home-navbar-logo h-[30px] w-[30px]" />
          <span className="home-navbar-title font-medium text-sm md:text-base">KATHA</span>
        </div>

        {/* Desktop Navigation */}
        <div className="home-navbar-right text-sm hidden md:flex items-center gap-6">
          <a href="/dashboard" className="home-navbar-link hover:text-blue-600 transition-colors">Home</a>
          <a href="/" className="home-navbar-link hover:text-blue-600 transition-colors">Log In</a>
          <a href="/signup" className="home-navbar-link hover:text-blue-600 transition-colors">Sign Up</a>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden flex flex-col gap-1 w-6 h-6 justify-center items-center"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
        >
          <span className={`block w-5 h-0.5 bg-gray-700 transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></span>
          <span className={`block w-5 h-0.5 bg-gray-700 transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`block w-5 h-0.5 bg-gray-700 transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
        </button>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-lg py-4 px-6 md:hidden z-50">
            <div className="flex flex-col gap-4">
              <a 
                href="/dashboard" 
                className="home-navbar-link py-2 hover:text-blue-600 transition-colors border-b border-gray-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Home
              </a>
              <a 
                href="/" 
                className="home-navbar-link py-2 hover:text-blue-600 transition-colors border-b border-gray-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Log In
              </a>
              <a 
                href="/signup" 
                className="home-navbar-link py-2 hover:text-blue-600 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sign Up
              </a>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}

export default HomeNavbar;