import React, { useState } from 'react';
import {
  BarChart3,
  Plus,
  Edit3,
  Trash2,
  FileQuestion,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  Filter,
  Eye,
  Settings,
  Image as ImageIcon,
  ShieldAlert,
  X
} from 'lucide-react';
import {
  Examination,
  Question,
  SchoolClass,
  Subject,
  Student,
  CaWeightsConfig,
  CbtTargetComponent,
  checkExamTimeWindow,
  resolveCaWeights,
  resolveExamTargetComponent,
  formatTargetComponentLabel
} from '../../types/cbt';
import {
  saveExamination,
  deleteExamination,
  fetchQuestions,
  saveQuestion,
  deleteQuestion
} from '../../services/firebase';
import { StudentTimerResetModal } from '../common/StudentTimerResetModal';
import { FormattedAcademicText } from '../common/FormattedAcademicText';
import { compressImageFile } from '../../services/imageUtils';

interface AdminExamsTabProps {
  exams: Examination[];
  students?: Student[];
  classes: SchoolClass[];
  subjects: Subject[];
  academicSession: string;
  currentTerm: string;
  caWeights?: CaWeightsConfig;
  onExamsUpdated: () => void;
  showNotification: (text: string, type?: 'success' | 'error') => void;
}

export const AdminExamsTab: React.FC<AdminExamsTabProps> = ({
  exams,
  students = [],
  classes,
  subjects,
  academicSession,
  currentTerm,
  caWeights: rawCaWeights,
  onExamsUpdated,
  showNotification
}) => {
  const caWeights = resolveCaWeights(rawCaWeights);
  const [timerResetModalExam, setTimerResetModalExam] = useState<Examination | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Exam Edit Modal
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Examination | null>(null);
  const [examForm, setExamForm] = useState<{
    title: string;
    subjectId: string;
    classGrade: string;
    academicSession: string;
    term: '1st Term' | '2nd Term' | '3rd Term';
    examType: 'Mid-Term Test' | 'Final Examination' | 'Continuous Assessment';
    targetCaComponent: CbtTargetComponent;
    durationMinutes: number;
    totalQuestions: number;
    instructions: string;
    status: 'draft' | 'published' | 'archived';
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    resultVisibility: 'immediate' | 'teacher_publish';
    startDate: string;
    endDate: string;
    enableAntiCheat: boolean;
    maxTabSwitches: number;
    requireFullscreen: boolean;
  }>({
    title: '',
    subjectId: '',
    classGrade: 'SS 1',
    academicSession,
    term: currentTerm as any,
    examType: 'Final Examination',
    targetCaComponent: 'exam',
    durationMinutes: 45,
    totalQuestions: 20,
    instructions: 'Select the best option for each question. Click Submit when done.',
    status: 'published',
    shuffleQuestions: true,
    shuffleOptions: true,
    resultVisibility: 'immediate',
    startDate: '',
    endDate: '',
    enableAntiCheat: false,
    maxTabSwitches: 3,
    requireFullscreen: false
  });

  // Question Manager Modal
  const [activeExamForQuestions, setActiveExamForQuestions] = useState<Examination | null>(null);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Add / Edit Single Question
  const [showQuestionEditModal, setShowQuestionEditModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState<{
    questionNumber: number;
    text: string;
    imageUrl: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: 'A' | 'B' | 'C' | 'D';
    topic: string;
    explanation: string;
  }>({
    questionNumber: 1,
    text: '',
    imageUrl: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'A',
    topic: 'General Concepts',
    explanation: ''
  });

  // Open Exam Add
  const handleOpenAddExam = () => {
    setEditingExam(null);
    setExamForm({
      title: '',
      subjectId: subjects[0]?.id || '',
      classGrade: classes[0]?.code || 'SS 1',
      academicSession,
      term: currentTerm as any,
      examType: 'Final Examination',
      targetCaComponent: 'exam',
      durationMinutes: 45,
      totalQuestions: 20,
      instructions: 'Select the single best option for each question. All questions carry equal marks.',
      status: 'published',
      shuffleQuestions: true,
      shuffleOptions: true,
      resultVisibility: 'immediate',
      startDate: '',
      endDate: '',
      enableAntiCheat: false,
      maxTabSwitches: 3,
      requireFullscreen: false
    });
    setShowExamModal(true);
  };

  // Open Exam Edit
  const handleOpenEditExam = (exam: Examination) => {
    setEditingExam(exam);
    const resolvedTarget = resolveExamTargetComponent(exam);
    setExamForm({
      title: exam.title,
      subjectId: exam.subjectId,
      classGrade: exam.classGrade,
      academicSession: exam.academicSession || academicSession,
      term: exam.term,
      examType: exam.examType || (resolvedTarget === 'exam' ? 'Final Examination' : 'Continuous Assessment'),
      targetCaComponent: resolvedTarget,
      durationMinutes: exam.durationMinutes,
      totalQuestions: exam.totalQuestions,
      instructions: exam.instructions,
      status: exam.status,
      shuffleQuestions: exam.shuffleQuestions ?? true,
      shuffleOptions: exam.shuffleOptions ?? true,
      resultVisibility: exam.resultVisibility || 'immediate',
      startDate: exam.startDate || '',
      endDate: exam.endDate || '',
      enableAntiCheat: Boolean(exam.enableAntiCheat),
      maxTabSwitches: exam.maxTabSwitches || 3,
      requireFullscreen: Boolean(exam.requireFullscreen)
    });
    setShowExamModal(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm.title.trim() || !examForm.subjectId) {
      showNotification('Please fill in Examination Title and select a Subject.', 'error');
      return;
    }

    const selectedSub = subjects.find(s => s.id === examForm.subjectId);
    const subName = selectedSub ? selectedSub.name : 'General';
    const examId = editingExam ? editingExam.id : `exam_${Date.now()}`;

    const cleanStart = (examForm.startDate || '').trim();
    let cleanEnd = (examForm.endDate || '').trim();
    let autoClearedPastEnd = false;
    if (examForm.status === 'published' && cleanEnd) {
      const endMs = new Date(cleanEnd).getTime();
      if (!isNaN(endMs) && endMs <= Date.now()) {
        cleanEnd = '';
        autoClearedPastEnd = true;
      }
    }

    const derivedExamType =
      examForm.targetCaComponent === 'exam' ? 'Final Examination' : 'Continuous Assessment';

    const newExam: Examination = {
      id: examId,
      title: examForm.title.trim(),
      subjectId: examForm.subjectId,
      subjectName: subName,
      classGrade: examForm.classGrade,
      academicSession: examForm.academicSession,
      term: examForm.term,
      examType: examForm.examType || derivedExamType,
      targetCaComponent: examForm.targetCaComponent,
      durationMinutes: Number(examForm.durationMinutes),
      totalQuestions: Number(examForm.totalQuestions),
      instructions: examForm.instructions.trim(),
      teacherId: editingExam ? editingExam.teacherId : 'admin',
      teacherName: editingExam ? editingExam.teacherName : 'Academic Administration',
      status: examForm.status,
      shuffleQuestions: examForm.shuffleQuestions,
      shuffleOptions: examForm.shuffleOptions,
      resultVisibility: examForm.resultVisibility,
      startDate: cleanStart,
      endDate: cleanEnd,
      enableAntiCheat: examForm.enableAntiCheat,
      maxTabSwitches: Math.max(1, Number(examForm.maxTabSwitches) || 3),
      requireFullscreen: examForm.requireFullscreen,
      createdAt: editingExam ? editingExam.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await saveExamination(newExam);
      setShowExamModal(false);
      onExamsUpdated();
      showNotification(
        autoClearedPastEnd
          ? `Examination "${newExam.title}" published & expired closing date cleared so students can enter immediately!`
          : editingExam
          ? `Examination "${newExam.title}" updated successfully!`
          : `New Examination "${newExam.title}" created!`
      );
    } catch (err: any) {
      showNotification(err.message || 'Failed to save examination.', 'error');
    }
  };

  const handleDeleteExam = (exam: Examination) => {
    setPendingConfirm({
      title: 'Delete Examination',
      message: `Are you sure you want to permanently delete "${exam.title}" and all its associated questions? Students will immediately lose access to this paper.`,
      confirmLabel: 'Delete Examination',
      onConfirm: async () => {
        try {
          await deleteExamination(exam.id);
          onExamsUpdated();
          showNotification(`Examination "${exam.title}" deleted.`);
        } catch (err: any) {
          showNotification(err.message || 'Failed to delete exam.', 'error');
        }
      }
    });
  };

  const handleTogglePublish = async (exam: Examination) => {
    const nextStatus: 'draft' | 'published' = exam.status === 'published' ? 'draft' : 'published';
    let nextStart = (exam.startDate || '').trim();
    let nextEnd = (exam.endDate || '').trim();
    if (nextStatus === 'published' && nextEnd) {
      const endMs = new Date(nextEnd).getTime();
      if (!isNaN(endMs) && endMs <= Date.now()) {
        nextEnd = '';
      }
    }
    try {
      await saveExamination({
        ...exam,
        status: nextStatus,
        startDate: nextStart,
        endDate: nextEnd,
        updatedAt: new Date().toISOString()
      });
      onExamsUpdated();
      showNotification(
        nextStatus === 'published'
          ? `Exam "${exam.title}" is now PUBLISHED and open to students.`
          : `Exam "${exam.title}" is now PAUSED (hidden as draft).`
      );
    } catch (err: any) {
      showNotification(err.message || 'Failed to toggle exam status.', 'error');
    }
  };

  const handleOpenExamNow = async (exam: Examination) => {
    try {
      await saveExamination({
        ...exam,
        status: 'published',
        startDate: '',
        endDate: '',
        updatedAt: new Date().toISOString()
      });
      onExamsUpdated();
      showNotification(`Exam "${exam.title}" schedule cleared and OPEN immediately to students.`);
    } catch (err: any) {
      showNotification(err.message || 'Failed to open examination.', 'error');
    }
  };

  // Question Management
  const handleOpenQuestions = async (exam: Examination) => {
    setActiveExamForQuestions(exam);
    setLoadingQuestions(true);
    try {
      const qs = await fetchQuestions(exam.id);
      setExamQuestions(qs || []);
    } catch (err) {
      console.warn('Questions fetch error:', err);
      setExamQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleOpenAddQuestion = () => {
    setEditingQuestion(null);
    setQuestionForm({
      questionNumber: examQuestions.length + 1,
      text: '',
      imageUrl: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOption: 'A',
      topic: 'General Concepts',
      explanation: ''
    });
    setShowQuestionEditModal(true);
  };

  const handleOpenEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQuestionForm({
      questionNumber: q.questionNumber,
      text: q.text,
      imageUrl: q.imageUrl || '',
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: q.correctOption,
      topic: q.topic || 'General Concepts',
      explanation: q.explanation || ''
    });
    setShowQuestionEditModal(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExamForQuestions) return;
    if (!questionForm.text.trim() || !questionForm.optionA.trim() || !questionForm.optionB.trim()) {
      showNotification('Please fill in question text and at least options A and B.', 'error');
      return;
    }

    const qId = editingQuestion ? editingQuestion.id : `q_${Date.now()}`;
    const questionObj: Question = {
      id: qId,
      examId: activeExamForQuestions.id,
      questionNumber: Number(questionForm.questionNumber),
      text: questionForm.text.trim(),
      imageUrl: questionForm.imageUrl.trim(),
      optionA: questionForm.optionA.trim(),
      optionB: questionForm.optionB.trim(),
      optionC: questionForm.optionC.trim(),
      optionD: questionForm.optionD.trim(),
      correctOption: questionForm.correctOption,
      subject: activeExamForQuestions.subjectName,
      topic: questionForm.topic.trim(),
      explanation: questionForm.explanation.trim()
    };

    try {
      await saveQuestion(activeExamForQuestions.id, questionObj);
      setShowQuestionEditModal(false);
      // Reload questions
      const qs = await fetchQuestions(activeExamForQuestions.id);
      setExamQuestions(qs || []);

      // Auto update totalQuestions in exam if changed
      if (qs.length !== activeExamForQuestions.totalQuestions) {
        const updatedExam = { ...activeExamForQuestions, totalQuestions: qs.length };
        await saveExamination(updatedExam);
        setActiveExamForQuestions(updatedExam);
        onExamsUpdated();
      }

      showNotification(`Question ${questionObj.questionNumber} saved successfully!`);
    } catch (err: any) {
      showNotification(err.message || 'Failed to save question.', 'error');
    }
  };

  const handleDeleteQuestion = (q: Question) => {
    if (!activeExamForQuestions) return;
    const examSnapshot = activeExamForQuestions;
    const examId = examSnapshot.id;
    setPendingConfirm({
      title: `Delete Question #${q.questionNumber}`,
      message: `Remove Question #${q.questionNumber} from "${examSnapshot.title}"?`,
      confirmLabel: 'Delete Question',
      onConfirm: async () => {
        try {
          await deleteQuestion(examId, q.id);
          const qs = await fetchQuestions(examId);
          setExamQuestions(qs || []);
          const updatedExam: Examination = {
            ...examSnapshot,
            totalQuestions: qs.length,
            updatedAt: new Date().toISOString()
          };
          await saveExamination(updatedExam);
          setActiveExamForQuestions(updatedExam);
          onExamsUpdated();
          showNotification(`Question #${q.questionNumber} deleted.`);
        } catch (err: any) {
          showNotification(err.message || 'Failed to delete question.', 'error');
        }
      }
    });
  };

  // Filtered exams
  const filteredExams = exams.filter(e => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      e.title.toLowerCase().includes(q) ||
      e.subjectName.toLowerCase().includes(q) ||
      e.teacherName.toLowerCase().includes(q);
    const matchesClass = selectedClassFilter === 'All' || e.classGrade === selectedClassFilter;
    const matchesStatus = selectedStatusFilter === 'All' || e.status === selectedStatusFilter;
    return matchesSearch && matchesClass && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-900 text-[11px] font-bold border border-purple-200 uppercase tracking-wide mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-purple-700" />
              <span>CBT Exam & Paper Governance</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">Examinations & Question Bank Management</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Full administrative authority to schedule, publish, edit questions, set time windows, and configure settings for all school CBT tests.
            </p>
          </div>

          <button
            onClick={handleOpenAddExam}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Create New Examination</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search examinations by title, subject, or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="All">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.code}>{c.code}</option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Exams Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3 px-4">Examination Title</th>
                <th className="py-3 px-4">Subject & Class</th>
                <th className="py-3 px-4">Duration & Questions</th>
                <th className="py-3 px-4">Term & Session</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No examinations found. Click "Create New Examination" above.
                  </td>
                </tr>
              ) : (
                filteredExams.map(exam => (
                  <tr key={exam.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{exam.title}</div>
                      <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                        Author: {exam.teacherName || 'Faculty'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-blue-900">{exam.subjectName}</div>
                      <div className="text-[11px] text-slate-500 font-semibold">{exam.classGrade}</div>
                      {(() => {
                        const targetComp = resolveExamTargetComponent(exam);
                        const label = formatTargetComponentLabel(targetComp, caWeights);
                        return (
                          <span
                            className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                              targetComp === 'first_ca'
                                ? 'bg-blue-50 text-blue-900 border-blue-200'
                                : targetComp === 'second_ca'
                                ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                                : 'bg-amber-50 text-amber-900 border-amber-300'
                            }`}
                          >
                            Broadsheet: {label}
                          </span>
                        );
                      })()}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{exam.durationMinutes} mins</div>
                      <div className="text-[11px] text-slate-500">{exam.totalQuestions} questions</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      <div>{exam.term}</div>
                      <div>{exam.academicSession}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      {(() => {
                        const win = checkExamTimeWindow(exam);
                        return (
                          <div className="space-y-1">
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border inline-block ${
                                exam.status === 'published'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : exam.status === 'draft'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-300'
                              }`}
                            >
                              {exam.status}
                            </span>
                            {exam.status === 'published' && (
                              <div className={`text-[10px] font-bold ${
                                win.isOpen
                                  ? 'text-emerald-700'
                                  : win.code === 'not_yet_started'
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                              }`}>
                                {win.isOpen
                                  ? '● Open to Students'
                                  : win.code === 'not_yet_started'
                                  ? '○ Scheduled Start'
                                  : '✕ Window Closed'}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {exam.status === 'published' && !checkExamTimeWindow(exam).isOpen && (
                          <button
                            onClick={() => handleOpenExamNow(exam)}
                            className="px-2.5 py-1 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg cursor-pointer transition-colors shadow-2xs"
                            title="Clear schedule dates and open immediately for students"
                          >
                            Open Now
                          </button>
                        )}
                        <button
                          onClick={() => setTimerResetModalExam(exam)}
                          className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Restart exam countdown timer for any student or entire class"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          <span>Reset Timer</span>
                        </button>
                        <button
                          onClick={() => handleTogglePublish(exam)}
                          className={`px-2 py-1 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                            exam.status === 'published'
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-300'
                          }`}
                          title={exam.status === 'published' ? 'Pause exam (hide from students)' : 'Publish exam (make live)'}
                        >
                          {exam.status === 'published' ? 'Pause' : 'Publish'}
                        </button>
                        <button
                          onClick={() => handleOpenQuestions(exam)}
                          className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                          title="Manage Questions"
                        >
                          <FileQuestion className="w-3.5 h-3.5 text-blue-700" />
                          <span>Questions</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditExam(exam)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Exam"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExam(exam)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Exam"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Exam Modal */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm">
                  {editingExam ? 'Edit Examination Parameters' : 'Create New Examination'}
                </h3>
              </div>
              <button
                onClick={() => setShowExamModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Examination Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1st CA Test or 1st Term Computer Studies Examination"
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                />
              </div>

              {/* Result Broadsheet Target Selector (1st CA / 2nd CA / Term Exam) */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-blue-950 text-xs">
                    Record Score Into Broadsheet Column
                  </label>
                  <span className="text-[10px] font-bold text-blue-700">Auto-scales on submission</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      value: 'first_ca' as CbtTargetComponent,
                      label: caWeights.firstCaLabel,
                      max: caWeights.firstCaMax,
                      examType: 'Continuous Assessment' as const
                    },
                    {
                      value: 'second_ca' as CbtTargetComponent,
                      label: caWeights.secondCaLabel,
                      max: caWeights.secondCaMax,
                      examType: 'Continuous Assessment' as const
                    },
                    {
                      value: 'exam' as CbtTargetComponent,
                      label: caWeights.examLabel,
                      max: caWeights.examMax,
                      examType: 'Final Examination' as const
                    }
                  ].map(opt => {
                    const active = examForm.targetCaComponent === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setExamForm({
                            ...examForm,
                            targetCaComponent: opt.value,
                            examType: opt.examType
                          })
                        }
                        className={`px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                        }`}
                      >
                        <div className="font-bold text-[11px] truncate">{opt.label}</div>
                        <div className={`text-[10px] font-mono ${active ? 'text-blue-200' : 'text-slate-500'}`}>
                          Max: {opt.max} marks
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                  <select
                    value={examForm.subjectId}
                    onChange={(e) => setExamForm({ ...examForm, subjectId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Class</label>
                  <select
                    value={examForm.classGrade}
                    onChange={(e) => setExamForm({ ...examForm, classGrade: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Academic Session</label>
                  <input
                    type="text"
                    value={examForm.academicSession}
                    onChange={(e) => setExamForm({ ...examForm, academicSession: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Term</label>
                  <select
                    value={examForm.term}
                    onChange={(e) => setExamForm({ ...examForm, term: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="1st Term">1st Term</option>
                    <option value="2nd Term">2nd Term</option>
                    <option value="3rd Term">3rd Term</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={examForm.durationMinutes}
                    onChange={(e) => setExamForm({ ...examForm, durationMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Total Questions</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={examForm.totalQuestions}
                    onChange={(e) => setExamForm({ ...examForm, totalQuestions: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={examForm.status}
                    onChange={(e) => setExamForm({ ...examForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="published">Published (Visible)</option>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="archived">Archived (Closed)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Access Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={examForm.startDate}
                    onChange={(e) => setExamForm({ ...examForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Access End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={examForm.endDate}
                    onChange={(e) => setExamForm({ ...examForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Instructions for Candidate</label>
                <textarea
                  rows={2}
                  value={examForm.instructions}
                  onChange={(e) => setExamForm({ ...examForm, instructions: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={examForm.shuffleQuestions}
                    onChange={(e) => setExamForm({ ...examForm, shuffleQuestions: e.target.checked })}
                    className="rounded text-blue-900"
                  />
                  <span>Shuffle Questions</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={examForm.shuffleOptions}
                    onChange={(e) => setExamForm({ ...examForm, shuffleOptions: e.target.checked })}
                    className="rounded text-blue-900"
                  />
                  <span>Shuffle Options (A-D)</span>
                </label>
              </div>

              {/* Anti-Malpractice Proctoring Settings */}
              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-950">
                    <input
                      type="checkbox"
                      checked={examForm.enableAntiCheat}
                      onChange={(e) => setExamForm({ ...examForm, enableAntiCheat: e.target.checked })}
                      className="rounded text-rose-700"
                    />
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                    <span>Enable Anti-Malpractice Tab-Switch Proctoring</span>
                  </label>
                </div>
                {examForm.enableAntiCheat && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        Auto-Submit After Tab Switches
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={examForm.maxTabSwitches}
                        onChange={(e) =>
                          setExamForm({ ...examForm, maxTabSwitches: Math.max(1, Number(e.target.value) || 3) })
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg font-bold"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 pt-4">
                      <input
                        type="checkbox"
                        checked={examForm.requireFullscreen}
                        onChange={(e) => setExamForm({ ...examForm, requireFullscreen: e.target.checked })}
                        className="rounded text-rose-700"
                      />
                      <span>Prompt Fullscreen Lock</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExamModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-slate-900 text-white rounded-xl shadow-md hover:bg-slate-800 cursor-pointer"
                >
                  {editingExam ? 'Update Examination' : 'Save Examination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question Bank Manager Modal */}
      {activeExamForQuestions && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <FileQuestion className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm">{activeExamForQuestions.title}</h3>
                  <p className="text-[11px] text-slate-400">
                    Question Bank Manager · {examQuestions.length} Questions Configured
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenAddQuestion}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question</span>
                </button>
                <button
                  onClick={() => setActiveExamForQuestions(null)}
                  className="text-slate-400 hover:text-white cursor-pointer px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingQuestions ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Loading question items...
                </div>
              ) : examQuestions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No questions added to this examination yet. Click "Add Question" above.
                </div>
              ) : (
                examQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-slate-300 transition-colors space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-slate-900 text-amber-300 shrink-0">
                          Q{q.questionNumber}
                        </span>
                        <div className="font-semibold text-xs text-slate-900">
                          <FormattedAcademicText text={q.text} />
                          {q.imageUrl && (
                            <img
                              src={q.imageUrl}
                              alt={`Question ${q.questionNumber} diagram`}
                              className="mt-2 max-h-40 rounded-lg border border-slate-200 object-contain bg-white"
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEditQuestion(q)}
                          className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                          title="Edit Question"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q)}
                          className="p-1 text-rose-500 hover:text-rose-700 rounded cursor-pointer"
                          title="Delete Question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className={`p-2 rounded-lg border ${q.correctOption === 'A' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-white border-slate-200 text-slate-700'}`}>
                        <span className="font-bold">A:</span> <FormattedAcademicText text={q.optionA} />
                      </div>
                      <div className={`p-2 rounded-lg border ${q.correctOption === 'B' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-white border-slate-200 text-slate-700'}`}>
                        <span className="font-bold">B:</span> <FormattedAcademicText text={q.optionB} />
                      </div>
                      <div className={`p-2 rounded-lg border ${q.correctOption === 'C' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-white border-slate-200 text-slate-700'}`}>
                        <span className="font-bold">C:</span> <FormattedAcademicText text={q.optionC} />
                      </div>
                      <div className={`p-2 rounded-lg border ${q.correctOption === 'D' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-white border-slate-200 text-slate-700'}`}>
                        <span className="font-bold">D:</span> <FormattedAcademicText text={q.optionD} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1">
                      <span className="font-semibold text-emerald-700">Correct Option: <strong>{q.correctOption}</strong></span>
                      {q.topic && <span>· Topic: {q.topic}</span>}
                      {q.explanation && <span>· Explanation provided</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Single Question Modal */}
      {showQuestionEditModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 my-6">
            <h3 className="font-black text-sm text-slate-900 mb-4">
              {editingQuestion ? `Edit Question #${questionForm.questionNumber}` : 'Add New Question'}
            </h3>

            <form onSubmit={handleSaveQuestion} className="space-y-3">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <label className="block text-xs font-bold text-slate-700">Question Text (supports ^2, _2, \sqrt{'{x}'}, \frac{'{a}{b}'})</label>
                  <div className="flex flex-wrap gap-1">
                    {['^2', '_2', '\\sqrt{}', '\\frac{}{}', 'π', 'θ', '°', '±', '×', '÷'].map(sym => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => setQuestionForm(prev => ({ ...prev, text: `${prev.text}${sym}` }))}
                        className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 hover:bg-blue-100 border border-slate-300 rounded cursor-pointer"
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter the question prompt (e.g. Solve x^2 - 4 = 0 or Balance H_2 + O_2 -> H_2O)..."
                  value={questionForm.text}
                  onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-medium"
                />
                {questionForm.text.trim() && (
                  <div className="mt-1.5 p-2 rounded-lg bg-blue-50/60 border border-blue-200 text-xs text-slate-800">
                    <span className="text-[10px] font-bold text-blue-900 uppercase block mb-0.5">Student View Preview:</span>
                    <FormattedAcademicText text={questionForm.text} />
                  </div>
                )}
              </div>

              {/* Optional Diagram / Figure Image */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-700" />
                    <span>Optional Diagram / Chart Image</span>
                  </label>
                  {questionForm.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setQuestionForm({ ...questionForm, imageUrl: '' })}
                      className="text-[10px] text-rose-600 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="px-3 py-1.5 bg-white hover:bg-blue-50 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer shrink-0 text-center">
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await compressImageFile(file, 720, 480, 0.85);
                          setQuestionForm(prev => ({ ...prev, imageUrl: dataUrl }));
                        } catch {
                          showNotification('Could not process image file.', 'error');
                        }
                      }}
                    />
                  </label>
                  <input
                    type="text"
                    placeholder="Or paste diagram image URL..."
                    value={questionForm.imageUrl}
                    onChange={(e) => setQuestionForm({ ...questionForm, imageUrl: e.target.value })}
                    className="flex-1 px-2.5 py-1.5 text-[11px] bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                {questionForm.imageUrl && (
                  <img
                    src={questionForm.imageUrl}
                    alt="Diagram preview"
                    className="max-h-32 rounded-lg border border-slate-200 object-contain bg-white"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Option A</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optionA}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionA: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Option B</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optionB}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionB: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Option C</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optionC}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionC: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Option D</label>
                  <input
                    type="text"
                    required
                    value={questionForm.optionD}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionD: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Correct Answer</label>
                  <select
                    value={questionForm.correctOption}
                    onChange={(e) => setQuestionForm({ ...questionForm, correctOption: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-emerald-800"
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Curriculum Topic</label>
                  <input
                    type="text"
                    placeholder="e.g. Algorithms"
                    value={questionForm.topic}
                    onChange={(e) => setQuestionForm({ ...questionForm, topic: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Explanation (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Explain why this option is correct (shown to students in Tutor Mode)..."
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowQuestionEditModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl cursor-pointer"
                >
                  {editingQuestion ? 'Update Question' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Timer Reset Modal */}
      {timerResetModalExam && (
        <StudentTimerResetModal
          isOpen={Boolean(timerResetModalExam)}
          onClose={() => setTimerResetModalExam(null)}
          exam={timerResetModalExam}
          students={students}
          onTimerRestarted={() => {
            onExamsUpdated();
            showNotification(`Student timers successfully reset for "${timerResetModalExam.title}".`);
          }}
        />
      )}

      {/* In-app Confirmation Modal (iframe-safe replacement for window.confirm) */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-70 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-rose-950 text-white px-5 py-4 flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
              <h3 className="font-bold text-sm">{pendingConfirm.title}</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">{pendingConfirm.message}</p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={() => setPendingConfirm(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={async () => {
                    setConfirmBusy(true);
                    try {
                      await pendingConfirm.onConfirm();
                    } finally {
                      setConfirmBusy(false);
                      setPendingConfirm(null);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {confirmBusy ? 'Deleting...' : pendingConfirm.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
