import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { UserProfile } from "../types";
import { Lock, Mail, ClipboardCheck, ArrowRight, ShieldCheck, UserPlus, Sun, Moon, Eye, EyeOff, ShieldAlert, Check } from "lucide-react";
import { motion } from "motion/react";
import { firebaseAuth, googleProvider, isRealFirebaseConfigured } from "../firebase";
import { signInWithPopup } from "firebase/auth";

interface LoginProps {
  onLoginSuccess: (user: UserProfile) => void;
  darkMode?: boolean;
  toggleDarkMode?: () => void;
}

export default function Login({ onLoginSuccess, darkMode, toggleDarkMode }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<{
    email: string;
    role: string;
    status: string;
    tenantName: string;
    invitedBy: string;
  } | null>(null);

  // Experience & Persistence features
  const [showPassword, setShowPassword] = useState(false);
  const [keepMeSignedIn, setKeepMeSignedIn] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite");
    if (code) {
      setInviteCode(code);
      apiService.getPublicInvitation(code)
        .then((details) => {
          setInviteDetails(details);
        })
        .catch((err) => {
          console.error("Error loading invitation:", err);
          setError("The invitation link is invalid or has expired.");
        });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const profile = await apiService.login(email, password);
      onLoginSuccess(profile);
    } catch (err: any) {
      setError(err.message || "Invalid work email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!firebaseAuth || !googleProvider) {
      setError("Firebase Authentication is not configured.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const user = result.user;
      if (user && user.email) {
        const profile = await apiService.loginWithGoogle(user.email, user.displayName, user.uid, inviteCode || undefined);
        onLoginSuccess(profile);
      } else {
        throw new Error("No email returned by Google.");
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      setError(err.message || "Error logging in with Google.");
    } finally {
      setLoading(false);
    }
  };

  const autofill = (role: 'operator' | 'admin') => {
    if (role === 'operator') {
      setEmail("operator@logistic.com");
      setPassword("password123");
    } else {
      setEmail("admin@logistic.com");
      setPassword("password123");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative font-sans overflow-y-auto">
      {toggleDarkMode && (
        <div className="absolute top-4 right-4 z-50">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2.5 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-100 rounded-full cursor-pointer shadow-sm border border-slate-200 dark:border-slate-800 transition-all active:scale-95"
            title={darkMode ? "Enable Light Mode" : "Enable Dark Mode"}
          >
            {darkMode ? <Sun className="h-4.5 w-4.5 text-amber-500" /> : <Moon className="h-4.5 w-4.5 text-slate-500" />}
          </button>
        </div>
      )}

      {/* Header Area */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        {/* Logo BoundFlux */}
        <div className="inline-flex items-center gap-2.5 mb-5 select-none">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <div className="w-5 h-5 border-2 border-white rounded transform rotate-12 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>
          <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
            BoundFlux
          </span>
        </div>

        {/* Headline Curta */}
        <h2 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white sm:text-3xl px-4">
          International cargo operations platform.
        </h2>

        {/* Subheadline de Valor */}
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed px-4">
          Cargo, documents and shipment flow in one place.
        </p>
      </div>

      {/* Card Content Area */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 shadow-xl shadow-slate-100 dark:shadow-none rounded-3xl sm:px-10 border border-slate-200/80 dark:border-slate-800">
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40 rounded-xl text-xs text-red-650 dark:text-red-400 font-medium flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {inviteDetails && (
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/35 rounded-2xl">
               <div className="flex gap-3">
                <UserPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    You have been invited!
                  </h4>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    You received an invitation from <span className="font-semibold">{inviteDetails.invitedBy}</span> to join the company <span className="font-bold">{inviteDetails.tenantName}</span> as <span className="font-semibold">{inviteDetails.role === "admin" ? "Administrator" : "Operator"}</span>.
                  </p>
                  <p className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-500 font-medium">
                    Click "Continue with Google" using the email <span className="underline">{inviteDetails.email}</span> to accept and access.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Input Email */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-350 tracking-wide">
                  Work email
                </label>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  Use your company credentials to access BoundFlux.
                </span>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3.5 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-650 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/80 focus:border-indigo-500/80 text-sm transition-all duration-150 disabled:opacity-60"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            {/* Input Password */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-350 tracking-wide">
                  Password
                </label>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-650 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/80 focus:border-indigo-500/80 text-sm transition-all duration-150 disabled:opacity-60"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember & Options */}
            <div className="flex items-center justify-between pt-1">
              <label className="relative flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepMeSignedIn}
                  onChange={(e) => setKeepMeSignedIn(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-4.5 h-4.5 border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-950 rounded-md flex items-center justify-center transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600">
                  {keepMeSignedIn && <Check className="h-3 w-3 text-white stroke-[3.5]" />}
                </div>
                <span className="text-xs font-semibold text-slate-650 dark:text-slate-400">
                  Keep me signed in
                </span>
              </label>

              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                onClick={() => alert("Please request a password reset through your system administrator.")}
              >
                Forgot password?
              </button>
            </div>

            {/* Main Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-600/10 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <>
                    <span>Log In</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Social login separator */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 dark:text-slate-500 font-bold tracking-wider">or</span>
            </div>
          </div>

          {/* Google SSO Login */}
          <div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || !isRealFirebaseConfigured}
              className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>{loading ? "Authenticating..." : "Continue with Google"}</span>
            </button>
            {!isRealFirebaseConfigured && (
              <p className="mt-1.5 text-[10px] text-amber-500 text-center font-medium">
                Firebase not initialized. Enable Firebase in settings.
              </p>
            )}
          </div>

          {/* Quick Access for Testing */}
          <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5">
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 text-center">
              Quick Access for Testing
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => autofill('operator')}
                className="flex flex-col items-center p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800/80 border border-slate-150 dark:border-slate-800 rounded-2xl text-center cursor-pointer transition-colors"
              >
                <ClipboardCheck className="h-4.5 w-4.5 text-indigo-500 mb-1" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Operator</span>
                <span className="text-[9px] text-slate-450 dark:text-slate-500 mt-0.5">Yard/Pickups</span>
              </button>

              <button
                onClick={() => autofill('admin')}
                className="flex flex-col items-center p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800/80 border border-slate-150 dark:border-slate-800 rounded-2xl text-center cursor-pointer transition-colors"
              >
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-500 mb-1" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Management</span>
                <span className="text-[9px] text-slate-450 dark:text-slate-500 mt-0.5">Dashboard/Reports</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Trust & Safety Institutional Footer */}
      <div className="mt-8 text-center sm:mx-auto sm:w-full sm:max-w-md px-4">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">
          🔒 Secure access for operators, warehouse teams and management.
        </p>
        <p className="text-[10px] text-slate-400/80 dark:text-slate-550 mt-1">
          Built for international cargo and documentation workflows.
        </p>
      </div>
    </div>
  );
}
