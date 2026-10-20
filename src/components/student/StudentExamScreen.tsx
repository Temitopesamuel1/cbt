import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  Send,
  RotateCcw,
  Wifi,
  WifiOff
} from 'lucide-react';
import {
  Examination,
  Question,
  Student,
  Submission,
  QuestionResultDetail,
  ExamAttempt,
  generateTopicRevisionInsights
} from '../../types/cbt';
import {
  createExamAttempt,
  getExamAttempt,
  updateExamAttemptProgress,
  saveSubmission
} from '../../services/firebase';

interface StudentExamScreenProps {
  student: Student;
  exam: Examination;
  questions: Question[];
  onCompleteExam: (submission: Submission) => void;
}

export const StudentExamScreen: React.FC<StudentExamScreenProps> = ({
  student,
  exam,
  questions,
  onCompleteExam
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  
  // Timer state
  const [secondsRemaining, setSecondsRemaining] = useState<number>((exam.durationMinutes || 15) * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const attemptId = `attempt_${student.id}_${exam.id}`;
  const timerIntervalRef = useRef<number | null>(null);
  const hasSubmittedRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(Date.now());

  // Attempt initialization & disconnection recovery
  useEffect(() => {
    const initOrRestoreAttempt = async () => {
      try {
        const existingAttempt = await getExamAttempt(attemptId);
        const now = Date.now();

        if (existingAttempt && existingAttempt.status === 'in_progress') {
          // Restore saved answers and flags
          if (existingAttempt.savedAnswers) {
            setAnswers(existingAttempt.savedAnswers);
          }
          if (existingAttempt.flaggedQuestions) {
            setFlagged(existingAttempt.flaggedQuestions);
          }

          // Compute remaining time from recorded deadline
          const deadline = new Date(existingAttempt.endTime).getTime();
          const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
          setSecondsRemaining(remaining);
          startTimeRef.current = new Date(existingAttempt.startTime).getTime();
        } else {
          // Brand new attempt
          const durationMs = (exam.durationMinutes || 15) * 60 * 1000;
          const startIso = new Date(now).toISOString();
          const endIso = new Date(now + durationMs).toISOString();

          const newAttempt: ExamAttempt = {
            id: attemptId,
            examId: exam.id,
            studentId: student.id,
            studentAdmissionNumber: student.admissionNumber,
            studentName: student.fullName,
            startTime: startIso,
            endTime: endIso,
            status: 'in_progress',
            savedAnswers: {},
            lastHeartbeatAt: startIso
          };

          await createExamAttempt(newAttempt);
          setSecondsRemaining((exam.durationMinutes || 15) * 60);
          startTimeRef.current = now;
        }
      } catch (err) {
        console.warn('Attempt initialization fallback:', err);
      }
    };

    initOrRestoreAttempt();

    const handleOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, [attemptId, exam, student]);

  // Final submission handler
  const handleFinalSubmit = useCallback(async (isAutoSubmit = false) => {
    if (hasSubmittedRef.current || isSubmitting) return;
    hasSubmittedRef.current = true;
    setIsSubmitting(true);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    const elapsedSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));

    // Calculate score
    let score = 0;
    const detailedResults: QuestionResultDetail[] = questions.map(q => {
      const studentAns = answers[q.id];
      const isCorrect = studentAns === q.correctOption;
      if (isCorrect) score += 1;

      return {
        questionNumber: q.questionNumber,
        questionText: q.text,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        studentAnswer: studentAns,
        correctAnswer: q.correctOption,
        isCorrect,
        topic: q.topic || 'General Concepts',
        explanation: q.explanation
      };
    });

    const totalQuestions = questions.length;
    const percentage = Math.round((score / Math.max(1, totalQuestions)) * 100);

    // Generate topic diagnostics and revision recommendations
    const { topicAnalysis, recommendations } = generateTopicRevisionInsights(detailedResults);

    const submissionData: Submission = {
      attemptId,
      examId: exam.id,
      examTitle: exam.title,
      subject: exam.subjectName,
      classGrade: exam.classGrade,
      academicSession: exam.academicSession,
      term: exam.term,
      studentId: student.id,
      studentName: student.fullName,
      admissionNumber: student.admissionNumber,
      score,
      totalQuestions,
      percentage,
      timeSpentSeconds: elapsedSeconds,
      answers,
      submittedAt: new Date().toISOString(),
      detailedResults,
      topicAnalysis,
      aiRevisionRecommendations: recommendations
    };

    try {
      const docId = await saveSubmission(submissionData);
      submissionData.id = docId;
      localStorage.removeItem(`prime_cbt_attempt_${attemptId}`);
    } catch (err) {
      console.warn('Submission persistence notice:', err);
    }

    onCompleteExam(submissionData);
  }, [isSubmitting, answers, questions, exam, student, attemptId, onCompleteExam]);

  // Countdown timer effect
  useEffect(() => {
    timerIntervalRef.current = window.setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          handleFinalSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [handleFinalSubmit]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (['input', 'textarea'].includes(tag)) return;

      const key = e.key.toUpperCase();
      const currentQ = questions[currentIndex];

      if (['A', 'B', 'C', 'D'].includes(key) && currentQ) {
        handleSelectOption(currentQ.id, key as 'A' | 'B' | 'C' | 'D');
      } else if ((key === 'P' || key === 'ARROWLEFT') && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      } else if ((key === 'N' || key === 'ARROWRIGHT') && currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (key === 'R' && currentQ) {
        toggleFlag(currentQ.id);
      } else if (key === 'S' && !showConfirmModal) {
        setShowConfirmModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, questions, answers, flagged, showConfirmModal]);

  const handleSelectOption = (qId: string, opt: 'A' | 'B' | 'C' | 'D') => {
    const nextAnswers = { ...answers, [qId]: opt };
    setAnswers(nextAnswers);
    updateExamAttemptProgress(attemptId, nextAnswers, flagged);
  };

  const handleClearAnswer = (qId: string) => {
    const nextAnswers = { ...answers };
    delete nextAnswers[qId];
    setAnswers(nextAnswers);
    updateExamAttemptProgress(attemptId, nextAnswers, flagged);
  };

  const toggleFlag = (qId: string) => {
    const nextFlagged = { ...flagged, [qId]: !flagged[qId] };
    setFlagged(nextFlagged);
    updateExamAttemptProgress(attemptId, answers, nextFlagged);
  };

  const currentQ = questions[currentIndex] || questions[0];
  const qId = currentQ?.id || `q-${currentIndex}`;

  // Timer format
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const isUrgent = secondsRemaining < 180;
  const isCritical = secondsRemaining < 60;

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none">
      {/* Top Examination Banner */}
      <div className="bg-slate-900 text-white border-b-2 border-slate-800 px-4 sm:px-6 py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Candidate Profile Details */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-10 h-10 rounded-lg bg-blue-700 border border-blue-600 flex items-center justify-center font-bold text-sm text-white shrink-0">
              {student.firstName.charAt(0)}{student.surname.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{student.fullName}</span>
                <span className="text-[11px] font-mono text-slate-400">({student.admissionNumber})</span>
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                <span className="font-semibold text-amber-300">{exam.subjectName}</span>
                <span>·</span>
                <span>Class: {exam.classGrade}</span>
                <span>·</span>
                <span>{exam.academicSession}</span>
              </div>
            </div>
          </div>

          {/* Center: Countdown Timer */}
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border font-mono font-bold text-lg tracking-wider ${
                isCritical
                  ? 'bg-rose-950 text-rose-200 border-rose-500 animate-pulse'
                  : isUrgent
                  ? 'bg-amber-950 text-amber-200 border-amber-500'
                  : 'bg-slate-950 text-white border-slate-700'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>{timeFormatted}</span>
            </div>

            {/* Network Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400" title={isOnline ? 'Connected' : 'Offline - local answers cached'}>
              {isOnline ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-400" />
              )}
            </div>

            {/* Font Zoom */}
            <div className="hidden sm:flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFontSize('normal')}
                className={`px-2 py-1 rounded ${fontSize === 'normal' ? 'bg-blue-700 text-white font-bold' : 'text-slate-400'}`}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSize('large')}
                className={`px-2 py-1 rounded ${fontSize === 'large' ? 'bg-blue-700 text-white font-bold' : 'text-slate-400'}`}
              >
                A+
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit (S)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main CBT Question Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
        {/* Left: Active Question (8 cols) */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Question Subheader */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-blue-900 bg-blue-100/70 border border-blue-200 px-2.5 py-1 rounded">
                QUESTION {currentIndex + 1} OF {questions.length}
              </span>
              {currentQ?.topic && (
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                  Topic: <strong>{currentQ.topic}</strong>
                </span>
              )}
              {flagged[qId] && (
                <span className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded flex items-center gap-1">
                  <Flag className="w-3 h-3 fill-amber-500 text-amber-600" />
                  <span>Flagged</span>
                </span>
              )}
            </div>

            <div className="text-xs text-slate-500">
              {answers[qId] ? (
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Choice: Option {answers[qId]}
                </span>
              ) : (
                <span className="text-slate-400">Unanswered</span>
              )}
            </div>
          </div>

          {/* Question Body */}
          <div className="p-6 sm:p-8 flex-1">
            <div className={`text-slate-900 font-medium leading-relaxed mb-8 ${fontSize === 'large' ? 'text-lg' : 'text-base'}`}>
              {currentQ ? currentQ.text : 'Loading question...'}
            </div>

            {/* Options A - D */}
            <div className="space-y-3">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                const optKey = `option${opt}` as keyof Question;
                const text = currentQ ? (currentQ[optKey] as string) : '';
                const isSelected = answers[qId] === opt;

                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelectOption(qId, opt)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-4 group ${
                      isSelected
                        ? 'border-blue-900 bg-blue-50/70 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50/50'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                        isSelected
                          ? 'border-blue-900 bg-blue-900 text-white'
                          : 'border-slate-300 bg-slate-50 text-slate-700 group-hover:border-blue-500 group-hover:text-blue-900'
                      }`}
                    >
                      {opt}
                    </div>
                    <div className={`pt-1 text-slate-800 ${fontSize === 'large' ? 'text-base' : 'text-sm'} ${isSelected ? 'font-bold text-blue-950' : ''}`}>
                      {text}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Controls Bar */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous (P)</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                disabled={currentIndex === questions.length - 1}
                className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <span>Next (N)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {answers[qId] && (
                <button
                  type="button"
                  onClick={() => handleClearAnswer(qId)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Choice</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleFlag(qId)}
                className={`px-3 py-2 text-xs font-semibold border rounded-lg transition-colors flex items-center gap-1.5 ${
                  flagged[qId]
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Flag className={`w-3.5 h-3.5 ${flagged[qId] ? 'fill-amber-500 text-amber-700' : 'text-slate-500'}`} />
                <span>{flagged[qId] ? 'Unflag (R)' : 'Flag Review (R)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Question Navigation Matrix (4 cols) */}
        <div className="lg:w-80 flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Question Navigator
            </h3>

            <div className="grid grid-cols-5 gap-2 mb-4">
              {questions.map((q, idx) => {
                const isAnswered = Boolean(answers[q.id]);
                const isCurrent = idx === currentIndex;
                const isFlagged = Boolean(flagged[q.id]);

                let style = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
                if (isCurrent) {
                  style = 'ring-2 ring-blue-900 ring-offset-2 ' + (isAnswered ? 'bg-blue-900 text-white font-bold' : 'bg-blue-100 text-blue-900 font-bold');
                } else if (isAnswered) {
                  style = 'bg-blue-900 text-white font-semibold';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`relative h-10 rounded-lg text-xs font-mono border flex items-center justify-center transition-all ${style}`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border border-white flex items-center justify-center">
                        <Flag className="w-2 h-2 fill-slate-900 text-slate-900" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded bg-blue-900 border border-blue-950"></div>
                  <span>Answered</span>
                </div>
                <span className="font-mono font-bold text-blue-900">{answeredCount}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300"></div>
                  <span>Unanswered</span>
                </div>
                <span className="font-mono font-bold text-slate-600">{unansweredCount}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500"></div>
                  <span>Flagged for Review</span>
                </div>
                <span className="font-mono font-bold text-amber-700">{flaggedCount}</span>
              </div>
            </div>
          </div>

          {/* Persistent Save Indicator */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-bold text-slate-900 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Continuous Progress Protection</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Every choice is automatically saved. If your device restarts or network flickers, re-opening will restore your paper seamlessly.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Conclude & Submit Paper</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Submit Examination</span>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <p className="text-xs text-slate-700 mb-4">
                Are you ready to conclude and submit your <strong>{exam.title}</strong> paper?
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Total Questions:</span>
                  <span className="font-bold text-slate-900">{questions.length}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Answered:</span>
                  <span className="font-bold text-emerald-700">{answeredCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Unanswered:</span>
                  <span className={`font-bold ${unansweredCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {unansweredCount}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Remaining Time:</span>
                  <span className="font-bold text-blue-900 font-mono">{timeFormatted}</span>
                </div>
              </div>

              {unansweredCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 mb-6 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    You have <strong>{unansweredCount}</strong> unanswered questions. Once submitted, answers cannot be edited.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Return to Questions
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setShowConfirmModal(false);
                    handleFinalSubmit(false);
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{isSubmitting ? 'Evaluating...' : 'Confirm Submission'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
