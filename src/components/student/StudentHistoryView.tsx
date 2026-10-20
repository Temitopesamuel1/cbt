import React, { useState, useEffect } from 'react';
import { Award, Calendar, Clock, FileText, ChevronRight, BookOpen } from 'lucide-react';
import { Student, Submission, calculateGrade } from '../../types/cbt';
import { fetchSubmissions } from '../../services/firebase';

interface StudentHistoryViewProps {
  student: Student;
  onViewResult: (submission: Submission) => void;
  onBackToDashboard: () => void;
}

export const StudentHistoryView: React.FC<StudentHistoryViewProps> = ({
  student,
  onViewResult,
  onBackToDashboard
}) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      try {
        const subs = await fetchSubmissions(undefined, student.id);
        if (subs) {
          setSubmissions(subs);
        }
      } catch (err) {
        console.warn('History fetch:', err);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [student.id]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900">Academic Examination History</h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Candidate: {student.fullName} ({student.admissionNumber}) · Class: {student.classGrade}
            </p>
          </div>
          <button
            onClick={onBackToDashboard}
            className="px-4 py-2 text-xs font-semibold text-blue-900 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
          >
            ← Return to Active Exams
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            Loading examination history...
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Prior Submissions Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You haven't completed any examinations yet this academic session.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {submissions.map((sub, i) => {
                const grade = calculateGrade(sub.percentage);
                const mins = Math.floor(sub.timeSpentSeconds / 60);
                const secs = sub.timeSpentSeconds % 60;

                return (
                  <div key={i} className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {sub.subject}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500 font-mono">{sub.academicSession} ({sub.term})</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">{sub.examTitle}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                        <span>Time Taken: {mins}m {secs}s</span>
                        <span>·</span>
                        <span>
                          {new Date(sub.submittedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-black font-mono text-slate-900">
                          {sub.score} <span className="text-xs text-slate-400 font-normal">/ {sub.totalQuestions}</span>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className="text-xs font-bold font-mono text-slate-700">{sub.percentage}%</span>
                          <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${grade.color}`}>
                            {grade.grade}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onViewResult(sub)}
                        className="p-2 text-blue-900 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                      >
                        <span>Slip</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
