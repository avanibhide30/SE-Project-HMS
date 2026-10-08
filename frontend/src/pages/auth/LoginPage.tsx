import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { UserRole } from '../../types';
import {
  Building2,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Users,
  CreditCard,
  ShieldAlert,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, demoLogin } = useAuth();
  const { showToast } = useToast();

  const [identifier, setIdentifier] = useState('student@hostel.edu');
  const [password, setPassword] = useState('password123');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const getRedirectPath = (role: UserRole) => {
    switch (role) {
      case 'STUDENT':
        return '/dashboard';
      case 'WARDEN':
        return '/warden/dashboard';
      case 'ACCOUNTS':
        return '/accounts/dashboard';
      case 'SECURITY':
        return '/security/gate-console';
      case 'ADMIN':
        return '/admin/dashboard';
      default:
        return '/dashboard';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      showToast('Please enter your institutional ID/email and password', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      const user = await login(identifier, password, rememberMe);
      showToast(`Welcome back, ${user.name}!`, 'success');
      navigate(getRedirectPath(user.role));
    } catch (err: any) {
      showToast(err.message || 'Login failed. Please check credentials.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (role: UserRole) => {
    try {
      setIsLoading(true);
      const user = await demoLogin(role);
      showToast(`Signed in as ${user.name} (${role})`, 'success');
      navigate(getRedirectPath(user.role));
    } catch (err: any) {
      showToast(err.message || 'Demo login failed.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-scene min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="login-mark inline-flex items-center justify-center p-3 rounded-2xl text-white shadow-xl mb-4 ring-8">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="login-title text-3xl sm:text-4xl text-white">
          Central Hostel Portal
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-300">
          University Housing, Residence Administration & Security Services
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="login-card bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-100 relative overflow-hidden">
          {/* Accent header bar */}
          <div className="login-accent absolute top-0 left-0 right-0 h-1.5" />

          {/* Quick Demo Switcher Strip for Evaluators */}
          <div className="mb-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              <Sparkles className="login-sparkle w-3.5 h-3.5" />
              <span>Instant 1-Click Role Sign-In:</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('STUDENT')}
                className="demo-role flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition text-left active:scale-95"
              >
                <GraduationCap className="w-4 h-4 text-blue-700 flex-shrink-0" />
                <div className="truncate">
                  <div>Student</div>
                  <div className="text-[10px] text-blue-600 font-normal">Avani Bhide</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('WARDEN')}
                className="demo-role flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition text-left active:scale-95"
              >
                <ShieldCheck className="w-4 h-4 text-purple-700 flex-shrink-0" />
                <div className="truncate">
                  <div>Warden</div>
                  <div className="text-[10px] text-purple-600 font-normal">Dr. Sharma</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('ACCOUNTS')}
                className="demo-role flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition text-left active:scale-95"
              >
                <CreditCard className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <div className="truncate">
                  <div>Accounts</div>
                  <div className="text-[10px] text-emerald-600 font-normal">Sunil Verma</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('SECURITY')}
                className="demo-role flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition text-left active:scale-95"
              >
                <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <div className="truncate">
                  <div>Gate Console</div>
                  <div className="text-[10px] text-amber-600 font-normal">Security Guard</div>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleQuickDemo('ADMIN')}
              className="demo-admin mt-2 w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-[11px] font-semibold transition"
            >
              <Users className="w-3.5 h-3.5" /> Or sign in as System Administrator
            </button>
          </div>

          {/* Institutional Credentials Form */}
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Institutional ID or Email
              </label>
              <div className="mt-1.5 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="student@hostel.edu or Roll No."
                  className="block w-full pl-10 pr-3 py-2.5 sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <div className="mt-1.5 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => showToast('For password reset, please contact the System Administrator or Warden.', 'info')}
                className="login-link font-semibold hover:text-blue-800"
              >
                Forgot password?
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="login-submit w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Log In to Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>256-bit TLS Encrypted Session • Institutional SSO Ready</span>
        </div>
      </div>
    </div>
  );
};
