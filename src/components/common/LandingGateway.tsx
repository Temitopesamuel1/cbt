import React from 'react';
import {
  School,
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Clock,
  FileSpreadsheet,
  BarChart2,
  CheckCircle,
  ArrowRight,
  Megaphone,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { SchoolSettings } from '../../types/cbt';

interface LandingGatewayProps {
  onNavigate: (route: string) => void;
  settings: SchoolSettings;
}

export const LandingGateway: React.FC<LandingGatewayProps> = ({ onNavigate, settings }) => {
  const isStudentActive = settings.isStudentPortalActive ?? true;
  const isTeacherActive = settings.isTeacherPortalActive ?? true;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Global Announcement Banner from Admin */}
        {settings.announcementBanner && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-center gap-3 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4" />
            </div>
            <div className="flex-1 font-medium leading-relaxed">
              <strong className="font-bold text-amber-900 mr-1.5 uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-amber-200/80">
                Institutional Notice
              </strong>
              {settings.announcementBanner}
            </div>
          </div>
        )}

        {/* Institutional Welcome Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-900 text-white p-8 sm:p-12 relative overflow-hidden">
            <div className="max-w-3xl relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-950/80 border border-blue-800 text-blue-300 text-xs font-semibold">
                <School className="w-4 h-4 text-amber-400" />
                <span>{settings.schoolName || "Honey's World High School"}</span>
                <span>·</span>
                <span className="font-mono">{settings.academicSession} ({settings.currentTerm})</span>
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  {settings.schoolName || "Honey's World High School"}
                </h1>
                <p className="text-sm sm:text-base text-amber-300 font-semibold mt-1">
                  {settings.address || 'Gaa Ajanaku, Ilorin, Kwara State'}
                </p>
                {settings.motto && (
                  <p className="text-xs text-slate-400 italic mt-0.5 font-medium">
                    "{settings.motto}"
                  </p>
                )}
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
                    <span>Instant Login via Unique Student Passcode or Admission Number</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Disconnection recovery & auto-saving timer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>AI Academic Advisor & Practice Test Center</span>
                  </div>
                </div>
              </div>

              {isStudentActive ? (
                <button
                  onClick={() => onNavigate('/student/login')}
                  className="w-full py-3 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Enter Student Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-full py-3 px-4 bg-slate-100 text-slate-500 font-bold text-xs rounded-xl text-center border border-slate-200 flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>Student Portal Temporarily Inactive</span>
                </div>
              )}
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
                    <span>Manage multiple cohorts (JSS1–SS3) and assigned subjects</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Continuous Assessment broadsheet (Assignment, Project, Test, Exam)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Auto-sync CBT scores into broadsheet & export to Excel</span>
                  </div>
                </div>
              </div>

              {isTeacherActive ? (
                <button
                  onClick={() => onNavigate('/teacher/login')}
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Staff & Teacher Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-full py-3 px-4 bg-slate-100 text-slate-500 font-bold text-xs rounded-xl text-center border border-slate-200 flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>Teacher Portal Temporarily Inactive</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Institutional Administration Entry Gate */}
        <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs uppercase font-black text-amber-400 tracking-wider">
                Institutional Authority
              </div>
              <div className="text-sm font-bold text-white">
                School Administrators & Governance Console
              </div>
              <div className="text-[11px] text-slate-400">
                Total authority over curriculum, grading scales, multi-admin management, staff provisioning, and CBT papers.
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('/admin')}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Admin Console Access</span>
            <ArrowRight className="w-4 h-4" />
          </button>
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
            <h3 className="text-xs font-bold text-slate-900 uppercase">Total Admin Control</h3>
            <p className="text-xs text-slate-500 mt-1">
              Multi-admin accounts, customizable CA weights, and WAEC grading scale.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
