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
  Settings
} from 'lucide-react';
import { Examination, Question, SchoolClass, Subject } from '../../types/cbt';
import {
  saveExamination,
  deleteExamination,
  fetchQuestions,
  saveQuestion,
  deleteQuestion
} from '../../services/firebase';

interface AdminExamsTabProps {
  exams: Examination[];
  classes: SchoolClass[];
  subjects: Subject[];
  academicSession: string;
  currentTerm: string;
  onExamsUpdated: () => void;
  showNotification: (text: string, type?: 'success' | 'error') => void;
}

export const AdminExamsTab: React.FC<AdminExamsTabProps> = ({
  exams,
  classes,
  subjects,
  academicSession,
  currentTerm,
  onExamsUpdated,
  showNotification
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

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
    durationMinutes: number;
    totalQuestions: number;
    instructions: string;
    status: 'draft' | 'published' | 'archived';
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    resultVisibility: 'immediate' | 'teacher_publish';
    startDate: string;
    endDate: string;
  }>({
    title: '',
    subjectId: '',
    classGrade: 'SS 1',
    academicSession,
    term: currentTerm as any,
    examType: 'Final Examination',
    durationMinutes: 45,
    totalQuestions: 20,
    instructions: 'Select the best option for each question. Click Submit when done.',
    status: 'published',
    shuffleQuestions: true,
    shuffleOptions: true,
    resultVisibility: 'immediate',
    startDate: '',
    endDate: ''
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
      durationMinutes: 45,
      totalQuestions: 20,
      instructions: 'Select the single best option for each question. All questions carry equal marks.',
      status: 'published',
      shuffleQuestions: true,
      shuffleOptions: true,
      resultVisibility: 'immediate',
      startDate: '',
      endDate: ''
    });
    setShowExamModal(true);
  };

  // Open Exam Edit
  const handleOpenEditExam = (exam: Examination) => {
    setEditingExam(exam);
    setExamForm({
      title: exam.title,
      subjectId: exam.subjectId,
      classGrade: exam.classGrade,
      academicSession: exam.academicSession || academicSession,
      term: exam.term,
      examType: exam.examType,
      durationMinutes: exam.durationMinutes,
      totalQuestions: exam.totalQuestions,
      instructions: exam.instructions,
      status: exam.status,
      shuffleQuestions: exam.shuffleQuestions ?? true,
      shuffleOptions: exam.shuffleOptions ?? true,
      resultVisibility: exam.resultVisibility || 'immediate',
      startDate: exam.startDate || '',
      endDate: exam.endDate || ''
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

    const newExam: Examination = {
      id: examId,
      title: examForm.title.trim(),
      subjectId: examForm.subjectId,
      subjectName: subName,
      classGrade: examForm.classGrade,
      academicSession: examForm.academicSession,
      term: examForm.term,
      examType: examForm.examType,
      durationMinutes: Number(examForm.durationMinutes),
      totalQuestions: Number(examForm.totalQuestions),
      instructions: examForm.instructions.trim(),
      teacherId: editingExam ? editingExam.teacherId : 'admin',
      teacherName: editingExam ? editingExam.teacherName : 'Academic Administration',
      status: examForm.status,
      shuffleQuestions: examForm.shuffleQuestions,
      shuffleOptions: examForm.shuffleOptions,
      resultVisibility: examForm.resultVisibility,
      startDate: examForm.startDate || undefined,
      endDate: examForm.endDate || undefined,
      createdAt: editingExam ? editingExam.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await saveExamination(newExam);
      setShowExamModal(false);
      onExamsUpdated();
      showNotification(
        editingExam
          ? `Examination "${newExam.title}" updated successfully!`
          : `New Examination "${newExam.title}" created!`
      );
    } catch (err: any) {
      showNotification(err.message || 'Failed to save examination.', 'error');
    }
  };

  const handleDeleteExam = async (exam: Examination) => {
    if (confirm(`Are you sure you want to delete examination "${exam.title}"? All associated questions will be removed.`)) {
      try {
        await deleteExamination(exam.id);
        onExamsUpdated();
        showNotification(`Examination "${exam.title}" deleted.`);
      } catch (err: any) {
        showNotification(err.message || 'Failed to delete exam.', 'error');
      }
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

  const handleDeleteQuestion = async (q: Question) => {
    if (!activeExamForQuestions) return;
    if (confirm(`Delete Question #${q.questionNumber}?`)) {
      try {
        await deleteQuestion(activeExamForQuestions.id, q.id);
        const qs = await fetchQuestions(activeExamForQuestions.id);
        setExamQuestions(qs || []);
        showNotification(`Question #${q.questionNumber} deleted.`);
      } catch (err: any) {
        showNotification(err.message || 'Failed to delete question.', 'error');
      }
    }
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
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                          exam.status === 'published'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : exam.status === 'draft'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        {exam.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
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
                  placeholder="e.g. 1st Term Computer Studies Examination"
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                />
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
                        <div className="font-semibold text-xs text-slate-900">{q.text}</div>
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
                        <span className="font-bold">A:</span> {q.optionA}
                      </div>
                      <div className={`p-2 rounded-lg border ${q.correctOption === 'B' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-white border-slate-200 text-slate-700'}`}>
                        <span className="font-bold">B:</span> {q.optionB}
                      </div>
                      <div className={`p-2 rounded-lg border ${q.correctOption === 'C' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-white border-slate-200 text-slate-700'}`}>
                        <span className="font-bold">C:</span> {q.optionC}
                      </div>
                      <div className={`p-2 rounded-lg border ${q.correctOption === 'D' ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-white border-slate-200 text-slate-700'}`}>
                        <span className="font-bold">D:</span> {q.optionD}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Question Text</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter the question prompt..."
                  value={questionForm.text}
                  onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-medium"
                />
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
    </div>
  );
};
