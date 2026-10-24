import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Check,
  ChevronRight,
  Target,
  Zap,
  Award,
  Layers,
  GraduationCap
} from 'lucide-react';
import {
  PRACTICE_SUBJECTS,
  PRACTICE_QUESTION_BANK,
  PracticeQuestion
} from '../../data/practiceQuestionsData';

export const StudentPracticeQuiz: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('Mathematics');
  const [selectedTopic, setSelectedTopic] = useState<string>('All Topics');
  const [quizMode, setQuizMode] = useState<'tutor' | 'exam'>('tutor');
  const [questionCount, setQuestionCount] = useState<number>(5);

  // Active quiz state
  const [quizActive, setQuizActive] = useState<boolean>(false);
  const [quizQuestions, setQuizQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [revealedTutorQuestions, setRevealedTutorQuestions] = useState<Record<string, boolean>>({});
  const [quizFinished, setQuizFinished] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);

  // Available topics for selected subject
  const currentSubjectMeta = useMemo(() => {
    return PRACTICE_SUBJECTS.find(s => s.name === selectedSubject) || PRACTICE_SUBJECTS[0];
  }, [selectedSubject]);

  // Pool of available questions
  const availableQuestions = useMemo(() => {
    return PRACTICE_QUESTION_BANK.filter(q => {
      if (q.subject !== selectedSubject) return false;
      if (selectedTopic !== 'All Topics' && q.topic !== selectedTopic) return false;
      return true;
    });
  }, [selectedSubject, selectedTopic]);

  // Start Quiz handler
  const handleStartQuiz = () => {
    let pool = [...availableQuestions];
    if (pool.length === 0) {
      // Fallback to all questions for this subject if topic is empty
      pool = PRACTICE_QUESTION_BANK.filter(q => q.subject === selectedSubject);
    }
    // Shuffle pool
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, questionCount);
    setQuizQuestions(shuffled);
    setCurrentIndex(0);
    setAnswers({});
    setRevealedTutorQuestions({});
    setQuizFinished(false);
    setSecondsRemaining(shuffled.length * 60); // 1 minute per question
    setQuizActive(true);
  };

  // Timer countdown for exam mode
  useEffect(() => {
    if (!quizActive || quizFinished || quizMode !== 'exam') return;
    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setQuizFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [quizActive, quizFinished, quizMode]);

  const handleSelectOption = (questionId: string, option: 'A' | 'B' | 'C' | 'D') => {
    if (quizFinished) return;
    setAnswers(prev => ({ ...prev, [questionId]: option }));
    if (quizMode === 'tutor') {
      setRevealedTutorQuestions(prev => ({ ...prev, [questionId]: true }));
    }
  };

  const currentQ = quizQuestions[currentIndex];

  // Score computation
  const scoreStats = useMemo(() => {
    if (quizQuestions.length === 0) return { correct: 0, total: 0, percentage: 0 };
    let correct = 0;
    quizQuestions.forEach(q => {
      if (answers[q.id] === q.correctOption) correct++;
    });
    return {
      correct,
      total: quizQuestions.length,
      percentage: Math.round((correct / quizQuestions.length) * 100)
    };
  }, [quizQuestions, answers]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Quiz Setup Screen */}
      {!quizActive && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                <span>Interactive University Practice Engine</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Self-Paced Subject & Topic Practice Tests
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Reinforce mastery, solve high-yield examination questions, and read thorough explanatory rationale for every option.
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center sm:text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Question Bank Status</span>
              <strong className="text-sm font-black text-slate-900 font-mono">
                {PRACTICE_QUESTION_BANK.length} Curated Questions
              </strong>
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subject Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                1. Select Subject
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PRACTICE_SUBJECTS.map(subj => {
                  const isSelected = selectedSubject === subj.name;
                  return (
                    <button
                      key={subj.name}
                      onClick={() => {
                        setSelectedSubject(subj.name);
                        setSelectedTopic('All Topics');
                      }}
                      className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-900 bg-blue-50/60 ring-2 ring-blue-900/20 text-blue-950 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{subj.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                          {subj.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{subj.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topic & Mode Selector */}
            <div className="space-y-5">
              {/* Topic Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  2. Select Topic Area
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {currentSubjectMeta.topics.map(topic => (
                    <button
                      key={topic}
                      onClick={() => setSelectedTopic(topic)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        selectedTopic === topic
                          ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  3. Practice Delivery Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setQuizMode('tutor')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      quizMode === 'tutor'
                        ? 'bg-blue-50/70 border-blue-900 ring-2 ring-blue-900/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-blue-950 font-bold text-xs mb-1">
                      <Zap className="w-4 h-4 text-blue-700" />
                      <span>Tutor Mode</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Instant answer check & detailed step-by-step reasoning on each question.
                    </p>
                  </button>

                  <button
                    onClick={() => setQuizMode('exam')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      quizMode === 'exam'
                        ? 'bg-blue-50/70 border-blue-900 ring-2 ring-blue-900/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-blue-950 font-bold text-xs mb-1">
                      <Clock className="w-4 h-4 text-blue-700" />
                      <span>Timed Exam Mode</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Standard CBT countdown timer; review all solutions at final submission.
                    </p>
                  </button>
                </div>
              </div>

              {/* Question Count */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  4. Number of Questions
                </label>
                <div className="flex items-center gap-2">
                  {[5, 10, 15, 20].map(count => (
                    <button
                      key={count}
                      onClick={() => setQuestionCount(count)}
                      className={`px-4 py-2 rounded-lg text-xs font-mono font-bold border transition-all ${
                        questionCount === count
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {count} Questions
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Selected: <strong className="text-slate-900">{selectedSubject}</strong> ·{' '}
              <strong className="text-slate-900">{selectedTopic}</strong> ·{' '}
              <span className="capitalize font-semibold text-blue-900">{quizMode} Mode</span>
            </div>

            <button
              onClick={handleStartQuiz}
              className="px-6 py-3 bg-blue-900 hover:bg-blue-950 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Launch Practice Test</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Quiz View */}
      {quizActive && !quizFinished && currentQ && (
        <div className="space-y-6">
          {/* Top Bar Navigation */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase text-blue-900 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                {currentQ.subject}
              </span>
              <span className="text-xs text-slate-500 font-semibold">{currentQ.topic}</span>
            </div>

            <div className="flex items-center gap-4">
              {quizMode === 'exam' && (
                <div className="flex items-center gap-1.5 font-mono font-bold text-xs px-3 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Time: {formatTimer(secondsRemaining)}</span>
                </div>
              )}
              <div className="text-xs font-mono font-bold text-slate-700">
                Question {currentIndex + 1} of {quizQuestions.length}
              </div>
              <button
                onClick={() => setQuizActive(false)}
                className="text-xs text-slate-500 hover:text-slate-900 font-semibold underline cursor-pointer"
              >
                Quit Practice
              </button>
            </div>
          </div>

          {/* Question Breadcrumb / Number Pills */}
          <div className="flex flex-wrap gap-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            {quizQuestions.map((q, idx) => {
              const answered = !!answers[q.id];
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-8 h-8 rounded-lg text-xs font-mono font-bold transition-all ${
                    isCurrent
                      ? 'bg-blue-900 text-white ring-2 ring-blue-900/30'
                      : answered
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Question Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Question Prompt
              </div>
              <p className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
                {currentQ.text}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {(['A', 'B', 'C', 'D'] as const).map(optKey => {
                const optText = currentQ[`option${optKey}` as keyof PracticeQuestion] as string;
                const isSelected = answers[currentQ.id] === optKey;
                const isRevealed = revealedTutorQuestions[currentQ.id];
                const isCorrect = currentQ.correctOption === optKey;

                let btnStyle = 'border-slate-200 hover:border-slate-300 bg-white text-slate-800';
                if (isRevealed) {
                  if (isCorrect) {
                    btnStyle = 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold';
                  } else if (isSelected) {
                    btnStyle = 'border-rose-500 bg-rose-50 text-rose-950';
                  }
                } else if (isSelected) {
                  btnStyle = 'border-blue-900 bg-blue-50/70 text-blue-950 font-bold ring-2 ring-blue-900/20';
                }

                return (
                  <button
                    key={optKey}
                    onClick={() => handleSelectOption(currentQ.id, optKey)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${btnStyle}`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        isRevealed && isCorrect
                          ? 'bg-emerald-600 text-white'
                          : isRevealed && isSelected
                          ? 'bg-rose-600 text-white'
                          : isSelected
                          ? 'bg-blue-900 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {optKey}
                    </span>
                    <span className="text-sm pt-0.5">{optText}</span>
                  </button>
                );
              })}
            </div>

            {/* Tutor Explanation Card (shows immediately in tutor mode once answered) */}
            {revealedTutorQuestions[currentQ.id] && (
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2">
                  {answers[currentQ.id] === currentQ.correctOption ? (
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Correct Answer! Great work.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                      <XCircle className="w-4 h-4" />
                      <span>Incorrect. Review the correct reasoning below.</span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-700 leading-relaxed font-sans">
                  <strong className="text-slate-900 block mb-1">Academic Rationale & Solution:</strong>
                  {currentQ.explanation}
                </div>
              </div>
            )}

            {/* Footer Navigation Buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => prev - 1)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              {currentIndex < quizQuestions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                  className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => setQuizFinished(true)}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Submit Practice Quiz</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quiz Finished / Score Review Screen */}
      {quizFinished && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-8">
          <div className="text-center max-w-lg mx-auto space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-blue-900 text-white flex items-center justify-center mx-auto shadow-inner">
              <Award className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Practice Test Completed</h2>
            <p className="text-xs text-slate-500">
              Here is your performance breakdown for {selectedSubject} ({selectedTopic}).
            </p>

            {/* Score Metric Card */}
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-around">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Score</span>
                <span className="text-3xl font-black font-mono text-blue-900">
                  {scoreStats.correct} / {scoreStats.total}
                </span>
              </div>
              <div className="h-10 w-[1px] bg-slate-200" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Accuracy</span>
                <span className={`text-3xl font-black font-mono ${
                  scoreStats.percentage >= 70 ? 'text-emerald-700' : scoreStats.percentage >= 50 ? 'text-blue-900' : 'text-amber-700'
                }`}>
                  {scoreStats.percentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Question Review List */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Comprehensive Answer Key & Solutions
            </h3>

            <div className="space-y-4">
              {quizQuestions.map((q, idx) => {
                const userAns = answers[q.id];
                const isCorrect = userAns === q.correctOption;

                return (
                  <div
                    key={q.id}
                    className={`p-5 rounded-xl border ${
                      isCorrect ? 'border-emerald-200 bg-emerald-50/20' : 'border-rose-200 bg-rose-50/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          #{idx + 1}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">{q.topic}</span>
                      </div>
                      {isCorrect ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded">
                          <XCircle className="w-3.5 h-3.5" /> Missed
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-900 mb-3">{q.text}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                      <div>
                        Your Selection: <strong className={isCorrect ? 'text-emerald-700' : 'text-rose-700'}>
                          Option {userAns || 'None'} ({userAns ? q[`option${userAns}` as keyof PracticeQuestion] : 'Unanswered'})
                        </strong>
                      </div>
                      <div>
                        Correct Option: <strong className="text-emerald-800">
                          Option {q.correctOption} ({q[`option${q.correctOption}` as keyof PracticeQuestion]})
                        </strong>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-600">
                      <strong className="text-slate-900 block mb-0.5">Explanation:</strong>
                      {q.explanation}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => {
                setQuizFinished(false);
                setQuizActive(false);
              }}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <span>Back to Practice Hub</span>
            </button>

            <button
              onClick={handleStartQuiz}
              className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Practice Test</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
