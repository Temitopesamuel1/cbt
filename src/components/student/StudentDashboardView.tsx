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
  ExternalLink,
  Printer,
  Lock,
  RefreshCw
} from 'lucide-react';
import {
  Student,
  Examination,
  Submission,
  ExamAttempt,
  StudentAssessmentRecord,
  SchoolSettings,
  CaWeightsConfig,
  resolveCaWeights,
  resolveExamTargetComponent,
  formatTargetComponentLabel,
  getTargetComponentMax,
  checkExamTimeWindow,
  calculateGrade,
  calculateGradePoint,
  getAcademicStanding,
  formatOrdinalExamLabel,
  enrichSubmissionsWithOrdinals
} from '../../types/cbt';
import {
  fetchExaminations,
  subscribeExaminations,
  fetchSubmissions,
  subscribeStudentSubmissions,
  fetchStudentAttempts,
  subscribeStudentAssessmentRecords,
  fetchSchoolSettings
} from '../../services/firebase';
import { StudentPracticeQuiz } from './StudentPracticeQuiz';
import { StudentCumulativeTranscript } from './StudentCumulativeTranscript';
import { StudentAiAdvisorView } from './StudentAiAdvisorView';
import { StudentProfileView } from './StudentProfileView';
import { HwsOfficialResultSlip } from '../common/HwsOfficialResultSlip';

interface StudentDashboardViewProps {
  student: Student;
  initialTab?: 'examinations' | 'broadsheet' | 'transcript' | 'practice' | 'ai-advisor' | 'profile';
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

  const normExam = normalize(examClass);
  if (normExam === 'all' || normExam === 'allclasses') return true;
  return normalize(studentClass) === normExam;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  student: initialStudent,
  initialTab,
  onStartExam,
  onViewResult,
  onNavigateToHistory,
  onUpdateStudent
}) => {
  const [activeTab, setActiveTab] = useState<'examinations' | 'broadsheet' | 'transcript' | 'practice' | 'ai-advisor' | 'profile'>(initialTab || 'examinations');
  const [currentStudent, setCurrentStudent] = useState<Student>(initialStudent);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [availableExams, setAvailableExams] = useState<Examination[]>([]);
  const [studentSubmissions, setStudentSubmissions] = useState<Submission[]>([]);
  const [studentAttempts, setStudentAttempts] = useState<ExamAttempt[]>([]);
  const [caRecords, setCaRecords] = useState<StudentAssessmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingExams, setSyncingExams] = useState(false);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All');
  const [recentSyncNotice, setRecentSyncNotice] = useState<string | null>(null);
  const [showOfficialReportSheet, setShowOfficialReportSheet] = useState<boolean>(false);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | undefined>(undefined);
  const [caMeta, setCaMeta] = useState<Required<CaWeightsConfig>>(() => resolveCaWeights(undefined));
  const [selectedCaSession, setSelectedCaSession] = useState<string>(initialStudent.academicSession || '2025/2026');
  const [selectedCaTerm, setSelectedCaTerm] = useState<string>('1st Term');
  const hasInitializedTermFilterRef = React.useRef(false);

  // Sync school settings & CA weights live
  useEffect(() => {
    fetchSchoolSettings().then(st => {
      setSchoolSettings(st);
      setCaMeta(resolveCaWeights(st.caWeights));
      if (!hasInitializedTermFilterRef.current) {
        hasInitializedTermFilterRef.current = true;
        if (st.academicSession) setSelectedCaSession(st.academicSession);
        if (st.currentTerm) setSelectedCaTerm(st.currentTerm);
      }
    }).catch(() => {});

    const onSettingsUpdate = (e: Event) => {
      const detail = (e as CustomEvent<SchoolSettings>).detail;
      if (detail) {
        setSchoolSettings(detail);
        setCaMeta(resolveCaWeights(detail.caWeights));
      }
    };
    window.addEventListener('schoolSettingsUpdated', onSettingsUpdate);
    return () => window.removeEventListener('schoolSettingsUpdated', onSettingsUpdate);
  }, []);

  // Sync internal student state if prop updates
  useEffect(() => {
    setCurrentStudent(initialStudent);
  }, [initialStudent]);

  const refreshFromServer = async (showSpinner = false) => {
    if (showSpinner) setSyncingExams(true);
    try {
      const [publishedExams, allSubs, allAttempts] = await Promise.all([
        fetchExaminations(true, true),
        fetchSubmissions(undefined, currentStudent.id),
        fetchStudentAttempts(currentStudent.id)
      ]);
      const classPeculiar = (publishedExams || []).filter(e =>
        isClassMatch(currentStudent.classGrade, e.classGrade)
      );
      setAvailableExams(classPeculiar);
      if (allSubs) setStudentSubmissions(allSubs);
      if (allAttempts) setStudentAttempts(allAttempts);
    } catch (err) {
      console.warn('Error refreshing student dashboard from server:', err);
    } finally {
      setLoading(false);
      if (showSpinner) setSyncingExams(false);
    }
  };

  // Load Examinations, Attempts, and Submissions with instant real-time cross-system sync
  useEffect(() => {
    let isMounted = true;

    const unsubExams = subscribeExaminations(true, (publishedExams) => {
      if (!isMounted) return;
      const classPeculiar = (publishedExams || []).filter(e =>
        isClassMatch(currentStudent.classGrade, e.classGrade)
      );
      setAvailableExams(classPeculiar);
      setLoading(false);
    });

    const unsubSubs = subscribeStudentSubmissions(currentStudent.id, (allSubs) => {
      if (!isMounted) return;
      setStudentSubmissions(allSubs || []);
    });

    // Force an authoritative server pull on mount and when tab regains focus or goes online
    refreshFromServer(false);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshFromServer(false);
      }
    };
    const onTimerOrExamEvent = () => {
      refreshFromServer(false);
    };

    window.addEventListener('focus', onVisibilityOrFocus);
    window.addEventListener('online', onTimerOrExamEvent);
    window.addEventListener('prime_cbt_timer_restarted', onTimerOrExamEvent);
    window.addEventListener('prime_cbt_exams_updated', onTimerOrExamEvent);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('prime_cbt_sync_channel');
      bc.onmessage = (ev) => {
        if (
          ev.data?.type === 'TIMER_RESTARTED' ||
          ev.data?.type === 'EXAM_DELETED' ||
          ev.data?.type === 'EXAMS_BATCH_DELETED' ||
          ev.data?.type === 'EXAM_SAVED' ||
          ev.data?.type === 'SUBMISSIONS_UPDATED'
        ) {
          refreshFromServer(false);
        }
      };
    } catch {}

    return () => {
      isMounted = false;
      unsubExams();
      unsubSubs();
      window.removeEventListener('focus', onVisibilityOrFocus);
      window.removeEventListener('online', onTimerOrExamEvent);
      window.removeEventListener('prime_cbt_timer_restarted', onTimerOrExamEvent);
      window.removeEventListener('prime_cbt_exams_updated', onTimerOrExamEvent);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      if (bc) {
        try { bc.close(); } catch {}
      }
    };
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

  // Enrich submissions with deterministic chronological ordinal labels (1st Exam, 2nd Exam, ...)
  const enrichedSubmissions = useMemo(
    () => enrichSubmissionsWithOrdinals(studentSubmissions),
    [studentSubmissions]
  );

  // Group all CBT submissions by subject chronologically (1st Exam, 2nd Exam, ...)
  const submissionsBySubject = useMemo(() => {
    const map = new Map<string, Submission[]>();
    const asc = [...enrichedSubmissions].sort(
      (a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime()
    );
    asc.forEach(sub => {
      const subj = sub.subject || 'General';
      if (!map.has(subj)) map.set(subj, []);
      map.get(subj)!.push(sub);
    });
    return Array.from(map.entries());
  }, [enrichedSubmissions]);

  // All completed sittings for a given exam, ordered 1st Exam -> 2nd Exam -> ...
  const getSubmissionsForExam = (examId: string): Submission[] => {
    return enrichedSubmissions
      .filter(s => s.examId === examId)
      .sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
  };

  // True when teacher/admin has unlocked a fresh retake sitting for this exam
  const hasActiveRetake = (examId: string): boolean => {
    const attempt = studentAttempts.find(
      a => a.examId === examId || a.id === `attempt_${currentStudent.id}_${examId}`
    );
    if (!attempt) return false;
    if (attempt.status === 'retake_granted' || attempt.status === 'in_progress') {
      if (attempt.status === 'retake_granted') return true;
      const subs = getSubmissionsForExam(examId);
      if (subs.length === 0) return true;
      const latestSubMs = Math.max(...subs.map(s => new Date(s.submittedAt || 0).getTime() || 0));
      const attemptStartMs = new Date(attempt.startTime || 0).getTime() || 0;
      return attemptStartMs > latestSubMs;
    }
    return false;
  };

  const availableCaSessions = useMemo(() => {
    const set = new Set<string>();
    if (schoolSettings?.academicSession) set.add(schoolSettings.academicSession);
    if (currentStudent.academicSession) set.add(currentStudent.academicSession);
    caRecords.forEach(r => {
      if (r.academicSession) set.add(r.academicSession);
    });
    return Array.from(set);
  }, [schoolSettings, currentStudent.academicSession, caRecords]);

  const filteredCaRecords = useMemo(() => {
    const normSess = (s?: string) => (s || '').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const normTerm = (t?: string) => {
      const clean = (t || '').trim().toLowerCase().replace(/[\s\-_]/g, '');
      if (clean.startsWith('first') || clean === '1st') return '1stterm';
      if (clean.startsWith('second') || clean === '2nd') return '2ndterm';
      if (clean.startsWith('third') || clean === '3rd') return '3rdterm';
      return clean;
    };
    const targetSess = normSess(selectedCaSession);
    const targetTerm = normTerm(selectedCaTerm);

    return caRecords.filter(r => {
      const matchesSess = !targetSess || !r.academicSession || normSess(r.academicSession) === targetSess;
      const matchesTerm = selectedCaTerm === 'All Terms' || !r.term || normTerm(r.term) === targetTerm;
      return matchesSess && matchesTerm;
    });
  }, [caRecords, selectedCaSession, selectedCaTerm]);

  // Compute live CGPA and Weighted Average
  const academicSummary = useMemo(() => {
    const pool = filteredCaRecords.length > 0 ? filteredCaRecords : caRecords;
    if (pool.length === 0) {
      return {
        cgpa: 0,
        average: studentSubmissions.length > 0
          ? Math.round(studentSubmissions.reduce((a, b) => a + b.percentage, 0) / studentSubmissions.length)
          : 0,
        totalSubjects: 0,
        standing: getAcademicStanding(0)
      };
    }

    const totalPts = pool.reduce((acc, r) => acc + calculateGradePoint(r.totalScore), 0);
    const cgpa = parseFloat((totalPts / pool.length).toFixed(2));
    const totalScore = pool.reduce((acc, r) => acc + r.totalScore, 0);
    const average = Math.round(totalScore / pool.length);

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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshFromServer(true)}
                  disabled={syncingExams}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  title="Check server for newly published or updated exams"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-700 ${syncingExams ? 'animate-spin' : ''}`} />
                  <span>{syncingExams ? 'Syncing...' : 'Sync Exams'}</span>
                </button>

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
                  const examSubs = getSubmissionsForExam(exam.id);
                  const latestSubmission = examSubs[examSubs.length - 1];
                  const isSubmitted = examSubs.length > 0;
                  const retakeActive = hasActiveRetake(exam.id);
                  const nextSubjectSittingCount =
                    enrichedSubmissions.filter(
                      s => (s.subject || '').trim().toLowerCase() === (exam.subjectName || '').trim().toLowerCase()
                    ).length + 1;
                  const nextSittingLabel = formatOrdinalExamLabel(nextSubjectSittingCount);
                  const timeCheck = checkExamTimeWindow(exam);

                  return (
                    <div
                      key={exam.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {exam.subjectName}
                            </span>
                            <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {formatTargetComponentLabel(resolveExamTargetComponent(exam), caMeta)}
                            </span>
                          </div>
                          {retakeActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Retake Unlocked ({nextSittingLabel})
                            </span>
                          ) : isSubmitted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {examSubs.length === 1
                                ? `Sat (${latestSubmission.percentage}%)`
                                : `${examSubs.length} Sittings · Latest ${latestSubmission.percentage}%`}
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

                        {/* Prior Sitting Score Chips (when completed 1+ times) */}
                        {examSubs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {examSubs.map((sub, idx) => (
                              <button
                                key={sub.id || idx}
                                type="button"
                                onClick={() => onViewResult(sub)}
                                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                title={`View ${sub.sittingLabel || formatOrdinalExamLabel(idx + 1)} Result Slip`}
                              >
                                <FileText className="w-3 h-3 text-emerald-700" />
                                <span>
                                  {sub.sittingLabel || formatOrdinalExamLabel(idx + 1)}: {sub.score}/{sub.totalQuestions} ({sub.percentage}%)
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

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

                      {/* Action Buttons */}
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        {(!isSubmitted || retakeActive) && (
                          timeCheck.isOpen ? (
                            <button
                              onClick={() => onStartExam(exam)}
                              className="w-full py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>
                                {retakeActive ? `Start Retake (${nextSittingLabel})` : 'Start Examination'}
                              </span>
                            </button>
                          ) : (
                            <button
                              disabled
                              className="w-full py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed text-center"
                              title={timeCheck.message}
                            >
                              {timeCheck.code === 'not_yet_started' ? 'Exam Not Yet Open' : 'Exam Window Closed'}
                            </button>
                          )
                        )}

                        {isSubmitted && (
                          <button
                            onClick={() => onViewResult(latestSubmission)}
                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>
                              {examSubs.length > 1
                                ? `View Latest Slip (${latestSubmission.sittingLabel || formatOrdinalExamLabel(examSubs.length)})`
                                : 'View Examination Result Slip'}
                            </span>
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
                  Scores synchronize live as teachers update {caMeta.assignmentLabel} ({caMeta.assignmentMax}), {caMeta.firstCaLabel} ({caMeta.firstCaMax}), {caMeta.secondCaLabel} ({caMeta.secondCaMax}), and {caMeta.examLabel} ({caMeta.examMax}).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedCaSession}
                  onChange={(e) => setSelectedCaSession(e.target.value)}
                  className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer"
                  aria-label="Select Academic Session"
                >
                  {availableCaSessions.map(sess => (
                    <option key={sess} value={sess}>{sess}</option>
                  ))}
                </select>
                <select
                  value={selectedCaTerm}
                  onChange={(e) => setSelectedCaTerm(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer"
                  aria-label="Select Academic Term"
                >
                  <option value="1st Term">1st Term</option>
                  <option value="2nd Term">2nd Term</option>
                  <option value="3rd Term">3rd Term</option>
                  <option value="All Terms">All Terms</option>
                </select>
                {!currentStudent.resultWithheld && (
                  <button
                    type="button"
                    onClick={() => setShowOfficialReportSheet(prev => !prev)}
                    className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Printer className="w-4 h-4 text-amber-300" />
                    <span>{showOfficialReportSheet ? 'Show Table View' : 'View / Print Official 2-Page Report Sheet'}</span>
                  </button>
                )}
              </div>
            </div>

            {currentStudent.resultWithheld ? (
              <div className="text-center py-12 border-2 border-rose-200 bg-rose-50/40 rounded-2xl space-y-3 p-6">
                <Lock className="w-10 h-10 mx-auto text-rose-500" />
                <h3 className="text-base font-black text-slate-900 uppercase">Terminal Result Withheld</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Your Continuous Assessment broadsheet and End of Term Report Sheet are currently withheld by School Administration.
                  {currentStudent.withheldReason ? ` Reason: ${currentStudent.withheldReason}` : ''}
                </p>
              </div>
            ) : showOfficialReportSheet ? (
              <div className="pt-2">
                <HwsOfficialResultSlip
                  student={currentStudent}
                  settings={schoolSettings}
                  academicSession={selectedCaSession || schoolSettings?.academicSession || currentStudent.academicSession || '2025/2026'}
                  term={(selectedCaTerm !== 'All Terms' ? selectedCaTerm : (schoolSettings?.currentTerm || '1st Term')) as any}
                  isEditable={false}
                  usePrintPortal={true}
                  onClose={() => setShowOfficialReportSheet(false)}
                />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Continuous Assessment Table */}
                {filteredCaRecords.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-slate-300" />
                    <h3 className="text-sm font-bold text-slate-800">
                      No Continuous Assessment Records for {selectedCaSession} ({selectedCaTerm})
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Subject teachers are currently entering term continuous assessment marks, or try switching Session/Term above.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Subject</th>
                          <th className="py-3 px-3 text-center">{caMeta.assignmentLabel} ({caMeta.assignmentMax})</th>
                          <th className="py-3 px-3 text-center">{caMeta.firstCaLabel} ({caMeta.firstCaMax})</th>
                          <th className="py-3 px-3 text-center">{caMeta.secondCaLabel} ({caMeta.secondCaMax})</th>
                          <th className="py-3 px-3 text-center">{caMeta.examLabel} ({caMeta.examMax})</th>
                          <th className="py-3 px-3 text-center">Total ({caMeta.assignmentMax + caMeta.firstCaMax + caMeta.secondCaMax + caMeta.examMax})</th>
                          <th className="py-3 px-3 text-center">Grade</th>
                          <th className="py-3 px-3 text-center">Point</th>
                          <th className="py-3 px-4">Teacher Remark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCaRecords.map(r => {
                          const isWithheld = currentStudent.withheldSubjectIds?.some(
                            w => w.trim().toLowerCase() === r.subjectName.trim().toLowerCase()
                          );
                          const gp = calculateGradePoint(r.totalScore);
                          const firstSummary = (typeof r.firstCaScore === 'number' && r.firstCaScore > 0) ? r.firstCaScore : (r.testScore ?? r.firstCaScore ?? 0);
                          const secondSummary = (typeof r.secondCaScore === 'number' && r.secondCaScore > 0) ? r.secondCaScore : (r.projectScore ?? r.secondCaScore ?? 0);
                          return (
                            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 font-bold text-slate-900">
                                {r.subjectName}
                                <span className="block text-[10px] text-slate-400 font-normal">{r.term}</span>
                              </td>
                              {isWithheld ? (
                                <td colSpan={8} className="py-3 px-4 text-center text-rose-700 font-bold text-[11px] bg-rose-50/50">
                                  Subject Result Temporarily Withheld by Administration
                                </td>
                              ) : (
                                <>
                                  <td className="py-3 px-3 text-center font-mono text-slate-600">{r.assignmentScore ?? '-'}</td>
                                  <td className="py-3 px-3 text-center font-mono text-slate-600">
                                    <div>{firstSummary ?? '-'}</div>
                                    {Array.isArray(r.examEntries) && r.examEntries.some(e => e.targetCaComponent === 'first_ca') && (
                                      <div className="flex flex-wrap justify-center gap-1 mt-1">
                                        {r.examEntries
                                          .filter(e => e.targetCaComponent === 'first_ca')
                                          .map((entry, idx) => (
                                            <span
                                              key={entry.submissionId || idx}
                                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 whitespace-nowrap"
                                              title={`${entry.sittingLabel}: ${entry.rawScore}/${entry.totalQuestions} (${entry.percentage}%)`}
                                            >
                                              CBT: {entry.scaledScore}
                                            </span>
                                          ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-center font-mono text-slate-600">
                                    <div>{secondSummary ?? '-'}</div>
                                    {Array.isArray(r.examEntries) && r.examEntries.some(e => e.targetCaComponent === 'second_ca') && (
                                      <div className="flex flex-wrap justify-center gap-1 mt-1">
                                        {r.examEntries
                                          .filter(e => e.targetCaComponent === 'second_ca')
                                          .map((entry, idx) => (
                                            <span
                                              key={entry.submissionId || idx}
                                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200 whitespace-nowrap"
                                              title={`${entry.sittingLabel}: ${entry.rawScore}/${entry.totalQuestions} (${entry.percentage}%)`}
                                            >
                                              CBT: {entry.scaledScore}
                                            </span>
                                          ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-center font-mono text-slate-600">
                                    <div>{r.examScore ?? '-'}</div>
                                    {Array.isArray(r.examEntries) && r.examEntries.some(e => (e.targetCaComponent || 'exam') === 'exam') && (
                                      <div className="flex flex-wrap justify-center gap-1 mt-1">
                                        {r.examEntries
                                          .filter(e => (e.targetCaComponent || 'exam') === 'exam')
                                          .map((entry, idx) => (
                                            <span
                                              key={entry.submissionId || idx}
                                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 whitespace-nowrap"
                                              title={`${entry.sittingLabel}: ${entry.rawScore}/${entry.totalQuestions} (${entry.percentage}%)`}
                                            >
                                              {entry.sittingLabel}: {entry.scaledScore}
                                            </span>
                                          ))}
                                      </div>
                                    )}
                                  </td>
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
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Separate CBT Exam Sittings Ledger by Subject (1st Exam, 2nd Exam, ...) */}
                {submissionsBySubject.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
                          CBT Examination Sittings Record by Subject (1st Exam, 2nd Exam, ...)
                        </h3>
                        <p className="text-[11px] text-slate-300">
                          Every completed CBT sitting for a subject is stored and displayed individually with its score and result slip.
                        </p>
                      </div>
                      <span className="text-[11px] font-mono bg-white/10 px-2.5 py-1 rounded text-white font-bold">
                        {enrichedSubmissions.length} Total Sitting{enrichedSubmissions.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-200 bg-white">
                      {submissionsBySubject.map(([subjectName, sittings]) => {
                        const isSubjectWithheld = currentStudent.withheldSubjectIds?.some(
                          w => w.trim().toLowerCase() === subjectName.trim().toLowerCase()
                        );
                        return (
                          <div key={subjectName} className="p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900 text-sm">{subjectName}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
                                  {sittings.length} {sittings.length === 1 ? 'Exam Sitting' : 'Exam Sittings'}
                                </span>
                              </div>
                            </div>

                            {isSubjectWithheld ? (
                              <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                                Subject CBT Results Withheld by Administration
                              </div>
                            ) : (
                              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold">
                                    <tr>
                                      <th className="py-2 px-3">Sitting</th>
                                      <th className="py-2 px-3">Examination Paper</th>
                                      <th className="py-2 px-3 text-center">Target Column</th>
                                      <th className="py-2 px-3 text-center">Raw Score</th>
                                      <th className="py-2 px-3 text-center">Percentage</th>
                                      <th className="py-2 px-3 text-center">Scaled Score</th>
                                      <th className="py-2 px-3 text-center">Grade</th>
                                      <th className="py-2 px-3">Date Sat</th>
                                      <th className="py-2 px-3 text-right">Slip</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {sittings.map((sub, idx) => {
                                      const g = calculateGrade(sub.percentage);
                                      const matchedExam = availableExams.find(ex => ex.id === sub.examId);
                                      const targetComp = resolveExamTargetComponent(matchedExam, sub);
                                      const targetLabel = formatTargetComponentLabel(targetComp, caMeta);
                                      const compMax = getTargetComponentMax(targetComp, caMeta);
                                      const scaledMark = Math.min(
                                        compMax,
                                        Math.max(0, Math.round((sub.percentage / 100) * compMax))
                                      );
                                      const sittingLabel = sub.sittingLabel || formatOrdinalExamLabel(idx + 1);
                                      return (
                                        <tr key={sub.id || idx} className="hover:bg-slate-50">
                                          <td className="py-2.5 px-3">
                                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-black text-[11px] whitespace-nowrap">
                                              {sittingLabel}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-3 font-semibold text-slate-800">{sub.examTitle}</td>
                                          <td className="py-2.5 px-3 text-center">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200 whitespace-nowrap">
                                              {targetLabel}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                                            {sub.score} / {sub.totalQuestions}
                                          </td>
                                          <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-900">
                                            {sub.percentage}%
                                          </td>
                                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                                            {scaledMark} / {compMax}
                                          </td>
                                          <td className="py-2.5 px-3 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${g.color}`}>
                                              {g.grade}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                                            {new Date(sub.submittedAt).toLocaleDateString('en-GB', {
                                              day: '2-digit',
                                              month: 'short',
                                              year: 'numeric'
                                            })}
                                          </td>
                                          <td className="py-2.5 px-3 text-right">
                                            <button
                                              type="button"
                                              onClick={() => onViewResult(sub)}
                                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                            >
                                              <ExternalLink className="w-3 h-3" />
                                              <span>View Slip</span>
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CUMULATIVE TRANSCRIPT (5.0 SCALE) */}
        {activeTab === 'transcript' && (
          <StudentCumulativeTranscript student={currentStudent} records={caRecords} settings={schoolSettings} />
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
