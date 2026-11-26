import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  WifiOff,
  Search,
  Filter,
  PlusCircle,
  Send,
  RotateCcw,
  ShieldAlert,
  Users
} from 'lucide-react';
import {
  ExamAttempt,
  Examination,
  Student
} from '../../types/cbt';
import {
  subscribeExamAttempts,
  extendExamAttemptTime,
  forceSubmitExamAttempt,
  restartStudentExamTimer
} from '../../services/firebase';

interface LiveExamMonitorViewProps {
  exams: Examination[];
  students?: Student[];
  showNotification?: (text: string, type?: 'success' | 'error') => void;
}

export const LiveExamMonitorView: React.FC<LiveExamMonitorViewProps> = ({
  exams,
  students = [],
  showNotification
}) => {
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'flagged' | 'submitted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());
  const [busyAttemptId, setBusyAttemptId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    const unsub = subscribeExamAttempts(live => {
      setAttempts(live || []);
    });
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      unsub();
      window.clearInterval(tick);
    };
  }, []);

  const examById = useMemo(() => {
    const map = new Map<string, Examination>();
    exams.forEach(e => map.set(e.id, e));
    return map;
  }, [exams]);

  const studentById = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach(s => map.set(s.id, s));
    return map;
  }, [students]);

  const authorizedExamIds = useMemo(() => new Set(exams.map(e => e.id)), [exams]);

  const enrichedAttempts = useMemo(() => {
    return attempts
      .filter(att => authorizedExamIds.size === 0 || authorizedExamIds.has(att.examId))
      .map(att => {
        const exam = examById.get(att.examId);
        const student = studentById.get(att.studentId);
        const totalQ = att.totalQuestions || exam?.totalQuestions || 0;
        const answeredCount = att.answeredCount ?? Object.keys(att.savedAnswers || {}).length;
        const progressPct = totalQ > 0 ? Math.min(100, Math.round((answeredCount / totalQ) * 100)) : 0;

        const endMs = att.endTime ? new Date(att.endTime).getTime() : 0;
        const remainingSec = att.status === 'in_progress' && endMs > 0
          ? Math.max(0, Math.floor((endMs - nowMs) / 1000))
          : 0;

        const heartbeatMs = att.lastHeartbeatAt ? new Date(att.lastHeartbeatAt).getTime() : 0;
        const staleSeconds = heartbeatMs > 0 ? Math.floor((nowMs - heartbeatMs) / 1000) : 999;
        const isStale = att.status === 'in_progress' && staleSeconds > 90;
        const violations = att.tabSwitchCount || 0;

        return {
          attempt: att,
          examTitle: att.examTitle || exam?.title || att.examId,
          subjectName: att.subjectName || exam?.subjectName || '',
          classGrade: att.classGrade || exam?.classGrade || student?.classGrade || '',
          studentName: att.studentName || student?.fullName || 'Candidate',
          admissionNumber: att.studentAdmissionNumber || student?.admissionNumber || '',
          totalQ,
          answeredCount,
          progressPct,
          remainingSec,
          staleSeconds,
          isStale,
          violations
        };
      });
  }, [attempts, authorizedExamIds, examById, studentById, nowMs]);

  const summary = useMemo(() => {
    const active = enrichedAttempts.filter(i => i.attempt.status === 'in_progress' && !i.isStale).length;
    const stale = enrichedAttempts.filter(i => i.isStale).length;
    const flagged = enrichedAttempts.filter(i => i.violations > 0).length;
    const submitted = enrichedAttempts.filter(i => i.attempt.status === 'submitted').length;
    return { active, stale, flagged, submitted };
  }, [enrichedAttempts]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedAttempts.filter(item => {
      if (selectedExamId !== 'All' && item.attempt.examId !== selectedExamId) return false;
      if (statusFilter === 'active' && item.attempt.status !== 'in_progress') return false;
      if (statusFilter === 'flagged' && item.violations === 0) return false;
      if (statusFilter === 'submitted' && item.attempt.status !== 'submitted') return false;
      if (
        q &&
        !item.studentName.toLowerCase().includes(q) &&
        !item.admissionNumber.toLowerCase().includes(q) &&
        !item.examTitle.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [enrichedAttempts, selectedExamId, statusFilter, searchQuery]);

  const handleExtendTime = async (attemptId: string, mins: number) => {
    setBusyAttemptId(attemptId);
    try {
      await extendExamAttemptTime(attemptId, mins);
      showNotification?.(`Extended candidate timer by +${mins} minutes.`);
    } catch {
      showNotification?.('Failed to extend timer.', 'error');
    } finally {
      setBusyAttemptId(null);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold uppercase tracking-wider mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Live Examination Hall Surveillance</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">Real-Time CBT Candidate Monitor</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Watch candidates answering live, spot tab-switch warnings, extend timers for disconnected students, or force-submit papers.
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-blue-800 uppercase">Active Online</div>
              <div className="text-2xl font-black text-blue-950 mt-0.5">{summary.active}</div>
            </div>
            <Activity className="w-7 h-7 text-blue-600" />
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-amber-800 uppercase">Stale / Idle</div>
              <div className="text-2xl font-black text-amber-950 mt-0.5">{summary.stale}</div>
            </div>
            <WifiOff className="w-7 h-7 text-amber-600" />
          </div>

          <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-rose-800 uppercase">Tab-Switch Flags</div>
              <div className="text-2xl font-black text-rose-950 mt-0.5">{summary.flagged}</div>
            </div>
            <ShieldAlert className="w-7 h-7 text-rose-600" />
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-emerald-800 uppercase">Submitted</div>
              <div className="text-2xl font-black text-emerald-950 mt-0.5">{summary.submitted}</div>
            </div>
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student name, admission #, or exam..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
            >
              <option value="All">All Examinations</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.title} ({e.classGrade})</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="active">In Progress Only</option>
              <option value="flagged">Tab-Switch Flagged</option>
              <option value="submitted">Submitted</option>
            </select>
          </div>
        </div>

        {/* Live Attempts Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Examination</th>
                <th className="py-3 px-4">Progress</th>
                <th className="py-3 px-4 text-center">Time Left</th>
                <th className="py-3 px-4 text-center">Proctoring</th>
                <th className="py-3 px-4 text-center">Session Status</th>
                <th className="py-3 px-4 text-right">Invigilator Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <div>No live examination attempts recorded yet.</div>
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const { attempt } = item;
                  const isBusy = busyAttemptId === attempt.id;
                  return (
                    <tr key={attempt.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.studentName}</div>
                        <div className="text-[10px] font-mono text-slate-500">{item.admissionNumber}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{item.examTitle}</div>
                        <div className="text-[10px] text-slate-500">
                          {item.subjectName} {item.classGrade ? `· ${item.classGrade}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 min-w-[140px]">
                        <div className="flex items-center justify-between text-[11px] font-mono font-bold mb-1">
                          <span>{item.answeredCount}{item.totalQ ? ` / ${item.totalQ}` : ''}</span>
                          <span className="text-blue-900">{item.progressPct}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-700 transition-all"
                            style={{ width: `${item.progressPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {attempt.status === 'in_progress' ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                            item.remainingSec < 120 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {formatTimer(item.remainingSec)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.violations > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-200 font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3" />
                            {item.violations} Tab Switch{item.violations > 1 ? 'es' : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-semibold">Clean</span>
                        )}
                        {attempt.lastWarning && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[160px]" title={attempt.lastWarning}>
                            {attempt.lastWarning}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {attempt.status === 'submitted' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px] uppercase">
                            Submitted
                          </span>
                        ) : attempt.status === 'retake_granted' ? (
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-bold text-[10px] uppercase">
                            Retake Open
                          </span>
                        ) : item.isStale ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] uppercase">
                            Idle ({item.staleSeconds}s)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px] uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            Writing
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleExtendTime(attempt.id, 5)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                            title="Add 5 extra minutes to this student's timer"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>+5m</span>
                          </button>

                          {attempt.status === 'in_progress' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                setConfirmAction({
                                  title: 'Force Submit Examination',
                                  message: `Force-submit ${item.studentName}'s active paper for "${item.examTitle}" now?`,
                                  confirmLabel: 'Force Submit',
                                  onConfirm: async () => {
                                    await forceSubmitExamAttempt(attempt.id);
                                    showNotification?.(`Force-submit signal sent to ${item.studentName}.`);
                                  }
                                })
                              }
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                              title="Force submit student's active session"
                            >
                              <Send className="w-3 h-3" />
                              <span>Force End</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              setConfirmAction({
                                title: 'Reset Candidate Timer & Unlock Retake',
                                message: `Grant a fresh sitting for ${item.studentName} on "${item.examTitle}"? Prior submitted slips remain saved.`,
                                confirmLabel: 'Unlock Retake',
                                onConfirm: async () => {
                                  await restartStudentExamTimer(attempt.studentId, attempt.examId);
                                  showNotification?.(`Retake timer unlocked for ${item.studentName}.`);
                                }
                              })
                            }
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                            title="Reset timer & unlock retake sitting"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retake</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center gap-2 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{confirmAction.title}</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">{confirmAction.message}</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await confirmAction.onConfirm();
                    setConfirmAction(null);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl cursor-pointer"
                >
                  {confirmAction.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
