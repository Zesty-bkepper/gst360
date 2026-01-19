import React from 'react';
import { ICONS, LAYOUT } from '../constants';

const services = [
  {
    title: 'Precision Registration',
    desc: 'Bespoke onboarding for new entities with a zero-friction documentation portal.',
    icon: <ICONS.Zap className="w-6 h-6" />,
  },
  {
    title: 'Cycle Management',
    desc: 'High-frequency GSTR-1 and 3B filings handled by our elite compliance officers.',
    icon: <ICONS.FileText className="w-6 h-6" />,
  },
  {
    title: 'Strategic Audit',
    desc: 'Advanced risk assessments and structural advisory for enterprise-scale tax laws.',
    icon: <ICONS.Shield className="w-6 h-6" />,
  },
  {
    title: 'Cloud Reconciliation',
    desc: 'Real-time ledger matching and e-invoicing powered by our intelligent cloud engine.',
    icon: <ICONS.CheckCircle className="w-6 h-6" />,
  },
];

const Features: React.FC = () => {
  return (
    <section id="services" className="py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">EXPERT CAPABILITIES</h2>
          <h3 className="text-4xl font-bold text-slate-900 tracking-tight">Enterprise-Grade Tax Architecture</h3>
          <p className="text-slate-500 text-lg">Sophisticated solutions designed to handle the complexities of modern Indian business.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, idx) => (
            <div 
              key={idx} 
              className="p-10 bg-white border border-slate-100 rounded-[40px] shadow-sm hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-2 transition-all duration-500 group"
            >
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                {service.icon}
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-4 tracking-tight">{service.title}</h4>
              <p className="text-slate-500 leading-relaxed text-sm mb-8">
                {service.desc}
              </p>
              <button className="flex items-center gap-2 text-sm font-bold text-blue-600 group-hover:gap-3 transition-all">
                Learn More <ICONS.ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;