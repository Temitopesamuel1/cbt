import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Award,
  BookOpen,
  Calendar,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  BrainCircuit,
  Lightbulb,
  Zap
} from 'lucide-react';
import { Student, StudentAssessmentRecord, Submission } from '../../types/cbt';
import { generateStudentAiRecommendations, AiAcademicAdvice } from '../../services/aiAdvisor';

interface StudentAiAdvisorViewProps {
  student: Student;
  records: StudentAssessmentRecord[];
  submissions: Submission[];
}

export const StudentAiAdvisorView: React.FC<StudentAiAdvisorViewProps> = ({
  student,
  records,
  submissions
}) => {
  const [advice, setAdvice] = useState<AiAcademicAdvice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchAdvice = async () => {
    setLoading(true);
    try {
      const res = await generateStudentAiRecommendations(student, records, submissions);
      setAdvice(res);
    } catch (err) {
      console.warn('AI Advisor fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdvice();
  }, [student, records, submissions]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchAdvice();
  };

  return (
    <div className="space-y-6">
      {/* Top AI Advisor Banner */}
      <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white/10 border border-white/20 text-blue-200 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Academic Mentor & Diagnostic Engine</span>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-semibold text-white transition-colors flex items-center gap-2 cursor-pointer self-start sm:self-auto disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Re-evaluating...' : 'Refresh AI Analysis'}</span>
            </button>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black">
              Personalized Academic Guidance for {student.fullName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Powered by Google Gemini 3.8 Flash. Our system continuously reviews your assignment scores, laboratory/project marks, continuous assessments, and CBT attempts to curate an actionable study plan.
            </p>
          </div>

          {advice && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs text-xs text-slate-200 flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Academic Projection:</strong>
                {advice.cgpaProjection}
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Synthesizing Academic Diagnostic...</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Analyzing student scores across continuous assessments, question topic accuracy, and projected university CGPA.
          </p>
        </div>
      ) : advice ? (
        <div className="space-y-6">
          {/* Executive Diagnostic Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-blue-900" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Executive Academic Diagnostic
              </h3>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {advice.executiveSummary}
            </p>
          </div>

          {/* Strengths & Weak Areas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Key Academic Strengths */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Core Academic Strengths & Mastery
                </h4>
              </div>

              {advice.strengths.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  Continue taking examinations and completing assignments to surface subject strengths.
                </p>
              ) : (
                <div className="space-y-3">
                  {advice.strengths.map((str, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-emerald-950">{str.subject}</span>
                        <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          Avg: {str.score}%
                        </span>
                      </div>
                      <p className="text-xs text-emerald-900/80">{str.praise}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Critical Weak Areas & Intervention */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Targeted Remediation & Focus Units
                </h4>
              </div>

              {advice.weakAreas.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-xs text-slate-600">
                  All recorded subjects are above 60%. Excellent consistency across your syllabus.
                </div>
              ) : (
                <div className="space-y-3">
                  {advice.weakAreas.map((w, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-amber-950">{w.subject}</span>
                        <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          Avg: {w.score}%
                        </span>
                      </div>
                      <p className="text-xs text-amber-900/80">{w.remedy}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 7-Day Personalized Smart Study Schedule */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-900" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    7-Day Personalized Revision Timetable
                  </h4>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Optimized daily study blocks designed to balance syllabus coverage and address weak topics.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-blue-50 text-blue-900 border border-blue-200 self-start sm:self-auto">
                Adaptive AI Schedule
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {advice.dailyStudyPlan.map((plan, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-blue-900 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-950 px-2 py-0.5 rounded bg-blue-100/60">
                      {plan.day}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {plan.durationMinutes} mins
                    </span>
                  </div>

                  <div>
                    <strong className="text-xs text-slate-900 block">{plan.focusSubject}</strong>
                    <span className="text-[11px] text-slate-500 block">{plan.recommendedTopic}</span>
                  </div>

                  <p className="text-[11px] text-slate-600 border-t border-slate-200 pt-2 line-clamp-2">
                    {plan.activity}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Strategic Examination Tips & Motivation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <span>High-Yield CBT & Examination Strategies</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-700">
                {advice.examTips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 mt-0.5">
                      0{idx + 1}
                    </span>
                    <span className="leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
                  Academic Mindset
                </span>
                <p className="text-xs italic text-slate-200 leading-relaxed">
                  "{advice.motivationalQuote}"
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-400 font-mono">
                PRIME EDUTECH AI Faculty
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
