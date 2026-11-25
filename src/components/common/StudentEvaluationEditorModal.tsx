import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Check,
  Award,
  BookOpen,
  Calendar,
  DollarSign,
  User,
  Sparkles,
  FileText,
  AlertCircle
} from 'lucide-react';
import {
  Student,
  StudentTermReportData,
  PsychomotorRating,
  SkillsRating,
  KEY_RATING_LABELS,
  DEFAULT_PSYCHOMOTOR,
  DEFAULT_SKILLS
} from '../../types/cbt';
import { fetchStudentTermReport, saveStudentTermReport } from '../../services/firebase';

interface StudentEvaluationEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  academicSession: string;
  term: '1st Term' | '2nd Term' | '3rd Term';
  onSaved?: (report: StudentTermReportData) => void;
}

export const StudentEvaluationEditorModal: React.FC<StudentEvaluationEditorModalProps> = ({
  isOpen,
  onClose,
  student,
  academicSession,
  term,
  onSaved
}) => {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formData, setFormData] = useState<StudentTermReportData>({
    id: `report_${student.id}_${academicSession.replace('/', '-')}_${term.replace(/\s+/g, '')}`,
    studentId: student.id,
    studentName: student.fullName,
    admissionNumber: student.admissionNumber,
    classGrade: student.classGrade || 'S.S 2',
    academicSession,
    term,
    age: 14,
    house: 'BLUE',
    sex: student.gender || 'MALE',
    noInClass: 13,
    department: student.department || '',
    category: 'SENIOR SECONDARY',
    classAverage: '62.6%',
    behaviours: { ...DEFAULT_PSYCHOMOTOR },
    skills: { ...DEFAULT_SKILLS },
    classTeacherRemarks: "STAY FOCUS AND YOU'LL REACH YOUR GOALS.",
    principalRemarks: "GOOD PROGRESS! BUT MORE EFFORT ARE NEEDED.",
    nextTermBegins: "5TH JANUARY, 2026",
    nextTermFees: "26,000",
    principalSignature: 'Signed',
    proprietressSignature: 'Signed',
    updatedAt: new Date().toISOString()
  });

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchStudentTermReport(student.id, academicSession, term, student)
      .then(report => {
        if (report) setFormData(report);
      })
      .catch(err => console.warn('Error fetching student report data:', err))
      .finally(() => setLoading(false));
  }, [isOpen, student, academicSession, term]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    const payload: StudentTermReportData = {
      ...formData,
      updatedAt: new Date().toISOString()
    };
    try {
      await saveStudentTermReport(payload);
      setFormData(payload);
      setSaveSuccess(true);
      if (onSaved) onSaved(payload);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving student term evaluation:', err);
      setSaveError(err?.message || 'Failed to save student evaluation to database. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const behaviourTraits: Array<{ key: keyof PsychomotorRating; label: string }> = [
    { key: 'punctuality', label: 'Punctuality' },
    { key: 'classAttendance', label: 'Class Attendance' },
    { key: 'personalHygiene', label: 'Personal Hygiene' },
    { key: 'attentiveness', label: 'Attentiveness' },
    { key: 'honesty', label: 'Honesty' },
    { key: 'neatness', label: 'Neatness' },
    { key: 'participationAtWork', label: 'Participation at Work' },
    { key: 'selfControl', label: 'Self-Control' },
    { key: 'initiative', label: 'Initiative' }
  ];

  const skillTraits: Array<{ key: keyof SkillsRating; label: string }> = [
    { key: 'handwriting', label: 'Handwriting' },
    { key: 'drawingPainting', label: 'Drawing / Painting' },
    { key: 'gamesSports', label: 'Games & Sports' },
    { key: 'readingFluency', label: 'Reading Fluency' },
    { key: 'handlingOfTools', label: 'Handling of Tools & Lab.' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-300 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b-2 border-amber-500 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-900 flex items-center justify-center text-white font-bold">
              <FileText className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base uppercase tracking-wide text-white">
                Edit Student Terminal Evaluation & Slip Details
              </h3>
              <p className="text-xs text-amber-300 font-mono">
                {student.fullName} ({student.admissionNumber}) · {academicSession} {term}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {saveError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
          {/* Section 1: Candidate Bio Data on Report Slip */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-900" />
              <span>Report Slip Header Demographics (Page 1)</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Age</label>
                <input
                  type="text"
                  value={formData.age || ''}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                  placeholder="e.g. 14"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">House</label>
                <input
                  type="text"
                  value={formData.house || ''}
                  onChange={(e) => setFormData({ ...formData, house: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold uppercase"
                  placeholder="e.g. BLUE"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Sex</label>
                <select
                  value={formData.sex || 'MALE'}
                  onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="MALE">MALE</option>
                  <option value="FEMALE">FEMALE</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">No In Class</label>
                <input
                  type="text"
                  value={formData.noInClass || ''}
                  onChange={(e) => setFormData({ ...formData, noInClass: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                  placeholder="e.g. 13"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold uppercase"
                  placeholder="e.g. SCIENCE / ARTS / COMMERCIAL"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category || 'SENIOR SECONDARY'}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold uppercase"
                  placeholder="e.g. SENIOR SECONDARY"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Class Average on Slip</label>
                <input
                  type="text"
                  value={formData.classAverage || '62.6%'}
                  onChange={(e) => setFormData({ ...formData, classAverage: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                  placeholder="e.g. 62.6%"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Behaviours Assessment (1 - 5) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-blue-900" />
                <span>Behaviours Assessment (Rating 1 to 5)</span>
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">5: Excellent · 4: Good · 3: Fair · 2: Poor · 1: Very Poor</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {behaviourTraits.map(t => (
                <div key={t.key} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-700">{t.label}</span>
                  <select
                    value={formData.behaviours[t.key] || 5}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 5;
                      setFormData({
                        ...formData,
                        behaviours: { ...formData.behaviours, [t.key]: v }
                      });
                    }}
                    className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-xs"
                  >
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Fair</option>
                    <option value="2">2 - Poor</option>
                    <option value="1">1 - Very Poor</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Skills Assessment (1 - 5) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-900" />
              <span>Skills Assessment (Rating 1 to 5)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {skillTraits.map(s => (
                <div key={s.key} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-700">{s.label}</span>
                  <select
                    value={formData.skills[s.key] || 5}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 5;
                      setFormData({
                        ...formData,
                        skills: { ...formData.skills, [s.key]: v }
                      });
                    }}
                    className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-xs"
                  >
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Fair</option>
                    <option value="2">2 - Poor</option>
                    <option value="1">1 - Very Poor</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Remarks & Next Term Administrative Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-900" />
              <span>Remarks & Administrative Settings (Page 2)</span>
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Class Teacher's Remarks</label>
                <input
                  type="text"
                  value={formData.classTeacherRemarks || ''}
                  onChange={(e) => setFormData({ ...formData, classTeacherRemarks: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold uppercase"
                  placeholder="e.g. STAY FOCUS AND YOU'LL REACH YOUR GOALS."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Principal's Remarks</label>
                <input
                  type="text"
                  value={formData.principalRemarks || ''}
                  onChange={(e) => setFormData({ ...formData, principalRemarks: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold uppercase"
                  placeholder="e.g. GOOD PROGRESS! BUT MORE EFFORT ARE NEEDED."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Next Term Begins</label>
                  <input
                    type="text"
                    value={formData.nextTermBegins || ''}
                    onChange={(e) => setFormData({ ...formData, nextTermBegins: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold uppercase"
                    placeholder="e.g. 5TH JANUARY, 2026"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Next Term Fees (₦)</label>
                  <input
                    type="text"
                    value={formData.nextTermFees || ''}
                    onChange={(e) => setFormData({ ...formData, nextTermFees: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold"
                    placeholder="e.g. 26,000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Evaluation to Database</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
