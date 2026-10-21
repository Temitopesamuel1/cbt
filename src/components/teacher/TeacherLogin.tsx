import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  KeyRound,
  AlertCircle,
  ArrowRight,
  Sparkles,
  School,
  Lock,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { StaffMember } from '../../types/cbt';
import { authenticateStaffByUniqueId, fetchStaffMembers } from '../../services/firebase';

interface TeacherLoginProps {
  onLoginSuccess: (staff: StaffMember) => void;
  onNavigateToStudent: () => void;
}

export const TeacherLogin: React.FC<TeacherLoginProps> = ({ onLoginSuccess, onNavigateToStudent }) => {
  const [uniqueStaffId, setUniqueStaffId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enrolledStaff, setEnrolledStaff] = useState<StaffMember[]>([]);
  const [showRoster, setShowRoster] = useState(false);

  // Load registered staff roster for quick lookup and preview
  useEffect(() => {
    fetchStaffMembers()
      .then(list => {
        if (list && list.length > 0) {
          setEnrolledStaff(list.filter(s => s.status === 'active'));
        }
      })
      .catch(err => console.warn('Staff roster fetch error:', err));
  }, []);

  // Real-time matched staff preview
  const matchedStaff = useMemo(() => {
    const clean = uniqueStaffId.trim().toUpperCase();
    if (!clean || clean.length < 3) return null;
    return enrolledStaff.find(
      s => (s.uniqueId && s.uniqueId.toUpperCase() === clean) ||
           s.email.toLowerCase() === uniqueStaffId.trim().toLowerCase()
    );
  }, [uniqueStaffId, enrolledStaff]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = uniqueStaffId.trim().toUpperCase();
    if (!cleanId) {
      setError('Please provide your teacher Unique Staff ID.');
      return;
    }

    setLoading(true);

    try {
      // Authenticate strictly against the database
      const staff = await authenticateStaffByUniqueId(cleanId);

      if (!staff) {
        setError(`Access Denied: Staff ID "${cleanId}" does not exist in the faculty database. Only registered teachers created by the Administrator can log in.`);
        setLoading(false);
        return;
      }

      if (staff.status !== 'active') {
        setError(`Your faculty account is currently marked as ${staff.status}. Please contact the institutional administrator.`);
        setLoading(false);
        return;
      }

      onLoginSuccess(staff);
    } catch (err) {
      console.error('Teacher authentication error:', err);
      setError('Connection to faculty authentication service failed. Please check your network and retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (staff: StaffMember) => {
    setUniqueStaffId(staff.uniqueId);
    setError(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-6">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
              <ShieldCheck className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Faculty Staff Portal</h1>
              <p className="text-xs text-slate-500">
                Authorized teacher examination & curriculum administration
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Authentication Denied:</strong> {error}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Unique Teacher Login ID</span>
                </label>
                <span className="text-[11px] text-slate-500">Issued by Admin</span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. TCH-1001"
                  value={uniqueStaffId}
                  onChange={(e) => {
                    setUniqueStaffId(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3.5 py-3 text-base sm:text-lg font-mono font-black tracking-widest border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-slate-900 uppercase placeholder:normal-case placeholder:font-normal placeholder:text-xs placeholder:tracking-normal placeholder:text-slate-400"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Only teachers whose details exist on the database are authorized to log in.
              </p>
            </div>

            {/* Live Verified Staff Preview */}
            {matchedStaff && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />
                    <span>{matchedStaff.fullName}</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                    {matchedStaff.role.toUpperCase()}
                  </span>
                </div>
                <div className="text-[11px] text-blue-700 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  <span>Subject: <strong>{matchedStaff.assignedSubjectNames.join(', ')}</strong></span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
            >
              <span>{loading ? 'Verifying Faculty Credentials...' : 'Authenticate & Enter Staff Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Roster for Verification & Fast Testing */}
          {enrolledStaff.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRoster(prev => !prev)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>View Registered Faculty IDs ({enrolledStaff.length})</span>
                </div>
                <span className="text-[11px] text-blue-900 underline">{showRoster ? 'Hide' : 'Show List'}</span>
              </button>

              {showRoster && (
                <div className="mt-3 space-y-2 max-h-52 overflow-y-auto">
                  {enrolledStaff.map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleQuickFill(st)}
                      className="w-full text-left p-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors flex items-center justify-between text-xs group"
                    >
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-blue-900">{st.fullName}</div>
                        <div className="text-[11px] text-slate-500">
                          Subjects: <strong className="text-slate-700">{st.assignedSubjectNames.join(', ')}</strong>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-900 bg-white group-hover:bg-slate-900 group-hover:text-white px-2 py-1 rounded border border-slate-300 text-xs transition-colors">
                        {st.uniqueId}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Student Candidate?</span>
            <button
              onClick={onNavigateToStudent}
              className="font-bold text-blue-900 hover:underline"
            >
              Student Portal →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
