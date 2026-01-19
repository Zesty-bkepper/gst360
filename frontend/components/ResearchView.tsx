
import React, { useState } from 'react';
import { analyzeTopic } from '../services/gemini';
import { ResearchTopic, AnalysisStatus } from '../types';
import Button from './Button';
import { ICONS } from '../constants';

const ResearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [result, setResult] = useState<ResearchTopic | null>(null);

  const handleAnalysis = async () => {
    if (!query.trim()) return;
    setStatus(AnalysisStatus.LOADING);
    try {
      const analysis = await analyzeTopic(query);
      setResult(analysis);
      setStatus(AnalysisStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      setStatus(AnalysisStatus.ERROR);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Structured Topic Analysis</h1>
        <p className="text-slate-500">Synthesize deep insights from complex domains using high-fidelity reasoning.</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">What do you want to analyze?</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., The economic impact of fusion energy in the 2030s"
              className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAnalysis()}
            />
            <Button 
              onClick={handleAnalysis} 
              isLoading={status === AnalysisStatus.LOADING}
              icon={<ICONS.Search className="w-4 h-4" />}
            >
              Analyze
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-slate-400">Try:</span>
            {['Quantum Computing', 'Web3 Ethics', 'Global Supply Chain Resilience'].map(suggestion => (
              <button 
                key={suggestion}
                onClick={() => setQuery(suggestion)}
                className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {status === AnalysisStatus.SUCCESS && result && (
        <div className="space-y-6 animate-in zoom-in-95 duration-300">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-semibold text-slate-900">{result.title}</h2>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  result.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                  result.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {result.sentiment}
                </span>
                <span className="text-xs text-slate-500">{(result.confidence * 100).toFixed(0)}% Confidence</span>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Executive Summary</h3>
                <p className="text-slate-700 leading-relaxed text-sm">{result.summary}</p>
              </section>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Key Strategic Insights</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.keyInsights.map((insight, idx) => (
                    <li key={idx} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-700">
                      <span className="flex-shrink-0 w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}

      {status === AnalysisStatus.ERROR && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">!</div>
          <p className="text-sm font-medium">An error occurred during synthesis. Please check your credentials or try a different topic.</p>
        </div>
      )}
    </div>
  );
};

export default ResearchView;
