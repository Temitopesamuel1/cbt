import React, { useState, useEffect } from 'react';
import {
  Clock,
  RotateCcw,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Users,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { Examination, Student, Submission } from '../../types/cbt';
import { restartStudentExamTimer, fetchSubmissions } from '../../services/firebase';

interface StudentTimerResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Examination | null;
  students: Student[];
  onTimerRestarted?: () => void;
  showNotification?: (text: string, type?: 'success' | 'error') => void;
}

export const StudentTimerResetModal: React.FC<StudentTimerResetModalProps> = ({
  isOpen,
  onClose,
  exam,
  students,
  onTimerRestarted,
  showNotification
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && exam) {
      setLoading(true);
      fetchSubmissions(exam.id)
        .then(subs => {
          if (subs) setSubmissions(subs);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, exam]);

  if (!isOpen || !exam) return null;

  // Filter students for this exam's class
  const classStudents = students.filter(s => {
    if (!s.classGrade || !exam.classGrade) return true;
    const cleanStu = s.classGrade.toLowerCase().replace(/[\s\-_]/g, '');
    const cleanExam = exam.classGrade.toLowerCase().replace(/[\s\-_]/g, '');
    return cleanStu === cleanExam;
  });

  const filteredStudents = classStudents.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.admissionNumber.toLowerCase().includes(q) ||
      (s.accessCode && s.accessCode.toLowerCase().includes(q))
    );
  });

  const handleRestartTimer = async (student: Student) => {
    const confirmed = confirm(
      `Restart timer for ${student.fullName} (${student.admissionNumber}) on "${exam.title}"?\n\nThis will reset their attempt, restore the full ${exam.durationMinutes} minutes countdown, and allow the student to sit or resume the paper fresh.`
    );
    if (!confirmed) return;

    setResettingId(student.id);
    try {
      await restartStudentExamTimer(student.id, exam.id);
      setSubmissions(prev => prev.filter(s => s.studentId !== student.id));
      if (showNotification) {
        showNotification(
          `Timer successfully restarted for ${student.fullName}! Student now has a full ${exam.durationMinutes} minutes timer.`
        );
      }
      if (onTimerRestarted) onTimerRestarted();
    } catch (err: any) {
      if (showNotification) {
        showNotification(err.message || 'Failed to restart timer', 'error');
      }
    } finally {
      setResettingId(null);
    }
  };

  const handleRestartAll = async () => {
    const confirmed = confirm(
      `Reset timers and attempts for ALL ${classStudents.length} candidates in ${exam.classGrade} on "${exam.title}"?\n\nAll existing attempts and submissions for this exam will be cleared so students can sit or resit fresh.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await Promise.all(classStudents.map(s => restartStudentExamTimer(s.id, exam.id)));
      setSubmissions([]);
      if (showNotification) {
        showNotification(`All timers for ${exam.classGrade} have been restarted with full countdown!`);
      }
      if (onTimerRestarted) onTimerRestarted();
    } catch (err) {
      if (showNotification) {
        showNotification('Some timers could not be reset', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Restart Student Exam Timer</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  {exam.durationMinutes} Mins Paper
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {exam.title} · <span className="text-slate-300 font-semibold">{exam.classGrade}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-lg font-bold"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Info & Global Actions Bar */}
        <div className="p-4 bg-amber-50/70 border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2 text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Invigilator Authority:</strong> Restarting resets the student's timer back to the full{' '}
              <strong>{exam.durationMinutes} minutes</strong>, clears timeout blocks, and unlocks the paper.
            </div>
          </div>

          <button
            onClick={handleRestartAll}
            disabled={loading || classStudents.length === 0}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart Entire Class</span>
          </button>
        </div>

        {/* Filter and Search */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search candidate by name, admission no, or passcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium shrink-0">
            {filteredStudents.length} {filteredStudents.length === 1 ? 'Candidate' : 'Candidates'}
          </span>
        </div>

        {/* Candidates Roster List */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-2">
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No students found in class {exam.classGrade} matching your query.
            </div>
          ) : (
            filteredStudents.map((stu) => {
              const submission = submissions.find(s => s.studentId === stu.id);
              const isResetting = resettingId === stu.id;

              return (
                <div
                  key={stu.id}
                  className="p-3 hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {stu.firstName.charAt(0)}{stu.surname.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {stu.fullName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                        <span>{stu.admissionNumber}</span>
                        <span>·</span>
                        <span className="text-blue-900 font-semibold">{stu.accessCode || 'No Code'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Status badge */}
                    {submission ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Submitted ({submission.score}/{submission.totalQuestions})</span>
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {Math.round(submission.timeSpentSeconds / 60)}m spent
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        Ready / Inactive
                      </span>
                    )}

                    {/* Restart Timer Button */}
                    <button
                      onClick={() => handleRestartTimer(stu)}
                      disabled={isResetting}
                      className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                      title="Restart timer and clear attempt locks"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 text-amber-700 ${isResetting ? 'animate-spin' : ''}`} />
                      <span>{isResetting ? 'Restarting...' : 'Restart Timer'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Clicking "Restart Timer" applies instantly to the candidate's active paper.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
