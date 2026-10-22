import { SchoolClass, Subject, SchoolSettings, Student, Examination, Question, StaffMember } from '../types/cbt';

export const DEFAULT_SCHOOL_CLASSES: SchoolClass[] = [
  { id: 'class-jss1', name: 'Junior Secondary 1', code: 'JSS 1', arm: 'General', academicSession: '2025/2026' },
  { id: 'class-jss2', name: 'Junior Secondary 2', code: 'JSS 2', arm: 'General', academicSession: '2025/2026' },
  { id: 'class-jss3', name: 'Junior Secondary 3', code: 'JSS 3', arm: 'General', academicSession: '2025/2026' },
  { id: 'class-ss1', name: 'Senior Secondary 1', code: 'SS 1', arm: 'Science & Arts', academicSession: '2025/2026' },
  { id: 'class-ss2', name: 'Senior Secondary 2', code: 'SS 2', arm: 'Science & Arts', academicSession: '2025/2026' },
  { id: 'class-ss3', name: 'Senior Secondary 3', code: 'SS 3', arm: 'Graduating Cohort', academicSession: '2025/2026' }
];

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'sub-csc', name: 'Computer Studies', code: 'CSC', department: 'Science & Tech' },
  { id: 'sub-mth', name: 'Mathematics', code: 'MTH', department: 'General Mathematics' },
  { id: 'sub-eng', name: 'English Language', code: 'ENG', department: 'Languages & Humanities' },
  { id: 'sub-phy', name: 'Physics', code: 'PHY', department: 'Pure Sciences' },
  { id: 'sub-chm', name: 'Chemistry', code: 'CHM', department: 'Pure Sciences' },
  { id: 'sub-bio', name: 'Biology', code: 'BIO', department: 'Biological Sciences' },
  { id: 'sub-eco', name: 'Economics', code: 'ECO', department: 'Commercial Studies' }
];

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  schoolName: 'PRIME EDUTECH',
  academicSession: '2025/2026',
  currentTerm: '1st Term',
  passMarkPercentage: 50,
  allowImmediateResultViewing: true
};

export const DEFAULT_STAFF: StaffMember[] = [
  {
    id: 'staff-benson',
    uniqueId: 'TCH-1001',
    fullName: 'Mr. Olawale Benson',
    email: 'benson@primeedutech.ng',
    assignedSubjectIds: ['sub-csc'],
    assignedSubjectNames: ['Computer Studies'],
    assignedClasses: ['SS 1', 'SS 2', 'SS 3'],
    role: 'hod',
    status: 'active',
    qualification: 'B.Sc. (Ed) Computer Science',
    courseOfStudy: 'Computer Science Education',
    phoneNumber: '+234 803 123 4567',
    bio: 'Head of Department, Computing & Educational Technology',
    createdAt: '2025-09-01T08:00:00.000Z'
  },
  {
    id: 'staff-adeleke',
    uniqueId: 'TCH-1002',
    fullName: 'Mrs. Folashade Adeleke',
    email: 'adeleke@primeedutech.ng',
    assignedSubjectIds: ['sub-mth'],
    assignedSubjectNames: ['Mathematics'],
    assignedClasses: ['SS 1', 'SS 2'],
    role: 'teacher',
    status: 'active',
    qualification: 'B.Sc. Mathematics, PGDE',
    courseOfStudy: 'Pure & Applied Mathematics',
    phoneNumber: '+234 802 345 6789',
    bio: 'Senior Mathematics Instructor & Continuous Assessment Coordinator',
    createdAt: '2025-09-01T08:30:00.000Z'
  },
  {
    id: 'staff-obi',
    uniqueId: 'TCH-1003',
    fullName: 'Dr. Chukwuma Obi',
    email: 'obi@primeedutech.ng',
    assignedSubjectIds: ['sub-phy', 'sub-chm'],
    assignedSubjectNames: ['Physics', 'Chemistry'],
    assignedClasses: ['SS 2', 'SS 3'],
    role: 'teacher',
    status: 'active',
    qualification: 'Ph.D Chemical Physics',
    courseOfStudy: 'Physics & Applied Chemistry',
    phoneNumber: '+234 805 678 9012',
    bio: 'Lead Faculty for Physical Sciences & STEM Laboratories',
    createdAt: '2025-09-01T09:00:00.000Z'
  }
];

export const DEFAULT_STUDENTS: Student[] = [
  {
    id: 'stu-2025-001',
    admissionNumber: 'STU/2025/001',
    firstName: 'Emmanuel',
    surname: 'Adebayo',
    fullName: 'Emmanuel Adebayo',
    classGrade: 'SS 2',
    classId: 'class-ss2',
    academicSession: '2025/2026',
    status: 'active',
    registeredAt: '2025-09-15T08:00:00.000Z',
    accessCode: 'PRM-4821'
  },
  {
    id: 'stu-2025-002',
    admissionNumber: 'STU/2025/002',
    firstName: 'Chioma',
    surname: 'Okonkwo',
    fullName: 'Chioma Okonkwo',
    classGrade: 'SS 2',
    classId: 'class-ss2',
    academicSession: '2025/2026',
    status: 'active',
    registeredAt: '2025-09-15T08:15:00.000Z',
    accessCode: 'PRM-9304'
  },
  {
    id: 'stu-2025-003',
    admissionNumber: 'STU/2025/003',
    firstName: 'Ibrahim',
    surname: 'Musa',
    fullName: 'Ibrahim Musa',
    classGrade: 'SS 2',
    classId: 'class-ss2',
    academicSession: '2025/2026',
    status: 'active',
    registeredAt: '2025-09-15T08:30:00.000Z',
    accessCode: 'PRM-7158'
  },
  {
    id: 'stu-2025-004',
    admissionNumber: 'STU/2025/004',
    firstName: 'Zainab',
    surname: 'Aliyu',
    fullName: 'Zainab Aliyu',
    classGrade: 'SS 2',
    classId: 'class-ss2',
    academicSession: '2025/2026',
    status: 'active',
    registeredAt: '2025-09-15T08:45:00.000Z',
    accessCode: 'PRM-6239'
  },
  {
    id: 'stu-2025-005',
    admissionNumber: 'STU/2025/005',
    firstName: 'David',
    surname: 'Adeleke',
    fullName: 'David Adeleke',
    classGrade: 'SS 2',
    classId: 'class-ss2',
    academicSession: '2025/2026',
    status: 'active',
    registeredAt: '2025-09-15T09:00:00.000Z',
    accessCode: 'PRM-5192'
  },
  {
    id: 'stu-2025-006',
    admissionNumber: 'STU/2025/006',
    firstName: 'Amina',
    surname: 'Bello',
    fullName: 'Amina Bello',
    classGrade: 'SS 1',
    classId: 'class-ss1',
    academicSession: '2025/2026',
    status: 'active',
    registeredAt: '2025-09-15T09:15:00.000Z',
    accessCode: 'PRM-8347'
  }
];

export const PRIMARY_EXAM_ID = 'exam-ss2-csc-first-term';
export const SECONDARY_EXAM_ID = 'exam-ss2-mth-first-term';

export const DEFAULT_EXAMINATIONS: Examination[] = [
  {
    id: PRIMARY_EXAM_ID,
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
    createdAt: '2025-10-01T08:00:00.000Z',
    updatedAt: '2025-10-01T08:00:00.000Z'
  },
  {
    id: SECONDARY_EXAM_ID,
    title: 'Senior Secondary 2 Continuous Assessment: Mathematics',
    subjectId: 'sub-mth',
    subjectName: 'Mathematics',
    classGrade: 'SS 2',
    academicSession: '2025/2026',
    term: '1st Term',
    examType: 'Continuous Assessment',
    durationMinutes: 20,
    totalQuestions: 5,
    instructions: 'Attempt all objective questions. Scratch paper calculations may be performed offline. Select your final answers using the radio buttons.',
    teacherId: 'teacher-math-dept',
    teacherName: 'Mathematics Department',
    status: 'published',
    shuffleQuestions: false,
    shuffleOptions: false,
    resultVisibility: 'immediate',
    createdAt: '2025-10-02T08:00:00.000Z',
    updatedAt: '2025-10-02T08:00:00.000Z'
  }
];

export const DEFAULT_QUESTIONS_MAP: Record<string, Question[]> = {
  [PRIMARY_EXAM_ID]: [
    {
      id: `${PRIMARY_EXAM_ID}-q1`,
      examId: PRIMARY_EXAM_ID,
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
      id: `${PRIMARY_EXAM_ID}-q2`,
      examId: PRIMARY_EXAM_ID,
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
      id: `${PRIMARY_EXAM_ID}-q3`,
      examId: PRIMARY_EXAM_ID,
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
      id: `${PRIMARY_EXAM_ID}-q4`,
      examId: PRIMARY_EXAM_ID,
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
      id: `${PRIMARY_EXAM_ID}-q5`,
      examId: PRIMARY_EXAM_ID,
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
      id: `${PRIMARY_EXAM_ID}-q6`,
      examId: PRIMARY_EXAM_ID,
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
  ],
  [SECONDARY_EXAM_ID]: [
    {
      id: `${SECONDARY_EXAM_ID}-q1`,
      examId: SECONDARY_EXAM_ID,
      questionNumber: 1,
      text: 'Solve for x in the quadratic equation: x² - 5x + 6 = 0',
      optionA: 'x = 2 or x = 3',
      optionB: 'x = -2 or x = -3',
      optionC: 'x = 1 or x = 6',
      optionD: 'x = -1 or x = -6',
      correctOption: 'A',
      subject: 'Mathematics',
      topic: 'Algebra & Quadratics',
      explanation: 'Factoring (x - 2)(x - 3) = 0 gives roots x = 2 and x = 3.'
    },
    {
      id: `${SECONDARY_EXAM_ID}-q2`,
      examId: SECONDARY_EXAM_ID,
      questionNumber: 2,
      text: 'Evaluate log₁₀(1000) - log₁₀(10):',
      optionA: '1',
      optionB: '2',
      optionC: '3',
      optionD: '100',
      correctOption: 'B',
      subject: 'Mathematics',
      topic: 'Logarithms',
      explanation: 'log₁₀(1000) = 3 and log₁₀(10) = 1. Therefore 3 - 1 = 2.'
    },
    {
      id: `${SECONDARY_EXAM_ID}-q3`,
      examId: SECONDARY_EXAM_ID,
      questionNumber: 3,
      text: 'In a right-angled triangle, if the opposite side is 3cm and the adjacent side is 4cm, find the cosine of the angle:',
      optionA: '3/5',
      optionB: '4/5',
      optionC: '3/4',
      optionD: '5/4',
      correctOption: 'B',
      subject: 'Mathematics',
      topic: 'Trigonometry',
      explanation: 'Hypotenuse = √(3² + 4²) = 5. Cosine = Adjacent / Hypotenuse = 4/5.'
    },
    {
      id: `${SECONDARY_EXAM_ID}-q4`,
      examId: SECONDARY_EXAM_ID,
      questionNumber: 4,
      text: 'Find the mean of the data set: 12, 16, 20, 24, 28:',
      optionA: '18',
      optionB: '20',
      optionC: '22',
      optionD: '24',
      correctOption: 'B',
      subject: 'Mathematics',
      topic: 'Statistics',
      explanation: 'Sum = 100. Count = 5. Mean = 100 / 5 = 20.'
    },
    {
      id: `${SECONDARY_EXAM_ID}-q5`,
      examId: SECONDARY_EXAM_ID,
      questionNumber: 5,
      text: 'If the probability of rain tomorrow is 0.35, what is the probability that it will NOT rain?',
      optionA: '0.35',
      optionB: '0.50',
      optionC: '0.65',
      optionD: '0.70',
      correctOption: 'C',
      subject: 'Mathematics',
      topic: 'Probability',
      explanation: 'P(not rain) = 1 - P(rain) = 1 - 0.35 = 0.65.'
    }
  ]
};
