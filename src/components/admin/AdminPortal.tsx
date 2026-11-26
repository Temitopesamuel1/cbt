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
  CheckSquare,
  Camera,
  MessageSquare,
  Activity,
  ArrowUpRight
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
  subscribeStaffMembers,
  fetchStudents,
  saveStudent,
  deleteStudent,
  subscribeStudents,
  fetchSchoolClasses,
  subscribeSchoolClasses,
  fetchSubjects,
  saveSubject,
  subscribeSubjects,
  fetchSchoolSettings,
  saveSchoolSettings,
  subscribeSchoolSettings,
  fetchExaminations,
  subscribeExaminations,
  fetchSubmissions,
  subscribeSubmissions,
  fetchAdmins,
  subscribeAdmins,
  promoteStudentsClassBatch
} from '../../services/firebase';
import { compressImageFile } from '../../services/imageUtils';
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
import { AdminCommunicationsAuditTab } from './AdminCommunicationsAuditTab';
import { LiveExamMonitorView } from '../common/LiveExamMonitorView';

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
  | 'live-monitor'
  | 'broadsheet'
  | 'submissions'
  | 'communications';

export const AdminPortal: React.FC<AdminPortalProps> = ({
  adminEmail,
  onLogout,
  onGoToHome
}) => {
  // Navigation tabs
  const isSuperAdmin =
    adminEmail.toLowerCase() === 'fathertemitope@gmail.com' ||
    false; // will also check admins state below

  const [activeTab, setActiveTab] = useState<AdminTabType>(() => {
    return adminEmail.toLowerCase() === 'fathertemitope@gmail.com' ? 'admins' : 'brand';
  });

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
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // Staff and Student Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showStaffSlipsModal, setShowStaffSlipsModal] = useState(false);

  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showBatchStudentModal, setShowBatchStudentModal] = useState(false);
  const [showStudentSlipsModal, setShowStudentSlipsModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoSourceClass, setPromoSourceClass] = useState('SS 1');
  const [promoTargetClass, setPromoTargetClass] = useState('SS 2');
  const [promoTargetSession, setPromoTargetSession] = useState('2026/2027');
  const [promoTargetStatus, setPromoTargetStatus] = useState<'active' | 'graduated'>('active');
  const [promoSelectedIds, setPromoSelectedIds] = useState<Set<string>>(new Set());
  const [promotingBusy, setPromotingBusy] = useState(false);

  // Search & Filters for staff & student subtabs
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('All');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Staff Form
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffModalError, setStaffModalError] = useState<string | null>(null);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [quickSubjectName, setQuickSubjectName] = useState('');
  const [quickSubjectCode, setQuickSubjectCode] = useState('');
  const [addingQuickSubject, setAddingQuickSubject] = useState(false);
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
    avatarUrl: '',
    bio: '',
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
    status: 'active' as 'active' | 'suspended' | 'graduated',
    gender: '' as '' | 'Male' | 'Female',
    phoneNumber: '',
    department: '',
    email: '',
    password: '',
    passportUrl: '',
    resultWithheld: false,
    withheldReason: ''
  });

  // Load all institutional data
  const loadData = async () => {
    setLoading(true);
    try {
      const [adm, st, stu, cls, subs, ex, sett] = await Promise.all([
        fetchAdmins(),
        fetchStaffMembers(),
        fetchStudents(),
        fetchSchoolClasses(),
        fetchSubjects(),
        fetchExaminations(false),
        fetchSchoolSettings()
      ]);

      if (adm) setAdmins(adm);
      if (st) setStaffList(st);
      if (stu) setStudents(stu);
      if (cls) setClasses(cls);
      if (subs) setSubjects(subs);
      if (ex) setExams(ex);
      if (sett) setSettings(sett);
    } catch (err) {
      console.warn('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic super admin check
  const isSuperAdminUser =
    adminEmail.toLowerCase() === 'fathertemitope@gmail.com' ||
    admins.some(a => a.email.toLowerCase() === adminEmail.toLowerCase() && a.role === 'super_admin');

  // If non-super-admin is currently on 'admins' tab, switch to 'brand'
  useEffect(() => {
    if (admins.length > 0 && !isSuperAdminUser && activeTab === 'admins') {
      setActiveTab('brand');
    }
  }, [admins, isSuperAdminUser, activeTab]);

  useEffect(() => {
    loadData();
    const unsubAdmins = subscribeAdmins((liveAdmins) => {
      setAdmins(liveAdmins);
    });
    const unsubStaff = subscribeStaffMembers((liveStaff) => {
      setStaffList(liveStaff);
    });
    const unsubStudents = subscribeStudents((liveStudents) => {
      setStudents(liveStudents);
    });
    const unsubSubjects = subscribeSubjects((liveSubjects) => {
      setSubjects(liveSubjects);
    });
    const unsubClasses = subscribeSchoolClasses((liveClasses) => {
      setClasses(liveClasses);
    });
    const unsubExams = subscribeExaminations(false, (liveExams) => {
      setExams(liveExams);
    });
    const unsubSettings = subscribeSchoolSettings((liveSettings) => {
      setSettings(liveSettings);
    });
    const unsubSubmissions = subscribeSubmissions((liveSubmissions) => {
      setSubmissions(liveSubmissions);
    });
    return () => {
      unsubAdmins();
      unsubStaff();
      unsubStudents();
      unsubSubjects();
      unsubClasses();
      unsubExams();
      unsubSettings();
      unsubSubmissions();
    };
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
      avatarUrl: '',
      bio: '',
      assignedSubjectIds: subjects.length > 0 ? [subjects[0].id] : [],
      assignedClasses: classes.length > 0 ? [classes[0].code] : ['SS 1']
    });
    setStaffModalError(null);
    setSubjectSearchQuery('');
    setQuickSubjectName('');
    setQuickSubjectCode('');
    setEditingStaff(null);
    setShowAddStaffModal(true);
  };

  const handleOpenEditStaff = (staff: StaffMember) => {
    setEditingStaff(staff);
    const idSet = new Set(staff.assignedSubjectIds || []);
    const nameSet = new Set((staff.assignedSubjectNames || []).map(n => n.trim().toLowerCase()));
    const matchedIds = subjects
      .filter(sub => idSet.has(sub.id) || nameSet.has(sub.name.trim().toLowerCase()))
      .map(sub => sub.id);
    // Preserve any legacy IDs that might not have resolved yet
    (staff.assignedSubjectIds || []).forEach(id => {
      if (id && !matchedIds.includes(id)) matchedIds.push(id);
    });

    setStaffForm({
      fullName: staff.fullName || '',
      email: staff.email || '',
      uniqueId: staff.uniqueId || '',
      role: staff.role || 'teacher',
      status: staff.status || 'active',
      qualification: staff.qualification || '',
      courseOfStudy: staff.courseOfStudy || '',
      phoneNumber: staff.phoneNumber || '',
      password: staff.password || '',
      avatarUrl: staff.avatarUrl || '',
      bio: staff.bio || '',
      assignedSubjectIds: Array.from(new Set(matchedIds)),
      assignedClasses: Array.from(new Set(staff.assignedClasses || []))
    });
    setStaffModalError(null);
    setSubjectSearchQuery('');
    setQuickSubjectName('');
    setQuickSubjectCode('');
    setShowAddStaffModal(true);
  };

  const handleQuickCreateAndAssignSubject = async () => {
    const cleanName = quickSubjectName.trim();
    if (!cleanName) {
      setStaffModalError('Enter a subject name to create and assign.');
      return;
    }

    setStaffModalError(null);
    // If subject already exists by name, just select it cleanly
    const existing = subjects.find(
      s => s.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      setStaffForm(prev => ({
        ...prev,
        assignedSubjectIds: prev.assignedSubjectIds.includes(existing.id)
          ? prev.assignedSubjectIds
          : [...prev.assignedSubjectIds, existing.id]
      }));
      setQuickSubjectName('');
      setQuickSubjectCode('');
      return;
    }

    setAddingQuickSubject(true);
    try {
      const code =
        quickSubjectCode.trim().toUpperCase() ||
        cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() ||
        'SUB';
      const newSubject: Subject = {
        id: `sub_${Date.now()}`,
        name: cleanName,
        code,
        department: 'General Studies'
      };
      await saveSubject(newSubject);
      setSubjects(prev => (prev.some(s => s.id === newSubject.id) ? prev : [...prev, newSubject]));
      setStaffForm(prev => ({
        ...prev,
        assignedSubjectIds: [...prev.assignedSubjectIds, newSubject.id]
      }));
      setQuickSubjectName('');
      setQuickSubjectCode('');
      showNotification(`Subject "${newSubject.name}" added and assigned!`);
    } catch (err: any) {
      setStaffModalError(err?.message || 'Unable to create subject.');
    } finally {
      setAddingQuickSubject(false);
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingStaff) return;
    setStaffModalError(null);

    if (!staffForm.fullName.trim() || !staffForm.email.trim()) {
      setStaffModalError('Please fill in Staff Name and Email.');
      showNotification('Please fill in Staff Name and Email', 'error');
      return;
    }

    setSavingStaff(true);
    const assignedNames = subjects
      .filter(s => staffForm.assignedSubjectIds.includes(s.id))
      .map(s => s.name);

    const staffId = editingStaff ? editingStaff.id : `staff_${Date.now()}`;
    const newStaff: StaffMember = {
      id: staffId,
      uniqueId: staffForm.uniqueId.trim().toUpperCase() || generateStaffUniqueId(),
      fullName: staffForm.fullName.trim(),
      email: staffForm.email.trim().toLowerCase(),
      assignedSubjectIds: Array.from(new Set(staffForm.assignedSubjectIds)),
      assignedSubjectNames: Array.from(new Set(assignedNames)),
      assignedClasses: Array.from(new Set(staffForm.assignedClasses)),
      role: staffForm.role,
      status: staffForm.status,
      qualification: staffForm.qualification.trim(),
      courseOfStudy: staffForm.courseOfStudy.trim(),
      phoneNumber: staffForm.phoneNumber.trim(),
      password: staffForm.password.trim(),
      avatarUrl: staffForm.avatarUrl.trim(),
      bio: staffForm.bio.trim(),
      createdAt: editingStaff?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const savedStaff = await saveStaffMember(newStaff);
      setStaffList(prev => {
        const filtered = prev.filter(s => s.id !== staffId);
        return [savedStaff, ...filtered];
      });
      setShowAddStaffModal(false);
      showNotification(`Teacher "${savedStaff.fullName}" (${savedStaff.uniqueId}) saved and synchronized!`);
    } catch (err: any) {
      console.error('Error saving staff:', err);
      const errText = err?.message || 'Could not save staff member to database.';
      setStaffModalError(errText);
      showNotification('Could not save staff member to database', 'error');
    } finally {
      setSavingStaff(false);
    }
  };

  const handleDeleteStaff = (staff: StaffMember) => {
    setPendingConfirm({
      title: 'Delete Faculty Member',
      message: `Are you sure you want to permanently remove "${staff.fullName}" (${staff.uniqueId}) from the faculty database?`,
      confirmLabel: 'Delete Staff Member',
      onConfirm: async () => {
        try {
          await deleteStaffMember(staff.id);
          setStaffList(prev => prev.filter(s => s.id !== staff.id));
          showNotification(`Staff member "${staff.fullName}" was removed from database.`);
        } catch (err) {
          showNotification('Failed to delete staff member', 'error');
        }
      }
    });
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
      status: 'active',
      gender: '',
      phoneNumber: '',
      department: '',
      email: '',
      password: '',
      passportUrl: '',
      resultWithheld: false,
      withheldReason: ''
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
      status: student.status || 'active',
      gender: student.gender?.toLowerCase() === 'female' ? 'Female' : student.gender?.toLowerCase() === 'male' ? 'Male' : '',
      phoneNumber: student.phoneNumber || '',
      department: student.department || '',
      email: student.email || '',
      password: student.password || '',
      passportUrl: student.passportUrl || '',
      resultWithheld: Boolean(student.resultWithheld),
      withheldReason: student.withheldReason || ''
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
      ...(editingStudent || {}),
      id: studentId,
      admissionNumber: studentForm.admissionNumber.trim().toUpperCase(),
      firstName: studentForm.firstName.trim(),
      surname: studentForm.surname.trim(),
      fullName: `${studentForm.firstName.trim()} ${studentForm.surname.trim()}`,
      classGrade: studentForm.classGrade.trim(),
      academicSession: studentForm.academicSession.trim() || settings.academicSession,
      status: studentForm.status || 'active',
      gender: studentForm.gender || '',
      phoneNumber: studentForm.phoneNumber.trim(),
      department: studentForm.department.trim(),
      email: studentForm.email.trim().toLowerCase(),
      password: studentForm.password.trim(),
      passportUrl: studentForm.passportUrl.trim(),
      resultWithheld: Boolean(studentForm.resultWithheld),
      withheldReason: studentForm.resultWithheld ? studentForm.withheldReason.trim() : '',
      registeredAt: editingStudent ? editingStudent.registeredAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessCode: code
    };

    try {
      const saved = await saveStudent(newStudent);
      setStudents(prev => {
        const filtered = prev.filter(s => s.id !== studentId);
        return [saved, ...filtered];
      });
      setShowAddStudentModal(false);
      showNotification(`Student ${saved.fullName} saved and synchronized with database!`);
    } catch (err) {
      console.error('Error saving student:', err);
      showNotification('Could not save student to database', 'error');
    }
  };

  const handleDeleteStudent = (student: Student) => {
    setPendingConfirm({
      title: 'Delete Student Profile',
      message: `Are you sure you want to delete "${student.fullName}" (${student.admissionNumber})?`,
      confirmLabel: 'Delete Student',
      onConfirm: async () => {
        try {
          await deleteStudent(student.id);
          setStudents(prev => prev.filter(s => s.id !== student.id));
          showNotification(`Student "${student.fullName}" deleted and synchronized.`);
        } catch (err) {
          showNotification('Failed to delete student', 'error');
        }
      }
    });
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
          {isSuperAdminUser && (
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
          )}

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
            onClick={() => setActiveTab('live-monitor')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'live-monitor'
                ? 'bg-emerald-700 text-white shadow-md'
                : 'text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Live Exam Monitor</span>
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

          <button
            onClick={() => setActiveTab('communications')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'communications'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>Campus Chat Hub Audit</span>
          </button>
        </div>
      </div>

      {/* Main Tab Panels */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* TAB 1: ADMINISTRATORS AUTHORITY */}
        {activeTab === 'admins' && isSuperAdminUser && (
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
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-3">
                              {staff.avatarUrl ? (
                                <img
                                  src={staff.avatarUrl}
                                  alt={staff.fullName}
                                  className="w-9 h-9 rounded-xl object-cover border border-slate-300 shadow-xs shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                                  {staff.fullName.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="leading-tight">{staff.fullName}</div>
                                <div className="text-[11px] text-slate-400 font-mono font-normal">{staff.email}</div>
                                {(staff.phoneNumber || staff.qualification) && (
                                  <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                                    {[staff.qualification, staff.phoneNumber].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </div>
                            </div>
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
                            <div className="flex flex-wrap items-center gap-1">
                              {(staff.assignedSubjectNames || []).length > 0 ? (
                                staff.assignedSubjectNames.map((subj, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] font-semibold bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded"
                                  >
                                    {subj}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No subjects assigned</span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditStaff(staff)}
                                className="text-[10px] font-bold text-blue-800 hover:text-blue-950 bg-blue-50/70 hover:bg-blue-100 border border-dashed border-blue-300 px-1.5 py-0.5 rounded cursor-pointer"
                                title="Add or edit assigned subjects"
                              >
                                + Subjects
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {(staff.assignedClasses || []).map((cls, idx) => (
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
                    onClick={() => {
                      const defaultSource =
                        selectedClassFilter !== 'All'
                          ? selectedClassFilter
                          : classes[0]?.code || 'SS 1';
                      const classMatches = students.filter(
                        s => s.classGrade.trim().toUpperCase() === defaultSource.trim().toUpperCase()
                      );
                      setPromoSourceClass(defaultSource);
                      const nextClass =
                        classes[classes.findIndex(c => c.code === defaultSource) + 1]?.code ||
                        (defaultSource.includes('JSS 1')
                          ? 'JSS 2'
                          : defaultSource.includes('JSS 2')
                          ? 'JSS 3'
                          : defaultSource.includes('JSS 3')
                          ? 'SS 1'
                          : defaultSource.includes('SS 1')
                          ? 'SS 2'
                          : 'SS 3');
                      setPromoTargetClass(nextClass);
                      setPromoTargetStatus(defaultSource.includes('SS 3') ? 'graduated' : 'active');
                      setPromoSelectedIds(new Set(classMatches.map(s => s.id)));
                      setShowPromoteModal(true);
                    }}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Promote / Graduate Class</span>
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
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-3">
                              {stu.passportUrl ? (
                                <img
                                  src={stu.passportUrl}
                                  alt={stu.fullName}
                                  className="w-9 h-9 rounded-xl object-cover border border-slate-300 shadow-xs shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-blue-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                  {stu.firstName.charAt(0)}{stu.surname.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="leading-tight">{stu.fullName}</div>
                                {stu.email && <div className="text-[10px] text-slate-400 font-mono">{stu.email}</div>}
                              </div>
                            </div>
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
            students={students}
            classes={classes}
            subjects={subjects}
            academicSession={settings.academicSession}
            currentTerm={settings.currentTerm}
            caWeights={settings.caWeights}
            onExamsUpdated={loadData}
            showNotification={showNotification}
          />
        )}

        {/* TAB 7B: LIVE EXAM MONITOR */}
        {activeTab === 'live-monitor' && (
          <LiveExamMonitorView
            exams={exams}
            students={students}
            showNotification={showNotification}
          />
        )}

        {/* TAB 8: CONTINUOUS ASSESSMENT BROADSHEET */}
        {activeTab === 'broadsheet' && (
          <AdminBroadsheetTab
            students={students}
            subjects={subjects}
            classes={classes}
            exams={exams}
            settings={settings}
            showNotification={showNotification}
            onRefreshData={loadData}
            onSettingsUpdated={setSettings}
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
            schoolSettings={settings}
          />
        )}

        {/* TAB 10: CAMPUS CHAT HUB AUDIT */}
        {activeTab === 'communications' && (
          <AdminCommunicationsAuditTab
            students={students}
            staff={staffList}
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

            <form onSubmit={handleSaveStaff} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {staffModalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{staffModalError}</span>
                </div>
              )}

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Faculty Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="benson@honeysworld.edu.ng"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+234 803 123 4567"
                    value={staffForm.phoneNumber}
                    onChange={(e) => setStaffForm({ ...staffForm, phoneNumber: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              {/* Staff Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                    <span>Staff Photograph (Phone / Computer)</span>
                  </span>
                  {staffForm.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setStaffForm({ ...staffForm, avatarUrl: '' })}
                      className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </label>
                <div className="flex items-center gap-3">
                  {staffForm.avatarUrl ? (
                    <img
                      src={staffForm.avatarUrl}
                      alt="Staff Preview"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-300 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  <label className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-blue-900" />
                    <span>{staffForm.avatarUrl ? 'Change Photo (Phone / PC)' : 'Upload Picture (Phone / PC)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const compressed = await compressImageFile(file, 320, 320, 0.85);
                            setStaffForm(prev => ({ ...prev, avatarUrl: compressed }));
                          } catch (err: any) {
                            showNotification(err.message || 'Image processing failed', 'error');
                          }
                        }
                      }}
                    />
                  </label>
                </div>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Professional Bio / Teaching Specialization
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional instructor background, specialization, or office notes..."
                  value={staffForm.bio}
                  onChange={(e) => setStaffForm({ ...staffForm, bio: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              {/* Assigned Teaching Subjects with Search + Quick Create & Assign */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Assigned Teaching Subjects ({staffForm.assignedSubjectIds.length} selected)
                  </label>
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setStaffForm(prev => ({ ...prev, assignedSubjectIds: subjects.map(s => s.id) }))}
                      className="text-blue-900 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setStaffForm(prev => ({ ...prev, assignedSubjectIds: [] }))}
                      className="text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Inline Subject Search */}
                <input
                  type="text"
                  placeholder="Filter subjects by name or code..."
                  value={subjectSearchQuery}
                  onChange={(e) => setSubjectSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />

                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  {subjects
                    .filter(sub => {
                      const q = subjectSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return sub.name.toLowerCase().includes(q) || sub.code.toLowerCase().includes(q);
                    })
                    .map(sub => {
                      const checked = staffForm.assignedSubjectIds.includes(sub.id);
                      return (
                        <label
                          key={sub.id}
                          className={`flex items-center gap-2 text-xs px-2 py-1 rounded-lg cursor-pointer transition-colors ${
                            checked ? 'bg-blue-50 text-blue-950 font-bold border border-blue-200' : 'hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setStaffForm(prev => ({
                                  ...prev,
                                  assignedSubjectIds: prev.assignedSubjectIds.includes(sub.id)
                                    ? prev.assignedSubjectIds
                                    : [...prev.assignedSubjectIds, sub.id]
                                }));
                              } else {
                                setStaffForm(prev => ({
                                  ...prev,
                                  assignedSubjectIds: prev.assignedSubjectIds.filter(id => id !== sub.id)
                                }));
                              }
                            }}
                            className="rounded text-blue-900"
                          />
                          <span className="truncate">{sub.name}</span>
                        </label>
                      );
                    })}
                </div>

                {/* Inline Quick-Create & Assign New Subject */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="New subject name (e.g. Civic Education)"
                    value={quickSubjectName}
                    onChange={(e) => setQuickSubjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQuickCreateAndAssignSubject();
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Code"
                    value={quickSubjectCode}
                    onChange={(e) => setQuickSubjectCode(e.target.value.toUpperCase())}
                    className="w-16 px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg uppercase font-mono"
                  />
                  <button
                    type="button"
                    disabled={addingQuickSubject}
                    onClick={handleQuickCreateAndAssignSubject}
                    className="px-2.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-[11px] font-bold rounded-lg whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    {addingQuickSubject ? 'Adding...' : '+ Add & Assign'}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Assigned Classes ({staffForm.assignedClasses.length} selected)
                  </label>
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setStaffForm(prev => ({ ...prev, assignedClasses: classes.map(c => c.code) }))}
                      className="text-blue-900 hover:underline cursor-pointer"
                    >
                      All Classes
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setStaffForm(prev => ({ ...prev, assignedClasses: [] }))}
                      className="text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
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
                              setStaffForm(prev => ({
                                ...prev,
                                assignedClasses: prev.assignedClasses.includes(cls.code)
                                  ? prev.assignedClasses
                                  : [...prev.assignedClasses, cls.code]
                              }));
                            } else {
                              setStaffForm(prev => ({
                                ...prev,
                                assignedClasses: prev.assignedClasses.filter(c => c !== cls.code)
                              }));
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
                  disabled={savingStaff}
                  className="px-5 py-2.5 text-xs font-bold bg-slate-900 text-white rounded-xl shadow-md hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  {savingStaff
                    ? 'Saving & Syncing...'
                    : editingStaff
                    ? 'Update Teacher Member'
                    : 'Save Faculty Staff'}
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

              {/* Student Passport Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                    <span>Candidate Passport (Phone / Computer)</span>
                  </span>
                  {studentForm.passportUrl && (
                    <button
                      type="button"
                      onClick={() => setStudentForm({ ...studentForm, passportUrl: '' })}
                      className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </label>
                <div className="flex items-center gap-3">
                  {studentForm.passportUrl ? (
                    <img
                      src={studentForm.passportUrl}
                      alt="Student Preview"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-300 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  <label className="flex-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-blue-800" />
                    <span>{studentForm.passportUrl ? 'Change Passport (Phone / PC)' : 'Upload Passport (Phone / PC)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const compressed = await compressImageFile(file, 320, 320, 0.85);
                            setStudentForm(prev => ({ ...prev, passportUrl: compressed }));
                          } catch (err: any) {
                            showNotification(err.message || 'Image processing failed', 'error');
                          }
                        }
                      }}
                    />
                  </label>
                </div>
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={studentForm.status}
                    onChange={(e) => setStudentForm({ ...studentForm, status: e.target.value as 'active' | 'suspended' | 'graduated' })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="graduated">Graduated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                  <select
                    value={studentForm.gender}
                    onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as '' | 'Male' | 'Female' })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="">Unspecified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="Science / Arts"
                    value={studentForm.department}
                    onChange={(e) => setStudentForm({ ...studentForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Parent / Student Phone Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="+234 800 000 0000"
                    value={studentForm.phoneNumber}
                    onChange={(e) => setStudentForm({ ...studentForm, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-rose-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={studentForm.resultWithheld}
                    onChange={(e) => setStudentForm({ ...studentForm, resultWithheld: e.target.checked })}
                    className="rounded text-rose-700"
                  />
                  <span>Withhold Student Terminal Results</span>
                </label>
                {studentForm.resultWithheld && (
                  <input
                    type="text"
                    placeholder="Reason for withholding (e.g. Unpaid Tuition / Disciplinary)"
                    value={studentForm.withheldReason}
                    onChange={(e) => setStudentForm({ ...studentForm, withheldReason: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-rose-300 rounded-lg"
                  />
                )}
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
        schoolLogo={settings.schoolLogo}
      />

      {/* Student Slips Modal */}
      <StudentSlipsModal
        isOpen={showStudentSlipsModal}
        onClose={() => setShowStudentSlipsModal(false)}
        students={students}
        schoolName={settings.schoolName || "Honey's World High School"}
        schoolLogo={settings.schoolLogo}
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

      {/* In-App Confirmation Modal */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-rose-900 text-white px-5 py-4 flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-300 shrink-0" />
              <h3 className="font-bold text-sm">{pendingConfirm.title}</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">{pendingConfirm.message}</p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const action = pendingConfirm.onConfirm;
                    setPendingConfirm(null);
                    await action();
                  }}
                  className="px-4 py-2 text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white rounded-xl cursor-pointer"
                >
                  {pendingConfirm.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* End-of-Session Class Promotion / Graduation Modal */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">End-of-Session Class Promotion & Graduation</h3>
                  <p className="text-[11px] text-slate-400">
                    Bulk-promote selected candidates to the next class while preserving prior term history.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPromoteModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Source Class</label>
                  <select
                    value={promoSourceClass}
                    onChange={(e) => {
                      const src = e.target.value;
                      setPromoSourceClass(src);
                      const matches = students.filter(
                        s => s.classGrade.trim().toUpperCase() === src.trim().toUpperCase()
                      );
                      setPromoSelectedIds(new Set(matches.map(s => s.id)));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-slate-50"
                  >
                    {Array.from(new Set([...classes.map(c => c.code), ...students.map(s => s.classGrade)])).map(cls => (
                      <option key={cls} value={cls}>
                        {cls} ({students.filter(s => s.classGrade === cls).length} students)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Action / Target Status</label>
                  <select
                    value={promoTargetStatus}
                    onChange={(e) => setPromoTargetStatus(e.target.value as 'active' | 'graduated')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-slate-50"
                  >
                    <option value="active">Promote to Next Class</option>
                    <option value="graduated">Mark as Graduated (Alumni)</option>
                  </select>
                </div>

                {promoTargetStatus === 'active' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Class</label>
                    <select
                      value={promoTargetClass}
                      onChange={(e) => setPromoTargetClass(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-slate-50"
                    >
                      {Array.from(new Set([...classes.map(c => c.code), 'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3'])).map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Academic Session</label>
                  <input
                    type="text"
                    value={promoTargetSession}
                    onChange={(e) => setPromoTargetSession(e.target.value)}
                    placeholder="2026/2027"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold bg-slate-50"
                  />
                </div>
              </div>

              {(() => {
                const sourceList = students.filter(
                  s => s.classGrade.trim().toUpperCase() === promoSourceClass.trim().toUpperCase()
                );
                return (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-700">
                        Candidates in {promoSourceClass} ({promoSelectedIds.size}/{sourceList.length} selected)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (promoSelectedIds.size === sourceList.length) {
                            setPromoSelectedIds(new Set());
                          } else {
                            setPromoSelectedIds(new Set(sourceList.map(s => s.id)));
                          }
                        }}
                        className="text-blue-800 font-bold hover:underline cursor-pointer"
                      >
                        {promoSelectedIds.size === sourceList.length ? 'Clear All' : 'Select All'}
                      </button>
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {sourceList.length === 0 ? (
                        <div className="py-8 text-center text-slate-400">No students found in {promoSourceClass}.</div>
                      ) : (
                        sourceList.map(stu => {
                          const checked = promoSelectedIds.has(stu.id);
                          return (
                            <label
                              key={stu.id}
                              className="flex items-center justify-between px-3 py-2 hover:bg-blue-50/40 cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setPromoSelectedIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(stu.id)) next.delete(stu.id);
                                      else next.add(stu.id);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="font-bold text-slate-900">{stu.fullName}</span>
                              </div>
                              <span className="font-mono text-[11px] text-slate-500">
                                {stu.admissionNumber} · {stu.academicSession}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPromoteModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={promotingBusy || promoSelectedIds.size === 0}
                  onClick={async () => {
                    setPromotingBusy(true);
                    try {
                      const res = await promoteStudentsClassBatch(
                        students,
                        Array.from(promoSelectedIds),
                        promoTargetClass,
                        promoTargetSession.trim() || settings.academicSession,
                        promoTargetStatus
                      );
                      await loadData();
                      setShowPromoteModal(false);
                      showNotification(
                        promoTargetStatus === 'graduated'
                          ? `Graduated ${res.promotedCount} student(s) successfully.`
                          : `Promoted ${res.promotedCount} student(s) to ${promoTargetClass} (${promoTargetSession})!`
                      );
                    } catch {
                      showNotification('Could not complete class promotion.', 'error');
                    } finally {
                      setPromotingBusy(false);
                    }
                  }}
                  className="px-5 py-2.5 text-xs font-black bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-sm cursor-pointer disabled:opacity-40"
                >
                  {promotingBusy
                    ? 'Processing...'
                    : promoTargetStatus === 'graduated'
                    ? `Graduate ${promoSelectedIds.size} Student(s)`
                    : `Promote ${promoSelectedIds.size} Student(s) → ${promoTargetClass}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
