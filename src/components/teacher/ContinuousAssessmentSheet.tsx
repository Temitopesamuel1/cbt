import React, { useState, useEffect, useMemo } from 'react';
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
  Check
} from 'lucide-react';
import {
  Student,
  Subject,
  SchoolClass,
  StaffMember,
  Submission,
  StudentAssessmentRecord,
  calculateGrade
} from '../../types/cbt';
import {
  fetchAssessmentRecords,
  saveAssessmentBatch
} from '../../services/firebase';

interface ContinuousAssessmentSheetProps {
  teacherStaff?: StaffMember | null;
  subjects: Subject[];
  classes: SchoolClass[];
  students: Student[];
  submissions: Submission[];
  academicSession: string;
  currentTerm: '1st Term' | '2nd Term' | '3rd Term';
  schoolName: string;
}

export const ContinuousAssessmentSheet: React.FC<ContinuousAssessmentSheetProps> = ({
  teacherStaff,
  subjects,
  classes,
  students,
  submissions,
  academicSession,
  currentTerm,
  schoolName
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
  const [saveStatus, setSaveStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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
  useEffect(() => {
    if (!selectedSubjectId || !selectedClassCode) return;

    fetchAssessmentRecords(selectedSubjectId, selectedClassCode, academicSession, currentTerm)
      .then(records => {
        const recordMap: Record<string, StudentAssessmentRecord> = {};
        records.forEach(r => {
          recordMap[r.studentId] = r;
        });
        setAssessmentRecords(recordMap);
      })
      .catch(err => console.warn('Error loading assessment records:', err));
  }, [selectedSubjectId, selectedClassCode, academicSession, currentTerm]);

  // Helper to calculate total, grade and remark
  const computeScoreDetails = (assignment: number, project: number, test: number, exam: number) => {
    const validAssignment = Math.min(10, Math.max(0, assignment || 0));
    const validProject = Math.min(10, Math.max(0, project || 0));
    const validTest = Math.min(20, Math.max(0, test || 0));
    const validExam = Math.min(60, Math.max(0, exam || 0));
    const total = validAssignment + validProject + validTest + validExam;
    const { grade, remark } = calculateGrade(total);
    return {
      assignmentScore: validAssignment,
      projectScore: validProject,
      testScore: validTest,
      examScore: validExam,
      totalScore: total,
      grade,
      remark
    };
  };

  // Get or initialize record for student
  const getRecord = (student: Student): StudentAssessmentRecord => {
    if (assessmentRecords[student.id]) {
      return assessmentRecords[student.id];
    }
    const cleanExam = 0;
    const initialDetails = computeScoreDetails(0, 0, 0, cleanExam);
    return {
      id: `ca_${student.id}_${selectedSubjectId}_${academicSession.replace('/', '-')}_${currentTerm.replace(' ', '')}`,
      studentId: student.id,
      studentName: student.fullName,
      admissionNumber: student.admissionNumber,
      classGrade: selectedClassCode,
      subjectId: selectedSubjectId,
      subjectName: activeSubject?.name || 'Subject',
      academicSession,
      term: currentTerm,
      assignmentScore: initialDetails.assignmentScore,
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
    field: 'assignmentScore' | 'projectScore' | 'testScore' | 'examScore' | 'teacherComment',
    value: string | number
  ) => {
    const current = getRecord(student);

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
    const project = field === 'projectScore' ? numValue : current.projectScore;
    const test = field === 'testScore' ? numValue : current.testScore;
    const exam = field === 'examScore' ? numValue : current.examScore;

    const computed = computeScoreDetails(assignment, project, test, exam);

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

  // Automatically scan and sync CBT examination scores into Exam column (out of 60)
  const handleAutoFillCbtScores = () => {
    if (!activeSubject) return;

    let matchCount = 0;
    const updatedMap = { ...assessmentRecords };
    const cleanSubj = activeSubject.name.trim().toLowerCase();

    classStudents.forEach(student => {
      // Find latest submission for this student and subject
      const studentSubs = submissions.filter(s => {
        const matchesStudent = s.studentId === student.id || s.admissionNumber === student.admissionNumber;
        const matchesSubj = s.subject && s.subject.trim().toLowerCase() === cleanSubj;
        return matchesStudent && matchesSubj;
      });

      if (studentSubs.length > 0) {
        // Take best or latest submission
        const latest = studentSubs[0];
        // Scale to 60 marks (e.g. percentage * 0.60)
        const scaledExamScore = Math.round((latest.percentage / 100) * 60);

        const current = updatedMap[student.id] || getRecord(student);
        const computed = computeScoreDetails(
          current.assignmentScore,
          current.projectScore,
          current.testScore,
          scaledExamScore
        );

        updatedMap[student.id] = {
          ...current,
          ...computed,
          cbtSubmissionId: latest.id,
          isAutoSynced: true,
          updatedAt: new Date().toISOString()
        };
        matchCount++;
      }
    });

    setAssessmentRecords(updatedMap);

    if (matchCount > 0) {
      setSaveStatus({
        text: `Successfully synced CBT examination scores for ${matchCount} student(s) into the 60% exam column!`,
        type: 'success'
      });
    } else {
      setSaveStatus({
        text: `No completed CBT examination submissions found for ${activeSubject.name} in ${selectedClassCode}. You can enter scores manually.`,
        type: 'error'
      });
    }

    setTimeout(() => setSaveStatus(null), 4000);
  };

  // Set standard default score for all students
  const handleQuickFillComponent = (field: 'assignmentScore' | 'projectScore' | 'testScore', defaultVal: number) => {
    const updatedMap = { ...assessmentRecords };
    classStudents.forEach(student => {
      const current = updatedMap[student.id] || getRecord(student);
      const assignment = field === 'assignmentScore' ? defaultVal : current.assignmentScore;
      const project = field === 'projectScore' ? defaultVal : current.projectScore;
      const test = field === 'testScore' ? defaultVal : current.testScore;

      const computed = computeScoreDetails(assignment, project, test, current.examScore);

      updatedMap[student.id] = {
        ...current,
        ...computed,
        updatedAt: new Date().toISOString()
      };
    });
    setAssessmentRecords(updatedMap);
  };

  // Save all records to Firestore
  const handleSaveAllRecords = async () => {
    setIsSaving(true);
    try {
      const recordsToSave: StudentAssessmentRecord[] = classStudents.map(s => getRecord(s));
      await saveAssessmentBatch(recordsToSave);
      setSaveStatus({
        text: `Master Assessment Record Sheet for ${selectedClassCode} (${activeSubject?.name}) saved successfully!`,
        type: 'success'
      });
    } catch (err) {
      console.error('Error saving continuous assessment records:', err);
      setSaveStatus({
        text: 'Failed to save assessment records to database.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  // Export to CSV for Excel
  const handleExportCsv = () => {
    if (classStudents.length === 0) {
      alert('No students to export.');
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
      'Assignment (10)',
      'Project (10)',
      'CA Test (20)',
      'Total CA (40)',
      'Examination (60)',
      'Total Score (100)',
      'Grade',
      'Remark',
      'Teacher Comment'
    ];

    const rows = classStudents.map((s, idx) => {
      const r = getRecord(s);
      const totalCa = r.assignmentScore + r.projectScore + r.testScore;
      return [
        idx + 1,
        `"${s.admissionNumber}"`,
        `"${s.fullName}"`,
        `"${selectedClassCode}"`,
        `"${activeSubject?.name || 'Subject'}"`,
        `"${academicSession}"`,
        `"${currentTerm}"`,
        r.assignmentScore,
        r.projectScore,
        r.testScore,
        totalCa,
        r.examScore,
        r.totalScore,
        `"${r.grade}"`,
        `"${r.remark}"`,
        `"${r.teacherComment || ''}"`
      ].join(',');
    });

    const csvData = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedClassCode}_${activeSubject?.name || 'Subject'}_Assessment_Broadsheet.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Broad Sheet
  const handlePrint = () => {
    window.print();
  };

  // Class Statistics
  const statistics = useMemo(() => {
    const scores = classStudents.map(s => getRecord(s).totalScore);
    if (scores.length === 0) return { avg: 0, high: 0, low: 0, passRate: 0 };
    const total = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(total / scores.length);
    const high = Math.max(...scores);
    const low = Math.min(...scores);
    const passed = scores.filter(s => s >= 50).length;
    const passRate = Math.round((passed / scores.length) * 100);
    return { avg, high, low, passRate };
  }, [classStudents, assessmentRecords]);

  return (
    <div className="space-y-6">
      {/* Printable Institutional Letterhead (Hidden on screen, visible on print) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6 text-center">
        <h1 className="text-2xl font-black uppercase tracking-wider">{schoolName}</h1>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mt-1">
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
              Record assignment, project, test, and exam scores manually or auto-fill from CBT results with automatic grade calculations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoFillCbtScores}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
              title="Automatically sync CBT objective test scores into the Exam (60%) column"
            >
              <Sparkles className="w-4 h-4 text-blue-700" />
              <span>Auto-Fill CBT Scores</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Excel CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-900 border border-blue-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-blue-700" />
              <span>Print Broad Sheet</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAllRecords}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-amber-400" />
              <span>{isSaving ? 'Saving Sheet...' : 'Save & Publish Sheet'}</span>
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {saveStatus && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
              saveStatus.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            {saveStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{saveStatus.text}</span>
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
            <div className="px-3 py-2 bg-slate-100 rounded-xl text-slate-700 font-mono font-bold flex items-center justify-between border border-slate-200">
              <span>{academicSession}</span>
              <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-300 font-sans font-bold text-blue-900">
                {currentTerm}
              </span>
            </div>
          </div>

          {/* Search Student Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 flex items-center gap-1">
              <Search className="w-3 h-3 text-slate-400" />
              <span>Search Candidate</span>
            </label>
            <input
              type="text"
              placeholder="Filter by name or admission no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Quick Batch Fill Tools */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 text-[11px] font-semibold">Quick Scoring:</span>
            <button
              type="button"
              onClick={() => handleQuickFillComponent('assignmentScore', 8)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors"
            >
              Set All Assignments = 8/10
            </button>
            <button
              type="button"
              onClick={() => handleQuickFillComponent('projectScore', 8)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors"
            >
              Set All Projects = 8/10
            </button>
            <button
              type="button"
              onClick={() => handleQuickFillComponent('testScore', 15)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors"
            >
              Set All Tests = 15/20
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            Weighting Standard: <strong>CA (40%) + Exam (60%) = 100%</strong>
          </div>
        </div>
      </div>

      {/* Class Statistics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 no-print">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Class Enrollment</span>
          <span className="text-2xl font-black font-mono text-slate-900 mt-1 block">{classStudents.length}</span>
          <span className="text-[11px] text-slate-500">Candidates in {selectedClassCode}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Class Average</span>
          <span className="text-2xl font-black font-mono text-blue-900 mt-1 block">{statistics.avg}%</span>
          <span className="text-[11px] text-slate-500">Subject overall mean</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Score Range</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-black font-mono text-emerald-700">{statistics.high}%</span>
            <span className="text-slate-300">/</span>
            <span className="text-xl font-black font-mono text-rose-600">{statistics.low}%</span>
          </div>
          <span className="text-[11px] text-slate-500">Highest / Lowest marks</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Pass Rate (≥50%)</span>
          <span className="text-2xl font-black font-mono text-amber-500 mt-1 block">{statistics.passRate}%</span>
          <span className="text-[11px] text-slate-500">Benchmark clearance</span>
        </div>
      </div>

      {/* Assessment Broad Sheet Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <span>Class Master Roster: {selectedClassCode}</span>
            <span>·</span>
            <span className="text-blue-900">{activeSubject?.name}</span>
            <span>·</span>
            <span className="text-slate-500 font-mono font-normal">({displayedStudents.length} Students)</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Type directly into score boxes. Grades and remarks update automatically.
          </div>
        </div>

        {classStudents.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-bold text-slate-600">No students enrolled in class {selectedClassCode}.</p>
            <p className="text-slate-400">Select another class from the dropdown above or enroll students in this cohort.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">S/N</th>
                  <th className="py-3 px-3 w-28">Admission No</th>
                  <th className="py-3 px-4 min-w-[180px]">Candidate Full Name</th>
                  <th className="py-3 px-2 w-20 text-center bg-blue-50/60 border-l border-blue-100">
                    Assign.<br /><span className="text-[9px] text-blue-700">(10)</span>
                  </th>
                  <th className="py-3 px-2 w-20 text-center bg-blue-50/60">
                    Project<br /><span className="text-[9px] text-blue-700">(10)</span>
                  </th>
                  <th className="py-3 px-2 w-20 text-center bg-blue-50/60">
                    CA Test<br /><span className="text-[9px] text-blue-700">(20)</span>
                  </th>
                  <th className="py-3 px-2 w-16 text-center font-black bg-blue-100/60 text-blue-950 border-r border-blue-200">
                    Total CA<br /><span className="text-[9px]">(40)</span>
                  </th>
                  <th className="py-3 px-2 w-24 text-center bg-amber-50/60">
                    Exam<br /><span className="text-[9px] text-amber-700">(60)</span>
                  </th>
                  <th className="py-3 px-3 w-20 text-center font-black bg-slate-200/80 text-slate-900">
                    Total<br /><span className="text-[9px]">(100)</span>
                  </th>
                  <th className="py-3 px-2 w-16 text-center">Grade</th>
                  <th className="py-3 px-3 w-24 text-center">Remark</th>
                  <th className="py-3 px-4 min-w-[160px]">Teacher Assessment Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedStudents.map((student, idx) => {
                  const rec = getRecord(student);
                  const totalCa = rec.assignmentScore + rec.projectScore + rec.testScore;

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

                      {/* Assignment Input (10) */}
                      <td className="py-2 px-2 text-center bg-blue-50/30 border-l border-blue-100">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="1"
                          value={rec.assignmentScore || ''}
                          onChange={(e) => handleScoreChange(student, 'assignmentScore', e.target.value)}
                          className="w-14 px-1.5 py-1 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        />
                      </td>

                      {/* Project Input (10) */}
                      <td className="py-2 px-2 text-center bg-blue-50/30">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="1"
                          value={rec.projectScore || ''}
                          onChange={(e) => handleScoreChange(student, 'projectScore', e.target.value)}
                          className="w-14 px-1.5 py-1 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        />
                      </td>

                      {/* CA Test Input (20) */}
                      <td className="py-2 px-2 text-center bg-blue-50/30">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="1"
                          value={rec.testScore || ''}
                          onChange={(e) => handleScoreChange(student, 'testScore', e.target.value)}
                          className="w-14 px-1.5 py-1 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                        />
                      </td>

                      {/* Auto-computed Total CA (40) */}
                      <td className="py-2.5 px-2 text-center font-mono font-black text-blue-950 bg-blue-100/40 border-r border-blue-200">
                        {totalCa}
                      </td>

                      {/* Examination Input (60) */}
                      <td className="py-2 px-2 text-center bg-amber-50/30">
                        <div className="relative inline-block">
                          <input
                            type="number"
                            min="0"
                            max="60"
                            step="1"
                            value={rec.examScore || ''}
                            onChange={(e) => handleScoreChange(student, 'examScore', e.target.value)}
                            className="w-16 px-1.5 py-1 text-center font-mono font-bold text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          />
                          {rec.isAutoSynced && (
                            <span
                              className="absolute -top-2 -right-2 text-[9px] font-bold bg-blue-700 text-white px-1 rounded shadow-xs"
                              title="Score was auto-synced from student's CBT examination attempt"
                            >
                              CBT
                            </span>
                          )}
                        </div>
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

                      {/* Teacher Comment */}
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          placeholder="Commendation / academic remark..."
                          value={rec.teacherComment || ''}
                          onChange={(e) => handleScoreChange(student, 'teacherComment', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 placeholder:text-slate-400 placeholder:italic"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
    </div>
  );
};
