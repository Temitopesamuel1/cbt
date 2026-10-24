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
  Lock
} from 'lucide-react';
import { Submission, calculateGrade } from '../../types/cbt';

interface StudentResultViewProps {
  submission: Submission;
  allowReview?: boolean;
  onReturnToDashboard: () => void;
}

export const StudentResultView: React.FC<StudentResultViewProps> = ({
  submission,
  allowReview = true,
  onReturnToDashboard
}) => {
  const [showQuestionsReview, setShowQuestionsReview] = useState(false);
  const grade = calculateGrade(submission.percentage);

  const mins = Math.floor(submission.timeSpentSeconds / 60);
  const secs = submission.timeSpentSeconds % 60;
  const timeFormatted = `${mins}m ${secs}s`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation / Action bar */}
        <div className="flex items-center justify-between no-print">
          <button
            onClick={onReturnToDashboard}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Return to Student Dashboard</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Official Result Slip</span>
          </button>
        </div>

        {/* Official Institutional Result Slip */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden printable-slip">
          {/* Slip Header */}
          <div className="bg-slate-900 text-white p-6 border-b-2 border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold">
                <School className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-white uppercase">
                  HONEY'S WORLD HIGH SCHOOL
                </h1>
                <p className="text-xs text-amber-300 font-semibold">
                  Gaa Ajanaku, Ilorin, Kwara State · Official Examination Result Slip
                </p>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block">
                Verification Reference
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">
                {submission.id ? submission.id.toUpperCase() : `REC-${Date.now().toString().slice(-8)}`}
              </span>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {/* Candidate & Paper Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                  Student Particulars
                </span>
                <dl className="space-y-1.5">
                  <div className="flex">
                    <dt className="w-32 text-slate-500">Student Name:</dt>
                    <dd className="font-bold text-slate-900">{submission.studentName}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-32 text-slate-500">Admission No:</dt>
                    <dd className="font-mono font-bold text-blue-900">{submission.admissionNumber}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-32 text-slate-500">Class Form:</dt>
                    <dd className="font-semibold text-slate-800">{submission.classGrade}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-32 text-slate-500">Session / Term:</dt>
                    <dd className="font-medium text-slate-700">{submission.academicSession} ({submission.term})</dd>
                  </div>
                </dl>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                  Examination Particulars
                </span>
                <dl className="space-y-1.5">
                  <div className="flex">
                    <dt className="w-32 text-slate-500">Examination:</dt>
                    <dd className="font-bold text-slate-900">{submission.examTitle}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-32 text-slate-500">Subject:</dt>
                    <dd className="font-semibold text-blue-900">{submission.subject}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-32 text-slate-500">Time Taken:</dt>
                    <dd className="font-mono text-slate-800">{timeFormatted}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-32 text-slate-500">Submission Date:</dt>
                    <dd className="text-slate-800">
                      {new Date(submission.submittedAt).toLocaleString('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Score Callout */}
            <div className="py-4 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block">
                Official Assessed Performance
              </span>
              <div className="text-5xl font-black font-mono text-slate-900 mt-2">
                {submission.score} <span className="text-2xl text-slate-400 font-normal">/ {submission.totalQuestions}</span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-3">
                <span className="text-xl font-bold font-mono text-slate-800">{submission.percentage}%</span>
                <span className="text-slate-300">·</span>
                <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${grade.color}`}>
                  Grade {grade.grade} ({grade.remark})
                </span>
              </div>
            </div>

            {/* Topic Diagnostics & Revision Guidance (Intelligent Assessment) */}
            {submission.aiRevisionRecommendations && submission.aiRevisionRecommendations.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Personalized Revision Advisory
                  </h3>
                </div>

                <div className="space-y-1.5 text-xs text-slate-700">
                  {submission.aiRevisionRecommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-blue-900 font-bold">•</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">
                  Advisory diagnostic generated from topic-level question evaluations. Academic teachers remain responsible for official grading and remedial decisions.
                </p>
              </div>
            )}

            {/* Topic Breakdown Grid */}
            {submission.topicAnalysis && Object.keys(submission.topicAnalysis).length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Topic-Level Mastery Assessment
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.values(submission.topicAnalysis).map((t, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 p-3 rounded-lg text-xs">
                      <div className="font-bold text-slate-800 truncate mb-1">{t.topic}</div>
                      <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                        <span>Score: {t.correct}/{t.total}</span>
                        <span className={`font-bold ${t.percentage >= 70 ? 'text-emerald-700' : t.percentage >= 50 ? 'text-blue-800' : 'text-rose-700'}`}>
                          {t.percentage}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${t.percentage >= 70 ? 'bg-emerald-600' : t.percentage >= 50 ? 'bg-blue-600' : 'bg-rose-500'}`}
                          style={{ width: `${t.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Question Review Section (Teacher Controlled) */}
        {allowReview && submission.detailedResults && submission.detailedResults.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 no-print">
            <button
              onClick={() => setShowQuestionsReview(prev => !prev)}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-900" />
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-900">
                  Comprehensive Examination Corrections & Explanations
                </h3>
                <span className="text-xs text-slate-500">
                  ({submission.detailedResults.length} Questions)
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-blue-900">
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
                    <div className="flex items-start justify-between gap-3 mb-2">
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
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500 space-y-1">
            <Lock className="w-5 h-5 text-slate-400 mx-auto" />
            <div className="font-bold text-slate-800">Answer Key Withheld</div>
            <p>Per examination settings, detailed question corrections will be released once all class candidates have concluded.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
