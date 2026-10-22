import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  BookOpen,
  FileSpreadsheet,
  Users,
  GraduationCap,
  School,
  Settings,
  Plus,
  Trash2,
  Edit3,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Eye,
  LogOut,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  FileText,
  Calendar,
  Printer,
  Copy,
  Check,
  User,
  Clock,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { StudentBatchUploadModal } from './StudentBatchUploadModal';
import { StudentSlipsModal } from './StudentSlipsModal';
import { ContinuousAssessmentSheet } from './ContinuousAssessmentSheet';
import { TeacherProfileSection } from './TeacherProfileSection';
import {
  Examination,
  Question,
  Student,
  Submission,
  SchoolClass,
  Subject,
  SchoolSettings,
  calculateGrade,
  generateStudentAccessCode,
  StaffMember,
  checkExamTimeWindow
} from '../../types/cbt';
import {
  fetchExaminations,
  saveExamination,
  deleteExamination,
  fetchQuestions,
  saveQuestion,
  deleteQuestion,
  fetchStudents,
  saveStudent,
  deleteStudent,
  fetchSchoolClasses,
  saveSchoolClass,
  deleteSchoolClass,
  fetchSubjects,
  saveSubject,
  deleteSubject,
  fetchSchoolSettings,
  saveSchoolSettings,
  fetchSubmissions,
  logoutTeacher
} from '../../services/firebase';

interface TeacherPortalProps {
  teacherEmail: string;
  teacherStaff?: StaffMember | null;
  currentSubroute?: string;
  onNavigateSubroute?: (subroute: string) => void;
  onLogout: () => void;
  onGoToStudentPortal: () => void;
}

export const TeacherPortal: React.FC<TeacherPortalProps> = ({
  teacherEmail,
  teacherStaff,
  currentSubroute = '/teacher/dashboard',
  onNavigateSubroute,
  onLogout,
  onGoToStudentPortal
}) => {
  // Active staff state with dynamic profile synchronization
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(teacherStaff || null);

  useEffect(() => {
    if (teacherStaff) {
      setActiveStaff(teacherStaff);
    }
  }, [teacherStaff]);

  const handleProfileUpdated = (updated: StaffMember) => {
    setActiveStaff(updated);
    try {
      sessionStorage.setItem('prime_edutech_active_teacher', JSON.stringify(updated));
    } catch {}
  };

  // Determine active tab from subroute
  const getTabFromRoute = (route: string) => {
    if (route.includes('/assessment-sheet') || route.includes('/assessment') || route.includes('/gradebook')) return 'assessment-sheet';
    if (route.includes('/profile') || route.includes('/security') || route.includes('/credentials')) return 'profile';
    if (route.includes('/examinations')) return 'examinations';
    if (route.includes('/questions')) return 'questions';
    if (route.includes('/students')) return 'students';
    if (route.includes('/subjects')) return 'subjects';
    if (route.includes('/classes')) return 'classes';
    if (route.includes('/results')) return 'results';
    if (route.includes('/analytics')) return 'analytics';
    if (route.includes('/settings')) return 'settings';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<string>(getTabFromRoute(currentSubroute));

  // Sync with prop
  useEffect(() => {
    setActiveTab(getTabFromRoute(currentSubroute));
  }, [currentSubroute]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (onNavigateSubroute) {
      onNavigateSubroute(`/teacher/${tab}`);
    }
  };

  // State
  const [exams, setExams] = useState<Examination[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: 'PRIME EDUTECH',
    academicSession: '2025/2026',
    currentTerm: '1st Term',
    passMarkPercentage: 50,
    allowImmediateResultViewing: true
  });
  const [loading, setLoading] = useState(false);

  // Filter and Inspection States
  const [resultClassFilter, setResultClassFilter] = useState<string>('all');
  const [resultSubjectFilter, setResultSubjectFilter] = useState<string>('all');
  const [resultSearchQuery, setResultSearchQuery] = useState<string>('');

  const [studentClassFilter, setStudentClassFilter] = useState<string>('all');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [inspectingStudent, setInspectingStudent] = useState<Student | null>(null);

  const [editingTimeframeExam, setEditingTimeframeExam] = useState<Examination | null>(null);
  const [timeframeForm, setTimeframeForm] = useState<{ startDate: string; endDate: string }>({
    startDate: '',
    endDate: ''
  });

  // Teacher's authorized subjects
  const authorizedSubjects = useMemo(() => {
    if (!activeStaff || !activeStaff.assignedSubjectNames || activeStaff.assignedSubjectNames.length === 0) {
      return subjects;
    }
    return subjects.filter(
      s => activeStaff.assignedSubjectNames.includes(s.name) ||
           (activeStaff.assignedSubjectIds && activeStaff.assignedSubjectIds.includes(s.id))
    );
  }, [subjects, activeStaff]);

  // Teacher's authorized exams
  const authorizedExams = useMemo(() => {
    if (!activeStaff || !activeStaff.assignedSubjectNames || activeStaff.assignedSubjectNames.length === 0) {
      return exams;
    }
    return exams.filter(
      e => activeStaff.assignedSubjectNames.includes(e.subjectName) ||
           (activeStaff.assignedSubjectIds && activeStaff.assignedSubjectIds.includes(e.subjectId)) ||
           e.teacherId === activeStaff.uniqueId ||
           e.teacherId === activeStaff.email
    );
  }, [exams, activeStaff]);

  // Teacher's authorized classes & students
  const authorizedClasses = useMemo(() => {
    if (!activeStaff || !activeStaff.assignedClasses || activeStaff.assignedClasses.length === 0) {
      return classes;
    }
    return classes.filter(c => activeStaff.assignedClasses.includes(c.code));
  }, [classes, activeStaff]);

  const authorizedStudents = useMemo(() => {
    if (!activeStaff || !activeStaff.assignedClasses || activeStaff.assignedClasses.length === 0) {
      return students;
    }
    return students.filter(s => activeStaff.assignedClasses.includes(s.classGrade));
  }, [students, activeStaff]);

  // Teacher's authorized results/submissions
  const authorizedSubmissions = useMemo(() => {
    if (!activeStaff || !activeStaff.assignedSubjectNames || activeStaff.assignedSubjectNames.length === 0) {
      return submissions;
    }
    const authorizedExamIds = new Set(authorizedExams.map(e => e.id));
    const lowerSubjs = new Set(activeStaff.assignedSubjectNames.map(s => s.toLowerCase()));
    return submissions.filter(sub => {
      if (authorizedExamIds.has(sub.examId)) return true;
      if (sub.subject && lowerSubjs.has(sub.subject.toLowerCase())) return true;
      return false;
    });
  }, [submissions, activeStaff, authorizedExams]);

  // Modals
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showUploadStudentModal, setShowUploadStudentModal] = useState(false);
  const [showStudentSlipsModal, setShowStudentSlipsModal] = useState(false);
  const [copiedStudentCode, setCopiedStudentCode] = useState<string | null>(null);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);

  // Forms
  const [examForm, setExamForm] = useState<Partial<Examination>>({
    title: '',
    subjectId: '',
    subjectName: '',
    classGrade: 'SS 2',
    academicSession: '2025/2026',
    term: '1st Term',
    examType: 'Mid-Term Test',
    durationMinutes: 15,
    totalQuestions: 10,
    instructions: 'Select the most accurate option from A to D. Ensure you conclude your paper before the countdown timer reaches zero.',
    status: 'published',
    startDate: '',
    endDate: '',
    shuffleQuestions: true,
    shuffleOptions: false,
    resultVisibility: 'immediate'
  });

  const [questionForm, setQuestionForm] = useState<Partial<Question>>({
    questionNumber: 1,
    text: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'A',
    subject: '',
    topic: 'General Concepts',
    explanation: ''
  });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const [studentForm, setStudentForm] = useState({
    firstName: '',
    surname: '',
    admissionNumber: '',
    classGrade: 'SS 2'
  });

  const [classForm, setClassForm] = useState({
    name: '',
    code: '',
    arm: 'A'
  });

  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    department: 'Science & Tech'
  });

  // CSV
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<Partial<Question>[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Initial Load
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fetchedExams, fetchedClasses, fetchedSubjects, fetchedStudents, fetchedSubs, fetchedSettings] =
        await Promise.all([
          fetchExaminations(false),
          fetchSchoolClasses(),
          fetchSubjects(),
          fetchStudents(),
          fetchSubmissions(),
          fetchSchoolSettings()
        ]);

      if (fetchedExams) {
        setExams(fetchedExams);
        if (fetchedExams.length > 0 && !selectedExamId) {
          setSelectedExamId(fetchedExams[0].id);
        }
      }
      if (fetchedClasses) setClasses(fetchedClasses);
      if (fetchedSubjects) setSubjects(fetchedSubjects);
      if (fetchedStudents) setStudents(fetchedStudents);
      if (fetchedSubs) setSubmissions(fetchedSubs);
      if (fetchedSettings) setSettings(fetchedSettings);
    } catch (err) {
      console.warn('Teacher data load warning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // When selected exam changes, fetch questions
  useEffect(() => {
    if (selectedExamId) {
      fetchQuestions(selectedExamId).then((qs) => {
        if (qs) setQuestions(qs);
      });
    }
  }, [selectedExamId]);

  // Exam actions
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    const newExamId = `exam-${Date.now()}`;
    const subjectObj = authorizedSubjects.find(s => s.id === examForm.subjectId) || authorizedSubjects[0] || subjects[0];

    const examData: Examination = {
      id: newExamId,
      title: examForm.title || `${examForm.classGrade} ${subjectObj?.name || 'Examination'}`,
      subjectId: subjectObj?.id || 'sub-gen',
      subjectName: subjectObj?.name || 'General Subject',
      classGrade: examForm.classGrade || 'SS 2',
      academicSession: examForm.academicSession || settings.academicSession,
      term: ((examForm.term || settings.currentTerm) as '1st Term' | '2nd Term' | '3rd Term') || '1st Term',
      examType: examForm.examType || 'Mid-Term Test',
      durationMinutes: Number(examForm.durationMinutes) || 15,
      totalQuestions: Number(examForm.totalQuestions) || 10,
      instructions: examForm.instructions || 'Answer all objective questions.',
      teacherId: activeStaff?.uniqueId || teacherEmail,
      teacherName: activeStaff?.fullName || teacherEmail.split('@')[0],
      status: (examForm.status as 'draft' | 'published' | 'archived') || 'published',
      startDate: examForm.startDate ? examForm.startDate : undefined,
      endDate: examForm.endDate ? examForm.endDate : undefined,
      shuffleQuestions: Boolean(examForm.shuffleQuestions),
      shuffleOptions: Boolean(examForm.shuffleOptions),
      resultVisibility: (examForm.resultVisibility as 'immediate' | 'teacher_publish') || 'immediate',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveExamination(examData);
    setExams(prev => [examData, ...prev]);
    setSelectedExamId(examData.id);
    setShowCreateExamModal(false);
  };

  const handleOpenTimeframeModal = (exam: Examination) => {
    setEditingTimeframeExam(exam);
    setTimeframeForm({
      startDate: exam.startDate || '',
      endDate: exam.endDate || ''
    });
  };

  const handleSaveTimeframe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTimeframeExam) return;
    const updated: Examination = {
      ...editingTimeframeExam,
      startDate: timeframeForm.startDate ? timeframeForm.startDate : undefined,
      endDate: timeframeForm.endDate ? timeframeForm.endDate : undefined,
      updatedAt: new Date().toISOString()
    };
    await saveExamination(updated);
    setExams(prev => prev.map(e => e.id === updated.id ? updated : e));
    setEditingTimeframeExam(null);
  };

  const handleTogglePublish = async (exam: Examination) => {
    const nextStatus: 'draft' | 'published' = exam.status === 'published' ? 'draft' : 'published';
    const updated: Examination = { ...exam, status: nextStatus, updatedAt: new Date().toISOString() };
    await saveExamination(updated);
    setExams(prev => prev.map(e => e.id === exam.id ? updated : e));
  };

  const handleDeleteExam = async (examId: string) => {
    if (confirm('Delete this examination and all its associated questions?')) {
      await deleteExamination(examId);
      setExams(prev => prev.filter(e => e.id !== examId));
      if (selectedExamId === examId) {
        setSelectedExamId(exams.find(e => e.id !== examId)?.id || '');
      }
    }
  };

  // Question actions
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId) return;

    const targetExam = exams.find(e => e.id === selectedExamId);
    const qId = editingQuestionId || `q-${Date.now()}`;
    const qNumber = Number(questionForm.questionNumber) || questions.length + 1;

    const newQ: Question = {
      id: qId,
      examId: selectedExamId,
      questionNumber: qNumber,
      text: questionForm.text || '',
      optionA: questionForm.optionA || '',
      optionB: questionForm.optionB || '',
      optionC: questionForm.optionC || '',
      optionD: questionForm.optionD || '',
      correctOption: (questionForm.correctOption as 'A' | 'B' | 'C' | 'D') || 'A',
      subject: targetExam?.subjectName || 'General',
      topic: questionForm.topic || 'General Concepts',
      explanation: questionForm.explanation || ''
    };

    await saveQuestion(selectedExamId, newQ);

    setQuestions(prev => {
      const filtered = prev.filter(q => q.id !== qId);
      return [...filtered, newQ].sort((a, b) => a.questionNumber - b.questionNumber);
    });

    setShowAddQuestionModal(false);
    setEditingQuestionId(null);
    setQuestionForm({
      questionNumber: questions.length + 2,
      text: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOption: 'A',
      subject: targetExam?.subjectName || '',
      topic: 'General Concepts',
      explanation: ''
    });
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      await deleteQuestion(selectedExamId, qId);
      setQuestions(prev => prev.filter(q => q.id !== qId));
    }
  };

  // CSV Import
  const handleParseCsv = (text: string) => {
    setCsvText(text);
    setCsvError(null);

    try {
      const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        setCsvError('CSV must include header row and at least one question row.');
        setCsvPreview([]);
        return;
      }

      const rows: Partial<Question>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());

        if (cols.length >= 7) {
          const qNum = parseInt(cols[0], 10) || i;
          const text = cols[1];
          const optionA = cols[2];
          const optionB = cols[3];
          const optionC = cols[4];
          const optionD = cols[5];
          const correctOption = cols[6].toUpperCase() as 'A' | 'B' | 'C' | 'D';
          const explanation = cols[7] || '';
          const subject = cols[8] || '';
          const topic = cols[9] || 'General Concepts';

          if (['A', 'B', 'C', 'D'].includes(correctOption)) {
            rows.push({
              questionNumber: qNum,
              text,
              optionA,
              optionB,
              optionC,
              optionD,
              correctOption,
              explanation,
              subject,
              topic
            });
          }
        }
      }

      if (rows.length === 0) {
        setCsvError('No valid questions found. Header must be: questionNumber,text,optionA,optionB,optionC,optionD,correctOption,explanation,subject,topic');
      }
      setCsvPreview(rows);
    } catch (err) {
      setCsvError('Failed to parse CSV format.');
    }
  };

  const handleImportCsvQuestions = async () => {
    if (!selectedExamId || csvPreview.length === 0) return;
    const targetExam = exams.find(e => e.id === selectedExamId);

    for (const item of csvPreview) {
      const qId = `q-csv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const q: Question = {
        id: qId,
        examId: selectedExamId,
        questionNumber: item.questionNumber || 1,
        text: item.text || '',
        optionA: item.optionA || '',
        optionB: item.optionB || '',
        optionC: item.optionC || '',
        optionD: item.optionD || '',
        correctOption: item.correctOption || 'A',
        explanation: item.explanation || '',
        subject: item.subject || targetExam?.subjectName || 'General',
        topic: item.topic || 'General Concepts'
      };
      await saveQuestion(selectedExamId, q);
    }

    const updated = await fetchQuestions(selectedExamId);
    setQuestions(updated);
    setShowCsvImportModal(false);
    setCsvText('');
    setCsvPreview([]);
  };

  // CSV Export for Questions (Allows Excel Editing and Re-upload)
  const handleExportQuestionsCsv = () => {
    if (questions.length === 0) {
      alert('No questions in this examination to export.');
      return;
    }

    const headers = ['questionNumber', 'text', 'optionA', 'optionB', 'optionC', 'optionD', 'correctOption', 'explanation', 'subject', 'topic'];
    const rows = questions.map(q => [
      q.questionNumber,
      `"${q.text.replace(/"/g, '""')}"`,
      `"${q.optionA.replace(/"/g, '""')}"`,
      `"${q.optionB.replace(/"/g, '""')}"`,
      `"${q.optionC.replace(/"/g, '""')}"`,
      `"${q.optionD.replace(/"/g, '""')}"`,
      `"${q.correctOption}"`,
      `"${(q.explanation || '').replace(/"/g, '""')}"`,
      `"${(q.subject || '').replace(/"/g, '""')}"`,
      `"${(q.topic || 'General Concepts').replace(/"/g, '""')}"`
    ].join(','));

    const csvData = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `questions_${selectedExam?.title || 'exam'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSampleQuestionsCsv = () => {
    const csvContent =
      'questionNumber,text,optionA,optionB,optionC,optionD,correctOption,explanation,subject,topic\n' +
      '1,"What computer component coordinates instruction execution cycles?","ALU","Control Unit","RAM","Hard Disk","B","The Control Unit manages processor instruction execution cycles.","Computer Studies","CPU Architecture"\n' +
      '2,"Which topology has all nodes connected to a continuous central cable?","Star","Bus","Ring","Mesh","B","Bus topology connects all devices to a single central backbone cable.","Computer Studies","Networking"\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'prime_cbt_question_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Student actions
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const newStudent: Student = {
      id: `stu-${Date.now()}`,
      admissionNumber: studentForm.admissionNumber.trim().toUpperCase(),
      firstName: studentForm.firstName.trim(),
      surname: studentForm.surname.trim(),
      fullName: `${studentForm.firstName.trim()} ${studentForm.surname.trim()}`,
      classGrade: studentForm.classGrade,
      academicSession: settings.academicSession,
      status: 'active',
      registeredAt: new Date().toISOString(),
      accessCode: generateStudentAccessCode(students.map(s => s.accessCode || ''))
    };

    await saveStudent(newStudent);
    setStudents(prev => [newStudent, ...prev]);
    setShowAddStudentModal(false);
    setStudentForm({ firstName: '', surname: '', admissionNumber: '', classGrade: 'SS 2' });
  };

  const handleDeleteStudent = async (stdId: string) => {
    if (confirm('Delete student record from directory?')) {
      await deleteStudent(stdId);
      setStudents(prev => prev.filter(s => s.id !== stdId));
    }
  };

  // Academic Session & Term Handlers (decide or select term/session)
  const handleUpdateSession = async (newSession: string) => {
    const updated = { ...settings, academicSession: newSession };
    setSettings(updated);
    try {
      await saveSchoolSettings(updated);
    } catch (err) {
      console.warn('Error saving academic session:', err);
    }
  };

  const handleUpdateTerm = async (newTerm: '1st Term' | '2nd Term' | '3rd Term') => {
    const updated = { ...settings, currentTerm: newTerm };
    setSettings(updated);
    try {
      await saveSchoolSettings(updated);
    } catch (err) {
      console.warn('Error saving academic term:', err);
    }
  };

  // Batch upload completion
  const handleBatchUploadSuccess = (newStudents: Student[]) => {
    setStudents(prev => [...newStudents, ...prev]);
    setShowStudentSlipsModal(true);
  };

  // Export Student Credentials CSV
  const handleExportStudentCodesCsv = () => {
    if (authorizedStudents.length === 0) {
      alert('No students found for your assigned classes to export.');
      return;
    }
    const headers = ['Full Name', 'Class Form', 'Admission Number', 'Unique Login ID / Code', 'Session'];
    const rows = authorizedStudents.map(s => [
      `"${s.fullName}"`,
      `"${s.classGrade}"`,
      `"${s.admissionNumber}"`,
      `"${s.accessCode || s.admissionNumber}"`,
      `"${s.academicSession || settings.academicSession}"`
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prime_edutech_student_codes_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy code helper
  const handleCopyStudentCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedStudentCode(code);
    setTimeout(() => setCopiedStudentCode(null), 2000);
  };

  // Class actions
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const newClass: SchoolClass = {
      id: `class-${Date.now()}`,
      name: classForm.name,
      code: classForm.code || classForm.name,
      arm: classForm.arm,
      academicSession: settings.academicSession
    };
    await saveSchoolClass(newClass);
    setClasses(prev => [...prev, newClass]);
    setShowAddClassModal(false);
    setClassForm({ name: '', code: '', arm: 'A' });
  };

  // Subject actions
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSub: Subject = {
      id: `sub-${Date.now()}`,
      name: subjectForm.name,
      code: subjectForm.code || subjectForm.name.slice(0, 3).toUpperCase(),
      department: subjectForm.department
    };
    await saveSubject(newSub);
    setSubjects(prev => [...prev, newSub]);
    setShowAddSubjectModal(false);
    setSubjectForm({ name: '', code: '', department: 'Science & Tech' });
  };

  // Results Export for Excel
  const handleExportResultsCsv = () => {
    if (authorizedSubmissions.length === 0) {
      alert('No student submissions to export.');
      return;
    }

    const headers = [
      'Candidate Name',
      'Admission Number',
      'Class Form',
      'Subject',
      'Examination Title',
      'Score',
      'Total Questions',
      'Percentage (%)',
      'Grade',
      'Time Taken (Mins)',
      'Submission Timestamp'
    ];

    const rows = authorizedSubmissions.map(sub => {
      const g = calculateGrade(sub.percentage);
      const mins = (sub.timeSpentSeconds / 60).toFixed(1);
      return [
        `"${sub.studentName}"`,
        `"${sub.admissionNumber}"`,
        `"${sub.classGrade}"`,
        `"${sub.subject}"`,
        `"${sub.examTitle}"`,
        sub.score,
        sub.totalQuestions,
        sub.percentage,
        `"${g.grade} (${g.remark})"`,
        mins,
        `"${sub.submittedAt}"`
      ].join(',');
    });

    const csvData = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prime_cbt_school_results_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Analytics Computation (Intelligent Assessment for Teacher Scope)
  const totalSubmissions = authorizedSubmissions.length;
  const avgPercentage = totalSubmissions > 0
    ? Math.round(authorizedSubmissions.reduce((a, b) => a + b.percentage, 0) / totalSubmissions)
    : 0;
  const passRate = totalSubmissions > 0
    ? Math.round((authorizedSubmissions.filter(s => s.percentage >= (settings.passMarkPercentage || 50)).length / totalSubmissions) * 100)
    : 0;

  // Topic Level Aggregate Assessment
  const topicAggregateMap: Record<string, { total: number; correct: number; subject: string }> = {};
  authorizedSubmissions.forEach(sub => {
    if (sub.detailedResults) {
      sub.detailedResults.forEach(item => {
        const t = item.topic || 'General Concepts';
        if (!topicAggregateMap[t]) {
          topicAggregateMap[t] = { total: 0, correct: 0, subject: sub.subject };
        }
        topicAggregateMap[t].total += 1;
        if (item.isCorrect) {
          topicAggregateMap[t].correct += 1;
        }
      });
    }
  });

  const topicAssessments = Object.entries(topicAggregateMap).map(([topic, stat]) => ({
    topic,
    subject: stat.subject,
    total: stat.total,
    correct: stat.correct,
    percentage: Math.round((stat.correct / stat.total) * 100)
  })).sort((a, b) => a.percentage - b.percentage);

  // Difficult questions (failure rate > 60% = accuracy < 40%)
  const difficultQuestionsMap: Record<string, { text: string; total: number; wrong: number; topic: string }> = {};
  authorizedSubmissions.forEach(sub => {
    if (sub.detailedResults) {
      sub.detailedResults.forEach(item => {
        const key = item.questionText;
        if (!difficultQuestionsMap[key]) {
          difficultQuestionsMap[key] = { text: item.questionText, total: 0, wrong: 0, topic: item.topic || 'General' };
        }
        difficultQuestionsMap[key].total += 1;
        if (!item.isCorrect) {
          difficultQuestionsMap[key].wrong += 1;
        }
      });
    }
  });

  const difficultQuestions = Object.values(difficultQuestionsMap)
    .filter(q => q.total >= 1 && (q.wrong / q.total) >= 0.5)
    .sort((a, b) => (b.wrong / b.total) - (a.wrong / a.total));

  // Filtered submissions based on class, subject, and candidate search
  const filteredSubmissions = useMemo(() => {
    return authorizedSubmissions.filter(sub => {
      if (resultClassFilter !== 'all' && sub.classGrade !== resultClassFilter) return false;
      if (resultSubjectFilter !== 'all' && sub.subject?.toLowerCase() !== resultSubjectFilter.toLowerCase()) return false;
      if (resultSearchQuery.trim()) {
        const q = resultSearchQuery.toLowerCase();
        const matchName = sub.studentName?.toLowerCase().includes(q);
        const matchAdm = sub.admissionNumber?.toLowerCase().includes(q);
        if (!matchName && !matchAdm) return false;
      }
      return true;
    });
  }, [authorizedSubmissions, resultClassFilter, resultSubjectFilter, resultSearchQuery]);

  // Filtered students based on class and candidate search
  const filteredStudents = useMemo(() => {
    return authorizedStudents.filter(std => {
      if (studentClassFilter !== 'all' && std.classGrade !== studentClassFilter) return false;
      if (studentSearchQuery.trim()) {
        const q = studentSearchQuery.toLowerCase();
        const matchName = std.fullName?.toLowerCase().includes(q);
        const matchAdm = std.admissionNumber?.toLowerCase().includes(q);
        const matchCode = std.accessCode?.toLowerCase().includes(q);
        if (!matchName && !matchAdm && !matchCode) return false;
      }
      return true;
    });
  }, [authorizedStudents, studentClassFilter, studentSearchQuery]);

  const selectedExam = authorizedExams.find(e => e.id === selectedExamId) || authorizedExams[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Teacher Navigation Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto text-xs font-semibold py-1">
              <button
                onClick={() => handleTabChange('dashboard')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'dashboard' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Dashboard
              </button>

              {/* Assessment Broad Sheet Tab */}
              <button
                onClick={() => handleTabChange('assessment-sheet')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 font-bold ${
                  activeTab === 'assessment-sheet'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />
                <span>CA Broad Sheet (40/60)</span>
              </button>

              <button
                onClick={() => handleTabChange('examinations')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'examinations' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Examinations ({authorizedExams.length})
              </button>

              <button
                onClick={() => handleTabChange('questions')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'questions' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Question Bank
              </button>

              <button
                onClick={() => handleTabChange('students')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'students' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Students ({authorizedStudents.length})
              </button>

              <button
                onClick={() => handleTabChange('results')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'results' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Results ({authorizedSubmissions.length})
              </button>

              <button
                onClick={() => handleTabChange('classes')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'classes' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Classes ({authorizedClasses.length})
              </button>

              <button
                onClick={() => handleTabChange('subjects')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'subjects' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Subjects ({authorizedSubjects.length})
              </button>

              <button
                onClick={() => handleTabChange('analytics')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'analytics' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Topic Analytics
              </button>

              {/* Faculty Profile & Security Tab */}
              <button
                onClick={() => handleTabChange('profile')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'profile' ? 'bg-blue-900 text-white font-bold' : 'text-blue-900 hover:bg-blue-50'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>My Profile & Password</span>
              </button>

              <button
                onClick={() => handleTabChange('settings')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'settings' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Settings
              </button>
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={onGoToStudentPortal}
                className="text-xs text-blue-900 hover:underline font-semibold"
              >
                Switch to Student Portal →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Academic Session & Term Control Strip (Teacher Decides/Selects) */}
      <div className="bg-slate-900 text-white border-b border-slate-800 py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Calendar className="w-4 h-4" />
              <span>Active Academic Window:</span>
            </div>

            {/* Session Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700">
              <span className="text-slate-400 text-[11px] font-semibold">Session:</span>
              <select
                value={settings.academicSession}
                onChange={(e) => handleUpdateSession(e.target.value)}
                className="bg-transparent text-white font-mono font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="2023/2024" className="bg-slate-900 text-white">2023/2024</option>
                <option value="2024/2025" className="bg-slate-900 text-white">2024/2025</option>
                <option value="2025/2026" className="bg-slate-900 text-white">2025/2026</option>
                <option value="2026/2027" className="bg-slate-900 text-white">2026/2027</option>
                <option value="2027/2028" className="bg-slate-900 text-white">2027/2028</option>
              </select>
            </div>

            {/* Term Selector Buttons */}
            <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700">
              {(['1st Term', '2nd Term', '3rd Term'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleUpdateTerm(t)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    settings.currentTerm === t
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active: <strong>{settings.academicSession} · {settings.currentTerm}</strong> (All papers & enrolments adapt to this term)</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* SUBROUTE 1: OVERVIEW DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Faculty Teacher Identity Card */}
            {activeStaff && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  {activeStaff.avatarUrl ? (
                    <img
                      src={activeStaff.avatarUrl}
                      alt={activeStaff.fullName}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-md ring-2 ring-slate-100 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-black text-2xl shadow-md border border-slate-800 shrink-0">
                      {activeStaff.fullName.charAt(0)}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-black text-slate-900">{activeStaff.fullName}</h1>
                      <span className="text-[10px] uppercase font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {activeStaff.role.toUpperCase()}
                      </span>
                      {activeStaff.password ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Password Protected
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-600" />
                          Password Unset
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {activeStaff.qualification && (
                        <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          🎓 {activeStaff.qualification}
                        </span>
                      )}
                      {activeStaff.courseOfStudy && (
                        <span className="text-slate-600 text-[11px]">
                          Discipline: <strong>{activeStaff.courseOfStudy}</strong>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Staff ID: <strong className="text-slate-900">{activeStaff.uniqueId}</strong></span>
                      <span>·</span>
                      <span>Assigned Subject: <strong className="text-blue-900">{activeStaff.assignedSubjectNames.join(', ')}</strong></span>
                      <span>·</span>
                      <span>Classes: <strong className="text-slate-700">{activeStaff.assignedClasses.join(', ')}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleTabChange('profile')}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>Edit Profile & Password</span>
                  </button>

                  <button
                    onClick={() => handleTabChange('assessment-sheet')}
                    className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>CA Broad Sheet</span>
                  </button>
                </div>
              </div>
            )}

            {/* KPI Cards Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Enrolled Students
                </span>
                <div className="text-3xl font-black font-mono text-slate-900 mt-1">{authorizedStudents.length}</div>
                <div className="text-xs text-slate-500 mt-1">Across {authorizedClasses.length} assigned class cohorts</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Active Examinations
                </span>
                <div className="text-3xl font-black font-mono text-blue-900 mt-1">
                  {authorizedExams.filter(e => e.status === 'published').length}
                </div>
                <div className="text-xs text-slate-500 mt-1">Published for your subjects</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Completed Submissions
                </span>
                <div className="text-3xl font-black font-mono text-emerald-700 mt-1">{authorizedSubmissions.length}</div>
                <div className="text-xs text-slate-500 mt-1">For your examination papers</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Overall Pass Rate
                </span>
                <div className="text-3xl font-black font-mono text-slate-900 mt-1">{passRate}%</div>
                <div className="text-xs text-slate-500 mt-1">Scores ≥ {settings.passMarkPercentage}% benchmark</div>
              </div>
            </div>

            {/* Quick Actions & Recent Examinations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Recent Examinations
                  </h2>
                  <button
                    onClick={() => handleTabChange('examinations')}
                    className="text-xs font-semibold text-blue-900 hover:underline"
                  >
                    View All →
                  </button>
                </div>

                {authorizedExams.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No examinations created yet. Click "New Examination" to start.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {authorizedExams.slice(0, 5).map(e => (
                      <div key={e.id} className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-bold text-slate-900">{e.title}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {e.subjectName} · {e.classGrade} · {e.durationMinutes} Mins · {e.totalQuestions} Qs
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              e.status === 'published'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {e.status}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedExamId(e.id);
                              handleTabChange('questions');
                            }}
                            className="text-xs font-semibold text-blue-900 hover:underline"
                          >
                            Questions →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions Panel */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
                  Quick Administration
                </h2>

                <button
                  onClick={() => handleTabChange('assessment-sheet')}
                  className="w-full py-2.5 px-3 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-bold transition-colors flex items-center justify-between shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-slate-950" />
                    <span>CA Broad Sheet (Entry & Sync)</span>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setShowCreateExamModal(true)}
                  className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-between"
                >
                  <span>New Examination</span>
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setShowAddStudentModal(true)}
                  className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-between"
                >
                  <span>Register Student</span>
                  <Users className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={() => {
                    handleTabChange('questions');
                    setShowCsvImportModal(true);
                  }}
                  className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-between"
                >
                  <span>Import Questions from CSV</span>
                  <Upload className="w-4 h-4 text-blue-700" />
                </button>

                <button
                  onClick={handleExportResultsCsv}
                  className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold transition-colors flex items-center justify-between"
                >
                  <span>Export Results to CSV (Excel)</span>
                  <Download className="w-4 h-4 text-emerald-700" />
                </button>

                <button
                  onClick={() => handleTabChange('profile')}
                  className="w-full py-2.5 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-800" />
                    <span>Profile & Password Reset</span>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUBROUTE 2: EXAMINATIONS */}
        {activeTab === 'examinations' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Curriculum Examinations</h2>
                <p className="text-xs text-slate-500">
                  Configure schedules, time limits, instructions, and publish papers for class cohorts
                </p>
              </div>

              <button
                onClick={() => setShowCreateExamModal(true)}
                className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Examination</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {authorizedExams.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                  <div className="text-sm font-bold text-slate-700">No Examinations Found for Your Subjects</div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {teacherStaff && teacherStaff.assignedSubjectNames.length > 0
                      ? `You are assigned to: ${teacherStaff.assignedSubjectNames.join(', ')}. Create an examination for your curriculum to get started.`
                      : 'No examinations created yet. Click "Create Examination" above to build your first paper.'}
                  </p>
                </div>
              ) : (
                authorizedExams.map(exam => {
                  const windowStatus = checkExamTimeWindow(exam);
                  return (
                    <div
                      key={exam.id}
                      className={`bg-white rounded-2xl border p-5 shadow-sm transition-all flex flex-col justify-between ${
                        exam.id === selectedExamId ? 'border-blue-900 ring-1 ring-blue-900' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        {/* Status Badges & Subject/Class Form */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-[11px] font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {exam.subjectName} · {exam.classGrade}
                          </span>
                          <button
                            onClick={() => handleTogglePublish(exam)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                              exam.status === 'published'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                            }`}
                            title="Click to toggle publish status"
                          >
                            {exam.status === 'published' ? '● Published' : '○ Draft (Unpublished)'}
                          </button>
                        </div>

                        {/* Exam Live Schedule Window Badge */}
                        <div className="mb-3">
                          {windowStatus.code === 'published_open' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              Exam Window Open to Students
                            </span>
                          )}
                          {windowStatus.code === 'not_yet_started' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-700" />
                              Scheduled · Opens {windowStatus.startDateFormatted}
                            </span>
                          )}
                          {windowStatus.code === 'closed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              Exam Window Closed · Submissions Ended
                            </span>
                          )}
                          {windowStatus.code === 'unpublished' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Draft · Unpublished (Hidden from Candidates)
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 mb-1">{exam.title}</h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{exam.instructions}</p>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl mb-3 font-mono">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">DURATION</span>
                            <strong className="text-slate-900">{exam.durationMinutes} Mins</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">TARGET Qs</span>
                            <strong className="text-slate-900">{exam.totalQuestions} Questions</strong>
                          </div>
                        </div>

                        {/* Schedule Time Frame Display */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 mb-3 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-slate-500 font-semibold text-[10px] uppercase">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Examination Time Frame
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenTimeframeModal(exam)}
                              className="text-blue-900 hover:underline font-bold"
                            >
                              Edit Schedule
                            </button>
                          </div>
                          <div className="text-slate-700 font-mono text-[11px] space-y-0.5">
                            <div>
                              <span className="text-slate-400">Start: </span>
                              <span className="font-semibold">{exam.startDate ? new Date(exam.startDate).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'Immediate (Anytime)'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Close: </span>
                              <span className="font-semibold">{exam.endDate ? new Date(exam.endDate).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'Open-Ended (No close)'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                        <button
                          onClick={() => {
                            setSelectedExamId(exam.id);
                            handleTabChange('questions');
                          }}
                          className="text-blue-900 hover:underline font-bold"
                        >
                          Manage Questions ({questions.filter(q => q.examId === exam.id).length}) →
                        </button>
                        <button
                          onClick={() => handleDeleteExam(exam.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete examination"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* SUBROUTE 3: QUESTION BANK & CSV IMPORT/EXPORT */}
        {activeTab === 'questions' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                  Active Examination Question Bank
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {authorizedExams.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.classGrade} · {ex.subjectName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportQuestionsCsv}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm"
                  title="Download all questions as CSV to edit in Microsoft Excel"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Download Questions CSV</span>
                </button>

                <button
                  onClick={() => setShowCsvImportModal(true)}
                  className="px-3 py-2 text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5 shadow-sm"
                  title="Upload CSV question bank from Excel"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import via CSV</span>
                </button>

                <button
                  onClick={() => {
                    setEditingQuestionId(null);
                    setQuestionForm({
                      questionNumber: questions.length + 1,
                      text: '',
                      optionA: '',
                      optionB: '',
                      optionC: '',
                      optionD: '',
                      correctOption: 'A',
                      subject: selectedExam?.subjectName || '',
                      topic: 'General Concepts',
                      explanation: ''
                    });
                    setShowAddQuestionModal(true);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Question</span>
                </button>
              </div>
            </div>

            {/* Questions Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Bank Questions ({questions.length} Total)
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Configured Paper Target: {selectedExam?.totalQuestions} Questions
                </span>
              </div>

              {questions.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                  <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300" />
                  <p>No questions entered for this paper yet.</p>
                  <button
                    onClick={() => setShowAddQuestionModal(true)}
                    className="text-blue-900 font-bold hover:underline"
                  >
                    + Add your first question or import via CSV
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {questions.map(q => (
                    <div key={q.id} className="p-5 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                            {q.questionNumber}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900">{q.text}</h4>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {q.topic && (
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mr-2">
                              {q.topic}
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setEditingQuestionId(q.id);
                              setQuestionForm({ ...q });
                              setShowAddQuestionModal(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-blue-50 rounded"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs pl-8 mt-2">
                        <div className={`p-2 rounded border ${q.correctOption === 'A' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                          A. {q.optionA}
                        </div>
                        <div className={`p-2 rounded border ${q.correctOption === 'B' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                          B. {q.optionB}
                        </div>
                        <div className={`p-2 rounded border ${q.correctOption === 'C' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                          C. {q.optionC}
                        </div>
                        <div className={`p-2 rounded border ${q.correctOption === 'D' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                          D. {q.optionD}
                        </div>
                      </div>

                      {q.explanation && (
                        <div className="mt-2 pl-8 text-[11px] text-slate-500">
                          <strong className="text-slate-700">Explanation:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBROUTE 4: STUDENTS REGISTER */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Student Directory & Class Enrolment</h2>
                <p className="text-xs text-slate-500">
                  Inspect student profiles, filter by class cohort, and manage unique examination login credentials
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportStudentCodesCsv}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  title="Export full roster with unique IDs to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export IDs CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStudentSlipsModal(true)}
                  className="px-3 py-2 bg-white hover:bg-blue-50 text-blue-900 border border-blue-300 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  title="View and print candidate examination slips / passcards"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-700" />
                  <span>Print Login Slips</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUploadStudentModal(true)}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  title="Upload students from CSV or spreadsheet"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-300" />
                  <span>Upload Students (CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(true)}
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Enrol Single Student</span>
                </button>
              </div>
            </div>

            {/* Class Filter Bar & Candidate Search */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span>Filter by Class:</span>
                </div>
                <select
                  value={studentClassFilter}
                  onChange={(e) => setStudentClassFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 cursor-pointer"
                >
                  <option value="all">All Assigned Classes ({authorizedClasses.length})</option>
                  {authorizedClasses.map(c => (
                    <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                  {/* Also include all school classes for cross-class inspection */}
                  {classes.filter(c => !authorizedClasses.some(ac => ac.code === c.code)).map(c => (
                    <option key={c.id} value={c.code}>{c.name} ({c.code}) - Other Class</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 max-w-md relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by candidate name, admission number, or passcode..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div className="text-xs font-mono text-slate-500 self-center">
                Showing <strong>{filteredStudents.length}</strong> of {authorizedStudents.length} Students
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Admission Number</th>
                    <th className="py-3 px-4">Class Form</th>
                    <th className="py-3 px-4">Unique Login ID / Passcode</th>
                    <th className="py-3 px-4">Academic Session</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No students found matching class filter "{studentClassFilter}" and query "{studentSearchQuery}".
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(s => {
                      const code = s.accessCode || s.admissionNumber;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{s.fullName}</div>
                            {s.gender && <span className="text-[10px] text-slate-400">{s.gender}</span>}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-700">{s.admissionNumber}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                              {s.classGrade}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-xs text-blue-950 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded shadow-2xs tracking-wider">
                                {code}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyStudentCode(code)}
                                className="p-1 text-slate-400 hover:text-blue-900 rounded transition-colors"
                                title="Copy unique code"
                              >
                                {copiedStudentCode === code ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">{s.academicSession || settings.academicSession}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {s.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setInspectingStudent(s)}
                                className="p-1.5 text-blue-900 hover:bg-blue-50 rounded transition-colors"
                                title="Inspect Student Academic Information"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(s.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                title="Delete student record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBROUTE 5: SUBJECTS */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Assigned Curriculum Subjects</h2>
                <p className="text-xs text-slate-500">
                  {teacherStaff
                    ? `Curriculum subjects assigned to ${teacherStaff.fullName} (${teacherStaff.uniqueId}).`
                    : 'Curriculum subjects taught within the secondary school'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {authorizedSubjects.map(sub => (
                <div key={sub.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 mb-1 inline-block">
                      Taught Subject
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{sub.name}</h3>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{sub.code} · {sub.department}</div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-xs">
                    {sub.code ? sub.code.slice(0, 3) : 'SUB'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBROUTE 6: CLASSES */}
        {activeTab === 'classes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Assigned Class Cohorts</h2>
                <p className="text-xs text-slate-500">
                  {teacherStaff
                    ? `Classes offering subjects taught by ${teacherStaff.fullName}.`
                    : 'Secondary school levels from JSS 1 to SS 3'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {authorizedClasses.map(cls => (
                <div key={cls.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mb-1 inline-block">
                      Taught Class Cohort
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{cls.name}</h3>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">Code: {cls.code} · Arm: {cls.arm || 'All'}</div>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    {cls.code}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBROUTE 7: RESULTS & EXCEL CSV EXPORT WITH CLASS & SUBJECT FILTERS */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Examination Results & Class Master Ledger</h2>
                <p className="text-xs text-slate-500">
                  Inspect results for individual class cohorts and curriculum subjects, or export broadsheet to Excel
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTabChange('assessment-sheet')}
                  className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Open CA Broad Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportResultsCsv}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Results CSV (Excel)</span>
                </button>
              </div>
            </div>

            {/* Individual Class and Subject Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Class Selector Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    Select Class:
                  </span>
                  <select
                    value={resultClassFilter}
                    onChange={(e) => setResultClassFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 cursor-pointer"
                  >
                    <option value="all">All Classes ({authorizedClasses.length})</option>
                    {authorizedClasses.map(c => (
                      <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                    ))}
                    {classes.filter(c => !authorizedClasses.some(ac => ac.code === c.code)).map(c => (
                      <option key={c.id} value={c.code}>{c.name} ({c.code}) - Other</option>
                    ))}
                  </select>
                </div>

                {/* Subject Selector Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700">Subject:</span>
                  <select
                    value={resultSubjectFilter}
                    onChange={(e) => setResultSubjectFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 cursor-pointer"
                  >
                    <option value="all">All My Subjects ({authorizedSubjects.length})</option>
                    {authorizedSubjects.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Candidate Search */}
              <div className="flex-1 max-w-sm relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by candidate name or admission number..."
                  value={resultSearchQuery}
                  onChange={(e) => setResultSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>
            </div>

            {/* Filtered Class Cohort Statistics Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Class Submissions</span>
                <span className="text-lg font-black font-mono text-slate-900">{filteredSubmissions.length}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Class Average</span>
                <span className="text-lg font-black font-mono text-blue-900">
                  {filteredSubmissions.length > 0
                    ? Math.round(filteredSubmissions.reduce((a, b) => a + b.percentage, 0) / filteredSubmissions.length)
                    : 0}%
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Highest Score</span>
                <span className="text-lg font-black font-mono text-emerald-700">
                  {filteredSubmissions.length > 0 ? Math.max(...filteredSubmissions.map(s => s.percentage)) : 0}%
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Class Pass Rate</span>
                <span className="text-lg font-black font-mono text-amber-600">
                  {filteredSubmissions.length > 0
                    ? Math.round((filteredSubmissions.filter(s => s.percentage >= (settings.passMarkPercentage || 50)).length / filteredSubmissions.length) * 100)
                    : 0}%
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Admission No</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4 text-right">Score</th>
                    <th className="py-3 px-4 text-right">Percentage</th>
                    <th className="py-3 px-4 text-center">Grade & Remark</th>
                    <th className="py-3 px-4 text-right">Time Spent</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        {authorizedSubmissions.length === 0
                          ? 'No examination submissions recorded yet. Once students conclude papers, scores appear here instantly.'
                          : `No submissions found matching class filter "${resultClassFilter}" and subject filter "${resultSubjectFilter}".`}
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub, idx) => {
                      const g = calculateGrade(sub.percentage);
                      const mins = Math.floor(sub.timeSpentSeconds / 60);
                      const secs = sub.timeSpentSeconds % 60;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{sub.studentName}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{sub.admissionNumber}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {sub.classGrade}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-blue-900">{sub.subject}</td>
                          <td className="py-3 px-4 font-mono font-bold text-right text-slate-900">
                            {sub.score} / {sub.totalQuestions}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-right text-slate-900">
                            {sub.percentage}%
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${g.color}`}>
                              {g.grade} ({g.remark})
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 text-right">
                            {mins}m {secs}s
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setViewingSubmission(sub)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                            >
                              Inspect Sheet
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBROUTE 8: INTELLIGENT ASSESSMENT & TOPIC ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-black text-slate-900">Intelligent Assessment & Topic Learning Gaps</h2>
              <p className="text-xs text-slate-500">
                Data-driven curriculum diagnosis based on real student responses across all recorded submissions
              </p>
            </div>

            {totalSubmissions === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500 space-y-2">
                <BarChart3 className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">Insufficient Examination Data</h3>
                <p className="max-w-md mx-auto">
                  Analytics are computed exclusively from completed student answer sheets. As students complete papers, topic-level learning gaps and difficult questions will populate here.
                </p>
              </div>
            ) : (
              <>
                {/* Topic Performance Grid */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Curriculum Topic Breakdown
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {topicAssessments.map((t, idx) => {
                      const isWeak = t.percentage < 50;
                      const isStrong = t.percentage >= 70;

                      return (
                        <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-slate-900 text-xs truncate">{t.topic}</div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isWeak ? 'bg-rose-100 text-rose-800' : isStrong ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {t.percentage}%
                            </span>
                          </div>

                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isWeak ? 'bg-rose-500' : isStrong ? 'bg-emerald-600' : 'bg-blue-600'
                              }`}
                              style={{ width: `${t.percentage}%` }}
                            />
                          </div>

                          <div className="text-[11px] text-slate-500 flex justify-between font-mono">
                            <span>Evaluated: {t.total} answers</span>
                            <span className={isWeak ? 'text-rose-700 font-bold' : ''}>
                              {isWeak ? 'Remedial Review' : isStrong ? 'Mastered' : 'Moderate'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Highlight Difficult Questions (Unusually High Failure Rate) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Questions with High Failure Rates (Learning Gaps Identified)
                    </h3>
                  </div>

                  {difficultQuestions.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No questions currently exceed the high-failure rate threshold (≥50% incorrect).
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {difficultQuestions.map((q, idx) => {
                        const failureRate = Math.round((q.wrong / q.total) * 100);

                        return (
                          <div key={idx} className="py-3 flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                {failureRate}% Student Failure Rate ({q.wrong} of {q.total} missed)
                              </span>
                              <p className="text-xs text-slate-900 font-medium">{q.text}</p>
                              <div className="text-[11px] text-slate-500">
                                Topic: <strong>{q.topic}</strong> · Recommended Action: Conduct targeted revision session
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-100 rounded-xl text-[11px] text-slate-500">
                  <strong>Advisory Disclaimer:</strong> All system-generated analytics and recommendations are advisory tools designed to support faculty pedagogy. Teachers retain ultimate authority over instructional decisions and assessment policies.
                </div>
              </>
            )}
          </div>
        )}

        {/* SUBROUTE 9: INSTITUTIONAL SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900">Institutional School Configuration</h2>
              <p className="text-xs text-slate-500">
                Manage school identity, academic session, current term, and assessment benchmarks
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveSchoolSettings(settings);
                alert('School settings saved successfully.');
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">School / College Name</label>
                <input
                  type="text"
                  required
                  value={settings.schoolName}
                  onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Active Academic Session</label>
                  <input
                    type="text"
                    required
                    value={settings.academicSession}
                    onChange={(e) => setSettings({ ...settings, academicSession: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Current Academic Term</label>
                  <select
                    value={settings.currentTerm}
                    onChange={(e) => setSettings({ ...settings, currentTerm: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="1st Term">1st Term</option>
                    <option value="2nd Term">2nd Term</option>
                    <option value="3rd Term">3rd Term</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Official Pass Mark Threshold (%)</label>
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={settings.passMarkPercentage}
                  onChange={(e) => setSettings({ ...settings, passMarkPercentage: Number(e.target.value) || 50 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-900 text-white font-bold text-xs rounded-xl hover:bg-blue-800"
              >
                Save Configuration
              </button>
            </form>
          </div>
        )}

        {/* SUBROUTE 10: CONTINUOUS ASSESSMENT BROAD SHEET */}
        {activeTab === 'assessment-sheet' && (
          <ContinuousAssessmentSheet
            classes={authorizedClasses.length > 0 ? authorizedClasses : classes}
            subjects={authorizedSubjects.length > 0 ? authorizedSubjects : subjects}
            students={authorizedStudents.length > 0 ? authorizedStudents : students}
            submissions={submissions}
            teacherStaff={activeStaff}
            academicSession={settings.academicSession}
            currentTerm={settings.currentTerm as '1st Term' | '2nd Term' | '3rd Term'}
            schoolName={settings.schoolName}
          />
        )}

        {/* SUBROUTE 11: FACULTY PROFILE & CREDENTIALS */}
        {activeTab === 'profile' && (
          <TeacherProfileSection
            teacherStaff={activeStaff}
            onProfileUpdated={handleProfileUpdated}
          />
        )}
      </main>

      {/* CREATE EXAM MODAL */}
      {showCreateExamModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Create New Examination</h3>
              <button onClick={() => setShowCreateExamModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveExam} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Examination Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SS 2 First Term Examination: Computer Studies"
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subject</label>
                  <select
                    value={examForm.subjectId}
                    onChange={(e) => {
                      const sub = subjects.find(s => s.id === e.target.value);
                      setExamForm({ ...examForm, subjectId: e.target.value, subjectName: sub?.name || '' });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">Select Subject...</option>
                    {authorizedSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {activeStaff && activeStaff.assignedSubjectNames.length > 0 && (
                    <span className="text-[10px] text-blue-700 font-semibold mt-0.5 block">
                      Restricted to your assigned subjects: {activeStaff.assignedSubjectNames.join(', ')}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Class Cohort</label>
                  <select
                    value={examForm.classGrade}
                    onChange={(e) => setExamForm({ ...examForm, classGrade: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    {authorizedClasses.map(c => (
                      <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Academic Session</label>
                  <select
                    value={examForm.academicSession || settings.academicSession}
                    onChange={(e) => setExamForm({ ...examForm, academicSession: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  >
                    <option value="2023/2024">2023/2024</option>
                    <option value="2024/2025">2024/2025</option>
                    <option value="2025/2026">2025/2026</option>
                    <option value="2026/2027">2026/2027</option>
                    <option value="2027/2028">2027/2028</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Academic Term</label>
                  <select
                    value={examForm.term || settings.currentTerm}
                    onChange={(e) => setExamForm({ ...examForm, term: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="1st Term">1st Term</option>
                    <option value="2nd Term">2nd Term</option>
                    <option value="3rd Term">3rd Term</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={examForm.durationMinutes}
                    onChange={(e) => setExamForm({ ...examForm, durationMinutes: Number(e.target.value) || 15 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Question Count</label>
                  <input
                    type="number"
                    min="1"
                    value={examForm.totalQuestions}
                    onChange={(e) => setExamForm({ ...examForm, totalQuestions: Number(e.target.value) || 10 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Exam Access Timeframe Window Setting */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Exam Time Frame (Access Window)</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Specify the date and time window when candidates can take this exam. If students attempt before start or after close, the exam is inaccessible.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">Start Date & Time</label>
                    <input
                      type="datetime-local"
                      value={examForm.startDate || ''}
                      onChange={(e) => setExamForm({ ...examForm, startDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Empty = Starts immediately when published</span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">Close Date & Time</label>
                    <input
                      type="datetime-local"
                      value={examForm.endDate || ''}
                      onChange={(e) => setExamForm({ ...examForm, endDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Empty = No expiration deadline</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Instructions for Candidates</label>
                <textarea
                  rows={2}
                  value={examForm.instructions}
                  onChange={(e) => setExamForm({ ...examForm, instructions: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Result Release</label>
                  <select
                    value={examForm.resultVisibility}
                    onChange={(e) => setExamForm({ ...examForm, resultVisibility: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="immediate">Immediate Slip Release</option>
                    <option value="teacher_publish">Withhold Until Release</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Publication Status</label>
                  <select
                    value={examForm.status}
                    onChange={(e) => setExamForm({ ...examForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="published">Published (Active for students)</option>
                    <option value="draft">Draft (Hidden from students)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateExamModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 text-white font-bold rounded-lg"
                >
                  Create Examination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD QUESTION MODAL */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingQuestionId ? 'Edit Question' : 'Add Multiple-Choice Question'}
              </h3>
              <button onClick={() => setShowAddQuestionModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveQuestion} className="p-6 space-y-3 text-xs">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Question #</label>
                  <input
                    type="number"
                    min="1"
                    value={questionForm.questionNumber}
                    onChange={(e) => setQuestionForm({ ...questionForm, questionNumber: Number(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Curriculum Topic</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Memory Architecture, Logic Gates"
                    value={questionForm.topic}
                    onChange={(e) => setQuestionForm({ ...questionForm, topic: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Key</label>
                  <select
                    value={questionForm.correctOption}
                    onChange={(e) => setQuestionForm({ ...questionForm, correctOption: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Question Stem</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter the examination question text..."
                  value={questionForm.text}
                  onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block font-semibold text-slate-600 mb-0.5">Option A</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optionA}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionA: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-0.5">Option B</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optionB}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionB: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-0.5">Option C</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optionC}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionC: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-0.5">Option D</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optionD}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionD: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Academic Explanation (Optional)</label>
                <input
                  type="text"
                  placeholder="Explanation of the correct choice..."
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 text-white font-bold rounded-lg"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {showCsvImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Bulk Question Import (Excel CSV)</h3>
              <button onClick={() => setShowCsvImportModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-xl border border-blue-200">
                <span className="text-blue-900 font-semibold">
                  Target Exam: {selectedExam?.title}
                </span>
                <button
                  onClick={downloadSampleQuestionsCsv}
                  className="px-3 py-1.5 text-xs font-bold text-blue-900 bg-white border border-blue-300 rounded-lg hover:bg-blue-100 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV Template</span>
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Upload CSV File from Excel:
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        handleParseCsv(ev.target?.result as string);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 mb-3"
                />

                <textarea
                  rows={4}
                  placeholder="Or paste CSV rows here: questionNumber,text,optionA,optionB,optionC,optionD,correctOption,explanation,subject,topic..."
                  value={csvText}
                  onChange={(e) => handleParseCsv(e.target.value)}
                  className="w-full px-3 py-2 font-mono text-[11px] border border-slate-300 rounded-lg"
                />
              </div>

              {csvError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                  {csvError}
                </div>
              )}

              {csvPreview.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">
                    Parsed Questions Preview ({csvPreview.length} Ready):
                  </h4>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-[11px]">
                    {csvPreview.map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between gap-2">
                        <span className="font-bold font-mono">Q{item.questionNumber}:</span>
                        <span className="truncate flex-1">{item.text}</span>
                        <span className="font-mono text-slate-500 font-semibold">{item.topic}</span>
                        <span className="font-bold text-emerald-700 font-mono">Key: {item.correctOption}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCsvImportModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={csvPreview.length === 0}
                  onClick={handleImportCsvQuestions}
                  className="px-5 py-2 bg-blue-900 text-white font-bold rounded-lg disabled:opacity-40"
                >
                  Import {csvPreview.length} Questions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER STUDENT MODAL */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Enrol Student in Directory</h3>
              <button onClick={() => setShowAddStudentModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveStudent} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Emmanuel"
                    value={studentForm.firstName}
                    onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Surname (Password)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Adebayo"
                    value={studentForm.surname}
                    onChange={(e) => setStudentForm({ ...studentForm, surname: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Admission Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STU/2025/014"
                  value={studentForm.admissionNumber}
                  onChange={(e) => setStudentForm({ ...studentForm, admissionNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Enrolled Class Cohort</label>
                <select
                  value={studentForm.classGrade}
                  onChange={(e) => setStudentForm({ ...studentForm, classGrade: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 text-white font-bold rounded-lg"
                >
                  Enrol Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SUBJECT MODAL */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Add Curriculum Subject</h3>
              <button onClick={() => setShowAddSubjectModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveSubject} className="p-6 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physics"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Subject Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PHY"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={subjectForm.department}
                  onChange={(e) => setSubjectForm({ ...subjectForm, department: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Pure Sciences">Pure Sciences</option>
                  <option value="Science & Tech">Science & Tech</option>
                  <option value="Languages & Humanities">Languages & Humanities</option>
                  <option value="Commercial Studies">Commercial Studies</option>
                  <option value="General Studies">General Studies</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 text-white font-bold rounded-lg"
                >
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD CLASS MODAL */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Add Academic Class</h3>
              <button onClick={() => setShowAddClassModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveClass} className="p-6 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Class Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Secondary 1"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Class Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SS 1"
                  value={classForm.code}
                  onChange={(e) => setClassForm({ ...classForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 text-white font-bold rounded-lg"
                >
                  Save Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW SUBMISSION SLIP INSPECTOR */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Candidate Submission Inspector</h3>
              <button onClick={() => setViewingSubmission(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{viewingSubmission.studentName}</h4>
                  <div className="font-mono text-slate-500">{viewingSubmission.admissionNumber} · {viewingSubmission.classGrade}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black font-mono text-blue-900">
                    {viewingSubmission.score} / {viewingSubmission.totalQuestions}
                  </div>
                  <div className="font-bold text-emerald-700 font-mono">{viewingSubmission.percentage}%</div>
                </div>
              </div>

              <div className="space-y-1.5 text-slate-600">
                <div>Paper: <strong className="text-slate-900">{viewingSubmission.examTitle}</strong></div>
                <div>Subject: <strong className="text-slate-900">{viewingSubmission.subject}</strong></div>
                <div>Time Taken: <strong className="font-mono text-slate-900">{(viewingSubmission.timeSpentSeconds / 60).toFixed(1)} Minutes</strong></div>
                <div>Submitted At: <strong className="font-mono text-slate-900">{new Date(viewingSubmission.submittedAt).toLocaleString()}</strong></div>
              </div>

              {viewingSubmission.detailedResults && (
                <div>
                  <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] mb-2">
                    Question Answer Audit ({viewingSubmission.detailedResults.length} Items)
                  </h5>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2 font-mono text-[11px]">
                    {viewingSubmission.detailedResults.map((r, i) => (
                      <div key={i} className={`p-1.5 rounded flex items-center justify-between ${
                        r.isCorrect ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'
                      }`}>
                        <span>Q{r.questionNumber}: {r.studentAnswer || 'Skipped'} (Key: {r.correctAnswer})</span>
                        <span className="font-bold">{r.isCorrect ? '✓' : '✗'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingSubmission(null)}
                  className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT BATCH UPLOAD MODAL */}
      <StudentBatchUploadModal
        isOpen={showUploadStudentModal}
        onClose={() => setShowUploadStudentModal(false)}
        classes={classes}
        currentSession={settings.academicSession}
        existingStudents={students}
        onUploadSuccess={handleBatchUploadSuccess}
      />

      {/* STUDENT LOGIN SLIPS / ID CARDS MODAL */}
      <StudentSlipsModal
        isOpen={showStudentSlipsModal}
        onClose={() => setShowStudentSlipsModal(false)}
        students={students}
        schoolName={settings.schoolName}
        currentSession={settings.academicSession}
        currentTerm={settings.currentTerm}
      />

      {/* TIMEFRAME CONFIGURATION MODAL */}
      {editingTimeframeExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Set Examination Time Frame</h3>
              </div>
              <button
                onClick={() => setEditingTimeframeExam(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTimeframe} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 text-sm">{editingTimeframeExam.title}</div>
                <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                  {editingTimeframeExam.subjectName} · {editingTimeframeExam.classGrade} · {editingTimeframeExam.durationMinutes} Mins
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                <div className="font-bold text-[11px] flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Student Access Window Rule</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Students attempting to log in before the start time or after the close time will be blocked with an informative schedule alert.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 text-xs">Scheduled Start Date & Time</label>
                    {timeframeForm.startDate && (
                      <button
                        type="button"
                        onClick={() => setTimeframeForm(prev => ({ ...prev, startDate: '' }))}
                        className="text-[10px] text-rose-600 hover:underline"
                      >
                        Clear Start Time
                      </button>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    value={timeframeForm.startDate}
                    onChange={(e) => setTimeframeForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    If empty, exam opens immediately upon publishing.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 text-xs">Scheduled Close Date & Time</label>
                    {timeframeForm.endDate && (
                      <button
                        type="button"
                        onClick={() => setTimeframeForm(prev => ({ ...prev, endDate: '' }))}
                        className="text-[10px] text-rose-600 hover:underline"
                      >
                        Clear Close Time
                      </button>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    value={timeframeForm.endDate}
                    onChange={(e) => setTimeframeForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    If empty, exam has no expiry and remains open indefinitely.
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTimeframeExam(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg shadow-sm"
                >
                  Save Time Frame
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT PROFILE & CANDIDATE DETAILS INSPECTION MODAL */}
      {inspectingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Student Academic & Examination Profile</h3>
              </div>
              <button
                onClick={() => setInspectingStudent(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Header Profile Badge */}
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-amber-400 font-black text-xl flex items-center justify-center border border-slate-800 shrink-0 shadow-sm">
                  {inspectingStudent.firstName?.charAt(0) || inspectingStudent.fullName?.charAt(0)}
                </div>
                <div className="space-y-0.5 flex-1">
                  <h4 className="font-black text-slate-900 text-base">{inspectingStudent.fullName}</h4>
                  <div className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-x-3">
                    <span>Admission No: <strong className="text-slate-800">{inspectingStudent.admissionNumber}</strong></span>
                    <span>·</span>
                    <span>Class Form: <strong className="text-blue-900 font-bold">{inspectingStudent.classGrade}</strong></span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                  {inspectingStudent.status}
                </span>
              </div>

              {/* Credentials & Enrolment Information */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Unique Login Passcode</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-black text-sm text-blue-950 bg-white border border-blue-200 px-2 py-0.5 rounded shadow-2xs">
                      {inspectingStudent.accessCode || inspectingStudent.admissionNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyStudentCode(inspectingStudent.accessCode || inspectingStudent.admissionNumber)}
                      className="p-1 text-slate-400 hover:text-blue-900 rounded"
                      title="Copy passcode"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Academic Session</span>
                  <span className="font-mono font-bold text-slate-800 text-xs block mt-1">
                    {inspectingStudent.academicSession || settings.academicSession}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Enrolment Date</span>
                  <span className="font-mono text-slate-600 text-[11px] block mt-0.5">
                    {inspectingStudent.registeredAt ? new Date(inspectingStudent.registeredAt).toLocaleDateString() : 'Active Term'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Gender / Arm</span>
                  <span className="text-slate-700 text-xs block mt-0.5 font-medium">
                    {inspectingStudent.gender || 'Not specified'} · Arm A
                  </span>
                </div>
              </div>

              {/* Student's Completed CBT Submissions History */}
              <div>
                <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2 flex items-center justify-between">
                  <span>Completed CBT Examinations ({submissions.filter(sub => sub.studentId === inspectingStudent.id || sub.admissionNumber === inspectingStudent.admissionNumber).length})</span>
                  <span className="text-[10px] text-slate-400 font-normal">All Papers Recorded</span>
                </h5>

                {submissions.filter(sub => sub.studentId === inspectingStudent.id || sub.admissionNumber === inspectingStudent.admissionNumber).length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                    No CBT papers completed by this candidate yet. Scores will appear here automatically when submitted.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {submissions
                      .filter(sub => sub.studentId === inspectingStudent.id || sub.admissionNumber === inspectingStudent.admissionNumber)
                      .map((sub, idx) => {
                        const g = calculateGrade(sub.percentage);
                        return (
                          <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
                            <div>
                              <div className="font-bold text-slate-900 text-xs">{sub.subject}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{sub.examTitle} · {new Date(sub.submittedAt).toLocaleDateString()}</div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right font-mono">
                                <span className="font-black text-slate-900 text-xs">{sub.score}/{sub.totalQuestions}</span>
                                <span className="text-[10px] text-slate-500 ml-1">({sub.percentage}%)</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${g.color}`}>
                                {g.grade}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInspectingStudent(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
