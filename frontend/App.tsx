import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Process from './components/Process';
import InteractiveCalculator from './components/InteractiveCalculator';
import Footer from './components/Footer';
import Button from './components/Button';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-600 selection:bg-blue-100 selection:text-blue-900">
      <Navbar />
      
      <main>
        <Hero />
        
        <InteractiveCalculator />

        <Features />
        
        <Process />

        {/* Benefits Section - Fully Refactored for Light Theme Contrast */}
        <section id="benefits" className="py-32 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="bg-blue-50/50 border border-blue-100 rounded-[64px] p-12 md:p-24 text-slate-900 relative overflow-hidden shadow-sm">
              {/* Airy Background Decorative Elements */}
              <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-100/30 rounded-full -mr-96 -mt-96 blur-[120px] animate-pulse"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-sky-100/30 rounded-full -ml-48 -mb-48 blur-[80px]"></div>
              
              <div className="relative z-10 grid lg:grid-cols-2 gap-24 items-center">
                <div className="space-y-12">
                  <div className="space-y-4">
                    <h2 className="text-xs font-bold text-blue-600 uppercase tracking-[0.3em]">THE ADVANTAGE</h2>
                    <h3 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] text-slate-900">
                      Precision <br /> 
                      <span className="text-blue-600">Unleashed.</span>
                    </h3>
                  </div>
                  
                  <div className="space-y-8">
                    {[
                      { t: 'Military-Grade Vault', d: 'Your financial assets are guarded by our proprietary 360° encryption cloud infrastructure.' },
                      { t: 'Hyper-Transparent Ledgers', d: 'Live tracking of every penny and filing status through our secure expert-led portal.' },
                      { t: 'Elite Compliance Panel', d: 'Direct access to senior tax advisors for auditing and strategic growth consultations.' }
                    ].map((item, i) => (
                      <div key={i} className="flex gap-6 group">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xs group-hover:scale-110 transition-transform duration-500 font-bold shadow-md shadow-blue-500/20">✓</div>
                        <div>
                          <p className="font-bold text-xl mb-1 text-slate-900">{item.t}</p>
                          <p className="text-slate-500 text-sm leading-relaxed max-w-sm">{item.d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-[48px] p-12 border border-blue-100 shadow-xl shadow-blue-500/5">
                  <h4 className="text-3xl font-bold mb-8 text-slate-900 tracking-tight">Start Your 360° Journey</h4>
                  <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Entity Name</label>
                        <input 
                          type="text" 
                          placeholder="Corporate Entity Name" 
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 placeholder:text-slate-400 text-slate-900 focus:bg-white outline-none transition-all focus:border-blue-400 text-sm font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
                        <input 
                          type="email" 
                          placeholder="Organization Email" 
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 placeholder:text-slate-400 text-slate-900 focus:bg-white outline-none transition-all focus:border-blue-400 text-sm font-medium"
                        />
                      </div>
                    </div>
                    <Button variant="primary" className="w-full py-5 font-bold text-white bg-blue-600 hover:bg-blue-700 border-none shadow-2xl text-lg rounded-2xl">Request Priority Onboarding</Button>
                    <div className="flex items-center justify-center gap-4 pt-4">
                       <div className="flex -space-x-3">
                         {[1,2,3,4].map(i => (
                           <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden shadow-sm">
                             <img src={`https://i.pravatar.cc/100?u=${i + 15}`} alt="user" className="w-full h-full object-cover" />
                           </div>
                         ))}
                       </div>
                       <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Join 15,000+ top Indian entities</p>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-32 bg-slate-50 border-t border-slate-100">
           <div className="max-w-7xl mx-auto px-6 text-center">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-[0.3em] mb-12">EXPERT Q&A</h3>
              <div className="max-w-2xl mx-auto space-y-4">
                 {[
                   'How does the 360° dual-verification protocol work?',
                   'Can I migrate data from multiple legacy systems?',
                   'What are the structural audit benefits for SMEs?',
                 ].map((q, i) => (
                   <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 text-left flex justify-between items-center group cursor-pointer hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500">
                      <span className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors text-lg">{q}</span>
                      <span className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all font-bold">+</span>
                   </div>
                 ))}
              </div>
           </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default App;