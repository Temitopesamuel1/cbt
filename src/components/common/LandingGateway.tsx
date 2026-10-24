import React from 'react';
import { School, GraduationCap, ShieldCheck, BookOpen, Clock, FileSpreadsheet, BarChart2, CheckCircle, ArrowRight } from 'lucide-react';
import { SchoolSettings } from '../../types/cbt';

interface LandingGatewayProps {
  onNavigate: (route: string) => void;
  settings: SchoolSettings;
}

export const LandingGateway: React.FC<LandingGatewayProps> = ({ onNavigate, settings }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Institutional Welcome Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-900 text-white p-8 sm:p-12 relative overflow-hidden">
            <div className="max-w-3xl relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-950/80 border border-blue-800 text-blue-300 text-xs font-semibold">
                <School className="w-4 h-4 text-amber-400" />
                <span>{settings.schoolName}</span>
                <span>·</span>
                <span className="font-mono">{settings.academicSession} ({settings.currentTerm})</span>
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  {settings.schoolName}
                </h1>
                <p className="text-sm sm:text-base text-amber-300 font-semibold mt-1">
                  {settings.address || 'Gaa Ajanaku, Ilorin, Kwara State'}
                </p>
              </div>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Computer-Based Examination, Continuous Assessment Master Broadsheet, and Student Information System.
              </p>
            </div>
          </div>

          {/* Dual Portal Selection Cards */}
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50/50">
            {/* Student Candidate Portal */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:border-blue-700 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center mb-4 border border-blue-100">
                  <GraduationCap className="w-6 h-6 text-blue-700" />
                </div>

                <div className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-1">
                  Candidate Access
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Student Portal</h2>
                <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                  Log in to access your registered class examinations, sit for scheduled objective tests, track timer deadlines, and review verified academic result slips.
                </p>

                <div className="space-y-2 text-xs text-slate-600 mb-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Instant Login via Unique Student Code or User ID</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Disconnection recovery & auto-saving timer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Personalized topic revision recommendations</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigate('/student/login')}
                className="w-full py-3 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>Enter Student Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Teacher Administration Portal */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:border-slate-800 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-amber-400" />
                </div>

                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Faculty & Invigilation
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Faculty & Staff Portal</h2>
                <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                  Teacher portal for examination schedules, question banking, test invigilation, and student continuous assessment for assigned subjects. Log in with your unique Staff ID.
                </p>

                <div className="space-y-2 text-xs text-slate-600 mb-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Manage multiple classes (JSS1–SS3) and subjects</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Question banking with bulk CSV import/export</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Export student scores to CSV for Microsoft Excel</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigate('/teacher/login')}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>Staff & Teacher Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* School Examination Standards Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <Clock className="w-5 h-5 text-blue-900 mb-2" />
            <h3 className="text-xs font-bold text-slate-900 uppercase">Synchronized Timer</h3>
            <p className="text-xs text-slate-500 mt-1">
              Examination deadlines calculated from recorded server start timestamps.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <FileSpreadsheet className="w-5 h-5 text-blue-900 mb-2" />
            <h3 className="text-xs font-bold text-slate-900 uppercase">Excel CSV Integration</h3>
            <p className="text-xs text-slate-500 mt-1">
              Import question banks and export graded scores directly into Microsoft Excel.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <BarChart2 className="w-5 h-5 text-blue-900 mb-2" />
            <h3 className="text-xs font-bold text-slate-900 uppercase">Topic Diagnostics</h3>
            <p className="text-xs text-slate-500 mt-1">
              Automated analytics highlight curriculum concepts requiring remedial instruction.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <ShieldCheck className="w-5 h-5 text-blue-900 mb-2" />
            <h3 className="text-xs font-bold text-slate-900 uppercase">Strict Role Isolation</h3>
            <p className="text-xs text-slate-500 mt-1">
              Students cannot access correct answers, other candidate files, or teacher controls.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
