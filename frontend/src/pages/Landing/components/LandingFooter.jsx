import React from 'react';
import { Link } from 'react-router-dom';
import { FOOTER_SECTIONS } from '../data/navigation';

export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-900/60 text-slate-400 text-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 flex flex-col space-y-4">
            <Link to="/landing" className="flex items-center space-x-3 w-fit">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-md shadow-blue-600/30">
                B
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-slate-100">
                  Bharat
                </span>
                <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase -mt-1">
                  Enterprise
                </span>
              </div>
            </Link>

            <p className="text-slate-400 text-xs max-w-sm leading-relaxed">
              Professional billing, multi-batch inventory tracking, customer ledger accounting, and GST-ready invoicing for distributors, wholesalers, and retail enterprises.
            </p>

            <div className="pt-2 text-[11px] text-slate-400">
              Operating System for Indian Distribution
            </div>
          </div>

          {/* Navigation Columns */}
          {FOOTER_SECTIONS.map((section, idx) => (
            <div key={idx} className="flex flex-col space-y-3">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                {section.title}
              </span>
              <ul className="space-y-2">
                {section.links.map((link, lIdx) => (
                  <li key={lIdx}>
                    {link.href.startsWith('/') ? (
                      <Link
                        to={link.href}
                        className="text-slate-400 hover:text-slate-100 transition-colors"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-slate-400 hover:text-slate-100 transition-colors"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar with Copyright */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-4">
          <p>
            &copy; {new Date().getFullYear()} Bharat Enterprise Billing System. All rights reserved.
          </p>

          <div className="flex items-center space-x-6">
            <Link to="/terms" className="text-slate-400 hover:text-slate-100 transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy-policy" className="text-slate-400 hover:text-slate-100 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
