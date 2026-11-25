import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Users,
  Search,
  Filter,
  RefreshCw,
  Award,
  ArrowRight,
  TrendingUp,
  Percent,
  Check,
  Eye,
  EyeOff,
  ShieldAlert,
  Edit3,
  SlidersHorizontal
} from 'lucide-react';
import {
  Student,
  Subject,
  SchoolClass,
  StaffMember,
  Submission,
  Examination,
  StudentAssessmentRecord,
  SchoolSettings,
  CaWeightsConfig,
  CbtExamEntry,
  CbtTargetComponent,
  resolveCaWeights,
  resolveExamTargetComponent,
  getTargetComponentMax,
  formatTargetComponentLabel,
  calculateGrade,
  enrichSubmissionsWithOrdinals,
  formatOrdinalExamLabel
} from '../../types/cbt';
import {
  fetchAssessmentRecords,
  saveAssessmentBatch,
  saveAssessmentRecord,
  saveStudent,
  fetchSchoolSettings,
  saveSchoolSettings
} from '../../services/firebase';
import { BatchResultSlipsModal } from '../common/BatchResultSlipsModal';
import { HwsOfficialResultSlip } from '../common/HwsOfficialResultSlip';
import { StudentEvaluationEditorModal } from '../common/StudentEvaluationEditorModal';

interface ContinuousAssessmentSheetProps {
  teacherStaff?: StaffMember | null;
  subjects: Subject[];
  classes: SchoolClass[];
  students: Student[];
  submissions: Submission[];
  exams?: Examination[];
  academicSession: string;
  currentTerm: '1st Term' | '2nd Term' | '3rd Term';
  schoolName: string;
  settings?: SchoolSettings;
}

export const ContinuousAssessmentSheet: React.FC<ContinuousAssessmentSheetProps> = ({
  teacherStaff,
  subjects,
  classes,
  students,
  submissions,
  exams = [],
  academicSession,
  currentTerm,
  schoolName,
  settings
}) => {
  // Selected Subject & Class
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    return subjects.length > 0 ? subjects[0].id : '';
  });

  const [selectedClassCode, setSelectedClassCode] = useState<string>(() => {
    return classes.length > 0 ? classes[0].code : 'SS 2';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [assessmentRecords, setAssessmentRecords] = useState<Record<string, StudentAssessmentRecord>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasUnsavedChangesRef = useRef(false);
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);
  const [saveStatus, setSaveStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showBatchSlipsModal, setShowBatchSlipsModal] = useState(false);
  const [viewingOfficialSlipStudent, setViewingOfficialSlipStudent] = useState<Student | null>(null);
  const [editingEvaluationStudent, setEditingEvaluationStudent] = useState<Student | null>(null);
  const [liveSettings, setLiveSettings] = useState<SchoolSettings | null>(settings || null);
  const [caWeights, setCaWeights] = useState<Required<CaWeightsConfig>>(() => resolveCaWeights(settings?.caWeights));
  const [showCustomizeColumns, setShowCustomizeColumns] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);
  const [withheldStudentsMap, setWithheldStudentsMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    students.forEach(s => {
      if (s.resultWithheld) map[s.id] = true;
    });
    return map;
  });

  useEffect(() => {
    const map: Record<string, boolean> = {};
    students.forEach(s => {
      if (s.resultWithheld) map[s.id] = true;
    });
    setWithheldStudentsMap(map);
  }, [students]);

  useEffect(() => {
    const apply = (st: SchoolSettings) => {
      setLiveSettings(st);
      setCaWeights(resolveCaWeights(st.caWeights));
    };
    if (settings) {
      apply(settings);
    } else {
      fetchSchoolSettings().then(apply).catch(() => {});
    }
    const onSettingsUpdate = (e: Event) => {
      const detail = (e as CustomEvent<SchoolSettings>).detail;
      if (detail) apply(detail);
    };
    window.addEventListener('schoolSettingsUpdated', onSettingsUpdate);
    return () => window.removeEventListener('schoolSettingsUpdated', onSettingsUpdate);
  }, [settings]);

  const totalCaMax = caWeights.assignmentMax + caWeights.firstCaMax + caWeights.secondCaMax;
  const totalOverallMax = totalCaMax + caWeights.examMax;

  const handleSaveCaConfig = async () => {
    setSavingWeights(true);
    try {
      const base = liveSettings || (await fetchSchoolSettings());
      await saveSchoolSettings({
        ...base,
        caWeights: {
          ...caWeights,
          version: 2,
          testMax: caWeights.firstCaMax,
          projectMax: caWeights.secondCaMax
        }
      });
      setSaveStatus({
        text: `Updated assessment structure: ${caWeights.assignmentLabel} (${caWeights.assignmentMax}), ${caWeights.firstCaLabel} (${caWeights.firstCaMax}), ${caWeights.secondCaLabel} (${caWeights.secondCaMax}), ${caWeights.examLabel} (${caWeights.examMax}).`,
        type: 'success'
      });
      setShowCustomizeColumns(false);
    } catch {
      setSaveStatus({ text: 'Failed to save assessment column settings.', type: 'error' });
    } finally {
      setSavingWeights(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  // Sync selected subject if available
  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  useEffect(() => {
    if (!selectedClassCode && classes.length > 0) {
      setSelectedClassCode(classes[0].code);
    }
  }, [classes, selectedClassCode]);

  const activeSubject = useMemo(() => {
    return subjects.find(s => s.id === selectedSubjectId) || subjects[0];
  }, [subjects, selectedSubjectId]);

  // Students in selected class cohort
  const classStudents = useMemo(() => {
    if (!selectedClassCode) return [];
    const cleanClass = selectedClassCode.trim().toLowerCase().replace(/[\s\-_]/g, '');
    return students.filter(s => {
      const stuClass = (s.classGrade || '').trim().toLowerCase().replace(/[\s\-_]/g, '');
      return stuClass === cleanClass || s.classGrade === selectedClassCode;
    });
  }, [students, selectedClassCode]);

  // Filtered students by search query
  const displayedStudents = useMemo(() => {
    if (!searchQuery.trim()) return classStudents;
    const q = searchQuery.toLowerCase();
    return classStudents.filter(
      s => s.fullName.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q)
    );
  }, [classStudents, searchQuery]);

  // Load existing records from Firestore / LocalStorage
  const loadAssessmentRecords = useCallback(() => {
    if (!selectedSubjectId || !selectedClassCode) return;

    fetchAssessmentRecords(selectedSubjectId, selectedClassCode, academicSession, currentTerm)
      .then(records => {
        const recordMap: Record<string, StudentAssessmentRecord> = {};
        records.forEach(r => {
          recordMap[r.studentId] = r;
        });
        setAssessmentRecords(recordMap);
        setHasUnsavedChanges(false);
      })
      .catch(err => console.warn('Error loading assessment records:', err));
  }, [selectedSubjectId, selectedClassCode, academicSession, currentTerm]);

  useEffect(() => {
    loadAssessmentRecords();
  }, [loadAssessmentRecords]);

  useEffect(() => {
    const handleExternalCaSync = () => {
      if (!hasUnsavedChangesRef.current) {
        loadAssessmentRecords();
      }
    };
    window.addEventListener('caRecordsUpdated', handleExternalCaSync);
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('prime_cbt_sync_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'CA_RECORDS_UPDATED' && !hasUnsavedChangesRef.current) {
            loadAssessmentRecords();
          }
        };
      } catch {
        // Ignore BroadcastChannel errors
      }
    }
    return () => {
      window.removeEventListener('caRecordsUpdated', handleExternalCaSync);
      if (bc) bc.close();
    };
  }, [loadAssessmentRecords]);

  // Toggle result withholding for a candidate
  const handleToggleWithholdResult = async (student: Student) => {
    const current = Boolean(withheldStudentsMap[student.id]);
    const nextWithheld = !current;

    setWithheldStudentsMap(prev => ({ ...prev, [student.id]: nextWithheld }));

    const updatedStudent: Student = {
      ...student,
      resultWithheld: nextWithheld,
      withheldReason: nextWithheld ? 'Administrative Review / Outstanding Institutional Clearance' : '',
      updatedAt: new Date().toISOString()
    };

    try {
      await saveStudent(updatedStudent);
      setSaveStatus({
        text: nextWithheld
          ? `Result viewing for ${student.fullName} is now WITHHELD. Student portal will show an administrative notice.`
          : `Result for ${student.fullName} is now RELEASED and accessible to candidate.`,
        type: 'success'
      });
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      setWithheldStudentsMap(prev => ({ ...prev, [student.id]: current }));
      setSaveStatus({ text: 'Failed to update result withholding.', type: 'error' });
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  // Helper to calculate total, grade and remark using active editable weights (default 10/20/20/50)
  const computeScoreDetails = (assignment: number, secondCa: number, firstCa: number, exam: number) => {
    const validAssignment = Math.min(caWeights.assignmentMax, Math.max(0, assignment || 0));
    const validFirstCa = Math.min(caWeights.firstCaMax, Math.max(0, firstCa || 0));
    const validSecondCa = Math.min(caWeights.secondCaMax, Math.max(0, secondCa || 0));
    const validExam = Math.min(caWeights.examMax, Math.max(0, exam || 0));
    const total = validAssignment + validFirstCa + validSecondCa + validExam;

    // Exact grading matching official sample:
    let grade = 'F9';
    let remark = 'FAIL';
    if (total >= 75) {
      grade = 'A';
      remark = 'EXCELLENT';
    } else if (total >= 60) {
      grade = 'B';
      remark = 'V.GOOD';
    } else if (total >= 50) {
      grade = 'C';
      remark = 'GOOD';
    } else if (total >= 40) {
      grade = 'D';
      remark = 'FAIR';
    }

    return {
      assignmentScore: validAssignment,
      firstCaScore: validFirstCa,
      secondCaScore: validSecondCa,
      projectScore: validSecondCa, // backward-compat alias
      testScore: validFirstCa,     // backward-compat alias
      examScore: validExam,
      totalScore: total,
      grade,
      remark
    };
  };

  // Get or initialize record for student with sanitized Firestore ID
  const getRecord = (student: Student): StudentAssessmentRecord => {
    if (assessmentRecords[student.id]) {
      return assessmentRecords[student.id];
    }
    const cleanExam = 0;
    const initialDetails = computeScoreDetails(0, 0, 0, cleanExam);
    const cleanStudentId = (student.id || student.admissionNumber || 'stu').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanSubjId = (selectedSubjectId || 'sub').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanSession = (academicSession || '2024-2025').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanTerm = (currentTerm || '1stTerm').replace(/[^a-zA-Z0-9_-]/g, '_');

    return {
      id: `ca_${cleanStudentId}_${cleanSubjId}_${cleanSession}_${cleanTerm}`,
      studentId: student.id,
      studentName: student.fullName,
      admissionNumber: student.admissionNumber,
      classGrade: selectedClassCode,
      subjectId: selectedSubjectId,
      subjectName: activeSubject?.name || 'Subject',
      academicSession,
      term: currentTerm,
      assignmentScore: initialDetails.assignmentScore,
      firstCaScore: initialDetails.firstCaScore,
      secondCaScore: initialDetails.secondCaScore,
      projectScore: initialDetails.projectScore,
      testScore: initialDetails.testScore,
      examScore: initialDetails.examScore,
      totalScore: initialDetails.totalScore,
      grade: initialDetails.grade,
      remark: initialDetails.remark,
      updatedAt: new Date().toISOString()
    };
  };

  // Handle score change for student
  const handleScoreChange = (
    student: Student,
    field: 'assignmentScore' | 'secondCaScore' | 'firstCaScore' | 'projectScore' | 'testScore' | 'examScore' | 'teacherComment',
    value: string | number
  ) => {
    const current = getRecord(student);
    setHasUnsavedChanges(true);

    if (field === 'teacherComment') {
      const updated: StudentAssessmentRecord = {
        ...current,
        teacherComment: String(value),
        updatedAt: new Date().toISOString()
      };
      setAssessmentRecords(prev => ({ ...prev, [student.id]: updated }));
      return;
    }

    const numValue = Number(value) || 0;
    const assignment = field === 'assignmentScore' ? numValue : current.assignmentScore;
    const secondCa = (field === 'secondCaScore' || field === 'projectScore') ? numValue : (current.secondCaScore ?? current.projectScore ?? 0);
    const firstCa = (field === 'firstCaScore' || field === 'testScore') ? numValue : (current.firstCaScore ?? current.testScore ?? 0);
    const exam = field === 'examScore' ? numValue : current.examScore;

    const computed = computeScoreDetails(assignment, secondCa, firstCa, exam);

    const updated: StudentAssessmentRecord = {
      ...current,
      ...computed,
      isAutoSynced: field === 'examScore' ? false : current.isAutoSynced,
      updatedAt: new Date().toISOString()
    };

    setAssessmentRecords(prev => ({
      ...prev,
      [student.id]: updated
    }));
  };

  // Automatically scan and sync CBT scores into 1st CA, 2nd CA, or Term's Exam & preserve all sittings separately
  const handleAutoFillCbtScores = () => {
    if (!activeSubject) return;

    let matchCount = 0;
    const syncedComponents = new Set<string>();
    const updatedMap = { ...assessmentRecords };
    const cleanSubj = activeSubject.name.trim().toLowerCase();
    const enrichedSubs = enrichSubmissionsWithOrdinals(submissions);
    const examById = new Map<string, Examination>();
    exams.forEach(ex => { if (ex?.id) examById.set(ex.id, ex); });

    classStudents.forEach(student => {
      const studentSubs = enrichedSubs
        .filter(s => {
          const matchesStudent = s.studentId === student.id || s.admissionNumber === student.admissionNumber;
          const matchesSubj = s.subject && s.subject.trim().toLowerCase() === cleanSubj;
          return matchesStudent && matchesSubj;
        })
        .sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());

      if (studentSubs.length > 0) {
        const examEntries: CbtExamEntry[] = studentSubs.map((sub, i) => {
          const targetComp: CbtTargetComponent = resolveExamTargetComponent(examById.get(sub.examId), sub);
          const compMax = getTargetComponentMax(targetComp, caWeights);
          const scaled = Math.min(compMax, Math.max(0, Math.round(((sub.percentage || 0) / 100) * compMax)));
          syncedComponents.add(formatTargetComponentLabel(targetComp, caWeights));
          return {
            submissionId: sub.id || `sub_${sub.examId}_${i}`,
            examId: sub.examId,
            examTitle: sub.examTitle,
            sittingNumber: i + 1,
            sittingLabel: formatOrdinalExamLabel(i + 1),
            targetCaComponent: targetComp,
            rawScore: sub.score,
            totalQuestions: sub.totalQuestions,
            percentage: sub.percentage,
            scaledScore: scaled,
            examMax: compMax,
            submittedAt: sub.submittedAt
          };
        });

        const current = updatedMap[student.id] || getRecord(student);
        let nextFirstCa = current.firstCaScore ?? current.testScore ?? 0;
        let nextSecondCa = current.secondCaScore ?? current.projectScore ?? 0;
        let nextExam = current.examScore ?? 0;

        const firstCaEntries = examEntries.filter(e => e.targetCaComponent === 'first_ca');
        if (firstCaEntries.length > 0) {
          nextFirstCa = Math.min(
            caWeights.firstCaMax,
            Math.round(firstCaEntries.reduce((sum, item) => sum + item.scaledScore, 0) / firstCaEntries.length)
          );
        }

        const secondCaEntries = examEntries.filter(e => e.targetCaComponent === 'second_ca');
        if (secondCaEntries.length > 0) {
          nextSecondCa = Math.min(
            caWeights.secondCaMax,
            Math.round(secondCaEntries.reduce((sum, item) => sum + item.scaledScore, 0) / secondCaEntries.length)
          );
        }

        const termExamEntries = examEntries.filter(e => (e.targetCaComponent || 'exam') === 'exam');
        if (termExamEntries.length > 0) {
          nextExam = Math.min(
            caWeights.examMax,
            Math.round(termExamEntries.reduce((sum, item) => sum + item.scaledScore, 0) / termExamEntries.length)
          );
        }

        const latest = studentSubs[studentSubs.length - 1];
        const computed = computeScoreDetails(
          current.assignmentScore,
          nextSecondCa,
          nextFirstCa,
          nextExam
        );

        updatedMap[student.id] = {
          ...current,
          ...computed,
          cbtSubmissionId: latest.id,
          examEntries,
          isAutoSynced: true,
          updatedAt: new Date().toISOString()
        };
        matchCount++;
      }
    });

    setAssessmentRecords(updatedMap);
    setHasUnsavedChanges(true);

    if (matchCount > 0) {
      const colSummary = Array.from(syncedComponents).join(', ') || caWeights.examLabel;
      setSaveStatus({
        text: `Synced CBT sittings for ${matchCount} student(s) into ${colSummary}! You can still edit any cell and click 'Save All Scores'.`,
        type: 'success'
      });
    } else {
      setSaveStatus({
        text: `No completed CBT examination submissions found for ${activeSubject.name} in ${selectedClassCode}. You can enter scores manually.`,
        type: 'error'
      });
    }

    setTimeout(() => setSaveStatus(null), 5000);
  };

  // Save a single student's row directly
  const handleSaveSingleRecord = async (student: Student) => {
    setSavingStudentId(student.id);
    try {
      const rec = getRecord(student);
      await saveAssessmentRecord(rec);
      setSaveStatus({
        text: `Scores for ${student.fullName} saved successfully!`,
        type: 'success'
      });
    } catch (err) {
      console.error('Error saving single student score:', err);
      setSaveStatus({
        text: `Failed to save score for ${student.fullName}.`,
        type: 'error'
      });
    } finally {
      setSavingStudentId(null);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  // Save all records to Firestore
  const handleSaveAllRecords = async () => {
    setIsSaving(true);
    try {
      if (classStudents.length === 0) {
        setSaveStatus({
          text: `No students found in class ${selectedClassCode} to save.`,
          type: 'error'
        });
        setIsSaving(false);
        return;
      }

      const recordsToSave: StudentAssessmentRecord[] = classStudents
        .filter(s => Boolean(assessmentRecords[s.id]))
        .map(s => getRecord(s));
      if (recordsToSave.length === 0) {
        setSaveStatus({
          text: `Enter or modify at least one student score before saving ${activeSubject?.name || 'sheet'}.`,
          type: 'error'
        });
        setIsSaving(false);
        return;
      }
      await saveAssessmentBatch(recordsToSave);
      setHasUnsavedChanges(false);
      setSaveStatus({
        text: `Master Assessment Record Sheet for ${selectedClassCode} (${activeSubject?.name}) with ${recordsToSave.length} entered student record(s) saved & published successfully!`,
        type: 'success'
      });
    } catch (err) {
      console.error('Error saving continuous assessment records:', err);
      setSaveStatus({
        text: 'Failed to save assessment records to database: ' + (err instanceof Error ? err.message : 'Network error'),
        type: 'error'
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  // Export to CSV for Excel
  const handleExportCsv = () => {
    if (classStudents.length === 0) {
      setSaveStatus({ text: 'No students in this class cohort to export.', type: 'error' });
      setTimeout(() => setSaveStatus(null), 4000);
      return;
    }

    const headers = [
      'S/N',
      'Admission Number',
      'Candidate Full Name',
      'Class Cohort',
      'Subject',
      'Academic Session',
      'Term',
      `${caWeights.assignmentLabel} (${caWeights.assignmentMax})`,
      `${caWeights.firstCaLabel} (${caWeights.firstCaMax})`,
      `${caWeights.secondCaLabel} (${caWeights.secondCaMax})`,
      `Total CA (${totalCaMax})`,
      `${caWeights.examLabel} (${caWeights.examMax})`,
      `Total Score (${totalOverallMax})`,
      'Grade',
      'Remark',
      'Teacher Comment'
    ];

    const rows = classStudents.map((student, idx) => {
      const rec = getRecord(student);
      const firstCa = rec.firstCaScore ?? rec.testScore ?? 0;
      const secondCa = rec.secondCaScore ?? rec.projectScore ?? 0;
      const totalCa = rec.assignmentScore + firstCa + secondCa;
      return [
        idx + 1,
        `"${student.admissionNumber}"`,
        `"${student.fullName}"`,
        `"${selectedClassCode}"`,
        `"${activeSubject?.name}"`,
        `"${academicSession}"`,
        `"${currentTerm}"`,
        rec.assignmentScore,
        firstCa,
        secondCa,
        totalCa,
        rec.examScore,
        rec.totalScore,
        `"${rec.grade}"`,
        `"${rec.remark}"`,
        `"${rec.teacherComment || ''}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `broad_sheet_${selectedClassCode.replace(/\s+/g, '_')}_${activeSubject?.code}_${currentTerm.replace(/\s+/g, '')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Class Statistics Summary
  const stats = useMemo(() => {
    if (classStudents.length === 0) return { avg: 0, high: 0, low: 0, passRate: 0 };
    const scores = classStudents.map(s => getRecord(s).totalScore);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / scores.length);
    const high = Math.max(...scores);
    const low = Math.min(...scores);
    const passed = scores.filter(s => s >= 50).length;
    const passRate = Math.round((passed / scores.length) * 100);
    return { avg, high, low, passRate };
  }, [classStudents, assessmentRecords]);

  return (
    <div className="space-y-6 pb-20">
      {/* Printable Institutional Letterhead (Hidden on screen, visible on print) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <img
            src="/school-logo.png"
            alt="Honey's World High School Crest"
            className="w-14 h-14 object-contain rounded-full border border-amber-400"
            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
          />
          <div className="text-left">
            <h1 className="text-xl font-black uppercase tracking-wider">{schoolName || "HONEY'S WORLD HIGH SCHOOL"}</h1>
            <p className="text-xs font-bold text-slate-800 uppercase tracking-widest">
              Gaa Ajanaku, Ilorin, Kwara State
            </p>
            <p className="text-[10px] italic text-slate-600">
              Motto: "Knowledge, Character & Academic Excellence"
            </p>
          </div>
        </div>
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-widest mt-1 border-t border-slate-200 pt-1">
          Official Continuous Assessment & Examination Master Grade Sheet
        </h2>
        <div className="flex justify-between items-center text-xs font-mono mt-3 px-2">
          <span><strong>Subject:</strong> {activeSubject?.name}</span>
          <span><strong>Class Cohort:</strong> {selectedClassCode}</span>
          <span><strong>Session:</strong> {academicSession} ({currentTerm})</span>
          <span><strong>Teacher:</strong> {teacherStaff?.fullName || 'Faculty Instructor'}</span>
        </div>
      </div>

      {/* Screen Header & Filter Ribbon */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm no-print space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-bold uppercase tracking-wider mb-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-700" />
              <span>Standard School Assessment Record Sheet</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">
              Continuous Assessment & Master Gradebook
            </h2>
            <p className="text-xs text-slate-500">
              Record assignment, project, test, and exam scores manually or auto-fill from CBT results. All calculations and grades compute automatically.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasUnsavedChanges && (
              <span className="px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold rounded-lg animate-pulse">
                Unsaved Edits
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowCustomizeColumns(prev => !prev)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Edit assessment column headings and mark distributions"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
              <span>Customize Marks & Headings</span>
            </button>

            <button
              type="button"
              onClick={handleAutoFillCbtScores}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title={`Automatically sync CBT objective test scores into the ${caWeights.examLabel} (${caWeights.examMax}) column`}
            >
              <Sparkles className="w-4 h-4 text-blue-700" />
              <span>Auto-Fill CBT Scores</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-900 border border-blue-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-blue-700" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBatchSlipsModal(true)}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-700" />
              <span>Batch Print Slips</span>
            </button>

            {/* PRIMARY SAVE BUTTON IN TOP RIBBON */}
            <button
              type="button"
              onClick={handleSaveAllRecords}
              disabled={isSaving}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Saving to Database...' : 'Save All Scores & Publish'}</span>
            </button>
          </div>
        </div>

        {/* Editable Column Headings & Max Marks Customizer */}
        {showCustomizeColumns && (
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black text-blue-950 uppercase">
                  Customize Assessment Headings & Max Marks
                </h4>
                <p className="text-[11px] text-blue-800">
                  Changes sync across the Teacher Broadsheet, Admin Broadsheet, and Student Report Slip (Default: 10 / 20 / 20 / 50).
                </p>
              </div>
              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${totalOverallMax === 100 ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
                CA: {totalCaMax} · Total: {totalOverallMax}/100
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-blue-200 space-y-1.5">
                <input
                  type="text"
                  value={caWeights.assignmentLabel}
                  onChange={(e) => setCaWeights({ ...caWeights, assignmentLabel: e.target.value })}
                  className="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded"
                  placeholder="Assignment/Note"
                />
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={caWeights.assignmentMax}
                  onChange={(e) => setCaWeights({ ...caWeights, assignmentMax: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full px-2 py-1 text-sm font-black border border-slate-300 rounded text-center"
                />
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-blue-200 space-y-1.5">
                <input
                  type="text"
                  value={caWeights.firstCaLabel}
                  onChange={(e) => setCaWeights({ ...caWeights, firstCaLabel: e.target.value })}
                  className="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded"
                  placeholder="1st CA"
                />
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={caWeights.firstCaMax}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    setCaWeights({ ...caWeights, firstCaMax: v, testMax: v });
                  }}
                  className="w-full px-2 py-1 text-sm font-black border border-slate-300 rounded text-center"
                />
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-blue-200 space-y-1.5">
                <input
                  type="text"
                  value={caWeights.secondCaLabel}
                  onChange={(e) => setCaWeights({ ...caWeights, secondCaLabel: e.target.value })}
                  className="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded"
                  placeholder="2nd CA"
                />
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={caWeights.secondCaMax}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    setCaWeights({ ...caWeights, secondCaMax: v, projectMax: v });
                  }}
                  className="w-full px-2 py-1 text-sm font-black border border-slate-300 rounded text-center"
                />
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-amber-300 space-y-1.5">
                <input
                  type="text"
                  value={caWeights.examLabel}
                  onChange={(e) => setCaWeights({ ...caWeights, examLabel: e.target.value })}
                  className="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded"
                  placeholder="Term's Exam"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={caWeights.examMax}
                  onChange={(e) => setCaWeights({ ...caWeights, examMax: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full px-2 py-1 text-sm font-black border border-slate-300 rounded text-center"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCustomizeColumns(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white rounded-lg cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveCaConfig}
                disabled={savingWeights}
                className="px-4 py-1.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                {savingWeights ? 'Saving...' : 'Save Headings & Weights'}
              </button>
            </div>
          </div>
        )}

        {/* Status Notification */}
        {saveStatus && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 shadow-xs animate-fadeIn ${
              saveStatus.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold'
                : 'bg-rose-50 border border-rose-200 text-rose-800 font-bold'
            }`}
          >
            {saveStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{saveStatus.text}</span>
          </div>
        )}

        {/* Class, Subject, and Search Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Select Subject */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-blue-900" />
              <span>Taught Subject</span>
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Select Class */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 flex items-center gap-1">
              <Users className="w-3 h-3 text-blue-900" />
              <span>Class Cohort Arm</span>
            </label>
            <select
              value={selectedClassCode}
              onChange={(e) => setSelectedClassCode(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {classes.map(c => (
                <option key={c.id} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* Academic Session & Term Display */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
              Academic Window
            </label>
            <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 text-xs">
              {academicSession} · {currentTerm}
            </div>
          </div>

          {/* Candidate Search */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 flex items-center gap-1">
              <Search className="w-3 h-3 text-slate-400" />
              <span>Search Candidate</span>
            </label>
            <input
              type="text"
              placeholder="Search by name or admission #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Cohort Performance Statistics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div className="text-center sm:text-left">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Enrolled Candidates</span>
            <span className="text-base font-black font-mono text-slate-900">{classStudents.length}</span>
          </div>
          <div className="text-center sm:text-left">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Class Average</span>
            <span className="text-base font-black font-mono text-blue-900">{stats.avg}%</span>
          </div>
          <div className="text-center sm:text-left">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Highest Score</span>
            <span className="text-base font-black font-mono text-emerald-700">{stats.high}%</span>
          </div>
          <div className="text-center sm:text-left">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Overall Pass Rate</span>
            <span className="text-base font-black font-mono text-slate-900">{stats.passRate}%</span>
          </div>
        </div>
      </div>

      {/* Broad Sheet Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {classStudents.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-300" />
            <div className="text-sm font-bold text-slate-700">No Students Found for {selectedClassCode}</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Please ensure students are enrolled in this class form via the "Students" directory tab.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-3 w-10 text-center">S/N</th>
                  <th className="py-3 px-3 w-28">Admission #</th>
                  <th className="py-3 px-4 min-w-[150px]">Student Full Name</th>
                  <th className="py-3 px-2 w-24 text-center bg-blue-50/60 border-l border-blue-100">
                    {caWeights.assignmentLabel}<br /><span className="text-[9px] text-blue-700">({caWeights.assignmentMax})</span>
                  </th>
                  <th className="py-3 px-2 w-20 text-center bg-blue-50/60">
                    {caWeights.firstCaLabel}<br /><span className="text-[9px] text-blue-700">({caWeights.firstCaMax})</span>
                  </th>
                  <th className="py-3 px-2 w-20 text-center bg-blue-50/60">
                    {caWeights.secondCaLabel}<br /><span className="text-[9px] text-blue-700">({caWeights.secondCaMax})</span>
                  </th>
                  <th className="py-3 px-2 w-20 text-center font-black bg-blue-100/70 text-blue-900 border-r border-blue-200">
                    CA Total<br /><span className="text-[9px]">({totalCaMax})</span>
                  </th>
                  <th className="py-3 px-2 w-24 text-center bg-amber-50/60">
                    {caWeights.examLabel}<br /><span className="text-[9px] text-amber-700">({caWeights.examMax})</span>
                  </th>
                  <th className="py-3 px-3 w-20 text-center font-black bg-slate-200/80 text-slate-900">
                    Total<br /><span className="text-[9px]">({totalOverallMax})</span>
                  </th>
                  <th className="py-3 px-2 w-16 text-center">Grade</th>
                  <th className="py-3 px-3 w-24 text-center">Remark</th>
                  <th className="py-3 px-3 w-20 text-center no-print">Result Gate</th>
                  <th className="py-3 px-4 min-w-[230px] text-center no-print">Official Slip & Evaluation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedStudents.map((student, idx) => {
                  const rec = getRecord(student);
                  const firstCa = rec.firstCaScore ?? rec.testScore ?? 0;
                  const secondCa = rec.secondCaScore ?? rec.projectScore ?? 0;
                  const totalCa = rec.assignmentScore + firstCa + secondCa;
                  const isRowSaving = savingStudentId === student.id;
                  const isWithheld = Boolean(withheldStudentsMap[student.id]);

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700 text-xs">
                        {student.admissionNumber}
                      </td>

                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        <div>{student.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{student.accessCode}</div>
                      </td>

                      {/* Assignment Input */}
                      <td className="py-2 px-2 text-center bg-blue-50/30 border-l border-blue-100">
                        <input
                          type="number"
                          min="0"
                          max={caWeights.assignmentMax}
                          step="1"
                          value={rec.assignmentScore || ''}
                          onChange={(e) => handleScoreChange(student, 'assignmentScore', e.target.value)}
                          className="w-14 px-1.5 py-1 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        />
                      </td>

                      {/* 1st CA Input */}
                      <td className="py-2 px-2 text-center bg-blue-50/30">
                        <input
                          type="number"
                          min="0"
                          max={caWeights.firstCaMax}
                          step="1"
                          value={firstCa || ''}
                          onChange={(e) => handleScoreChange(student, 'firstCaScore', e.target.value)}
                          className="w-14 px-1.5 py-1 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        />
                        {rec.examEntries && rec.examEntries.some(e => e.targetCaComponent === 'first_ca') && (
                          <div className="mt-1 flex flex-wrap justify-center gap-1">
                            {rec.examEntries
                              .filter(e => e.targetCaComponent === 'first_ca')
                              .map((ent, eIdx) => (
                                <span
                                  key={ent.submissionId || eIdx}
                                  className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-950 border border-blue-300"
                                  title={`${ent.sittingLabel} (${ent.examTitle}): ${ent.rawScore}/${ent.totalQuestions} (${ent.percentage}%)`}
                                >
                                  CBT: {ent.scaledScore}
                                </span>
                              ))}
                          </div>
                        )}
                      </td>

                      {/* 2nd CA Input */}
                      <td className="py-2 px-2 text-center bg-blue-50/30">
                        <input
                          type="number"
                          min="0"
                          max={caWeights.secondCaMax}
                          step="1"
                          value={secondCa || ''}
                          onChange={(e) => handleScoreChange(student, 'secondCaScore', e.target.value)}
                          className="w-14 px-1.5 py-1 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        />
                        {rec.examEntries && rec.examEntries.some(e => e.targetCaComponent === 'second_ca') && (
                          <div className="mt-1 flex flex-wrap justify-center gap-1">
                            {rec.examEntries
                              .filter(e => e.targetCaComponent === 'second_ca')
                              .map((ent, eIdx) => (
                                <span
                                  key={ent.submissionId || eIdx}
                                  className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-indigo-100 text-indigo-950 border border-indigo-300"
                                  title={`${ent.sittingLabel} (${ent.examTitle}): ${ent.rawScore}/${ent.totalQuestions} (${ent.percentage}%)`}
                                >
                                  CBT: {ent.scaledScore}
                                </span>
                              ))}
                          </div>
                        )}
                      </td>

                      {/* Auto-computed Total CA */}
                      <td className="py-2.5 px-2 text-center font-mono font-black text-blue-950 bg-blue-100/40 border-r border-blue-200">
                        {totalCa}
                      </td>

                      {/* Term's Examination Input */}
                      <td className="py-2 px-2 text-center bg-amber-50/30">
                        <div className="relative inline-block">
                          <input
                            type="number"
                            min="0"
                            max={caWeights.examMax}
                            step="1"
                            value={rec.examScore || ''}
                            onChange={(e) => handleScoreChange(student, 'examScore', e.target.value)}
                            className="w-16 px-1.5 py-1 text-center font-mono font-bold text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          />
                          {rec.isAutoSynced && (
                            <span
                              className="absolute -top-2 -right-2 text-[9px] font-bold bg-blue-700 text-white px-1 rounded shadow-xs"
                              title="Score was auto-synced from student's CBT attempt"
                            >
                              CBT
                            </span>
                          )}
                        </div>
                        {rec.examEntries && rec.examEntries.some(e => (e.targetCaComponent || 'exam') === 'exam') && (
                          <div className="mt-1 flex flex-wrap justify-center gap-1">
                            {rec.examEntries
                              .filter(e => (e.targetCaComponent || 'exam') === 'exam')
                              .map((ent, eIdx) => (
                                <span
                                  key={ent.submissionId || eIdx}
                                  className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-amber-100/90 text-amber-950 border border-amber-300"
                                  title={`${ent.sittingLabel} (${ent.examTitle}): ${ent.rawScore}/${ent.totalQuestions} (${ent.percentage}%)`}
                                >
                                  {ent.sittingLabel.replace(' Exam', '')}: {ent.scaledScore}
                                </span>
                              ))}
                          </div>
                        )}
                      </td>

                      {/* Total Score (100) */}
                      <td className="py-2.5 px-3 text-center font-mono font-black text-base bg-slate-100/70 text-slate-900">
                        {rec.totalScore}
                      </td>

                      {/* Calculated Grade */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-black font-mono ${
                            rec.totalScore >= 75
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : rec.totalScore >= 60
                              ? 'bg-blue-100 text-blue-900 border border-blue-300'
                              : rec.totalScore >= 50
                              ? 'bg-teal-100 text-teal-900 border border-teal-300'
                              : rec.totalScore >= 40
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}
                        >
                          {rec.grade}
                        </span>
                      </td>

                      {/* Remark */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[11px] font-bold ${
                            rec.totalScore >= 50 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {rec.remark}
                        </span>
                      </td>

                      {/* Result Withholding Gate Button */}
                      <td className="py-2 px-3 text-center no-print">
                        <button
                          type="button"
                          onClick={() => handleToggleWithholdResult(student)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer border ${
                            isWithheld
                              ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          }`}
                          title={isWithheld ? 'Click to release result to student' : 'Click to withhold result from student'}
                        >
                          {isWithheld ? (
                            <>
                              <EyeOff className="w-3 h-3 text-rose-600" />
                              <span>Withheld</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3 text-emerald-600" />
                              <span>Released</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Action Buttons: Official Slip, Edit Evaluation, Save Row */}
                      <td className="py-2 px-3 text-center no-print">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setViewingOfficialSlipStudent(student)}
                            className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="View and print candidate's official 2-page report sheet"
                          >
                            <Printer className="w-3 h-3 text-blue-700" />
                            <span>Official Slip</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingEvaluationStudent(student)}
                            className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Edit psychomotor behaviours, skills, remarks, fees"
                          >
                            <Edit3 className="w-3 h-3 text-amber-700" />
                            <span>Evaluation</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveSingleRecord(student)}
                            disabled={isRowSaving}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 text-[10px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Save this student's score"
                          >
                            <Save className={`w-3 h-3 ${isRowSaving ? 'animate-spin' : ''}`} />
                            <span>{isRowSaving ? '...' : 'Save'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Dedicated Bottom-of-Table Save Section Card */}
        {classStudents.length > 0 && (
          <div className="bg-slate-900 text-white p-5 sm:p-6 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0">
                <Save className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Save Continuous Assessment Ledger</h4>
                <p className="text-xs text-slate-400">
                  {hasUnsavedChanges
                    ? 'Edits detected. Save scores to update the student information portal and transcripts.'
                    : `All scores for ${classStudents.length} student(s) in ${selectedClassCode} are up to date.`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={handleAutoFillCbtScores}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Auto-Fill CBT</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAllRecords}
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                <span>{isSaving ? 'Saving Scores...' : `Save All Scores (${classStudents.length} Students)`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Official Sign-off block for Print */}
        <div className="hidden print:grid grid-cols-3 gap-8 p-8 border-t-2 border-slate-900 text-xs mt-8">
          <div>
            <div className="border-b border-slate-500 pb-1 font-bold">
              {teacherStaff?.fullName || 'Subject Teacher'}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase">Subject Instructor Signature & Date</div>
          </div>
          <div>
            <div className="border-b border-slate-500 pb-1 font-bold text-slate-300">__________________________</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase">Head of Department / HOD Signature</div>
          </div>
          <div>
            <div className="border-b border-slate-500 pb-1 font-bold text-slate-300">__________________________</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase">Principal / Institutional Seal & Date</div>
          </div>
        </div>
      </div>

      {/* Persistent Floating Bottom Save Bar */}
      {classStudents.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 no-print animate-fadeIn">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-amber-300">{activeSubject?.name}</span>
            <span className="text-slate-400 font-mono">({selectedClassCode})</span>
            {hasUnsavedChanges && (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                Unsaved
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveAllRecords}
            disabled={isSaving}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Saving...' : 'Save Sheet'}</span>
          </button>
        </div>
      )}

      {/* BATCH RESULT SLIPS MODAL */}
      {showBatchSlipsModal && (
        <BatchResultSlipsModal
          isOpen={showBatchSlipsModal}
          students={classStudents}
          classes={classes}
          submissions={submissions}
          settings={liveSettings || settings}
          initialClassFilter={selectedClassCode}
          academicSession={academicSession}
          term={currentTerm}
          onClose={() => setShowBatchSlipsModal(false)}
        />
      )}

      {/* INDIVIDUAL OFFICIAL 2-PAGE REPORT SLIP MODAL */}
      {viewingOfficialSlipStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[96vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-300 p-2 sm:p-4">
            <HwsOfficialResultSlip
              student={viewingOfficialSlipStudent}
              draftRecords={Object.values(assessmentRecords)}
              settings={liveSettings || settings || {
                schoolName,
                motto: "Good Education is the Best Foundation for a Better Future.",
                address: "NO. 84 GAA-AJANAKU AIYETORO STREET, ILORIN KW/ST.",
                phone: "08060071766, 08167355968",
                email: "Honeysworld5@gmail.com",
                academicSession,
                currentTerm,
                schoolLogo: "/school-logo.png",
                passMarkPercentage: 50,
                allowImmediateResultViewing: true,
                caWeights
              }}
              academicSession={academicSession}
              term={currentTerm}
              isEditable={true}
              usePrintPortal={true}
              onClose={() => setViewingOfficialSlipStudent(null)}
            />
          </div>
        </div>
      )}

      {/* PSYCHOMOTOR & EVALUATION EDITOR MODAL */}
      {editingEvaluationStudent && (
        <StudentEvaluationEditorModal
          isOpen={Boolean(editingEvaluationStudent)}
          onClose={() => setEditingEvaluationStudent(null)}
          student={editingEvaluationStudent}
          academicSession={academicSession}
          term={currentTerm}
          onSaved={() => {
            setSaveStatus({
              text: `Terminal evaluation for ${editingEvaluationStudent.fullName} saved & synchronized!`,
              type: 'success'
            });
            setTimeout(() => setSaveStatus(null), 4000);
          }}
        />
      )}
    </div>
  );
};
