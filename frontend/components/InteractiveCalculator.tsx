import React, { useState, useEffect } from 'react';
import { LAYOUT, ICONS } from '../constants';
import Button from './Button';

const InteractiveCalculator: React.FC = () => {
  const [revenue, setRevenue] = useState(500000);
  const [gstRate, setGstRate] = useState(18);
  const [gstAmount, setGstAmount] = useState(0);

  useEffect(() => {
    setGstAmount((revenue * gstRate) / 100);
  }, [revenue, gstRate]);

  return (
    <section className="py-32 bg-slate-50 border-y border-slate-100">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-20 space-y-4">
          <h2 className="text-xs font-bold text-blue-600 uppercase tracking-[0.2em] mb-4">Financial Flow</h2>
          <h3 className="text-4xl font-bold text-slate-900 tracking-tight">Interactive Tax Estimator</h3>
          <p className="text-slate-500 max-w-xl mx-auto">Get real-time insights into your GST liabilities with our fluid, high-fidelity calculation engine.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Controls Card */}
          <div className="bg-white p-12 rounded-[40px] border border-slate-200 shadow-sm space-y-12">
            <div className="space-y-8">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Monthly Turnover</label>
                  <p className="text-sm font-medium text-slate-500">Estimate your gross revenue</p>
                </div>
                <span className="text-2xl font-bold text-blue-600 font-mono">₹{revenue.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="100000"
                max="5000000"
                step="50000"
                value={revenue}
                onChange={(e) => setRevenue(Number(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                <span>₹100,000</span>
                <span>₹2,500,000</span>
                <span>₹5,000,000</span>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select GST Slab</label>
                <p className="text-sm font-medium text-slate-500">Applicable tax rate for your category</p>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[5, 12, 18, 28].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setGstRate(rate)}
                    className={`py-4 rounded-2xl border-2 font-bold transition-all duration-500 ${
                      gstRate === rate
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/20 scale-105'
                        : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200 hover:text-blue-500'
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Visualization Card - Satisfying & Minimal */}
          <div className="relative group flex flex-col items-center justify-center p-16 rounded-[48px] bg-white border border-slate-200 shadow-2xl shadow-blue-500/5 min-h-[500px]">
            {/* Radial Visualization Element */}
            <div className="relative w-80 h-80 flex items-center justify-center">
              {/* Background Ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="160"
                  cy="160"
                  r="140"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  className="text-slate-50"
                />
                {/* Active Progress Ring */}
                <circle
                  cx="160"
                  cy="160"
                  r="140"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={880}
                  strokeDashoffset={880 - (880 * (gstAmount / (revenue + gstAmount)) * 4)} 
                  className="text-blue-600 transition-all duration-1000 ease-out"
                  strokeLinecap="round"
                />
              </svg>

              <div className="text-center z-10 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">GST LIABILITY</p>
                <h4 className="text-5xl font-black text-slate-900 tracking-tighter">₹{gstAmount.toLocaleString()}</h4>
                <div className="h-px w-12 bg-blue-100 mx-auto my-4"></div>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">TOTAL FLOW</p>
                <p className="text-xl font-bold text-slate-500">₹{(revenue + gstAmount).toLocaleString()}</p>
              </div>

              {/* Decorative "Flowy" Elements */}
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-blue-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-indigo-500 rounded-full blur-3xl opacity-10 animate-bounce transition-all duration-1000"></div>
            </div>
            
            <div className="mt-12 text-center space-y-4">
              <p className="text-sm font-medium text-slate-400 max-w-[300px] leading-relaxed">
                Precision estimation for your 360° compliance cycle. Data-driven and verified.
              </p>
              <Button size="sm" variant="ghost" className="text-blue-600 font-bold group">
                Download Analysis <ICONS.ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InteractiveCalculator;