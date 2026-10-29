export interface SchoolClass {
  id: string;
  name: string; // e.g. "Senior Secondary 2"
  code: string; // e.g. "SS2"
  arm?: string; // e.g. "A", "Gold", "Science"
  academicSession: string; // e.g. "2025/2026"
  studentCount?: number;
}

export interface Subject {
  id: string;
  name: string; // e.g. "Computer Studies", "Mathematics", "Physics"
  code: string; // e.g. "CSC", "MTH", "PHY"
  department: string; // e.g. "Science & Tech", "Humanities", "Commercial"
}

export interface Student {
  id: string;
  admissionNumber: string; // e.g. "STU/2025/014"
  firstName: string; // e.g. "Emmanuel"
  surname: string; // e.g. "Adebayo"
  fullName: string;
  classGrade: string; // e.g. "SS 2"
  classId?: string;
  academicSession: string;
  status: 'active' | 'suspended' | 'graduated';
  registeredAt: string;
  accessCode?: string; // Unique student login passcode e.g. "PRM-4821"
  gender?: string;
  passportUrl?: string; // Uploaded passport photo URL or base64
  email?: string; // Connected student email address
  password?: string; // Personal security password set by student
  phoneNumber?: string;
  dateOfBirth?: string;
  stateOfOrigin?: string;
  department?: string; // e.g. "Science & Tech", "Arts & Humanities", "Commercial"
  bio?: string;
  cgpa?: number; // Cumulative Grade Point Average (0.00 - 5.00)
}

export interface Examination {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  classGrade: string;
  academicSession: string;
  term: '1st Term' | '2nd Term' | '3rd Term';
  examType: 'Mid-Term Test' | 'Final Examination' | 'Continuous Assessment';
  durationMinutes: number;
  totalQuestions: number;
  instructions: string;
  teacherId: string;
  teacherName: string;
  status: 'draft' | 'published' | 'archived';
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  resultVisibility: 'immediate' | 'teacher_publish';
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  examId: string;
  questionNumber: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  subject: string;
  topic: string;
  explanation?: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  studentAdmissionNumber: string;
  studentName: string;
  startTime: string;
  endTime: string; // Absolute expiry timestamp in ISO
  status: 'in_progress' | 'submitted' | 'timed_out';
  savedAnswers: Record<string, 'A' | 'B' | 'C' | 'D'>;
  flaggedQuestions?: Record<string, boolean>;
  lastHeartbeatAt: string;
}

export interface QuestionResultDetail {
  questionNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  studentAnswer?: 'A' | 'B' | 'C' | 'D';
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
  topic?: string;
  explanation?: string;
}

export interface TopicScore {
  topic: string;
  total: number;
  correct: number;
  percentage: number;
}

export interface Submission {
  id?: string;
  attemptId?: string;
  examId: string;
  examTitle: string;
  subject: string;
  classGrade: string;
  academicSession: string;
  term: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpentSeconds: number;
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>;
  submittedAt: string;
  detailedResults?: QuestionResultDetail[];
  topicAnalysis?: Record<string, TopicScore>;
  aiRevisionRecommendations?: string[];
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'vice_principal' | 'examination_officer';
  passcode: string;
  status: 'active' | 'suspended';
  isMainSuperAdmin?: boolean;
  phoneNumber?: string;
  assignedPermissions?: string[];
  createdAt: string;
  lastLoginAt?: string;
}

export interface CaWeightsConfig {
  assignmentMax: number;
  projectMax: number;
  testMax: number;
  examMax: number;
}

export interface GradeScaleItem {
  grade: string;
  minScore: number;
  maxScore: number;
  gradePoint: number;
  remark: string;
}

export const DEFAULT_CA_WEIGHTS: CaWeightsConfig = {
  assignmentMax: 10,
  projectMax: 10,
  testMax: 20,
  examMax: 60
};

export const DEFAULT_GRADE_SCALE: GradeScaleItem[] = [
  { grade: 'A1', minScore: 75, maxScore: 100, gradePoint: 5.0, remark: 'Excellent' },
  { grade: 'B2', minScore: 70, maxScore: 74, gradePoint: 4.0, remark: 'Very Good' },
  { grade: 'B3', minScore: 65, maxScore: 69, gradePoint: 3.5, remark: 'Good' },
  { grade: 'C4', minScore: 60, maxScore: 64, gradePoint: 3.0, remark: 'Credit' },
  { grade: 'C5', minScore: 55, maxScore: 59, gradePoint: 2.5, remark: 'Credit' },
  { grade: 'C6', minScore: 50, maxScore: 54, gradePoint: 2.0, remark: 'Credit' },
  { grade: 'D7', minScore: 45, maxScore: 49, gradePoint: 1.5, remark: 'Pass' },
  { grade: 'E8', minScore: 40, maxScore: 44, gradePoint: 1.0, remark: 'Pass' },
  { grade: 'F9', minScore: 0,  maxScore: 39, gradePoint: 0.0, remark: 'Fail' }
];

export interface SchoolSettings {
  schoolName: string;
  address?: string;
  location?: string;
  motto?: string;
  phone?: string;
  email?: string;
  website?: string;
  principalName?: string;
  academicSession: string;
  currentTerm: string;
  passMarkPercentage: number;
  allowImmediateResultViewing: boolean;
  studentIdPrefix?: string;
  announcementBanner?: string;
  isStudentPortalActive?: boolean;
  isTeacherPortalActive?: boolean;
  caWeights?: CaWeightsConfig;
  gradingScale?: GradeScaleItem[];
  enableAiAdvisor?: boolean;
  enablePracticeCenter?: boolean;
}

export interface SavedStudentLogin {
  admissionNumber: string;
  firstName: string;
  fullName: string;
  classGrade: string;
  accessCode?: string;
  lastLoginAt: string;
}

// Generate automatic unique student login passcode (e.g. PRM-78392)
export function generateStudentAccessCode(existingCodes: string[] = []): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  let attempts = 0;
  do {
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = `PRM-${rand}`;
    attempts++;
  } while (existingCodes.includes(code) && attempts < 100);
  return code;
}

export interface StaffMember {
  id: string;
  uniqueId: string; // e.g. "TCH-1001" or "TCH-8921"
  fullName: string;
  email: string;
  assignedSubjectIds: string[]; // Subject IDs taught by this teacher e.g. ['sub-csc']
  assignedSubjectNames: string[]; // Subject Names taught by this teacher e.g. ['Computer Studies']
  assignedClasses: string[]; // e.g. ['SS 1', 'SS 2', 'SS 3']
  role: 'teacher' | 'hod';
  status: 'active' | 'suspended';
  createdAt: string;
  password?: string; // Teacher custom login password
  qualification?: string; // e.g. "B.Sc. Ed (Computer Science)", "M.Ed", "PGDE"
  courseOfStudy?: string; // e.g. "Computer Science Education", "Pure Mathematics"
  phoneNumber?: string;
  avatarUrl?: string; // Teacher photo or preset avatar URL
  bio?: string; // Professional summary / specialization
}

export interface StudentAssessmentRecord {
  id: string; // e.g. ca_stu123_subcsc_2025-2026_1stTerm
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classGrade: string; // e.g. "SS 2"
  subjectId: string;
  subjectName: string;
  academicSession: string; // e.g. "2025/2026"
  term: '1st Term' | '2nd Term' | '3rd Term';
  assignmentScore: number; // e.g. 0-10 or 0-20
  projectScore: number;    // e.g. 0-10 or 0-20
  testScore: number;       // Continuous Assessment test, e.g. 0-20
  examScore: number;       // CBT exam score or manual exam score, e.g. 0-60
  totalScore: number;      // 0 - 100
  grade: string;           // A1, B2, B3, C4, C5, C6, D7, E8, F9
  remark: string;          // Excellent, Very Good, Credit, Pass, Fail
  cbtSubmissionId?: string;
  isAutoSynced?: boolean;
  teacherComment?: string;
  updatedAt: string;
}

export interface ExamTimeWindowStatus {
  isOpen: boolean;
  code: 'published_open' | 'not_yet_started' | 'closed' | 'unpublished';
  message: string;
  startDateFormatted?: string;
  endDateFormatted?: string;
}

export function checkExamTimeWindow(exam: Examination): ExamTimeWindowStatus {
  if (exam.status !== 'published') {
    return {
      isOpen: false,
      code: 'unpublished',
      message: 'This examination is currently unpublished by the subject teacher.'
    };
  }

  const now = new Date().getTime();

  if (exam.startDate) {
    const startTime = new Date(exam.startDate).getTime();
    if (!isNaN(startTime) && now < startTime) {
      const formatted = new Date(exam.startDate).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      return {
        isOpen: false,
        code: 'not_yet_started',
        message: `Examination has not started yet. Scheduled to open on ${formatted}.`,
        startDateFormatted: formatted
      };
    }
  }

  if (exam.endDate) {
    const endTime = new Date(exam.endDate).getTime();
    if (!isNaN(endTime) && now > endTime) {
      const formatted = new Date(exam.endDate).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      return {
        isOpen: false,
        code: 'closed',
        message: `Examination closed on ${formatted}. Submissions are no longer accepted.`,
        endDateFormatted: formatted
      };
    }
  }

  return {
    isOpen: true,
    code: 'published_open',
    message: 'Examination is active and currently open.'
  };
}

// Generate automatic unique staff login passcode (e.g. TCH-8392)
export function generateStaffUniqueId(existingCodes: string[] = []): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  let attempts = 0;
  do {
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = `TCH-${rand}`;
    attempts++;
  } while (existingCodes.includes(code) && attempts < 100);
  return code;
}

export interface TeacherUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'teacher' | 'admin';
}

export function calculateGrade(percentage: number): { grade: string; remark: string; color: string } {
  if (percentage >= 75) return { grade: 'A1', remark: 'Excellent', color: 'text-emerald-700 bg-emerald-50' };
  if (percentage >= 70) return { grade: 'B2', remark: 'Very Good', color: 'text-blue-700 bg-blue-50' };
  if (percentage >= 65) return { grade: 'B3', remark: 'Good', color: 'text-blue-700 bg-blue-50' };
  if (percentage >= 60) return { grade: 'C4', remark: 'Credit', color: 'text-teal-700 bg-teal-50' };
  if (percentage >= 55) return { grade: 'C5', remark: 'Credit', color: 'text-teal-700 bg-teal-50' };
  if (percentage >= 50) return { grade: 'C6', remark: 'Credit', color: 'text-teal-700 bg-teal-50' };
  if (percentage >= 45) return { grade: 'D7', remark: 'Pass', color: 'text-amber-700 bg-amber-50' };
  if (percentage >= 40) return { grade: 'E8', remark: 'Pass', color: 'text-amber-700 bg-amber-50' };
  return { grade: 'F9', remark: 'Fail', color: 'text-rose-700 bg-rose-50' };
}

// Generate intelligent academic revision recommendations based on topics
export function generateTopicRevisionInsights(detailedResults: QuestionResultDetail[]): {
  topicAnalysis: Record<string, TopicScore>;
  recommendations: string[];
} {
  const topicMap: Record<string, { total: number; correct: number }> = {};

  for (const q of detailedResults) {
    const topic = q.topic || 'General Concepts';
    if (!topicMap[topic]) {
      topicMap[topic] = { total: 0, correct: 0 };
    }
    topicMap[topic].total += 1;
    if (q.isCorrect) {
      topicMap[topic].correct += 1;
    }
  }

  const topicAnalysis: Record<string, TopicScore> = {};
  const weakTopics: string[] = [];
  const strongTopics: string[] = [];

  for (const [topic, stats] of Object.entries(topicMap)) {
    const pct = Math.round((stats.correct / stats.total) * 100);
    topicAnalysis[topic] = {
      topic,
      total: stats.total,
      correct: stats.correct,
      percentage: pct
    };

    if (pct < 60) {
      weakTopics.push(`${topic} (${pct}% accuracy)`);
    } else if (pct >= 80) {
      strongTopics.push(topic);
    }
  }

  const recommendations: string[] = [];
  if (weakTopics.length > 0) {
    recommendations.push(
      `Focused revision recommended for: ${weakTopics.join(', ')}. Review lecture notes and textbook chapters on these areas.`
    );
  }
  if (strongTopics.length > 0) {
    recommendations.push(
      `Strong mastery demonstrated in: ${strongTopics.join(', ')}. Continue practicing advanced problem solving.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      'Balanced performance across core syllabus units. Maintain regular study schedules.'
    );
  }

  return { topicAnalysis, recommendations };
}

// Grade Point Calculation (5.00 University GPA scale)
export function calculateGradePoint(percentage: number): number {
  if (percentage >= 75) return 5.0; // A1
  if (percentage >= 70) return 4.0; // B2
  if (percentage >= 65) return 3.5; // B3
  if (percentage >= 60) return 3.0; // C4
  if (percentage >= 55) return 2.5; // C5
  if (percentage >= 50) return 2.0; // C6
  if (percentage >= 45) return 1.5; // D7
  if (percentage >= 40) return 1.0; // E8
  return 0.0; // F9
}

export function getAcademicStanding(cgpa: number): { title: string; color: string; badge: string } {
  if (cgpa >= 4.50) return { title: 'First Class Honours / Distinction', color: 'text-amber-800 bg-amber-50 border-amber-200', badge: 'Distinction' };
  if (cgpa >= 3.50) return { title: 'Second Class Honours (Upper Division)', color: 'text-emerald-800 bg-emerald-50 border-emerald-200', badge: 'Upper Credit' };
  if (cgpa >= 2.40) return { title: 'Second Class Honours (Lower Division)', color: 'text-blue-800 bg-blue-50 border-blue-200', badge: 'Lower Credit' };
  if (cgpa >= 1.50) return { title: 'Third Class Standing', color: 'text-slate-800 bg-slate-100 border-slate-200', badge: 'Pass' };
  return { title: 'Remedial Academic Standing', color: 'text-rose-800 bg-rose-50 border-rose-200', badge: 'Warning' };
}

export interface CumulativeTermRecord {
  academicSession: string;
  term: '1st Term' | '2nd Term' | '3rd Term';
  records: StudentAssessmentRecord[];
  gpa: number;
  totalCourses: number;
  passedCourses: number;
  averagePercentage: number;
}

export interface CumulativeStudentTranscript {
  terms: CumulativeTermRecord[];
  cgpa: number;
  overallAverage: number;
  totalRegisteredCourses: number;
  totalPassedCourses: number;
  standing: { title: string; color: string; badge: string };
}
