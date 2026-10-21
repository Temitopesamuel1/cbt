import React from 'react';
import { BookOpen, HelpCircle, KeyRound, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface HelpModalProps {
  onBack: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onBack }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 mb-6">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              PRIME EDUTECH Candidate Examination Regulations & Keypad Standards
            </h1>
            <p className="text-xs text-slate-500">
              Official instructions for secondary school candidates sitting for computerized examinations
            </p>
          </div>
        </div>

        <div className="space-y-6 text-xs text-slate-700 leading-relaxed">
          <div>
            <h2 className="text-sm font-bold text-blue-950 mb-2 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-blue-900" />
              <span>1. Terminal Navigation & Controls</span>
            </h2>
            <p className="mb-3">
              Candidates can select answers using touchscreen/mouse input or high-speed keyboard controls:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                <span className="font-bold text-blue-900">Key A, B, C, D</span>: Selects Option A, B, C, or D directly.
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                <span className="font-bold text-blue-900">Key P / Left Arrow</span>: Moves to the Previous Question.
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                <span className="font-bold text-blue-900">Key N / Right Arrow</span>: Moves to the Next Question.
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                <span className="font-bold text-blue-900">Key R</span>: Flags or unflags the question to review later.
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                <span className="font-bold text-blue-900">Key S</span>: Opens the Final Submission confirmation dialog.
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-blue-950 mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-900" />
              <span>2. Server-Synchronized Timer & Auto-Submit</span>
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Each examination has an official countdown timer displayed in the top bar.</li>
              <li>When under 3 minutes remain, the timer changes to amber warning status.</li>
              <li>When under 1 minute remains, the timer displays a red pulsing alert.</li>
              <li><strong>Auto-Submit Policy:</strong> Once the countdown reaches 00:00, all answered questions are automatically submitted and graded immediately.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold text-blue-950 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-900" />
              <span>3. Question Matrix & Answer Status</span>
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-blue-900">Blue Box:</strong> Indicates that you have selected an answer for that question.</li>
              <li><strong className="text-slate-600">White/Gray Box:</strong> Indicates that the question is still unanswered.</li>
              <li><strong className="text-amber-700">Gold Flag Marker:</strong> Indicates a question you flagged to review before submitting.</li>
              <li>Continuous autosave ensures that in the event of accidental disconnection, progress is restored seamlessly upon terminal reconnection.</li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={onBack}
              className="px-5 py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
            >
              Back to Candidate Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
