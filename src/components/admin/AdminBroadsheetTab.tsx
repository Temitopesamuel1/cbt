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
  Trash2
} from 'lucide-react';
import {
  Student,
  Subject,
  SchoolClass,
  StudentAssessmentRecord,
  SchoolSettings,
  calculateGrade,
  calculateGradePoint,
  DEFAULT_CA_WEIGHTS
} from '../../types/cbt';
import {
  fetchAssessmentRecords,
  saveAssessmentRecord,
  saveAssessmentBatch,
  deleteAssessmentRecord,
  fetchSubmissions
} from '../../services/firebase';

interface AdminBroadsheetTabProps {
  students: Student[];
  subjects: Subject[];
  classes: SchoolClass[];
  settings: SchoolSettings;
  showNotification: (text: string, type?: 'success' | 'error') => void;
}

export const AdminBroadsheetTab: React.FC<AdminBroadsheetTabProps> = ({
  students,
  subjects,
  classes,
  settings,
  showNotification
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
  const [savingAll, setSavingAll] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const caWeights = settings.caWeights || DEFAULT_CA_WEIGHTS;

  const currentSubject = subjects.find(s => s.id === selectedSubjectId);
  const currentSubjectName = currentSubject ? currentSubject.name : 'Subject';

  // Filter students by selected class
  const classStudents = students.filter(s => s.classGrade === selectedClass);
  const filteredStudents = classStudents.filter(s => {
    const q = searchFilter.toLowerCase();
    return s.fullName.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q);
  });

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

  const handleScoreChange = (
    studentId: string,
    field: 'assignmentScore' | 'projectScore' | 'testScore' | 'examScore' | 'teacherComment',
    value: string
  ) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    setRecords(prev => {
      const existing = prev[studentId] || {
        id: `ca_${studentId}_${selectedSubjectId}_${academicSession.replace(/[^a-zA-Z0-9_-]/g, '_')}_${term.replace(/\s+/g, '')}`,
        studentId,
        studentName: student.fullName,
        admissionNumber: student.admissionNumber,
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

      const updated = { ...existing };

      if (field === 'teacherComment') {
        updated.teacherComment = value;
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

  const handleSaveSingleRow = async (student: Student) => {
    setSavingId(student.id);
    const rec = records[student.id];
    if (!rec) {
      setSavingId(null);
      return;
    }

    // Sanitize document ID
    const sanitizedId = (rec.id || `ca_${student.id}_${selectedSubjectId}_${academicSession}_${term}`)
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const toSave: StudentAssessmentRecord = {
      ...rec,
      id: sanitizedId,
      studentId: student.id,
      studentName: student.fullName,
      admissionNumber: student.admissionNumber,
      classGrade: selectedClass,
      subjectId: selectedSubjectId,
      subjectName: currentSubjectName,
      academicSession,
      term,
      updatedAt: new Date().toISOString()
    };

    try {
      await saveAssessmentRecord(toSave);
      showNotification(`Saved continuous assessment for ${student.fullName}!`);
    } catch (err: any) {
      showNotification('Failed to save assessment score.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAllRows = async () => {
    setSavingAll(true);
    const toSaveList: StudentAssessmentRecord[] = [];

    for (const student of classStudents) {
      const rec = records[student.id];
      if (rec) {
        const sanitizedId = (rec.id || `ca_${student.id}_${selectedSubjectId}_${academicSession}_${term}`)
          .replace(/[^a-zA-Z0-9_-]/g, '_');
        toSaveList.push({
          ...rec,
          id: sanitizedId,
          studentId: student.id,
          studentName: student.fullName,
          admissionNumber: student.admissionNumber,
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
      showNotification(`Entire broadsheet (${toSaveList.length} student records) successfully saved!`);
    } catch (err: any) {
      showNotification('Could not save all records.', 'error');
    } finally {
      setSavingAll(false);
    }
  };

  const handleAutoFillFromCbt = async () => {
    setLoading(true);
    try {
      const submissions = await fetchSubmissions();
      let filledCount = 0;

      setRecords(prev => {
        const copy = { ...prev };

        for (const student of classStudents) {
          // Find student submission matching current subject and class
          const subMatch = submissions.find(s => {
            const matchStudent = s.studentId === student.id || s.admissionNumber.toUpperCase() === student.admissionNumber.toUpperCase();
            const matchSubj = s.subject.trim().toLowerCase() === currentSubjectName.trim().toLowerCase();
            return matchStudent && matchSubj;
          });

          if (subMatch) {
            filledCount++;
            const existing = copy[student.id] || {
              id: `ca_${student.id}_${selectedSubjectId}_${academicSession}_${term}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
              studentId: student.id,
              studentName: student.fullName,
              admissionNumber: student.admissionNumber,
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

            // Calculate scaled exam score based on max exam points
            const scaledExam = Math.round((subMatch.percentage / 100) * caWeights.examMax);
            const total = existing.assignmentScore + existing.projectScore + existing.testScore + scaledExam;
            const gradeInfo = calculateGrade(total);

            copy[student.id] = {
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

      showNotification(`Auto-filled ${filledCount} exam scores directly from CBT submissions!`);
    } catch (err) {
      showNotification('Failed to auto-fill CBT scores.', 'error');
    } finally {
      setLoading(false);
    }
  };

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

    const rows = classStudents.map(student => {
      const rec = records[student.id];
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
        `"${student.admissionNumber}"`,
        `"${student.fullName}"`,
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
            Admin master console to review, input, or override Continuous Assessment marks, CBT exam scores, and terminal remarks for every student.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
            disabled={savingAll || classStudents.length === 0}
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

      {/* Search within class */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter students in this class by name or admission number..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
        />
      </div>

      {/* Broadsheet Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
              <th className="py-3 px-3">Student Name & ID</th>
              <th className="py-3 px-2 text-center w-16">Assign ({caWeights.assignmentMax})</th>
              <th className="py-3 px-2 text-center w-16">Project ({caWeights.projectMax})</th>
              <th className="py-3 px-2 text-center w-16">Test ({caWeights.testMax})</th>
              <th className="py-3 px-2 text-center w-16 bg-slate-800 text-amber-300">CA (40)</th>
              <th className="py-3 px-2 text-center w-16 bg-blue-950 text-blue-300">Exam ({caWeights.examMax})</th>
              <th className="py-3 px-2 text-center w-16 bg-emerald-950 text-emerald-300">Total (100)</th>
              <th className="py-3 px-2 text-center w-14">Grade</th>
              <th className="py-3 px-3">Remark</th>
              <th className="py-3 px-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-400">
                  No enrolled students found in class {selectedClass}.
                </td>
              </tr>
            ) : (
              filteredStudents.map(student => {
                const rec = records[student.id];
                const asg = rec?.assignmentScore ?? 0;
                const proj = rec?.projectScore ?? 0;
                const tst = rec?.testScore ?? 0;
                const caTotal = asg + proj + tst;
                const exam = rec?.examScore ?? 0;
                const total = asg + proj + tst + exam;
                const gradeInfo = calculateGrade(total);

                return (
                  <tr key={student.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <div>{student.fullName}</div>
                      <div className="text-[10px] text-slate-500 font-mono font-normal">
                        {student.admissionNumber}
                      </div>
                    </td>

                    <td className="py-2 px-1 text-center">
                      <input
                        type="number"
                        min="0"
                        max={caWeights.assignmentMax}
                        value={asg}
                        onChange={(e) => handleScoreChange(student.id, 'assignmentScore', e.target.value)}
                        className="w-14 text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                      />
                    </td>

                    <td className="py-2 px-1 text-center">
                      <input
                        type="number"
                        min="0"
                        max={caWeights.projectMax}
                        value={proj}
                        onChange={(e) => handleScoreChange(student.id, 'projectScore', e.target.value)}
                        className="w-14 text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                      />
                    </td>

                    <td className="py-2 px-1 text-center">
                      <input
                        type="number"
                        min="0"
                        max={caWeights.testMax}
                        value={tst}
                        onChange={(e) => handleScoreChange(student.id, 'testScore', e.target.value)}
                        className="w-14 text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                      />
                    </td>

                    <td className="py-2 px-1 text-center font-black font-mono bg-slate-50 text-slate-900">
                      {caTotal}
                    </td>

                    <td className="py-2 px-1 text-center">
                      <input
                        type="number"
                        min="0"
                        max={caWeights.examMax}
                        value={exam}
                        onChange={(e) => handleScoreChange(student.id, 'examScore', e.target.value)}
                        className="w-14 text-center py-1 bg-blue-50/60 border border-blue-300 rounded-lg font-bold text-blue-950"
                      />
                    </td>

                    <td className="py-2 px-1 text-center font-black font-mono bg-emerald-50 text-emerald-950 text-sm">
                      {total}
                    </td>

                    <td className="py-2 px-1 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-black ${gradeInfo.color}`}>
                        {gradeInfo.grade}
                      </span>
                    </td>

                    <td className="py-2 px-3">
                      <span className="text-[11px] font-semibold text-slate-600">
                        {gradeInfo.remark}
                      </span>
                    </td>

                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => handleSaveSingleRow(student)}
                        disabled={savingId === student.id}
                        className="px-2.5 py-1 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1 cursor-pointer ml-auto disabled:opacity-50"
                        title="Save score for this student"
                      >
                        <Save className="w-3 h-3 text-amber-400" />
                        <span>{savingId === student.id ? '...' : 'Save'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Floating Bottom Quick-Save Ribbon */}
      <div className="p-4 bg-slate-900 rounded-xl text-white flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-amber-400" />
          <div className="text-xs">
            <span className="font-bold">{currentSubjectName}</span> · Cohort: <strong>{selectedClass}</strong> ({classStudents.length} Students) · Term: {term}
          </div>
        </div>

        <button
          onClick={handleSaveAllRows}
          disabled={savingAll || classStudents.length === 0}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{savingAll ? 'Committing Broadsheet...' : 'Save Entire Broadsheet'}</span>
        </button>
      </div>
    </div>
  );
};
