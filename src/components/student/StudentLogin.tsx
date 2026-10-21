import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  KeyRound,
  Hash,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  History,
  X,
  CheckCircle2,
  Copy,
  UserCheck
} from 'lucide-react';
import { Student, SavedStudentLogin } from '../../types/cbt';
import { authenticateStudentByCode, fetchStudents } from '../../services/firebase';

interface StudentLoginProps {
  onLoginSuccess: (student: Student) => void;
  onNavigateToTeacher: () => void;
}

export const StudentLogin: React.FC<StudentLoginProps> = ({ onLoginSuccess, onNavigateToTeacher }) => {
  const [studentCodeOrId, setStudentCodeOrId] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredStudents, setRegisteredStudents] = useState<Student[]>([]);
  const [showRoster, setShowRoster] = useState(false);
  const [savedLogins, setSavedLogins] = useState<SavedStudentLogin[]>([]);

  // Load saved logins and student roster
  useEffect(() => {
    try {
      const stored = localStorage.getItem('prime_edutech_saved_students') || localStorage.getItem('prime_cbt_saved_student_logins');
      if (stored) {
        const parsed: SavedStudentLogin[] = JSON.parse(stored);
        setSavedLogins(parsed);
        if (parsed.length > 0) {
          setStudentCodeOrId(parsed[0].accessCode || parsed[0].admissionNumber);
        }
      }
    } catch (e) {
      console.warn('Error reading saved logins:', e);
    }

    const loadRoster = async () => {
      try {
        const students = await fetchStudents();
        if (students && students.length > 0) {
          setRegisteredStudents(students.filter(s => s.status === 'active'));
        }
      } catch (err) {
        console.warn('Student roster fetch:', err);
      }
    };
    loadRoster();
  }, []);

  // Real-time matched candidate preview
  const matchedStudentPreview = useMemo(() => {
    const clean = studentCodeOrId.trim().toUpperCase();
    if (!clean || clean.length < 3) return null;
    return registeredStudents.find(
      s => (s.accessCode && s.accessCode.toUpperCase() === clean) ||
           s.admissionNumber.toUpperCase() === clean ||
           s.id.toUpperCase() === clean
    );
  }, [studentCodeOrId, registeredStudents]);

  const saveLoginToDevice = (student: Student) => {
    try {
      const currentSaved = savedLogins.filter(
        s => s.admissionNumber.toUpperCase() !== student.admissionNumber.toUpperCase()
      );
      const newEntry: SavedStudentLogin = {
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        fullName: student.fullName,
        classGrade: student.classGrade,
        accessCode: student.accessCode || student.admissionNumber,
        lastLoginAt: new Date().toISOString()
      };
      const updated = [newEntry, ...currentSaved].slice(0, 5);
      setSavedLogins(updated);
      localStorage.setItem('prime_edutech_saved_students', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not store student login:', e);
    }
  };

  const removeSavedLogin = (admNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedLogins.filter(s => s.admissionNumber.toUpperCase() !== admNumber.toUpperCase());
    setSavedLogins(updated);
    localStorage.setItem('prime_edutech_saved_students', JSON.stringify(updated));
  };

  const handleSelectSaved = (saved: SavedStudentLogin) => {
    const code = saved.accessCode || saved.admissionNumber;
    setStudentCodeOrId(code);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanInput = studentCodeOrId.trim().toUpperCase();
    if (!cleanInput) {
      setError('Please enter your unique Student Code or User ID provided by your teacher.');
      return;
    }

    setLoading(true);

    try {
      // 1. Direct authentication by unique access code or user ID
      const student = await authenticateStudentByCode(cleanInput);

      if (!student) {
        // Fallback local registry check
        const localMatch = registeredStudents.find(
          s => (s.accessCode && s.accessCode.toUpperCase() === cleanInput) ||
               s.admissionNumber.toUpperCase() === cleanInput ||
               s.id.toUpperCase() === cleanInput
        );

        if (localMatch) {
          if (rememberMe) saveLoginToDevice(localMatch);
          onLoginSuccess(localMatch);
          return;
        }

        setError(`No active student profile found for "${cleanInput}". Please confirm the code provided by your teacher or check the student list below.`);
        setLoading(false);
        return;
      }

      if (rememberMe) saveLoginToDevice(student);
      onLoginSuccess(student);
    } catch (err) {
      console.error('Student login error:', err);
      setError('Unable to authenticate at this moment. Please check network connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelectStudent = (student: Student) => {
    const code = student.accessCode || student.admissionNumber;
    setStudentCodeOrId(code);
    setError(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-lg w-full space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-md">
              <GraduationCap className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Student Portal Login</h1>
              <p className="text-xs text-slate-500">
                Enter your unique student code or user ID to access your examination paper
              </p>
            </div>
          </div>

          {/* Saved Accounts on Device */}
          {savedLogins.length > 0 && (
            <div className="mb-6 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <History className="w-3.5 h-3.5 text-blue-900" />
                <span>Saved Candidate Profiles on this Terminal</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {savedLogins.map((saved) => {
                  const savedCode = saved.accessCode || saved.admissionNumber;
                  const isSelected = studentCodeOrId.toUpperCase() === savedCode.toUpperCase();
                  return (
                    <div
                      key={saved.admissionNumber}
                      onClick={() => handleSelectSaved(saved)}
                      className={`group cursor-pointer px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 transition-all ${
                        isSelected
                          ? 'bg-blue-900 text-white border-blue-900 font-bold shadow-sm'
                          : 'bg-white text-slate-800 border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      <span>{saved.fullName}</span>
                      <span className={`text-[10px] font-mono px-1 rounded ${isSelected ? 'bg-blue-800 text-blue-200' : 'bg-slate-100 text-slate-500'}`}>
                        {savedCode}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => removeSavedLogin(saved.admissionNumber, e)}
                        className={`p-0.5 rounded-full hover:bg-rose-500 hover:text-white transition-colors ${
                          isSelected ? 'text-blue-200' : 'text-slate-400'
                        }`}
                        title="Remove saved student"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Authentication Notice:</strong> {error}
              </div>
            </div>
          )}

          {/* Main One-Input Student Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-900" />
                  <span>Unique Student Code / User ID</span>
                </label>
                <span className="text-[11px] text-blue-700 font-medium">Auto-generated by school</span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. PRM-4821 or STU/2025/001"
                  value={studentCodeOrId}
                  onChange={(e) => {
                    setStudentCodeOrId(e.target.value);
                    setError(null);
                  }}
                  className="w-full pl-3.5 pr-10 py-3 text-base sm:text-lg font-mono font-black tracking-widest border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 text-slate-900 uppercase placeholder:normal-case placeholder:font-normal placeholder:text-xs placeholder:tracking-normal placeholder:text-slate-400"
                />
                <div className="absolute right-3 top-3.5 text-slate-400">
                  <Hash className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Enter your unique passkey code (e.g. <strong>PRM-4821</strong>) or student admission number.
              </p>
            </div>

            {/* Candidate Real-time Verified Preview */}
            {matchedStudentPreview && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl text-xs flex items-center justify-between transition-all animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                    {matchedStudentPreview.firstName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <span>{matchedStudentPreview.fullName}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="text-[11px] text-emerald-700 font-mono">
                      Class: {matchedStudentPreview.classGrade} · Session: {matchedStudentPreview.academicSession}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                  Verified Candidate
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                />
                <span>Remember my code on this computer / tablet</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg active:scale-[0.99]"
            >
              <span>{loading ? 'Authenticating Candidate...' : 'Enter Student Portal & Start Exam'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Roster Selector for Testing & Fast ID Lookup */}
          {registeredStudents.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRoster(prev => !prev)}
                className="w-full flex items-center justify-between text-xs font-semibold text-blue-900 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Looking for your Unique Code? View Registered Students ({registeredStudents.length})</span>
                </div>
                <span className="text-[11px] underline">{showRoster ? 'Hide' : 'Show List'}</span>
              </button>

              {showRoster && (
                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                  <div className="text-[11px] text-slate-500 pb-1">
                    Click any student below to automatically populate their unique access code:
                  </div>
                  {registeredStudents.map(std => {
                    const code = std.accessCode || std.admissionNumber;
                    return (
                      <button
                        key={std.id}
                        type="button"
                        onClick={() => handleQuickSelectStudent(std)}
                        className="w-full text-left p-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-colors flex items-center justify-between text-xs group"
                      >
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-blue-900">{std.fullName}</div>
                          <div className="text-[11px] text-slate-500">
                            Class: <strong className="text-slate-700">{std.classGrade}</strong> · ID: {std.admissionNumber}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-blue-900 bg-white group-hover:bg-blue-900 group-hover:text-white px-2 py-1 rounded border border-blue-200 text-xs transition-colors block">
                            {code}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Click to Login</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Teacher link */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Teacher or Examiner?</span>
            <button
              onClick={onNavigateToTeacher}
              className="font-bold text-blue-900 hover:underline"
            >
              Faculty Administration Portal →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
