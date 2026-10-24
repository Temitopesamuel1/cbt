import React, { useState, useMemo } from 'react';
import {
  Award,
  Printer,
  Download,
  Calendar,
  Layers,
  GraduationCap,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Building,
  School
} from 'lucide-react';
import {
  Student,
  StudentAssessmentRecord,
  calculateGradePoint,
  getAcademicStanding,
  CumulativeTermRecord,
  CumulativeStudentTranscript
} from '../../types/cbt';

interface StudentCumulativeTranscriptProps {
  student: Student;
  records: StudentAssessmentRecord[];
}

export const StudentCumulativeTranscript: React.FC<StudentCumulativeTranscriptProps> = ({
  student,
  records
}) => {
  const [selectedTermFilter, setSelectedTermFilter] = useState<string>('all');

  // Group records by Academic Session and Term
  const transcriptData: CumulativeStudentTranscript = useMemo(() => {
    // If no records, return baseline
    if (!records || records.length === 0) {
      return {
        terms: [],
        cgpa: 0,
        overallAverage: 0,
        totalRegisteredCourses: 0,
        totalPassedCourses: 0,
        standing: getAcademicStanding(0)
      };
    }

    // Grouping by session-term key
    const termMap: Record<string, StudentAssessmentRecord[]> = {};
    records.forEach(r => {
      const key = `${r.academicSession || '2025/2026'}_${r.term || '1st Term'}`;
      if (!termMap[key]) {
        termMap[key] = [];
      }
      termMap[key].push(r);
    });

    const termRecords: CumulativeTermRecord[] = Object.entries(termMap).map(([key, recs]) => {
      const [session, term] = key.split('_');
      const totalPts = recs.reduce((acc, r) => acc + calculateGradePoint(r.totalScore), 0);
      const gpa = recs.length > 0 ? parseFloat((totalPts / recs.length).toFixed(2)) : 0;
      const totalScoreSum = recs.reduce((acc, r) => acc + r.totalScore, 0);
      const avg = recs.length > 0 ? Math.round(totalScoreSum / recs.length) : 0;
      const passed = recs.filter(r => r.totalScore >= 50).length;

      return {
        academicSession: session,
        term: term as '1st Term' | '2nd Term' | '3rd Term',
        records: recs,
        gpa,
        totalCourses: recs.length,
        passedCourses: passed,
        averagePercentage: avg
      };
    });

    // Overall metrics across all terms
    const totalCourses = records.length;
    const totalPoints = records.reduce((acc, r) => acc + calculateGradePoint(r.totalScore), 0);
    const cgpa = totalCourses > 0 ? parseFloat((totalPoints / totalCourses).toFixed(2)) : 0;
    const overallSum = records.reduce((acc, r) => acc + r.totalScore, 0);
    const overallAverage = totalCourses > 0 ? Math.round(overallSum / totalCourses) : 0;
    const totalPassed = records.filter(r => r.totalScore >= 50).length;

    return {
      terms: termRecords,
      cgpa,
      overallAverage,
      totalRegisteredCourses: totalCourses,
      totalPassedCourses: totalPassed,
      standing: getAcademicStanding(cgpa)
    };
  }, [records]);

  // Filtered terms
  const displayTerms = useMemo(() => {
    if (selectedTermFilter === 'all') return transcriptData.terms;
    return transcriptData.terms.filter(t => t.term === selectedTermFilter);
  }, [transcriptData, selectedTermFilter]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Action Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold uppercase tracking-wider">
            <GraduationCap className="w-3.5 h-3.5 text-blue-700" />
            <span>Official Academic Standing & Transcript</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Cumulative Grade Point Average (5.00 Scale)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Multi-term academic ledger compiled from faculty gradebooks, including Continuous Assessment (Assignment, Project, Test) and CBT Examination scores.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Official Transcript</span>
          </button>
        </div>
      </div>

      {/* University Transcript Overview Metrics (5.0 CGPA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* CGPA Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Cumulative CGPA
            </span>
            <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Max: 5.00
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-slate-900">
              {transcriptData.cgpa.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 5.00</span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-900 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (transcriptData.cgpa / 5.0) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Grade Point Index: {Math.round((transcriptData.cgpa / 5.0) * 100)}%
            </span>
          </div>
        </div>

        {/* Academic Standing */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Class of Honours Standing
            </span>
            <div className="mt-1">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border ${transcriptData.standing.color}`}>
                <Award className="w-3.5 h-3.5 shrink-0" />
                <span>{transcriptData.standing.badge}</span>
              </span>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-700 mt-3">
            {transcriptData.standing.title}
          </p>
        </div>

        {/* Weighted Average */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Overall Weighted Avg
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black font-mono text-emerald-800">
            {transcriptData.overallAverage}%
          </div>
          <span className="text-[11px] text-slate-500 mt-2">
            Average across {transcriptData.totalRegisteredCourses} recorded evaluations
          </span>
        </div>

        {/* Course Completion */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Course Clearance
            </span>
            <CheckCircle2 className="w-4 h-4 text-blue-700" />
          </div>
          <div className="text-3xl font-black font-mono text-slate-900">
            {transcriptData.totalPassedCourses}{' '}
            <span className="text-base font-normal text-slate-400">/ {transcriptData.totalRegisteredCourses}</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-2">
            {transcriptData.totalRegisteredCourses > 0
              ? `${Math.round((transcriptData.totalPassedCourses / transcriptData.totalRegisteredCourses) * 100)}% Pass Rate`
              : 'No courses registered'}
          </span>
        </div>
      </div>

      {/* PRINTABLE / OFFICIAL TRANSCRIPT STATEMENT */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8 print:p-0 print:border-none print:shadow-none">
        {/* University Header for Transcript */}
        <div className="border-b-2 border-slate-900 pb-6 text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black text-xl shadow-xs">
              HW
            </div>
            <div className="text-left">
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider text-slate-900">
                HONEY'S WORLD HIGH SCHOOL
              </h1>
              <p className="text-xs text-blue-950 font-bold uppercase tracking-wider">
                GAA AJANAKU, ILORIN, KWARA STATE
              </p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                DIRECTORATE OF ACADEMIC AFFAIRS & STUDENT RECORDS
              </p>
            </div>
          </div>
          <h2 className="text-sm sm:text-base font-black text-blue-950 uppercase tracking-widest pt-2">
            OFFICIAL STATEMENT OF ACADEMIC RESULT & CUMULATIVE TRANSCRIPT
          </h2>
        </div>

        {/* Student Biodata & Matriculation Summary Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 font-bold uppercase block text-[10px]">Student Full Name</span>
            <strong className="text-slate-900 text-sm">{student.fullName}</strong>
          </div>
          <div>
            <span className="text-slate-400 font-bold uppercase block text-[10px]">Matric / Admission No</span>
            <strong className="text-blue-900 text-sm font-mono">{student.admissionNumber}</strong>
          </div>
          <div>
            <span className="text-slate-400 font-bold uppercase block text-[10px]">Class Cohort / Level</span>
            <strong className="text-slate-900 text-sm">{student.classGrade}</strong>
          </div>
          <div>
            <span className="text-slate-400 font-bold uppercase block text-[10px]">Academic Standing</span>
            <strong className="text-emerald-800 text-sm font-bold">{transcriptData.standing.badge}</strong>
          </div>
        </div>

        {/* Term-by-Term Ledger Tables */}
        {displayTerms.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
            <FileText className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold">No Continuous Assessment or Exam records on file yet.</p>
            <p className="text-xs text-slate-400">
              Subject teachers are presently scoring continuous assessments and examinations. Once entered, marks sync here instantly.
            </p>
          </div>
        ) : (
          displayTerms.map((term, tIdx) => (
            <div key={tIdx} className="space-y-3">
              {/* Term Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-900 text-white text-xs font-bold">
                    {term.term}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    Session: {term.academicSession}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-mono mt-1 sm:mt-0 flex items-center gap-3">
                  <span>Term Average: <strong>{term.averagePercentage}%</strong></span>
                  <span>·</span>
                  <span>Term GPA: <strong className="text-blue-900 font-black">{term.gpa.toFixed(2)}</strong></span>
                </div>
              </div>

              {/* Assessment Broad Sheet Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Subject / Course</th>
                      <th className="py-2.5 px-2 text-center">Assgn (10)</th>
                      <th className="py-2.5 px-2 text-center">Proj (10)</th>
                      <th className="py-2.5 px-2 text-center">Test (20)</th>
                      <th className="py-2.5 px-2 text-center">Exam (60)</th>
                      <th className="py-2.5 px-2 text-center">Total (100)</th>
                      <th className="py-2.5 px-2 text-center">Grade</th>
                      <th className="py-2.5 px-2 text-center">Point</th>
                      <th className="py-2.5 px-3">Remark / Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {term.records.map((r, rIdx) => {
                      const gradePt = calculateGradePoint(r.totalScore);
                      return (
                        <tr key={r.id || rIdx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{r.subjectName}</td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-600">{r.assignmentScore ?? '-'}</td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-600">{r.projectScore ?? '-'}</td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-600">{r.testScore ?? '-'}</td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-600">{r.examScore ?? '-'}</td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-900">{r.totalScore}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-900">
                              {r.grade}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-blue-900">
                            {gradePt.toFixed(1)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <span>{r.remark}</span>
                            {r.teacherComment && (
                              <span className="text-slate-400 text-[10px] italic block">"{r.teacherComment}"</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}

        {/* Grading Scale Reference */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-500 space-y-1">
          <strong className="text-slate-700 block uppercase">Official 5-Point University Grading Key:</strong>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono">
            <span>75-100%: <strong>A1 (5.00 Pts - Distinction)</strong></span>
            <span>70-74%: <strong>B2 (4.00 Pts - Very Good)</strong></span>
            <span>65-69%: <strong>B3 (3.50 Pts - Good)</strong></span>
            <span>60-64%: <strong>C4 (3.00 Pts - Credit)</strong></span>
            <span>55-59%: <strong>C5 (2.50 Pts - Credit)</strong></span>
            <span>50-54%: <strong>C6 (2.00 Pts - Credit)</strong></span>
            <span>45-49%: <strong>D7 (1.50 Pts - Pass)</strong></span>
            <span>40-44%: <strong>E8 (1.00 Pts - Pass)</strong></span>
            <span>0-39%: <strong>F9 (0.00 Pts - Fail)</strong></span>
          </div>
        </div>

        {/* Verification & Sign-off Signature Section */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-8 text-center text-xs">
          <div className="space-y-8">
            <div className="border-b border-slate-300 h-8" />
            <div>
              <strong className="block text-slate-900">Dean of Academic Affairs</strong>
              <span className="text-slate-400 text-[10px]">Academic Board of Registry</span>
            </div>
          </div>
          <div className="space-y-8">
            <div className="border-b border-slate-300 h-8" />
            <div>
              <strong className="block text-slate-900">Registrar & Student Records</strong>
              <span className="text-slate-400 text-[10px]">Official Institutional Seal</span>
            </div>
          </div>
          <div className="space-y-8 col-span-2 sm:col-span-1">
            <div className="border-b border-slate-300 h-8" />
            <div>
              <strong className="block text-slate-900">Date of Verification</strong>
              <span className="text-slate-400 font-mono text-[10px]">{new Date().toLocaleDateString('en-GB')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
