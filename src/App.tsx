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
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminPortal } from './components/admin/AdminPortal';
import { Examination, Question, Student, Submission, SchoolSettings, StaffMember, checkExamTimeWindow } from './types/cbt';
import { DEFAULT_SCHOOL_SETTINGS } from './data/initialSchoolData';
import { testConnection, fetchQuestions, fetchSchoolSettings, ensureInitialSchoolData } from './services/firebase';

export default function App() {
  // Current route state
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const path = window.location.pathname;
    return path && path.length > 1 ? path : '/';
  });

  // Authentication states
  const [teacherStaff, setTeacherStaff] = useState<StaffMember | null>(() => {
    try {
      const stored = sessionStorage.getItem('prime_edutech_active_teacher');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [adminEmail, setAdminEmail] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('prime_edutech_active_admin') || null;
    } catch {
      return null;
    }
  });

  const [studentSession, setStudentSession] = useState<Student | null>(() => {
    try {
      const stored = sessionStorage.getItem('prime_edutech_active_student');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

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
  const isAdminRoute = currentRoute.startsWith('/admin');
  const isTeacherRoute = currentRoute.startsWith('/teacher');
  const isStudentRoute = currentRoute.startsWith('/student');
  const isExamActive = currentRoute.startsWith('/student/examination') && activeExam !== null;

  const currentPortal: 'landing' | 'teacher' | 'student' | 'admin' = isAdminRoute
    ? 'admin'
    : isTeacherRoute
    ? 'teacher'
    : isStudentRoute
    ? 'student'
    : 'landing';

  // Admin Handlers
  const handleAdminLoginSuccess = (email: string) => {
    setAdminEmail(email);
    try {
      sessionStorage.setItem('prime_edutech_active_admin', email);
    } catch {}
    navigate('/admin/dashboard');
  };

  const handleAdminLogout = () => {
    setAdminEmail(null);
    try {
      sessionStorage.removeItem('prime_edutech_active_admin');
    } catch {}
    navigate('/');
  };

  // Teacher Handlers
  const handleTeacherLoginSuccess = (staff: StaffMember) => {
    setTeacherStaff(staff);
    try {
      sessionStorage.setItem('prime_edutech_active_teacher', JSON.stringify(staff));
    } catch {}
    navigate('/teacher/dashboard');
  };

  const handleTeacherLogout = () => {
    setTeacherStaff(null);
    try {
      sessionStorage.removeItem('prime_edutech_active_teacher');
    } catch {}
    navigate('/');
  };

  // Student Handlers
  const handleStudentLoginSuccess = (student: Student) => {
    setStudentSession(student);
    try {
      sessionStorage.setItem('prime_edutech_active_student', JSON.stringify(student));
    } catch {}
    navigate('/student/dashboard');
  };

  const handleStudentLogout = () => {
    setStudentSession(null);
    setActiveExam(null);
    setActiveSubmission(null);
    try {
      sessionStorage.removeItem('prime_edutech_active_student');
    } catch {}
    navigate('/');
  };

  const handleStartExam = async (exam: Examination) => {
    const timeCheck = checkExamTimeWindow(exam);
    if (!timeCheck.isOpen) {
      alert(`Cannot enter examination:\n${timeCheck.message}`);
      return;
    }

    setActiveExam(exam);
    try {
      const qs = await fetchQuestions(exam.id);
      if (qs && qs.length > 0) {
        // Enforce strict question-to-subject and examId matching:
        // Only deliver questions that were uploaded for this examination and subject
        const cleanExamSubj = exam.subjectName.trim().toLowerCase();
        const subjectQuestions = qs.filter(q => {
          if (q.examId && q.examId !== exam.id) return false;
          if (q.subject && q.subject !== 'General' && q.subject.trim().toLowerCase() !== cleanExamSubj) {
            return false;
          }
          return true;
        });

        const verifiedQuestions = subjectQuestions.length > 0 ? subjectQuestions : qs;
        let finalQuestions = verifiedQuestions;
        if (exam.shuffleQuestions) {
          finalQuestions = [...verifiedQuestions].sort(() => Math.random() - 0.5);
        }
        setActiveQuestions(finalQuestions);
      } else {
        setActiveQuestions([]);
      }
    } catch (err) {
      console.warn('Questions fetch:', err);
      setActiveQuestions([]);
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
            isAdminRoute
              ? adminEmail ? `${adminEmail}` : null
              : isTeacherRoute && teacherStaff
              ? `${teacherStaff.fullName} (${teacherStaff.uniqueId})`
              : isStudentRoute && studentSession
              ? studentSession.fullName
              : null
          }
          onLogout={
            isAdminRoute
              ? handleAdminLogout
              : isTeacherRoute && teacherStaff
              ? handleTeacherLogout
              : isStudentRoute && studentSession
              ? handleStudentLogout
              : undefined
          }
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

        {/* ADMIN PORTAL ROUTES */}
        {isAdminRoute && (
          adminEmail ? (
            <AdminPortal
              adminEmail={adminEmail}
              onLogout={handleAdminLogout}
              onGoToHome={() => navigate('/')}
            />
          ) : (
            <AdminLogin
              onLoginSuccess={handleAdminLoginSuccess}
              onNavigateHome={() => navigate('/')}
            />
          )
        )}

        {/* TEACHER PORTAL ROUTES */}
        {currentRoute === '/teacher/login' && (
          <TeacherLogin
            onLoginSuccess={handleTeacherLoginSuccess}
            onNavigateToStudent={() => navigate('/student/login')}
          />
        )}

        {isTeacherRoute && currentRoute !== '/teacher/login' && (
          teacherStaff ? (
            <TeacherPortal
              teacherEmail={teacherStaff.email}
              teacherStaff={teacherStaff}
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
                  onUpdateStudent={(updated) => setStudentSession(updated)}
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
                  onProfileUpdated={(updated) => setStudentSession(updated)}
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
            <div className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="font-bold text-blue-950">{schoolSettings.schoolName || "HONEY'S WORLD HIGH SCHOOL"}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600 font-normal">{schoolSettings.address || 'Gaa Ajanaku, Ilorin, Kwara State'}</span>
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
