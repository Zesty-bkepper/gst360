import React, { useState } from 'react';
import Button from './Button';
import { ICONS } from '../constants';
import { API_BASE } from '../config';

// Indian States and Union Territories
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const TURNOVER_RANGES = [
  'Up to ₹20 Lakhs',
  '₹20 Lakhs - ₹1 Crore',
  '₹1 Crore - ₹5 Crore',
  '₹5 Crore - ₹10 Crore',
  '₹10 Crore - ₹50 Crore',
  '₹50 Crore - ₹100 Crore',
  'Above ₹100 Crore'
];

interface FormData {
  businessName: string;
  gstn: string;
  istn: string;
  panCard: string;
  isPanIndia: boolean;
  selectedStates: string[];
  annualTurnover: string;
  email: string;
  phone: string;
}

const SignUp: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    gstn: '',
    istn: '',
    panCard: '',
    isPanIndia: false,
    selectedStates: [],
    annualTurnover: '',
    email: '',
    phone: ''
  });

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStateToggle = (state: string) => {
    setFormData(prev => ({
      ...prev,
      selectedStates: prev.selectedStates.includes(state)
        ? prev.selectedStates.filter(s => s !== state)
        : [...prev.selectedStates, state]
    }));
  };

  const handlePanIndiaToggle = () => {
    setFormData(prev => ({
      ...prev,
      isPanIndia: !prev.isPanIndia,
      selectedStates: !prev.isPanIndia ? [...INDIAN_STATES] : []
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/businesses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_name: formData.businessName,
          email: formData.email,
          phone: formData.phone || null,
          gstn: formData.gstn.toUpperCase(),
          pan_card: formData.panCard.toUpperCase(),
          iec_code: formData.istn || null,
          is_pan_india: formData.isPanIndia,
          selected_states: formData.selectedStates,
          annual_turnover: formData.annualTurnover,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const business = await response.json();
      // Redirect to dashboard with business ID
      window.location.href = `/dashboard?business_id=${business.id}`;
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const validateStep = (currentStep: number): boolean => {
    switch (currentStep) {
      case 1:
        return formData.businessName.length > 0 && formData.email.length > 0;
      case 2:
        return formData.gstn.length === 15 && formData.panCard.length === 10;
      case 3:
        return formData.selectedStates.length > 0 || formData.isPanIndia;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-600 selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-blue-600/30">
              <ICONS.Logo360 className="w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">GST<span className="text-blue-600">360</span></span>
          </a>
          <a href="/" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
            ← Back to Home
          </a>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-6">
          {/* Header Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 mb-6">
              Start Your <span className="text-blue-600">360°</span> Journey
            </h1>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">
              Register your business and unlock the full potential of automated GST compliance.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-12">
            <div className="flex items-center gap-4">
              {[1, 2, 3, 4].map((s) => (
                <React.Fragment key={s}>
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg transition-all duration-500 ${
                      step >= s
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {step > s ? '✓' : s}
                  </div>
                  {s < 4 && (
                    <div className={`w-16 h-1 rounded-full transition-all duration-500 ${
                      step > s ? 'bg-blue-600' : 'bg-slate-200'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-[48px] p-12 md:p-16 border border-slate-200 shadow-xl shadow-blue-500/5">
            <form onSubmit={handleSubmit}>
              {/* Step 1: Business Information */}
              {step === 1 && (
                <div className="space-y-8 animate-fadeIn">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-slate-900">Business Information</h2>
                    <p className="text-slate-500">Tell us about your business entity</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Business Name *
                      </label>
                      <input
                        type="text"
                        name="businessName"
                        value={formData.businessName}
                        onChange={handleInputChange}
                        placeholder="Enter your registered business name"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 placeholder:text-slate-400 text-slate-900 focus:bg-white outline-none transition-all focus:border-blue-400 text-base font-medium"
                        required
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="business@example.com"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 placeholder:text-slate-400 text-slate-900 focus:bg-white outline-none transition-all focus:border-blue-400 text-base font-medium"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="+91 XXXXX XXXXX"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 placeholder:text-slate-400 text-slate-900 focus:bg-white outline-none transition-all focus:border-blue-400 text-base font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Tax Information */}
              {step === 2 && (
                <div className="space-y-8 animate-fadeIn">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-slate-900">Tax Information</h2>
                    <p className="text-slate-500">Enter your GST and tax registration details</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                        GSTN (GST Number) *
                      </label>
                      <input
                        type="text"
                        name="gstn"
                        value={formData.gstn}
                        onChange={handleInputChange}
                        placeholder="22AAAAA0000A1Z5"
                        maxLength={15}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 placeholder:text-slate-400 text-slate-900 focus:bg-white outline-none transition-all focus:border-blue-400 text-base font-medium uppercase tracking-wider"
                        required
                      />
                      <p className="text-xs text-slate-400 ml-1">15-character GST Identification Number</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                          PAN Card Number *
                        </label>
                        <input
                          type="text"
                          name="panCard"
                          value={formData.panCard}
                          onChange={handleInputChange}
                          placeholder="ABCDE1234F"
                          maxLength={10}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 placeholder:text-slate-400 text-slate-900 focus:bg-white outline-none transition-all focus:border-blue-400 text-base font-medium uppercase tracking-wider"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                          IEC Code (Optional)
                        </label>
                        <input
                          type="text"
                          name="istn"
                          value={formData.istn}
                          onChange={handleInputChange}
                          placeholder="AAAAAAA000"
                          maxLength={10}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 placeholder:text-slate-400 text-slate-900 focus:bg-white outline-none transition-all focus:border-blue-400 text-base font-medium uppercase tracking-wider"
                        />
                        <p className="text-xs text-slate-400 ml-1">Import Export Code if applicable</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Business Location */}
              {step === 3 && (
                <div className="space-y-8 animate-fadeIn">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-slate-900">Place of Business</h2>
                    <p className="text-slate-500">Select your business operation locations in India</p>
                  </div>

                  <div className="space-y-6">
                    {/* PAN India Toggle */}
                    <div
                      onClick={handlePanIndiaToggle}
                      className={`p-6 rounded-3xl border-2 cursor-pointer transition-all duration-300 ${
                        formData.isPanIndia
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-slate-200 hover:border-blue-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                          formData.isPanIndia
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {formData.isPanIndia ? '✓' : ''}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-lg">PAN India Operations</p>
                          <p className="text-slate-500 text-sm">Select this if your business operates across all states</p>
                        </div>
                      </div>
                    </div>

                    {/* State Selection */}
                    {!formData.isPanIndia && (
                      <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                          Or Select Specific States
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-2">
                          {INDIAN_STATES.map((state) => (
                            <div
                              key={state}
                              onClick={() => handleStateToggle(state)}
                              className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 text-sm font-medium ${
                                formData.selectedStates.includes(state)
                                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 hover:border-blue-300 text-slate-600 bg-white'
                              }`}
                            >
                              {state}
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-slate-500">
                          {formData.selectedStates.length} state(s) selected
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Annual Turnover */}
              {step === 4 && (
                <div className="space-y-8 animate-fadeIn">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-slate-900">Annual Turnover</h2>
                    <p className="text-slate-500">Select your approximate annual turnover range</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {TURNOVER_RANGES.map((range) => (
                      <div
                        key={range}
                        onClick={() => setFormData(prev => ({ ...prev, annualTurnover: range }))}
                        className={`p-6 rounded-3xl border-2 cursor-pointer transition-all duration-300 ${
                          formData.annualTurnover === range
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 hover:border-blue-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            formData.annualTurnover === range
                              ? 'border-blue-600 bg-blue-600'
                              : 'border-slate-300'
                          }`}>
                            {formData.annualTurnover === range && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                          <span className={`font-bold ${
                            formData.annualTurnover === range ? 'text-blue-700' : 'text-slate-700'
                          }`}>
                            {range}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between items-center mt-12 pt-8 border-t border-slate-100">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setStep(step - 1)}
                    className="px-8"
                  >
                    ← Previous
                  </Button>
                ) : (
                  <div />
                )}

                {step < 4 ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setStep(step + 1)}
                    disabled={!validateStep(step)}
                    className="px-8"
                  >
                    Continue →
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isLoading}
                    disabled={!formData.annualTurnover}
                    className="px-12"
                  >
                    Complete Registration
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Trust Badges */}
          <div className="mt-12 text-center">
            <div className="flex items-center justify-center gap-8 text-slate-400">
              <div className="flex items-center gap-2">
                <ICONS.Shield className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest">256-bit Encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <ICONS.CheckCircle className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest">GST Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <ICONS.Users className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest">15,000+ Businesses</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SignUp;
