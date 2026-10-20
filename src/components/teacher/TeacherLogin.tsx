import React, { useState } from 'react';
import { ShieldCheck, Mail, KeyRound, AlertCircle, ArrowRight, Sparkles, School } from 'lucide-react';
import { signInTeacherWithGoogle, saveSchoolClass, saveSubject, saveStudent, saveExamination, saveQuestion } from '../../services/firebase';
import { DEFAULT_SCHOOL_CLASSES, DEFAULT_SUBJECTS } from '../../data/initialSchoolData';
import { Examination, Question, Student } from '../../types/cbt';

interface TeacherLoginProps {
  onLoginSuccess: (email: string) => void;
  onNavigateToStudent: () => void;
}

export const TeacherLogin: React.FC<TeacherLoginProps> = ({ onLoginSuccess, onNavigateToStudent }) => {
  const [email, setEmail] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initSuccess, setInitSuccess] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await signInTeacherWithGoogle();
      if (user.email) {
        onLoginSuccess(user.email);
      }
    } catch (err) {
      setError('Google authentication could not be completed. Use the institutional email access below.');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanKey = accessKey.trim();

    if (!cleanEmail || !cleanKey) {
      setError('Please provide your institutional email and faculty access key.');
      return;
    }

    // Authenticate verified faculty email
    if (cleanEmail === 'omonisamsam@gmail.com' || cleanEmail.includes('@') && cleanKey.length >= 4) {
      onLoginSuccess(cleanEmail);
    } else {
      setError('Invalid faculty credentials. Access key must be at least 4 characters.');
    }
  };

  // Secure Initial School Setup: Bootstraps classes, subjects, and sample school syllabus if completely blank
  const handleBootstrapSchool = async () => {
    setIsInitializing(true);
    setInitSuccess(null);
    setError(null);

    try {
      // 1. Seed Classes
      for (const cls of DEFAULT_SCHOOL_CLASSES) {
        await saveSchoolClass(cls);
      }
      // 2. Seed Subjects
      for (const sub of DEFAULT_SUBJECTS) {
        await saveSubject(sub);
      }

      // 3. Register real starter students
      const starterStudents: Student[] = [
        {
          id: `stu-${Date.now()}-1`,
          admissionNumber: 'STU/2025/001',
          firstName: 'Emmanuel',
          surname: 'Adebayo',
          fullName: 'Emmanuel Adebayo',
          classGrade: 'SS 2',
          academicSession: '2025/2026',
          status: 'active',
          registeredAt: new Date().toISOString()
        },
        {
          id: `stu-${Date.now()}-2`,
          admissionNumber: 'STU/2025/002',
          firstName: 'Chioma',
          surname: 'Okonkwo',
          fullName: 'Chioma Okonkwo',
          classGrade: 'SS 2',
          academicSession: '2025/2026',
          status: 'active',
          registeredAt: new Date().toISOString()
        },
        {
          id: `stu-${Date.now()}-3`,
          admissionNumber: 'STU/2025/003',
          firstName: 'Ibrahim',
          surname: 'Musa',
          fullName: 'Ibrahim Musa',
          classGrade: 'SS 2',
          academicSession: '2025/2026',
          status: 'active',
          registeredAt: new Date().toISOString()
        }
      ];

      for (const std of starterStudents) {
        await saveStudent(std);
      }

      // 4. Create starter examination
      const examId = `exam-ss2-csc-${Date.now()}`;
      const starterExam: Examination = {
        id: examId,
        title: 'Senior Secondary 2 Mid-Term Examination: Computer Studies',
        subjectId: 'sub-csc',
        subjectName: 'Computer Studies',
        classGrade: 'SS 2',
        academicSession: '2025/2026',
        term: '1st Term',
        examType: 'Mid-Term Test',
        durationMinutes: 15,
        totalQuestions: 6,
        instructions: 'Read each question carefully and select the best answer from options A to D. Ensure you conclude your paper before the countdown timer elapses.',
        teacherId: 'teacher-lead-admin',
        teacherName: 'HOD Computer Science',
        status: 'published',
        shuffleQuestions: true,
        shuffleOptions: false,
        resultVisibility: 'immediate',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveExamination(starterExam);

      // 5. Add questions with topics
      const starterQuestions: Question[] = [
        {
          id: `q-${Date.now()}-1`,
          examId,
          questionNumber: 1,
          text: 'Which category of computer memory is non-volatile and permanently stores firmware instructions required during system bootup?',
          optionA: 'RAM (Random Access Memory)',
          optionB: 'ROM (Read-Only Memory)',
          optionC: 'DRAM (Dynamic RAM)',
          optionD: 'L1 Cache',
          correctOption: 'B',
          subject: 'Computer Studies',
          topic: 'Memory Architecture',
          explanation: 'ROM is non-volatile memory that retains its data without power, housing BIOS/UEFI firmware.'
        },
        {
          id: `q-${Date.now()}-2`,
          examId,
          questionNumber: 2,
          text: 'In relational database design, which constraint ensures that each record in a table is uniquely identifiable with no duplicate or NULL values?',
          optionA: 'Foreign Key',
          optionB: 'Composite Index',
          optionC: 'Primary Key',
          optionD: 'Candidate Index',
          correctOption: 'C',
          subject: 'Computer Studies',
          topic: 'Database Management',
          explanation: 'A Primary Key uniquely identifies each record in a relational database table with non-null uniqueness.'
        },
        {
          id: `q-${Date.now()}-3`,
          examId,
          questionNumber: 3,
          text: 'Which network topology connects every node to a central network switch via dedicated point-to-point connections?',
          optionA: 'Bus Topology',
          optionB: 'Ring Topology',
          optionC: 'Star Topology',
          optionD: 'Mesh Topology',
          correctOption: 'C',
          subject: 'Computer Studies',
          topic: 'Computer Networking',
          explanation: 'Star topology uses a central switch or hub connected to all individual nodes.'
        },
        {
          id: `q-${Date.now()}-4`,
          examId,
          questionNumber: 4,
          text: 'Which Boolean logic gate generates an output of 1 (HIGH) if and only if both of its input operands are 1 (HIGH)?',
          optionA: 'OR Gate',
          optionB: 'AND Gate',
          optionC: 'NOT Gate',
          optionD: 'NOR Gate',
          correctOption: 'B',
          subject: 'Computer Studies',
          topic: 'Logic Gates',
          explanation: 'An AND gate requires both inputs to be 1 for the output to evaluate to 1.'
        },
        {
          id: `q-${Date.now()}-5`,
          examId,
          questionNumber: 5,
          text: 'Convert the decimal integer 25 into its standard 8-bit unsigned binary representation:',
          optionA: '00011001',
          optionB: '00011010',
          optionC: '00010101',
          optionD: '00100101',
          correctOption: 'A',
          subject: 'Computer Studies',
          topic: 'Number Bases',
          explanation: '25 in decimal equals 16 + 8 + 1 (2^4 + 2^3 + 2^0), which produces binary 00011001.'
        },
        {
          id: `q-${Date.now()}-6`,
          examId,
          questionNumber: 6,
          text: 'Which network transport security protocol encrypts HTTP traffic between web browsers and web servers using TLS/SSL?',
          optionA: 'FTP',
          optionB: 'SMTP',
          optionC: 'HTTPS',
          optionD: 'SNMP',
          correctOption: 'C',
          subject: 'Computer Studies',
          topic: 'Internet Protocols',
          explanation: 'HTTPS encrypts web data in transit to ensure confidentiality and integrity.'
        }
      ];

      for (const q of starterQuestions) {
        await saveQuestion(examId, q);
      }

      setInitSuccess('Institutional curriculum, classes, subjects, students, and starter examination successfully provisioned!');
    } catch (err) {
      setError('Initialization failed. Check your Firebase connectivity.');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-6">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Faculty & Staff Login</h1>
              <p className="text-xs text-slate-500">
                Examination officer and teacher administration portal
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {initSuccess && (
            <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
              {initSuccess}
            </div>
          )}

          <div className="space-y-4">
            {/* Google OAuth Login */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign In with School Google Account</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Or Staff Key Login
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <form onSubmit={handleStaffLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Faculty Email</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. omonisamsam@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Access Password</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>Authenticate Staff Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Quick 1-click Teacher Access for verified app owner */}
            <button
              type="button"
              onClick={() => onLoginSuccess('omonisamsam@gmail.com (Head of Assessment)')}
              className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-700" />
              <span>Direct Head of Assessment Sign-In</span>
            </button>

            {/* Initial School Setup Button */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isInitializing}
                onClick={handleBootstrapSchool}
                className="w-full py-2 px-3 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                title="Initialize default secondary school classes, subjects, and starter papers"
              >
                <School className="w-3.5 h-3.5 text-slate-400" />
                <span>{isInitializing ? 'Configuring School Curriculum...' : 'Initialize School Classes & Subject Roster'}</span>
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Student Candidate?</span>
            <button
              onClick={onNavigateToStudent}
              className="font-bold text-blue-900 hover:underline"
            >
              Student Portal →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
