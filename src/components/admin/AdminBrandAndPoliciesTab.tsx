import React, { useState } from 'react';
import {
  School,
  MapPin,
  Sparkles,
  Phone,
  Mail,
  Globe,
  UserCheck,
  Megaphone,
  ToggleLeft,
  ToggleRight,
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SchoolSettings } from '../../types/cbt';
import { saveSchoolSettings } from '../../services/firebase';

interface AdminBrandAndPoliciesTabProps {
  settings: SchoolSettings;
  onSettingsUpdated: (updated: SchoolSettings) => void;
  showNotification: (text: string, type?: 'success' | 'error') => void;
}

export const AdminBrandAndPoliciesTab: React.FC<AdminBrandAndPoliciesTabProps> = ({
  settings,
  onSettingsUpdated,
  showNotification
}) => {
  const [form, setForm] = useState<SchoolSettings>({
    schoolName: settings.schoolName || "Honey's World High School",
    address: settings.address || 'Gaa Ajanaku, Ilorin, Kwara State',
    location: settings.location || 'Ilorin, Kwara State, Nigeria',
    motto: settings.motto || 'Knowledge, Character & Academic Excellence',
    principalName: settings.principalName || 'Mrs. A. B. Adeyemi (M.Ed, FSTAN)',
    phone: settings.phone || '+234 803 000 0000',
    email: settings.email || 'info@honeysworldhigh.edu.ng',
    website: settings.website || 'www.honeysworldhigh.edu.ng',
    studentIdPrefix: settings.studentIdPrefix || 'HWHS',
    academicSession: settings.academicSession || '2025/2026',
    currentTerm: settings.currentTerm || '1st Term',
    passMarkPercentage: settings.passMarkPercentage || 50,
    allowImmediateResultViewing: settings.allowImmediateResultViewing ?? true,
    announcementBanner: settings.announcementBanner || 'Welcome to Honey\'s World High School Examination Portal. 1st Term Examinations & CA Assessments are now in progress.',
    isStudentPortalActive: settings.isStudentPortalActive ?? true,
    isTeacherPortalActive: settings.isTeacherPortalActive ?? true,
    enableAiAdvisor: settings.enableAiAdvisor ?? true,
    enablePracticeCenter: settings.enablePracticeCenter ?? true,
    caWeights: settings.caWeights,
    gradingScale: settings.gradingScale
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.schoolName.trim()) {
      showNotification('School Name cannot be empty.', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveSchoolSettings(form);
      onSettingsUpdated(form);
      showNotification('Institutional identity and system policies updated successfully across the entire app!');
    } catch (err: any) {
      showNotification(err.message || 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8">
      <div className="pb-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-900 text-[11px] font-bold border border-blue-200 uppercase tracking-wide mb-1">
            <School className="w-3.5 h-3.5 text-blue-700" />
            <span>Institutional Identity & Brand Controls</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">School Identity & Global Announcements</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Everything you customize here instantly updates institutional branding on report cards, result slips, login gates, and system headers.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4 text-amber-400" />
          <span>{saving ? 'Publishing Updates...' : 'Save Brand Settings'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Official School Identity */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <School className="w-4 h-4 text-blue-900" />
            <span>1. Official Institutional Profile</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official School Name
              </label>
              <input
                type="text"
                required
                value={form.schoolName}
                onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Street Address / Location
              </label>
              <input
                type="text"
                required
                placeholder="Gaa Ajanaku, Ilorin, Kwara State"
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                State & Country
              </label>
              <input
                type="text"
                placeholder="Ilorin, Kwara State, Nigeria"
                value={form.location || ''}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                School Motto / Slogan
              </label>
              <input
                type="text"
                placeholder="Knowledge, Character & Academic Excellence"
                value={form.motto || ''}
                onChange={(e) => setForm({ ...form, motto: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 italic"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Principal / Head of Institution
              </label>
              <input
                type="text"
                placeholder="Mrs. A. B. Adeyemi (M.Ed, FSTAN)"
                value={form.principalName || ''}
                onChange={(e) => setForm({ ...form, principalName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Student Admission Number Prefix
              </label>
              <input
                type="text"
                placeholder="HWHS"
                value={form.studentIdPrefix || 'HWHS'}
                onChange={(e) => setForm({ ...form, studentIdPrefix: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Contact Phone
              </label>
              <input
                type="text"
                placeholder="+234 803 000 0000"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Contact Email
              </label>
              <input
                type="email"
                placeholder="info@honeysworldhigh.edu.ng"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Global Institutional Announcement */}
        <div className="pt-6 border-t border-slate-100">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-600" />
            <span>2. Global Institutional Broadcast Banner</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Broadcast Message (Displayed on Landing Gateway and Top Notice Ribbons)
            </label>
            <textarea
              rows={2}
              value={form.announcementBanner || ''}
              onChange={(e) => setForm({ ...form, announcementBanner: e.target.value })}
              placeholder="e.g. 1st Term Examinations commence on Monday. All candidates must bring their official admission slips."
              className="w-full px-3.5 py-2.5 text-xs bg-amber-50/50 border border-amber-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Section 3: System Module Availability Switches */}
        <div className="pt-6 border-t border-slate-100">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>3. System Module Availability & Access Controls</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-slate-900">Student Portal Access</div>
                <div className="text-[11px] text-slate-500">Allow students to log in, take exams, and view results</div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, isStudentPortalActive: !form.isStudentPortalActive })}
                className="cursor-pointer"
              >
                {form.isStudentPortalActive ? (
                  <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                    <ToggleRight className="w-7 h-7" /> Active
                  </span>
                ) : (
                  <span className="text-slate-400 font-bold text-xs flex items-center gap-1">
                    <ToggleLeft className="w-7 h-7" /> Disabled
                  </span>
                )}
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-slate-900">Teacher Portal Access</div>
                <div className="text-[11px] text-slate-500">Allow teachers to log in, create exams, and input CA scores</div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, isTeacherPortalActive: !form.isTeacherPortalActive })}
                className="cursor-pointer"
              >
                {form.isTeacherPortalActive ? (
                  <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                    <ToggleRight className="w-7 h-7" /> Active
                  </span>
                ) : (
                  <span className="text-slate-400 font-bold text-xs flex items-center gap-1">
                    <ToggleLeft className="w-7 h-7" /> Disabled
                  </span>
                )}
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-slate-900">AI Academic Advisor</div>
                <div className="text-[11px] text-slate-500">Gemini 3.8 Flash personalized revision mentor in student portal</div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, enableAiAdvisor: !form.enableAiAdvisor })}
                className="cursor-pointer"
              >
                {form.enableAiAdvisor ? (
                  <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                    <ToggleRight className="w-7 h-7" /> Enabled
                  </span>
                ) : (
                  <span className="text-slate-400 font-bold text-xs flex items-center gap-1">
                    <ToggleLeft className="w-7 h-7" /> Disabled
                  </span>
                )}
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-slate-900">Practice Test Center</div>
                <div className="text-[11px] text-slate-500">Interactive Tutor Mode & Timed Exam practice for students</div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, enablePracticeCenter: !form.enablePracticeCenter })}
                className="cursor-pointer"
              >
                {form.enablePracticeCenter ? (
                  <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                    <ToggleRight className="w-7 h-7" /> Enabled
                  </span>
                ) : (
                  <span className="text-slate-400 font-bold text-xs flex items-center gap-1">
                    <ToggleLeft className="w-7 h-7" /> Disabled
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4 text-amber-400" />
            <span>{saving ? 'Publishing Brand Updates...' : 'Save All Institutional Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
