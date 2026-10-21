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
  surname: string; // e.g. "Adebayo" - used as password per school request
  fullName: string;
  classGrade: string; // e.g. "SS2"
  classId?: string;
  academicSession: string;
  status: 'active' | 'suspended' | 'graduated';
  registeredAt: string;
  accessCode?: string; // Unique student login passcode e.g. "PRM-4821"
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

export interface SchoolSettings {
  schoolName: string;
  academicSession: string;
  currentTerm: string;
  passMarkPercentage: number;
  allowImmediateResultViewing: boolean;
  studentIdPrefix?: string;
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
