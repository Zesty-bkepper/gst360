import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Button from './Button';
import { ICONS } from '../constants';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the intended destination or default to dashboard
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Login failed');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-600 selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-blue-600/30">
              <ICONS.Logo360 className="w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">GST<span className="text-blue-600">360</span></span>
          </Link>
          <Link to="/" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-32 pb-20">
        <div className="max-w-md mx-auto px-6">
          {/* Header Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-4">
              Welcome Back
            </h1>
            <p className="text-lg text-slate-500">
              Sign in to your GST360 account
            </p>
          </div>

          {/* Login Form */}
          <div className="bg-white rounded-[32px] p-8 md:p-10 border border-slate-200 shadow-xl shadow-blue-500/5">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="business@example.com"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 placeholder:text-slate-400 text-slate-900 focus:bg-white outline-none transition-all focus:border-blue-400 text-base font-medium"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 placeholder:text-slate-400 text-slate-900 focus:bg-white outline-none transition-all focus:border-blue-400 text-base font-medium"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                className="w-full py-4 text-lg"
              >
                Sign In
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-slate-600">
                Don't have an account?{' '}
                <Link to="/signup" className="text-blue-600 font-semibold hover:underline">
                  Register here
                </Link>
              </p>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-6 text-slate-400">
              <div className="flex items-center gap-2">
                <ICONS.Shield className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Secure</span>
              </div>
              <div className="flex items-center gap-2">
                <ICONS.CheckCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">GST Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
