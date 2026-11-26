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
import { CampusChatModal } from './components/common/CampusChatModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Lock, AlertTriangle, X } from 'lucide-react';
import { Examination, Question, Student, Submission, SchoolSettings, StaffMember, checkExamTimeWindow } from './types/cbt';
import { DEFAULT_SCHOOL_SETTINGS } from './data/initialSchoolData';
import {
  testConnection,
  fetchQuestions,
  fetchSchoolSettings,
  subscribeSchoolSettings,
  ensureInitialSchoolData,
  subscribeStaffMembers,
  subscribeStudents
} from './services/firebase';

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
  const [studentDashboardTab, setStudentDashboardTab] = useState<'examinations' | 'broadsheet' | 'transcript' | 'practice' | 'ai-advisor' | 'profile'>('examinations');

  // School settings
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [examEntryNotice, setExamEntryNotice] = useState<string | null>(null);

  // Global Campus Chat Hub state
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  const chatCurrentUser = adminEmail
    ? {
        id: adminEmail,
        name: adminEmail.toLowerCase() === 'fathertemitope@gmail.com' ? 'Chief Super Admin' : 'Administrator',
        role: (adminEmail.toLowerCase() === 'fathertemitope@gmail.com' ? 'super_admin' : 'admin') as 'super_admin' | 'admin',
      }
    : teacherStaff
    ? {
        id: teacherStaff.id,
        name: teacherStaff.fullName,
        role: 'teacher' as const,
      }
    : studentSession
    ? {
        id: studentSession.id,
        name: studentSession.fullName,
        role: 'student' as const,
        classGrade: studentSession.classGrade,
      }
    : null;

  // Sync route with browser history & keep school settings live
  useEffect(() => {
    testConnection();
    ensureInitialSchoolData();
    fetchSchoolSettings().then(st => {
      if (st) setSchoolSettings(st);
    });
    const unsubSettings = subscribeSchoolSettings((liveSettings) => {
      setSchoolSettings(liveSettings);
    });

    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentRoute(path && path.length > 1 ? path : '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      unsubSettings();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Dynamically sync browser tab favicon & app touch icon to the editable school logo
  useEffect(() => {
    const logoHref = (schoolSettings.schoolLogo || '').trim() || '/school-logo.png';
    try {
      const iconLinks = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]');
      iconLinks.forEach(link => {
        if (link.href !== logoHref) {
          link.href = logoHref;
        }
      });
    } catch {}
    if (schoolSettings.schoolName) {
      document.title = `${schoolSettings.schoolName} - Examination & Student Assessment System`;
    }
  }, [schoolSettings.schoolLogo, schoolSettings.schoolName]);

  // Keep active teacher session synchronized in real time when edited by Admin or self
  useEffect(() => {
    if (!teacherStaff?.id) return;
    const unsub = subscribeStaffMembers((liveStaff) => {
      const matched = liveStaff.find(
        s => s.id === teacherStaff.id ||
             (teacherStaff.uniqueId && s.uniqueId?.toUpperCase() === teacherStaff.uniqueId.toUpperCase())
      );
      if (matched) {
        setTeacherStaff(prev => {
          if (!prev) return matched;
          if (
            prev.updatedAt === matched.updatedAt &&
            prev.fullName === matched.fullName &&
            prev.email === matched.email &&
            JSON.stringify(prev.assignedSubjectIds) === JSON.stringify(matched.assignedSubjectIds) &&
            JSON.stringify(prev.assignedSubjectNames) === JSON.stringify(matched.assignedSubjectNames) &&
            JSON.stringify(prev.assignedClasses) === JSON.stringify(matched.assignedClasses)
          ) {
            return prev;
          }
          try {
            sessionStorage.setItem('prime_edutech_active_teacher', JSON.stringify(matched));
          } catch {}
          return matched;
        });
      }
    });
    return () => unsub();
  }, [teacherStaff?.id]);

  // Keep active student session synchronized in real time across portals/devices
  useEffect(() => {
    if (!studentSession?.id) return;
    const unsub = subscribeStudents((liveStudents) => {
      const matched = liveStudents.find(
        s => s.id === studentSession.id ||
             (studentSession.admissionNumber && s.admissionNumber?.toUpperCase() === studentSession.admissionNumber.toUpperCase())
      );
      if (matched) {
        setStudentSession(prev => {
          if (!prev) return matched;
          if (
            prev.updatedAt === matched.updatedAt &&
            prev.fullName === matched.fullName &&
            prev.classGrade === matched.classGrade &&
            prev.status === matched.status &&
            prev.resultWithheld === matched.resultWithheld &&
            prev.withheldReason === matched.withheldReason &&
            prev.passportUrl === matched.passportUrl &&
            prev.email === matched.email &&
            JSON.stringify(prev.withheldSubjectIds) === JSON.stringify(matched.withheldSubjectIds)
          ) {
            return prev;
          }
          try {
            sessionStorage.setItem('prime_edutech_active_student', JSON.stringify(matched));
          } catch {}
          return matched;
        });
      }
    });
    return () => unsub();
  }, [studentSession?.id]);

  const navigate = (route: string) => {
    setCurrentRoute(route);
    window.history.pushState({}, '', route);
  };

  // Determine portal context from route
  const isAdminRoute = currentRoute.startsWith('/admin') || currentRoute.startsWith('/admin.honeysworld');
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
    navigate('/admin.honeysworld');
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
      setExamEntryNotice(`Cannot enter "${exam.title}": ${timeCheck.message}`);
      return;
    }
    setExamEntryNotice(null);

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
    <ErrorBoundary>
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
          onOpenChat={() => setIsChatModalOpen(true)}
        />
      )}

      {/* Main View Router */}
      <div className="flex-1">
        {examEntryNotice && (
          <div className="max-w-4xl mx-auto px-4 pt-4">
            <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs font-semibold shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{examEntryNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setExamEntryNotice(null)}
                className="p-1 text-amber-700 hover:text-amber-950 rounded cursor-pointer"
                aria-label="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
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
              settings={schoolSettings}
            />
          )
        )}

        {/* TEACHER PORTAL ROUTES */}
        {currentRoute === '/teacher/login' && (
          <TeacherLogin
            onLoginSuccess={handleTeacherLoginSuccess}
            onNavigateToStudent={() => navigate('/student/login')}
            settings={schoolSettings}
          />
        )}

        {isTeacherRoute && currentRoute !== '/teacher/login' && (
          teacherStaff ? (
            <TeacherPortal
              teacherEmail={teacherStaff.email}
              teacherStaff={teacherStaff}
              currentSubroute={currentRoute}
              onNavigateSubroute={navigate}
              onProfileUpdated={(updated) => {
                setTeacherStaff(updated);
                try {
                  sessionStorage.setItem('prime_edutech_active_teacher', JSON.stringify(updated));
                } catch {}
              }}
              onLogout={handleTeacherLogout}
              onGoToStudentPortal={() => navigate('/student/login')}
            />
          ) : (
            <TeacherLogin
              onLoginSuccess={handleTeacherLoginSuccess}
              onNavigateToStudent={() => navigate('/student/login')}
              settings={schoolSettings}
            />
          )
        )}

        {/* STUDENT PORTAL ROUTES */}
        {currentRoute === '/student/login' && (
          <StudentLogin
            onLoginSuccess={handleStudentLoginSuccess}
            onNavigateToTeacher={() => navigate('/teacher/login')}
            settings={schoolSettings}
          />
        )}

        {/* Protected Student Routes */}
        {isStudentRoute && currentRoute !== '/student/login' && (
          !studentSession ? (
            <StudentLogin
              onLoginSuccess={handleStudentLoginSuccess}
              onNavigateToTeacher={() => navigate('/teacher/login')}
              settings={schoolSettings}
            />
          ) : (
            <>
              {/* Student Dashboard */}
              {(currentRoute === '/student/dashboard' || currentRoute === '/student/examinations') && (
                <StudentDashboardView
                  student={studentSession}
                  initialTab={studentDashboardTab}
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
                  onReturnToDashboard={() => {
                    setStudentDashboardTab('examinations');
                    navigate('/student/dashboard');
                  }}
                  onOpenReportSheet={() => {
                    setStudentDashboardTab('broadsheet');
                    navigate('/student/dashboard');
                  }}
                  settings={schoolSettings}
                  student={studentSession}
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
            <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
              <span>Session: {schoolSettings.academicSession}</span>
              <span>·</span>
              <span>{schoolSettings.currentTerm}</span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <span>Role-Protected Evaluation</span>
                <button
                  onClick={() => navigate('/admin.honeysworld')}
                  className="text-slate-400 hover:text-amber-500 transition-colors p-1 rounded hover:bg-slate-100 cursor-pointer"
                  title="Institutional Administration Authority Gate"
                  aria-label="Institutional Admin Gate"
                >
                  <Lock className="w-3 h-3" />
                </button>
              </span>
            </div>
          </div>
        </footer>
      )}

      {/* Global Campus Chat Hub Modal */}
      {isChatModalOpen && chatCurrentUser && (
        <CampusChatModal
          isOpen={isChatModalOpen}
          onClose={() => setIsChatModalOpen(false)}
          currentUser={chatCurrentUser}
        />
      )}
      </div>
    </ErrorBoundary>
  );
}
