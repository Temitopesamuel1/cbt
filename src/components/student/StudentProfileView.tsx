import React from 'react';
import { User, Hash, School, Calendar, CheckCircle2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Student } from '../../types/cbt';

interface StudentProfileViewProps {
  student: Student;
  onBackToDashboard: () => void;
}

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  student,
  onBackToDashboard
}) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={onBackToDashboard}
          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Examinations</span>
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-black text-2xl shadow-inner border border-blue-950">
              {student.firstName.charAt(0)}{student.surname.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">{student.fullName}</h1>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                Admission Number: {student.admissionNumber}
              </div>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Institutional Academic Profile
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px] font-semibold">FIRST NAME</span>
                <strong className="text-slate-900 text-sm">{student.firstName}</strong>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px] font-semibold">SURNAME (PASSWORD)</span>
                <strong className="text-slate-900 text-sm">{student.surname}</strong>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px] font-semibold">CLASS ENROLLED</span>
                <strong className="text-blue-900 text-sm">{student.classGrade}</strong>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px] font-semibold">ACADEMIC SESSION</span>
                <strong className="text-slate-900 text-sm">{student.academicSession}</strong>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px] font-semibold">ACCOUNT STATUS</span>
                <span className="inline-flex items-center gap-1 text-emerald-800 font-bold text-xs mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Active / Eligible for Testing
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px] font-semibold">REGISTRATION DATE</span>
                <strong className="text-slate-900 font-mono text-xs">
                  {new Date(student.registeredAt).toLocaleDateString('en-GB')}
                </strong>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <strong>Security & Privacy:</strong> Your account is registered under strict role-based isolation. You can only view papers published for your registered class form and your own verified submissions.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
