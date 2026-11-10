import React, { useState, useMemo } from 'react';
import { Printer, X, CheckSquare, Square, Filter, Users, Award, School } from 'lucide-react';
import { Student, Submission, SchoolSettings, Examination, SchoolClass } from '../../types/cbt';
import { StudentResultView } from '../student/StudentResultView';
import { DEFAULT_SCHOOL_SETTINGS } from '../../data/initialSchoolData';

interface BatchResultSlipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  submissions: Submission[];
  classes: SchoolClass[];
  settings?: SchoolSettings;
  exams?: Examination[];
  initialClassFilter?: string;
}

export const BatchResultSlipsModal: React.FC<BatchResultSlipsModalProps> = ({
  isOpen,
  onClose,
  students,
  submissions,
  classes,
  settings,
  exams,
  initialClassFilter = 'All'
}) => {
  const [selectedClass, setSelectedClass] = useState<string>(initialClassFilter);
  const [selectedExamId, setSelectedExamId] = useState<string>('All');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Active settings with fallback
  const activeSettings = settings || DEFAULT_SCHOOL_SETTINGS;

  // Filter submissions by class and exam
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      const matchClass = selectedClass === 'All' || sub.classGrade === selectedClass;
      const matchExam = selectedExamId === 'All' || sub.examId === selectedExamId;
      return matchClass && matchExam;
    });
  }, [submissions, selectedClass, selectedExamId]);

  // Candidates available for batch printing
  const candidateList = useMemo(() => {
    return filteredSubmissions.map(sub => {
      const studentMatch = students.find(s => s.id === sub.studentId || s.admissionNumber === sub.admissionNumber);
      return {
        submission: sub,
        student: studentMatch || null,
        key: `${sub.studentId || sub.admissionNumber}_${sub.examId}`
      };
    });
  }, [filteredSubmissions, students]);

  // Handle select all / deselect all
  const handleToggleSelectAll = () => {
    if (selectedStudentIds.size === candidateList.length) {
      setSelectedStudentIds(new Set());
    } else {
      const allKeys = new Set(candidateList.map(c => c.key));
      setSelectedStudentIds(allKeys);
    }
  };

  const handleToggleStudent = (key: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedStudentIds(next);
  };

  // Selected candidates for printing
  const printItems = useMemo(() => {
    if (selectedStudentIds.size === 0) return candidateList;
    return candidateList.filter(c => selectedStudentIds.has(c.key));
  }, [candidateList, selectedStudentIds]);

  const handleBatchPrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Print Specific CSS to paginate multiple result slips onto separate A4 sheets */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .batch-modal-ui {
            display: none !important;
          }
          .batch-print-container {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .batch-slip-page {
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 auto 0 auto !important;
            padding: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
          }
          .batch-slip-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
        }
      `}</style>

      {/* Screen Interactive Control Modal */}
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 overflow-hidden my-4 batch-modal-ui flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b-2 border-amber-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white shadow-xs">
              <Printer className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                Batch Official Result Slips Printing
              </h2>
              <p className="text-xs text-amber-300">
                Generate and print formal secondary school result slips for selected students or full class cohorts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs shrink-0">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Filter by Class Form:</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
            >
              <option value="All">All Class Forms ({classes.length} Available)</option>
              {classes.map(c => (
                <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Filter by Examination:</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium truncate"
            >
              <option value="All">All Examinations</option>
              {exams?.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.title} ({ex.classGrade})</option>
              ))}
            </select>
          </div>

          <div className="flex items-end justify-between sm:justify-end gap-2">
            <button
              onClick={handleToggleSelectAll}
              className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {selectedStudentIds.size === candidateList.length && candidateList.length > 0 ? (
                <>
                  <CheckSquare className="w-4 h-4 text-blue-900" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-400" />
                  <span>Select All ({candidateList.length})</span>
                </>
              )}
            </button>

            <button
              onClick={handleBatchPrint}
              disabled={candidateList.length === 0}
              className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>
                Print {selectedStudentIds.size > 0 ? selectedStudentIds.size : candidateList.length} Slips
              </span>
            </button>
          </div>
        </div>

        {/* Candidate Selection List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {candidateList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-300" />
              <div className="font-bold text-sm text-slate-700">No Student Results Found</div>
              <p className="text-xs text-slate-500">
                No submitted examinations match the selected class or examination filter.
              </p>
            </div>
          ) : (
            candidateList.map(item => {
              const isChecked = selectedStudentIds.has(item.key) || selectedStudentIds.size === 0;
              return (
                <div
                  key={item.key}
                  onClick={() => handleToggleStudent(item.key)}
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
                        handleToggleStudent(item.key);
                      }}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-blue-900" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                    </button>

                    <div>
                      <div className="font-bold text-xs text-slate-900 uppercase">
                        {item.submission.studentName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                        <span>Admission No: <strong className="text-blue-900">{item.submission.admissionNumber}</strong></span>
                        <span>•</span>
                        <span>Class: <strong>{item.submission.classGrade}</strong></span>
                        <span>•</span>
                        <span>Exam: <strong>{item.submission.examTitle}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-black font-mono text-slate-900">
                      {item.submission.score} / {item.submission.totalQuestions}
                      <span className="text-xs text-blue-900 ml-1.5 font-bold">({item.submission.percentage}%)</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(item.submission.submittedAt).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Showing {candidateList.length} candidate results · {selectedStudentIds.size > 0 ? selectedStudentIds.size : candidateList.length} ready to print.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 font-bold rounded-lg text-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleBatchPrint}
              disabled={candidateList.length === 0}
              className="px-5 py-1.5 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>Print Batch Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden On-Screen Container That Prints Cleanly with Page Breaks */}
      <div className="hidden print:block batch-print-container w-full">
        {printItems.map((item, idx) => (
          <div key={item.key || idx} className="batch-slip-page mb-8 print:mb-0">
            <StudentResultView
              submission={item.submission}
              allowReview={false}
              onReturnToDashboard={() => {}}
              settings={activeSettings}
              student={item.student}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
