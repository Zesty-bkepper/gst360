import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from './Button';
import { ICONS } from '../constants';

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/80 backdrop-blur-md border-b border-slate-200 py-3' : 'bg-transparent py-6'
    }`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <ICONS.Logo360 className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">GST360</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8">
          {['Services', 'Benefits', 'Process', 'Pricing'].map((item) => (
            <a 
              key={item} 
              href={`#${item.toLowerCase()}`} 
              className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors"
            >
              {item}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-slate-600 hover:text-slate-900">Dashboard</Button>
          </Link>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-slate-600 hover:text-slate-900">Log In</Button>
          <Link to="/signup">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 shadow-lg">Get Started</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;