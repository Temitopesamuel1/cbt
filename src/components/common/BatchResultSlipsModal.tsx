import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  CheckSquare,
  Square,
  Users,
  Download,
  Eye
} from 'lucide-react';
import { Student, Submission, SchoolSettings, Examination, SchoolClass } from '../../types/cbt';
import { HwsOfficialResultSlip } from './HwsOfficialResultSlip';
import { DEFAULT_SCHOOL_SETTINGS } from '../../data/initialSchoolData';

interface BatchResultSlipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  submissions?: Submission[];
  classes?: SchoolClass[];
  settings?: SchoolSettings;
  exams?: Examination[];
  initialClassFilter?: string;
  academicSession?: string;
  term?: '1st Term' | '2nd Term' | '3rd Term';
}

export const BatchResultSlipsModal: React.FC<BatchResultSlipsModalProps> = ({
  isOpen,
  onClose,
  students,
  classes = [],
  settings,
  initialClassFilter = 'All',
  academicSession = '2024/2025',
  term = '1st Term'
}) => {
  const [selectedClass, setSelectedClass] = useState<string>(initialClassFilter);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [printHost, setPrintHost] = useState<HTMLElement | null>(null);
  const batchPrintRef = useRef<HTMLDivElement>(null);

  const activeSettings = settings || DEFAULT_SCHOOL_SETTINGS;

  // Manage isolated print root for batch printing when not previewing an individual student
  useEffect(() => {
    if (!isOpen || previewStudent || typeof document === 'undefined') return;
    let host = document.getElementById('hws-print-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'hws-print-root';
      document.body.appendChild(host);
    }
    document.body.classList.add('hws-isolated-print');
    setPrintHost(host);
    return () => {
      document.body.classList.remove('hws-isolated-print');
    };
  }, [isOpen, previewStudent]);

  // Filter students by selected class
  const classStudents = useMemo(() => {
    if (selectedClass === 'All') return students;
    const cleanClass = selectedClass.trim().toLowerCase().replace(/[\s\-_]/g, '');
    return students.filter(s => {
      const stuClass = (s.classGrade || '').trim().toLowerCase().replace(/[\s\-_]/g, '');
      return stuClass === cleanClass || s.classGrade === selectedClass;
    });
  }, [students, selectedClass]);

  // Handle select all / deselect all
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.size === classStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(classStudents.map(s => s.id)));
    }
  };

  const handleToggleStudent = (studentId: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    setSelectedStudentIds(next);
  };

  // Selected students to print
  const printStudents = useMemo(() => {
    if (selectedStudentIds.size === 0) return classStudents;
    return classStudents.filter(s => selectedStudentIds.has(s.id));
  }, [classStudents, selectedStudentIds]);

  const handleBatchPrint = () => {
    window.print();
  };

  const handleBatchDownloadHtml = () => {
    if (!batchPrintRef.current) return;
    const htmlContent = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Batch Report Sheets - ${selectedClass} - ${academicSession} ${term}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  body { background: #ffffff; color: #000000; font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 12px; }
  .hws-page-1 { page-break-after: always; break-after: page; margin-bottom: 24px; }
  .hws-page-2 { page-break-before: always; break-before: page; }
  .batch-report-student-block { page-break-after: always; break-after: page; margin-bottom: 40px; }
  .batch-report-student-block:last-child { page-break-after: avoid; break-after: avoid; }
  .no-print { display: none !important; }
  @media print {
    body { padding: 0; }
    .no-print-btn { display: none !important; }
  }
</style>
</head>
<body>
  <div class="no-print-btn" style="text-align:right;margin-bottom:12px;">
    <button onclick="window.print()" style="background:#1e3a8a;color:#fff;padding:10px 18px;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">Print / Save All as PDF (${printStudents.length} Students)</button>
  </div>
  ${batchPrintRef.current.innerHTML}
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Batch_Report_Sheets_${selectedClass.replace(/\s+/g, '_')}_${term.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Screen Interactive Control Modal */}
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 overflow-hidden my-4 no-print flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b-2 border-amber-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white shadow-xs">
              <Printer className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                Batch Official End of Term Report Sheets
              </h2>
              <p className="text-xs text-amber-300">
                Official 2-Page Terminal Report Sheets · Honey's World High School Format
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target Class Cohort:</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
              >
                <option value="All">All Classes ({classes.length > 0 ? classes.length : 'All'})</option>
                {classes.map(c => (
                  <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Term & Session:</label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-slate-800 text-xs">
                {academicSession} · {term}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleToggleSelectAll}
              className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {selectedStudentIds.size === classStudents.length && classStudents.length > 0 ? (
                <>
                  <CheckSquare className="w-4 h-4 text-blue-900" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-400" />
                  <span>Select All ({classStudents.length})</span>
                </>
              )}
            </button>

            <button
              onClick={handleBatchDownloadHtml}
              disabled={classStudents.length === 0}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Batch Download ({selectedStudentIds.size > 0 ? selectedStudentIds.size : classStudents.length})</span>
            </button>

            <button
              onClick={handleBatchPrint}
              disabled={classStudents.length === 0}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all active:scale-98"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>
                Print / Save PDF ({selectedStudentIds.size > 0 ? selectedStudentIds.size : classStudents.length})
              </span>
            </button>
          </div>
        </div>

        {/* Candidate Selection List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {classStudents.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-300" />
              <div className="font-bold text-sm text-slate-700">No Students Found for {selectedClass}</div>
              <p className="text-xs text-slate-500">
                Ensure students are enrolled in this class cohort in the student roster.
              </p>
            </div>
          ) : (
            classStudents.map((stu) => {
              const isChecked = selectedStudentIds.has(stu.id) || selectedStudentIds.size === 0;
              return (
                <div
                  key={stu.id}
                  onClick={() => handleToggleStudent(stu.id)}
                  className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                    isChecked
                      ? 'bg-blue-50/50 border-blue-300 hover:border-blue-500'
                      : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-blue-900 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStudent(stu.id);
                      }}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-blue-900" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                    </button>

                    <div>
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                        <span>{stu.fullName}</span>
                        {stu.admissionNumber === 'HWS/24/032' && (
                          <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded">
                            Sample Standard
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                        <span>Adm: {stu.admissionNumber}</span>
                        <span>•</span>
                        <span>Class: {stu.classGrade}</span>
                        {stu.accessCode && (
                          <>
                            <span>•</span>
                            <span>Code: {stu.accessCode}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewStudent(stu);
                      }}
                      className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-700" />
                      <span>Preview / Edit Slip</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            {classStudents.length} candidate(s) in {selectedClass} · {selectedStudentIds.size > 0 ? selectedStudentIds.size : classStudents.length} selected for print / download.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 font-bold rounded-lg text-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleBatchPrint}
              disabled={classStudents.length === 0}
              className="px-5 py-1.5 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>Print Batch Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* Single Candidate Preview & Inline Editor Modal */}
      {previewStudent && (
        <div className="fixed inset-0 z-60 bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-300 p-2 sm:p-4">
            <HwsOfficialResultSlip
              student={previewStudent}
              settings={activeSettings}
              academicSession={academicSession}
              term={term}
              isEditable={true}
              usePrintPortal={true}
              onClose={() => setPreviewStudent(null)}
            />
          </div>
        </div>
      )}

      {/* Offscreen/Print Portal Container for Multi-Student Batch Print & Batch Download */}
      {!previewStudent && printHost && createPortal(
        <div ref={batchPrintRef} className="batch-print-container w-full">
          <style>{`
            @media print {
              .batch-report-student-block {
                page-break-after: always !important;
                break-after: page !important;
                margin: 0 auto !important;
                padding: 0 !important;
                width: 100% !important;
              }
              .batch-report-student-block:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
            }
          `}</style>
          {printStudents.map((stu, idx) => (
            <div key={stu.id || idx} className="batch-report-student-block mb-8 print:mb-0">
              <HwsOfficialResultSlip
                student={stu}
                settings={activeSettings}
                academicSession={academicSession}
                term={term}
                isEditable={false}
                usePrintPortal={false}
              />
            </div>
          ))}
        </div>,
        printHost
      )}
    </div>
  );
};
