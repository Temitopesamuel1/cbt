import React, { useState } from 'react';
import {
  User,
  GraduationCap,
  BookOpen,
  Lock,
  KeyRound,
  Mail,
  Phone,
  Camera,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldCheck,
  Award,
  Sparkles,
  School,
  FileText,
  Check
} from 'lucide-react';
import { StaffMember } from '../../types/cbt';
import { updateTeacherProfile } from '../../services/firebase';

interface TeacherProfileSectionProps {
  teacherStaff?: StaffMember | null;
  onProfileUpdated: (updated: StaffMember) => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=256',
  'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&q=80&w=256',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=256'
];

export const TeacherProfileSection: React.FC<TeacherProfileSectionProps> = ({
  teacherStaff,
  onProfileUpdated
}) => {
  // Profile form state
  const [fullName, setFullName] = useState(teacherStaff?.fullName || '');
  const [qualification, setQualification] = useState(teacherStaff?.qualification || '');
  const [courseOfStudy, setCourseOfStudy] = useState(teacherStaff?.courseOfStudy || '');
  const [phoneNumber, setPhoneNumber] = useState(teacherStaff?.phoneNumber || '');
  const [avatarUrl, setAvatarUrl] = useState(teacherStaff?.avatarUrl || '');
  const [bio, setBio] = useState(teacherStaff?.bio || '');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Status
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!teacherStaff) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500 text-xs">
        No active faculty session detected. Please log in with your Staff ID.
      </div>
    );
  }

  const hasExistingPassword = Boolean(teacherStaff.password && teacherStaff.password.trim().length > 0);

  // Save profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setProfileMessage({ text: 'Full Name cannot be empty.', type: 'error' });
      return;
    }

    setIsSavingProfile(true);
    setProfileMessage(null);

    try {
      const updates: Partial<StaffMember> = {
        fullName: fullName.trim(),
        qualification: qualification.trim(),
        courseOfStudy: courseOfStudy.trim(),
        phoneNumber: phoneNumber.trim(),
        avatarUrl: avatarUrl.trim(),
        bio: bio.trim()
      };

      const updated = await updateTeacherProfile(teacherStaff.id, updates);
      const combined = { ...teacherStaff, ...updated, ...updates };

      // Update in sessionStorage
      try {
        sessionStorage.setItem('prime_edutech_active_teacher', JSON.stringify(combined));
      } catch {}

      onProfileUpdated(combined);
      setProfileMessage({ text: 'Teacher profile details updated successfully!', type: 'success' });
    } catch (err) {
      console.error('Error updating profile:', err);
      setProfileMessage({ text: 'Failed to update profile to database.', type: 'error' });
    } finally {
      setIsSavingProfile(false);
      setTimeout(() => setProfileMessage(null), 4000);
    }
  };

  // Save/reset password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (hasExistingPassword) {
      if (!currentPassword.trim()) {
        setPasswordError('Please provide your current security password.');
        return;
      }
      if (currentPassword.trim() !== teacherStaff.password) {
        setPasswordError('The current password you entered is incorrect.');
        return;
      }
    }

    if (!newPassword || newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation password do not match.');
      return;
    }

    setIsSavingPassword(true);

    try {
      const updates: Partial<StaffMember> = {
        password: newPassword.trim()
      };

      const updated = await updateTeacherProfile(teacherStaff.id, updates);
      const combined = { ...teacherStaff, ...updated, ...updates };

      try {
        sessionStorage.setItem('prime_edutech_active_teacher', JSON.stringify(combined));
      } catch {}

      onProfileUpdated(combined);
      setPasswordSuccess(
        `Password updated successfully! From your next login, use your unique Staff ID (${teacherStaff.uniqueId}) and this password.`
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Error updating password:', err);
      setPasswordError('Failed to save new password. Please check your network.');
    } finally {
      setIsSavingPassword(false);
      setTimeout(() => setPasswordSuccess(null), 6000);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-900 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-slate-900 text-amber-400 font-black text-2xl flex items-center justify-center border-2 border-slate-800 shadow-md">
                  {fullName.charAt(0)}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center border-2 border-white shadow-xs">
                <Check className="w-3.5 h-3.5" />
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">{fullName}</h2>
                <span className="text-[10px] uppercase font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {teacherStaff.role.toUpperCase()}
                </span>
                {hasExistingPassword ? (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Password Secured
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Password Not Set
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-500 font-mono mt-1 space-x-3">
                <span>Unique Staff ID: <strong className="text-slate-900 font-bold">{teacherStaff.uniqueId}</strong></span>
                <span>·</span>
                <span>Email: <strong className="text-slate-700">{teacherStaff.email}</strong></span>
              </div>

              {qualification && (
                <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                  <span>{qualification} {courseOfStudy ? `in ${courseOfStudy}` : ''}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1 w-full sm:w-auto">
            <div className="text-[10px] uppercase font-bold text-slate-400">Assigned Curriculum Scope</div>
            <div className="font-bold text-blue-900">{teacherStaff.assignedSubjectNames.join(', ')}</div>
            <div className="text-[11px] text-slate-500">Classes: {teacherStaff.assignedClasses.join(', ')}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Details Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-900" />
                <span>Academic & Professional Profile</span>
              </h3>
              <p className="text-xs text-slate-500">
                Complete your instructor credentials, degree qualifications, and course of study
              </p>
            </div>
          </div>

          {profileMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                profileMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {profileMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{profileMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Full Name</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Unique Staff ID</span>
                </label>
                <input
                  type="text"
                  disabled
                  value={teacherStaff.uniqueId}
                  className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-600 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400">Institutional ID allocated by Administration</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-slate-400" />
                  <span>Highest Academic Qualification</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. B.Sc. (Ed) Computer Science, PGDE, M.Ed"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  <span>Course of Study / Discipline</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science Education, Pure Mathematics"
                  value={courseOfStudy}
                  onChange={(e) => setCourseOfStudy(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Phone Number</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. +234 803 123 4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-slate-400" />
                  <span>Profile Photo URL</span>
                </label>
                <input
                  type="url"
                  placeholder="https://... or choose preset below"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                />
              </div>
            </div>

            {/* Quick Preset Avatars */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                Choose Faculty Avatar Preset:
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_AVATARS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all ${
                      avatarUrl === url ? 'border-blue-900 scale-105 shadow-md' : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <img src={url} alt={`Preset ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="text-[10px] text-slate-500 hover:text-rose-600 underline ml-2"
                  >
                    Clear Photo
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Professional Biography & Teaching Specialization</span>
              </label>
              <textarea
                rows={3}
                placeholder="Brief summary of teaching philosophy, subject specialization, and academic background..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 leading-relaxed"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-amber-400" />
                <span>{isSavingProfile ? 'Saving Details...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Password Management */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" />
              <span>Password & Security</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Set or reset your teacher password for secure access
            </p>
          </div>

          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1.5 text-blue-900">
            <div className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-700" />
              <span>Login Credentials Notice:</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Once you set your password, your faculty login will strictly require both your{' '}
              <strong className="font-mono">{teacherStaff.uniqueId}</strong> and your password.
            </p>
          </div>

          {passwordError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSavePassword} className="space-y-4">
            {hasExistingPassword && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Current Password</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter your current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                <span>{hasExistingPassword ? 'New Password' : 'Set Your Password'}</span>
              </label>
              <input
                type="password"
                required
                placeholder="Minimum 4 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-slate-400" />
                <span>Confirm New Password</span>
              </label>
              <input
                type="password"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingPassword}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {isSavingPassword
                    ? 'Updating Password...'
                    : hasExistingPassword
                    ? 'Reset & Update Password'
                    : 'Set My Login Password'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
