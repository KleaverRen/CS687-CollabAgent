import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'researcher', label: 'Researcher', icon: '🔬' },
  { value: 'project_lead', label: 'Project Lead', icon: '📊' },
  { value: 'faculty', label: 'Faculty', icon: '🎓' },
  { value: 'student', label: 'Student', icon: '📚' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', role: 'researcher', institution: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const validate = () => {
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = 'Full name is required';
    if (!form.email) errs.email = 'Email is required';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (!agreed) errs.terms = 'You must agree to the terms';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      await register(form);
      toast.success('Account created! Welcome to CollabAgent.');
      navigate('/dashboard');
    } catch (err) {
      const apiErrors = err.response?.data?.errors;
      if (apiErrors) {
        const mapped = {};
        apiErrors.forEach((e) => { mapped[e.path] = e.msg; });
        setErrors(mapped);
      } else {
        toast.error(err.response?.data?.error || 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-['Inter',sans-serif] text-[#191c1d] flex flex-col md:flex-row">
      {/* Left Brand Panel */}
      <aside className="hidden md:flex md:w-[45%] bg-[#003fb1] relative flex-col justify-between p-10 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <svg className="w-9 h-9 text-[#dbe1ff]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            <span className="text-2xl font-bold text-white">CollabAgent</span>
          </div>
          <div className="max-w-sm">
            <h1 className="text-4xl font-bold text-white leading-tight mb-5">
              Elevate your academic research through AI-driven collaboration.
            </h1>
            <p className="text-[#dbe1ff]/80 text-base leading-relaxed">
              Connect with global peers, manage complex datasets, and streamline your publication pipeline.
            </p>
          </div>
        </div>
        <div className="relative z-10 bg-white/10 border border-white/20 p-6 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#dbe1ff] rounded-full flex items-center justify-center text-[#003fb1] font-bold text-sm">ER</div>
            <div>
              <p className="text-sm font-semibold text-white">Dr. Elena Rostova</p>
              <p className="text-xs text-white/60">Lead Researcher, Quantum Dynamics</p>
            </div>
          </div>
          <p className="text-sm italic text-white/90 leading-relaxed">
            "CollabAgent has fundamentally changed how our lab coordinates with international partners."
          </p>
        </div>
      </aside>

      {/* Right Form Panel */}
      <main className="flex-1 flex items-start md:items-center justify-center p-6 md:p-12 bg-[#f8f9fa] overflow-y-auto relative">
        <Link to="/" className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 text-sm font-semibold text-[#434654] hover:text-[#003fb1] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Return to Home
        </Link>
        <div className="w-full max-w-[480px]">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2 mb-10">
            <svg className="w-6 h-6 text-[#003fb1]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            <span className="text-xl font-bold text-[#003fb1]">CollabAgent</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#191c1d] mb-2">Create Account</h2>
            <p className="text-sm text-[#555f6d]">Join the community of verified academic professionals.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-1.5">Full Name</label>
              <input
                name="full_name"
                type="text"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Dr. Julian Vane"
                className={`w-full h-12 px-4 rounded-lg border bg-white text-[#191c1d] text-sm outline-none transition-all ${
                  errors.full_name ? 'border-[#ba1a1a] focus:ring-2 focus:ring-[#ba1a1a]/20' : 'border-[#c3c5d7] focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20'
                }`}
              />
              {errors.full_name && <p className="text-xs text-[#ba1a1a] mt-1">{errors.full_name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-1.5">Institutional Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="name@institution.edu"
                className={`w-full h-12 px-4 rounded-lg border bg-white text-[#191c1d] text-sm outline-none transition-all ${
                  errors.email ? 'border-[#ba1a1a] focus:ring-2 focus:ring-[#ba1a1a]/20' : 'border-[#c3c5d7] focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20'
                }`}
              />
              {errors.email && <p className="text-xs text-[#ba1a1a] mt-1">{errors.email}</p>}
              <p className="text-xs text-[#555f6d] mt-1">Verification link will be sent to this address.</p>
            </div>

            {/* Institution */}
            <div>
              <label className="block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-1.5">Institution <span className="text-[#737686] font-normal normal-case">(optional)</span></label>
              <input
                name="institution"
                type="text"
                value={form.institution}
                onChange={handleChange}
                placeholder="MIT, Stanford, etc."
                className="w-full h-12 px-4 rounded-lg border border-[#c3c5d7] bg-white text-[#191c1d] text-sm focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20 outline-none transition-all"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-2">Primary Role</label>
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm({ ...form, role: r.value })}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      form.role === r.value
                        ? 'border-[#003fb1] bg-[#d6e0f1] text-[#003fb1]'
                        : 'border-[#c3c5d7] bg-white text-[#434654] hover:border-[#003fb1] hover:bg-[#f0f4ff]'
                    }`}
                  >
                    <span className="text-xl">{r.icon}</span>
                    <span className="text-xs font-semibold">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-[#434654] uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 8 characters"
                  className={`w-full h-12 px-4 pr-12 rounded-lg border bg-white text-[#191c1d] text-sm outline-none transition-all ${
                    errors.password ? 'border-[#ba1a1a] focus:ring-2 focus:ring-[#ba1a1a]/20' : 'border-[#c3c5d7] focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20'
                  }`}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737686] hover:text-[#003fb1]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
              {errors.password && <p className="text-xs text-[#ba1a1a] mt-1">{errors.password}</p>}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <input
                id="terms"
                type="checkbox"
                checked={agreed}
                onChange={(e) => { setAgreed(e.target.checked); setErrors({ ...errors, terms: '' }); }}
                className="w-4 h-4 mt-0.5 rounded border-[#c3c5d7] text-[#003fb1] cursor-pointer"
              />
              <label htmlFor="terms" className="text-sm text-[#555f6d] cursor-pointer leading-relaxed">
                I agree to the{' '}
                <a href="#" className="text-[#003fb1] font-semibold hover:underline">Institutional Terms</a> and{' '}
                <a href="#" className="text-[#003fb1] font-semibold hover:underline">Data Privacy Policy</a>
              </label>
            </div>
            {errors.terms && <p className="text-xs text-[#ba1a1a] -mt-2">{errors.terms}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#003fb1] text-white text-sm font-bold rounded-xl hover:bg-[#1353d8] active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Creating account…
                </>
              ) : (
                <>Create Researcher Account <span>→</span></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-[#555f6d] mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-[#003fb1] font-bold hover:underline">Log in</Link>
          </p>

          <footer className="mt-12 pt-8 border-t border-[#e1e3e4] flex flex-wrap justify-center gap-6">
            {['Help Center', 'Academic Ethics', 'Institutional Access'].map((l) => (
              <a key={l} href="#" className="text-xs text-[#737686] hover:text-[#003fb1] transition-colors">{l}</a>
            ))}
          </footer>
        </div>
      </main>
    </div>
  );
}
