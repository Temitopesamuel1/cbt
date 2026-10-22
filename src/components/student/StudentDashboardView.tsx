import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileText,
  BarChart3,
  Award,
  Filter,
  Check
} from 'lucide-react';
import { Student, Examination, Submission, checkExamTimeWindow } from '../../types/cbt';
import { fetchExaminations, fetchSubmissions } from '../../services/firebase';

interface StudentDashboardViewProps {
  student: Student;
  onStartExam: (exam: Examination) => void;
  onViewResult: (submission: Submission) => void;
  onNavigateToHistory: () => void;
}

// Strict normalization to match class cohorts (e.g. "SS 2" === "SS2" === "Senior Secondary 2")
export function isClassMatch(studentClass: string, examClass: string): boolean {
  if (!studentClass || !examClass) return false;
  const normalize = (c: string) =>
    c.toLowerCase()
      .replace(/senior\s*secondary/g, 'ss')
      .replace(/junior\s*secondary/g, 'jss')
      .replace(/[\s\-_]/g, '');

  return normalize(studentClass) === normalize(examClass);
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
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All');

  useEffect(() => {
    const loadStudentData = async () => {
      setLoading(true);
      try {
        const [allExams, allSubs] = await Promise.all([
          fetchExaminations(true), // filterPublishedOnly = true
          fetchSubmissions(undefined, student.id)
        ]);

        if (allExams) {
          // STRICT filter: students only see examinations peculiar to their exact class cohort
          const classPeculiar = allExams.filter(e => isClassMatch(student.classGrade, e.classGrade));
          setAvailableExams(classPeculiar);
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

  // Distinct subjects available for this student's class
  const availableSubjects = useMemo(() => {
    return Array.from(new Set(availableExams.map(e => e.subjectName).filter(Boolean)));
  }, [availableExams]);

  // Filtered exams according to selected subject
  const displayedExams = useMemo(() => {
    if (selectedSubjectFilter === 'All') return availableExams;
    return availableExams.filter(
      e => e.subjectName.toLowerCase() === selectedSubjectFilter.toLowerCase()
    );
  }, [availableExams, selectedSubjectFilter]);

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
              <div className="text-xs text-slate-500 font-mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Admission No: <strong>{student.admissionNumber}</strong></span>
                <span>·</span>
                <span>Class Cohort: <strong className="text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-bold">{student.classGrade}</strong></span>
                <span>·</span>
                <span>Session: <strong>{student.academicSession}</strong></span>
                <span>·</span>
                <span>Unique Student ID: <strong className="text-slate-900 font-bold">{student.accessCode || student.admissionNumber}</strong></span>
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

        {/* Section Title & Class Scope Notice */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-900 text-[10px] font-bold uppercase tracking-wider mb-1">
                <Check className="w-3 h-3 text-blue-700" />
                <span>Class Peculiar Papers: {student.classGrade}</span>
              </div>
              <h2 className="text-lg font-black text-slate-900">Scheduled Academic Examinations</h2>
              <p className="text-xs text-slate-500">
                You only see examinations and questions peculiar to your class ({student.classGrade}). Select a subject below to take your test.
              </p>
            </div>
            {studentSubmissions.length > 0 && (
              <button
                onClick={onNavigateToHistory}
                className="text-xs font-semibold text-blue-900 hover:underline shrink-0"
              >
                View Complete History ({studentSubmissions.length}) →
              </button>
            )}
          </div>

          {/* Subject Selection Tabs / Filter Bar */}
          {availableSubjects.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-6">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-blue-900" />
                <span>Select Subject to Sit:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSubjectFilter('All')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedSubjectFilter === 'All'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Subjects ({availableExams.length})
                </button>
                {availableSubjects.map((subject) => {
                  const count = availableExams.filter(
                    e => e.subjectName.toLowerCase() === subject.toLowerCase()
                  ).length;
                  const isSelected = selectedSubjectFilter.toLowerCase() === subject.toLowerCase();

                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => setSelectedSubjectFilter(subject)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-blue-900 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{subject}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                          isSelected ? 'bg-blue-800 text-blue-200' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Examinations List */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500">
              Loading scheduled examinations for {student.classGrade}...
            </div>
          ) : displayedExams.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                {selectedSubjectFilter === 'All'
                  ? `No Active Examinations Published for ${student.classGrade}`
                  : `No ${selectedSubjectFilter} Examination Found for ${student.classGrade}`}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {selectedSubjectFilter === 'All'
                  ? `There are currently no published examinations peculiar to class ${student.classGrade}. Please check back when your subject teachers upload the test papers.`
                  : `There are currently no published papers for ${selectedSubjectFilter} in class ${student.classGrade}. Click "All Subjects" above to view available examinations.`}
              </p>
              {selectedSubjectFilter !== 'All' && (
                <button
                  type="button"
                  onClick={() => setSelectedSubjectFilter('All')}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
                >
                  View All Class Subjects
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedExams.map((exam) => {
                const pastSubmission = getSubmissionForExam(exam.id);
                const hasCompleted = Boolean(pastSubmission);
                const windowStatus = checkExamTimeWindow(exam);

                return (
                  <div
                    key={exam.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition-all"
                  >
                    <div>
                      {/* Subject Tag & Status */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="text-xs font-mono font-black text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{exam.subjectName}</span>
                        </span>
                        {hasCompleted ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Completed
                          </span>
                        ) : !windowStatus.isOpen ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                            windowStatus.code === 'not_yet_started'
                              ? 'text-amber-800 bg-amber-50 border-amber-200'
                              : 'text-rose-800 bg-rose-50 border-rose-200'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {windowStatus.code === 'not_yet_started' ? 'Scheduled' : 'Window Closed'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Available Now
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mb-2 leading-snug">{exam.title}</h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">{exam.instructions}</p>

                      {/* Class Match and Specification Badge */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 space-y-1.5 text-xs font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">Class Cohort:</span>
                          <span className="font-bold text-blue-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {exam.classGrade} (Verified)
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">Questions Uploaded:</span>
                          <span className="font-bold text-slate-800">
                            {exam.totalQuestions} Questions
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">Duration:</span>
                          <span className="font-bold text-slate-800">
                            {exam.durationMinutes} Minutes
                          </span>
                        </div>

                        {/* Scheduled Time Frame Display */}
                        {(exam.startDate || exam.endDate) && (
                          <div className="pt-1.5 border-t border-slate-200 text-[10px] font-sans space-y-0.5">
                            {exam.startDate && (
                              <div className="flex items-center justify-between text-slate-600">
                                <span>Opens:</span>
                                <span className="font-semibold text-slate-800">
                                  {new Date(exam.startDate).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                            )}
                            {exam.endDate && (
                              <div className="flex items-center justify-between text-slate-600">
                                <span>Closes:</span>
                                <span className="font-semibold text-slate-800">
                                  {new Date(exam.endDate).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
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
                            className="px-3.5 py-2 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors"
                          >
                            View Result Slip →
                          </button>
                        </div>
                      ) : !windowStatus.isOpen ? (
                        <div className="space-y-2">
                          <button
                            disabled
                            className="w-full py-3 px-4 bg-slate-200 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {windowStatus.code === 'not_yet_started'
                                ? `Opens ${windowStatus.startDateFormatted || 'Later'}`
                                : 'Examination Ended'}
                            </span>
                          </button>
                          <p className="text-[11px] text-center text-slate-500">
                            {windowStatus.message}
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedExamForModal(exam)}
                          className="w-full py-3 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Sit {exam.subjectName} Examination</span>
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
                  <span>{selectedExamForModal.subjectName} Examination Briefing</span>
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
                  <div className="text-slate-500 font-mono flex items-center gap-2">
                    <span className="font-bold text-blue-900">Subject: {selectedExamForModal.subjectName}</span>
                    <span>·</span>
                    <span>Class: {selectedExamForModal.classGrade}</span>
                    <span>·</span>
                    <span>{selectedExamForModal.durationMinutes} Minutes</span>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-slate-700">
                  <h5 className="font-bold text-blue-950 uppercase tracking-wider text-[10px]">
                    Candidate Instructions for {selectedExamForModal.subjectName}:
                  </h5>
                  <p className="leading-relaxed text-blue-900">{selectedExamForModal.instructions}</p>
                </div>

                <div className="space-y-1.5 text-slate-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>You will ONLY be presented questions uploaded specifically for {selectedExamForModal.subjectName}.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Timer starts immediately upon entering the examination screen.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Your answers auto-save on each selection for disconnection safety.</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedExamForModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
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
                    className="px-5 py-2.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-xl shadow-md transition-colors flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start {selectedExamForModal.subjectName} Test</span>
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
