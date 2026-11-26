export interface SchoolClass {
  id: string;
  name: string; // e.g. "Senior Secondary 2"
  code: string; // e.g. "SS2"
  arm?: string; // e.g. "A", "Gold", "Science"
  academicSession: string; // e.g. "2025/2026"
  studentCount?: number;
  updatedAt?: string;
}

export interface Subject {
  id: string;
  name: string; // e.g. "Computer Studies", "Mathematics", "Physics"
  code: string; // e.g. "CSC", "MTH", "PHY"
  department: string; // e.g. "Science & Tech", "Humanities", "Commercial"
  updatedAt?: string;
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
  resultWithheld?: boolean; // When true, student cannot view results across the school
  withheldSubjectIds?: string[]; // Specific subject IDs withheld from student
  withheldReason?: string; // e.g. "Pending bursary clearance"
  updatedAt?: string;
}

export type CbtTargetComponent = 'first_ca' | 'second_ca' | 'exam';

export interface Examination {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  classGrade: string;
  academicSession: string;
  term: '1st Term' | '2nd Term' | '3rd Term';
  examType: 'Mid-Term Test' | 'Final Examination' | 'Continuous Assessment';
  targetCaComponent?: CbtTargetComponent;
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
  enableAntiCheat?: boolean;
  maxTabSwitches?: number;
  requireFullscreen?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  examId: string;
  questionNumber: number;
  text: string;
  imageUrl?: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionAImage?: string;
  optionBImage?: string;
  optionCImage?: string;
  optionDImage?: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  subject: string;
  topic: string;
  explanation?: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle?: string;
  subjectName?: string;
  classGrade?: string;
  studentId: string;
  studentAdmissionNumber: string;
  studentName: string;
  startTime: string;
  endTime: string; // Absolute expiry timestamp in ISO
  status: 'in_progress' | 'submitted' | 'timed_out' | 'retake_granted';
  savedAnswers: Record<string, 'A' | 'B' | 'C' | 'D'>;
  flaggedQuestions?: Record<string, boolean>;
  tabSwitchCount?: number;
  currentQuestionIndex?: number;
  answeredCount?: number;
  totalQuestions?: number;
  lastWarning?: string;
  lastHeartbeatAt: string;
  retakeGrantedAt?: string;
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
  attemptNumber?: number; // Chronological sitting index per student & subject (1, 2, 3...)
  sittingLabel?: string;  // e.g. "1st Exam", "2nd Exam", "3rd Exam"
  targetCaComponent?: CbtTargetComponent; // Broadsheet target column ('first_ca' | 'second_ca' | 'exam')
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
  updatedAt?: string;
}

export interface CaWeightsConfig {
  firstCaMax: number;      // 1st CA Test (default 20)
  secondCaMax: number;     // 2nd CA Test (default 20)
  assignmentMax: number;   // Note / Assignment (default 10)
  examMax: number;         // CBT / Terminal Exam (default 50)
  firstCaLabel?: string;   // Editable heading (default '1st CA')
  secondCaLabel?: string;  // Editable heading (default '2nd CA')
  assignmentLabel?: string;// Editable heading (default 'Assignment/Note')
  examLabel?: string;      // Editable heading (default "Term's Exam")
  version?: number;
  // Legacy aliases for backwards compatibility
  testMax?: number;
  projectMax?: number;
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
  firstCaMax: 20,
  secondCaMax: 20,
  examMax: 50,
  assignmentLabel: 'Assignment/Note',
  firstCaLabel: '1st CA',
  secondCaLabel: '2nd CA',
  examLabel: "Term's Exam",
  version: 2,
  testMax: 20,
  projectMax: 20
};

export function resolveCaWeights(raw?: Partial<CaWeightsConfig> | null): Required<CaWeightsConfig> {
  if (!raw) {
    return {
      ...DEFAULT_CA_WEIGHTS,
      firstCaLabel: DEFAULT_CA_WEIGHTS.firstCaLabel!,
      secondCaLabel: DEFAULT_CA_WEIGHTS.secondCaLabel!,
      assignmentLabel: DEFAULT_CA_WEIGHTS.assignmentLabel!,
      examLabel: DEFAULT_CA_WEIGHTS.examLabel!,
      version: 2,
      testMax: DEFAULT_CA_WEIGHTS.firstCaMax,
      projectMax: DEFAULT_CA_WEIGHTS.secondCaMax
    };
  }

  // Upgrade unversioned or v1 legacy 15/15/10/60 defaults automatically to 20/20/10/50
  const isLegacyDefault =
    (!raw.version || raw.version < 2) &&
    (raw.firstCaMax === 15 || raw.testMax === 15) &&
    (raw.secondCaMax === 15 || raw.projectMax === 15) &&
    (raw.assignmentMax === 10 || raw.assignmentMax === undefined) &&
    raw.examMax === 60;

  if (isLegacyDefault) {
    return {
      ...DEFAULT_CA_WEIGHTS,
      assignmentLabel: raw.assignmentLabel || DEFAULT_CA_WEIGHTS.assignmentLabel!,
      firstCaLabel: raw.firstCaLabel || DEFAULT_CA_WEIGHTS.firstCaLabel!,
      secondCaLabel: raw.secondCaLabel || DEFAULT_CA_WEIGHTS.secondCaLabel!,
      examLabel: raw.examLabel || DEFAULT_CA_WEIGHTS.examLabel!,
      version: 2,
      testMax: 20,
      projectMax: 20
    };
  }

  const assignmentMax = typeof raw.assignmentMax === 'number' ? raw.assignmentMax : DEFAULT_CA_WEIGHTS.assignmentMax;
  const firstCaMax = typeof raw.firstCaMax === 'number'
    ? raw.firstCaMax
    : (typeof raw.testMax === 'number' ? raw.testMax : DEFAULT_CA_WEIGHTS.firstCaMax);
  const secondCaMax = typeof raw.secondCaMax === 'number'
    ? raw.secondCaMax
    : (typeof raw.projectMax === 'number' ? raw.projectMax : DEFAULT_CA_WEIGHTS.secondCaMax);
  const examMax = typeof raw.examMax === 'number' ? raw.examMax : DEFAULT_CA_WEIGHTS.examMax;

  return {
    assignmentMax,
    firstCaMax,
    secondCaMax,
    examMax,
    assignmentLabel: raw.assignmentLabel || DEFAULT_CA_WEIGHTS.assignmentLabel!,
    firstCaLabel: raw.firstCaLabel || DEFAULT_CA_WEIGHTS.firstCaLabel!,
    secondCaLabel: raw.secondCaLabel || DEFAULT_CA_WEIGHTS.secondCaLabel!,
    examLabel: raw.examLabel || DEFAULT_CA_WEIGHTS.examLabel!,
    version: raw.version || 2,
    testMax: firstCaMax,
    projectMax: secondCaMax
  };
}

export function resolveExamTargetComponent(
  exam?: Partial<Examination> | null,
  submission?: Partial<Submission> | null
): CbtTargetComponent {
  const explicit = exam?.targetCaComponent || submission?.targetCaComponent;
  if (explicit === 'first_ca' || explicit === 'second_ca' || explicit === 'exam') {
    return explicit;
  }
  const titleHint = `${exam?.title || submission?.examTitle || ''}`.toLowerCase();
  if (/\b(1st|first)\s*(c\.?a\.?|continuous\s*assessment|test)\b/.test(titleHint)) {
    return 'first_ca';
  }
  if (/\b(2nd|second)\s*(c\.?a\.?|continuous\s*assessment|test)\b/.test(titleHint)) {
    return 'second_ca';
  }
  return 'exam';
}

export function formatTargetComponentLabel(
  target?: CbtTargetComponent | null,
  caWeights?: Partial<CaWeightsConfig> | null
): string {
  const weights = resolveCaWeights(caWeights);
  if (target === 'first_ca') return weights.firstCaLabel || '1st CA';
  if (target === 'second_ca') return weights.secondCaLabel || '2nd CA';
  return weights.examLabel || "Term's Exam";
}

export function getTargetComponentMax(
  target?: CbtTargetComponent | null,
  caWeights?: Partial<CaWeightsConfig> | null
): number {
  const weights = resolveCaWeights(caWeights);
  if (target === 'first_ca') return Math.max(1, weights.firstCaMax || 20);
  if (target === 'second_ca') return Math.max(1, weights.secondCaMax || 20);
  return Math.max(1, weights.examMax || 50);
}

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
  examOfficerName?: string;
  resultTitle?: string;
  resultSubtitle?: string;
  securityNotice?: string;
  academicSession: string;
  currentTerm: string;
  passMarkPercentage: number;
  allowImmediateResultViewing: boolean;
  studentIdPrefix?: string;
  announcementBanner?: string;
  schoolLogo?: string;
  isStudentPortalActive?: boolean;
  isTeacherPortalActive?: boolean;
  caWeights?: CaWeightsConfig;
  gradingScale?: GradeScaleItem[];
  enableAiAdvisor?: boolean;
  enablePracticeCenter?: boolean;
  enableChatHub?: boolean;
  enableLessonGenerator?: boolean;
  nextTermBegins?: string;
  nextTermFees?: string;
  updatedAt?: string;
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
  updatedAt?: string; // ISO timestamp for fast cross-platform sync
}

export interface CbtExamEntry {
  submissionId: string;
  examId: string;
  examTitle: string;
  sittingNumber: number;
  sittingLabel: string; // e.g. "1st Exam", "2nd Exam", "3rd Exam"
  targetCaComponent?: CbtTargetComponent;
  rawScore: number;
  totalQuestions: number;
  percentage: number;
  scaledScore: number;
  examMax: number;
  submittedAt: string;
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
  assignmentScore: number; // Assignment (0 - 10)
  firstCaScore?: number;   // 1st CA Summary (0 - 20)
  secondCaScore?: number;  // 2nd CA Summary (0 - 20)
  projectScore: number;    // Compatible alias for secondCaScore
  testScore: number;       // Compatible alias for firstCaScore
  examScore: number;       // Term's Exam (0 - 50)
  totalScore: number;      // 0 - 100
  grade: string;           // A, B, C, D, E, F9
  remark: string;          // EXCELLENT, V.GOOD, GOOD, FAIR, FAIL
  classAverage?: number;   // e.g. 62.6%
  teacherSignature?: string; // e.g. "Signed"
  cbtSubmissionId?: string;
  examEntries?: CbtExamEntry[]; // Individual CBT sittings (1st Exam, 2nd Exam, etc.) preserved separately
  isAutoSynced?: boolean;
  explicitlySaved?: boolean;
  teacherComment?: string;
  updatedAt: string;
}

export function buildCanonicalCaRecordId(
  studentKey: string,
  subjectKey: string,
  academicSession: string,
  term: string
): string {
  const s = (studentKey || 'stu').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const sub = (subjectKey || 'sub').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const sess = (academicSession || '2025-2026').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const trm = (term || '1stTerm').trim().replace(/\s+/g, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `ca_${s}_${sub}_${sess}_${trm}`;
}

export interface PsychomotorRating {
  punctuality: number;       // 1 - 5
  classAttendance: number;   // 1 - 5
  personalHygiene: number;   // 1 - 5
  attentiveness: number;     // 1 - 5
  honesty: number;           // 1 - 5
  neatness: number;          // 1 - 5
  participationAtWork: number; // 1 - 5
  selfControl: number;       // 1 - 5
  initiative: number;        // 1 - 5
}

export interface SkillsRating {
  handwriting: number;       // 1 - 5
  drawingPainting: number;   // 1 - 5
  gamesSports: number;       // 1 - 5
  readingFluency: number;    // 1 - 5
  handlingOfTools: number;   // 1 - 5
}

export interface StudentTermReportData {
  id: string; // report_${studentId}_${session}_${term}
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classGrade: string;
  academicSession: string;
  term: '1st Term' | '2nd Term' | '3rd Term';
  // Student bio parameters from official sample
  age?: number | string;
  house?: string; // e.g. "BLUE", "RED", "GREEN", "YELLOW"
  sex?: string; // e.g. "MALE", "FEMALE"
  noInClass?: number | string; // e.g. 13
  department?: string; // e.g. "SENIOR SECONDARY", "SCIENCE", "ARTS", "COMMERCIAL"
  category?: string; // e.g. "SENIOR SECONDARY", "JUNIOR SECONDARY"
  classAverage?: number | string; // e.g. "62.6%"
  overallPosition?: string; // e.g. "1st", "2nd", "3rd"
  // Psychomotor Behaviours (1-5)
  behaviours: PsychomotorRating;
  // Skills Assessment (1-5)
  skills: SkillsRating;
  // Comments & Administrative Remarks
  classTeacherRemarks?: string; // e.g. "STAY FOCUS AND YOU'LL REACH YOUR GOALS."
  principalRemarks?: string;    // e.g. "GOOD PROGRESS! BUT MORE EFFORT ARE NEEDED."
  nextTermBegins?: string;      // e.g. "5TH JANUARY, 2026"
  nextTermFees?: string;        // e.g. "26,000"
  principalSignature?: string;
  proprietressSignature?: string;
  customLabels?: Record<string, string>;
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_PSYCHOMOTOR: PsychomotorRating = {
  punctuality: 5,
  classAttendance: 5,
  personalHygiene: 5,
  attentiveness: 5,
  honesty: 5,
  neatness: 5,
  participationAtWork: 4,
  selfControl: 5,
  initiative: 5
};

export const DEFAULT_SKILLS: SkillsRating = {
  handwriting: 4,
  drawingPainting: 5,
  gamesSports: 5,
  readingFluency: 5,
  handlingOfTools: 5
};

export const KEY_RATING_LABELS: Record<number, string> = {
  5: 'EXCELLENT',
  4: 'GOOD',
  3: 'FAIR',
  2: 'POOR',
  1: 'VERY POOR'
};

export interface ChatMessage {
  id: string;
  channelId: string; // e.g. 'staff-general', 'class-ss2', 'campus-students', or 'dm_a__b'
  channelName?: string;
  channelType: 'staff_group' | 'student_class_group' | 'campus_group' | 'direct_teacher' | 'direct_student' | 'student_to_teacher';
  senderId: string;
  senderName: string;
  senderRole: 'super_admin' | 'admin' | 'teacher' | 'student';
  recipientId?: string;
  recipientName?: string;
  text: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'audio' | 'document';
  attachmentName?: string;
  attachmentSize?: string;
  voiceDurationSeconds?: number;
  replyToId?: string;
  replyToSender?: string;
  replyToText?: string;
  deleted?: boolean;
  timestamp: string;
}

export interface LessonNote {
  id: string;
  teacherId: string;
  teacherName: string;
  subjectName: string;
  classGrade: string;
  term: string;
  weekNumber: number;
  topic: string;
  subTopic?: string;
  durationMinutes: number;
  behavioralObjectives: string[];
  instructionalMaterials: string[];
  previousKnowledge: string;
  content: string;
  visualsAndCharts: string; // ASCII diagram / visual chart / flowchart
  teacherActivities: string[];
  studentActivities: string[];
  evaluationQuestions: string[];
  summary: string;
  assignment: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ExamTimeWindowStatus {
  isOpen: boolean;
  code: 'published_open' | 'not_yet_started' | 'closed' | 'unpublished';
  message: string;
  startDateFormatted?: string;
  endDateFormatted?: string;
}

export function checkExamTimeWindow(exam: Examination): ExamTimeWindowStatus {
  const normalizedStatus = (exam.status || '').trim().toLowerCase();
  if (normalizedStatus !== 'published') {
    return {
      isOpen: false,
      code: 'unpublished',
      message: 'This examination is currently unpublished by the subject teacher.'
    };
  }

  const now = new Date().getTime();

  const rawStart = (exam.startDate || '').trim();
  if (rawStart) {
    const startTime = new Date(rawStart).getTime();
    if (!isNaN(startTime) && now < startTime) {
      const formatted = new Date(rawStart).toLocaleString(undefined, {
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

  const rawEnd = (exam.endDate || '').trim();
  if (rawEnd) {
    const endTime = new Date(rawEnd).getTime();
    if (!isNaN(endTime) && now > endTime) {
      const formatted = new Date(rawEnd).toLocaleString(undefined, {
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

export function formatOrdinalSuffix(n: number): string {
  const num = Math.max(1, Math.floor(n));
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  switch (num % 10) {
    case 1: return `${num}st`;
    case 2: return `${num}nd`;
    case 3: return `${num}rd`;
    default: return `${num}th`;
  }
}

export function formatOrdinalExamLabel(n: number): string {
  return `${formatOrdinalSuffix(n)} Exam`;
}

/**
 * Computes deterministic chronological sitting labels ("1st Exam", "2nd Exam", ...)
 * per student & subject within a term/session, while preserving reverse-chronological sort for display.
 */
export function enrichSubmissionsWithOrdinals(submissions: Submission[]): Submission[] {
  if (!Array.isArray(submissions) || submissions.length === 0) return [];

  const asc = [...submissions].sort(
    (a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime()
  );

  const counters = new Map<string, number>();
  const enrichedAsc = asc.map((sub) => {
    const stuKey = (sub.studentId || sub.admissionNumber || 'stu').trim().toUpperCase();
    const subjKey = (sub.subject || 'GENERAL').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sessKey = (sub.academicSession || '').trim().toUpperCase();
    const termKey = (sub.term || '').trim().toUpperCase().replace(/\s+/g, '');
    const groupKey = `${stuKey}__${subjKey}__${sessKey}__${termKey}`;

    const nextCount = (counters.get(groupKey) || 0) + 1;
    counters.set(groupKey, nextCount);

    return {
      ...sub,
      attemptNumber: nextCount,
      sittingLabel: formatOrdinalExamLabel(nextCount)
    };
  });

  return enrichedAsc.sort(
    (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
  );
}

