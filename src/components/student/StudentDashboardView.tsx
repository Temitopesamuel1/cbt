import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, Calendar, CheckCircle2, AlertTriangle, Play, FileText, BarChart3, Award } from 'lucide-react';
import { Student, Examination, Submission } from '../../types/cbt';
import { fetchExaminations, fetchSubmissions } from '../../services/firebase';

interface StudentDashboardViewProps {
  student: Student;
  onStartExam: (exam: Examination) => void;
  onViewResult: (submission: Submission) => void;
  onNavigateToHistory: () => void;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  student,
  onStartExam,
  onViewResult,
  onNavigateToHistory
}) => {
  const [availableExams, setAvailableExams] = useState<Examination[]>([]);
  const [studentSubmissions, setStudentSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExamForModal, setSelectedExamForModal] = useState<Examination | null>(null);

  useEffect(() => {
    const loadStudentData = async () => {
      setLoading(true);
      try {
        const [allExams, allSubs] = await Promise.all([
          fetchExaminations(true), // filterPublishedOnly = true
          fetchSubmissions(undefined, student.id)
        ]);

        if (allExams) {
          // Filter exams targeted to this student's class grade (or general papers)
          const matched = allExams.filter(
            e => e.classGrade.toLowerCase().trim() === student.classGrade.toLowerCase().trim() ||
                 e.classGrade === 'All Classes'
          );
          setAvailableExams(matched);
        }

        if (allSubs) {
          setStudentSubmissions(allSubs);
        }
      } catch (err) {
        console.warn('Error loading student dashboard papers:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStudentData();
  }, [student]);

  // Check if student has already submitted an exam
  const getSubmissionForExam = (examId: string): Submission | undefined => {
    return studentSubmissions.find(s => s.examId === examId);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Student Profile Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-black text-xl shadow-inner border border-blue-950">
              {student.firstName.charAt(0)}{student.surname.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900">{student.fullName}</h1>
                <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Enrolled Active
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Admission No: <strong>{student.admissionNumber}</strong></span>
                <span>·</span>
                <span>Class Form: <strong>{student.classGrade}</strong></span>
                <span>·</span>
                <span>Session: <strong>{student.academicSession}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Tests Sat</span>
              <span className="text-2xl font-black font-mono text-slate-900">{studentSubmissions.length}</span>
            </div>
            <div className="h-8 w-[1px] bg-slate-200" />
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Average Score</span>
              <span className="text-2xl font-black font-mono text-blue-900">
                {studentSubmissions.length > 0
                  ? Math.round(studentSubmissions.reduce((a, b) => a + b.percentage, 0) / studentSubmissions.length)
                  : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Available Scheduled Examinations */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Scheduled Academic Examinations</h2>
              <p className="text-xs text-slate-500">
                Official papers published for your class cohort ({student.classGrade})
              </p>
            </div>
            {studentSubmissions.length > 0 && (
              <button
                onClick={onNavigateToHistory}
                className="text-xs font-semibold text-blue-900 hover:underline"
              >
                View Complete History ({studentSubmissions.length}) →
              </button>
            )}
          </div>

          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              Loading scheduled examinations...
            </div>
          ) : availableExams.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Active Examinations Published</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                There are currently no published examinations for class <strong>{student.classGrade}</strong>. Please check back when your subject teachers publish the test papers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableExams.map((exam) => {
                const pastSubmission = getSubmissionForExam(exam.id);
                const hasCompleted = Boolean(pastSubmission);

                return (
                  <div
                    key={exam.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:border-slate-300 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[11px] font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {exam.subjectName}
                        </span>
                        {hasCompleted ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Completed
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Available Now
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 mb-2">{exam.title}</h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-4">{exam.instructions}</p>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg mb-4">
                        <div>
                          <span className="text-slate-400 block text-[10px] font-semibold">DURATION</span>
                          <strong className="text-slate-900 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {exam.durationMinutes} Minutes
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] font-semibold">TOTAL QUESTIONS</span>
                          <strong className="text-slate-900 font-mono flex items-center gap-1 mt-0.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            {exam.totalQuestions} Questions
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      {hasCompleted && pastSubmission ? (
                        <div className="flex items-center justify-between">
                          <div className="text-xs">
                            <span className="text-slate-400 block text-[10px]">YOUR SCORE</span>
                            <span className="font-mono font-bold text-emerald-700">
                              {pastSubmission.score} / {pastSubmission.totalQuestions} ({pastSubmission.percentage}%)
                            </span>
                          </div>
                          <button
                            onClick={() => onViewResult(pastSubmission)}
                            className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                          >
                            View Result Slip →
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedExamForModal(exam)}
                          className="w-full py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Start Examination</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pre-Exam Instructions Modal */}
        {selectedExamForModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>Examination Briefing & Code of Conduct</span>
                </div>
                <button
                  onClick={() => setSelectedExamForModal(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">{selectedExamForModal.title}</h4>
                  <div className="text-slate-500 font-mono">
                    Subject: {selectedExamForModal.subjectName} · Class: {selectedExamForModal.classGrade} · Duration: {selectedExamForModal.durationMinutes} Minutes
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-slate-700">
                  <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                    Instructions to Candidates:
                  </h5>
                  <p className="leading-relaxed">{selectedExamForModal.instructions}</p>
                </div>

                <div className="space-y-1.5 text-slate-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Timer starts immediately upon entering the examination screen.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Your answers auto-save on each selection for disconnection safety.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>When countdown reaches 00:00, paper auto-submits instantly.</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedExamForModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const exam = selectedExamForModal;
                      setSelectedExamForModal(null);
                      onStartExam(exam);
                    }}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>I Understand · Begin Examination</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
