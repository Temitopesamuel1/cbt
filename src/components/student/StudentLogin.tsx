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
  UserCheck,
  Mail,
  Lock,
  School
} from 'lucide-react';
import { Student, SavedStudentLogin } from '../../types/cbt';
import { authenticateStudentWithCredentials, fetchStudents } from '../../services/firebase';

interface StudentLoginProps {
  onLoginSuccess: (student: Student) => void;
  onNavigateToTeacher: () => void;
}

export const StudentLogin: React.FC<StudentLoginProps> = ({ onLoginSuccess, onNavigateToTeacher }) => {
  const [loginMode, setLoginMode] = useState<'passcode' | 'email'>('passcode');
  const [studentCodeOrId, setStudentCodeOrId] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredStudents, setRegisteredStudents] = useState<Student[]>([]);
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

  // Real-time matched candidate preview for passcode mode
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

    let identifier = '';
    let password = '';

    if (loginMode === 'passcode') {
      identifier = studentCodeOrId.trim();
      if (!identifier) {
        setError('Please enter your unique Student Passcode or Admission Number.');
        return;
      }
    } else {
      identifier = studentEmail.trim();
      password = studentPassword.trim();
      if (!identifier) {
        setError('Please enter your connected email address.');
        return;
      }
      if (!password) {
        setError('Please enter your personal security password.');
        return;
      }
    }

    setLoading(true);

    try {
      const res = await authenticateStudentWithCredentials(identifier, password || undefined);
      if (!res.success || !res.student) {
        setError(res.error || 'Authentication failed. Please verify your credentials.');
        setLoading(false);
        return;
      }

      if (rememberMe) saveLoginToDevice(res.student);
      onLoginSuccess(res.student);
    } catch (err) {
      console.error('Student login error:', err);
      setError('Unable to authenticate at this moment. Please check network connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-lg w-full space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {/* Header */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-900 text-white flex items-center justify-center mx-auto shadow-inner border border-blue-950">
              <GraduationCap className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Student Information Portal
            </h1>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Access your scheduled CBT examinations, live Continuous Assessment grades, and cumulative university transcript.
            </p>
          </div>

          {/* Authentication Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setLoginMode('passcode');
                setError(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                loginMode === 'passcode'
                  ? 'bg-white text-blue-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-blue-800" />
              <span>Passcode / Admission No</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginMode('email');
                setError(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                loginMode === 'email'
                  ? 'bg-white text-blue-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-blue-800" />
              <span>Connected Email</span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Authentication Notice</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {loginMode === 'passcode' ? (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Student Passcode or Admission No
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. PRM-4821 or STU/2025/001"
                    value={studentCodeOrId}
                    onChange={e => {
                      setStudentCodeOrId(e.target.value);
                      setError(null);
                    }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-mono font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>

                {/* Candidate preview */}
                {matchedStudentPreview && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 animate-fadeIn">
                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="text-xs">
                      <strong className="text-emerald-950 block">{matchedStudentPreview.fullName}</strong>
                      <span className="text-emerald-700">Enrolled: {matchedStudentPreview.classGrade} ({matchedStudentPreview.admissionNumber})</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Connected Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. student@school.edu.ng"
                      value={studentEmail}
                      onChange={e => {
                        setStudentEmail(e.target.value);
                        setError(null);
                      }}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Security Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={studentPassword}
                      onChange={e => {
                        setStudentPassword(e.target.value);
                        setError(null);
                      }}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded text-blue-900 focus:ring-blue-900"
                />
                <span>Remember on this browser</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-900 hover:bg-blue-950 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign Into Student Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Teacher Portal Switch */}
          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <span className="text-xs text-slate-500">Are you a faculty instructor? </span>
            <button
              onClick={onNavigateToTeacher}
              className="text-xs text-blue-900 font-bold hover:underline cursor-pointer"
            >
              Teacher & Staff Portal →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
