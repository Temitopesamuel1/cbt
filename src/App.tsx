import React, { useState, useEffect } from 'react';
import { InstitutionalHeader } from './components/common/InstitutionalHeader';
import { LandingGateway } from './components/common/LandingGateway';
import { TeacherLogin } from './components/teacher/TeacherLogin';
import { TeacherPortal } from './components/teacher/TeacherPortal';
import { StudentLogin } from './components/student/StudentLogin';
import { StudentDashboardView } from './components/student/StudentDashboardView';
import { StudentExamScreen } from './components/student/StudentExamScreen';
import { StudentResultView } from './components/student/StudentResultView';
import { StudentHistoryView } from './components/student/StudentHistoryView';
import { StudentProfileView } from './components/student/StudentProfileView';
import { Examination, Question, Student, Submission, SchoolSettings } from './types/cbt';
import { DEFAULT_SCHOOL_SETTINGS } from './data/initialSchoolData';
import { testConnection, fetchQuestions, fetchSchoolSettings, getExaminationById, ensureInitialSchoolData } from './services/firebase';

export default function App() {
  // Current route state
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const path = window.location.pathname;
    return path && path.length > 1 ? path : '/';
  });

  // Authentication states
  const [teacherEmail, setTeacherEmail] = useState<string | null>(null);
  const [studentSession, setStudentSession] = useState<Student | null>(null);

  // Active examination state
  const [activeExam, setActiveExam] = useState<Examination | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);

  // School settings
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);

  // Sync route with browser history
  useEffect(() => {
    testConnection();
    ensureInitialSchoolData();
    fetchSchoolSettings().then(st => {
      if (st) setSchoolSettings(st);
    });

    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentRoute(path && path.length > 1 ? path : '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (route: string) => {
    setCurrentRoute(route);
    window.history.pushState({}, '', route);
  };

  // Determine portal context from route
  const isTeacherRoute = currentRoute.startsWith('/teacher');
  const isStudentRoute = currentRoute.startsWith('/student');
  const isExamActive = currentRoute.startsWith('/student/examination') && activeExam !== null;

  const currentPortal: 'landing' | 'teacher' | 'student' = isTeacherRoute
    ? 'teacher'
    : isStudentRoute
    ? 'student'
    : 'landing';

  // Teacher Handlers
  const handleTeacherLoginSuccess = (email: string) => {
    setTeacherEmail(email);
    navigate('/teacher/dashboard');
  };

  const handleTeacherLogout = () => {
    setTeacherEmail(null);
    navigate('/');
  };

  // Student Handlers
  const handleStudentLoginSuccess = (student: Student) => {
    setStudentSession(student);
    navigate('/student/dashboard');
  };

  const handleStudentLogout = () => {
    setStudentSession(null);
    setActiveExam(null);
    setActiveSubmission(null);
    navigate('/');
  };

  const handleStartExam = async (exam: Examination) => {
    setActiveExam(exam);
    try {
      const qs = await fetchQuestions(exam.id);
      if (qs && qs.length > 0) {
        let finalQuestions = qs;
        if (exam.shuffleQuestions) {
          // Deterministic or clean randomisation
          finalQuestions = [...qs].sort(() => Math.random() - 0.5);
        }
        setActiveQuestions(finalQuestions);
      } else {
        setActiveQuestions([]);
      }
    } catch (err) {
      console.warn('Questions fetch:', err);
    }

    navigate(`/student/examination/${exam.id}`);
  };

  const handleCompleteExam = (submission: Submission) => {
    setActiveSubmission(submission);
    navigate('/student/results');
  };

  const handleViewResultSlip = (submission: Submission) => {
    setActiveSubmission(submission);
    navigate('/student/results');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900">
      {/* Top Institutional Header */}
      {!isExamActive && (
        <InstitutionalHeader
          currentPortal={currentPortal}
          currentRoute={currentRoute}
          onNavigate={navigate}
          userDisplayName={
            isTeacherRoute
              ? teacherEmail
              : isStudentRoute && studentSession
              ? studentSession.fullName
              : null
          }
          onLogout={isTeacherRoute ? handleTeacherLogout : isStudentRoute && studentSession ? handleStudentLogout : undefined}
          settings={schoolSettings}
          examInProgress={false}
        />
      )}

      {/* Main View Router */}
      <div className="flex-1">
        {/* LANDING GATEWAY */}
        {currentRoute === '/' && (
          <LandingGateway onNavigate={navigate} settings={schoolSettings} />
        )}

        {/* TEACHER PORTAL ROUTES */}
        {currentRoute === '/teacher/login' && (
          <TeacherLogin
            onLoginSuccess={handleTeacherLoginSuccess}
            onNavigateToStudent={() => navigate('/student/login')}
          />
        )}

        {isTeacherRoute && currentRoute !== '/teacher/login' && (
          teacherEmail ? (
            <TeacherPortal
              teacherEmail={teacherEmail}
              currentSubroute={currentRoute}
              onNavigateSubroute={navigate}
              onLogout={handleTeacherLogout}
              onGoToStudentPortal={() => navigate('/student/login')}
            />
          ) : (
            <TeacherLogin
              onLoginSuccess={handleTeacherLoginSuccess}
              onNavigateToStudent={() => navigate('/student/login')}
            />
          )
        )}

        {/* STUDENT PORTAL ROUTES */}
        {currentRoute === '/student/login' && (
          <StudentLogin
            onLoginSuccess={handleStudentLoginSuccess}
            onNavigateToTeacher={() => navigate('/teacher/login')}
          />
        )}

        {/* Protected Student Routes */}
        {isStudentRoute && currentRoute !== '/student/login' && (
          !studentSession ? (
            <StudentLogin
              onLoginSuccess={handleStudentLoginSuccess}
              onNavigateToTeacher={() => navigate('/teacher/login')}
            />
          ) : (
            <>
              {/* Student Dashboard */}
              {(currentRoute === '/student/dashboard' || currentRoute === '/student/examinations') && (
                <StudentDashboardView
                  student={studentSession}
                  onStartExam={handleStartExam}
                  onViewResult={handleViewResultSlip}
                  onNavigateToHistory={() => navigate('/student/history')}
                />
              )}

              {/* Live Examination Screen */}
              {currentRoute.startsWith('/student/examination/') && activeExam && (
                <StudentExamScreen
                  student={studentSession}
                  exam={activeExam}
                  questions={activeQuestions}
                  onCompleteExam={handleCompleteExam}
                />
              )}

              {/* Student Result Slip */}
              {currentRoute === '/student/results' && activeSubmission && (
                <StudentResultView
                  submission={activeSubmission}
                  allowReview={activeExam?.resultVisibility !== 'teacher_publish'}
                  onReturnToDashboard={() => navigate('/student/dashboard')}
                />
              )}

              {/* Student Past History */}
              {currentRoute === '/student/history' && (
                <StudentHistoryView
                  student={studentSession}
                  onViewResult={handleViewResultSlip}
                  onBackToDashboard={() => navigate('/student/dashboard')}
                />
              )}

              {/* Student Profile View */}
              {currentRoute === '/student/profile' && (
                <StudentProfileView
                  student={studentSession}
                  onBackToDashboard={() => navigate('/student/dashboard')}
                />
              )}
            </>
          )
        )}
      </div>

      {/* Institutional School Footer */}
      {!isExamActive && (
        <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500 no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="font-semibold text-slate-700">
              PRIME CBT · Institutional Computer-Based Testing & Student Assessment System
            </div>
            <div className="flex items-center gap-4 text-slate-400 text-[11px] font-mono">
              <span>Academic Session: {schoolSettings.academicSession}</span>
              <span>·</span>
              <span>{schoolSettings.currentTerm}</span>
              <span>·</span>
              <span>Role-Protected Evaluation Architecture</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
