import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  GraduationCap,
  BookOpen,
  School,
  Settings,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  Download,
  Upload,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  FileSpreadsheet,
  BarChart3,
  LogOut,
  RefreshCw,
  Award,
  Sparkles,
  ShieldCheck,
  Sliders,
  CheckSquare
} from 'lucide-react';
import {
  StaffMember,
  Student,
  SchoolClass,
  Subject,
  SchoolSettings,
  Examination,
  Submission,
  AdminUser,
  generateStaffUniqueId,
  generateStudentAccessCode
} from '../../types/cbt';
import {
  fetchStaffMembers,
  saveStaffMember,
  deleteStaffMember,
  fetchStudents,
  saveStudent,
  deleteStudent,
  fetchSchoolClasses,
  fetchSubjects,
  fetchSchoolSettings,
  saveSchoolSettings,
  fetchExaminations,
  fetchSubmissions,
  fetchAdmins
} from '../../services/firebase';
import { StaffSlipsModal } from './StaffSlipsModal';
import { StudentSlipsModal } from '../teacher/StudentSlipsModal';
import { StudentBatchUploadModal } from '../teacher/StudentBatchUploadModal';
import { AdminUserManagementTab } from './AdminUserManagementTab';
import { AdminBrandAndPoliciesTab } from './AdminBrandAndPoliciesTab';
import { AdminGradingScaleTab } from './AdminGradingScaleTab';
import { AdminCurriculumTab } from './AdminCurriculumTab';
import { AdminExamsTab } from './AdminExamsTab';
import { AdminBroadsheetTab } from './AdminBroadsheetTab';
import { AdminSubmissionsTab } from './AdminSubmissionsTab';

interface AdminPortalProps {
  adminEmail: string;
  onLogout: () => void;
  onGoToHome: () => void;
}

export type AdminTabType =
  | 'admins'
  | 'brand'
  | 'grading'
  | 'curriculum'
  | 'staff'
  | 'students'
  | 'exams'
  | 'broadsheet'
  | 'submissions';

export const AdminPortal: React.FC<AdminPortalProps> = ({
  adminEmail,
  onLogout,
  onGoToHome
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<AdminTabType>('admins');

  // Core Institutional Data
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Examination[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: "Honey's World High School",
    address: 'Gaa Ajanaku, Ilorin, Kwara State',
    location: 'Ilorin, Kwara State, Nigeria',
    motto: 'Knowledge, Character & Academic Excellence',
    academicSession: '2025/2026',
    currentTerm: '1st Term',
    passMarkPercentage: 50,
    allowImmediateResultViewing: true
  });

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Staff and Student Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showStaffSlipsModal, setShowStaffSlipsModal] = useState(false);

  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showBatchStudentModal, setShowBatchStudentModal] = useState(false);
  const [showStudentSlipsModal, setShowStudentSlipsModal] = useState(false);

  // Search & Filters for staff & student subtabs
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('All');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Staff Form
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    email: '',
    uniqueId: '',
    role: 'teacher' as 'teacher' | 'hod',
    status: 'active' as 'active' | 'suspended',
    qualification: '',
    courseOfStudy: '',
    phoneNumber: '',
    password: '',
    assignedSubjectIds: [] as string[],
    assignedClasses: [] as string[]
  });

  // Student Form
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    surname: '',
    admissionNumber: '',
    classGrade: 'SS 1',
    accessCode: '',
    academicSession: '2025/2026',
    email: '',
    password: ''
  });

  // Load all institutional data
  const loadData = async () => {
    setLoading(true);
    try {
      const [adm, st, stu, cls, subs, ex, subms, sett] = await Promise.all([
        fetchAdmins(),
        fetchStaffMembers(),
        fetchStudents(),
        fetchSchoolClasses(),
        fetchSubjects(),
        fetchExaminations(false),
        fetchSubmissions(),
        fetchSchoolSettings()
      ]);

      if (adm) setAdmins(adm);
      if (st) setStaffList(st);
      if (stu) setStudents(stu);
      if (cls) setClasses(cls);
      if (subs) setSubjects(subs);
      if (ex) setExams(ex);
      if (subms) setSubmissions(subms);
      if (sett) setSettings(sett);
    } catch (err) {
      console.warn('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Staff Actions
  const handleOpenAddStaff = () => {
    const existing = staffList.map(s => s.uniqueId);
    setStaffForm({
      fullName: '',
      email: '',
      uniqueId: generateStaffUniqueId(existing),
      role: 'teacher',
      status: 'active',
      qualification: 'B.Sc (Ed)',
      courseOfStudy: '',
      phoneNumber: '',
      password: '',
      assignedSubjectIds: subjects.length > 0 ? [subjects[0].id] : [],
      assignedClasses: classes.length > 0 ? [classes[0].code] : ['SS 1']
    });
    setEditingStaff(null);
    setShowAddStaffModal(true);
  };

  const handleOpenEditStaff = (staff: StaffMember) => {
    setEditingStaff(staff);
    setStaffForm({
      fullName: staff.fullName,
      email: staff.email,
      uniqueId: staff.uniqueId,
      role: staff.role,
      status: staff.status,
      qualification: staff.qualification || '',
      courseOfStudy: staff.courseOfStudy || '',
      phoneNumber: staff.phoneNumber || '',
      password: staff.password || '',
      assignedSubjectIds: staff.assignedSubjectIds || [],
      assignedClasses: staff.assignedClasses || []
    });
    setShowAddStaffModal(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.fullName.trim() || !staffForm.email.trim()) {
      showNotification('Please fill in Staff Name and Email', 'error');
      return;
    }

    const assignedNames = subjects
      .filter(s => staffForm.assignedSubjectIds.includes(s.id))
      .map(s => s.name);

    const staffId = editingStaff ? editingStaff.id : `staff_${Date.now()}`;
    const newStaff: StaffMember = {
      id: staffId,
      uniqueId: staffForm.uniqueId.trim().toUpperCase() || generateStaffUniqueId(),
      fullName: staffForm.fullName.trim(),
      email: staffForm.email.trim().toLowerCase(),
      assignedSubjectIds: staffForm.assignedSubjectIds,
      assignedSubjectNames: assignedNames.length > 0 ? assignedNames : ['General Subject'],
      assignedClasses: staffForm.assignedClasses,
      role: staffForm.role,
      status: staffForm.status,
      qualification: staffForm.qualification.trim(),
      courseOfStudy: staffForm.courseOfStudy.trim(),
      phoneNumber: staffForm.phoneNumber.trim(),
      password: staffForm.password.trim() || undefined,
      createdAt: editingStaff ? editingStaff.createdAt : new Date().toISOString()
    };

    try {
      await saveStaffMember(newStaff);
      setStaffList(prev => {
        const filtered = prev.filter(s => s.id !== staffId);
        return [newStaff, ...filtered];
      });
      setShowAddStaffModal(false);
      showNotification(`Staff Member ${newStaff.fullName} saved with Unique ID ${newStaff.uniqueId}!`);
    } catch (err) {
      console.error('Error saving staff:', err);
      showNotification('Could not save staff member to database', 'error');
    }
  };

  const handleDeleteStaff = async (staff: StaffMember) => {
    if (confirm(`Are you sure you want to delete staff member "${staff.fullName}" (${staff.uniqueId})?`)) {
      try {
        await deleteStaffMember(staff.id);
        setStaffList(prev => prev.filter(s => s.id !== staff.id));
        showNotification(`Staff member "${staff.fullName}" was removed from database.`);
      } catch (err) {
        showNotification('Failed to delete staff member', 'error');
      }
    }
  };

  // Student Actions
  const handleOpenAddStudent = () => {
    const existing = students.map(s => s.accessCode || '');
    const nextIdx = students.length + 1;
    const yr = new Date().getFullYear();
    const prefix = settings.studentIdPrefix || 'HWHS';

    setStudentForm({
      firstName: '',
      surname: '',
      admissionNumber: `${prefix}/${yr}/${String(nextIdx).padStart(3, '0')}`,
      classGrade: classes[0]?.code || 'SS 1',
      accessCode: generateStudentAccessCode(existing),
      academicSession: settings.academicSession,
      email: '',
      password: ''
    });
    setEditingStudent(null);
    setShowAddStudentModal(true);
  };

  const handleOpenEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentForm({
      firstName: student.firstName,
      surname: student.surname,
      admissionNumber: student.admissionNumber,
      classGrade: student.classGrade,
      accessCode: student.accessCode || '',
      academicSession: student.academicSession || settings.academicSession,
      email: student.email || '',
      password: student.password || ''
    });
    setShowAddStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.firstName.trim() || !studentForm.surname.trim() || !studentForm.admissionNumber.trim()) {
      showNotification('Please enter student First Name, Surname, and Admission Number', 'error');
      return;
    }

    const studentId = editingStudent ? editingStudent.id : `stu_${Date.now()}`;
    const code = studentForm.accessCode.trim().toUpperCase() || generateStudentAccessCode();

    const newStudent: Student = {
      id: studentId,
      admissionNumber: studentForm.admissionNumber.trim().toUpperCase(),
      firstName: studentForm.firstName.trim(),
      surname: studentForm.surname.trim(),
      fullName: `${studentForm.firstName.trim()} ${studentForm.surname.trim()}`,
      classGrade: studentForm.classGrade.trim(),
      academicSession: studentForm.academicSession,
      status: 'active',
      email: studentForm.email.trim().toLowerCase() || undefined,
      password: studentForm.password.trim() || undefined,
      registeredAt: editingStudent ? editingStudent.registeredAt : new Date().toISOString(),
      accessCode: code
    };

    try {
      await saveStudent(newStudent);
      setStudents(prev => {
        const filtered = prev.filter(s => s.id !== studentId);
        return [newStudent, ...filtered];
      });
      setShowAddStudentModal(false);
      showNotification(`Student ${newStudent.fullName} saved with Admission No ${newStudent.admissionNumber}!`);
    } catch (err) {
      console.error('Error saving student:', err);
      showNotification('Could not save student to database', 'error');
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (confirm(`Delete student "${student.fullName}" (${student.admissionNumber})?`)) {
      try {
        await deleteStudent(student.id);
        setStudents(prev => prev.filter(s => s.id !== student.id));
        showNotification(`Student "${student.fullName}" deleted.`);
      } catch (err) {
        showNotification('Failed to delete student', 'error');
      }
    }
  };

  // Filtered staff list
  const filteredStaff = staffList.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.uniqueId.toLowerCase().includes(q) ||
      s.assignedSubjectNames.some(sub => sub.toLowerCase().includes(q))
    );
  });

  // Filtered student list
  const filteredStudents = students.filter(s => {
    const matchesClass = selectedClassFilter === 'All' || s.classGrade === selectedClassFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      s.fullName.toLowerCase().includes(q) ||
      s.admissionNumber.toLowerCase().includes(q) ||
      (s.accessCode && s.accessCode.toLowerCase().includes(q));
    return matchesClass && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Admin Security Crest Bar */}
      <div className="bg-slate-900 text-white border-b border-amber-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-wide text-white uppercase">
                  {settings.schoolName || "HONEY'S WORLD HIGH SCHOOL"}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                  Total Admin Control
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Institutional Administration & Multi-Admin Console · <span className="text-amber-300 font-mono">{adminEmail}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Refresh Institutional Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onGoToHome}
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Exit to Home
            </button>
            <button
              onClick={onLogout}
              className="text-xs font-bold text-rose-400 hover:text-white px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout Admin</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Status Notification */}
      {statusMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        </div>
      )}

      {/* Institutional KPI Metrics Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Admins</span>
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">{admins.length}</div>
            <div className="text-[10px] text-amber-600 font-semibold mt-0.5">Authorized Accounts</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-900" />
              <span>Faculty</span>
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">{staffList.length}</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Active Teachers</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-700" />
              <span>Students</span>
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">{students.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{classes.length} Classes</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>Curriculum</span>
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">{subjects.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">School Subjects</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-purple-700" />
              <span>Examinations</span>
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">{exams.length}</div>
            <div className="text-[10px] text-purple-600 font-semibold mt-0.5">{submissions.length} Submissions</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-teal-700" />
              <span>Active Term</span>
            </div>
            <div className="text-sm font-black text-slate-900 mt-1 truncate">{settings.currentTerm}</div>
            <div className="text-[10px] font-mono text-slate-500 truncate">{settings.academicSession}</div>
          </div>
        </div>
      </div>

      {/* Main Admin Tabbed Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab('admins')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'admins'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admins Authority ({admins.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('brand')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'brand'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <School className="w-3.5 h-3.5 text-blue-400" />
            <span>School Identity & Brand</span>
          </button>

          <button
            onClick={() => setActiveTab('grading')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'grading'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>CA Weights & Grading Scale</span>
          </button>

          <button
            onClick={() => setActiveTab('curriculum')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'curriculum'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-teal-400" />
            <span>Classes & Subjects</span>
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Faculty Staff ({staffList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'students'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Students ({students.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('exams')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'exams'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
            <span>Examinations ({exams.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('broadsheet')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'broadsheet'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
            <span>CA Broadsheet Master</span>
          </button>

          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'submissions'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>CBT Submissions ({submissions.length})</span>
          </button>
        </div>
      </div>

      {/* Main Tab Panels */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* TAB 1: ADMINISTRATORS AUTHORITY */}
        {activeTab === 'admins' && (
          <AdminUserManagementTab
            currentAdminEmail={adminEmail}
            admins={admins}
            onAdminsUpdated={loadData}
            showNotification={showNotification}
          />
        )}

        {/* TAB 2: SCHOOL BRANDING & POLICIES */}
        {activeTab === 'brand' && (
          <AdminBrandAndPoliciesTab
            settings={settings}
            onSettingsUpdated={(updated) => setSettings(updated)}
            showNotification={showNotification}
          />
        )}

        {/* TAB 3: CA WEIGHTS & GRADING SCALE */}
        {activeTab === 'grading' && (
          <AdminGradingScaleTab
            settings={settings}
            onSettingsUpdated={(updated) => setSettings(updated)}
            showNotification={showNotification}
          />
        )}

        {/* TAB 4: CURRICULUM (CLASSES & SUBJECTS) */}
        {activeTab === 'curriculum' && (
          <AdminCurriculumTab
            classes={classes}
            subjects={subjects}
            academicSession={settings.academicSession}
            onCurriculumUpdated={loadData}
            showNotification={showNotification}
          />
        )}

        {/* TAB 5: FACULTY STAFF MANAGEMENT */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200 uppercase tracking-wide mb-1">
                    <ShieldAlert className="w-3 h-3 text-amber-600" />
                    <span>Admin Authority</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900">Faculty Staff Management</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Register teachers, generate unique Staff IDs, assign curriculum subjects and classes, and control login status.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => setShowStaffSlipsModal(true)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Print Credential Slips</span>
                  </button>
                  <button
                    onClick={handleOpenAddStaff}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>Add Faculty Staff</span>
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="mt-6 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search faculty by name, email, subject, or Unique ID (e.g. TCH-1001)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Staff Table */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3 px-4">Faculty Member</th>
                      <th className="py-3 px-4">Unique Login ID</th>
                      <th className="py-3 px-4">Assigned Subjects</th>
                      <th className="py-3 px-4">Assigned Classes</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No faculty staff members found. Click "Add Faculty Staff" above.
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map((staff) => (
                        <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <div>{staff.fullName}</div>
                            <div className="text-[11px] text-slate-400 font-mono font-normal">{staff.email}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="inline-flex items-center gap-1.5 bg-slate-900 text-amber-300 font-mono font-black text-xs px-2.5 py-1 rounded-lg shadow-xs border border-slate-800">
                              <span>{staff.uniqueId}</span>
                              <button
                                onClick={() => handleCopy(staff.uniqueId)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                                title="Copy Unique ID"
                              >
                                {copiedCode === staff.uniqueId ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {staff.assignedSubjectNames.map((subj, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-semibold bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded"
                                >
                                  {subj}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {staff.assignedClasses.map((cls, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                                >
                                  {cls}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 uppercase font-bold text-[11px] text-slate-600">
                            {staff.role}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                                staff.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {staff.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditStaff(staff)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit Staff"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(staff)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Staff"
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
          </div>
        )}

        {/* TAB 6: STUDENTS MANAGEMENT */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Student Directory & Unique Passcodes</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enroll students, assign admission numbers, issue login passcodes, and monitor cohort registrations.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => setShowStudentSlipsModal(true)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Print Student Slips</span>
                  </button>
                  <button
                    onClick={() => setShowBatchStudentModal(true)}
                    className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-700" />
                    <span>Batch CSV Upload</span>
                  </button>
                  <button
                    onClick={handleOpenAddStudent}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>Enroll Student</span>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by student full name, admission number, or passcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 cursor-pointer"
                  >
                    <option value="All">All Classes ({students.length})</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.code}>{c.code} ({students.filter(s => s.classGrade === c.code).length})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Students Table */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3 px-4">Student Full Name</th>
                      <th className="py-3 px-4">Unique Login Passcode</th>
                      <th className="py-3 px-4">Admission Number</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Session</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No students found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((stu) => (
                        <tr key={stu.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <div>{stu.fullName}</div>
                            {stu.email && <div className="text-[10px] text-slate-400 font-mono">{stu.email}</div>}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="inline-flex items-center gap-1.5 bg-blue-950 text-blue-300 font-mono font-black text-xs px-2.5 py-1 rounded-lg border border-blue-800">
                              <span>{stu.accessCode || stu.admissionNumber}</span>
                              <button
                                onClick={() => handleCopy(stu.accessCode || stu.admissionNumber)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                                title="Copy Student Code"
                              >
                                {copiedCode === (stu.accessCode || stu.admissionNumber) ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-600">
                            {stu.admissionNumber}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            {stu.classGrade}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                            {stu.academicSession || settings.academicSession}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {stu.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditStudent(stu)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit Student"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(stu)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Student"
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
          </div>
        )}

        {/* TAB 7: EXAMINATIONS & QUESTION BANKS */}
        {activeTab === 'exams' && (
          <AdminExamsTab
            exams={exams}
            classes={classes}
            subjects={subjects}
            academicSession={settings.academicSession}
            currentTerm={settings.currentTerm}
            onExamsUpdated={loadData}
            showNotification={showNotification}
          />
        )}

        {/* TAB 8: CONTINUOUS ASSESSMENT BROADSHEET */}
        {activeTab === 'broadsheet' && (
          <AdminBroadsheetTab
            students={students}
            subjects={subjects}
            classes={classes}
            settings={settings}
            showNotification={showNotification}
          />
        )}

        {/* TAB 9: CBT SUBMISSIONS & RETAKE RESET */}
        {activeTab === 'submissions' && (
          <AdminSubmissionsTab
            submissions={submissions}
            exams={exams}
            classes={classes}
            onSubmissionsUpdated={loadData}
            showNotification={showNotification}
          />
        )}
      </main>

      {/* Add / Edit Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  {editingStaff ? 'Edit Faculty Member' : 'Register New Faculty Member'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name (e.g. Mr. Olawale Benson)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Mr. Olawale Benson"
                  value={staffForm.fullName}
                  onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Faculty Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="benson@primeedutech.ng"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Unique Staff Login ID
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = generateStaffUniqueId(staffList.map(s => s.uniqueId));
                        setStaffForm({ ...staffForm, uniqueId: next });
                      }}
                      className="text-[10px] text-blue-900 hover:underline font-semibold cursor-pointer"
                    >
                      Regenerate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={staffForm.uniqueId}
                    onChange={(e) => setStaffForm({ ...staffForm, uniqueId: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm bg-slate-900 text-amber-300 font-mono font-black border border-slate-700 rounded-xl uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Custom Password (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Optional login password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Educational Qualification
                  </label>
                  <input
                    type="text"
                    placeholder="B.Sc (Ed), PGDE, M.Ed"
                    value={staffForm.qualification}
                    onChange={(e) => setStaffForm({ ...staffForm, qualification: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Course of Study / Discipline
                  </label>
                  <input
                    type="text"
                    placeholder="Computer Science, Mathematics"
                    value={staffForm.courseOfStudy}
                    onChange={(e) => setStaffForm({ ...staffForm, courseOfStudy: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Assigned Teaching Subjects
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {subjects.map(sub => {
                    const checked = staffForm.assignedSubjectIds.includes(sub.id);
                    return (
                      <label key={sub.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStaffForm({
                                ...staffForm,
                                assignedSubjectIds: [...staffForm.assignedSubjectIds, sub.id]
                              });
                            } else {
                              setStaffForm({
                                ...staffForm,
                                assignedSubjectIds: staffForm.assignedSubjectIds.filter(id => id !== sub.id)
                              });
                            }
                          }}
                          className="rounded text-blue-900"
                        />
                        <span className="truncate">{sub.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Assigned Classes
                </label>
                <div className="flex flex-wrap gap-2">
                  {classes.map(cls => {
                    const checked = staffForm.assignedClasses.includes(cls.code);
                    return (
                      <label
                        key={cls.id}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-blue-900 text-white border-blue-900'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStaffForm({
                                ...staffForm,
                                assignedClasses: [...staffForm.assignedClasses, cls.code]
                              });
                            } else {
                              setStaffForm({
                                ...staffForm,
                                assignedClasses: staffForm.assignedClasses.filter(c => c !== cls.code)
                              });
                            }
                          }}
                          className="sr-only"
                        />
                        <span>{cls.code}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Role / Position
                  </label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as 'teacher' | 'hod' })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold cursor-pointer"
                  >
                    <option value="teacher">Class Teacher</option>
                    <option value="hod">Head of Department (HOD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Credential Status
                  </label>
                  <select
                    value={staffForm.status}
                    onChange={(e) => setStaffForm({ ...staffForm, status: e.target.value as 'active' | 'suspended' })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold cursor-pointer"
                  >
                    <option value="active">Active (Access Allowed)</option>
                    <option value="suspended">Suspended (Access Blocked)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-slate-900 text-white rounded-xl shadow-md hover:bg-slate-800 cursor-pointer"
                >
                  {editingStaff ? 'Update Staff Member' : 'Save Faculty Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">
                  {editingStudent ? 'Edit Student Profile' : 'Enroll New Student'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Emmanuel"
                    value={studentForm.firstName}
                    onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Surname</label>
                  <input
                    type="text"
                    required
                    placeholder="Adebayo"
                    value={studentForm.surname}
                    onChange={(e) => setStudentForm({ ...studentForm, surname: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Admission Number</label>
                <input
                  type="text"
                  required
                  value={studentForm.admissionNumber}
                  onChange={(e) => setStudentForm({ ...studentForm, admissionNumber: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Class Cohort</label>
                  <select
                    value={studentForm.classGrade}
                    onChange={(e) => setStudentForm({ ...studentForm, classGrade: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 cursor-pointer"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Session</label>
                  <input
                    type="text"
                    value={studentForm.academicSession}
                    onChange={(e) => setStudentForm({ ...studentForm, academicSession: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Unique Passcode / Login Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = generateStudentAccessCode(students.map(s => s.accessCode || ''));
                      setStudentForm({ ...studentForm, accessCode: next });
                    }}
                    className="text-[10px] text-blue-900 hover:underline font-semibold cursor-pointer"
                  >
                    Regenerate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={studentForm.accessCode}
                  onChange={(e) => setStudentForm({ ...studentForm, accessCode: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-sm bg-blue-950 text-blue-300 font-mono font-black border border-blue-800 rounded-xl uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Connected Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="student@gmail.com"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Student Password (Optional)</label>
                  <input
                    type="text"
                    placeholder="Custom password"
                    value={studentForm.password}
                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-slate-900 text-white rounded-xl shadow-md hover:bg-slate-800 cursor-pointer"
                >
                  {editingStudent ? 'Update Student' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Slips Modal */}
      <StaffSlipsModal
        isOpen={showStaffSlipsModal}
        onClose={() => setShowStaffSlipsModal(false)}
        staffList={staffList}
        schoolName={settings.schoolName || "Honey's World High School"}
      />

      {/* Student Slips Modal */}
      <StudentSlipsModal
        isOpen={showStudentSlipsModal}
        onClose={() => setShowStudentSlipsModal(false)}
        students={students}
        schoolName={settings.schoolName || "Honey's World High School"}
        currentSession={settings.academicSession || '2025/2026'}
        currentTerm={settings.currentTerm || '1st Term'}
      />

      {/* Student Batch Upload Modal */}
      <StudentBatchUploadModal
        isOpen={showBatchStudentModal}
        onClose={() => setShowBatchStudentModal(false)}
        onUploadSuccess={() => {
          loadData();
          showNotification('Batch student upload processed successfully!');
        }}
        classes={classes}
        currentSession={settings.academicSession || '2025/2026'}
        existingStudents={students}
      />
    </div>
  );
};
