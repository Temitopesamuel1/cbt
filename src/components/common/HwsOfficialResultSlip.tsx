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
  AlertCircle,
  Eye,
  Upload,
  RotateCcw
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
  deleteAssessmentRecord,
  fetchSubjects,
  fetchSchoolSettings,
  saveSchoolSettings,
  subscribeSchoolSettings
} from '../../services/firebase';
import { compressLogoFile } from '../../services/imageUtils';
import { DEFAULT_SCHOOL_SETTINGS, DEFAULT_SUBJECTS } from '../../data/initialSchoolData';

interface HwsOfficialResultSlipProps {
  student: Student;
  reportData?: StudentTermReportData | null;
  subjectRecords?: StudentAssessmentRecord[];
  draftRecords?: StudentAssessmentRecord[];
  settings?: SchoolSettings;
  academicSession?: string;
  term?: '1st Term' | '2nd Term' | '3rd Term';
  isEditable?: boolean;
  usePrintPortal?: boolean;
  onSaved?: (updated: StudentTermReportData) => void;
  onClose?: () => void;
}

const DEFAULT_CUSTOM_LABELS: Record<string, string> = {
  tableHeaderLine1: 'ANNUAL ACADEMIC',
  tableHeaderLine2: 'PERFORMANCE',
  subjectsHeading: 'SUBJECTS',
  totalScoreHeading: 'TOTAL SCORE',
  gradeHeading: 'GRADE',
  classAverageHeading: 'CLASS AVERAGE',
  remarksHeading: 'REMARKS',
  signatureHeading: 'TEACHERS SIGNATURE',
  totalRowLabel: 'TOTAL:',
  behavioursTitle: 'BEHAVIOURS ASSESSMENT',
  skillsTitle: 'SKILLS ASSESSMENT',
  ratingTitle: 'RATING',
  keyRatingTitle: 'KEY RATING',
  keyRating5: '5',
  keyRating4: '4',
  keyRating3: '3',
  keyRating2: '2',
  keyRating1: '1',
  keyLabel5: KEY_RATING_LABELS[5] || 'EXCELLENT',
  keyLabel4: KEY_RATING_LABELS[4] || 'GOOD',
  keyLabel3: KEY_RATING_LABELS[3] || 'FAIR',
  keyLabel2: KEY_RATING_LABELS[2] || 'POOR',
  keyLabel1: KEY_RATING_LABELS[1] || 'VERY POOR',
  commentsTitle: 'COMMENTS:',
  classTeacherRemarkLabel: "CLASS TEACHER'S REMARKS:",
  principalRemarkLabel: "PRINCIPAL'S REMARKS:",
  nextTermBeginsLabel: 'NEXT TERM BEGINS:',
  nextTermFeesLabel: 'NEXT TERM FEES:',
  principalSigLabel: "PRINCIPAL'S SIGNATURE:",
  proprietressSigLabel: 'PROPRIETRESS SIGNATURE:',
  beh_punctuality: 'PUNCTUALITY',
  beh_classAttendance: 'CLASS ATTENDANCE',
  beh_personalHygiene: 'PERSONAL HYGIENE',
  beh_attentiveness: 'ATTENTIVENESS',
  beh_honesty: 'HONESTY',
  beh_neatness: 'NEATNESS',
  beh_participationAtWork: 'PARTICIPATION AT WORK',
  beh_selfControl: 'SELF-CONTROL',
  beh_initiative: 'INITIATIVE',
  sk_handwriting: 'HANDWRITING',
  sk_drawingPainting: 'DRAWING / PAINTING',
  sk_gamesSports: 'GAMES & SPORTS',
  sk_readingFluency: 'READING FLUENCY',
  sk_handlingOfTools: 'HANDLING OF TOOLS & LAB.'
};

const calculateHwsGrade = (score: number, maxTotal = 100): { grade: string; remark: string } => {
  const pct = maxTotal > 0 ? (score / maxTotal) * 100 : score;
  if (pct >= 75) return { grade: 'A', remark: 'EXCELLENT' };
  if (pct >= 60) return { grade: 'B', remark: 'V.GOOD' };
  if (pct >= 50) return { grade: 'C', remark: 'GOOD' };
  if (pct >= 40) return { grade: 'D', remark: 'FAIR' };
  return { grade: 'F9', remark: 'FAIL' };
};

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

const normalizeTermCode = (val?: string) => {
  const clean = (val || '').trim().toLowerCase().replace(/[\s\-_]/g, '');
  if (clean.startsWith('first') || clean === '1st') return '1stterm';
  if (clean.startsWith('second') || clean === '2nd') return '2ndterm';
  if (clean.startsWith('third') || clean === '3rd') return '3rdterm';
  return clean;
};

const normalizeSessionCode = (val?: string) =>
  (val || '').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const normalizeSubjectKey = (name?: string) =>
  (name || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const hasEnteredScores = (r: StudentAssessmentRecord): boolean => {
  const firstCa = resolveFirstCa(r);
  const secondCa = resolveSecondCa(r);
  return (
    Boolean(r.explicitlySaved) ||
    Boolean(r.isAutoSynced) ||
    (Array.isArray(r.examEntries) && r.examEntries.length > 0) ||
    (r.assignmentScore || 0) > 0 ||
    firstCa > 0 ||
    secondCa > 0 ||
    (r.examScore || 0) > 0 ||
    (r.totalScore || 0) > 0 ||
    Boolean(r.teacherComment && r.teacherComment.trim().length > 0)
  );
};

export const HwsOfficialResultSlip: React.FC<HwsOfficialResultSlipProps> = ({
  student,
  reportData,
  subjectRecords,
  draftRecords,
  settings,
  academicSession = '2025/2026',
  term = '1st Term',
  isEditable = false,
  usePrintPortal = true,
  onSaved,
  onClose
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [printContainer, setPrintContainer] = useState<HTMLElement | null>(null);

  const [liveSettings, setLiveSettings] = useState<SchoolSettings>(() => ({
    ...DEFAULT_SCHOOL_SETTINGS,
    ...(settings || {}),
    caWeights: resolveCaWeights(settings?.caWeights)
  }));
  const [caMeta, setCaMeta] = useState<Required<CaWeightsConfig>>(() =>
    resolveCaWeights(settings?.caWeights)
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
      const resolved = resolveCaWeights(st.caWeights);
      setLiveSettings({ ...DEFAULT_SCHOOL_SETTINGS, ...st, caWeights: resolved });
      setCaMeta(resolved);
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
    }

    const unsubSettings = subscribeSchoolSettings((live) => {
      if (live) {
        applySettings(live);
      }
    });

    const handleSettingsUpdated = (e: Event) => {
      const detail = (e as CustomEvent<SchoolSettings>).detail;
      if (detail) applySettings(detail);
    };
    window.addEventListener('schoolSettingsUpdated', handleSettingsUpdated);
    return () => {
      unsubSettings();
      window.removeEventListener('schoolSettingsUpdated', handleSettingsUpdated);
    };
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
    if (reportData) return { ...reportData, customLabels: { ...DEFAULT_CUSTOM_LABELS, ...(reportData.customLabels || {}) } };
    const cleanStuId = (student.id || student.admissionNumber || 'stu').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanSess = (academicSession || '2025-2026').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanTrm = (term || '1stTerm').replace(/[^a-zA-Z0-9_-]/g, '_');
    const clsUpper = (student.classGrade || '').toUpperCase();
    return {
      id: `report_${cleanStuId}_${cleanSess}_${cleanTrm}`,
      studentId: student.id,
      studentName: student.fullName || '',
      admissionNumber: student.admissionNumber || '',
      classGrade: student.classGrade || '',
      academicSession,
      term,
      age: '',
      house: '',
      sex: student.gender || '',
      noInClass: '',
      department: student.department || '',
      category: clsUpper.includes('JSS') ? 'JUNIOR SECONDARY' : 'SENIOR SECONDARY',
      classAverage: '',
      overallPosition: '',
      behaviours: { ...DEFAULT_PSYCHOMOTOR },
      skills: { ...DEFAULT_SKILLS },
      classTeacherRemarks: "STAY FOCUS AND YOU'LL REACH YOUR GOALS.",
      principalRemarks: "GOOD PROGRESS! BUT MORE EFFORT ARE NEEDED.",
      nextTermBegins: "5TH JANUARY, 2026",
      nextTermFees: "26,000",
      principalSignature: 'Signed',
      proprietressSignature: 'Signed',
      customLabels: { ...DEFAULT_CUSTOM_LABELS },
      updatedAt: new Date().toISOString()
    };
  });

  const [liveCaRecords, setLiveCaRecords] = useState<StudentAssessmentRecord[]>(subjectRecords || []);
  const [schoolSubjects, setSchoolSubjects] = useState<Subject[]>(DEFAULT_SUBJECTS);
  const [editableRows, setEditableRows] = useState<StudentAssessmentRecord[] | null>(null);
  const [removedRecordIds, setRemovedRecordIds] = useState<string[]>([]);
  // Default immediately to inline edit mode when teacher/admin opens an editable slip
  const [isEditingInline, setIsEditingInline] = useState<boolean>(isEditable);
  const [selectedAddSubjectId, setSelectedAddSubjectId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setIsEditingInline(isEditable);
  }, [isEditable]);

  const getLabel = (key: string) =>
    (formData.customLabels && formData.customLabels[key] !== undefined
      ? formData.customLabels[key]
      : DEFAULT_CUSTOM_LABELS[key]) || '';

  const setLabel = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      customLabels: {
        ...DEFAULT_CUSTOM_LABELS,
        ...(prev.customLabels || {}),
        [key]: value
      }
    }));
  };

  // Sync if explicit props update
  useEffect(() => {
    if (reportData) {
      setFormData({
        ...reportData,
        customLabels: { ...DEFAULT_CUSTOM_LABELS, ...(reportData.customLabels || {}) }
      });
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
          setFormData({
            ...fetched,
            studentName: fetched.studentName || student.fullName,
            admissionNumber: fetched.admissionNumber || student.admissionNumber,
            classGrade: fetched.classGrade || student.classGrade,
            customLabels: { ...DEFAULT_CUSTOM_LABELS, ...(fetched.customLabels || {}) }
          });
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
  }, [student.id, student.admissionNumber, student.fullName, student.classGrade, academicSession, term, reportData]);

  // Load school subjects for optional "+ Add Subject" selector when editing
  useEffect(() => {
    let mounted = true;
    fetchSubjects().then(subs => {
      if (mounted && subs && subs.length > 0) {
        setSchoolSubjects(subs);
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Subscribe live to ALL student CA records across every subject
  useEffect(() => {
    if (subjectRecords && subjectRecords.length > 0) return;
    const unsub = subscribeStudentAssessmentRecords(
      student.id,
      student.admissionNumber,
      (records) => {
        const targetTerm = normalizeTermCode(term);
        const matching = records.filter(r => {
          const rTerm = normalizeTermCode(r.term);
          if (targetTerm && rTerm && rTerm !== targetTerm) return false;
          return true;
        });
        setLiveCaRecords(matching);
      }
    );
    return () => unsub();
  }, [student.id, student.admissionNumber, term, subjectRecords]);

  // Build dynamic subject rows ONLY from subjects actually entered by teachers (+ any unsaved draftRecords)
  const computedSubjects = useMemo<StudentAssessmentRecord[]>(() => {
    const maxTotal =
      (caMeta.assignmentMax || 0) +
      (caMeta.firstCaMax || 0) +
      (caMeta.secondCaMax || 0) +
      (caMeta.examMax || 0) || 100;

    const withheldSet = new Set(
      (!isEditable && student.withheldSubjectIds ? student.withheldSubjectIds : []).map(s => normalizeSubjectKey(s))
    );

    const normAdm = (student.admissionNumber || '').trim().toUpperCase();
    const combinedRaw: StudentAssessmentRecord[] = [...liveCaRecords];

    // Merge any unsaved live draftRecords belonging to this student for this term
    if (draftRecords && draftRecords.length > 0) {
      const targetTerm = normalizeTermCode(term);
      draftRecords.forEach(dr => {
        const drAdm = (dr.admissionNumber || '').trim().toUpperCase();
        const belongsToStudent =
          dr.studentId === student.id || (normAdm && drAdm && drAdm === normAdm);
        const drTerm = normalizeTermCode(dr.term);
        const termMatches = !targetTerm || !drTerm || drTerm === targetTerm;
        if (belongsToStudent && termMatches) {
          combinedRaw.push(dr);
        }
      });
    }

    // Deduplicate by normalized subject name, always preferring the most recently updated entry with entered scores
    const bySubjectMap = new Map<string, StudentAssessmentRecord>();
    const targetSessionNorm = normalizeSessionCode(academicSession);
    const subjNameById = new Map<string, string>();
    schoolSubjects.forEach(s => {
      if (s?.id && s?.name) subjNameById.set(s.id, s.name);
    });

    const resolveRecordSubjectName = (r: StudentAssessmentRecord) => {
      const rawName = (r.subjectName || '').trim();
      if (rawName && rawName.toLowerCase() !== 'subject') return rawName;
      return (r.subjectId && subjNameById.get(r.subjectId)) || rawName || r.subjectId || 'SUBJECT';
    };

    combinedRaw.forEach(r => {
      if (!hasEnteredScores(r)) return;
      const resolvedName = resolveRecordSubjectName(r);
      const key = normalizeSubjectKey(resolvedName || r.subjectId);
      if (!key) return;
      const normalizedRec = resolvedName !== r.subjectName ? { ...r, subjectName: resolvedName } : r;

      const existing = bySubjectMap.get(key);
      if (!existing) {
        bySubjectMap.set(key, normalizedRec);
        return;
      }

      const rMatchesSess = targetSessionNorm && normalizeSessionCode(normalizedRec.academicSession) === targetSessionNorm;
      const exMatchesSess = targetSessionNorm && normalizeSessionCode(existing.academicSession) === targetSessionNorm;
      if (rMatchesSess && !exMatchesSess) {
        bySubjectMap.set(key, normalizedRec);
        return;
      }
      if (!rMatchesSess && exMatchesSess) return;

      const tNew = new Date(normalizedRec.updatedAt || 0).getTime() || 0;
      const tOld = new Date(existing.updatedAt || 0).getTime() || 0;
      if (tNew >= tOld) {
        bySubjectMap.set(key, normalizedRec);
      }
    });

    const resultRows: StudentAssessmentRecord[] = [];
    bySubjectMap.forEach((rec, key) => {
      const isSubjectWithheld = !isEditable && (student.resultWithheld || withheldSet.has(key));
      if (isSubjectWithheld) {
        resultRows.push({
          ...rec,
          subjectName: (rec.subjectName || '').toUpperCase(),
          assignmentScore: 0,
          firstCaScore: 0,
          secondCaScore: 0,
          projectScore: 0,
          testScore: 0,
          examScore: 0,
          totalScore: 0,
          grade: '-',
          remark: 'WITHHELD',
          teacherSignature: ''
        });
        return;
      }

      const firstCa = resolveFirstCa(rec);
      const secondCa = resolveSecondCa(rec);
      const total = Math.min(maxTotal, (rec.assignmentScore || 0) + firstCa + secondCa + (rec.examScore || 0));
      const gradeInfo = (total > 0 || rec.explicitlySaved) ? calculateHwsGrade(total, maxTotal) : { grade: '', remark: '' };

      resultRows.push({
        ...rec,
        subjectName: (rec.subjectName || 'SUBJECT').toUpperCase(),
        firstCaScore: firstCa,
        secondCaScore: secondCa,
        testScore: firstCa,
        projectScore: secondCa,
        totalScore: total,
        grade: rec.grade || gradeInfo.grade,
        remark: (rec.remark || gradeInfo.remark).toUpperCase()
      });
    });

    // Sort subjects cleanly according to curriculum order first, then alphabetically
    const orderIndex = new Map<string, number>();
    schoolSubjects.forEach((s, i) => orderIndex.set(normalizeSubjectKey(s.name), i));
    resultRows.sort((a, b) => {
      const idxA = orderIndex.has(normalizeSubjectKey(a.subjectName))
        ? orderIndex.get(normalizeSubjectKey(a.subjectName))!
        : 9999;
      const idxB = orderIndex.has(normalizeSubjectKey(b.subjectName))
        ? orderIndex.get(normalizeSubjectKey(b.subjectName))!
        : 9999;
      if (idxA !== idxB) return idxA - idxB;
      return a.subjectName.localeCompare(b.subjectName);
    });

    return resultRows;
  }, [liveCaRecords, draftRecords, schoolSubjects, student, academicSession, term, isEditable, caMeta]);

  // Keep editableRows hydrated cleanly when computedSubjects changes & user hasn't modified rows yet
  useEffect(() => {
    if (!isEditable) {
      setEditableRows(null);
      return;
    }
    setEditableRows(prev => {
      if (!prev) {
        return computedSubjects.map(r => ({ ...r }));
      }
      // Merge newly entered live records that weren't in prev yet
      const existingKeys = new Set(prev.map(r => normalizeSubjectKey(r.subjectName)));
      const additions = computedSubjects
        .filter(r => !existingKeys.has(normalizeSubjectKey(r.subjectName)) && !removedRecordIds.includes(r.id))
        .map(r => ({ ...r }));
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }, [computedSubjects, isEditable, removedRecordIds]);

  const displayedSubjects = editableRows && isEditingInline ? editableRows : computedSubjects;

  // Toggle between Live Edit Mode & Clean Print Preview
  const handleToggleEditMode = () => {
    if (!isEditingInline) {
      setEditableRows(computedSubjects.map(r => ({ ...r })));
      setIsEditingInline(true);
    } else {
      setIsEditingInline(false);
    }
  };

  // Sync live data back into editor rows
  const handleSyncFromBroadsheet = () => {
    setRemovedRecordIds([]);
    setEditableRows(computedSubjects.map(r => ({ ...r })));
    setSaveFeedback({ text: `Synced ${computedSubjects.length} entered subject(s) from teacher broadsheet.`, type: 'success' });
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const maxTotalPossible =
    (caMeta.assignmentMax || 0) +
    (caMeta.firstCaMax || 0) +
    (caMeta.secondCaMax || 0) +
    (caMeta.examMax || 0) || 100;

  // Update individual subject row while editing inline
  const handleSubjectRowChange = (
    idx: number,
    field:
      | 'subjectName'
      | 'assignmentScore'
      | 'firstCaScore'
      | 'secondCaScore'
      | 'examScore'
      | 'totalScore'
      | 'grade'
      | 'remark'
      | 'teacherSignature',
    val: string
  ) => {
    setEditableRows(prev => {
      const list = prev ? [...prev] : computedSubjects.map(r => ({ ...r }));
      const row = { ...list[idx] };

      if (field === 'subjectName') {
        row.subjectName = val.toUpperCase();
      } else if (field === 'teacherSignature') {
        row.teacherSignature = val;
      } else if (field === 'grade') {
        row.grade = val.toUpperCase();
      } else if (field === 'remark') {
        row.remark = val.toUpperCase();
      } else if (field === 'totalScore') {
        const tot = Math.min(maxTotalPossible, Math.max(0, Number(val) || 0));
        row.totalScore = tot;
        const g = tot > 0 ? calculateHwsGrade(tot, maxTotalPossible) : { grade: '', remark: '' };
        row.grade = g.grade;
        row.remark = g.remark;
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
        const tot = Math.min(maxTotalPossible, (row.assignmentScore || 0) + first + second + (row.examScore || 0));
        row.totalScore = tot;
        const g = tot > 0 ? calculateHwsGrade(tot, maxTotalPossible) : { grade: '', remark: '' };
        row.grade = g.grade;
        row.remark = g.remark;
      }

      row.updatedAt = new Date().toISOString();
      list[idx] = row;
      return list;
    });
  };

  const handleAddSubjectRow = (subjectObj?: Subject) => {
    const cleanStuId = (student.id || student.admissionNumber || 'stu').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanSess = (formData.academicSession || academicSession || '2025-2026').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanTrm = (formData.term || term || '1stTerm').replace(/[^a-zA-Z0-9_-]/g, '_');
    const chosenId = subjectObj?.id || `sub_custom_${Date.now()}`;
    const cleanSub = chosenId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const newRow: StudentAssessmentRecord = {
      id: `ca_${cleanStuId}_${cleanSub}_${cleanSess}_${cleanTrm}`,
      studentId: student.id,
      studentName: formData.studentName || student.fullName,
      admissionNumber: formData.admissionNumber || student.admissionNumber,
      classGrade: formData.classGrade || student.classGrade,
      subjectId: chosenId,
      subjectName: (subjectObj?.name || 'NEW SUBJECT').toUpperCase(),
      academicSession: formData.academicSession || academicSession,
      term: (formData.term as any) || term,
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
      const target = prev[idx];
      if (target?.id) {
        setRemovedRecordIds(ids => [...ids, target.id]);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressLogoFile(file, 320, 220000);
      setHeaderMeta(prev => ({ ...prev, schoolLogo: compressed }));
    } catch (err: any) {
      setSaveFeedback({ text: err?.message || 'Could not process logo image.', type: 'error' });
      setTimeout(() => setSaveFeedback(null), 3500);
    }
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
      const tot = s.totalScore || ((s.assignmentScore || 0) + f + sec + (s.examScore || 0));
      if (tot > 0 || s.assignmentScore > 0 || s.examScore > 0 || f > 0 || sec > 0) {
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
      // 1. Save term report metadata (bio, psychomotor, skills, remarks, fees, signatures, customLabels)
      const reportToSave: StudentTermReportData = {
        ...formData,
        classAverage: formData.classAverage || totals.computedAverage,
        updatedAt: new Date().toISOString()
      };
      await saveStudentTermReport(reportToSave);

      // 2. Delete any explicitly removed saved rows
      for (const delId of removedRecordIds) {
        await deleteAssessmentRecord(delId).catch(() => {});
      }
      setRemovedRecordIds([]);

      // 3. Save any edited subject CA scores
      if (editableRows && editableRows.length > 0) {
        const modifiedRecords = editableRows
          .filter(r => hasEnteredScores(r))
          .map(r => {
            const first = resolveFirstCa(r);
            const second = resolveSecondCa(r);
            const tot = Math.min(maxTotalPossible, r.totalScore || ((r.assignmentScore || 0) + first + second + (r.examScore || 0)));
            return {
              ...r,
              studentName: formData.studentName || student.fullName,
              admissionNumber: formData.admissionNumber || student.admissionNumber,
              classGrade: formData.classGrade || student.classGrade,
              academicSession: formData.academicSession || academicSession,
              term: (formData.term as any) || term,
              firstCaScore: first,
              secondCaScore: second,
              testScore: first,
              projectScore: second,
              totalScore: tot,
              explicitlySaved: true,
              updatedAt: new Date().toISOString()
            };
          });
        if (modifiedRecords.length > 0) {
          await saveAssessmentBatch(modifiedRecords);
          setLiveCaRecords(modifiedRecords);
        }
      }

      // 4. Persist header & CA weighting/heading settings if modified
      const baseSettings = liveSettings || settings || DEFAULT_SCHOOL_SETTINGS;
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
        headerMeta.resultTitle !== baseSettings.resultTitle ||
        headerMeta.schoolLogo !== baseSettings.schoolLogo;

      if (headerChanged || weightsChanged) {
        await saveSchoolSettings({
          ...baseSettings,
          schoolName: headerMeta.schoolName,
          motto: headerMeta.motto,
          address: headerMeta.address,
          phone: headerMeta.phone,
          email: headerMeta.email,
          resultTitle: headerMeta.resultTitle,
          schoolLogo: headerMeta.schoolLogo,
          caWeights: {
            ...caMeta,
            version: 2,
            testMax: caMeta.firstCaMax,
            projectMax: caMeta.secondCaMax
          }
        });
      }

      setSaveFeedback({ text: 'All report card edits, custom headings & subject scores synchronized to database!', type: 'success' });
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
    .no-print-btn, .no-print { display: none !important; }
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
    link.download = `${(formData.studentName || 'Student').replace(/\s+/g, '_')}_${(formData.admissionNumber || 'Slip').replace(/[^a-zA-Z0-9]/g, '_')}_Report_Sheet.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Behaviours list (with editable trait labels via customLabels)
  const behaviourTraits: Array<{ key: keyof PsychomotorRating; labelKey: string }> = [
    { key: 'punctuality', labelKey: 'beh_punctuality' },
    { key: 'classAttendance', labelKey: 'beh_classAttendance' },
    { key: 'personalHygiene', labelKey: 'beh_personalHygiene' },
    { key: 'attentiveness', labelKey: 'beh_attentiveness' },
    { key: 'honesty', labelKey: 'beh_honesty' },
    { key: 'neatness', labelKey: 'beh_neatness' },
    { key: 'participationAtWork', labelKey: 'beh_participationAtWork' },
    { key: 'selfControl', labelKey: 'beh_selfControl' },
    { key: 'initiative', labelKey: 'beh_initiative' }
  ];

  // Skills list (with editable trait labels via customLabels)
  const skillTraits: Array<{ key: keyof SkillsRating; labelKey: string }> = [
    { key: 'handwriting', labelKey: 'sk_handwriting' },
    { key: 'drawingPainting', labelKey: 'sk_drawingPainting' },
    { key: 'gamesSports', labelKey: 'sk_gamesSports' },
    { key: 'readingFluency', labelKey: 'sk_readingFluency' },
    { key: 'handlingOfTools', labelKey: 'sk_handlingOfTools' }
  ];

  // Key rating dynamic labels
  const getRatingWord = (rating: number) => {
    const map: Record<number, string> = {
      5: getLabel('keyLabel5'),
      4: getLabel('keyLabel4'),
      3: getLabel('keyLabel3'),
      2: getLabel('keyLabel2'),
      1: getLabel('keyLabel1')
    };
    return map[rating] || KEY_RATING_LABELS[rating] || 'EXCELLENT';
  };

  // Reusable inner 2-page document JSX (rendered on screen AND inside print portal for crisp multi-page A4 output)
  const renderSheetContent = (isPrintClone = false) => {
    const editing = !isPrintClone && isEditingInline;
    const rowsToRender = isPrintClone ? computedSubjects : displayedSubjects;

    return (
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
            <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex flex-col items-center justify-center relative group">
              <img
                src={headerMeta.schoolLogo || '/school-logo.png'}
                alt="School Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.dataset.fallbackApplied) {
                    img.dataset.fallbackApplied = '1';
                    img.src = '/school-logo.png';
                  }
                }}
              />
              {editing && (
                <>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="no-print mt-0.5 px-1.5 py-0.5 bg-blue-900 text-white text-[8px] font-bold rounded flex items-center gap-0.5 cursor-pointer hover:bg-blue-700"
                    title="Upload / Replace School Logo"
                  >
                    <Upload className="w-2.5 h-2.5" />
                    <span>Logo</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex-1 text-center">
              {editing ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={headerMeta.schoolName}
                    onChange={(e) => setHeaderMeta({ ...headerMeta, schoolName: e.target.value.toUpperCase() })}
                    className="w-full text-center text-lg sm:text-2xl font-black uppercase border-b border-blue-500 bg-blue-50 px-2 focus:bg-white"
                  />
                  <input
                    type="text"
                    value={headerMeta.motto}
                    onChange={(e) => setHeaderMeta({ ...headerMeta, motto: e.target.value })}
                    className="w-full text-center text-xs italic border-b border-blue-400 bg-blue-50 px-2 focus:bg-white"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-[10px]">
                    <input
                      type="text"
                      value={headerMeta.address}
                      onChange={(e) => setHeaderMeta({ ...headerMeta, address: e.target.value })}
                      className="border-b border-blue-400 bg-blue-50 px-1 text-center focus:bg-white"
                      placeholder="School Address"
                    />
                    <input
                      type="text"
                      value={headerMeta.phone}
                      onChange={(e) => setHeaderMeta({ ...headerMeta, phone: e.target.value })}
                      className="border-b border-blue-400 bg-blue-50 px-1 text-center focus:bg-white"
                      placeholder="Phones"
                    />
                    <input
                      type="text"
                      value={headerMeta.email}
                      onChange={(e) => setHeaderMeta({ ...headerMeta, email: e.target.value })}
                      className="border-b border-blue-400 bg-blue-50 px-1 text-center focus:bg-white"
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
            {editing ? (
              <input
                type="text"
                value={headerMeta.resultTitle}
                onChange={(e) => setHeaderMeta({ ...headerMeta, resultTitle: e.target.value.toUpperCase() })}
                className="w-full text-center font-bold uppercase bg-blue-50 border-b border-blue-500 px-2 focus:bg-white"
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
                {editing ? (
                  <input
                    type="text"
                    value={formData.studentName}
                    onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                    className="w-full uppercase font-bold text-slate-900 border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
                  />
                ) : (
                  <span className="uppercase font-bold text-slate-950">{formData.studentName}</span>
                )}
              </div>
              <div className="col-span-4 border-r border-slate-800 px-2 py-1 flex items-center">
                <span className="font-bold w-28 shrink-0">ADMISSION NO:</span>
                {editing ? (
                  <input
                    type="text"
                    value={formData.admissionNumber}
                    onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
                    className="w-full font-mono font-bold border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
                  />
                ) : (
                  <span className="font-mono font-bold text-slate-950">{formData.admissionNumber}</span>
                )}
              </div>
              <div className="col-span-2 px-2 py-1 flex items-center">
                <span className="font-bold w-10 shrink-0">AGE:</span>
                {editing ? (
                  <input
                    type="text"
                    placeholder="14"
                    value={formData.age || ''}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full font-bold border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
                  />
                ) : (
                  <span className="font-bold text-slate-950">{formData.age || '-'}</span>
                )}
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-12 border-b border-slate-800">
              <div className="col-span-6 border-r border-slate-800 px-2 py-1 flex items-center">
                <span className="font-bold w-16 shrink-0">CLASS:</span>
                {editing ? (
                  <input
                    type="text"
                    value={formData.classGrade}
                    onChange={(e) => setFormData({ ...formData, classGrade: e.target.value })}
                    className="w-full uppercase font-bold border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
                  />
                ) : (
                  <span className="font-bold text-slate-950 uppercase">{formData.classGrade}</span>
                )}
              </div>
              <div className="col-span-4 border-r border-slate-800 px-2 py-1 flex items-center">
                <span className="font-bold w-20 shrink-0">HOUSE:</span>
                {editing ? (
                  <input
                    type="text"
                    placeholder="BLUE"
                    value={formData.house || ''}
                    onChange={(e) => setFormData({ ...formData, house: e.target.value })}
                    className="w-full uppercase font-bold border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
                  />
                ) : (
                  <span className="font-bold text-slate-950 uppercase">{formData.house || '-'}</span>
                )}
              </div>
              <div className="col-span-2 px-2 py-1 flex items-center">
                <span className="font-bold w-10 shrink-0">SEX:</span>
                {editing ? (
                  <input
                    type="text"
                    placeholder="M/F"
                    value={formData.sex || ''}
                    onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                    className="w-full uppercase font-bold border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
                  />
                ) : (
                  <span className="font-bold text-slate-950 uppercase">{formData.sex || '-'}</span>
                )}
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-12 border-b border-slate-800">
              <div className="col-span-6 border-r border-slate-800 px-2 py-1 flex items-center">
                <span className="font-bold w-28 shrink-0">NO IN CLASS:</span>
                {editing ? (
                  <input
                    type="text"
                    placeholder="e.g. 25"
                    value={formData.noInClass || ''}
                    onChange={(e) => setFormData({ ...formData, noInClass: e.target.value })}
                    className="w-full font-bold border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
                  />
                ) : (
                  <span className="font-bold text-slate-950">{formData.noInClass || '-'}</span>
                )}
              </div>
              <div className="col-span-4 border-r border-slate-800 px-2 py-1 flex items-center">
                <span className="font-bold w-28 shrink-0">DEPARTMENT:</span>
                {editing ? (
                  <input
                    type="text"
                    placeholder="Optional"
                    value={formData.department || ''}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full uppercase font-bold border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
                  />
                ) : (
                  <span className="font-bold text-slate-950 uppercase">{formData.department || ''}</span>
                )}
              </div>
              <div className="col-span-2 px-2 py-1 flex items-center">
                <span className="font-bold w-12 shrink-0">TERM:</span>
                {editing ? (
                  <input
                    type="text"
                    value={formData.term}
                    onChange={(e) => setFormData({ ...formData, term: e.target.value as any })}
                    className="w-full uppercase font-bold border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
                  />
                ) : (
                  <span className="font-bold text-slate-950 uppercase">{formData.term || '1ST TERM'}</span>
                )}
              </div>
            </div>

            {/* Row 4 */}
            <div className="px-2 py-1 flex items-center justify-between bg-slate-50/50 gap-3">
              <div className="flex items-center flex-1">
                <span className="font-bold w-24 shrink-0">CATEGORY:</span>
                {editing ? (
                  <input
                    type="text"
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full uppercase font-bold border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
                  />
                ) : (
                  <span className="font-bold text-slate-950 uppercase">{formData.category || 'SECONDARY'}</span>
                )}
              </div>
              <div className="text-[10px] font-mono font-bold text-slate-700 pl-3 flex items-center gap-1">
                <span>SESSION:</span>
                {editing ? (
                  <input
                    type="text"
                    value={formData.academicSession || academicSession}
                    onChange={(e) => setFormData({ ...formData, academicSession: e.target.value })}
                    className="w-24 font-mono font-bold border-b border-blue-500 bg-blue-50 px-1 text-center focus:bg-white"
                  />
                ) : (
                  <span>{formData.academicSession || academicSession}</span>
                )}
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
                    {editing ? (
                      <div className="space-y-0.5">
                        <input
                          type="text"
                          value={getLabel('tableHeaderLine1')}
                          onChange={(e) => setLabel('tableHeaderLine1', e.target.value)}
                          className="w-full text-center font-extrabold text-[10px] uppercase bg-blue-50 border-b border-blue-400 px-1"
                        />
                        <input
                          type="text"
                          value={getLabel('tableHeaderLine2')}
                          onChange={(e) => setLabel('tableHeaderLine2', e.target.value)}
                          className="w-full text-center font-extrabold text-[10px] uppercase bg-blue-50 border-b border-blue-400 px-1"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="font-extrabold text-[11px] sm:text-xs">{getLabel('tableHeaderLine1')}</div>
                        <div className="font-extrabold text-[11px] sm:text-xs">{getLabel('tableHeaderLine2')}</div>
                      </>
                    )}
                  </th>
                  <th className="border-r border-slate-800 p-1">
                    {editing ? (
                      <input
                        type="text"
                        value={caMeta.assignmentLabel}
                        onChange={(e) => setCaMeta({ ...caMeta, assignmentLabel: e.target.value })}
                        className="w-24 text-center text-[10px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-1 focus:bg-white"
                      />
                    ) : (
                      caMeta.assignmentLabel.toUpperCase()
                    )}
                  </th>
                  <th className="border-r border-slate-800 p-1">
                    {editing ? (
                      <input
                        type="text"
                        value={caMeta.firstCaLabel}
                        onChange={(e) => setCaMeta({ ...caMeta, firstCaLabel: e.target.value })}
                        className="w-20 text-center text-[10px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-1 focus:bg-white"
                      />
                    ) : (
                      caMeta.firstCaLabel.toUpperCase()
                    )}
                  </th>
                  <th className="border-r border-slate-800 p-1">
                    {editing ? (
                      <input
                        type="text"
                        value={caMeta.secondCaLabel}
                        onChange={(e) => setCaMeta({ ...caMeta, secondCaLabel: e.target.value })}
                        className="w-20 text-center text-[10px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-1 focus:bg-white"
                      />
                    ) : (
                      caMeta.secondCaLabel.toUpperCase()
                    )}
                  </th>
                  <th className="border-r border-slate-800 p-1">
                    {editing ? (
                      <input
                        type="text"
                        value={caMeta.examLabel}
                        onChange={(e) => setCaMeta({ ...caMeta, examLabel: e.target.value })}
                        className="w-24 text-center text-[10px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-1 focus:bg-white"
                      />
                    ) : (
                      caMeta.examLabel.toUpperCase()
                    )}
                  </th>
                  <th className="border-r border-slate-800 p-1">
                    {editing ? (
                      <input
                        type="text"
                        value={getLabel('totalScoreHeading')}
                        onChange={(e) => setLabel('totalScoreHeading', e.target.value)}
                        className="w-20 text-center text-[10px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                      />
                    ) : (
                      getLabel('totalScoreHeading')
                    )}
                  </th>
                  <th rowSpan={2} className="border-r border-slate-800 p-1 w-12">
                    {editing ? (
                      <input
                        type="text"
                        value={getLabel('gradeHeading')}
                        onChange={(e) => setLabel('gradeHeading', e.target.value)}
                        className="w-12 text-center text-[10px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-0.5"
                      />
                    ) : (
                      getLabel('gradeHeading')
                    )}
                  </th>
                  <th rowSpan={2} className="border-r border-slate-800 p-1 w-16">
                    {editing ? (
                      <input
                        type="text"
                        value={getLabel('classAverageHeading')}
                        onChange={(e) => setLabel('classAverageHeading', e.target.value)}
                        className="w-16 text-center text-[9px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-0.5"
                      />
                    ) : (
                      getLabel('classAverageHeading')
                    )}
                  </th>
                  <th rowSpan={2} className="border-r border-slate-800 p-1 w-20">
                    {editing ? (
                      <input
                        type="text"
                        value={getLabel('remarksHeading')}
                        onChange={(e) => setLabel('remarksHeading', e.target.value)}
                        className="w-20 text-center text-[10px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-0.5"
                      />
                    ) : (
                      getLabel('remarksHeading')
                    )}
                  </th>
                  <th rowSpan={2} className="p-1 w-20">
                    {editing ? (
                      <input
                        type="text"
                        value={getLabel('signatureHeading')}
                        onChange={(e) => setLabel('signatureHeading', e.target.value)}
                        className="w-20 text-center text-[9px] font-bold uppercase bg-blue-50 border-b border-blue-400 px-0.5"
                      />
                    ) : (
                      getLabel('signatureHeading')
                    )}
                  </th>
                </tr>
                {/* Max Marks Row */}
                <tr className="border-b border-slate-800 bg-slate-100 font-bold text-slate-700">
                  <th className="border-r border-slate-800 p-0.5">
                    {editing ? (
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
                    {editing ? (
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
                    {editing ? (
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
                    {editing ? (
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
                  <th className="border-r border-slate-800 p-0.5">{maxTotalPossible}</th>
                </tr>
                {/* Subjects Section Title Row */}
                <tr className="border-b border-slate-800 bg-slate-200/70 font-bold">
                  <th className="border-r border-slate-800 p-1 text-center font-black">
                    {editing ? (
                      <input
                        type="text"
                        value={getLabel('subjectsHeading')}
                        onChange={(e) => setLabel('subjectsHeading', e.target.value)}
                        className="w-full text-center font-black uppercase bg-blue-50 border-b border-blue-400 px-1"
                      />
                    ) : (
                      getLabel('subjectsHeading')
                    )}
                  </th>
                  <th colSpan={9} className="p-0" />
                </tr>
              </thead>
              <tbody>
                {rowsToRender.length === 0 ? (
                  <tr className="border-b border-slate-800">
                    <td colSpan={10} className="py-8 px-4 text-center text-slate-500 text-xs">
                      <div className="font-bold text-slate-700 mb-1">
                        No Subject Scores Entered Yet for {formData.studentName || student.fullName}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Only subjects and scores entered by subject teachers appear here automatically.
                      </p>
                    </td>
                  </tr>
                ) : (
                  rowsToRender.map((row, idx) => {
                    const firstCa = resolveFirstCa(row);
                    const secondCa = resolveSecondCa(row);
                    const total = row.totalScore || Math.min(maxTotalPossible, (row.assignmentScore || 0) + firstCa + secondCa + (row.examScore || 0));
                    const hasScores = total > 0 || row.assignmentScore > 0 || row.examScore > 0 || firstCa > 0 || secondCa > 0;
                    const gradeObj = hasScores ? calculateHwsGrade(total, maxTotalPossible) : { grade: '', remark: row.remark || '' };

                    return (
                      <tr key={row.id || idx} className="border-b border-slate-800 hover:bg-slate-50/50">
                        <td className="border-r border-slate-800 p-1 font-bold text-left px-2 text-[10px] sm:text-[11px] text-slate-950 uppercase">
                          {editing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={row.subjectName}
                                onChange={(e) => handleSubjectRowChange(idx, 'subjectName', e.target.value)}
                                className="w-full font-bold uppercase bg-blue-50 border-b border-blue-400 px-1 focus:bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveSubjectRow(idx)}
                                className="text-rose-500 hover:text-rose-700 shrink-0 cursor-pointer no-print"
                                title="Remove subject row"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            row.subjectName
                          )}
                        </td>
                        <td className="border-r border-slate-800 p-1 font-semibold text-slate-900">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              max={caMeta.assignmentMax}
                              value={row.assignmentScore ?? 0}
                              onChange={(e) => handleSubjectRowChange(idx, 'assignmentScore', e.target.value)}
                              className="w-10 text-center bg-blue-50 border-b border-blue-400 font-bold focus:bg-white"
                            />
                          ) : (
                            row.remark === 'WITHHELD' ? '-' : (hasScores ? row.assignmentScore : '')
                          )}
                        </td>
                        <td className="border-r border-slate-800 p-1 font-semibold text-slate-900">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              max={caMeta.firstCaMax}
                              value={firstCa}
                              onChange={(e) => handleSubjectRowChange(idx, 'firstCaScore', e.target.value)}
                              className="w-10 text-center bg-blue-50 border-b border-blue-400 font-bold focus:bg-white"
                            />
                          ) : (
                            row.remark === 'WITHHELD' ? '-' : (hasScores ? firstCa : '')
                          )}
                        </td>
                        <td className="border-r border-slate-800 p-1 font-semibold text-slate-900">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              max={caMeta.secondCaMax}
                              value={secondCa}
                              onChange={(e) => handleSubjectRowChange(idx, 'secondCaScore', e.target.value)}
                              className="w-10 text-center bg-blue-50 border-b border-blue-400 font-bold focus:bg-white"
                            />
                          ) : (
                            row.remark === 'WITHHELD' ? '-' : (hasScores ? secondCa : '')
                          )}
                        </td>
                        <td className="border-r border-slate-800 p-1 font-semibold text-slate-900">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              max={caMeta.examMax}
                              value={row.examScore ?? 0}
                              onChange={(e) => handleSubjectRowChange(idx, 'examScore', e.target.value)}
                              className="w-10 text-center bg-blue-50 border-b border-blue-400 font-bold focus:bg-white"
                            />
                          ) : (
                            row.remark === 'WITHHELD' ? '-' : (hasScores ? row.examScore : '')
                          )}
                        </td>
                        <td className="border-r border-slate-800 p-1 font-bold text-slate-950">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              max={maxTotalPossible}
                              value={total}
                              onChange={(e) => handleSubjectRowChange(idx, 'totalScore', e.target.value)}
                              className="w-10 text-center bg-emerald-50 border-b border-emerald-500 font-black focus:bg-white"
                            />
                          ) : (
                            row.remark === 'WITHHELD' ? '-' : (hasScores ? total : '')
                          )}
                        </td>
                        <td className="border-r border-slate-800 p-1 font-bold text-slate-950">
                          {editing ? (
                            <input
                              type="text"
                              value={row.grade || gradeObj.grade}
                              onChange={(e) => handleSubjectRowChange(idx, 'grade', e.target.value)}
                              className="w-9 text-center bg-blue-50 border-b border-blue-400 font-bold uppercase focus:bg-white"
                            />
                          ) : (
                            row.remark === 'WITHHELD' ? '-' : (hasScores ? (row.grade || gradeObj.grade) : '')
                          )}
                        </td>

                        {/* Class average cell spanning vertically */}
                        {idx === 0 ? (
                          <td
                            rowSpan={rowsToRender.length}
                            className="border-r border-slate-800 p-1 font-black text-xs sm:text-sm text-slate-950 bg-slate-50/30 align-middle text-center"
                          >
                            {editing ? (
                              <input
                                type="text"
                                placeholder={totals.computedAverage}
                                value={formData.classAverage || ''}
                                onChange={(e) => setFormData({ ...formData, classAverage: e.target.value })}
                                className="w-14 text-center font-black bg-blue-50 border-b border-blue-500 text-xs focus:bg-white"
                              />
                            ) : (
                              formData.classAverage || totals.computedAverage
                            )}
                          </td>
                        ) : null}

                        <td className="border-r border-slate-800 p-1 font-bold text-[10px] text-slate-900 uppercase">
                          {editing ? (
                            <input
                              type="text"
                              value={row.remark || gradeObj.remark}
                              onChange={(e) => handleSubjectRowChange(idx, 'remark', e.target.value)}
                              className="w-16 text-center bg-blue-50 border-b border-blue-400 font-bold uppercase text-[10px] focus:bg-white"
                            />
                          ) : (
                            hasScores ? (row.remark || gradeObj.remark) : row.remark === 'WITHHELD' ? 'WITHHELD' : ''
                          )}
                        </td>
                        <td className="p-1 text-[9px] text-slate-500 italic">
                          {editing ? (
                            <input
                              type="text"
                              value={row.teacherSignature || ''}
                              placeholder="Signed"
                              onChange={(e) => handleSubjectRowChange(idx, 'teacherSignature', e.target.value)}
                              className="w-16 text-center bg-blue-50 border-b border-blue-400 text-[9px] focus:bg-white"
                            />
                          ) : (
                            hasScores ? (row.teacherSignature || 'Signed') : ''
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Add subject toolbar row while editing */}
                {editing && (
                  <tr className="border-b border-slate-800 bg-blue-50/50 no-print">
                    <td colSpan={10} className="p-1.5 text-left px-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={selectedAddSubjectId}
                          onChange={(e) => setSelectedAddSubjectId(e.target.value)}
                          className="px-2 py-1 text-[10px] font-bold bg-white border border-blue-300 rounded text-slate-800"
                        >
                          <option value="">Select curriculum subject to add...</option>
                          {schoolSubjects.map(sub => (
                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const found = schoolSubjects.find(s => s.id === selectedAddSubjectId);
                            handleAddSubjectRow(found);
                            setSelectedAddSubjectId('');
                          }}
                          className="px-2.5 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{selectedAddSubjectId ? 'Add Selected Subject' : 'Add Custom Subject Row'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSyncFromBroadsheet}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer ml-auto"
                          title="Reload latest scores entered by teachers"
                        >
                          <RotateCcw className="w-3 h-3 text-emerald-700" />
                          <span>Sync Teacher Scores</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* TOTAL ROW */}
                <tr className="border-t-2 border-slate-900 bg-slate-100 font-black text-slate-950">
                  <td className="border-r border-slate-800 p-1 font-black text-left px-2 uppercase">
                    {editing ? (
                      <input
                        type="text"
                        value={getLabel('totalRowLabel')}
                        onChange={(e) => setLabel('totalRowLabel', e.target.value)}
                        className="w-24 font-black uppercase bg-blue-50 border-b border-blue-400 px-1"
                      />
                    ) : (
                      getLabel('totalRowLabel')
                    )}
                  </td>
                  <td className="border-r border-slate-800 p-1 font-black">{totals.assignmentTotal}</td>
                  <td className="border-r border-slate-800 p-1 font-black">{totals.firstCaTotal}</td>
                  <td className="border-r border-slate-800 p-1 font-black">{totals.secondCaTotal}</td>
                  <td className="border-r border-slate-800 p-1 font-black">{totals.examTotal}</td>
                  <td className="border-r border-slate-800 p-1 font-black text-xs">{totals.grandTotal}</td>
                  <td colSpan={4} className="p-1 bg-slate-100 text-[10px] font-bold text-slate-600 text-right px-2">
                    {totals.subjectsWithScores} Subject(s) · Average: {formData.classAverage || totals.computedAverage}
                    {(editing || formData.overallPosition) && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        · Pos:{' '}
                        {editing ? (
                          <input
                            type="text"
                            placeholder="1st"
                            value={formData.overallPosition || ''}
                            onChange={(e) => setFormData({ ...formData, overallPosition: e.target.value })}
                            className="w-12 text-center font-black bg-blue-50 border-b border-blue-400 text-[10px] text-slate-900"
                          />
                        ) : (
                          <strong className="text-slate-950 font-black">{formData.overallPosition}</strong>
                        )}
                      </span>
                    )}
                  </td>
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
                  {editing ? (
                    <input
                      type="text"
                      value={getLabel('behavioursTitle')}
                      onChange={(e) => setLabel('behavioursTitle', e.target.value)}
                      className="w-full font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                    />
                  ) : (
                    getLabel('behavioursTitle')
                  )}
                </div>
                <div className="col-span-5 p-1 uppercase">
                  {editing ? (
                    <input
                      type="text"
                      value={getLabel('ratingTitle')}
                      onChange={(e) => setLabel('ratingTitle', e.target.value)}
                      className="w-full text-center font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                    />
                  ) : (
                    getLabel('ratingTitle')
                  )}
                </div>
              </div>
              <div>
                {behaviourTraits.map((t, idx) => {
                  const ratingVal = formData.behaviours[t.key] || 5;
                  const ratingLabel = getRatingWord(ratingVal);
                  return (
                    <div
                      key={t.key}
                      className={`grid grid-cols-12 border-b border-slate-800 ${
                        idx === behaviourTraits.length - 1 ? 'border-b-0' : ''
                      }`}
                    >
                      <div className="col-span-7 border-r border-slate-800 px-2 py-0.5 font-bold uppercase text-slate-900">
                        {editing ? (
                          <input
                            type="text"
                            value={getLabel(t.labelKey)}
                            onChange={(e) => setLabel(t.labelKey, e.target.value.toUpperCase())}
                            className="w-full font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                          />
                        ) : (
                          getLabel(t.labelKey)
                        )}
                      </div>
                      <div className="col-span-2 border-r border-slate-800 text-center py-0.5 font-bold font-mono">
                        {editing ? (
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
                    {editing ? (
                      <input
                        type="text"
                        value={getLabel('skillsTitle')}
                        onChange={(e) => setLabel('skillsTitle', e.target.value)}
                        className="w-full font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                      />
                    ) : (
                      getLabel('skillsTitle')
                    )}
                  </div>
                  <div className="col-span-5 p-1 uppercase">
                    {getLabel('ratingTitle')}
                  </div>
                </div>
                <div>
                  {skillTraits.map((s, idx) => {
                    const ratingVal = formData.skills[s.key] || 5;
                    const ratingLabel = getRatingWord(ratingVal);
                    return (
                      <div
                        key={s.key}
                        className={`grid grid-cols-12 border-b border-slate-800 ${
                          idx === skillTraits.length - 1 ? 'border-b-0' : ''
                        }`}
                      >
                        <div className="col-span-7 border-r border-slate-800 px-2 py-0.5 font-bold uppercase text-slate-900">
                          {editing ? (
                            <input
                              type="text"
                              value={getLabel(s.labelKey)}
                              onChange={(e) => setLabel(s.labelKey, e.target.value.toUpperCase())}
                              className="w-full font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                            />
                          ) : (
                            getLabel(s.labelKey)
                          )}
                        </div>
                        <div className="col-span-2 border-r border-slate-800 text-center py-0.5 font-bold font-mono">
                          {editing ? (
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
                  {editing ? (
                    <input
                      type="text"
                      value={getLabel('keyRatingTitle')}
                      onChange={(e) => setLabel('keyRatingTitle', e.target.value)}
                      className="w-full text-center font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                    />
                  ) : (
                    getLabel('keyRatingTitle')
                  )}
                </div>
                <div className="grid grid-cols-5 text-center font-bold border-b border-slate-800">
                  <div className="border-r border-slate-800 py-0.5">5</div>
                  <div className="border-r border-slate-800 py-0.5">4</div>
                  <div className="border-r border-slate-800 py-0.5">3</div>
                  <div className="border-r border-slate-800 py-0.5">2</div>
                  <div className="py-0.5">1</div>
                </div>
                <div className="grid grid-cols-5 text-center font-bold text-[9px]">
                  {(['keyLabel5', 'keyLabel4', 'keyLabel3', 'keyLabel2', 'keyLabel1'] as const).map((k, i) => (
                    <div key={k} className={`${i < 4 ? 'border-r border-slate-800' : ''} py-1 px-0.5`}>
                      {editing ? (
                        <input
                          type="text"
                          value={getLabel(k)}
                          onChange={(e) => setLabel(k, e.target.value.toUpperCase())}
                          className="w-full text-center font-bold text-[8px] uppercase bg-blue-50 border-b border-blue-400"
                        />
                      ) : (
                        getLabel(k)
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Comments & Administrative Section */}
          <div className="border border-slate-800 text-[10px] sm:text-[11px] mb-3">
            <div className="bg-slate-200 border-b border-slate-800 px-2 py-0.5 font-bold text-slate-950 uppercase">
              {editing ? (
                <input
                  type="text"
                  value={getLabel('commentsTitle')}
                  onChange={(e) => setLabel('commentsTitle', e.target.value)}
                  className="w-full font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                />
              ) : (
                getLabel('commentsTitle')
              )}
            </div>

            {/* Class Teacher's Remarks */}
            <div className="border-b border-slate-800 p-2 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="font-bold text-slate-950 w-52 shrink-0 uppercase">
                {editing ? (
                  <input
                    type="text"
                    value={getLabel('classTeacherRemarkLabel')}
                    onChange={(e) => setLabel('classTeacherRemarkLabel', e.target.value)}
                    className="w-full font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                  />
                ) : (
                  getLabel('classTeacherRemarkLabel')
                )}
              </span>
              {editing ? (
                <input
                  type="text"
                  value={formData.classTeacherRemarks || ''}
                  onChange={(e) => setFormData({ ...formData, classTeacherRemarks: e.target.value })}
                  className="w-full font-bold uppercase text-slate-900 border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
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
                {editing ? (
                  <input
                    type="text"
                    value={getLabel('principalRemarkLabel')}
                    onChange={(e) => setLabel('principalRemarkLabel', e.target.value)}
                    className="w-full font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                  />
                ) : (
                  getLabel('principalRemarkLabel')
                )}
              </span>
              {editing ? (
                <input
                  type="text"
                  value={formData.principalRemarks || ''}
                  onChange={(e) => setFormData({ ...formData, principalRemarks: e.target.value })}
                  className="w-full font-bold uppercase text-slate-900 border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
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
                  {editing ? (
                    <input
                      type="text"
                      value={getLabel('nextTermBeginsLabel')}
                      onChange={(e) => setLabel('nextTermBeginsLabel', e.target.value)}
                      className="w-36 font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                    />
                  ) : (
                    getLabel('nextTermBeginsLabel')
                  )}
                </span>
                {editing ? (
                  <input
                    type="text"
                    value={formData.nextTermBegins || ''}
                    onChange={(e) => setFormData({ ...formData, nextTermBegins: e.target.value })}
                    className="w-full font-bold uppercase border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
                  />
                ) : (
                  <span className="font-bold text-slate-950 uppercase">
                    {formData.nextTermBegins || '5TH JANUARY, 2026'}
                  </span>
                )}
              </div>
              <div className="p-2 flex items-center gap-2">
                <span className="font-bold text-slate-950 shrink-0 uppercase">
                  {editing ? (
                    <input
                      type="text"
                      value={getLabel('nextTermFeesLabel')}
                      onChange={(e) => setLabel('nextTermFeesLabel', e.target.value)}
                      className="w-32 font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                    />
                  ) : (
                    getLabel('nextTermFeesLabel')
                  )}
                </span>
                {editing ? (
                  <input
                    type="text"
                    value={formData.nextTermFees || ''}
                    onChange={(e) => setFormData({ ...formData, nextTermFees: e.target.value })}
                    className="w-full font-bold uppercase border-b border-blue-500 bg-blue-50 px-1 focus:bg-white"
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
                  {editing ? (
                    <input
                      type="text"
                      value={getLabel('principalSigLabel')}
                      onChange={(e) => setLabel('principalSigLabel', e.target.value)}
                      className="w-36 font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                    />
                  ) : (
                    getLabel('principalSigLabel')
                  )}
                </span>
                {editing ? (
                  <input
                    type="text"
                    value={formData.principalSignature || ''}
                    onChange={(e) => setFormData({ ...formData, principalSignature: e.target.value })}
                    className="w-full font-serif italic font-bold text-blue-900 border-b border-blue-500 bg-blue-50 px-2 text-center focus:bg-white"
                  />
                ) : (
                  <div className="font-serif italic font-bold text-blue-900 border-b border-slate-400 px-4">
                    {formData.principalSignature || 'Signed & Approved'}
                  </div>
                )}
              </div>
              <div className="p-2 min-h-[46px] flex items-center justify-between gap-2">
                <span className="font-bold text-slate-950 uppercase shrink-0">
                  {editing ? (
                    <input
                      type="text"
                      value={getLabel('proprietressSigLabel')}
                      onChange={(e) => setLabel('proprietressSigLabel', e.target.value)}
                      className="w-36 font-bold uppercase bg-blue-50 border-b border-blue-400 px-1"
                    />
                  ) : (
                    getLabel('proprietressSigLabel')
                  )}
                </span>
                {editing ? (
                  <input
                    type="text"
                    value={formData.proprietressSignature || ''}
                    onChange={(e) => setFormData({ ...formData, proprietressSignature: e.target.value })}
                    className="w-full font-serif italic font-bold text-blue-900 border-b border-blue-500 bg-blue-50 px-2 text-center focus:bg-white"
                  />
                ) : (
                  <div className="font-serif italic font-bold text-blue-900 border-b border-slate-400 px-4">
                    {formData.proprietressSignature || 'Signed'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Visual Analytics Charts (Live-synced from Behaviours & Skills ratings) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Chart 1: BEHAVIOURS ASSESSMENT BAR CHART */}
            <div className="border border-slate-300 rounded p-2 bg-white">
              <div className="bg-slate-300 text-slate-900 font-bold text-center py-0.5 text-[10px] uppercase mb-1">
                {getLabel('behavioursTitle')}
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
                      <rect x={x} y={y} width={barWidth} height={barHeight} fill="#ea580c" rx="1" />
                      <text
                        x={x + barWidth / 2}
                        y="148"
                        fontSize="5.2"
                        fill="#334155"
                        fontWeight="bold"
                        textAnchor="end"
                        transform={`rotate(-40, ${x + barWidth / 2}, 148)`}
                      >
                        {getLabel(t.labelKey)}
                      </text>
                    </g>
                  );
                })}

                <g transform="translate(150, 166)">
                  <rect x="0" y="0" width="6" height="6" fill="#ea580c" />
                  <text x="10" y="5.5" fontSize="6.5" fill="#475569" fontWeight="bold">
                    {getLabel('ratingTitle')}
                  </text>
                </g>
              </svg>
            </div>

            {/* Chart 2: SKILLS ASSESSMENT LINE CHART */}
            <div className="border border-slate-300 rounded p-2 bg-white">
              <div className="bg-slate-300 text-slate-900 font-bold text-center py-0.5 text-[10px] uppercase mb-1">
                {getLabel('skillsTitle')}
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
                    return { x, y, label: getLabel(s.labelKey), rating };
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
                  <text x="10" y="5.5" fontSize="6.5" fill="#475569" fontWeight="bold">
                    {getLabel('ratingTitle')}
                  </text>
                </g>
              </svg>
            </div>
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="w-full text-slate-900 bg-white">
      {/* Sticky Top Action Bar (Screen Only, Hidden in Print) */}
      <div className="no-print sticky top-0 z-20 bg-slate-900 text-white p-3 sm:p-4 rounded-xl mb-4 shadow-md flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-500">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <span className="font-bold text-xs sm:text-sm uppercase tracking-wider text-white block">
              {formData.studentName || student.fullName} · {formData.admissionNumber || student.admissionNumber}
            </span>
            {isEditable && (
              <span className="text-[10px] text-amber-300 font-semibold">
                {isEditingInline
                  ? 'Live Edit Mode: Click any heading, bio, subject, score, grade, remark, rating, or fee to edit'
                  : 'Clean Print Preview Mode'}
              </span>
            )}
          </div>
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
              {isEditingInline ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              <span>{isEditingInline ? 'Preview Print View' : 'Edit All Fields'}</span>
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
                  <span>Save All Changes</span>
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

      {/* SCREEN PREVIEW / LIVE EDITOR */}
      {renderSheetContent(false)}

      {/* DEDICATED ISOLATED PRINT PORTAL SO MODALS PRINT CLEANLY WITHOUT BACKGROUND DASHBOARDS */}
      {usePrintPortal && printContainer && createPortal(renderSheetContent(true), printContainer)}
    </div>
  );
};
