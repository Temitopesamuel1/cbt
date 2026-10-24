import React, { useState } from 'react';
import {
  User,
  Hash,
  School,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  Camera,
  Upload,
  Mail,
  KeyRound,
  Lock,
  Copy,
  Check,
  Sparkles,
  Phone,
  MapPin,
  Save,
  AlertCircle
} from 'lucide-react';
import { Student } from '../../types/cbt';
import { updateStudentProfile } from '../../services/firebase';

interface StudentProfileViewProps {
  student: Student;
  onBackToDashboard: () => void;
  onProfileUpdated?: (updatedStudent: Student) => void;
}

// Preset Academic Avatar portraits for students
const PRESET_PASSPORTS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=256&h=256&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=256&h=256&fit=crop&crop=face'
];

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  student,
  onBackToDashboard,
  onProfileUpdated
}) => {
  // Profile editable fields
  const [firstName, setFirstName] = useState(student.firstName || '');
  const [surname, setSurname] = useState(student.surname || '');
  const [email, setEmail] = useState(student.email || '');
  const [phoneNumber, setPhoneNumber] = useState(student.phoneNumber || '');
  const [dateOfBirth, setDateOfBirth] = useState(student.dateOfBirth || '');
  const [stateOfOrigin, setStateOfOrigin] = useState(student.stateOfOrigin || '');
  const [department, setDepartment] = useState(student.department || 'Science & Technology');
  const [bio, setBio] = useState(student.bio || '');
  const [passportUrl, setPassportUrl] = useState(student.passportUrl || '');

  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // General state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAdm, setCopiedAdm] = useState(false);

  // File upload handler for custom passport
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Passport image must be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPassportUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCopy = (text: string, type: 'code' | 'adm') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedAdm(true);
      setTimeout(() => setCopiedAdm(false), 2000);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    const fullName = `${firstName.trim()} ${surname.trim()}`;
    const updates: Partial<Student> = {
      firstName: firstName.trim(),
      surname: surname.trim(),
      fullName,
      email: email.trim(),
      phoneNumber: phoneNumber.trim(),
      dateOfBirth,
      stateOfOrigin: stateOfOrigin.trim(),
      department,
      bio: bio.trim(),
      passportUrl
    };

    try {
      await updateStudentProfile(student.id, updates);
      const mergedStudent: Student = { ...student, ...updates };

      // Update sessionStorage
      try {
        sessionStorage.setItem('prime_edutech_active_student', JSON.stringify(mergedStudent));
      } catch {}

      if (onProfileUpdated) {
        onProfileUpdated(mergedStudent);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.warn('Profile update error:', err);
      alert('Unable to update profile. Please verify your connection.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match. Please re-type carefully.');
      return;
    }

    setSaving(true);
    try {
      await updateStudentProfile(student.id, { password: newPassword });
      const mergedStudent: Student = { ...student, password: newPassword };

      try {
        sessionStorage.setItem('prime_edutech_active_student', JSON.stringify(mergedStudent));
      } catch {}

      if (onProfileUpdated) {
        onProfileUpdated(mergedStudent);
      }

      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err) {
      console.warn('Password reset error:', err);
      setPasswordError('Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-2">
        <button
          onClick={onBackToDashboard}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Student Portal</span>
        </button>

        <span className="text-xs font-mono font-bold text-slate-500">
          SIS Record: #{student.admissionNumber}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Passport & Credentials Summary */}
        <div className="space-y-6">
          {/* Passport & Identity Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center space-y-4">
            <div className="relative inline-block mx-auto">
              {passportUrl ? (
                <img
                  src={passportUrl}
                  alt={student.fullName}
                  className="w-28 h-28 rounded-2xl object-cover border-4 border-white shadow-md mx-auto"
                />
              ) : (
                <div className="w-28 h-28 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-black text-3xl shadow-inner border-4 border-white mx-auto">
                  {student.firstName.charAt(0)}{student.surname.charAt(0)}
                </div>
              )}

              <label
                htmlFor="passport-upload"
                className="absolute -bottom-2 -right-2 p-2 bg-blue-900 text-white rounded-xl shadow-md hover:bg-blue-950 transition-colors cursor-pointer border-2 border-white"
                title="Upload custom passport"
              >
                <Camera className="w-4 h-4" />
                <input
                  id="passport-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <h2 className="text-lg font-black text-slate-900">{student.fullName}</h2>
              <span className="text-xs text-blue-900 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 mt-1 inline-block">
                {student.classGrade} Cohort
              </span>
            </div>

            {/* Passport preset selector */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                Or Select Academic Preset
              </span>
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {PRESET_PASSPORTS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPassportUrl(url)}
                    className={`w-9 h-9 rounded-lg overflow-hidden border-2 transition-transform hover:scale-105 ${
                      passportUrl === url ? 'border-blue-900 ring-2 ring-blue-900/20' : 'border-slate-200'
                    }`}
                  >
                    <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Login Credentials & Security Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <KeyRound className="w-4 h-4 text-blue-900" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Official Login Credentials
              </h3>
            </div>

            <div className="space-y-3">
              {/* Unique Passcode */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Unique Student Passcode
                  </span>
                  <strong className="text-base font-black font-mono text-blue-950">
                    {student.accessCode || student.admissionNumber}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(student.accessCode || student.admissionNumber, 'code')}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Matric / Admission Number */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Matric / Admission Number
                  </span>
                  <strong className="text-sm font-black font-mono text-slate-900">
                    {student.admissionNumber}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(student.admissionNumber, 'adm')}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  {copiedAdm ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAdm ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 leading-relaxed">
                <strong>Multi-Credential Access:</strong> You can log into the student portal using your <strong>Unique Passcode</strong>, your <strong>Admission Number</strong>, or your <strong>Connected Email & Password</strong>.
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns: Personal Profile Form & Password Reset */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Profile Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">Institutional Profile Details</h3>
                <p className="text-xs text-slate-500">
                  Update your contact details, department, and biographical data on the university SIS ledger.
                </p>
              </div>

              {saveSuccess && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Profile Saved Successfully!
                </span>
              )}
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Surname
                  </label>
                  <input
                    type="text"
                    required
                    value={surname}
                    onChange={e => setSurname(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              </div>

              {/* Connected Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Connected Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      placeholder="e.g. student@school.edu.ng"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Use this email with your password to log into your account.
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      placeholder="+234 800 000 0000"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>
              </div>

              {/* Department & State of Origin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Department / Academic Stream
                  </label>
                  <select
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white"
                  >
                    <option value="Science & Technology">Science & Technology</option>
                    <option value="Commercial Studies">Commercial Studies</option>
                    <option value="Arts & Humanities">Arts & Humanities</option>
                    <option value="General Studies">General Studies</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    State of Origin
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="e.g. Lagos, Oyo, Ogun, Rivers"
                      value={stateOfOrigin}
                      onChange={e => setStateOfOrigin(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>
              </div>

              {/* Date of Birth */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Class Cohort (Registry Enforced)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={student.classGrade}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 text-sm font-bold cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Biographical Note / Academic Ambition */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Academic Ambition & Career Interests
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Aspiring Software Engineer, Medical Doctor, or Chartered Accountant."
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Password Reset / Setup Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Lock className="w-4 h-4 text-blue-900" />
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Set or Reset Personal Password
                </h3>
                <p className="text-xs text-slate-500">
                  Secure your account with a custom password for logging in via Connected Email or Admission Number.
                </p>
              </div>
            </div>

            {passwordSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Your personal password has been updated! Use it for future logins.</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    New Security Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={saving || !newPassword}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
