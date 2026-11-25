import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Download,
  RotateCcw,
  Trash2,
  Eye,
  Clock,
  GraduationCap,
  Award,
  X
} from 'lucide-react';
import { Submission, Examination, SchoolClass, SchoolSettings, enrichSubmissionsWithOrdinals } from '../../types/cbt';
import { deleteSubmission, restartStudentExamTimer } from '../../services/firebase';
import { StudentResultView } from '../student/StudentResultView';

interface AdminSubmissionsTabProps {
  submissions: Submission[];
  exams: Examination[];
  classes: SchoolClass[];
  onSubmissionsUpdated: () => void;
  showNotification: (text: string, type?: 'success' | 'error') => void;
  schoolSettings?: SchoolSettings;
}

export const AdminSubmissionsTab: React.FC<AdminSubmissionsTabProps> = ({
  submissions,
  exams,
  classes,
  onSubmissionsUpdated,
  showNotification,
  schoolSettings
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExamFilter, setSelectedExamFilter] = useState('All');
  const [selectedClassFilter, setSelectedClassFilter] = useState('All');
  const [viewingSlipSubmission, setViewingSlipSubmission] = useState<Submission | null>(null);
  const [pendingActionSubmission, setPendingActionSubmission] = useState<Submission | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const enrichedSubmissions = React.useMemo(
    () => enrichSubmissionsWithOrdinals(submissions),
    [submissions]
  );

  const filtered = enrichedSubmissions.filter(sub => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      sub.studentName.toLowerCase().includes(q) ||
      sub.admissionNumber.toLowerCase().includes(q) ||
      sub.examTitle.toLowerCase().includes(q) ||
      (sub.sittingLabel || '').toLowerCase().includes(q);
    const matchExam = selectedExamFilter === 'All' || sub.examId === selectedExamFilter;
    const matchClass = selectedClassFilter === 'All' || sub.classGrade === selectedClassFilter;
    return matchSearch && matchExam && matchClass;
  });

  const handleConfirmUnlockRetake = async () => {
    if (!pendingActionSubmission) return;
    const sub = pendingActionSubmission;
    setActionBusy(true);
    try {
      await restartStudentExamTimer(sub.studentId, sub.examId);
      onSubmissionsUpdated();
      showNotification(
        `Retake unlocked for ${sub.studentName}! Previous sittings (${sub.sittingLabel || '1st Exam'}) remain preserved separately.`
      );
      setPendingActionSubmission(null);
    } catch (err: any) {
      showNotification(err.message || 'Failed to restart student timer.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmDeleteSubmissionRow = async () => {
    if (!pendingActionSubmission?.id) return;
    const sub = pendingActionSubmission;
    setActionBusy(true);
    try {
      await deleteSubmission(sub.id!);
      onSubmissionsUpdated();
      showNotification(`Removed ${sub.sittingLabel || 'submission'} record for ${sub.studentName}.`);
      setPendingActionSubmission(null);
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete submission record.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ['Student Name', 'Admission Number', 'Sitting', 'Exam Title', 'Subject', 'Class', 'Score', 'Total Questions', 'Percentage', 'Time Spent (Mins)', 'Submission Date'];
    const rows = filtered.map(s => [
      `"${s.studentName}"`,
      `"${s.admissionNumber}"`,
      `"${s.sittingLabel || '1st Exam'}"`,
      `"${s.examTitle}"`,
      `"${s.subject}"`,
      `"${s.classGrade}"`,
      s.score,
      s.totalQuestions,
      `${s.percentage}%`,
      Math.round(s.timeSpentSeconds / 60),
      `"${new Date(s.submittedAt).toLocaleString()}"`
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cbt_exam_submissions_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-900 text-[11px] font-bold border border-teal-200 uppercase tracking-wide mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
            <span>CBT Candidate Answer Sheets</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">Student CBT Submissions & Retake Reset</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit test results, inspect scores, and reset submissions if a student experienced technical difficulty or requires an approved re-examination.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Submissions CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student name, admission number, or exam title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedExamFilter}
            onChange={(e) => setSelectedExamFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 cursor-pointer"
          >
            <option value="All">All Exams ({exams.length})</option>
            {exams.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.title}</option>
            ))}
          </select>

          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 cursor-pointer"
          >
            <option value="All">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/60">
              <th className="py-3 px-4">Candidate Name & ID</th>
              <th className="py-3 px-4">Examination Paper</th>
              <th className="py-3 px-4">Class</th>
              <th className="py-3 px-4">Score / Max</th>
              <th className="py-3 px-4">Percentage</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4">Submitted At</th>
              <th className="py-3 px-4 text-right">Reset Retake</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No submissions found matching filters.
                </td>
              </tr>
            ) : (
              filtered.map((sub, idx) => (
                <tr key={sub.id || idx} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div>{sub.studentName}</div>
                    <div className="text-[10px] text-slate-500 font-mono font-normal">
                      {sub.admissionNumber}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] uppercase">
                        {sub.sittingLabel || '1st Exam'}
                      </span>
                      <span className="font-semibold text-slate-900">{sub.examTitle}</span>
                    </div>
                    <div className="text-[10px] text-blue-900 mt-0.5">{sub.subject}</div>
                  </td>

                  <td className="py-3 px-4 font-bold text-slate-800">
                    {sub.classGrade}
                  </td>

                  <td className="py-3 px-4 font-mono font-bold">
                    {sub.score} / {sub.totalQuestions}
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-black ${
                        sub.percentage >= 50
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {sub.percentage}%
                    </span>
                  </td>

                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {Math.round((sub.timeSpentSeconds || 0) / 60)} mins
                  </td>

                  <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                    {new Date(sub.submittedAt).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setViewingSlipSubmission(sub)}
                        className="px-2.5 py-1 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="View and print candidate's official institutional result slip"
                      >
                        <Eye className="w-3 h-3 text-blue-700" />
                        <span>Official Slip</span>
                      </button>
                      <button
                        onClick={() => setPendingActionSubmission(sub)}
                        className="px-2 py-1 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                        title="Unlock a retake (preserves prior sitting scores) or manage this record"
                      >
                        <RotateCcw className="w-3 h-3 text-amber-700" />
                        <span>Retake / Reset</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Official Result Slip Modal for Admin Inspection & Printing */}
      {viewingSlipSubmission && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-5xl max-h-[95vh] overflow-y-auto bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 p-2 sm:p-4">
            <StudentResultView
              submission={viewingSlipSubmission}
              allowReview={true}
              onReturnToDashboard={() => setViewingSlipSubmission(null)}
              settings={schoolSettings}
            />
          </div>
        </div>
      )}

      {/* Retake Unlock / Delete Record Modal */}
      {pendingActionSubmission && (
        <div className="fixed inset-0 z-60 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Manage Sitting & Unlock Retake</h3>
              </div>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setPendingActionSubmission(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="font-bold text-slate-900">
                  {pendingActionSubmission.studentName} ({pendingActionSubmission.admissionNumber})
                </div>
                <div className="text-slate-600">
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] mr-1.5">
                    {pendingActionSubmission.sittingLabel || '1st Exam'}
                  </span>
                  {pendingActionSubmission.examTitle} · Score: <strong>{pendingActionSubmission.score}/{pendingActionSubmission.totalQuestions} ({pendingActionSubmission.percentage}%)</strong>
                </div>
              </div>

              <p className="text-slate-600 leading-relaxed">
                <strong>Unlock Retake (Recommended):</strong> Restarts the countdown timer and unlocks a fresh sitting for the candidate while keeping existing scores (1st Exam, 2nd Exam, etc.) stored separately.
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {pendingActionSubmission.id ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleConfirmDeleteSubmissionRow}
                    className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete This Sitting Row</span>
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => setPendingActionSubmission(null)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleConfirmUnlockRetake}
                    className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{actionBusy ? 'Processing...' : 'Unlock New Sitting'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
