import React, { useEffect } from 'react';
import {
  Rocket,
  Zap,
  Wind,
  ShieldAlert,
  Sprout,
  TrendingUp,
  X,
  ArrowRight,
} from 'lucide-react';

interface OnboardingOverlayProps {
  isOpen: boolean;
  onDismiss: () => void;
}

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ isOpen, onDismiss }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onDismiss]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/65 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="bg-white border border-[#DCE3EE] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden">
        <div className="bg-[#EFF6FF] border-b border-[#BFDBFE] px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-mono font-semibold text-[#2563EB] uppercase tracking-wide">
                Cadet Briefing · First-Time Guide
              </p>
              <h2 id="onboarding-title" className="text-xl font-bold text-[#0F172A] mt-0.5">
                Welcome to AstraOutpost! How to Command
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close onboarding guide"
            className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#DBEAFE] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-[#334155] leading-relaxed">
            Your job is to keep an astronaut outpost alive on the <strong>Moon</strong> or{' '}
            <strong>Mars</strong> for <strong>8 Sols</strong> (mission days). In real space
            missions, nothing is free—every decision trades one resource for another!
          </p>

          <div className="space-y-3">
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-start gap-3">
              <Zap className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold text-[#0F172A]">
                  1. Split Your Daily Solar Power
                </p>
                <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">
                  You only get 9–11 Power Units each Sol. Divide them between{' '}
                  <strong>Life Support</strong>, <strong>Radiation Shielding</strong>,{' '}
                  <strong>Greenhouse Crops</strong>, and <strong>Science &amp; Comms</strong>.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-start gap-3">
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <Wind className="w-4 h-4 text-[#0284C7]" aria-hidden="true" />
                <ShieldAlert className="w-4 h-4 text-[#DC2626]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0F172A]">
                  2. Keep Resources Above Safe Limits
                </p>
                <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">
                  Never let <strong>Air &amp; Water</strong> or <strong>Power Bank</strong> hit
                  0%, and keep total <strong>Radiation</strong> under 35 mSv. Stay above 50% on
                  every Sol to earn Stability Achievement badges!
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-start gap-3">
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <Sprout className="w-4 h-4 text-[#059669]" aria-hidden="true" />
                <TrendingUp className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0F172A]">
                  3. Use the 3-Sol Forecast &amp; Trade-Offs
                </p>
                <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">
                  Solar flares and dust storms change what you need next. Check the{' '}
                  <strong>Forecast</strong> panel and meter tooltips before locking in each Sol’s
                  plan—and you can always <strong>Rewind 1 Sol</strong> if something goes wrong!
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
            <p className="text-[11px] text-[#64748B]">
              Shown once on your first visit · Powered by real NASA open data
            </p>
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Got It — Ready to Command
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
