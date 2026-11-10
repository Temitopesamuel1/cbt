import React, { useState } from 'react';
import { Download, Smartphone, Monitor, CheckCircle2, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ className?: string; label?: string }> = ({
  className = '',
  label = 'Download App'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // If already running standalone (installed), hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95 ${className}`}
        title="Download and install Honey's World CBT App on your PC or Phone"
      >
        <Download className="w-3.5 h-3.5 text-slate-950" />
        <span>{label}</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSModal(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95 ${className}`}
          title="Add Honey's World CBT App to your iPhone / iPad Home Screen"
        >
          <Smartphone className="w-3.5 h-3.5 text-slate-950" />
          <span>Install on iOS</span>
        </button>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-blue-900" />
                  <h3 className="font-bold text-sm">Install on iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-900">1.</span>
                  <span>Tap the <strong>Share</strong> button in Safari's bottom toolbar.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-900">2.</span>
                  <span>Scroll down and select <strong>"Add to Home Screen"</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-900">3.</span>
                  <span>Tap <strong>Add</strong> in the top-right corner.</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                The Honey's World High School CBT App will appear on your home screen and run in fast full-screen native mode!
              </p>

              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2 bg-blue-900 text-white font-bold text-xs rounded-xl"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop / Browser manual install helper
  return (
    <>
      <button
        onClick={() => setShowInstructions(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95 ${className}`}
        title="Download / Install CBT Application on PC & Mobile"
      >
        <Download className="w-3.5 h-3.5 text-slate-950" />
        <span>Download App</span>
      </button>

      {showInstructions && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-blue-900" />
                <h3 className="font-bold text-sm">Download App (PC & Mobile)</h3>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong className="block text-slate-900 font-bold mb-1">On Chrome / Edge (Laptop & PC):</strong>
                Click the <strong>Install / Computer Icon</strong> located on the right side of the URL address bar, or click Menu (⋮) → <strong>Install Honey's World CBT</strong>.
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong className="block text-slate-900 font-bold mb-1">On Android / Mobile Chrome:</strong>
                Tap Menu (⋮) → <strong>Install App</strong> or <strong>Add to Home Screen</strong>.
              </div>
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="w-full py-2 bg-blue-900 text-white font-bold text-xs rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
