import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Save,
  Download,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Search,
  Filter,
  Check,
  Trash2,
  Plus,
  UserPlus,
  Edit3,
  BarChart2,
  X
} from 'lucide-react';
import {
  Student,
  Subject,
  SchoolClass,
  StudentAssessmentRecord,
  SchoolSettings,
  calculateGrade,
  calculateGradePoint,
  DEFAULT_CA_WEIGHTS,
  generateStudentAccessCode
} from '../../types/cbt';
import {
  fetchAssessmentRecords,
  saveAssessmentRecord,
  saveAssessmentBatch,
  deleteAssessmentRecord,
  fetchSubmissions,
  saveStudent
} from '../../services/firebase';

interface AdminBroadsheetTabProps {
  students: Student[];
  subjects: Subject[];
  classes: SchoolClass[];
  settings: SchoolSettings;
  showNotification: (text: string, type?: 'success' | 'error') => void;
  onRefreshData?: () => void;
}

export const AdminBroadsheetTab: React.FC<AdminBroadsheetTabProps> = ({
  students,
  subjects,
  classes,
  settings,
  showNotification,
  onRefreshData
}) => {
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.code || 'SS 1');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');
  const [academicSession, setAcademicSession] = useState<string>(settings.academicSession || '2025/2026');
  const [term, setTerm] = useState<'1st Term' | '2nd Term' | '3rd Term'>(
    (settings.currentTerm as any) || '1st Term'
  );

  const [records, setRecords] = useState<Record<string, StudentAssessmentRecord>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Add New Student Entry Modal
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [entryMode, setEntryMode] = useState<'existing' | 'new'>('existing');
  const [newEntryForm, setNewEntryForm] = useState({
    studentId: '',
    fullName: '',
    admissionNumber: '',
    assignmentScore: 0,
    projectScore: 0,
    testScore: 0,
    examScore: 0,
    teacherComment: 'Good academic performance',
    registerInRoster: true
  });

  const caWeights = settings.caWeights || DEFAULT_CA_WEIGHTS;

  const currentSubject = subjects.find(s => s.id === selectedSubjectId);
  const currentSubjectName = currentSubject ? currentSubject.name : 'Subject';

  // Load CA Records for this combination
  const loadRecords = async () => {
    if (!selectedSubjectId || !selectedClass) return;
    setLoading(true);
    try {
      const fetched = await fetchAssessmentRecords(selectedSubjectId, selectedClass, academicSession, term);
      const map: Record<string, StudentAssessmentRecord> = {};
      fetched.forEach(r => {
        map[r.studentId] = r;
      });
      setRecords(map);
    } catch (err) {
      console.warn('Broadsheet load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [selectedSubjectId, selectedClass, academicSession, term]);

  // Merge enrolled class students with any custom added broadsheet entries
  const classStudents = students.filter(s => s.classGrade === selectedClass);

  // Compute all row entries: all class students PLUS any records for this class/subject that might not be in classStudents
  const combinedEntries = React.useMemo(() => {
    const list: Array<{
      id: string;
      studentId: string;
      fullName: string;
      admissionNumber: string;
      isEnrolled: boolean;
    }> = [];

    const seenIds = new Set<string>();

    // Add all students in current class
    for (const stu of classStudents) {
      seenIds.add(stu.id);
      list.push({
        id: stu.id,
        studentId: stu.id,
        fullName: stu.fullName,
        admissionNumber: stu.admissionNumber,
        isEnrolled: true
      });
    }

    // Add any records that exist for this subject and class
    for (const [recStudentId, rec] of Object.entries(records)) {
      if (!seenIds.has(recStudentId)) {
        seenIds.add(recStudentId);
        list.push({
          id: recStudentId,
          studentId: recStudentId,
          fullName: rec.studentName || 'Student',
          admissionNumber: rec.admissionNumber || 'ADM/000',
          isEnrolled: false
        });
      }
    }

    return list;
  }, [classStudents, records]);

  // Filter students by search term
  const filteredEntries = combinedEntries.filter(entry => {
    const q = searchFilter.toLowerCase();
    const rec = records[entry.studentId];
    return (
      entry.fullName.toLowerCase().includes(q) ||
      entry.admissionNumber.toLowerCase().includes(q) ||
      (rec?.grade && rec.grade.toLowerCase().includes(q))
    );
  });

  // Handle score or text field change
  const handleScoreChange = (
    studentId: string,
    field: 'assignmentScore' | 'projectScore' | 'testScore' | 'examScore' | 'teacherComment' | 'studentName' | 'admissionNumber',
    value: string
  ) => {
    const entry = combinedEntries.find(e => e.studentId === studentId);
    const existingName = entry ? entry.fullName : 'Student';
    const existingAdm = entry ? entry.admissionNumber : '';

    setRecords(prev => {
      const existing = prev[studentId] || {
        id: `ca_${studentId}_${selectedSubjectId}_${academicSession.replace(/[^a-zA-Z0-9_-]/g, '_')}_${term.replace(/\s+/g, '')}`,
        studentId,
        studentName: existingName,
        admissionNumber: existingAdm,
        classGrade: selectedClass,
        subjectId: selectedSubjectId,
        subjectName: currentSubjectName,
        academicSession,
        term,
        assignmentScore: 0,
        projectScore: 0,
        testScore: 0,
        examScore: 0,
        totalScore: 0,
        grade: 'F9',
        remark: 'Fail',
        teacherComment: '',
        updatedAt: new Date().toISOString()
      };

      const updated = { ...existing };

      if (field === 'teacherComment') {
        updated.teacherComment = value;
      } else if (field === 'studentName') {
        updated.studentName = value;
      } else if (field === 'admissionNumber') {
        updated.admissionNumber = value.toUpperCase();
      } else {
        const num = Math.max(0, Number(value) || 0);
        if (field === 'assignmentScore') updated.assignmentScore = Math.min(caWeights.assignmentMax, num);
        if (field === 'projectScore') updated.projectScore = Math.min(caWeights.projectMax, num);
        if (field === 'testScore') updated.testScore = Math.min(caWeights.testMax, num);
        if (field === 'examScore') updated.examScore = Math.min(caWeights.examMax, num);

        const total = updated.assignmentScore + updated.projectScore + updated.testScore + updated.examScore;
        updated.totalScore = Math.min(100, total);
        const gradeInfo = calculateGrade(updated.totalScore);
        updated.grade = gradeInfo.grade;
        updated.remark = gradeInfo.remark;
      }

      updated.updatedAt = new Date().toISOString();
      return { ...prev, [studentId]: updated };
    });
  };

  // Save single student score row
  const handleSaveSingleRow = async (entry: { studentId: string; fullName: string; admissionNumber: string }) => {
    setSavingId(entry.studentId);
    const rec = records[entry.studentId];
    if (!rec) {
      setSavingId(null);
      return;
    }

    const sanitizedId = (rec.id || `ca_${entry.studentId}_${selectedSubjectId}_${academicSession}_${term}`)
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const toSave: StudentAssessmentRecord = {
      ...rec,
      id: sanitizedId,
      studentId: entry.studentId,
      studentName: rec.studentName || entry.fullName,
      admissionNumber: rec.admissionNumber || entry.admissionNumber,
      classGrade: selectedClass,
      subjectId: selectedSubjectId,
      subjectName: currentSubjectName,
      academicSession,
      term,
      updatedAt: new Date().toISOString()
    };

    try {
      await saveAssessmentRecord(toSave);

      // If student was already enrolled, update student full name or admission number if changed
      const enrolledStudent = students.find(s => s.id === entry.studentId);
      if (enrolledStudent && (rec.studentName !== enrolledStudent.fullName || rec.admissionNumber !== enrolledStudent.admissionNumber)) {
        const updatedStudent: Student = {
          ...enrolledStudent,
          fullName: rec.studentName || enrolledStudent.fullName,
          admissionNumber: rec.admissionNumber || enrolledStudent.admissionNumber
        };
        await saveStudent(updatedStudent);
        if (onRefreshData) onRefreshData();
      }

      setSavedSuccessId(entry.studentId);
      setTimeout(() => setSavedSuccessId(null), 2500);
      showNotification(`Saved marks for ${toSave.studentName} (${toSave.totalScore}/100 - ${toSave.grade})!`);
    } catch (err: any) {
      showNotification('Failed to save assessment score to database.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  // Delete broadsheet record entry
  const handleDeleteRow = async (studentId: string, studentName: string) => {
    if (!confirm(`Delete broadsheet assessment marks for "${studentName}" in ${currentSubjectName}?`)) {
      return;
    }

    const rec = records[studentId];
    if (rec && rec.id) {
      try {
        await deleteAssessmentRecord(rec.id);
        setRecords(prev => {
          const copy = { ...prev };
          delete copy[studentId];
          return copy;
        });
        showNotification(`Assessment marks for ${studentName} removed.`);
      } catch (err) {
        showNotification('Failed to remove record.', 'error');
      }
    }
  };

  // Save all rows in batch
  const handleSaveAllRows = async () => {
    setSavingAll(true);
    const toSaveList: StudentAssessmentRecord[] = [];

    for (const entry of combinedEntries) {
      const rec = records[entry.studentId];
      if (rec) {
        const sanitizedId = (rec.id || `ca_${entry.studentId}_${selectedSubjectId}_${academicSession}_${term}`)
          .replace(/[^a-zA-Z0-9_-]/g, '_');
        toSaveList.push({
          ...rec,
          id: sanitizedId,
          studentId: entry.studentId,
          studentName: rec.studentName || entry.fullName,
          admissionNumber: rec.admissionNumber || entry.admissionNumber,
          classGrade: selectedClass,
          subjectId: selectedSubjectId,
          subjectName: currentSubjectName,
          academicSession,
          term,
          updatedAt: new Date().toISOString()
        });
      }
    }

    try {
      await saveAssessmentBatch(toSaveList);
      showNotification(`Entire broadsheet (${toSaveList.length} student records) committed to database!`);
    } catch (err: any) {
      showNotification('Could not save all records to database.', 'error');
    } finally {
      setSavingAll(false);
    }
  };

  // Add new student score entry
  const handleOpenAddEntry = () => {
    const defaultStudent = classStudents[0];
    setEntryMode(classStudents.length > 0 ? 'existing' : 'new');
    setNewEntryForm({
      studentId: defaultStudent?.id || '',
      fullName: defaultStudent?.fullName || '',
      admissionNumber: defaultStudent?.admissionNumber || `HWHS/${new Date().getFullYear()}/${String(combinedEntries.length + 1).padStart(3, '0')}`,
      assignmentScore: 8,
      projectScore: 8,
      testScore: 16,
      examScore: 48,
      teacherComment: 'Impressive academic performance',
      registerInRoster: true
    });
    setShowAddEntryModal(true);
  };

  const handleSaveNewEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    let studentId = newEntryForm.studentId;
    let studentName = newEntryForm.fullName.trim();
    let admissionNumber = newEntryForm.admissionNumber.trim().toUpperCase();

    if (entryMode === 'existing') {
      const existing = students.find(s => s.id === studentId);
      if (existing) {
        studentName = existing.fullName;
        admissionNumber = existing.admissionNumber;
      }
    } else {
      if (!studentName || !admissionNumber) {
        showNotification('Please enter student name and admission number', 'error');
        return;
      }
      studentId = `stu_broad_${Date.now()}`;

      // Optionally register new student in school database
      if (newEntryForm.registerInRoster) {
        const parts = studentName.split(' ');
        const first = parts[0] || studentName;
        const sur = parts.slice(1).join(' ') || 'Student';
        const newStu: Student = {
          id: studentId,
          admissionNumber,
          firstName: first,
          surname: sur,
          fullName: studentName,
          classGrade: selectedClass,
          academicSession,
          status: 'active',
          registeredAt: new Date().toISOString(),
          accessCode: generateStudentAccessCode(students.map(s => s.accessCode || ''))
        };
        try {
          await saveStudent(newStu);
          if (onRefreshData) onRefreshData();
        } catch (err) {
          console.warn('Could not register student in roster:', err);
        }
      }
    }

    const asg = Math.min(caWeights.assignmentMax, Math.max(0, Number(newEntryForm.assignmentScore) || 0));
    const proj = Math.min(caWeights.projectMax, Math.max(0, Number(newEntryForm.projectScore) || 0));
    const tst = Math.min(caWeights.testMax, Math.max(0, Number(newEntryForm.testScore) || 0));
    const ex = Math.min(caWeights.examMax, Math.max(0, Number(newEntryForm.examScore) || 0));
    const total = Math.min(100, asg + proj + tst + ex);
    const gradeInfo = calculateGrade(total);

    const sanitizedId = `ca_${studentId}_${selectedSubjectId}_${academicSession}_${term}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const newRecord: StudentAssessmentRecord = {
      id: sanitizedId,
      studentId,
      studentName,
      admissionNumber,
      classGrade: selectedClass,
      subjectId: selectedSubjectId,
      subjectName: currentSubjectName,
      academicSession,
      term,
      assignmentScore: asg,
      projectScore: proj,
      testScore: tst,
      examScore: ex,
      totalScore: total,
      grade: gradeInfo.grade,
      remark: gradeInfo.remark,
      teacherComment: newEntryForm.teacherComment.trim(),
      updatedAt: new Date().toISOString()
    };

    try {
      await saveAssessmentRecord(newRecord);
      setRecords(prev => ({ ...prev, [studentId]: newRecord }));
      setShowAddEntryModal(false);
      showNotification(`Added and saved score for ${studentName} (${total}/100)!`);
    } catch (err) {
      showNotification('Failed to add entry to database.', 'error');
    }
  };

  // Auto-fill exam column from candidate CBT submissions
  const handleAutoFillFromCbt = async () => {
    setLoading(true);
    try {
      const submissions = await fetchSubmissions();
      let filledCount = 0;

      setRecords(prev => {
        const copy = { ...prev };

        for (const entry of combinedEntries) {
          const subMatch = submissions.find(s => {
            const matchStudent = s.studentId === entry.studentId || s.admissionNumber.toUpperCase() === entry.admissionNumber.toUpperCase();
            const matchSubj = s.subject.trim().toLowerCase() === currentSubjectName.trim().toLowerCase();
            return matchStudent && matchSubj;
          });

          if (subMatch) {
            filledCount++;
            const existing = copy[entry.studentId] || {
              id: `ca_${entry.studentId}_${selectedSubjectId}_${academicSession}_${term}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
              studentId: entry.studentId,
              studentName: entry.fullName,
              admissionNumber: entry.admissionNumber,
              classGrade: selectedClass,
              subjectId: selectedSubjectId,
              subjectName: currentSubjectName,
              academicSession,
              term,
              assignmentScore: 0,
              projectScore: 0,
              testScore: 0,
              examScore: 0,
              totalScore: 0,
              grade: 'F9',
              remark: 'Fail',
              updatedAt: new Date().toISOString()
            };

            const scaledExam = Math.round((subMatch.percentage / 100) * caWeights.examMax);
            const total = existing.assignmentScore + existing.projectScore + existing.testScore + scaledExam;
            const gradeInfo = calculateGrade(total);

            copy[entry.studentId] = {
              ...existing,
              examScore: scaledExam,
              totalScore: Math.min(100, total),
              grade: gradeInfo.grade,
              remark: gradeInfo.remark,
              cbtSubmissionId: subMatch.id,
              isAutoSynced: true,
              updatedAt: new Date().toISOString()
            };
          }
        }
        return copy;
      });

      showNotification(`Auto-filled ${filledCount} exam scores directly from verified CBT submissions!`);
    } catch (err) {
      showNotification('Failed to auto-fill CBT scores.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Export full CSV
  const handleExportCsv = () => {
    const headers = [
      'Admission Number',
      'Student Name',
      'Class',
      'Subject',
      'Session',
      'Term',
      `Assignment (${caWeights.assignmentMax})`,
      `Project (${caWeights.projectMax})`,
      `Test (${caWeights.testMax})`,
      'Total CA (40)',
      `Exam (${caWeights.examMax})`,
      'Total Score (100)',
      'Grade',
      'Remark',
      'Teacher / Admin Comment'
    ];

    const rows = combinedEntries.map(entry => {
      const rec = records[entry.studentId];
      const asg = rec?.assignmentScore || 0;
      const proj = rec?.projectScore || 0;
      const tst = rec?.testScore || 0;
      const caTot = asg + proj + tst;
      const ex = rec?.examScore || 0;
      const tot = rec?.totalScore || (caTot + ex);
      const gr = rec?.grade || 'F9';
      const rem = rec?.remark || 'Fail';
      const cmt = rec?.teacherComment || '';

      return [
        `"${rec?.admissionNumber || entry.admissionNumber}"`,
        `"${rec?.studentName || entry.fullName}"`,
        `"${selectedClass}"`,
        `"${currentSubjectName}"`,
        `"${academicSession}"`,
        `"${term}"`,
        asg,
        proj,
        tst,
        caTot,
        ex,
        tot,
        `"${gr}"`,
        `"${rem}"`,
        `"${cmt}"`
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ca_broadsheet_${selectedClass}_${currentSubjectName.replace(/\s+/g, '_')}_${term}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick statistics
  const scoreValues = combinedEntries
    .map(e => records[e.studentId]?.totalScore)
    .filter((s): s is number => typeof s === 'number');
  const classAvg = scoreValues.length > 0
    ? (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1)
    : '0';
  const highestScore = scoreValues.length > 0 ? Math.max(...scoreValues) : 0;
  const passCount = scoreValues.filter(s => s >= (settings.passMarkPercentage || 50)).length;
  const passRate = scoreValues.length > 0 ? Math.round((passCount / scoreValues.length) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 text-[11px] font-bold border border-amber-200 uppercase tracking-wide mb-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />
            <span>Master CA Broadsheet Authority</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">Continuous Assessment & Terminal Broadsheet</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full admin power to edit every mark, customize student details, add new entries, auto-sync CBT papers, and save directly to the database.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenAddEntry}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Add Student Entry</span>
          </button>

          <button
            onClick={handleAutoFillFromCbt}
            disabled={loading}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Auto-fill Exam column from candidate CBT submissions"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-700" />
            <span>Auto-Fill from CBT</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleSaveAllRows}
            disabled={savingAll || combinedEntries.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingAll ? 'Saving Broadsheet...' : 'Save All Scores'}</span>
          </button>
        </div>
      </div>

      {/* Cohort Selectors & Filters */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Target Class</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-bold text-slate-900 cursor-pointer"
          >
            {classes.map(c => (
              <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Subject</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-bold text-slate-900 cursor-pointer"
          >
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Academic Session</label>
          <input
            type="text"
            value={academicSession}
            onChange={(e) => setAcademicSession(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono text-slate-900"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Term</label>
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value as any)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-bold text-slate-900 cursor-pointer"
          >
            <option value="1st Term">1st Term</option>
            <option value="2nd Term">2nd Term</option>
            <option value="3rd Term">3rd Term</option>
          </select>
        </div>
      </div>

      {/* Analytics KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
          <div className="text-[10px] font-bold text-blue-900 uppercase">Enrolled Candidates</div>
          <div className="text-xl font-black text-blue-950 mt-0.5">{combinedEntries.length}</div>
        </div>
        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
          <div className="text-[10px] font-bold text-amber-900 uppercase">Class Average</div>
          <div className="text-xl font-black text-amber-950 mt-0.5">{classAvg} / 100</div>
        </div>
        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
          <div className="text-[10px] font-bold text-emerald-900 uppercase">Highest Score</div>
          <div className="text-xl font-black text-emerald-950 mt-0.5">{highestScore} / 100</div>
        </div>
        <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
          <div className="text-[10px] font-bold text-purple-900 uppercase">Pass Rate (≥{settings.passMarkPercentage || 50}%)</div>
          <div className="text-xl font-black text-purple-950 mt-0.5">{passRate}%</div>
        </div>
      </div>

      {/* Search within class */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter broadsheet by student name, admission number, or grade (A1, B2...)"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
        />
      </div>

      {/* Broadsheet Table with Editable Fields */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
              <th className="py-3 px-3">Student Name</th>
              <th className="py-3 px-2 w-28">Admission No</th>
              <th className="py-3 px-1 text-center w-14">Assign ({caWeights.assignmentMax})</th>
              <th className="py-3 px-1 text-center w-14">Proj ({caWeights.projectMax})</th>
              <th className="py-3 px-1 text-center w-14">Test ({caWeights.testMax})</th>
              <th className="py-3 px-1 text-center w-14 bg-slate-800 text-amber-300">CA (40)</th>
              <th className="py-3 px-1 text-center w-14 bg-blue-950 text-blue-300">Exam ({caWeights.examMax})</th>
              <th className="py-3 px-1 text-center w-14 bg-emerald-950 text-emerald-300">Tot (100)</th>
              <th className="py-3 px-1 text-center w-12">Grade</th>
              <th className="py-3 px-2 w-20">Remark</th>
              <th className="py-3 px-2">Teacher / Admin Comment</th>
              <th className="py-3 px-2 text-right w-24">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-10 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-2">
                    <p>No student scores recorded for {selectedClass}.</p>
                    <button
                      onClick={handleOpenAddEntry}
                      className="px-3 py-1.5 bg-blue-900 text-white rounded-lg text-xs font-bold"
                    >
                      + Add First Student Score
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredEntries.map(entry => {
                const rec = records[entry.studentId];
                const displayName = rec?.studentName !== undefined ? rec.studentName : entry.fullName;
                const displayAdm = rec?.admissionNumber !== undefined ? rec.admissionNumber : entry.admissionNumber;
                const asg = rec?.assignmentScore ?? 0;
                const proj = rec?.projectScore ?? 0;
                const tst = rec?.testScore ?? 0;
                const caTotal = asg + proj + tst;
                const exam = rec?.examScore ?? 0;
                const total = asg + proj + tst + exam;
                const gradeInfo = calculateGrade(total);
                const comment = rec?.teacherComment ?? '';

                const isSavedSuccess = savedSuccessId === entry.studentId;
                const isCurrentlySaving = savingId === entry.studentId;

                return (
                  <tr key={entry.studentId} className="hover:bg-amber-50/30 transition-colors">
                    {/* Editable Student Name */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => handleScoreChange(entry.studentId, 'studentName', e.target.value)}
                        className="w-full min-w-[130px] font-bold text-slate-900 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-slate-900 rounded px-1.5 py-1 text-xs"
                        title="Click to edit student name"
                      />
                    </td>

                    {/* Editable Admission Number */}
                    <td className="py-2 px-1">
                      <input
                        type="text"
                        value={displayAdm}
                        onChange={(e) => handleScoreChange(entry.studentId, 'admissionNumber', e.target.value)}
                        className="w-full font-mono font-semibold text-slate-600 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-slate-900 rounded px-1.5 py-1 text-[11px]"
                        title="Click to edit admission number"
                      />
                    </td>

                    {/* Assignment */}
                    <td className="py-2 px-1 text-center">
                      <input
                        type="number"
                        min="0"
                        max={caWeights.assignmentMax}
                        value={asg}
                        onChange={(e) => handleScoreChange(entry.studentId, 'assignmentScore', e.target.value)}
                        className="w-12 text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-xs"
                      />
                    </td>

                    {/* Project */}
                    <td className="py-2 px-1 text-center">
                      <input
                        type="number"
                        min="0"
                        max={caWeights.projectMax}
                        value={proj}
                        onChange={(e) => handleScoreChange(entry.studentId, 'projectScore', e.target.value)}
                        className="w-12 text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-xs"
                      />
                    </td>

                    {/* Test */}
                    <td className="py-2 px-1 text-center">
                      <input
                        type="number"
                        min="0"
                        max={caWeights.testMax}
                        value={tst}
                        onChange={(e) => handleScoreChange(entry.studentId, 'testScore', e.target.value)}
                        className="w-12 text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-xs"
                      />
                    </td>

                    {/* CA Total (40) */}
                    <td className="py-2 px-1 text-center font-black font-mono bg-slate-50 text-slate-900 text-xs">
                      {caTotal}
                    </td>

                    {/* Exam (60) */}
                    <td className="py-2 px-1 text-center">
                      <input
                        type="number"
                        min="0"
                        max={caWeights.examMax}
                        value={exam}
                        onChange={(e) => handleScoreChange(entry.studentId, 'examScore', e.target.value)}
                        className="w-12 text-center py-1 bg-blue-50/60 border border-blue-300 rounded-lg font-bold text-blue-950 text-xs"
                      />
                    </td>

                    {/* Total (100) */}
                    <td className="py-2 px-1 text-center font-black font-mono bg-emerald-50 text-emerald-950 text-xs">
                      {total}
                    </td>

                    {/* Grade */}
                    <td className="py-2 px-1 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${gradeInfo.color}`}>
                        {gradeInfo.grade}
                      </span>
                    </td>

                    {/* Remark */}
                    <td className="py-2 px-2">
                      <span className="text-[10px] font-semibold text-slate-600 block truncate">
                        {gradeInfo.remark}
                      </span>
                    </td>

                    {/* Editable Teacher / Admin Comment */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        placeholder="Remarks / comments..."
                        value={comment}
                        onChange={(e) => handleScoreChange(entry.studentId, 'teacherComment', e.target.value)}
                        className="w-full min-w-[140px] px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50/60 focus:bg-white focus:border-slate-900 text-slate-900 placeholder:text-slate-400"
                      />
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleSaveSingleRow(entry)}
                          disabled={isCurrentlySaving}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50 ${
                            isSavedSuccess
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                          title="Save changes for this student"
                        >
                          {isSavedSuccess ? (
                            <Check className="w-3 h-3 text-white" />
                          ) : (
                            <Save className="w-3 h-3 text-amber-400" />
                          )}
                          <span>{isCurrentlySaving ? '...' : isSavedSuccess ? 'Saved' : 'Save'}</span>
                        </button>

                        {rec && (
                          <button
                            onClick={() => handleDeleteRow(entry.studentId, displayName)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete this score entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Floating Bottom Quick-Save Ribbon */}
      <div className="p-4 bg-slate-900 rounded-xl text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">{currentSubjectName}</span> · Cohort: <strong>{selectedClass}</strong> ({combinedEntries.length} Recorded Candidates) · {term}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddEntry}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Add Student</span>
          </button>

          <button
            onClick={handleSaveAllRows}
            disabled={savingAll || combinedEntries.length === 0}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingAll ? 'Committing Broadsheet...' : 'Save Entire Broadsheet'}</span>
          </button>
        </div>
      </div>

      {/* Add New Student Score Entry Modal */}
      {showAddEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-fadeIn">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Plus className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Add New Student Score to Broadsheet</h3>
              </div>
              <button
                onClick={() => setShowAddEntryModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewEntry} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Entry Mode Switcher */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setEntryMode('existing')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    entryMode === 'existing'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Select Enrolled Student
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('new')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    entryMode === 'new'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Enter New Student
                </button>
              </div>

              {entryMode === 'existing' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Enrolled Student</label>
                  <select
                    value={newEntryForm.studentId}
                    onChange={(e) => {
                      const selected = students.find(s => s.id === e.target.value);
                      if (selected) {
                        setNewEntryForm({
                          ...newEntryForm,
                          studentId: selected.id,
                          fullName: selected.fullName,
                          admissionNumber: selected.admissionNumber
                        });
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 cursor-pointer"
                  >
                    {classStudents.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.admissionNumber})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Student Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Samuel Olalekan"
                      value={newEntryForm.fullName}
                      onChange={(e) => setNewEntryForm({ ...newEntryForm, fullName: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Admission Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. HWHS/2025/099"
                      value={newEntryForm.admissionNumber}
                      onChange={(e) => setNewEntryForm({ ...newEntryForm, admissionNumber: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 font-bold"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={newEntryForm.registerInRoster}
                      onChange={(e) => setNewEntryForm({ ...newEntryForm, registerInRoster: e.target.checked })}
                      className="rounded text-blue-900"
                    />
                    <span>Also register in school student database (issues instant CBT login passcode)</span>
                  </label>
                </div>
              )}

              {/* Score Inputs Grid */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase">Input Assessment Marks:</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Assign (Max {caWeights.assignmentMax})
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={caWeights.assignmentMax}
                      value={newEntryForm.assignmentScore}
                      onChange={(e) => setNewEntryForm({ ...newEntryForm, assignmentScore: Number(e.target.value) || 0 })}
                      className="w-full text-center py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Proj (Max {caWeights.projectMax})
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={caWeights.projectMax}
                      value={newEntryForm.projectScore}
                      onChange={(e) => setNewEntryForm({ ...newEntryForm, projectScore: Number(e.target.value) || 0 })}
                      className="w-full text-center py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Test (Max {caWeights.testMax})
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={caWeights.testMax}
                      value={newEntryForm.testScore}
                      onChange={(e) => setNewEntryForm({ ...newEntryForm, testScore: Number(e.target.value) || 0 })}
                      className="w-full text-center py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Exam (Max {caWeights.examMax})
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={caWeights.examMax}
                      value={newEntryForm.examScore}
                      onChange={(e) => setNewEntryForm({ ...newEntryForm, examScore: Number(e.target.value) || 0 })}
                      className="w-full text-center py-1.5 text-xs bg-blue-50 border border-blue-300 rounded-lg font-bold text-blue-950"
                    />
                  </div>
                </div>

                {/* Live Calculated Total */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-600">Calculated Terminal Total:</span>
                  <span className="font-black font-mono text-base text-emerald-950">
                    {(Number(newEntryForm.assignmentScore) || 0) +
                      (Number(newEntryForm.projectScore) || 0) +
                      (Number(newEntryForm.testScore) || 0) +
                      (Number(newEntryForm.examScore) || 0)}{' '}
                    / 100
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Teacher / Examiner Comment
                </label>
                <input
                  type="text"
                  placeholder="e.g. Excellent grasp of curriculum objectives"
                  value={newEntryForm.teacherComment}
                  onChange={(e) => setNewEntryForm({ ...newEntryForm, teacherComment: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEntryModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-slate-900 text-white rounded-xl shadow-md hover:bg-slate-800 cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-amber-400" />
                  <span>Save Entry to Broadsheet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
