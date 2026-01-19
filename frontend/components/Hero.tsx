import React from 'react';
import { Link } from 'react-router-dom';
import Button from './Button';
import NumberFlowBackground from './NumberFlowBackground';

const Hero: React.FC = () => {
  return (
    <section className="relative pt-48 pb-32 overflow-hidden bg-white">
      {/* Interactive Data Background */}
      <NumberFlowBackground />

      {/* Background Abstract Shapes */}
      <div className="absolute top-0 left-0 w-full h-full -z-10">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-50 rounded-full blur-3xl opacity-70 animate-pulse"></div>
        <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-indigo-50 rounded-full blur-3xl opacity-70"></div>
        <svg className="absolute top-20 right-0 opacity-20" width="400" height="400" viewBox="0 0 400 400">
           <path d="M0,200 Q100,50 200,200 T400,200" fill="none" stroke="url(#gradient)" strokeWidth="2" />
           <defs>
             <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
               <stop offset="0%" stopColor="#2563eb" />
               <stop offset="100%" stopColor="#60a5fa" />
             </linearGradient>
           </defs>
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center relative z-10">
        <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold tracking-wider uppercase">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            360° GST Intelligence Suite
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-slate-900 leading-[1.05] tracking-tight">
            Compliance Made <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500">Effortless.</span>
          </h1>
          
          <p className="text-lg text-slate-600 leading-relaxed max-w-lg">
            Experience the future of tax filing with GST360. A high-fidelity, expert-led platform engineered for precision, speed, and total peace of mind.
          </p>

          <div className="flex flex-wrap gap-4 pt-4">
            <Link to="/signup">
              <Button size="lg" className="px-10 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 shadow-2xl hover:-translate-y-0.5 transition-transform">
                Start Free Trial
              </Button>
            </Link>
            <Button variant="secondary" size="lg" className="px-10 bg-white border-slate-200 text-slate-900 hover:bg-slate-50 shadow-sm">
              View Demo
            </Button>
          </div>

          <div className="flex items-center gap-12 pt-8 border-t border-slate-100">
             <div>
               <p className="text-2xl font-bold text-slate-900">12k+</p>
               <p className="text-sm font-medium text-slate-500">Active Entities</p>
             </div>
             <div className="w-px h-10 bg-slate-200" />
             <div>
               <p className="text-2xl font-bold text-slate-900">99.98%</p>
               <p className="text-sm font-medium text-slate-500">Success Rate</p>
             </div>
             <div className="w-px h-10 bg-slate-200" />
             <div>
               <p className="text-2xl font-bold text-slate-900">24/7</p>
               <p className="text-sm font-medium text-slate-500">Expert Care</p>
             </div>
          </div>
        </div>

        <div className="relative animate-in fade-in zoom-in-95 duration-1000">
          <div className="bg-white/70 backdrop-blur-xl p-10 rounded-[40px] shadow-2xl shadow-blue-500/10 border border-white relative z-10">
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                 <div>
                    <h3 className="font-bold text-slate-900 text-xl">Compliance Health</h3>
                    <p className="text-xs font-medium text-slate-400">Monthly Performance Overview</p>
                 </div>
                 <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold border border-green-100">Perfect</span>
              </div>
              
              <div className="h-48 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-center overflow-hidden">
                 <svg className="w-full h-full p-4" viewBox="0 0 400 150">
                    <path 
                      d="M0,120 Q50,60 100,100 T200,40 T300,80 T400,20" 
                      fill="none" 
                      stroke="#2563eb" 
                      strokeWidth="4" 
                      className="animate-dash" 
                      strokeLinecap="round"
                    />
                 </svg>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                 <div className="p-5 bg-blue-50 rounded-3xl border border-blue-100 group hover:bg-blue-600 transition-colors duration-500">
                    <p className="text-xs text-blue-600 font-bold mb-1 uppercase tracking-wider group-hover:text-white">Active Tasks</p>
                    <p className="text-2xl font-bold text-slate-900 group-hover:text-white">00</p>
                 </div>
                 <div className="p-5 bg-slate-50 rounded-3xl border border-slate-200 group hover:bg-slate-900 transition-colors duration-500">
                    <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider group-hover:text-slate-400">Quarterly Filings</p>
                    <p className="text-2xl font-bold text-slate-900 group-hover:text-white">42</p>
                 </div>
              </div>
            </div>
          </div>
          {/* Decorative floating elements */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-sky-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
