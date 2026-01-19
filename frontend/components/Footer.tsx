import React from 'react';
import { ICONS } from '../constants';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white text-slate-600 py-24 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-16 mb-20">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <ICONS.Logo360 className="w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">GST360</span>
            </div>
            <p className="text-sm leading-relaxed">
              Precision tax compliance for the modern Indian enterprise. Built on the pillars of transparency, speed, and integrity.
            </p>
          </div>
          
          <div>
            <h4 className="text-slate-900 font-bold mb-8 uppercase tracking-widest text-xs">NETWORK</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><a href="#" className="hover:text-blue-600 transition-colors">Our Ethos</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Panel of Experts</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Open Positions</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Compliance Hub</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold mb-8 uppercase tracking-widest text-xs">SOLUTIONS</h4>
            <ul className="space-y-4 text-sm font-medium">
              <li><a href="#" className="hover:text-blue-600 transition-colors">360° Registration</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">High-Frequency Filing</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Enterprise Systems</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Advisory Board</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold mb-8 uppercase tracking-widest text-xs">HEADQUARTERS</h4>
            <ul className="space-y-6 text-sm">
              <li className="flex items-start gap-4">
                <span className="p-2 bg-blue-50 rounded-lg text-blue-600">📍</span>
                <span className="leading-relaxed">Suite 360, Finance Plaza, Sector 44, Gurugram, HR 122003</span>
              </li>
              <li className="flex items-center gap-4">
                <span className="p-2 bg-blue-50 rounded-lg text-blue-600">📞</span>
                <span>+91 (124) 450-3600</span>
              </li>
              <li className="flex items-center gap-4">
                <span className="p-2 bg-blue-50 rounded-lg text-blue-600">✉️</span>
                <span className="font-bold text-blue-600">expert@gst360.in</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="pt-10 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
          <p>© 2024 GST360 SOLUTIONS PRIVATE LIMITED.</p>
          <div className="flex gap-10">
            <a href="#" className="hover:text-slate-900 transition-colors">Legal Framework</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Privacy Cloud</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Terms of Care</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;