import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle,
  Upload,
  RotateCcw
} from 'lucide-react';
import { SchoolSettings, resolveCaWeights } from '../../types/cbt';
import { saveSchoolSettings } from '../../services/firebase';
import { compressLogoFile } from '../../services/imageUtils';

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
    schoolName: settings.schoolName ?? "Honey's World High School",
    address: settings.address ?? 'Gaa Ajanaku, Ilorin, Kwara State',
    location: settings.location ?? 'Ilorin, Kwara State, Nigeria',
    motto: settings.motto ?? 'Knowledge, Character & Academic Excellence',
    principalName: settings.principalName ?? 'Mrs. A. B. Adeyemi (M.Ed, FSTAN)',
    examOfficerName: settings.examOfficerName ?? 'Mr. O. P. Balogun (M.Sc, Exam Officer)',
    resultTitle: settings.resultTitle ?? 'OFFICIAL CONTINUOUS ASSESSMENT & CBT EXAMINATION REPORT',
    resultSubtitle: settings.resultSubtitle ?? 'HONEY\'S WORLD HIGH SCHOOL · ILORIN, KWARA STATE',
    securityNotice: settings.securityNotice ?? 'Any alteration on this official slip renders it null and void. Generated directly from the school CBT and Assessment Cloud.',
    phone: settings.phone ?? '+234 803 000 0000',
    email: settings.email ?? 'info@honeysworldhigh.edu.ng',
    website: settings.website ?? 'www.honeysworldhigh.edu.ng',
    studentIdPrefix: settings.studentIdPrefix ?? 'HWHS',
    schoolLogo: settings.schoolLogo ?? '/school-logo.png',
    academicSession: settings.academicSession ?? '2025/2026',
    currentTerm: settings.currentTerm ?? '1st Term',
    passMarkPercentage: settings.passMarkPercentage ?? 50,
    allowImmediateResultViewing: settings.allowImmediateResultViewing ?? true,
    announcementBanner: settings.announcementBanner ?? 'Welcome to Honey\'s World High School Examination Portal. 1st Term Examinations & CA Assessments are now in progress.',
    isStudentPortalActive: settings.isStudentPortalActive ?? true,
    isTeacherPortalActive: settings.isTeacherPortalActive ?? true,
    enableAiAdvisor: settings.enableAiAdvisor ?? true,
    enablePracticeCenter: settings.enablePracticeCenter ?? true,
    enableChatHub: settings.enableChatHub ?? true,
    enableLessonGenerator: settings.enableLessonGenerator ?? true,
    caWeights: resolveCaWeights(settings.caWeights),
    gradingScale: settings.gradingScale
  });

  const lastSyncedUpdatedAtRef = useRef<string | undefined>(settings.updatedAt);
  const [logoProcessing, setLogoProcessing] = useState(false);

  useEffect(() => {
    if (settings.updatedAt && settings.updatedAt === lastSyncedUpdatedAtRef.current) {
      return;
    }
    lastSyncedUpdatedAtRef.current = settings.updatedAt;
    setForm(prev => ({
      ...prev,
      ...settings,
      caWeights: resolveCaWeights(settings.caWeights)
    }));
  }, [settings]);

  const [saving, setSaving] = useState(false);

  const persistSettings = async (nextSettings: SchoolSettings, successMsg: string) => {
    if (!nextSettings.schoolName.trim()) {
      showNotification('School Name cannot be empty.', 'error');
      return;
    }

    const logoStr = (nextSettings.schoolLogo || '').trim();
    if (logoStr.length > 480000) {
      showNotification('Logo image is too large for database sync. Please upload a smaller image or compress it.', 'error');
      return;
    }

    const payload: SchoolSettings = {
      ...nextSettings,
      schoolLogo: logoStr || '/school-logo.png'
    };

    setSaving(true);
    try {
      await saveSchoolSettings(payload);
      lastSyncedUpdatedAtRef.current = payload.updatedAt;
      setForm(payload);
      onSettingsUpdated(payload);
      showNotification(successMsg);
    } catch (err: any) {
      showNotification(err.message || 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistSettings(
      form,
      'Institutional identity, logo, and system policies updated across the app and all result slips!'
    );
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoProcessing(true);
    try {
      const compressedDataUrl = await compressLogoFile(file, 320, 220000);
      const nextForm: SchoolSettings = { ...form, schoolLogo: compressedDataUrl };
      setForm(nextForm);
      await persistSettings(
        nextForm,
        'New school logo uploaded and published as both the App Logo and Result Slip Crest!'
      );
    } catch (err: any) {
      showNotification(err?.message || 'Could not process selected logo image.', 'error');
    } finally {
      setLogoProcessing(false);
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
                Examination Officer
              </label>
              <input
                type="text"
                placeholder="Mr. O. P. Balogun (M.Sc, Exam Officer)"
                value={form.examOfficerName || ''}
                onChange={(e) => setForm({ ...form, examOfficerName: e.target.value })}
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

            {/* School Crest & App Logo CMS */}
            <div className="md:col-span-2 p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center space-y-1">
                    <div className="w-16 h-16 rounded-full border-2 border-amber-400 bg-white p-1 flex items-center justify-center shadow-xs overflow-hidden">
                      <img
                        src={form.schoolLogo?.trim() || '/school-logo.png'}
                        alt="App Header Logo Preview"
                        className="w-full h-full object-contain rounded-full"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.fallbackApplied) {
                            img.dataset.fallbackApplied = '1';
                            img.src = '/school-logo.png';
                          }
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-bold uppercase text-slate-500 block">App Logo</span>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="w-16 h-16 rounded-xl border border-slate-300 bg-white p-1 flex items-center justify-center shadow-xs overflow-hidden">
                      <img
                        src={form.schoolLogo?.trim() || '/school-logo.png'}
                        alt="Result Slip Crest Preview"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.fallbackApplied) {
                            img.dataset.fallbackApplied = '1';
                            img.src = '/school-logo.png';
                          }
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-bold uppercase text-slate-500 block">Result Crest</span>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-bold text-slate-900">
                      School Crest & Official App Logo
                    </label>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Synced to App Header, Login Gates, Tab Icon & Result Slips
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={form.schoolLogo ?? ''}
                      onChange={(e) => setForm(prev => ({ ...prev, schoolLogo: e.target.value }))}
                      className="flex-1 min-w-[180px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      placeholder="Paste image URL or upload PNG/JPG/WebP logo..."
                    />
                    <label className={`px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer shrink-0 flex items-center gap-1.5 ${logoProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>{logoProcessing ? 'Optimizing...' : 'Upload & Publish Logo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={saving || logoProcessing}
                      onClick={() => persistSettings(form, 'School logo updated across the app and all result slips!')}
                      className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      Apply URL
                    </button>
                    <button
                      type="button"
                      disabled={saving || logoProcessing}
                      onClick={() => {
                        const resetForm = { ...form, schoolLogo: '/school-logo.png' };
                        setForm(resetForm);
                        persistSettings(resetForm, 'School logo reset to default emblem.');
                      }}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer shrink-0 flex items-center gap-1"
                      title="Reset to default school crest"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Uploads are automatically resized & compressed to stay fast. Updates apply immediately to the app header, login screens, browser icon, result slips, transcripts, and broadsheet printouts.
                  </span>
                </div>
              </div>
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

        {/* Section 2: Official Result Slip Formatting (WordPress Style CMS) */}
        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <School className="w-4 h-4 text-emerald-600" />
            <span>2. Official Result Slip Titles & Security Notice (CMS)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Result Slip Header Title
              </label>
              <input
                type="text"
                value={form.resultTitle || ''}
                onChange={(e) => setForm({ ...form, resultTitle: e.target.value })}
                placeholder="OFFICIAL CONTINUOUS ASSESSMENT & CBT EXAMINATION REPORT"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Result Slip Subtitle / Location Heading
              </label>
              <input
                type="text"
                value={form.resultSubtitle || ''}
                onChange={(e) => setForm({ ...form, resultSubtitle: e.target.value })}
                placeholder="HONEY'S WORLD HIGH SCHOOL · ILORIN, KWARA STATE"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Security Notice on Result Slips
              </label>
              <input
                type="text"
                value={form.securityNotice || ''}
                onChange={(e) => setForm({ ...form, securityNotice: e.target.value })}
                placeholder="Any alteration on this official slip renders it null and void."
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
                <div className="font-bold text-xs text-slate-900">Campus Chat & Instant Messaging</div>
                <div className="text-[11px] text-slate-500">Enable staff rooms, class cohorts, and peer-to-peer messaging</div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, enableChatHub: !form.enableChatHub })}
                className="cursor-pointer"
              >
                {form.enableChatHub ? (
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
                <div className="font-bold text-xs text-slate-900">AI Lesson Notes Studio for Teachers</div>
                <div className="text-[11px] text-slate-500">Curriculum-aligned scheme of work & secondary school lesson generator</div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, enableLessonGenerator: !form.enableLessonGenerator })}
                className="cursor-pointer"
              >
                {form.enableLessonGenerator ? (
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
