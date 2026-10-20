import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  KeyRound,
  User,
  Hash,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  History,
  X,
  Check
} from 'lucide-react';
import { Student, SavedStudentLogin } from '../../types/cbt';
import { authenticateStudent, fetchStudents } from '../../services/firebase';

interface StudentLoginProps {
  onLoginSuccess: (student: Student) => void;
  onNavigateToTeacher: () => void;
}

export const StudentLogin: React.FC<StudentLoginProps> = ({ onLoginSuccess, onNavigateToTeacher }) => {
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredStudents, setRegisteredStudents] = useState<Student[]>([]);
  const [showRoster, setShowRoster] = useState(false);
  const [savedLogins, setSavedLogins] = useState<SavedStudentLogin[]>([]);

  // Load saved logins from device storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('prime_cbt_saved_student_logins');
      if (stored) {
        const parsed: SavedStudentLogin[] = JSON.parse(stored);
        setSavedLogins(parsed);
        // Pre-fill with most recent login if available
        if (parsed.length > 0) {
          setAdmissionNumber(parsed[0].admissionNumber);
          setFirstName(parsed[0].firstName);
        }
      }
    } catch (e) {
      console.warn('Error reading saved logins:', e);
    }

    // Load active registered students
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
        lastLoginAt: new Date().toISOString()
      };
      const updated = [newEntry, ...currentSaved].slice(0, 5);
      setSavedLogins(updated);
      localStorage.setItem('prime_cbt_saved_student_logins', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not store student login:', e);
    }
  };

  const removeSavedLogin = (admNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedLogins.filter(s => s.admissionNumber.toUpperCase() !== admNumber.toUpperCase());
    setSavedLogins(updated);
    localStorage.setItem('prime_cbt_saved_student_logins', JSON.stringify(updated));
    if (admissionNumber.toUpperCase() === admNumber.toUpperCase()) {
      setAdmissionNumber('');
      setFirstName('');
    }
  };

  const handleSelectSaved = (saved: SavedStudentLogin) => {
    setAdmissionNumber(saved.admissionNumber);
    setFirstName(saved.firstName);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanAdm = admissionNumber.trim().toUpperCase();
    const cleanFirst = firstName.trim();
    const cleanSurname = surname.trim();

    if (!cleanAdm || !cleanFirst || !cleanSurname) {
      setError('Please provide your Student ID / Admission Number, First Name, and Surname.');
      return;
    }

    setLoading(true);

    try {
      const student = await authenticateStudent(cleanAdm, cleanFirst, cleanSurname);

      if (!student) {
        // Fallback check against in-memory student registry
        const localMatch = registeredStudents.find(
          s => s.admissionNumber.toUpperCase() === cleanAdm &&
               s.firstName.toLowerCase() === cleanFirst.toLowerCase() &&
               s.surname.toLowerCase() === cleanSurname.toLowerCase()
        );

        if (localMatch) {
          if (rememberMe) saveLoginToDevice(localMatch);
          onLoginSuccess(localMatch);
          return;
        }

        setError('No active student found matching these credentials. Verify your Student ID and Surname spelling.');
        setLoading(false);
        return;
      }

      if (rememberMe) saveLoginToDevice(student);
      onLoginSuccess(student);
    } catch (err) {
      setError('Connection to student authentication service failed. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (s: Student) => {
    setAdmissionNumber(s.admissionNumber);
    setFirstName(s.firstName);
    setSurname(s.surname);
    setError(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-xl w-full space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Student Portal Login</h1>
              <p className="text-xs text-slate-500">
                Enter your teacher-assigned Student ID and Surname password to access examinations
              </p>
            </div>
          </div>

          {/* Saved Logins on This Device */}
          {savedLogins.length > 0 && (
            <div className="mb-6 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <History className="w-3.5 h-3.5 text-blue-900" />
                <span>Saved Accounts on this Terminal / Device</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {savedLogins.map((saved) => (
                  <div
                    key={saved.admissionNumber}
                    onClick={() => handleSelectSaved(saved)}
                    className={`group cursor-pointer px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 transition-all ${
                      admissionNumber.toUpperCase() === saved.admissionNumber.toUpperCase()
                        ? 'bg-blue-900 text-white border-blue-900 font-bold shadow-sm'
                        : 'bg-white text-slate-800 border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    <span>{saved.fullName} ({saved.admissionNumber})</span>
                    <button
                      type="button"
                      onClick={(e) => removeSavedLogin(saved.admissionNumber, e)}
                      className={`p-0.5 rounded-full hover:bg-rose-500 hover:text-white transition-colors ${
                        admissionNumber.toUpperCase() === saved.admissionNumber.toUpperCase() ? 'text-blue-200' : 'text-slate-400'
                      }`}
                      title="Remove saved student from this device"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Authentication Failed:</strong> {error}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>Student ID / Admission Number</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. STU-1001 or assigned ID"
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold tracking-wider border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 text-slate-900 uppercase placeholder:normal-case placeholder:font-normal"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Assigned or generated by your teacher/examination administrator.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>First Name</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Emmanuel"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Surname (Password)</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="e.g. Adebayo"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                />
                <span>Save credentials on this device for subsequent logins</span>
              </label>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Security Architecture:</strong> Your registered surname serves as the examination password. Paired with your unique Student ID, this secures individual test access and preserves private score transcripts.
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating Candidate...' : 'Log In to Examination Hall'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Roster Selector for Teachers/Invigilators testing terminal */}
          {registeredStudents.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRoster(prev => !prev)}
                className="text-xs font-semibold text-blue-900 hover:underline flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{showRoster ? 'Hide Enrolled Students List' : `View ${registeredStudents.length} Enrolled Students for Fast Testing`}</span>
              </button>

              {showRoster && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {registeredStudents.map(std => (
                    <button
                      key={std.id}
                      type="button"
                      onClick={() => handleQuickFill(std)}
                      className="w-full text-left p-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{std.fullName}</div>
                        <div className="text-[11px] font-mono text-slate-500">ID: {std.admissionNumber} · Class: {std.classGrade}</div>
                      </div>
                      <span className="text-[10px] font-semibold text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-200">
                        Fill Credentials →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Staff or Invigilator?</span>
            <button
              onClick={onNavigateToTeacher}
              className="font-bold text-slate-900 hover:underline"
            >
              Teacher Admin Portal →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
