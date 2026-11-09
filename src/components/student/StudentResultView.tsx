import React, { useState } from 'react';
import {
  Printer,
  RotateCcw,
  BookOpen,
  Award,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Clock,
  ChevronDown,
  ChevronUp,
  School,
  Lock,
  ShieldCheck,
  UserCheck,
  Check,
  FileCheck,
  QrCode
} from 'lucide-react';
import {
  Submission,
  calculateGrade,
  calculateGradePoint,
  SchoolSettings,
  Student
} from '../../types/cbt';
import { DEFAULT_SCHOOL_SETTINGS } from '../../data/initialSchoolData';

interface StudentResultViewProps {
  submission: Submission;
  allowReview?: boolean;
  onReturnToDashboard: () => void;
  settings?: SchoolSettings;
  student?: Student | null;
}

export const StudentResultView: React.FC<StudentResultViewProps> = ({
  submission,
  allowReview = true,
  onReturnToDashboard,
  settings,
  student
}) => {
  const [showQuestionsReview, setShowQuestionsReview] = useState(false);
  const activeSettings = settings || DEFAULT_SCHOOL_SETTINGS;

  const grade = calculateGrade(submission.percentage);
  const gradePoint = calculateGradePoint(submission.percentage);

  const mins = Math.floor(submission.timeSpentSeconds / 60);
  const secs = submission.timeSpentSeconds % 60;
  const timeFormatted = `${mins}m ${secs}s`;

  const formattedDate = new Date(submission.submittedAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const formattedTime = new Date(submission.submittedAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Unique computerized verification ref
  const verificationRef = submission.id
    ? submission.id.toUpperCase()
    : `HWHS-${submission.academicSession.replace('/', '')}-${submission.admissionNumber.replace(/[^A-Za-z0-9]/g, '')}`;

  // Standing classification
  const getClassification = (pct: number) => {
    if (pct >= 75) return { text: 'DISTINCTION', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' };
    if (pct >= 65) return { text: 'UPPER CREDIT', color: 'text-blue-700 bg-blue-50 border-blue-300' };
    if (pct >= 50) return { text: 'CREDIT PASS', color: 'text-indigo-700 bg-indigo-50 border-indigo-300' };
    if (pct >= 40) return { text: 'PASS', color: 'text-amber-700 bg-amber-50 border-amber-300' };
    return { text: 'UNSATISFACTORY', color: 'text-rose-700 bg-rose-50 border-rose-300' };
  };
  const classification = getClassification(submission.percentage);

  // Logo URL with graceful fallbacks
  const schoolLogoUrl = activeSettings.schoolLogo || '/school-logo.png';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100/70 py-6 px-3 sm:px-6 lg:px-8">
      {/* Print Specific CSS Stylesheet */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #0f172a !important;
          }
          .no-print {
            display: none !important;
          }
          .printable-slip {
            border: 2px solid #0f172a !important;
            box-shadow: none !important;
            margin: 0 auto !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            border-radius: 0 !important;
            background: #ffffff !important;
          }
          .printable-slip * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Action Bar (Hidden on print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs no-print">
          <button
            onClick={onReturnToDashboard}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Return to Student Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-xs font-semibold text-slate-500">
              Session {submission.academicSession}
            </span>
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-950 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Print Official Result Slip</span>
            </button>
          </div>
        </div>

        {/* OFFICIAL INSTITUTIONAL RESULT SLIP */}
        <div className="bg-white rounded-2xl border-2 border-slate-800 shadow-lg overflow-hidden printable-slip">
          {/* Top Institutional Header / Letterhead */}
          <div className="bg-gradient-to-b from-blue-950 via-slate-900 to-blue-950 text-white p-5 sm:p-7 border-b-4 border-amber-500 relative">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
              {/* Crest Logo & Institutional Title */}
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white p-1 border-2 border-amber-400 shadow-md flex items-center justify-center overflow-hidden">
                    <img
                      src={schoolLogoUrl}
                      alt="Honey's World High School Crest"
                      className="w-full h-full object-contain rounded-full"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        const parent = (e.currentTarget as HTMLElement).parentElement;
                        if (parent) {
                          parent.innerHTML = '<span class="text-blue-950 font-black text-xl font-serif">HW</span>';
                        }
                      }}
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full shadow-xs border border-white">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="inline-block px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-[10px] font-bold uppercase tracking-widest text-amber-300 mb-0.5">
                    Government Approved · Ministry of Education Registered
                  </div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-wide font-serif text-white drop-shadow-xs">
                    {activeSettings.schoolName || "HONEY'S WORLD HIGH SCHOOL"}
                  </h1>
                  <p className="text-xs sm:text-sm font-semibold text-amber-200">
                    {activeSettings.address || 'Gaa Ajanaku, Ilorin, Kwara State, Nigeria'}
                  </p>
                  <p className="text-[11px] italic font-serif text-slate-300">
                    "{activeSettings.motto || 'Knowledge, Character & Academic Excellence'}"
                  </p>
                  <div className="text-[10px] text-slate-300 font-mono pt-0.5 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-0.5">
                    <span>Email: {activeSettings.email || 'info@honeysworldhigh.edu.ng'}</span>
                    <span>•</span>
                    <span>Tel: {activeSettings.phone || '+234 803 000 0000'}</span>
                    <span>•</span>
                    <span>Portal: {activeSettings.website || 'www.honeysworldhigh.edu.ng'}</span>
                  </div>
                </div>
              </div>

              {/* Barcode & Verification Reference */}
              <div className="shrink-0 bg-white/10 backdrop-blur-xs border border-white/20 p-3 rounded-xl text-center sm:text-right min-w-[170px]">
                <span className="text-[9px] uppercase font-mono tracking-widest text-slate-300 block">
                  Document Security Ref
                </span>
                <span className="text-xs font-mono font-bold text-amber-300 block mt-0.5 tracking-wider">
                  {verificationRef}
                </span>

                {/* Simulated Barcode Visual */}
                <div className="my-2 bg-white px-2 py-1 rounded flex items-center justify-center space-x-0.5 h-7 overflow-hidden">
                  {[2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 3, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2].map((w, idx) => (
                    <span
                      key={idx}
                      className="bg-slate-900 h-full inline-block"
                      style={{ width: `${w}px` }}
                    />
                  ))}
                </div>

                <span className="text-[9px] font-mono text-slate-300 block">
                  Issued: {formattedDate}
                </span>
              </div>
            </div>

            {/* Document Title Strip */}
            <div className="mt-4 pt-3 border-t border-white/20 flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
              <span className="font-bold text-amber-300 uppercase tracking-widest text-center sm:text-left text-xs sm:text-sm">
                OFFICIAL CANDIDATE EXAMINATION RESULT SLIP & EVALUATION SHEET
              </span>
              <span className="bg-amber-400 text-slate-950 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider font-mono">
                {submission.academicSession} · {submission.term}
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-8 space-y-6">
            {/* Candidate Biodata & Examination Particulars Card */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 sm:p-5 relative overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                {/* Passport Photo Section */}
                <div className="md:col-span-3 flex flex-col items-center justify-center text-center pb-4 md:pb-0 md:border-r border-slate-200">
                  <div className="w-28 h-32 rounded-lg border-2 border-slate-400 p-1 bg-white shadow-xs relative flex items-center justify-center overflow-hidden">
                    {student?.passportUrl ? (
                      <img
                        src={student.passportUrl}
                        alt={submission.studentName}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                        <UserCheck className="w-10 h-10 text-slate-400 mb-1" />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                          Candidate Photo
                        </span>
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 bg-emerald-600 text-white text-[8px] font-bold px-1 py-0.5 rounded shadow-xs">
                      VERIFIED
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-600 mt-2 block">
                    {submission.admissionNumber}
                  </span>
                </div>

                {/* Candidate Particulars Details */}
                <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div className="flex flex-col border-b border-slate-200/80 pb-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Student Full Name
                    </span>
                    <span className="font-black text-slate-900 text-sm uppercase">
                      {submission.studentName}
                    </span>
                  </div>

                  <div className="flex flex-col border-b border-slate-200/80 pb-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Admission / Matric No.
                    </span>
                    <span className="font-mono font-bold text-blue-900 text-sm">
                      {submission.admissionNumber}
                    </span>
                  </div>

                  <div className="flex flex-col border-b border-slate-200/80 pb-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Class & Form Arm
                    </span>
                    <span className="font-semibold text-slate-800">
                      {submission.classGrade} {student?.department ? `(${student.department})` : ''}
                    </span>
                  </div>

                  <div className="flex flex-col border-b border-slate-200/80 pb-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Academic Session / Term
                    </span>
                    <span className="font-semibold text-slate-800">
                      {submission.academicSession} · {submission.term}
                    </span>
                  </div>

                  <div className="flex flex-col border-b border-slate-200/80 pb-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Subject / Course
                    </span>
                    <span className="font-bold text-blue-900">
                      {submission.subject}
                    </span>
                  </div>

                  <div className="flex flex-col border-b border-slate-200/80 pb-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Paper Administered
                    </span>
                    <span className="font-semibold text-slate-800 truncate" title={submission.examTitle}>
                      {submission.examTitle}
                    </span>
                  </div>

                  <div className="flex flex-col pt-0.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Date & Time Administered
                    </span>
                    <span className="font-medium text-slate-700">
                      {formattedDate} at {formattedTime}
                    </span>
                  </div>

                  <div className="flex flex-col pt-0.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Exam Duration Taken
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {timeFormatted}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Official Assessed Score & Grade Matrix */}
            <div className="border-2 border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  <span>Official Graded Assessment Performance</span>
                </span>
                <span className="text-[10px] font-mono text-slate-300">
                  WAEC / NECO Secondary Standard
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x-2 divide-slate-200 bg-white p-4 text-center">
                {/* Score */}
                <div className="p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    CBT Raw Score
                  </span>
                  <div className="text-3xl sm:text-4xl font-black font-mono text-slate-900">
                    {submission.score}
                    <span className="text-lg text-slate-400 font-normal"> / {submission.totalQuestions}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                    Questions Correct
                  </span>
                </div>

                {/* Percentage */}
                <div className="p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Percentage Mark
                  </span>
                  <div className="text-3xl sm:text-4xl font-black font-mono text-blue-900">
                    {submission.percentage}%
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                    Weighted 100% Scale
                  </span>
                </div>

                {/* Grade */}
                <div className="p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Official Grade
                  </span>
                  <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-700">
                    {grade.grade}
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 mt-1 block">
                    {grade.remark}
                  </span>
                </div>

                {/* Standing & GP */}
                <div className="p-3 flex flex-col justify-center items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Academic Standing
                  </span>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-black uppercase border ${classification.color}`}>
                    {classification.text}
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-600 mt-2 block">
                    GP Point: {gradePoint.toFixed(2)} / 5.00
                  </span>
                </div>
              </div>
            </div>

            {/* Topic-Level Diagnostic Mastery Breakdown */}
            {submission.topicAnalysis && Object.keys(submission.topicAnalysis).length > 0 && (
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-blue-900" />
                    <span>Curriculum Syllabus Domain Diagnostics</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    {Object.keys(submission.topicAnalysis).length} Domains Evaluated
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.values(submission.topicAnalysis).map((t, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-800 text-[11px] line-clamp-1 mb-1">
                          {t.topic}
                        </div>
                        <div className="flex items-center justify-between font-mono text-[11px] text-slate-600">
                          <span>{t.correct}/{t.total} Marks</span>
                          <span
                            className={`font-black ${
                              t.percentage >= 70
                                ? 'text-emerald-700'
                                : t.percentage >= 50
                                ? 'text-blue-800'
                                : 'text-rose-700'
                            }`}
                          >
                            {t.percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            t.percentage >= 70
                              ? 'bg-emerald-600'
                              : t.percentage >= 50
                              ? 'bg-blue-600'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${t.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Academic Recommendations Advisory */}
            {submission.aiRevisionRecommendations && submission.aiRevisionRecommendations.length > 0 && (
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-900 font-bold uppercase tracking-wider text-[11px]">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                  <span>Curriculum Evaluation Advisory & Teacher Remarks</span>
                </div>
                <div className="space-y-1 text-slate-700">
                  {submission.aiRevisionRecommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Official Institutional Endorsement, Dual Signatures & Seal */}
            <div className="pt-6 border-t-2 border-slate-300">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center text-center">
                {/* Examination Officer Sign-Off */}
                <div className="space-y-2 flex flex-col items-center">
                  <div className="h-12 flex items-end justify-center w-full">
                    <span className="font-serif italic text-blue-950 font-bold text-lg tracking-wider border-b-2 border-slate-800 pb-0.5 px-6">
                      O. Benson
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-900 block uppercase">
                      Mr. Olawale Benson (B.Sc. Ed)
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                      Examination & CBT Officer
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                      Signed: {formattedDate}
                    </span>
                  </div>
                </div>

                {/* Circular Official Institutional Stamp Seal */}
                <div className="flex flex-col items-center justify-center py-2">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-blue-900/60 p-1 flex items-center justify-center relative rotate-[-6deg]">
                    <div className="w-full h-full rounded-full border-2 border-blue-950 flex flex-col items-center justify-center p-1 text-center bg-blue-50/30">
                      <span className="text-[7px] font-black uppercase text-blue-950 tracking-tight leading-none">
                        HONEY'S WORLD HIGH SCHOOL
                      </span>
                      <Award className="w-4 h-4 text-amber-600 my-0.5" />
                      <span className="text-[6.5px] font-bold uppercase text-blue-900 tracking-widest leading-none">
                        OFFICIAL EXAMINATION SEAL
                      </span>
                      <span className="text-[6px] font-mono text-slate-600 mt-0.5">
                        ILORIN · KWARA STATE
                      </span>
                    </div>
                  </div>
                  <span className="text-[8px] font-mono uppercase text-slate-400 mt-1">
                    CERTIFIED TRUE RESULT
                  </span>
                </div>

                {/* Principal Sign-Off */}
                <div className="space-y-2 flex flex-col items-center">
                  <div className="h-12 flex items-end justify-center w-full">
                    <span className="font-serif italic text-blue-950 font-bold text-lg tracking-wider border-b-2 border-slate-800 pb-0.5 px-6">
                      A. B. Adeyemi
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-900 block uppercase">
                      {activeSettings.principalName || 'Mrs. A. B. Adeyemi (M.Ed, FSTAN)'}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                      Principal & Academic Director
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                      Endorsed: {formattedDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Legal / Security Footer */}
              <div className="mt-6 pt-3 border-t border-slate-200 text-center text-[9px] text-slate-400 space-y-0.5">
                <p>
                  <strong>SECURITY NOTICE:</strong> This computerized examination result slip is an official academic transcript of{' '}
                  <span className="uppercase text-slate-600">{activeSettings.schoolName || "Honey's World High School"}</span>, Gaa Ajanaku, Ilorin, Kwara State.
                </p>
                <p>
                  Any erasure, alteration, or falsification renders this document void and constitutes an examination offense. Generated via Honey's World Academic Examination & Broadscore System.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Question Review Section (Teacher Controlled, collapsible, no-print) */}
        {allowReview && submission.detailedResults && submission.detailedResults.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 no-print">
            <button
              onClick={() => setShowQuestionsReview(prev => !prev)}
              className="w-full flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-900" />
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-900 transition-colors">
                  Comprehensive Examination Corrections & Question Review
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  ({submission.detailedResults.length} Questions)
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg transition-colors">
                <span>{showQuestionsReview ? 'Hide Corrections' : 'View Corrections'}</span>
                {showQuestionsReview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showQuestionsReview && (
              <div className="mt-6 space-y-4 pt-4 border-t border-slate-100">
                {submission.detailedResults.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border-2 transition-colors ${
                      item.isCorrect ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                          Q{item.questionNumber}
                        </span>
                        {item.topic && (
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {item.topic}
                          </span>
                        )}
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                            item.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.isCorrect ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Correct
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-600" /> Incorrect
                            </>
                          )}
                        </span>
                      </div>

                      <div className="text-xs font-mono">
                        <span className="text-slate-500">Your Answer: </span>
                        <strong className={item.isCorrect ? 'text-emerald-700' : 'text-rose-700'}>
                          {item.studentAnswer || 'Skipped'}
                        </strong>
                        <span className="text-slate-400 mx-1.5">|</span>
                        <span className="text-slate-500">Key: </span>
                        <strong className="text-blue-900">{item.correctAnswer}</strong>
                      </div>
                    </div>

                    <div className="text-xs text-slate-900 font-medium mb-3">
                      {item.questionText}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                      {(['A', 'B', 'C', 'D'] as const).map(opt => {
                        const optKey = `option${opt}` as 'optionA' | 'optionB' | 'optionC' | 'optionD';
                        const text = item[optKey];
                        const isPicked = item.studentAnswer === opt;
                        const isActual = item.correctAnswer === opt;

                        let style = 'bg-white border-slate-200 text-slate-700';
                        if (isActual) {
                          style = 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold';
                        } else if (isPicked && !item.isCorrect) {
                          style = 'bg-rose-100 border-rose-400 text-rose-900 line-through';
                        }

                        return (
                          <div key={opt} className={`p-2 rounded-lg border text-[11px] flex items-center gap-2 ${style}`}>
                            <span className="font-bold font-mono">{opt}.</span>
                            <span>{text}</span>
                          </div>
                        );
                      })}
                    </div>

                    {item.explanation && (
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600">
                        <strong className="text-blue-900">Curriculum Explanation: </strong>
                        {item.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : !allowReview ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500 space-y-1 no-print">
            <Lock className="w-5 h-5 text-slate-400 mx-auto" />
            <div className="font-bold text-slate-800">Answer Key Withheld</div>
            <p>Per examination settings, detailed question corrections will be released once all class candidates have concluded.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
