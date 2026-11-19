import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  Download,
  Edit3,
  Save,
  Check,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import {
  Student,
  Subject,
  StudentAssessmentRecord,
  StudentTermReportData,
  SchoolSettings,
  PsychomotorRating,
  SkillsRating,
  KEY_RATING_LABELS,
  DEFAULT_PSYCHOMOTOR,
  DEFAULT_SKILLS,
  CaWeightsConfig,
  resolveCaWeights
} from '../../types/cbt';
import {
  fetchStudentTermReport,
  saveStudentTermReport,
  subscribeStudentAssessmentRecords,
  saveAssessmentBatch,
  fetchSubjects,
  fetchSchoolSettings,
  saveSchoolSettings
} from '../../services/firebase';
import { DEFAULT_SCHOOL_SETTINGS, DEFAULT_SUBJECTS } from '../../data/initialSchoolData';

interface HwsOfficialResultSlipProps {
  student: Student;
  reportData?: StudentTermReportData | null;
  subjectRecords?: StudentAssessmentRecord[];
  settings?: SchoolSettings;
  academicSession?: string;
  term?: '1st Term' | '2nd Term' | '3rd Term';
  isEditable?: boolean;
  usePrintPortal?: boolean;
  onSaved?: (updated: StudentTermReportData) => void;
  onClose?: () => void;
}

const calculateHwsGrade = (score: number): { grade: string; remark: string } => {
  if (score >= 75) return { grade: 'A', remark: 'EXCELLENT' };
  if (score >= 60) return { grade: 'B', remark: 'V.GOOD' };
  if (score >= 50) return { grade: 'C', remark: 'GOOD' };
  if (score >= 40) return { grade: 'D', remark: 'FAIR' };
  return { grade: 'F9', remark: 'FAIL' };
};

const HWS_SAMPLE_ROWS: Array<{
  subjectName: string;
  assignmentScore: number;
  firstCaScore: number;
  secondCaScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  remark: string;
}> = [
  { subjectName: 'ENGLISH LANGUAGE', assignmentScore: 10, firstCaScore: 12, secondCaScore: 14, examScore: 31, totalScore: 67, grade: 'B', remark: 'V.GOOD' },
  { subjectName: 'MATHEMATICS', assignmentScore: 10, firstCaScore: 10, secondCaScore: 10, examScore: 18, totalScore: 48, grade: 'D', remark: 'FAIR' },
  { subjectName: 'LITERATURE-IN-ENGLISH', assignmentScore: 10, firstCaScore: 14, secondCaScore: 12, examScore: 33, totalScore: 69, grade: 'B', remark: 'V.GOOD' },
  { subjectName: 'CHEMISTRY', assignmentScore: 0, firstCaScore: 0, secondCaScore: 0, examScore: 0, totalScore: 0, grade: '', remark: '' },
  { subjectName: 'PHYSICS', assignmentScore: 0, firstCaScore: 0, secondCaScore: 0, examScore: 0, totalScore: 0, grade: '', remark: '' },
  { subjectName: 'BIOLOGY', assignmentScore: 0, firstCaScore: 0, secondCaScore: 0, examScore: 0, totalScore: 0, grade: '', remark: '' },
  { subjectName: 'ACCOUNTING', assignmentScore: 0, firstCaScore: 0, secondCaScore: 0, examScore: 0, totalScore: 0, grade: '', remark: '' },
  { subjectName: 'COMMERCE', assignmentScore: 0, firstCaScore: 0, secondCaScore: 0, examScore: 0, totalScore: 0, grade: '', remark: '' },
  { subjectName: 'GEOGRAPHY', assignmentScore: 0, firstCaScore: 0, secondCaScore: 0, examScore: 0, totalScore: 0, grade: '', remark: '' },
  { subjectName: 'MARKETING', assignmentScore: 0, firstCaScore: 0, secondCaScore: 0, examScore: 0, totalScore: 0, grade: '', remark: '' },
  { subjectName: 'ECONOMICS', assignmentScore: 0, firstCaScore: 0, secondCaScore: 0, examScore: 0, totalScore: 0, grade: '', remark: '' },
  { subjectName: 'GOVERNMENT', assignmentScore: 10, firstCaScore: 12, secondCaScore: 15, examScore: 35, totalScore: 72, grade: 'B', remark: 'V.GOOD' },
  { subjectName: 'HISTORY', assignmentScore: 10, firstCaScore: 16, secondCaScore: 18, examScore: 40, totalScore: 84, grade: 'A', remark: 'EXCELLENT' },
  { subjectName: 'HOME MANAGEMENT', assignmentScore: 10, firstCaScore: 14, secondCaScore: 15, examScore: 36, totalScore: 75, grade: 'A', remark: 'EXCELLENT' },
  { subjectName: 'AGRIC', assignmentScore: 0, firstCaScore: 0, secondCaScore: 0, examScore: 0, totalScore: 0, grade: '', remark: '' },
  { subjectName: 'YORUBA', assignmentScore: 10, firstCaScore: 12, secondCaScore: 14, examScore: 37, totalScore: 73, grade: 'B', remark: 'V.GOOD' },
  { subjectName: 'CIVIC EDUCATION', assignmentScore: 10, firstCaScore: 12, secondCaScore: 14, examScore: 24, totalScore: 60, grade: 'B', remark: 'V.GOOD' },
  { subjectName: 'CRS/IRS', assignmentScore: 10, firstCaScore: 18, secondCaScore: 18, examScore: 44, totalScore: 90, grade: 'A', remark: 'EXCELLENT' },
  { subjectName: 'DIGITAL TECHNOLOGY', assignmentScore: 10, firstCaScore: 13, secondCaScore: 15, examScore: 27, totalScore: 65, grade: 'B', remark: 'V.GOOD' }
];

const resolveFirstCa = (rec: StudentAssessmentRecord): number => {
  if (typeof rec.firstCaScore === 'number' && rec.firstCaScore > 0) return rec.firstCaScore;
  if (typeof rec.testScore === 'number' && rec.testScore > 0) return rec.testScore;
  return rec.firstCaScore ?? rec.testScore ?? 0;
};

const resolveSecondCa = (rec: StudentAssessmentRecord): number => {
  if (typeof rec.secondCaScore === 'number' && rec.secondCaScore > 0) return rec.secondCaScore;
  if (typeof rec.projectScore === 'number' && rec.projectScore > 0) return rec.projectScore;
  return rec.secondCaScore ?? rec.projectScore ?? 0;
};

export const HwsOfficialResultSlip: React.FC<HwsOfficialResultSlipProps> = ({
  student,
  reportData,
  subjectRecords,
  settings,
  academicSession = '2024/2025',
  term = '1st Term',
  isEditable = false,
  usePrintPortal = true,
  onSaved,
  onClose
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [printContainer, setPrintContainer] = useState<HTMLElement | null>(null);

  const [liveSettings, setLiveSettings] = useState<SchoolSettings>(
    () => settings || DEFAULT_SCHOOL_SETTINGS
  );
  const [caMeta, setCaMeta] = useState<Required<CaWeightsConfig>>(
    () => resolveCaWeights(settings?.caWeights)
  );

  // Editable school header metadata synced from settings
  const [headerMeta, setHeaderMeta] = useState({
    schoolName: settings?.schoolName || DEFAULT_SCHOOL_SETTINGS.schoolName,
    motto: settings?.motto || DEFAULT_SCHOOL_SETTINGS.motto || 'Good Education is the Best Foundation for a Better Future.',
    address: settings?.address || DEFAULT_SCHOOL_SETTINGS.address || 'NO. 84 GAA-AJANAKU AIYETORO STREET, ILORIN KW/ST.',
    phone: settings?.phone || DEFAULT_SCHOOL_SETTINGS.phone || '08060071766, 08167355968',
    email: settings?.email || DEFAULT_SCHOOL_SETTINGS.email || 'Honeysworld5@gmail.com',
    resultTitle: settings?.resultTitle || DEFAULT_SCHOOL_SETTINGS.resultTitle || 'END OF THE TERM REPORT SHEET',
    schoolLogo: settings?.schoolLogo || '/school-logo.png'
  });

  useEffect(() => {
    const applySettings = (st: SchoolSettings) => {
      setLiveSettings(st);
      setCaMeta(resolveCaWeights(st.caWeights));
      setHeaderMeta({
        schoolName: st.schoolName || DEFAULT_SCHOOL_SETTINGS.schoolName,
        motto: st.motto || DEFAULT_SCHOOL_SETTINGS.motto || 'Good Education is the Best Foundation for a Better Future.',
        address: st.address || DEFAULT_SCHOOL_SETTINGS.address || 'NO. 84 GAA-AJANAKU AIYETORO STREET, ILORIN KW/ST.',
        phone: st.phone || DEFAULT_SCHOOL_SETTINGS.phone || '08060071766, 08167355968',
        email: st.email || DEFAULT_SCHOOL_SETTINGS.email || 'Honeysworld5@gmail.com',
        resultTitle: st.resultTitle || DEFAULT_SCHOOL_SETTINGS.resultTitle || 'END OF THE TERM REPORT SHEET',
        schoolLogo: st.schoolLogo || '/school-logo.png'
      });
    };

    if (settings) {
      applySettings(settings);
    } else {
      fetchSchoolSettings().then(applySettings).catch(() => {});
    }

    const handleSettingsUpdated = (e: Event) => {
      const detail = (e as CustomEvent<SchoolSettings>).detail;
      if (detail) applySettings(detail);
    };
    window.addEventListener('schoolSettingsUpdated', handleSettingsUpdated);
    return () => window.removeEventListener('schoolSettingsUpdated', handleSettingsUpdated);
  }, [settings]);

  // Setup isolated print portal on body so modals print ONLY the 2-page report slip
  useEffect(() => {
    if (!usePrintPortal || typeof document === 'undefined') return;
    let host = document.getElementById('hws-print-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'hws-print-root';
      document.body.appendChild(host);
    }
    document.body.classList.add('hws-isolated-print');
    setPrintContainer(host);
    return () => {
      document.body.classList.remove('hws-isolated-print');
    };
  }, [usePrintPortal]);

  // Editable local state for report card details
  const [formData, setFormData] = useState<StudentTermReportData>(() => {
    if (reportData) return reportData;
    const cleanStuId = (student.id || student.admissionNumber || 'stu').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanSess = (academicSession || '2024-2025').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanTrm = (term || '1stTerm').replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      id: `report_${cleanStuId}_${cleanSess}_${cleanTrm}`,
      studentId: student.id,
      studentName: student.fullName || 'ABDULWAHEED SOLIU',
      admissionNumber: student.admissionNumber || 'HWS/24/032',
      classGrade: student.classGrade || 'S.S 2',
      academicSession,
      term,
      age: 14,
      house: 'BLUE',
      sex: student.gender || 'MALE',
      noInClass: 13,
      department: student.department || '',
      category: (student.classGrade || '').toUpperCase().includes('JSS') ? 'JUNIOR SECONDARY' : 'SENIOR SECONDARY',
      classAverage: '',
      behaviours: { ...DEFAULT_PSYCHOMOTOR },
      skills: { ...DEFAULT_SKILLS },
      classTeacherRemarks: "STAY FOCUS AND YOU'LL REACH YOUR GOALS.",
      principalRemarks: "GOOD PROGRESS! BUT MORE EFFORT ARE NEEDED.",
      nextTermBegins: "5TH JANUARY, 2026",
      nextTermFees: "26,000",
      principalSignature: 'Signed',
      proprietressSignature: 'Signed',
      updatedAt: new Date().toISOString()
    };
  });

  const [liveCaRecords, setLiveCaRecords] = useState<StudentAssessmentRecord[]>(subjectRecords || []);
  const [schoolSubjects, setSchoolSubjects] = useState<Subject[]>(DEFAULT_SUBJECTS);
  const [editableRows, setEditableRows] = useState<StudentAssessmentRecord[] | null>(null);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sync if explicit props update
  useEffect(() => {
    if (reportData) {
      setFormData(reportData);
    }
  }, [reportData]);

  useEffect(() => {
    if (subjectRecords && subjectRecords.length > 0) {
      setLiveCaRecords(subjectRecords);
    }
  }, [subjectRecords]);

  // Auto-hydrate term report data from Firestore/local cache + listen for live updates
  useEffect(() => {
    if (reportData) return;
    let mounted = true;
    const loadReport = async () => {
      try {
        const fetched = await fetchStudentTermReport(student.id, academicSession, term, student);
        if (mounted && fetched) {
          setFormData(fetched);
        }
      } catch (err) {
        console.warn('Error hydrating student term report:', err);
      }
    };
    loadReport();

    const handleReportUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as StudentTermReportData | undefined;
      if (!detail || detail.studentId === student.id || detail.admissionNumber === student.admissionNumber) {
        loadReport();
      }
    };
    window.addEventListener('termReportsUpdated', handleReportUpdate);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('prime_cbt_sync_channel');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'TERM_REPORT_UPDATED') {
          loadReport();
        }
      };
    } catch {}

    return () => {
      mounted = false;
      window.removeEventListener('termReportsUpdated', handleReportUpdate);
      if (bc) {
        try { bc.close(); } catch {}
      }
    };
  }, [student.id, student.admissionNumber, academicSession, term, reportData]);

  // Load school subjects for building full 19-20 row academic table
  useEffect(() => {
    let mounted = true;
    fetchSubjects().then(subs => {
      if (mounted && subs && subs.length > 0) {
        setSchoolSubjects(subs);
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Subscribe live to student's CA records across subjects
  useEffect(() => {
    if (subjectRecords && subjectRecords.length > 0) return;
    const unsub = subscribeStudentAssessmentRecords(
      student.id,
      student.admissionNumber,
      (records) => {
        // Filter by current term (and match session flexibly if provided)
        const termNorm = term.toLowerCase().replace(/\s+/g, '');
        const matching = records.filter(r => {
          const rTerm = (r.term || '').toLowerCase().replace(/\s+/g, '');
          if (rTerm && rTerm !== termNorm) return false;
          return true;
        });
        setLiveCaRecords(matching.length > 0 ? matching : records);
      }
    );
    return () => unsub();
  }, [student.id, student.admissionNumber, term, subjectRecords]);

  // Build normalized full subject rows merging saved CA records + school curriculum list
  const computedSubjects = useMemo<StudentAssessmentRecord[]>(() => {
    const cleanStuId = (student.id || student.admissionNumber || 'stu').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanSess = (academicSession || '2024-2025').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanTrm = (term || '1stTerm').replace(/[^a-zA-Z0-9_-]/g, '_');

    const normalizeSubj = (name: string) =>
      name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    const withheldSet = new Set(
      (!isEditable && student.withheldSubjectIds ? student.withheldSubjectIds : []).map(s => normalizeSubj(s))
    );

    const hasLiveScores = liveCaRecords.some(
      r => r.totalScore > 0 || r.assignmentScore > 0 || r.examScore > 0
    );

    // If this is the sample student and no live records exist yet, preserve sample numbers
    const isSampleCandidate =
      student.admissionNumber === 'HWS/24/032' ||
      student.fullName?.toUpperCase().includes('ABDULWAHEED SOLIU');

    if (!hasLiveScores && isSampleCandidate && !isEditingInline) {
      return HWS_SAMPLE_ROWS.map((r, idx) => ({
        id: `ca_${cleanStuId}_sample_${idx}_${cleanSess}_${cleanTrm}`,
        studentId: student.id,
        studentName: student.fullName,
        admissionNumber: student.admissionNumber,
        classGrade: student.classGrade || 'S.S 2',
        subjectId: `sub_${idx}`,
        subjectName: r.subjectName,
        academicSession,
        term,
        assignmentScore: r.assignmentScore,
        firstCaScore: r.firstCaScore,
        secondCaScore: r.secondCaScore,
        projectScore: r.secondCaScore,
        testScore: r.firstCaScore,
        examScore: r.examScore,
        totalScore: r.totalScore,
        grade: r.grade,
        remark: r.remark,
        teacherSignature: r.totalScore > 0 ? 'Signed' : '',
        updatedAt: new Date().toISOString()
      }));
    }

    // Merge saved CA records with standard school subject roster
    const liveByKey = new Map<string, StudentAssessmentRecord>();
    liveCaRecords.forEach(r => {
      liveByKey.set(normalizeSubj(r.subjectName), r);
    });

    const baseSubjectNames =
      schoolSubjects.length > 0
        ? schoolSubjects.map(s => ({ id: s.id, name: s.name.toUpperCase() }))
        : HWS_SAMPLE_ROWS.map((s, idx) => ({ id: `sub_${idx}`, name: s.subjectName }));

    const merged: StudentAssessmentRecord[] = [];
    const seenKeys = new Set<string>();

    baseSubjectNames.forEach((subj, idx) => {
      const key = normalizeSubj(subj.name);
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      const live = liveByKey.get(key);
      const isSubjectWithheld = !isEditable && (student.resultWithheld || withheldSet.has(key));

      if (live && !isSubjectWithheld) {
        const firstCa = resolveFirstCa(live);
        const secondCa = resolveSecondCa(live);
        const total = Math.min(100, (live.assignmentScore || 0) + firstCa + secondCa + (live.examScore || 0));
        const gradeInfo = total > 0 ? calculateHwsGrade(total) : { grade: '', remark: '' };
        merged.push({
          ...live,
          subjectName: live.subjectName.toUpperCase(),
          firstCaScore: firstCa,
          secondCaScore: secondCa,
          totalScore: total,
          grade: live.grade || gradeInfo.grade,
          remark: (live.remark || gradeInfo.remark).toUpperCase()
        });
      } else {
        merged.push({
          id: `ca_${cleanStuId}_${(subj.id || `sub_${idx}`).replace(/[^a-zA-Z0-9_-]/g, '_')}_${cleanSess}_${cleanTrm}`,
          studentId: student.id,
          studentName: student.fullName,
          admissionNumber: student.admissionNumber,
          classGrade: student.classGrade || 'S.S 2',
          subjectId: subj.id || `sub_${idx}`,
          subjectName: subj.name,
          academicSession,
          term,
          assignmentScore: 0,
          firstCaScore: 0,
          secondCaScore: 0,
          projectScore: 0,
          testScore: 0,
          examScore: 0,
          totalScore: 0,
          grade: '',
          remark: isSubjectWithheld ? 'WITHHELD' : '',
          teacherSignature: '',
          updatedAt: new Date().toISOString()
        });
      }
    });

    // Include any extra subjects recorded in liveCaRecords that aren't in default list
    liveCaRecords.forEach(r => {
      const key = normalizeSubj(r.subjectName);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const isSubjectWithheld = !isEditable && (student.resultWithheld || withheldSet.has(key));
        if (!isSubjectWithheld) {
          const firstCa = resolveFirstCa(r);
          const secondCa = resolveSecondCa(r);
          const total = Math.min(100, (r.assignmentScore || 0) + firstCa + secondCa + (r.examScore || 0));
          const gradeInfo = total > 0 ? calculateHwsGrade(total) : { grade: '', remark: '' };
          merged.push({
            ...r,
            subjectName: r.subjectName.toUpperCase(),
            firstCaScore: firstCa,
            secondCaScore: secondCa,
            totalScore: total,
            grade: r.grade || gradeInfo.grade,
            remark: (r.remark || gradeInfo.remark).toUpperCase()
          });
        }
      }
    });

    return merged;
  }, [liveCaRecords, schoolSubjects, student, academicSession, term, isEditable, isEditingInline]);

  const displayedSubjects = editableRows && isEditingInline ? editableRows : computedSubjects;

  // Enter inline edit mode with mutable copy of subjects
  const handleToggleEditMode = () => {
    if (!isEditingInline) {
      setEditableRows(computedSubjects.map(r => ({ ...r })));
      setIsEditingInline(true);
    } else {
      setIsEditingInline(false);
    }
  };

  // Update individual subject row while editing inline
  const handleSubjectRowChange = (
    idx: number,
    field: 'subjectName' | 'assignmentScore' | 'firstCaScore' | 'secondCaScore' | 'examScore' | 'teacherSignature',
    val: string
  ) => {
    setEditableRows(prev => {
      const list = prev ? [...prev] : computedSubjects.map(r => ({ ...r }));
      const row = { ...list[idx] };

      if (field === 'subjectName') {
        row.subjectName = val.toUpperCase();
      } else if (field === 'teacherSignature') {
        row.teacherSignature = val;
      } else {
        const num = Math.max(0, Number(val) || 0);
        if (field === 'assignmentScore') row.assignmentScore = Math.min(caMeta.assignmentMax, num);
        if (field === 'firstCaScore') {
          const v = Math.min(caMeta.firstCaMax, num);
          row.firstCaScore = v;
          row.testScore = v;
        }
        if (field === 'secondCaScore') {
          const v = Math.min(caMeta.secondCaMax, num);
          row.secondCaScore = v;
          row.projectScore = v;
        }
        if (field === 'examScore') row.examScore = Math.min(caMeta.examMax, num);

        const first = resolveFirstCa(row);
        const second = resolveSecondCa(row);
        const tot = Math.min(100, (row.assignmentScore || 0) + first + second + (row.examScore || 0));
        row.totalScore = tot;
        const g = tot > 0 ? calculateHwsGrade(tot) : { grade: '', remark: '' };
        row.grade = g.grade;
        row.remark = g.remark;
      }

      row.updatedAt = new Date().toISOString();
      list[idx] = row;
      return list;
    });
  };

  const handleAddSubjectRow = () => {
    const cleanStuId = (student.id || 'stu').replace(/[^a-zA-Z0-9_-]/g, '_');
    const idx = (editableRows?.length || 0) + 1;
    const newRow: StudentAssessmentRecord = {
      id: `ca_${cleanStuId}_custom_${Date.now()}_${idx}`,
      studentId: student.id,
      studentName: formData.studentName,
      admissionNumber: formData.admissionNumber,
      classGrade: formData.classGrade,
      subjectId: `sub_custom_${Date.now()}`,
      subjectName: 'NEW SUBJECT',
      academicSession,
      term,
      assignmentScore: 0,
      firstCaScore: 0,
      secondCaScore: 0,
      projectScore: 0,
      testScore: 0,
      examScore: 0,
      totalScore: 0,
      grade: '',
      remark: '',
      teacherSignature: 'Signed',
      updatedAt: new Date().toISOString()
    };
    setEditableRows(prev => [...(prev || computedSubjects), newRow]);
  };

  const handleRemoveSubjectRow = (idx: number) => {
    setEditableRows(prev => {
      if (!prev) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Totals calculations
  const totals = useMemo(() => {
    let assignmentTotal = 0;
    let firstCaTotal = 0;
    let secondCaTotal = 0;
    let examTotal = 0;
    let grandTotal = 0;
    let subjectsWithScores = 0;

    displayedSubjects.forEach(s => {
      const f = resolveFirstCa(s);
      const sec = resolveSecondCa(s);
      const tot = (s.assignmentScore || 0) + f + sec + (s.examScore || 0);
      if (tot > 0 || s.assignmentScore > 0 || s.examScore > 0) {
        assignmentTotal += s.assignmentScore || 0;
        firstCaTotal += f;
        secondCaTotal += sec;
        examTotal += s.examScore || 0;
        grandTotal += tot;
        subjectsWithScores++;
      }
    });

    return {
      assignmentTotal,
      firstCaTotal,
      secondCaTotal,
      examTotal,
      grandTotal,
      subjectsWithScores,
      computedAverage: subjectsWithScores > 0 ? (grandTotal / subjectsWithScores).toFixed(1) + '%' : '0.0%'
    };
  }, [displayedSubjects]);

  // Save ALL edited fields (Term Report + Subject CA Scores + School Header Settings)
  const handleSaveReport = async () => {
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      // 1. Save term report metadata (bio, psychomotor, skills, remarks, fees, signatures)
      const reportToSave: StudentTermReportData = {
        ...formData,
        classAverage: formData.classAverage || totals.computedAverage,
        updatedAt: new Date().toISOString()
      };
      await saveStudentTermReport(reportToSave);

      // 2. Save any edited subject CA scores with non-zero marks or updates
      if (editableRows && editableRows.length > 0) {
        const modifiedRecords = editableRows.filter(
          r => r.totalScore > 0 || r.assignmentScore > 0 || resolveFirstCa(r) > 0 || resolveSecondCa(r) > 0 || r.examScore > 0
        ).map(r => ({
          ...r,
          studentName: formData.studentName,
          admissionNumber: formData.admissionNumber,
          classGrade: formData.classGrade
        }));
        if (modifiedRecords.length > 0) {
          await saveAssessmentBatch(modifiedRecords);
          setLiveCaRecords(editableRows);
        }
      }

      // 3. Persist header & CA weighting/heading settings if modified
      const baseSettings = settings || liveSettings;
      const prevWeights = resolveCaWeights(baseSettings.caWeights);
      const weightsChanged =
        caMeta.assignmentMax !== prevWeights.assignmentMax ||
        caMeta.firstCaMax !== prevWeights.firstCaMax ||
        caMeta.secondCaMax !== prevWeights.secondCaMax ||
        caMeta.examMax !== prevWeights.examMax ||
        caMeta.assignmentLabel !== prevWeights.assignmentLabel ||
        caMeta.firstCaLabel !== prevWeights.firstCaLabel ||
        caMeta.secondCaLabel !== prevWeights.secondCaLabel ||
        caMeta.examLabel !== prevWeights.examLabel;
      const headerChanged =
        headerMeta.schoolName !== baseSettings.schoolName ||
        headerMeta.motto !== baseSettings.motto ||
        headerMeta.address !== baseSettings.address ||
        headerMeta.phone !== baseSettings.phone ||
        headerMeta.email !== baseSettings.email ||
        headerMeta.resultTitle !== baseSettings.resultTitle;
      if (headerChanged || weightsChanged) {
        await saveSchoolSettings({
          ...baseSettings,
          schoolName: headerMeta.schoolName,
          motto: headerMeta.motto,
          address: headerMeta.address,
          phone: headerMeta.phone,
          email: headerMeta.email,
          resultTitle: headerMeta.resultTitle,
          caWeights: {
            ...caMeta,
            version: 2,
            testMax: caMeta.firstCaMax,
            projectMax: caMeta.secondCaMax
          }
        });
      }

      setSaveFeedback({ text: 'Report card & broadsheet synchronized to database!', type: 'success' });
      if (onSaved) onSaved(reportToSave);
      setTimeout(() => setSaveFeedback(null), 3500);
    } catch (err) {
      console.error('Error saving report card:', err);
      setSaveFeedback({ text: 'Failed to save report card changes. Check connection.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Download self-contained printable HTML slip directly to mobile or PC
  const handleDownloadSlip = () => {
    if (!sheetRef.current) return;
    const htmlContent = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${formData.studentName} - ${formData.admissionNumber} - Official Report Sheet</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  body { background: #ffffff; color: #000000; font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 12px; }
  .hws-page-1 { page-break-after: always; break-after: page; margin-bottom: 24px; }
  .hws-page-2 { page-break-before: always; break-before: page; }
  @media print {
    body { padding: 0; }
    .no-print-btn { display: none !important; }
  }
</style>
</head>
<body>
  <div class="no-print-btn" style="text-align:right;margin-bottom:10px;">
    <button onclick="window.print()" style="background:#1e3a8a;color:#fff;padding:8px 16px;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">Print / Save as PDF</button>
  </div>
  ${sheetRef.current.outerHTML}
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formData.studentName.replace(/\s+/g, '_')}_${formData.admissionNumber.replace(/[^a-zA-Z0-9]/g, '_')}_Report_Sheet.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Behaviours list (exact order from Page 2)
  const behaviourTraits: Array<{ key: keyof PsychomotorRating; label: string }> = [
    { key: 'punctuality', label: 'PUNCTUALITY' },
    { key: 'classAttendance', label: 'CLASS ATTENDANCE' },
    { key: 'personalHygiene', label: 'PERSONAL HYGIENE' },
    { key: 'attentiveness', label: 'ATTENTIVENESS' },
    { key: 'honesty', label: 'HONESTY' },
    { key: 'neatness', label: 'NEATNESS' },
    { key: 'participationAtWork', label: 'PARTICIPATION AT WORK' },
    { key: 'selfControl', label: 'SELF-CONTROL' },
    { key: 'initiative', label: 'INITIATIVE' }
  ];

  // Skills list (exact order from Page 2)
  const skillTraits: Array<{ key: keyof SkillsRating; label: string }> = [
    { key: 'handwriting', label: 'HANDWRITING' },
    { key: 'drawingPainting', label: 'DRAWING / PAINTING' },
    { key: 'gamesSports', label: 'GAMES & SPORTS' },
    { key: 'readingFluency', label: 'READING FLUENCY' },
    { key: 'handlingOfTools', label: 'HANDLING OF TOOLS & LAB.' }
  ];

  // Reusable inner 2-page document JSX (rendered on screen AND inside print portal for crisp multi-page A4 output)
  const renderSheetContent = (isPrintClone = false) => (
    <div
      ref={!isPrintClone ? sheetRef : undefined}
      className={`hws-sheet-container max-w-[850px] mx-auto bg-white font-sans text-slate-900 ${
        isPrintClone ? 'p-0 border-none shadow-none' : 'border border-slate-300 shadow-xl p-3 sm:p-5'
      } rounded-none`}
    >
      {/* ========================================================
          PAGE 1: ACADEMIC PERFORMANCE REPORT
          ======================================================== */}
      <section className="hws-page-1 mb-8 print:mb-0">
        {/* Top Double Line Accent */}
        <div className="border-t-2 border-b border-slate-900 pb-0.5 mb-2" />

        {/* School Header */}
        <div className="flex items-center justify-between gap-3 pb-2">
          <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
            <img
              src={headerMeta.schoolLogo}
              alt="School Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          <div className="flex-1 text-center">
            {!isPrintClone && isEditingInline ? (
              <div className="space-y-1">
                <input
                  type="text"
                  value={headerMeta.schoolName}
                  onChange={(e) => setHeaderMeta({ ...headerMeta, schoolName: e.target.value.toUpperCase() })}
                  className="w-full text-center text-lg sm:text-2xl font-black uppercase border-b border-blue-500 bg-blue-50 px-2"
                />
                <input
                  type="text"
                  value={headerMeta.motto}
                  onChange={(e) => setHeaderMeta({ ...headerMeta, motto: e.target.value })}
                  className="w-full text-center text-xs italic border-b border-blue-400 bg-blue-50 px-2"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-[10px]">
                  <input
                    type="text"
                    value={headerMeta.address}
                    onChange={(e) => setHeaderMeta({ ...headerMeta, address: e.target.value })}
                    className="border-b border-blue-400 bg-blue-50 px-1 text-center"
                    placeholder="School Address"
                  />
                  <input
                    type="text"
                    value={headerMeta.phone}
                    onChange={(e) => setHeaderMeta({ ...headerMeta, phone: e.target.value })}
                    className="border-b border-blue-400 bg-blue-50 px-1 text-center"
                    placeholder="Phones"
                  />
                  <input
                    type="text"
                    value={headerMeta.email}
                    onChange={(e) => setHeaderMeta({ ...headerMeta, email: e.target.value })}
                    className="border-b border-blue-400 bg-blue-50 px-1 text-center"
                    placeholder="Email"
                  />
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-wider font-sans text-slate-950">
                  {headerMeta.schoolName}
                </h1>
                <div className="bg-slate-200/70 text-slate-800 text-[11px] sm:text-xs italic py-0.5 px-2 my-0.5 font-serif font-semibold">
                  ...Motto: {headerMeta.motto}
                </div>
                <div className="text-[10px] sm:text-[11px] font-sans font-semibold text-slate-800 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
                  <span>📍 {headerMeta.address}</span>
                  <span>📞 {headerMeta.phone}</span>
                  <span>✉️ {headerMeta.email}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Document Title Banner */}
        <div className="bg-slate-200 border-t border-b border-slate-800 text-center py-1 font-bold text-xs sm:text-sm uppercase tracking-wider text-slate-950 mb-2">
          {!isPrintClone && isEditingInline ? (
            <input
              type="text"
              value={headerMeta.resultTitle}
              onChange={(e) => setHeaderMeta({ ...headerMeta, resultTitle: e.target.value.toUpperCase() })}
              className="w-full text-center font-bold uppercase bg-blue-50 border-b border-blue-500 px-2"
            />
          ) : (
            headerMeta.resultTitle
          )}
        </div>

        {/* Student Bio Grid */}
        <div className="border border-slate-800 text-[11px] font-sans mb-3">
          {/* Row 1 */}
          <div className="grid grid-cols-12 border-b border-slate-800">
            <div className="col-span-6 border-r border-slate-800 px-2 py-1 flex items-center bg-slate-50/50">
              <span className="font-bold w-16 shrink-0">NAME:</span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.studentName}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                  className="w-full uppercase font-bold text-slate-900 border-b border-blue-500 bg-blue-50 px-1"
                />
              ) : (
                <span className="uppercase font-bold text-slate-950">{formData.studentName}</span>
              )}
            </div>
            <div className="col-span-4 border-r border-slate-800 px-2 py-1 flex items-center">
              <span className="font-bold w-28 shrink-0">ADMISSION NO:</span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.admissionNumber}
                  onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
                  className="w-full font-mono font-bold border-b border-blue-500 bg-blue-50 px-1"
                />
              ) : (
                <span className="font-mono font-bold text-slate-950">{formData.admissionNumber}</span>
              )}
            </div>
            <div className="col-span-2 px-2 py-1 flex items-center">
              <span className="font-bold w-10 shrink-0">AGE:</span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.age || ''}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full font-bold border-b border-blue-500 bg-blue-50 px-1"
                />
              ) : (
                <span className="font-bold text-slate-950">{formData.age || 14}</span>
              )}
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-12 border-b border-slate-800">
            <div className="col-span-6 border-r border-slate-800 px-2 py-1 flex items-center">
              <span className="font-bold w-16 shrink-0">CLASS:</span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.classGrade}
                  onChange={(e) => setFormData({ ...formData, classGrade: e.target.value })}
                  className="w-full uppercase font-bold border-b border-blue-500 bg-blue-50 px-1"
                />
              ) : (
                <span className="font-bold text-slate-950 uppercase">{formData.classGrade}</span>
              )}
            </div>
            <div className="col-span-4 border-r border-slate-800 px-2 py-1 flex items-center">
              <span className="font-bold w-20 shrink-0">HOUSE:</span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.house || ''}
                  onChange={(e) => setFormData({ ...formData, house: e.target.value })}
                  className="w-full uppercase font-bold border-b border-blue-500 bg-blue-50 px-1"
                />
              ) : (
                <span className="font-bold text-slate-950 uppercase">{formData.house || 'BLUE'}</span>
              )}
            </div>
            <div className="col-span-2 px-2 py-1 flex items-center">
              <span className="font-bold w-10 shrink-0">SEX:</span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.sex || ''}
                  onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                  className="w-full uppercase font-bold border-b border-blue-500 bg-blue-50 px-1"
                />
              ) : (
                <span className="font-bold text-slate-950 uppercase">{formData.sex || 'MALE'}</span>
              )}
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-12 border-b border-slate-800">
            <div className="col-span-6 border-r border-slate-800 px-2 py-1 flex items-center">
              <span className="font-bold w-28 shrink-0">NO IN CLASS:</span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.noInClass || ''}
                  onChange={(e) => setFormData({ ...formData, noInClass: e.target.value })}
                  className="w-full font-bold border-b border-blue-500 bg-blue-50 px-1"
                />
              ) : (
                <span className="font-bold text-slate-950">{formData.noInClass || 13}</span>
              )}
            </div>
            <div className="col-span-4 border-r border-slate-800 px-2 py-1 flex items-center">
              <span className="font-bold w-28 shrink-0">DEPARTMENT:</span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full uppercase font-bold border-b border-blue-500 bg-blue-50 px-1"
                />
              ) : (
                <span className="font-bold text-slate-950 uppercase">{formData.department || ''}</span>
              )}
            </div>
            <div className="col-span-2 px-2 py-1 flex items-center">
              <span className="font-bold w-12 shrink-0">TERM:</span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.term}
                  onChange={(e) => setFormData({ ...formData, term: e.target.value as any })}
                  className="w-full uppercase font-bold border-b border-blue-500 bg-blue-50 px-1"
                />
              ) : (
                <span className="font-bold text-slate-950 uppercase">{formData.term || '1ST'}</span>
              )}
            </div>
          </div>

          {/* Row 4 */}
          <div className="px-2 py-1 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center flex-1">
              <span className="font-bold w-24 shrink-0">CATEGORY:</span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full uppercase font-bold border-b border-blue-500 bg-blue-50 px-1"
                />
              ) : (
                <span className="font-bold text-slate-950 uppercase">{formData.category || 'SENIOR SECONDARY'}</span>
              )}
            </div>
            <div className="text-[10px] font-mono font-bold text-slate-700 pl-3">
              SESSION: {formData.academicSession || academicSession}
            </div>
          </div>
        </div>

        {/* Academic Performance Table */}
        <div className="border border-slate-800 overflow-x-auto">
          <table className="w-full border-collapse text-[10px] sm:text-[11px] text-center">
            <thead>
              {/* Main Header Row */}
              <tr className="border-b border-slate-800 bg-slate-100 font-bold text-slate-900">
                <th rowSpan={2} className="border-r border-slate-800 p-1 w-32 sm:w-44 text-center uppercase tracking-tight">
                  <div className="font-extrabold text-[11px] sm:text-xs">ANNUAL ACADEMIC</div>
                  <div className="font-extrabold text-[11px] sm:text-xs">PERFORMANCE</div>
                </th>
                <th className="border-r border-slate-800 p-1">
                  {!isPrintClone && isEditingInline ? (
                    <input
                      type="text"
                      value={caMeta.assignmentLabel}
                      onChange={(e) => setCaMeta({ ...caMeta, assignmentLabel: e.target.value })}
                      className="w-24 text-center text-[10px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                    />
                  ) : (
                    caMeta.assignmentLabel.toUpperCase()
                  )}
                </th>
                <th className="border-r border-slate-800 p-1">
                  {!isPrintClone && isEditingInline ? (
                    <input
                      type="text"
                      value={caMeta.firstCaLabel}
                      onChange={(e) => setCaMeta({ ...caMeta, firstCaLabel: e.target.value })}
                      className="w-20 text-center text-[10px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                    />
                  ) : (
                    caMeta.firstCaLabel.toUpperCase()
                  )}
                </th>
                <th className="border-r border-slate-800 p-1">
                  {!isPrintClone && isEditingInline ? (
                    <input
                      type="text"
                      value={caMeta.secondCaLabel}
                      onChange={(e) => setCaMeta({ ...caMeta, secondCaLabel: e.target.value })}
                      className="w-20 text-center text-[10px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                    />
                  ) : (
                    caMeta.secondCaLabel.toUpperCase()
                  )}
                </th>
                <th className="border-r border-slate-800 p-1">
                  {!isPrintClone && isEditingInline ? (
                    <input
                      type="text"
                      value={caMeta.examLabel}
                      onChange={(e) => setCaMeta({ ...caMeta, examLabel: e.target.value })}
                      className="w-24 text-center text-[10px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                    />
                  ) : (
                    caMeta.examLabel.toUpperCase()
                  )}
                </th>
                <th className="border-r border-slate-800 p-1">TOTAL SCORE</th>
                <th rowSpan={2} className="border-r border-slate-800 p-1 w-10">GRADE</th>
                <th rowSpan={2} className="border-r border-slate-800 p-1 w-16">CLASS AVERAGE</th>
                <th rowSpan={2} className="border-r border-slate-800 p-1 w-20">REMARKS</th>
                <th rowSpan={2} className="p-1 w-20">TEACHERS SIGNATURE</th>
              </tr>
              {/* Max Marks Row */}
              <tr className="border-b border-slate-800 bg-slate-100 font-bold text-slate-700">
                <th className="border-r border-slate-800 p-0.5">
                  {!isPrintClone && isEditingInline ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={caMeta.assignmentMax}
                      onChange={(e) => setCaMeta({ ...caMeta, assignmentMax: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-12 text-center bg-blue-50 border-b border-blue-400 font-bold"
                    />
                  ) : (
                    caMeta.assignmentMax
                  )}
                </th>
                <th className="border-r border-slate-800 p-0.5">
                  {!isPrintClone && isEditingInline ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={caMeta.firstCaMax}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        setCaMeta({ ...caMeta, firstCaMax: v, testMax: v });
                      }}
                      className="w-12 text-center bg-blue-50 border-b border-blue-400 font-bold"
                    />
                  ) : (
                    caMeta.firstCaMax
                  )}
                </th>
                <th className="border-r border-slate-800 p-0.5">
                  {!isPrintClone && isEditingInline ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={caMeta.secondCaMax}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        setCaMeta({ ...caMeta, secondCaMax: v, projectMax: v });
                      }}
                      className="w-12 text-center bg-blue-50 border-b border-blue-400 font-bold"
                    />
                  ) : (
                    caMeta.secondCaMax
                  )}
                </th>
                <th className="border-r border-slate-800 p-0.5">
                  {!isPrintClone && isEditingInline ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={caMeta.examMax}
                      onChange={(e) => setCaMeta({ ...caMeta, examMax: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-12 text-center bg-blue-50 border-b border-blue-400 font-bold"
                    />
                  ) : (
                    caMeta.examMax
                  )}
                </th>
                <th className="border-r border-slate-800 p-0.5">
                  {(caMeta.assignmentMax || 0) + (caMeta.firstCaMax || 0) + (caMeta.secondCaMax || 0) + (caMeta.examMax || 0)}
                </th>
              </tr>
              {/* Subjects Section Title Row */}
              <tr className="border-b border-slate-800 bg-slate-200/70 font-bold">
                <th className="border-r border-slate-800 p-1 text-center font-black">SUBJECTS</th>
                <th colSpan={9} className="p-0" />
              </tr>
            </thead>
            <tbody>
              {displayedSubjects.map((row, idx) => {
                const firstCa = resolveFirstCa(row);
                const secondCa = resolveSecondCa(row);
                const total = Math.min(100, (row.assignmentScore || 0) + firstCa + secondCa + (row.examScore || 0));
                const hasScores = total > 0 || row.assignmentScore > 0 || row.examScore > 0 || firstCa > 0 || secondCa > 0;
                const gradeObj = hasScores ? calculateHwsGrade(total) : { grade: '', remark: row.remark || '' };

                return (
                  <tr key={row.id || idx} className="border-b border-slate-800 hover:bg-slate-50/50">
                    <td className="border-r border-slate-800 p-1 font-bold text-left px-2 text-[10px] sm:text-[11px] text-slate-950 uppercase">
                      {!isPrintClone && isEditingInline ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={row.subjectName}
                            onChange={(e) => handleSubjectRowChange(idx, 'subjectName', e.target.value)}
                            className="w-full font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveSubjectRow(idx)}
                            className="text-rose-500 hover:text-rose-700 shrink-0 cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        row.subjectName
                      )}
                    </td>
                    <td className="border-r border-slate-800 p-1 font-semibold text-slate-900">
                      {!isPrintClone && isEditingInline ? (
                        <input
                          type="number"
                          min="0"
                          max={caMeta.assignmentMax}
                          value={row.assignmentScore || 0}
                          onChange={(e) => handleSubjectRowChange(idx, 'assignmentScore', e.target.value)}
                          className="w-10 text-center bg-blue-50 border-b border-blue-400 font-bold"
                        />
                      ) : (
                        hasScores ? row.assignmentScore : ''
                      )}
                    </td>
                    <td className="border-r border-slate-800 p-1 font-semibold text-slate-900">
                      {!isPrintClone && isEditingInline ? (
                        <input
                          type="number"
                          min="0"
                          max={caMeta.firstCaMax}
                          value={firstCa}
                          onChange={(e) => handleSubjectRowChange(idx, 'firstCaScore', e.target.value)}
                          className="w-10 text-center bg-blue-50 border-b border-blue-400 font-bold"
                        />
                      ) : (
                        hasScores ? firstCa : ''
                      )}
                    </td>
                    <td className="border-r border-slate-800 p-1 font-semibold text-slate-900">
                      {!isPrintClone && isEditingInline ? (
                        <input
                          type="number"
                          min="0"
                          max={caMeta.secondCaMax}
                          value={secondCa}
                          onChange={(e) => handleSubjectRowChange(idx, 'secondCaScore', e.target.value)}
                          className="w-10 text-center bg-blue-50 border-b border-blue-400 font-bold"
                        />
                      ) : (
                        hasScores ? secondCa : ''
                      )}
                    </td>
                    <td className="border-r border-slate-800 p-1 font-semibold text-slate-900">
                      {!isPrintClone && isEditingInline ? (
                        <input
                          type="number"
                          min="0"
                          max={caMeta.examMax}
                          value={row.examScore || 0}
                          onChange={(e) => handleSubjectRowChange(idx, 'examScore', e.target.value)}
                          className="w-10 text-center bg-blue-50 border-b border-blue-400 font-bold"
                        />
                      ) : (
                        hasScores ? row.examScore : ''
                      )}
                    </td>
                    <td className="border-r border-slate-800 p-1 font-bold text-slate-950">
                      {hasScores ? total : ''}
                    </td>
                    <td className="border-r border-slate-800 p-1 font-bold text-slate-950">
                      {hasScores ? (row.grade || gradeObj.grade) : ''}
                    </td>

                    {/* Class average cell spanning vertically */}
                    {idx === 0 ? (
                      <td
                        rowSpan={displayedSubjects.length}
                        className="border-r border-slate-800 p-1 font-black text-xs sm:text-sm text-slate-950 bg-slate-50/30 align-middle text-center"
                      >
                        {!isPrintClone && isEditingInline ? (
                          <input
                            type="text"
                            placeholder={totals.computedAverage}
                            value={formData.classAverage || ''}
                            onChange={(e) => setFormData({ ...formData, classAverage: e.target.value })}
                            className="w-14 text-center font-black bg-blue-50 border-b border-blue-500 text-xs"
                          />
                        ) : (
                          formData.classAverage || totals.computedAverage
                        )}
                      </td>
                    ) : null}

                    <td className="border-r border-slate-800 p-1 font-bold text-[10px] text-slate-900 uppercase">
                      {hasScores ? (row.remark || gradeObj.remark) : row.remark === 'WITHHELD' ? 'WITHHELD' : ''}
                    </td>
                    <td className="p-1 text-[9px] text-slate-500 italic">
                      {!isPrintClone && isEditingInline ? (
                        <input
                          type="text"
                          value={row.teacherSignature || ''}
                          placeholder="Signed"
                          onChange={(e) => handleSubjectRowChange(idx, 'teacherSignature', e.target.value)}
                          className="w-16 text-center bg-blue-50 border-b border-blue-400 text-[9px]"
                        />
                      ) : (
                        hasScores ? (row.teacherSignature || 'Signed') : ''
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Add subject button while editing */}
              {!isPrintClone && isEditingInline && (
                <tr className="border-b border-slate-800 bg-blue-50/40 no-print">
                  <td colSpan={10} className="p-1 text-left px-2">
                    <button
                      type="button"
                      onClick={handleAddSubjectRow}
                      className="text-[10px] font-bold text-blue-900 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Another Subject Row</span>
                    </button>
                  </td>
                </tr>
              )}

              {/* TOTAL ROW */}
              <tr className="border-t-2 border-slate-900 bg-slate-100 font-black text-slate-950">
                <td className="border-r border-slate-800 p-1 font-black text-left px-2 uppercase">
                  TOTAL:
                </td>
                <td className="border-r border-slate-800 p-1 font-black">
                  {totals.assignmentTotal}
                </td>
                <td className="border-r border-slate-800 p-1 font-black">
                  {totals.firstCaTotal}
                </td>
                <td className="border-r border-slate-800 p-1 font-black">
                  {totals.secondCaTotal}
                </td>
                <td className="border-r border-slate-800 p-1 font-black">
                  {totals.examTotal}
                </td>
                <td className="border-r border-slate-800 p-1 font-black text-xs">
                  {totals.grandTotal}
                </td>
                <td colSpan={4} className="p-1 bg-slate-100" />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================
          PAGE 2: BEHAVIOURS, SKILLS, REMARKS & ANALYTIC CHARTS
          ======================================================== */}
      <section className="hws-page-2">
        {/* Top Double Line Accent on Page 2 */}
        <div className="border-t-2 border-b border-slate-900 pb-0.5 mb-3" />

        {/* Side-by-side Psychomotor Tables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* Left: BEHAVIOURS ASSESSMENT */}
          <div className="border border-slate-800 text-[10px] sm:text-[11px]">
            <div className="grid grid-cols-12 bg-slate-200 border-b border-slate-800 font-bold text-slate-950 text-center">
              <div className="col-span-7 border-r border-slate-800 p-1 uppercase text-left px-2">
                BEHAVIOURS ASSESSMENT
              </div>
              <div className="col-span-5 p-1 uppercase">
                RATING
              </div>
            </div>
            <div>
              {behaviourTraits.map((t, idx) => {
                const ratingVal = formData.behaviours[t.key] || 5;
                const ratingLabel = KEY_RATING_LABELS[ratingVal] || 'EXCELLENT';
                return (
                  <div
                    key={t.key}
                    className={`grid grid-cols-12 border-b border-slate-800 ${
                      idx === behaviourTraits.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <div className="col-span-7 border-r border-slate-800 px-2 py-0.5 font-bold uppercase text-slate-900">
                      {t.label}
                    </div>
                    <div className="col-span-2 border-r border-slate-800 text-center py-0.5 font-bold font-mono">
                      {!isPrintClone && isEditingInline ? (
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={ratingVal}
                          onChange={(e) => {
                            const v = Math.min(5, Math.max(1, Number(e.target.value) || 5));
                            setFormData({
                              ...formData,
                              behaviours: { ...formData.behaviours, [t.key]: v }
                            });
                          }}
                          className="w-full text-center font-bold bg-blue-50 border-b border-blue-500"
                        />
                      ) : (
                        ratingVal
                      )}
                    </div>
                    <div className="col-span-3 text-center py-0.5 font-bold text-slate-950 text-[10px]">
                      {ratingLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: SKILLS ASSESSMENT & KEY RATING */}
          <div className="space-y-3">
            <div className="border border-slate-800 text-[10px] sm:text-[11px]">
              <div className="grid grid-cols-12 bg-slate-200 border-b border-slate-800 font-bold text-slate-950 text-center">
                <div className="col-span-7 border-r border-slate-800 p-1 uppercase text-left px-2">
                  SKILLS ASSESSMENT
                </div>
                <div className="col-span-5 p-1 uppercase">
                  RATING
                </div>
              </div>
              <div>
                {skillTraits.map((s, idx) => {
                  const ratingVal = formData.skills[s.key] || 5;
                  const ratingLabel = KEY_RATING_LABELS[ratingVal] || 'EXCELLENT';
                  return (
                    <div
                      key={s.key}
                      className={`grid grid-cols-12 border-b border-slate-800 ${
                        idx === skillTraits.length - 1 ? 'border-b-0' : ''
                      }`}
                    >
                      <div className="col-span-7 border-r border-slate-800 px-2 py-0.5 font-bold uppercase text-slate-900">
                        {s.label}
                      </div>
                      <div className="col-span-2 border-r border-slate-800 text-center py-0.5 font-bold font-mono">
                        {!isPrintClone && isEditingInline ? (
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={ratingVal}
                            onChange={(e) => {
                              const v = Math.min(5, Math.max(1, Number(e.target.value) || 5));
                              setFormData({
                                ...formData,
                                skills: { ...formData.skills, [s.key]: v }
                              });
                            }}
                            className="w-full text-center font-bold bg-blue-50 border-b border-blue-500"
                          />
                        ) : (
                          ratingVal
                        )}
                      </div>
                      <div className="col-span-3 text-center py-0.5 font-bold text-slate-950 text-[10px]">
                        {ratingLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* KEY RATING LEGEND BOX */}
            <div className="border border-slate-800 text-[9px] sm:text-[10px]">
              <div className="bg-slate-200 border-b border-slate-800 font-bold text-center py-0.5 uppercase tracking-wider text-slate-950">
                KEY RATING
              </div>
              <div className="grid grid-cols-5 text-center font-bold border-b border-slate-800">
                <div className="border-r border-slate-800 py-0.5">5</div>
                <div className="border-r border-slate-800 py-0.5">4</div>
                <div className="border-r border-slate-800 py-0.5">3</div>
                <div className="border-r border-slate-800 py-0.5">2</div>
                <div className="py-0.5">1</div>
              </div>
              <div className="grid grid-cols-5 text-center font-bold text-[9px]">
                <div className="border-r border-slate-800 py-1">EXCELLENT</div>
                <div className="border-r border-slate-800 py-1">GOOD</div>
                <div className="border-r border-slate-800 py-1">FAIR</div>
                <div className="border-r border-slate-800 py-1">POOR</div>
                <div className="py-1">VERY POOR</div>
              </div>
            </div>
          </div>
        </div>

        {/* Comments & Administrative Section */}
        <div className="border border-slate-800 text-[10px] sm:text-[11px] mb-3">
          <div className="bg-slate-200 border-b border-slate-800 px-2 py-0.5 font-bold text-slate-950 uppercase">
            COMMENTS:
          </div>

          {/* Class Teacher's Remarks */}
          <div className="border-b border-slate-800 p-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-bold text-slate-950 w-52 shrink-0 uppercase">
              CLASS TEACHER'S REMARKS:
            </span>
            {!isPrintClone && isEditingInline ? (
              <input
                type="text"
                value={formData.classTeacherRemarks || ''}
                onChange={(e) => setFormData({ ...formData, classTeacherRemarks: e.target.value })}
                className="w-full font-bold uppercase text-slate-900 border-b border-blue-500 bg-blue-50 px-1"
              />
            ) : (
              <span className="font-bold text-slate-950 uppercase tracking-wide">
                {formData.classTeacherRemarks || "STAY FOCUS AND YOU'LL REACH YOUR GOALS."}
              </span>
            )}
          </div>

          {/* Principal's Remarks */}
          <div className="border-b border-slate-800 p-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-bold text-slate-950 w-52 shrink-0 uppercase">
              PRINCIPAL'S REMARKS:
            </span>
            {!isPrintClone && isEditingInline ? (
              <input
                type="text"
                value={formData.principalRemarks || ''}
                onChange={(e) => setFormData({ ...formData, principalRemarks: e.target.value })}
                className="w-full font-bold uppercase text-slate-900 border-b border-blue-500 bg-blue-50 px-1"
              />
            ) : (
              <span className="font-bold text-slate-950 uppercase tracking-wide">
                {formData.principalRemarks || "GOOD PROGRESS! BUT MORE EFFORT ARE NEEDED."}
              </span>
            )}
          </div>

          {/* Next Term Begins & Fees */}
          <div className="border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2">
            <div className="border-b sm:border-b-0 sm:border-r border-slate-800 p-2 flex items-center gap-2">
              <span className="font-bold text-slate-950 shrink-0 uppercase">
                NEXT TERM BEGINS:
              </span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.nextTermBegins || ''}
                  onChange={(e) => setFormData({ ...formData, nextTermBegins: e.target.value })}
                  className="w-full font-bold uppercase border-b border-blue-500 bg-blue-50 px-1"
                />
              ) : (
                <span className="font-bold text-slate-950 uppercase">
                  {formData.nextTermBegins || '5TH JANUARY, 2026'}
                </span>
              )}
            </div>
            <div className="p-2 flex items-center gap-2">
              <span className="font-bold text-slate-950 shrink-0 uppercase">
                NEXT TERM FEES:
              </span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.nextTermFees || ''}
                  onChange={(e) => setFormData({ ...formData, nextTermFees: e.target.value })}
                  className="w-full font-bold uppercase border-b border-blue-500 bg-blue-50 px-1"
                />
              ) : (
                <span className="font-bold text-slate-950 uppercase">
                  ₦{formData.nextTermFees || '26,000'}
                </span>
              )}
            </div>
          </div>

          {/* Principal's Signature & Proprietress Signature */}
          <div className="grid grid-cols-2">
            <div className="border-r border-slate-800 p-2 min-h-[46px] flex items-center justify-between gap-2">
              <span className="font-bold text-slate-950 uppercase shrink-0">
                PRINCIPAL'S SIGNATURE:
              </span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.principalSignature || ''}
                  onChange={(e) => setFormData({ ...formData, principalSignature: e.target.value })}
                  className="w-full font-serif italic font-bold text-blue-900 border-b border-blue-500 bg-blue-50 px-2 text-center"
                />
              ) : (
                <div className="font-serif italic font-bold text-blue-900 border-b border-slate-400 px-4">
                  {formData.principalSignature || 'Signed & Approved'}
                </div>
              )}
            </div>
            <div className="p-2 min-h-[46px] flex items-center justify-between gap-2">
              <span className="font-bold text-slate-950 uppercase shrink-0">
                PROPRIETRESS SIGNATURE:
              </span>
              {!isPrintClone && isEditingInline ? (
                <input
                  type="text"
                  value={formData.proprietressSignature || ''}
                  onChange={(e) => setFormData({ ...formData, proprietressSignature: e.target.value })}
                  className="w-full font-serif italic font-bold text-blue-900 border-b border-blue-500 bg-blue-50 px-2 text-center"
                />
              ) : (
                <div className="font-serif italic font-bold text-blue-900 border-b border-slate-400 px-4">
                  {formData.proprietressSignature || 'Signed'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Visual Analytics Charts (Exact Recreation from Page 2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Chart 1: BEHAVIOURS ASSESSMENT BAR CHART */}
          <div className="border border-slate-300 rounded p-2 bg-white">
            <div className="bg-slate-300 text-slate-900 font-bold text-center py-0.5 text-[10px] uppercase mb-1">
              BEHAVIOURS ASSESSMENT
            </div>
            <svg viewBox="0 0 360 175" className="w-full h-auto">
              {[0, 1, 2, 3, 4, 5, 6].map((tick) => {
                const y = 140 - tick * 20;
                return (
                  <g key={tick}>
                    <text x="18" y={y + 3} fontSize="8" fill="#475569" textAnchor="end" fontFamily="monospace">
                      {tick}
                    </text>
                    <line x1="24" y1={y} x2="350" y2={y} stroke="#e2e8f0" strokeWidth="0.8" />
                  </g>
                );
              })}

              <line x1="24" y1="20" x2="24" y2="140" stroke="#94a3b8" strokeWidth="1" />
              <line x1="24" y1="140" x2="350" y2="140" stroke="#94a3b8" strokeWidth="1" />

              {behaviourTraits.map((t, idx) => {
                const rating = formData.behaviours[t.key] || 5;
                const barWidth = 12;
                const x = 32 + idx * 35;
                const barHeight = rating * 20;
                const y = 140 - barHeight;

                return (
                  <g key={t.key}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      fill="#ea580c"
                      rx="1"
                    />
                    <text
                      x={x + barWidth / 2}
                      y="148"
                      fontSize="5.2"
                      fill="#334155"
                      fontWeight="bold"
                      textAnchor="end"
                      transform={`rotate(-40, ${x + barWidth / 2}, 148)`}
                    >
                      {t.label}
                    </text>
                  </g>
                );
              })}

              <g transform="translate(150, 166)">
                <rect x="0" y="0" width="6" height="6" fill="#ea580c" />
                <text x="10" y="5.5" fontSize="6.5" fill="#475569" fontWeight="bold">RATING</text>
              </g>
            </svg>
          </div>

          {/* Chart 2: SKILLS ASSESSMENT LINE CHART */}
          <div className="border border-slate-300 rounded p-2 bg-white">
            <div className="bg-slate-300 text-slate-900 font-bold text-center py-0.5 text-[10px] uppercase mb-1">
              SKILLS ASSESSMENT
            </div>
            <svg viewBox="0 0 360 175" className="w-full h-auto">
              {[0, 1, 2, 3, 4, 5, 6].map((tick) => {
                const y = 140 - tick * 20;
                return (
                  <g key={tick}>
                    <text x="18" y={y + 3} fontSize="8" fill="#475569" textAnchor="end" fontFamily="monospace">
                      {tick}
                    </text>
                    <line x1="24" y1={y} x2="350" y2={y} stroke="#e2e8f0" strokeWidth="0.8" />
                  </g>
                );
              })}

              <line x1="24" y1="20" x2="24" y2="140" stroke="#94a3b8" strokeWidth="1" />
              <line x1="24" y1="140" x2="350" y2="140" stroke="#94a3b8" strokeWidth="1" />

              {(() => {
                const points = skillTraits.map((s, idx) => {
                  const rating = formData.skills[s.key] || 5;
                  const x = 50 + idx * 60;
                  const y = 140 - rating * 20;
                  return { x, y, label: s.label, rating };
                });

                const pathD = points.reduce((acc, pt, idx) => {
                  return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
                }, '');

                return (
                  <g>
                    <path d={pathD} fill="none" stroke="#ea580c" strokeWidth="2" />
                    {points.map((pt, idx) => (
                      <g key={idx}>
                        <circle cx={pt.x} cy={pt.y} r="3.5" fill="#ea580c" stroke="#ffffff" strokeWidth="1" />
                        <text
                          x={pt.x}
                          y="148"
                          fontSize="6.5"
                          fill="#334155"
                          fontWeight="bold"
                          textAnchor="end"
                          transform={`rotate(-40, ${pt.x}, 148)`}
                        >
                          {pt.label}
                        </text>
                      </g>
                    ))}
                  </g>
                );
              })()}

              <g transform="translate(150, 166)">
                <circle cx="3" cy="3" r="3" fill="#ea580c" />
                <text x="10" y="5.5" fontSize="6.5" fill="#475569" fontWeight="bold">RATING</text>
              </g>
            </svg>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div className="w-full text-slate-900 bg-white">
      {/* Action Bar (Screen Only, Hidden in Print) */}
      <div className="no-print bg-slate-900 text-white p-3 sm:p-4 rounded-xl mb-4 shadow-md flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-500">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-xs sm:text-sm uppercase tracking-wider text-white">
            Official End of Term Report Sheet — {formData.studentName}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isEditable && (
            <button
              type="button"
              onClick={handleToggleEditMode}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                isEditingInline
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-white/10 text-white hover:bg-white/20 border-white/20'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditingInline ? 'Finish Editing' : 'Edit All Fields'}</span>
            </button>
          )}

          {isEditable && isEditingInline && (
            <button
              type="button"
              onClick={handleSaveReport}
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save to Database</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadSlip}
            className="px-3 py-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download standalone report sheet file for phone or PC"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Slip</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 text-xs font-bold bg-blue-700 hover:bg-blue-600 text-white rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer active:scale-98"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Print / Save PDF</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Inline Save Feedback Banner */}
      {saveFeedback && (
        <div
          className={`no-print mb-4 px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            saveFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {saveFeedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
          )}
          <span>{saveFeedback.text}</span>
        </div>
      )}

      {/* STYLES FOR EXACT 2-PAGE PRINT REPRODUCTION */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .hws-sheet-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
          }
          .hws-page-1 {
            page-break-after: always !important;
            break-after: page !important;
            padding-bottom: 0 !important;
          }
          .hws-page-2 {
            page-break-before: always !important;
            break-before: page !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            padding-top: 6px !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 8mm 8mm 8mm;
          }
        }
      `}</style>

      {/* SCREEN PREVIEW */}
      {renderSheetContent(false)}

      {/* DEDICATED ISOLATED PRINT PORTAL SO MODALS PRINT CLEANLY WITHOUT BACKGROUND DASHBOARDS */}
      {usePrintPortal && printContainer && createPortal(renderSheetContent(true), printContainer)}
    </div>
  );
};
