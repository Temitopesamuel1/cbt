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
  Award
} from 'lucide-react';
import { Submission, Examination, SchoolClass } from '../../types/cbt';
import { deleteSubmission } from '../../services/firebase';

interface AdminSubmissionsTabProps {
  submissions: Submission[];
  exams: Examination[];
  classes: SchoolClass[];
  onSubmissionsUpdated: () => void;
  showNotification: (text: string, type?: 'success' | 'error') => void;
}

export const AdminSubmissionsTab: React.FC<AdminSubmissionsTabProps> = ({
  submissions,
  exams,
  classes,
  onSubmissionsUpdated,
  showNotification
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExamFilter, setSelectedExamFilter] = useState('All');
  const [selectedClassFilter, setSelectedClassFilter] = useState('All');

  const filtered = submissions.filter(sub => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      sub.studentName.toLowerCase().includes(q) ||
      sub.admissionNumber.toLowerCase().includes(q) ||
      sub.examTitle.toLowerCase().includes(q);
    const matchExam = selectedExamFilter === 'All' || sub.examId === selectedExamFilter;
    const matchClass = selectedClassFilter === 'All' || sub.classGrade === selectedClassFilter;
    return matchSearch && matchExam && matchClass;
  });

  const handleResetSubmission = async (sub: Submission) => {
    if (!sub.id) return;
    if (confirm(`Reset examination attempt for "${sub.studentName}" (${sub.examTitle})?\n\nThis will delete their submitted result and permit the student to log back in and retake the exam.`)) {
      try {
        await deleteSubmission(sub.id);
        onSubmissionsUpdated();
        showNotification(`Examination attempt for ${sub.studentName} has been cleared. Student may retake the paper.`);
      } catch (err: any) {
        showNotification(err.message || 'Failed to reset submission.', 'error');
      }
    }
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ['Student Name', 'Admission Number', 'Exam Title', 'Subject', 'Class', 'Score', 'Total Questions', 'Percentage', 'Time Spent (Mins)', 'Submission Date'];
    const rows = filtered.map(s => [
      `"${s.studentName}"`,
      `"${s.admissionNumber}"`,
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
                    <div className="font-semibold text-slate-900">{sub.examTitle}</div>
                    <div className="text-[10px] text-blue-900">{sub.subject}</div>
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
                    <button
                      onClick={() => handleResetSubmission(sub)}
                      className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 cursor-pointer ml-auto transition-colors"
                      title="Reset submission so student can retake exam"
                    >
                      <RotateCcw className="w-3 h-3 text-rose-600" />
                      <span>Reset Retake</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
