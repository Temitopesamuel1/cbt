import React from 'react';
import { Shield, GraduationCap, UserCheck, LogOut, School } from 'lucide-react';
import { SchoolSettings } from '../../types/cbt';

interface InstitutionalHeaderProps {
  currentPortal: 'landing' | 'teacher' | 'student' | 'admin';
  currentRoute: string;
  onNavigate: (route: string) => void;
  userDisplayName?: string | null;
  onLogout?: () => void;
  settings?: SchoolSettings;
  examInProgress?: boolean;
}

export const InstitutionalHeader: React.FC<InstitutionalHeaderProps> = ({
  currentPortal,
  currentRoute,
  onNavigate,
  userDisplayName,
  onLogout,
  settings,
  examInProgress
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Institutional Wordmark */}
          <div
            onClick={() => {
              if (!examInProgress) {
                if (currentPortal === 'admin') onNavigate('/admin/dashboard');
                else if (currentPortal === 'teacher') onNavigate('/teacher/dashboard');
                else if (currentPortal === 'student') onNavigate('/student/dashboard');
                else onNavigate('/');
              }
            }}
            className={`flex items-center gap-3 shrink-0 cursor-pointer ${examInProgress ? 'pointer-events-none' : ''}`}
          >
            <div className="w-10 h-10 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-lg shadow-inner border border-blue-600">
              <School className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>{settings?.schoolName || "HONEY'S WORLD HIGH SCHOOL"}</span>
                <span className={`text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded border ${
                  currentPortal === 'admin'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-blue-950 text-blue-300 border-blue-800'
                }`}>
                  {currentPortal === 'admin' ? 'Admin Authority' : currentPortal === 'teacher' ? 'Staff Portal' : currentPortal === 'student' ? 'Student Portal' : 'Assessment'}
                </span>
              </div>
              <div className="text-[11px] text-amber-300/90 hidden sm:block font-medium">
                {settings?.address || 'Gaa Ajanaku, Ilorin, Kwara State'}
              </div>
            </div>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            {currentPortal === 'landing' && (
              <>
                <button
                  onClick={() => onNavigate('/student/login')}
                  className="hover:text-white transition-colors"
                >
                  Student Portal
                </button>
                <button
                  onClick={() => onNavigate('/teacher/login')}
                  className="hover:text-white transition-colors"
                >
                  Teacher Portal
                </button>
                <span className="text-slate-500 font-mono">
                  Session: {settings?.academicSession || '2025/2026'} · {settings?.currentTerm || '1st Term'}
                </span>
              </>
            )}

            {currentPortal === 'teacher' && !examInProgress && (
              <>
                <button
                  onClick={() => onNavigate('/teacher/dashboard')}
                  className={`hover:text-white transition-colors ${currentRoute === '/teacher/dashboard' ? 'text-amber-300 font-bold' : ''}`}
                >
                  Overview
                </button>
                <button
                  onClick={() => onNavigate('/teacher/examinations')}
                  className={`hover:text-white transition-colors ${currentRoute === '/teacher/examinations' ? 'text-amber-300 font-bold' : ''}`}
                >
                  Examinations
                </button>
                <button
                  onClick={() => onNavigate('/teacher/questions')}
                  className={`hover:text-white transition-colors ${currentRoute === '/teacher/questions' ? 'text-amber-300 font-bold' : ''}`}
                >
                  Question Bank
                </button>
                <button
                  onClick={() => onNavigate('/teacher/students')}
                  className={`hover:text-white transition-colors ${currentRoute === '/teacher/students' ? 'text-amber-300 font-bold' : ''}`}
                >
                  Students
                </button>
                <button
                  onClick={() => onNavigate('/teacher/results')}
                  className={`hover:text-white transition-colors ${currentRoute === '/teacher/results' ? 'text-amber-300 font-bold' : ''}`}
                >
                  Results
                </button>
                <button
                  onClick={() => onNavigate('/teacher/analytics')}
                  className={`hover:text-white transition-colors ${currentRoute === '/teacher/analytics' ? 'text-amber-300 font-bold' : ''}`}
                >
                  Analytics
                </button>
              </>
            )}

            {currentPortal === 'student' && !examInProgress && (
              <>
                <button
                  onClick={() => onNavigate('/student/dashboard')}
                  className={`hover:text-white transition-colors ${currentRoute === '/student/dashboard' ? 'text-amber-300 font-bold' : ''}`}
                >
                  My Examinations
                </button>
                <button
                  onClick={() => onNavigate('/student/history')}
                  className={`hover:text-white transition-colors ${currentRoute === '/student/history' ? 'text-amber-300 font-bold' : ''}`}
                >
                  Past Results
                </button>
                <button
                  onClick={() => onNavigate('/student/profile')}
                  className={`hover:text-white transition-colors ${currentRoute === '/student/profile' ? 'text-amber-300 font-bold' : ''}`}
                >
                  Student Profile
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: Primary Action / User Profile */}
          <div className="flex items-center gap-3 shrink-0">
            {examInProgress ? (
              <div className="px-3 py-1 text-xs font-bold bg-rose-600 text-white rounded-lg animate-pulse">
                Examination Active
              </div>
            ) : userDisplayName ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-white truncate max-w-[150px]">
                    {userDisplayName}
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize">
                    {currentPortal === 'admin' ? 'Institutional Administrator' : currentPortal === 'teacher' ? 'Faculty Staff' : 'Student Candidate'}
                  </div>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Log Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {currentRoute !== '/student/login' && (
                  <button
                    onClick={() => onNavigate('/student/login')}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                  >
                    Student Login
                  </button>
                )}
                {currentRoute !== '/teacher/login' && (
                  <button
                    onClick={() => onNavigate('/teacher/login')}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 rounded-lg shadow-sm transition-colors"
                  >
                    Staff Login
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
