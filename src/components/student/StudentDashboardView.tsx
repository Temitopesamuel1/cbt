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
  Check,
  Sparkles,
  Layers,
  GraduationCap,
  TrendingUp,
  User,
  Radio,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import {
  Student,
  Examination,
  Submission,
  StudentAssessmentRecord,
  checkExamTimeWindow,
  calculateGradePoint,
  getAcademicStanding
} from '../../types/cbt';
import {
  fetchExaminations,
  fetchSubmissions,
  subscribeStudentAssessmentRecords
} from '../../services/firebase';
import { StudentPracticeQuiz } from './StudentPracticeQuiz';
import { StudentCumulativeTranscript } from './StudentCumulativeTranscript';
import { StudentAiAdvisorView } from './StudentAiAdvisorView';
import { StudentProfileView } from './StudentProfileView';

interface StudentDashboardViewProps {
  student: Student;
  onStartExam: (exam: Examination) => void;
  onViewResult: (submission: Submission) => void;
  onNavigateToHistory: () => void;
  onUpdateStudent?: (updated: Student) => void;
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
  student: initialStudent,
  onStartExam,
  onViewResult,
  onNavigateToHistory,
  onUpdateStudent
}) => {
  const [activeTab, setActiveTab] = useState<'examinations' | 'broadsheet' | 'transcript' | 'practice' | 'ai-advisor' | 'profile'>('examinations');
  const [currentStudent, setCurrentStudent] = useState<Student>(initialStudent);

  const [availableExams, setAvailableExams] = useState<Examination[]>([]);
  const [studentSubmissions, setStudentSubmissions] = useState<Submission[]>([]);
  const [caRecords, setCaRecords] = useState<StudentAssessmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All');
  const [recentSyncNotice, setRecentSyncNotice] = useState<string | null>(null);

  // Sync internal student state if prop updates
  useEffect(() => {
    setCurrentStudent(initialStudent);
  }, [initialStudent]);

  // Load Examinations and Submissions
  useEffect(() => {
    const loadStudentData = async () => {
      setLoading(true);
      try {
        const [allExams, allSubs] = await Promise.all([
          fetchExaminations(true), // published only
          fetchSubmissions(undefined, currentStudent.id)
        ]);

        if (allExams) {
          const classPeculiar = allExams.filter(e => isClassMatch(currentStudent.classGrade, e.classGrade));
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
  }, [currentStudent]);

  // Real-time live subscription to Continuous Assessment & Broad Sheet records
  useEffect(() => {
    const unsubscribe = subscribeStudentAssessmentRecords(
      currentStudent.id,
      currentStudent.admissionNumber,
      updatedRecords => {
        setCaRecords(prev => {
          if (prev.length > 0 && updatedRecords.length !== prev.length) {
            setRecentSyncNotice('Faculty Gradebook Updated! Your marks have been synchronized live.');
            setTimeout(() => setRecentSyncNotice(null), 4000);
          }
          return updatedRecords;
        });
      }
    );

    return () => unsubscribe();
  }, [currentStudent]);

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

  // Compute live CGPA and Weighted Average
  const academicSummary = useMemo(() => {
    if (caRecords.length === 0) {
      return {
        cgpa: 0,
        average: studentSubmissions.length > 0
          ? Math.round(studentSubmissions.reduce((a, b) => a + b.percentage, 0) / studentSubmissions.length)
          : 0,
        totalSubjects: 0,
        standing: getAcademicStanding(0)
      };
    }

    const totalPts = caRecords.reduce((acc, r) => acc + calculateGradePoint(r.totalScore), 0);
    const cgpa = parseFloat((totalPts / caRecords.length).toFixed(2));
    const totalScore = caRecords.reduce((acc, r) => acc + r.totalScore, 0);
    const average = Math.round(totalScore / caRecords.length);

    return {
      cgpa,
      average,
      totalSubjects: caRecords.length,
      standing: getAcademicStanding(cgpa)
    };
  }, [caRecords, studentSubmissions]);

  const handleProfileUpdated = (updated: Student) => {
    setCurrentStudent(updated);
    if (onUpdateStudent) {
      onUpdateStudent(updated);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Live Sync Notice Toast */}
        {recentSyncNotice && (
          <div className="bg-emerald-900 text-white p-3 rounded-xl flex items-center justify-between text-xs font-semibold shadow-md animate-fadeIn">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>{recentSyncNotice}</span>
            </div>
            <button
              onClick={() => setRecentSyncNotice(null)}
              className="text-emerald-300 hover:text-white underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Premium University SIS Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              {/* Passport Photo */}
              <div className="relative">
                {currentStudent.passportUrl ? (
                  <img
                    src={currentStudent.passportUrl}
                    alt={currentStudent.fullName}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-blue-900 shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-black text-2xl shadow-inner border border-blue-950">
                    {currentStudent.firstName.charAt(0)}{currentStudent.surname.charAt(0)}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-xs" title="Enrolled & Active" />
              </div>

              {/* Biodata */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                    {currentStudent.fullName}
                  </h1>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Active Student
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                    <span>Live Gradebook Sync</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Matric / Adm: <strong className="text-slate-800 font-bold">{currentStudent.admissionNumber}</strong></span>
                  <span>·</span>
                  <span>Class: <strong className="text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded font-bold">{currentStudent.classGrade}</strong></span>
                  <span>·</span>
                  <span>Session: <strong>{currentStudent.academicSession}</strong></span>
                  <span>·</span>
                  <span>Passcode: <strong className="text-slate-900 font-bold">{currentStudent.accessCode || currentStudent.admissionNumber}</strong></span>
                </div>
              </div>
            </div>

            {/* University SIS Metrics (CGPA + Weighted Average) */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">5.00 CGPA</span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-blue-950">
                  {academicSummary.cgpa.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 block font-semibold truncate max-w-[90px]">
                  {academicSummary.standing.badge}
                </span>
              </div>

              <div className="border-x border-slate-100 px-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Overall Avg</span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-800">
                  {academicSummary.average}%
                </span>
                <span className="text-[10px] text-slate-500 block font-semibold">
                  {caRecords.length} Graded
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tests Sat</span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
                  {studentSubmissions.length}
                </span>
                <span className="text-[10px] text-slate-500 block font-semibold">
                  CBT Papers
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('examinations')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'examinations'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Examinations</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'examinations' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {availableExams.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('broadsheet')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'broadsheet'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Live Results Sheet</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'broadsheet' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {caRecords.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('transcript')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'transcript'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Cumulative Transcript (CGPA)</span>
            </button>

            <button
              onClick={() => setActiveTab('practice')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'practice'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Practice Tests</span>
            </button>

            <button
              onClick={() => setActiveTab('ai-advisor')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'ai-advisor'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>AI Academic Advisor</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Student Profile</span>
            </button>
          </div>
        </div>

        {/* TAB 1: SCHEDULED EXAMINATIONS */}
        {activeTab === 'examinations' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-900 text-[10px] font-bold uppercase tracking-wider mb-1">
                  <Check className="w-3 h-3 text-blue-700" />
                  <span>Enrolled Cohort: {currentStudent.classGrade}</span>
                </div>
                <h2 className="text-xl font-black text-slate-900">Class Academic Examinations</h2>
                <p className="text-xs text-slate-500">
                  Strictly filtered to {currentStudent.classGrade}. Review schedule timeframes and launch your CBT paper.
                </p>
              </div>

              {availableSubjects.length > 0 && (
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedSubjectFilter}
                    onChange={e => setSelectedSubjectFilter(e.target.value)}
                    className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900 shadow-xs"
                  >
                    <option value="All">All Subjects ({availableExams.length})</option>
                    {availableSubjects.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
                <div className="w-8 h-8 border-3 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-medium">Fetching scheduled class papers...</p>
              </div>
            ) : displayedExams.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-500 space-y-3">
                <BookOpen className="w-10 h-10 mx-auto text-slate-300" />
                <h3 className="text-sm font-bold text-slate-800">No Published Examinations Found</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Subject teachers have not published any examinations for {currentStudent.classGrade} yet. Check back soon or practice with our self-paced tests.
                </p>
                <button
                  onClick={() => setActiveTab('practice')}
                  className="px-4 py-2 bg-blue-900 text-white rounded-xl text-xs font-bold hover:bg-blue-950 transition-colors cursor-pointer"
                >
                  Go to Practice Tests
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayedExams.map(exam => {
                  const submission = getSubmissionForExam(exam.id);
                  const isSubmitted = !!submission;
                  const timeCheck = checkExamTimeWindow(exam);

                  return (
                    <div
                      key={exam.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {exam.subjectName}
                          </span>
                          {isSubmitted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Sat ({submission.percentage}%)
                            </span>
                          ) : timeCheck.isOpen ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                              Active Open
                            </span>
                          ) : timeCheck.code === 'not_yet_started' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Scheduled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Closed
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-900 text-sm leading-snug">{exam.title}</h3>
                          <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-1 font-mono">
                            <span>Duration: {exam.durationMinutes} mins</span>
                            <span>·</span>
                            <span>Target: {exam.classGrade}</span>
                          </div>
                        </div>

                        {/* Scheduled time info */}
                        {(exam.startDate || exam.endDate) && (
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] text-slate-600 space-y-0.5 font-mono">
                            {exam.startDate && (
                              <div>Starts: {new Date(exam.startDate).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</div>
                            )}
                            {exam.endDate && (
                              <div>Closes: {new Date(exam.endDate).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="pt-3 border-t border-slate-100">
                        {isSubmitted ? (
                          <button
                            onClick={() => onViewResult(submission)}
                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Examination Result Slip</span>
                          </button>
                        ) : timeCheck.isOpen ? (
                          <button
                            onClick={() => onStartExam(exam)}
                            className="w-full py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Start Examination</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-full py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed text-center"
                            title={timeCheck.message}
                          >
                            {timeCheck.code === 'not_yet_started' ? 'Exam Not Yet Open' : 'Exam Window Closed'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIVE BROAD SHEET RESULTS */}
        {activeTab === 'broadsheet' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold uppercase tracking-wider mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                  <span>Live Faculty Continuous Assessment Ledger</span>
                </div>
                <h2 className="text-xl font-black text-slate-900">
                  Continuous Assessment & Examination Scores
                </h2>
                <p className="text-xs text-slate-500">
                  Scores update dynamically as teachers input Assignment (10), Project (10), Test (20), and Exam (60) marks.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  Academic Session: {currentStudent.academicSession}
                </span>
              </div>
            </div>

            {caRecords.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl space-y-3">
                <FileText className="w-10 h-10 mx-auto text-slate-300" />
                <h3 className="text-sm font-bold text-slate-800">No Assessment Records Recorded Yet</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Subject teachers are currently setting up Continuous Assessment records for your class cohort. Any recorded score will appear here live.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-3 text-center">Assignment (10)</th>
                      <th className="py-3 px-3 text-center">Project (10)</th>
                      <th className="py-3 px-3 text-center">CA Test (20)</th>
                      <th className="py-3 px-3 text-center">CBT Exam (60)</th>
                      <th className="py-3 px-3 text-center">Total (100)</th>
                      <th className="py-3 px-3 text-center">Grade</th>
                      <th className="py-3 px-3 text-center">Point</th>
                      <th className="py-3 px-4">Teacher Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {caRecords.map(r => {
                      const gp = calculateGradePoint(r.totalScore);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {r.subjectName}
                            <span className="block text-[10px] text-slate-400 font-normal">{r.term}</span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-600">{r.assignmentScore ?? '-'}</td>
                          <td className="py-3 px-3 text-center font-mono text-slate-600">{r.projectScore ?? '-'}</td>
                          <td className="py-3 px-3 text-center font-mono text-slate-600">{r.testScore ?? '-'}</td>
                          <td className="py-3 px-3 text-center font-mono text-slate-600">{r.examScore ?? '-'}</td>
                          <td className="py-3 px-3 text-center font-mono font-black text-slate-900 text-sm">
                            {r.totalScore}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-200">
                              {r.grade}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-blue-900">
                            {gp.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="font-medium">{r.remark}</span>
                            {r.teacherComment && (
                              <span className="text-[10px] text-slate-400 italic block">"{r.teacherComment}"</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CUMULATIVE TRANSCRIPT (5.0 SCALE) */}
        {activeTab === 'transcript' && (
          <StudentCumulativeTranscript student={currentStudent} records={caRecords} />
        )}

        {/* TAB 4: PRACTICE TESTS ENGINE */}
        {activeTab === 'practice' && (
          <StudentPracticeQuiz />
        )}

        {/* TAB 5: AI ACADEMIC ADVISOR */}
        {activeTab === 'ai-advisor' && (
          <StudentAiAdvisorView
            student={currentStudent}
            records={caRecords}
            submissions={studentSubmissions}
          />
        )}

        {/* TAB 6: STUDENT SIS PROFILE & CREDENTIALS */}
        {activeTab === 'profile' && (
          <StudentProfileView
            student={currentStudent}
            onBackToDashboard={() => setActiveTab('examinations')}
            onProfileUpdated={handleProfileUpdated}
          />
        )}
      </div>
    </div>
  );
};
