import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Edit3,
  Trash2,
  FolderTree,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SchoolClass, Subject } from '../../types/cbt';
import {
  saveSchoolClass,
  deleteSchoolClass,
  saveSubject,
  deleteSubject
} from '../../services/firebase';

interface AdminCurriculumTabProps {
  classes: SchoolClass[];
  subjects: Subject[];
  academicSession: string;
  onCurriculumUpdated: () => void;
  showNotification: (text: string, type?: 'success' | 'error') => void;
}

export const AdminCurriculumTab: React.FC<AdminCurriculumTabProps> = ({
  classes,
  subjects,
  academicSession,
  onCurriculumUpdated,
  showNotification
}) => {
  // Modal states
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [classForm, setClassForm] = useState({
    name: '',
    code: '',
    arm: 'General',
    academicSession
  });

  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    department: 'Science & Tech'
  });

  // Class Handlers
  const handleOpenAddClass = () => {
    setEditingClass(null);
    setClassForm({ name: '', code: '', arm: 'General', academicSession });
    setShowAddClassModal(true);
  };

  const handleOpenEditClass = (cls: SchoolClass) => {
    setEditingClass(cls);
    setClassForm({
      name: cls.name,
      code: cls.code,
      arm: cls.arm || 'General',
      academicSession: cls.academicSession || academicSession
    });
    setShowAddClassModal(true);
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name.trim() || !classForm.code.trim()) {
      showNotification('Please provide Class Name and Code.', 'error');
      return;
    }

    const classId = editingClass ? editingClass.id : `cls_${Date.now()}`;
    const newClass: SchoolClass = {
      id: classId,
      name: classForm.name.trim(),
      code: classForm.code.trim().toUpperCase(),
      arm: classForm.arm.trim(),
      academicSession: classForm.academicSession
    };

    try {
      await saveSchoolClass(newClass);
      setShowAddClassModal(false);
      onCurriculumUpdated();
      showNotification(
        editingClass
          ? `Class "${newClass.code}" updated successfully!`
          : `Class "${newClass.code}" added to the school cohort.`
      );
    } catch (err: any) {
      showNotification(err.message || 'Failed to save class.', 'error');
    }
  };

  const handleDeleteClass = async (cls: SchoolClass) => {
    if (confirm(`Are you sure you want to delete class cohort "${cls.code}"?`)) {
      try {
        await deleteSchoolClass(cls.id);
        onCurriculumUpdated();
        showNotification(`Class "${cls.code}" deleted.`);
      } catch (err: any) {
        showNotification(err.message || 'Failed to delete class.', 'error');
      }
    }
  };

  // Subject Handlers
  const handleOpenAddSubject = () => {
    setEditingSubject(null);
    setSubjectForm({ name: '', code: '', department: 'Science & Tech' });
    setShowAddSubjectModal(true);
  };

  const handleOpenEditSubject = (sub: Subject) => {
    setEditingSubject(sub);
    setSubjectForm({
      name: sub.name,
      code: sub.code,
      department: sub.department
    });
    setShowAddSubjectModal(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name.trim() || !subjectForm.code.trim()) {
      showNotification('Please provide Subject Name and Code.', 'error');
      return;
    }

    const subId = editingSubject ? editingSubject.id : `sub_${Date.now()}`;
    const newSub: Subject = {
      id: subId,
      name: subjectForm.name.trim(),
      code: subjectForm.code.trim().toUpperCase(),
      department: subjectForm.department.trim()
    };

    try {
      await saveSubject(newSub);
      setShowAddSubjectModal(false);
      onCurriculumUpdated();
      showNotification(
        editingSubject
          ? `Subject "${newSub.name}" updated successfully!`
          : `Subject "${newSub.name}" added to school curriculum.`
      );
    } catch (err: any) {
      showNotification(err.message || 'Failed to save subject.', 'error');
    }
  };

  const handleDeleteSubject = async (sub: Subject) => {
    if (confirm(`Are you sure you want to delete curriculum subject "${sub.name}"?`)) {
      try {
        await deleteSubject(sub.id);
        onCurriculumUpdated();
        showNotification(`Subject "${sub.name}" deleted.`);
      } catch (err: any) {
        showNotification(err.message || 'Failed to delete subject.', 'error');
      }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Classes Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900">Academic Classes & Arms ({classes.length})</h3>
            <p className="text-xs text-slate-500">Junior & Senior Secondary cohorts</p>
          </div>
          <button
            onClick={handleOpenAddClass}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Add Class</span>
          </button>
        </div>

        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {classes.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No classes configured. Click "Add Class" above.
            </div>
          ) : (
            classes.map(cls => (
              <div
                key={cls.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm">{cls.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Code: <strong className="text-slate-800">{cls.code}</strong> · Arm: {cls.arm || 'General'} · Session: {cls.academicSession}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditClass(cls)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                    title="Edit Class"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteClass(cls)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                    title="Delete Class"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Subjects Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900">Curriculum Subjects ({subjects.length})</h3>
            <p className="text-xs text-slate-500">School teaching & assessment syllabus</p>
          </div>
          <button
            onClick={handleOpenAddSubject}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Add Subject</span>
          </button>
        </div>

        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {subjects.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No subjects configured. Click "Add Subject" above.
            </div>
          ) : (
            subjects.map(sub => (
              <div
                key={sub.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span>{sub.name}</span>
                    <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                      {sub.code}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Department: {sub.department}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditSubject(sub)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                    title="Edit Subject"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSubject(sub)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                    title="Delete Subject"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add / Edit Class Modal */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6">
            <h3 className="font-black text-sm text-slate-900 mb-4">
              {editingClass ? 'Edit School Class' : 'Add School Class'}
            </h3>
            <form onSubmit={handleSaveClass} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Class Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Secondary 1"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Code / Short Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SS 1"
                  value={classForm.code}
                  onChange={(e) => setClassForm({ ...classForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Arm / Stream</label>
                <input
                  type="text"
                  placeholder="e.g. Gold, Diamond, Science, Arts"
                  value={classForm.arm}
                  onChange={(e) => setClassForm({ ...classForm, arm: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Academic Session</label>
                <input
                  type="text"
                  value={classForm.academicSession}
                  onChange={(e) => setClassForm({ ...classForm, academicSession: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl cursor-pointer"
                >
                  {editingClass ? 'Update Class' : 'Save Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6">
            <h3 className="font-black text-sm text-slate-900 mb-4">
              {editingSubject ? 'Edit Subject' : 'Add Curriculum Subject'}
            </h3>
            <form onSubmit={handleSaveSubject} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Further Mathematics"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FMTH"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={subjectForm.department}
                  onChange={(e) => setSubjectForm({ ...subjectForm, department: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="Science & Tech">Science & Tech</option>
                  <option value="General Mathematics">General Mathematics</option>
                  <option value="Languages & Humanities">Languages & Humanities</option>
                  <option value="Pure Sciences">Pure Sciences</option>
                  <option value="Biological Sciences">Biological Sciences</option>
                  <option value="Commercial Studies">Commercial Studies</option>
                  <option value="Vocational & Arts">Vocational & Arts</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl cursor-pointer"
                >
                  {editingSubject ? 'Update Subject' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
