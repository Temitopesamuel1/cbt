import React, { useState } from 'react';
import {
  Printer,
  Download,
  School,
  KeyRound,
  Check,
  Copy,
  X,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { StaffMember } from '../../types/cbt';

interface StaffSlipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  schoolName: string;
}

export const StaffSlipsModal: React.FC<StaffSlipsModalProps> = ({
  isOpen,
  onClose,
  staffList,
  schoolName
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    if (staffList.length === 0) return;
    const headers = ['Full Name', 'Role', 'Email', 'Unique Staff Login ID', 'Assigned Subjects', 'Assigned Classes', 'Status'];
    const rows = staffList.map(s => [
      `"${s.fullName}"`,
      `"${s.role.toUpperCase()}"`,
      `"${s.email}"`,
      `"${s.uniqueId}"`,
      `"${s.assignedSubjectNames.join('; ')}"`,
      `"${s.assignedClasses.join('; ')}"`,
      `"${s.status}"`
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prime_edutech_staff_credentials_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Faculty Staff Login Credentials Slips</h2>
              <p className="text-xs text-slate-400">
                Print or distribute unique login IDs for teachers to enter the staff portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slips</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slips Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staffList.map((st) => (
              <div
                key={st.id}
                className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-5 shadow-sm relative break-inside-avoid print:border-solid print:border-slate-400"
              >
                {/* School Name & Badge */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <School className="w-4 h-4 text-blue-900" />
                    <span className="text-xs font-black tracking-wider text-blue-950 uppercase">
                      {schoolName}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                    Faculty Staff Pass
                  </span>
                </div>

                {/* Staff Details */}
                <div className="space-y-2 mb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Teacher Name</span>
                    <span className="text-sm font-black text-slate-900">{st.fullName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Role / Designation</span>
                      <span className="font-semibold text-slate-800 uppercase">{st.role}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Faculty Email</span>
                      <span className="font-mono text-slate-700 truncate block text-[11px]">{st.email}</span>
                    </div>
                  </div>
                  <div className="text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Subjects</span>
                    <span className="font-medium text-blue-900">{st.assignedSubjectNames.join(', ') || 'None assigned'}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Classes</span>
                    <span className="font-medium text-slate-700">{st.assignedClasses.join(', ') || 'All Classes'}</span>
                  </div>
                </div>

                {/* Passcode Box */}
                <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-amber-400 font-bold block">
                      Unique Staff Login ID
                    </span>
                    <span className="text-lg font-mono font-black tracking-widest text-white">
                      {st.uniqueId}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(st.uniqueId)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-colors no-print"
                    title="Copy Staff ID"
                  >
                    {copiedId === st.uniqueId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="mt-3 text-[10px] text-slate-400 italic text-center">
                  Use this Unique ID at Staff Login. Strictly confidential.
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 no-print">
          <span>Total Faculty Credentials: <strong>{staffList.length}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
