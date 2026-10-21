import React, { useState } from 'react';
import {
  Printer,
  Download,
  School,
  KeyRound,
  Check,
  Copy,
  X,
  Filter
} from 'lucide-react';
import { Student } from '../../types/cbt';

interface StudentSlipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  schoolName: string;
  currentSession: string;
  currentTerm: string;
}

export const StudentSlipsModal: React.FC<StudentSlipsModalProps> = ({
  isOpen,
  onClose,
  students,
  schoolName,
  currentSession,
  currentTerm
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const classList = Array.from(new Set(students.map(s => s.classGrade)));

  const filteredStudents = selectedClass === 'All'
    ? students
    : students.filter(s => s.classGrade === selectedClass);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    if (students.length === 0) return;
    const headers = ['Full Name', 'Class Form', 'Admission Number', 'Unique Login ID / Passcode', 'Session', 'Term'];
    const rows = filteredStudents.map(s => [
      `"${s.fullName}"`,
      `"${s.classGrade}"`,
      `"${s.admissionNumber}"`,
      `"${s.accessCode || s.admissionNumber}"`,
      `"${s.academicSession || currentSession}"`,
      `"${currentTerm}"`
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prime_edutech_student_login_codes_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[90vh] flex flex-col">
        {/* Modal Header (No Print) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Student Examination Login Slips & Passkeys</h3>
              <p className="text-[11px] text-slate-400">
                Print or export login credentials with auto-generated unique IDs for candidates
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        {/* Action Controls Bar (No Print) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs no-print shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-bold text-slate-700">Filter Class:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
            >
              <option value="All">All Classes ({students.length})</option>
              {classList.map(cls => (
                <option key={cls} value={cls}>
                  {cls} ({students.filter(s => s.classGrade === cls).length})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print {filteredStudents.length} Slips</span>
            </button>
          </div>
        </div>

        {/* Slips Grid Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredStudents.map((std) => {
              const code = std.accessCode || std.admissionNumber;
              return (
                <div
                  key={std.id}
                  className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-white relative hover:border-blue-700 transition-colors break-inside-avoid shadow-xs"
                >
                  {/* Institutional Header Strip */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                        PE
                      </div>
                      <span className="font-black text-xs text-slate-900 tracking-tight uppercase">
                        {schoolName}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      {std.academicSession || currentSession} · {currentTerm}
                    </span>
                  </div>

                  {/* Student Details */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-[11px]">Candidate:</span>
                      <strong className="text-slate-900 font-bold">{std.fullName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-[11px]">Admission No:</span>
                      <span className="font-mono text-slate-700">{std.admissionNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-[11px]">Class Form:</span>
                      <span className="font-bold text-slate-800">{std.classGrade}</span>
                    </div>
                  </div>

                  {/* Prominent Unique Login Code */}
                  <div className="mt-3 p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-blue-800 tracking-wider block">
                        Unique Examination Login ID
                      </span>
                      <span className="text-base font-black font-mono tracking-widest text-blue-950">
                        {code}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(code)}
                      className="no-print p-1.5 text-blue-700 hover:text-blue-900 rounded bg-white border border-blue-200 text-[10px] font-semibold flex items-center gap-1 shadow-xs"
                      title="Copy code"
                    >
                      {copiedId === code ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-[9px] text-slate-400 mt-2 text-center">
                    Enter this unique ID on the student login screen to begin scheduled tests.
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer (No Print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end no-print shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
