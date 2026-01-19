import React from 'react';

const steps = [
  {
    num: '01',
    title: 'Seamless Ingestion',
    desc: 'Connect your accounting software or upload data via our secure 360° ingestion portal.',
  },
  {
    num: '02',
    title: 'Dual Validation',
    desc: 'Our proprietary AI and human experts cross-verify every line item for total accuracy.',
  },
  {
    num: '03',
    title: 'Instant Execution',
    desc: 'Real-time filing with the GST portal followed by instant digital receipt generation.',
  },
];

const Process: React.FC = () => {
  return (
    <section id="process" className="py-32 bg-slate-50 overflow-hidden relative border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-24 items-center">
          <div className="space-y-8">
            <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest">HOW IT WORKS</h2>
            <h3 className="text-4xl font-bold text-slate-900 tracking-tight leading-[1.2]">
              The High-Fidelity <br /> Compliance Workflow
            </h3>
            <p className="text-slate-600 text-lg max-w-lg">
              We’ve engineered a cycle of continuous verification, ensuring your business remains compliant 365 days a year.
            </p>
            <div className="space-y-12 pt-8">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-8 relative group">
                  {idx !== steps.length - 1 && (
                    <div className="absolute top-12 left-[1.125rem] w-px h-16 bg-slate-200" />
                  )}
                  <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-900 shadow-sm group-hover:border-blue-500 group-hover:text-blue-600 transition-all duration-500">
                    {step.num}
                  </div>
                  <div className="pt-1">
                    <h4 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h4>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="hidden lg:block relative">
             <div className="absolute inset-0 bg-blue-600/5 rounded-[60px] translate-x-8 translate-y-8"></div>
             <img 
               src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800" 
               alt="Financial Data Flow" 
               className="rounded-[60px] shadow-2xl relative z-10 w-full h-[640px] object-cover border-8 border-white"
             />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Process;