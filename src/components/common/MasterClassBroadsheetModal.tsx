import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Trophy,
  Download,
  Printer,
  RefreshCw,
  CheckCircle2,
  FileSpreadsheet,
  Search,
  Sparkles,
  Users,
  AlertCircle
} from 'lucide-react';
import {
  Student,
  Subject,
  StudentAssessmentRecord,
  StudentTermReportData,
  SchoolSettings,
  calculateGradePoint,
  formatOrdinalSuffix
} from '../../types/cbt';
import {
  fetchClassAllAssessmentRecords,
  fetchClassTermReports,
  saveAssessmentBatch,
  saveTermReportsBatch,
  fetchStudentTermReport
} from '../../services/firebase';

interface MasterClassBroadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  classGrade: string;
  academicSession: string;
  term: '1st Term' | '2nd Term' | '3rd Term';
  students: Student[];
  subjects: Subject[];
  settings?: SchoolSettings;
  onSyncedNotice?: (text: string, type?: 'success' | 'error') => void;
}

interface StudentMatrixRow {
  student: Student;
  scoresBySubjectKey: Record<string, StudentAssessmentRecord>;
  totalScoreSum: number;
  subjectsCount: number;
  averagePct: number;
  gpa: number;
  rank: number;
  positionLabel: string;
}

const normSubj = (s?: string) => (s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const hasScoreData = (r: StudentAssessmentRecord) =>
  Boolean(r.explicitlySaved) ||
  Boolean(r.isAutoSynced) ||
  (Array.isArray(r.examEntries) && r.examEntries.length > 0) ||
  (r.totalScore || 0) > 0 ||
  (r.assignmentScore || 0) > 0 ||
  (r.examScore || 0) > 0 ||
  (r.firstCaScore || r.testScore || 0) > 0 ||
  (r.secondCaScore || r.projectScore || 0) > 0;

export const MasterClassBroadsheetModal: React.FC<MasterClassBroadsheetModalProps> = ({
  isOpen,
  onClose,
  classGrade,
  academicSession,
  term,
  students,
  subjects,
  settings,
  onSyncedNotice
}) => {
  const [loading, setLoading] = useState(false);
  const [syncingReports, setSyncingReports] = useState(false);
  const [records, setRecords] = useState<StudentAssessmentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusBanner, setStatusBanner] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadMatrixData = async () => {
    if (!classGrade) return;
    setLoading(true);
    try {
      const data = await fetchClassAllAssessmentRecords(classGrade, academicSession, term);
      setRecords(data || []);
    } catch (err) {
      console.warn('Master broadsheet fetch error:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMatrixData();
    }
  }, [isOpen, classGrade, academicSession, term]);

  // Build unique subject columns ordered by curriculum subjects first, then any extra scored subjects
  const subjectColumns = useMemo(() => {
    const colMap = new Map<string, { key: string; name: string; code: string }>();

    subjects.forEach(s => {
      const k = normSubj(s.name);
      if (k && !colMap.has(k)) {
        colMap.set(k, { key: k, name: s.name, code: s.code || s.name.slice(0, 4).toUpperCase() });
      }
    });

    records.forEach(r => {
      if (!hasScoreData(r)) return;
      const k = normSubj(r.subjectName);
      if (k && !colMap.has(k)) {
        colMap.set(k, { key: k, name: r.subjectName, code: r.subjectName.slice(0, 4).toUpperCase() });
      }
    });

    // Only keep subjects that at least one student has scored OR keep all up to 14 if none yet
    const scoredKeys = new Set<string>();
    records.forEach(r => {
      if (hasScoreData(r)) {
        const k = normSubj(r.subjectName);
        if (k) scoredKeys.add(k);
      }
    });

    const cols = Array.from(colMap.values());
    const scoredCols = cols.filter(c => scoredKeys.has(c.key));
    return scoredCols.length > 0 ? scoredCols : cols;
  }, [subjects, records]);

  // Students belonging to class + any roster-less scored records
  const classStudents = useMemo(() => {
    const normClass = (c?: string) => (c || '').trim().toUpperCase().replace(/\s+/g, '');
    const targetCls = normClass(classGrade);
    const byId = new Map<string, Student>();

    students
      .filter(s => normClass(s.classGrade) === targetCls)
      .forEach(s => byId.set(s.id, s));

    records.forEach(r => {
      if (r.studentId && !byId.has(r.studentId)) {
        const matched = students.find(
          s =>
            s.id === r.studentId ||
            (s.admissionNumber &&
              r.admissionNumber &&
              s.admissionNumber.toUpperCase() === r.admissionNumber.toUpperCase())
        );
        if (matched) {
          byId.set(matched.id, matched);
        }
      }
    });

    return Array.from(byId.values()).sort((a, b) =>
      (a.fullName || '').localeCompare(b.fullName || '')
    );
  }, [students, records, classGrade]);

  // Compute student rows, averages, GPA, and competition ranking (1st, 2nd, 2nd, 4th)
  const { rankedRows, subjectAverages, overallClassAverage } = useMemo(() => {
    const baseRows: Omit<StudentMatrixRow, 'rank' | 'positionLabel'>[] = classStudents.map(stu => {
      const admUpper = (stu.admissionNumber || '').trim().toUpperCase();
      const scoresBySubjectKey: Record<string, StudentAssessmentRecord> = {};

      records.forEach(rec => {
        if (!hasScoreData(rec)) return;
        const matchesId = rec.studentId === stu.id;
        const matchesAdm = Boolean(admUpper && rec.admissionNumber?.trim().toUpperCase() === admUpper);
        if (!matchesId && !matchesAdm) return;

        const sk = normSubj(rec.subjectName);
        if (!sk) return;
        const prev = scoresBySubjectKey[sk];
        if (!prev || new Date(rec.updatedAt || 0).getTime() >= new Date(prev.updatedAt || 0).getTime()) {
          scoresBySubjectKey[sk] = rec;
        }
      });

      const subjRecs = Object.values(scoresBySubjectKey);
      const totalScoreSum = subjRecs.reduce((sum, r) => sum + (Number(r.totalScore) || 0), 0);
      const subjectsCount = subjRecs.length;
      const averagePct = subjectsCount > 0 ? Number((totalScoreSum / subjectsCount).toFixed(1)) : 0;
      const gpa =
        subjectsCount > 0
          ? Number(
              (
                subjRecs.reduce((sum, r) => sum + calculateGradePoint(Number(r.totalScore) || 0), 0) /
                subjectsCount
              ).toFixed(2)
            )
          : 0;

      return {
        student: stu,
        scoresBySubjectKey,
        totalScoreSum,
        subjectsCount,
        averagePct,
        gpa
      };
    });

    // Sort by averagePct desc, then totalScoreSum desc for ranking
    const sortedForRank = [...baseRows].sort((a, b) => {
      if (b.averagePct !== a.averagePct) return b.averagePct - a.averagePct;
      return b.totalScoreSum - a.totalScoreSum;
    });

    const rankByStudentId = new Map<string, { rank: number; label: string }>();
    let currentRank = 0;
    let prevAvg = -1;
    let prevSum = -1;

    sortedForRank.forEach((row, idx) => {
      if (row.subjectsCount === 0) {
        rankByStudentId.set(row.student.id, { rank: 9999, label: '—' });
        return;
      }
      if (row.averagePct !== prevAvg || row.totalScoreSum !== prevSum) {
        currentRank = idx + 1;
        prevAvg = row.averagePct;
        prevSum = row.totalScoreSum;
      }
      rankByStudentId.set(row.student.id, {
        rank: currentRank,
        label: formatOrdinalSuffix(currentRank)
      });
    });

    const ranked: StudentMatrixRow[] = sortedForRank.map(r => {
      const rankMeta = rankByStudentId.get(r.student.id) || { rank: 9999, label: '—' };
      return {
        ...r,
        rank: rankMeta.rank,
        positionLabel: rankMeta.label
      };
    });

    // Subject Class Averages
    const subjAvgMap: Record<string, number> = {};
    subjectColumns.forEach(col => {
      const vals = ranked
        .map(row => row.scoresBySubjectKey[col.key]?.totalScore)
        .filter((v): v is number => typeof v === 'number');
      subjAvgMap[col.key] =
        vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : 0;
    });

    const activeStudentAvgs = ranked.filter(r => r.subjectsCount > 0).map(r => r.averagePct);
    const overallAvg =
      activeStudentAvgs.length > 0
        ? Number((activeStudentAvgs.reduce((a, b) => a + b, 0) / activeStudentAvgs.length).toFixed(1))
        : 0;

    return {
      rankedRows: ranked,
      subjectAverages: subjAvgMap,
      overallClassAverage: overallAvg
    };
  }, [classStudents, records, subjectColumns]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rankedRows;
    return rankedRows.filter(
      r =>
        r.student.fullName.toLowerCase().includes(q) ||
        r.student.admissionNumber.toLowerCase().includes(q)
    );
  }, [rankedRows, searchQuery]);

  // Sync calculated Subject Class Averages & Student Overall Positions + Class Average to Official Report Sheets
  const handleSyncToOfficialReports = async () => {
    setSyncingReports(true);
    setStatusBanner(null);
    try {
      // 1. Update classAverage on every scored CA record in this class/term/session
      const updatedCaRecords: StudentAssessmentRecord[] = [];
      rankedRows.forEach(row => {
        Object.entries(row.scoresBySubjectKey).forEach(([sk, rec]) => {
          const avg = subjectAverages[sk] ?? rec.classAverage ?? 0;
          updatedCaRecords.push({
            ...rec,
            classAverage: avg,
            updatedAt: new Date().toISOString()
          });
        });
      });

      if (updatedCaRecords.length > 0) {
        await saveAssessmentBatch(updatedCaRecords);
      }

      // 2. Fetch existing termReports and batch-save noInClass, classAverage, overallPosition
      const existingReports = await fetchClassTermReports(classGrade, academicSession, term);
      const existingMap = new Map<string, StudentTermReportData>();
      existingReports.forEach(r => existingMap.set(r.studentId, r));

      const reportsToSave: StudentTermReportData[] = [];
      for (const row of rankedRows) {
        const base =
          existingMap.get(row.student.id) ||
          (await fetchStudentTermReport(row.student.id, academicSession, term, row.student));

        reportsToSave.push({
          ...base,
          studentId: row.student.id,
          studentName: row.student.fullName,
          admissionNumber: row.student.admissionNumber,
          classGrade,
          academicSession,
          term,
          noInClass: String(rankedRows.length),
          classAverage: `${overallClassAverage}%`,
          overallPosition: row.positionLabel,
          updatedAt: new Date().toISOString()
        });
      }

      const res = await saveTermReportsBatch(reportsToSave);
      const msg = res.syncedToCloud
        ? `Synced ${updatedCaRecords.length} subject class averages & ${reportsToSave.length} student positions/averages to Official Reports!`
        : `Saved locally (${reportsToSave.length} reports). Cloud sync will finish automatically when online.`;
      setStatusBanner({ text: msg, type: 'success' });
      onSyncedNotice?.(msg, 'success');
    } catch (err) {
      console.error('Failed syncing master averages:', err);
      const errMsg = 'Could not sync master averages to reports. Please retry.';
      setStatusBanner({ text: errMsg, type: 'error' });
      onSyncedNotice?.(errMsg, 'error');
    } finally {
      setSyncingReports(false);
    }
  };

  const handleExportMasterCsv = () => {
    const headers = [
      'Rank',
      'Admission Number',
      'Student Name',
      ...subjectColumns.map(c => `"${c.name}"`),
      'Subjects Taken',
      'Grand Total',
      'Average (%)',
      'GPA'
    ];

    const csvRows = rankedRows.map(row => [
      `"${row.positionLabel}"`,
      `"${row.student.admissionNumber}"`,
      `"${row.student.fullName}"`,
      ...subjectColumns.map(c => row.scoresBySubjectKey[c.key]?.totalScore ?? ''),
      row.subjectsCount,
      row.totalScoreSum,
      row.averagePct,
      row.gpa.toFixed(2)
    ].join(','));

    const summaryRow = [
      '"CLASS AVG"',
      '""',
      `"${rankedRows.length} Candidates"`,
      ...subjectColumns.map(c => subjectAverages[c.key] ?? 0),
      '',
      '',
      overallClassAverage,
      ''
    ].join(',');

    const csv = [headers.join(','), ...csvRows, summaryRow].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `master_class_broadsheet_${classGrade.replace(/\s+/g, '_')}_${term.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-7xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base tracking-tight">
                Master Class Broadsheet Matrix · {classGrade}
              </h3>
              <p className="text-[11px] text-slate-300">
                {settings?.schoolName || "Honey's World High School"} · {academicSession} · {term} · All Subjects & Rankings
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadMatrixData}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportMasterCsv}
              disabled={rankedRows.length === 0}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-blue-300" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleSyncToOfficialReports}
              disabled={syncingReports || rankedRows.length === 0}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${syncingReports ? 'animate-spin' : ''}`} />
              <span>{syncingReports ? 'Syncing...' : 'Sync Ranks & Averages to Reports'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metrics & Search Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-700" />
              <span>Students: {rankedRows.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Subjects: {subjectColumns.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 font-black text-blue-950">
              Overall Class Average: {overallClassAverage}%
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter student..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {statusBanner && (
          <div
            className={`mx-6 mt-3 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 shrink-0 ${
              statusBanner.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            {statusBanner.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
        )}

        {/* Scrollable Matrix Table */}
        <div className="p-4 sm:p-6 overflow-auto flex-1">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500">
              Compiling all subjects & computing class positions...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No students or broadsheet records found for {classGrade} ({academicSession} · {term}).
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-900 text-white text-[10px] uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3 text-center">Pos</th>
                    <th className="py-3 px-3 min-w-[180px]">Student Name</th>
                    {subjectColumns.map(col => (
                      <th
                        key={col.key}
                        className="py-3 px-2.5 text-center border-l border-slate-700 min-w-[68px]"
                        title={col.name}
                      >
                        <div className="truncate max-w-[85px] mx-auto">{col.code}</div>
                        <div className="text-[9px] text-slate-400 font-normal truncate max-w-[85px]">
                          {col.name}
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-3 text-center border-l border-slate-700 bg-slate-800">Subj</th>
                    <th className="py-3 px-3 text-center border-l border-slate-700 bg-slate-800">Total</th>
                    <th className="py-3 px-3 text-center border-l border-slate-700 bg-blue-950">Avg %</th>
                    <th className="py-3 px-3 text-center border-l border-slate-700 bg-blue-950">GPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map(row => {
                    const isTopThree = row.rank >= 1 && row.rank <= 3;
                    return (
                      <tr key={row.student.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-2.5 px-3 text-center font-black">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono ${
                              row.rank === 1
                                ? 'bg-amber-400 text-slate-950'
                                : isTopThree
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {row.positionLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{row.student.fullName}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {row.student.admissionNumber}
                          </div>
                        </td>
                        {subjectColumns.map(col => {
                          const rec = row.scoresBySubjectKey[col.key];
                          const val = rec?.totalScore;
                          const isFail = typeof val === 'number' && val < 40;
                          return (
                            <td
                              key={col.key}
                              className={`py-2.5 px-2 text-center font-mono border-l border-slate-100 ${
                                val === undefined
                                  ? 'text-slate-300'
                                  : isFail
                                  ? 'text-rose-700 font-bold bg-rose-50/40'
                                  : 'text-slate-800 font-semibold'
                              }`}
                            >
                              {val !== undefined ? (
                                <div>
                                  <div>{val}</div>
                                  <div className="text-[9px] text-slate-400 font-sans">{rec.grade}</div>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 border-l border-slate-200 bg-slate-50/60">
                          {row.subjectsCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 border-l border-slate-200 bg-slate-50/60">
                          {row.totalScoreSum}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-blue-950 border-l border-slate-200 bg-blue-50/40">
                          {row.averagePct}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-800 border-l border-slate-200 bg-blue-50/40">
                          {row.gpa.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                  <tr>
                    <td colSpan={2} className="py-3 px-3 text-xs uppercase tracking-wider">
                      Subject Class Averages
                    </td>
                    {subjectColumns.map(col => (
                      <td key={col.key} className="py-3 px-2 text-center font-mono text-blue-950 border-l border-slate-200">
                        {subjectAverages[col.key] ? `${subjectAverages[col.key]}%` : '—'}
                      </td>
                    ))}
                    <td colSpan={2} className="py-3 px-3 text-right text-[11px] uppercase border-l border-slate-300">
                      Class Avg:
                    </td>
                    <td colSpan={2} className="py-3 px-3 text-center font-mono font-black text-blue-950 text-sm bg-amber-100 border-l border-slate-300">
                      {overallClassAverage}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
