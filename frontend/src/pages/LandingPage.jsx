import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#191c1d] font-['Inter',sans-serif]">
      {/* Header */}
      <header className="bg-white border-b border-[#c3c5d7] flex items-center px-4 md:px-8 w-full h-14 sticky top-0 z-50">
        <div className="flex items-center gap-3 flex-1">
          <svg className="w-6 h-6 text-[#003fb1]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
          </svg>
          <span className="text-xl font-bold text-[#003fb1] tracking-tight">CollabAgent</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#434654]">
          <a href="#features" className="hover:text-[#003fb1] transition-colors">Features</a>
          <a href="#about" className="hover:text-[#003fb1] transition-colors">About</a>
          <a href="#pricing" className="hover:text-[#003fb1] transition-colors">Pricing</a>
        </nav>
        <div className="flex items-center gap-3 ml-auto md:ml-8">
          {user ? (
            <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-[#003fb1] text-white text-sm font-semibold rounded-lg hover:bg-[#1353d8] transition-colors">
              Dashboard
            </button>
          ) : (
            <>
              <button onClick={() => navigate('/login')} className="px-4 py-2 text-[#003fb1] text-sm font-semibold border border-[#003fb1] rounded-lg hover:bg-[#f0f4ff] transition-colors">
                Log In
              </button>
              <button onClick={() => navigate('/register')} className="px-4 py-2 bg-[#003fb1] text-white text-sm font-semibold rounded-lg hover:bg-[#1353d8] transition-colors">
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 md:px-8 pt-20 pb-24 bg-white">
        <div className="max-w-[1200px] mx-auto grid md:grid-cols-2 items-center gap-16 relative z-10">
<div className="space-y-8">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#d6e0f1] text-[#596372] text-xs font-semibold rounded-full mb-8 tracking-wider uppercase">
            <span className="w-1.5 h-1.5 bg-[#003fb1] rounded-full animate-pulse"></span>
            Enterprise AI Orchestration
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-[#191c1d] mb-6 leading-tight tracking-tight">
            Intelligent Research<br />
            <span className="text-[#003fb1]">Teams</span>
          </h1>
          <p className="text-lg md:text-xl text-[#434654] mb-12 max-w-2xl mx-auto leading-relaxed">
            Empower your data-driven professionals with a collaborative ecosystem of AI agents specialized in deep knowledge retrieval and project synthesis.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate('/register')} className="px-8 py-4 bg-[#003fb1] text-white text-base font-semibold rounded-xl hover:bg-[#1353d8] active:scale-95 transition-all shadow-sm">
              Get Started For Free
            </button>
            <button onClick={() => navigate('/login')} className="px-8 py-4 border-primary border-2 text-base font-semibold rounded-xl hover:bg-primary hover:text-white transition-all text-primary">
              Sign In
            </button>
          </div>
          </div>
          <div className="relative">
            <div
              className="aspect-square rounded-xl bg-surface-container-high border border-outline-variant shadow-sm overflow-hidden"
            >
              <img
                alt="Hero representation"
                className="w-full h-full object-cover mix-blend-multiply opacity-80"
                data-alt="A high-tech laboratory environment featuring clean white workstations and sophisticated computing equipment. The scene is illuminated by cool, bright overhead lighting that creates sharp, professional shadows. The overall aesthetic is one of disciplined scientific inquiry and advanced technological integration, using a palette of whites, grays, and deep blues to reflect the CollabAgent brand identity."
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCh2GrP3O25xGhwYTtPVb8i2PY4tKh8rvHBeH3FL7i9pJkHBh4Y5-_89pRswTkRmJtnUvtceCzV1WOxk8LkRP6qA90eTisAzb5nptYk7GFVS3GohdQVzBj3vVU6MxuzOjGl6fzVgUOMrp9_123eI-CaQ9lZ8oJKzdE9wm2xN9fGh1bkMpHWgVMz6527U9eu_fAK9MI1MIFYsG1hyXijr8PE_LhXpl89o9s8RtYsdvFnwndgoQ2g65mRK-tLRVwscfmjFs4zkAtB8Aw"
              />
              <div
                className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent"
              ></div>
            </div>
            <div
              className="absolute -bottom-6 -left-6 bg-white p-6 rounded-lg border border-outline-variant shadow-xl max-w-[240px]"
            >
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="material-symbols-outlined text-primary"
                  data-icon="auto_awesome"
                >
                    auto_awesome
                </span>
                <span className="font-label-md text-label-md text-primary">
                    AI Insight
                </span>
              </div>
              <p className="font-caption text-caption text-on-surface-variant">
                "Dataset correlation detected in Research Node 4. Would you like
                the Knowledge Agent to draft a summary?"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 md:px-8 py-12 bg-[#f3f4f5] border-y border-[#c3c5d7]">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '400+', label: 'Institutions' },
            { value: '1.2M', label: 'Documents Indexed' },
            { value: '50K+', label: 'Researchers' },
            { value: '99.9%', label: 'Uptime' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-[#003fb1] mb-1">{s.value}</div>
              <div className="text-sm text-[#555f6d]">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 md:px-8 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="mb-14 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-[#191c1d] mb-4">System Capabilities</h2>
            <div className="w-12 h-1 bg-[#003fb1] mx-auto rounded-full"></div>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: (
                  <svg className="w-7 h-7 text-[#003fb1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197" />
                  </svg>
                ),
                title: 'Agent Collaboration',
                desc: 'Multi-agent task distribution allows complex research workflows to be broken down into specialized parallel streams.',
                badge: '3 Active Agents',
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-[#005438]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
                  </svg>
                ),
                title: 'Knowledge Base',
                desc: 'Automatically synthesize internal documentation and external research into a unified semantic repository.',
                badge: 'AI-POWERED',
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-[#555f6d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                  </svg>
                ),
                title: 'Project Synthesis',
                desc: 'Transform raw data and research into polished, publication-ready insights with intelligent summarization.',
                badge: 'New',
              },
            ].map((f) => (
              <div key={f.title} className="p-7 bg-[#f8f9fa] border border-[#e1e3e4] rounded-2xl hover:border-[#003fb1] hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-white border border-[#e1e3e4] rounded-xl flex items-center justify-center mb-5 shadow-sm">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-[#191c1d] mb-2">{f.title}</h3>
                <p className="text-sm text-[#434654] leading-relaxed mb-4">{f.desc}</p>
                <span className="inline-block px-2.5 py-1 bg-[#d6e0f1] text-[#003fb1] text-xs font-semibold rounded-full">
                  {f.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 md:px-8 py-20 bg-[#003fb1]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to accelerate?</h2>
          <p className="text-[#dbe1ff] text-lg mb-10">
            Join over 400+ leading research institutions leveraging CollabAgent for high-stakes intelligence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate('/register')} className="px-8 py-4 bg-white text-[#003fb1] text-base font-bold rounded-xl hover:bg-[#dbe1ff] active:scale-95 transition-all">
              Sign Up — It's Free
            </button>
            <button onClick={() => navigate('/login')} className="px-8 py-4 border border-white/40 text-white text-base font-semibold rounded-xl hover:bg-white/10 transition-all">
              Log In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 md:px-8 py-12 bg-white border-t border-[#c3c5d7]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-[#003fb1]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
                <span className="font-bold text-[#003fb1]">CollabAgent</span>
              </div>
              <p className="text-xs text-[#555f6d] leading-relaxed">Intelligent research collaboration powered by AI.</p>
              <div className="flex gap-4">
            <span
              className="material-symbols-outlined text-on-surface-variant cursor-pointer"
              data-icon="language"
              >language</span
            >
            <span
              className="material-symbols-outlined text-on-surface-variant cursor-pointer"
              data-icon="public"
              >public</span
            >
          </div>
            </div>
            {[
              { title: 'Product', links: ['Platform Overview', 'Agent Framework', 'Enterprise Security', 'Pricing Models'] },
              { title: 'Research Hub', links: ['Case Studies','Documentation', 'API Reference', 'Whitepapers'] },
              { title: 'Institutional', links: ['Ethical Guidelines', 'Data Privacy', 'University Partners', 'Support'] },
            ].map((col) => (
              <div key={col.title}>
                <h5 className="text-xs font-semibold text-[#191c1d] uppercase tracking-wider mb-4">{col.title}</h5>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l} className="text-sm text-[#555f6d] hover:text-[#003fb1] cursor-pointer transition-colors">{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-[#e1e3e4] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-[#737686]">© 2024 CollabAgent Systems Inc. All rights reserved.</p>
            <div className="flex gap-6 text-xs text-[#737686]">
              <a href="/privacy" className="hover:text-[#003fb1] transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-[#003fb1] transition-colors">Terms of Service</a>
              <a href="/security" className="hover:text-[#003fb1] transition-colors">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
