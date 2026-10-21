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
  Eye
} from 'lucide-react';
import {
  StaffMember,
  Student,
  SchoolClass,
  Subject,
  SchoolSettings,
  Examination,
  Submission,
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
  saveSchoolClass,
  deleteSchoolClass,
  fetchSubjects,
  saveSubject,
  deleteSubject,
  fetchSchoolSettings,
  saveSchoolSettings,
  fetchExaminations,
  fetchSubmissions
} from '../../services/firebase';
import { StaffSlipsModal } from './StaffSlipsModal';
import { StudentSlipsModal } from '../teacher/StudentSlipsModal';
import { StudentBatchUploadModal } from '../teacher/StudentBatchUploadModal';

interface AdminPortalProps {
  adminEmail: string;
  onLogout: () => void;
  onGoToHome: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  adminEmail,
  onLogout,
  onGoToHome
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'staff' | 'students' | 'curriculum' | 'settings' | 'exams'>(
    'staff'
  );

  // Core Data
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Examination[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: 'PRIME EDUTECH',
    academicSession: '2025/2026',
    currentTerm: '1st Term',
    passMarkPercentage: 50,
    allowImmediateResultViewing: true
  });
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showStaffSlipsModal, setShowStaffSlipsModal] = useState(false);

  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showBatchStudentModal, setShowBatchStudentModal] = useState(false);
  const [showStudentSlipsModal, setShowStudentSlipsModal] = useState(false);

  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('All');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form states for Staff
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    email: '',
    uniqueId: '',
    role: 'teacher' as 'teacher' | 'hod',
    status: 'active' as 'active' | 'suspended',
    assignedSubjectIds: [] as string[],
    assignedClasses: [] as string[]
  });

  // Form states for Student
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    surname: '',
    admissionNumber: '',
    classGrade: 'SS 2',
    accessCode: '',
    academicSession: '2025/2026'
  });

  // Form state for Class
  const [classForm, setClassForm] = useState({
    name: '',
    code: '',
    arm: 'A',
    academicSession: '2025/2026'
  });

  // Form state for Subject
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    department: 'Science & Tech'
  });

  // Load all institutional data
  const loadData = async () => {
    setLoading(true);
    try {
      const [st, stu, cls, subs, ex, subms, sett] = await Promise.all([
        fetchStaffMembers(),
        fetchStudents(),
        fetchSchoolClasses(),
        fetchSubjects(),
        fetchExaminations(false),
        fetchSubmissions(),
        fetchSchoolSettings()
      ]);

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
    setTimeout(() => setStatusMessage(null), 3500);
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

    // Determine subject names
    const assignedNames = subjects
      .filter(s => staffForm.assignedSubjectIds.includes(s.id))
      .map(s => s.name);

    const staffId = editingStaff ? editingStaff.id : `staff-${Date.now()}`;
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
    if (confirm(`Are you sure you want to delete staff member "${staff.fullName}" (${staff.uniqueId})? They will no longer be able to log in.`)) {
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
    setStudentForm({
      firstName: '',
      surname: '',
      admissionNumber: `STU/${yr}/${String(nextIdx).padStart(3, '0')}`,
      classGrade: classes[0]?.code || 'SS 2',
      accessCode: generateStudentAccessCode(existing),
      academicSession: settings.academicSession
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
      academicSession: student.academicSession || settings.academicSession
    });
    setShowAddStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.firstName.trim() || !studentForm.surname.trim() || !studentForm.admissionNumber.trim()) {
      showNotification('Please enter student First Name, Surname, and Admission Number', 'error');
      return;
    }

    const studentId = editingStudent ? editingStudent.id : `stu-${Date.now()}`;
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
      showNotification(`Student ${newStudent.fullName} saved with Unique ID ${code}!`);
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

  // Class Actions
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name.trim() || !classForm.code.trim()) return;

    const newClass: SchoolClass = {
      id: `cls-${Date.now()}`,
      name: classForm.name.trim(),
      code: classForm.code.trim().toUpperCase(),
      arm: classForm.arm.trim(),
      academicSession: classForm.academicSession || settings.academicSession
    };

    try {
      await saveSchoolClass(newClass);
      setClasses(prev => [...prev, newClass]);
      setShowAddClassModal(false);
      setClassForm({ name: '', code: '', arm: 'A', academicSession: settings.academicSession });
      showNotification(`Class ${newClass.code} added successfully!`);
    } catch (err) {
      showNotification('Failed to save class', 'error');
    }
  };

  const handleDeleteClass = async (cls: SchoolClass) => {
    if (confirm(`Delete class "${cls.code}"?`)) {
      try {
        await deleteSchoolClass(cls.id);
        setClasses(prev => prev.filter(c => c.id !== cls.id));
        showNotification(`Class "${cls.code}" deleted.`);
      } catch (err) {
        showNotification('Failed to delete class', 'error');
      }
    }
  };

  // Subject Actions
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name.trim() || !subjectForm.code.trim()) return;

    const newSub: Subject = {
      id: `sub-${Date.now()}`,
      name: subjectForm.name.trim(),
      code: subjectForm.code.trim().toUpperCase(),
      department: subjectForm.department.trim()
    };

    try {
      await saveSubject(newSub);
      setSubjects(prev => [...prev, newSub]);
      setShowAddSubjectModal(false);
      setSubjectForm({ name: '', code: '', department: 'Science & Tech' });
      showNotification(`Subject ${newSub.name} added successfully!`);
    } catch (err) {
      showNotification('Failed to save subject', 'error');
    }
  };

  const handleDeleteSubject = async (sub: Subject) => {
    if (confirm(`Delete curriculum subject "${sub.name}"?`)) {
      try {
        await deleteSubject(sub.id);
        setSubjects(prev => prev.filter(s => s.id !== sub.id));
        showNotification(`Subject "${sub.name}" deleted.`);
      } catch (err) {
        showNotification('Failed to delete subject', 'error');
      }
    }
  };

  // Settings Actions
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveSchoolSettings(settings);
      showNotification('Institutional settings updated successfully!');
    } catch (err) {
      showNotification('Failed to save school settings', 'error');
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
      {/* Top Admin Security Bar */}
      <div className="bg-slate-900 text-white border-b border-amber-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-wide text-white uppercase">
                  PRIME EDUTECH
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                  Admin Authority
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Institutional Control & Faculty Provisioning Console · <span className="text-amber-300 font-mono">{adminEmail}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onGoToHome}
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Exit to Home
            </button>
            <button
              onClick={onLogout}
              className="text-xs font-bold text-rose-400 hover:text-white px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 flex items-center gap-1.5 transition-colors"
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-900" />
              <span>Faculty Staff</span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">{staffList.length}</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
              {staffList.filter(s => s.status === 'active').length} Active Credentials
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-700" />
              <span>Enrolled Students</span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">{students.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Across {classes.length} Classes</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span>Curriculum</span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">{subjects.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Active School Subjects</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-purple-700" />
              <span>Examinations</span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">{exams.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {exams.filter(e => e.status === 'published').length} Published Papers
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm col-span-2 sm:col-span-1">
            <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-emerald-700" />
              <span>Active Term</span>
            </div>
            <div className="text-base font-black text-slate-900 mt-1 truncate">{settings.currentTerm}</div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">{settings.academicSession}</div>
          </div>
        </div>
      </div>

      {/* Main Admin Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'staff'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Staff Directory & Unique IDs ({staffList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'students'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-blue-400" />
            <span>Student Management ({students.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('curriculum')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'curriculum'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Classes & Subjects</span>
          </button>

          <button
            onClick={() => setActiveTab('exams')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'exams'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <span>Global Exam Oversight ({exams.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'settings'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>School Settings & Term</span>
          </button>
        </div>
      </div>

      {/* Main Tab Panels */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* =========================================================================
            TAB 1: STAFF DIRECTORY & UNIQUE IDS (ADMIN ONLY RIGHT)
        ========================================================================= */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200 uppercase tracking-wide mb-1">
                    <ShieldAlert className="w-3 h-3" />
                    <span>Admin-Only Authority</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900">Faculty Staff Management</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Only the Administrator can register teachers and generate their Unique Staff Login IDs. Teachers cannot enter the staff portal without an approved ID.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => setShowStaffSlipsModal(true)}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Print Credential Slips</span>
                  </button>
                  <button
                    onClick={handleOpenAddStaff}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>Add New Faculty Staff</span>
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
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Staff Table */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left border-collapse">
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
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No faculty staff members found matching query. Click "Add New Faculty Staff" above.
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
                            <div className="inline-flex items-center gap-1.5 bg-slate-900 text-amber-300 font-mono font-black text-xs px-2.5 py-1 rounded-lg shadow-sm border border-slate-800">
                              <span>{staff.uniqueId}</span>
                              <button
                                onClick={() => handleCopy(staff.uniqueId)}
                                className="text-slate-400 hover:text-white"
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
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Edit Staff"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(staff)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
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

        {/* =========================================================================
            TAB 2: STUDENT MANAGEMENT & UNIQUE ACCESS CODES
        ========================================================================= */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Student Directory & Unique Passcodes</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Each student receives an auto-generated unique User ID / Code (e.g. <span className="font-mono font-bold text-blue-900">PRM-4821</span>). When they log in with this ID, they immediately enter their candidate portal with their exams.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => setShowStudentSlipsModal(true)}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Print Student Slips</span>
                  </button>
                  <button
                    onClick={() => setShowBatchStudentModal(true)}
                    className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-700" />
                    <span>Batch CSV Upload</span>
                  </button>
                  <button
                    onClick={handleOpenAddStudent}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>Add Student</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by student full name, admission number, or unique code (e.g. PRM-4821)..."
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
                    className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
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
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3 px-4">Student Full Name</th>
                      <th className="py-3 px-4">Unique Login ID / Code</th>
                      <th className="py-3 px-4">Admission Number</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Session</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
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
                            {stu.fullName}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="inline-flex items-center gap-1.5 bg-blue-950 text-blue-300 font-mono font-black text-xs px-2.5 py-1 rounded-lg border border-blue-800">
                              <span>{stu.accessCode || stu.admissionNumber}</span>
                              <button
                                onClick={() => handleCopy(stu.accessCode || stu.admissionNumber)}
                                className="text-slate-400 hover:text-white"
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
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Edit Student"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(stu)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
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

        {/* =========================================================================
            TAB 3: CURRICULUM (CLASSES & SUBJECTS)
        ========================================================================= */}
        {activeTab === 'curriculum' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* School Classes Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">Academic Classes ({classes.length})</h3>
                  <p className="text-xs text-slate-500">Junior & Senior Secondary cohorts</p>
                </div>
                <button
                  onClick={() => setShowAddClassModal(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Add Class</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {classes.map(cls => (
                  <div
                    key={cls.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{cls.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Code: <strong>{cls.code}</strong> · Arm: {cls.arm || 'General'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteClass(cls)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                      title="Delete Class"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* School Subjects Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">Curriculum Subjects ({subjects.length})</h3>
                  <p className="text-xs text-slate-500">Subjects assigned to faculty teachers</p>
                </div>
                <button
                  onClick={() => setShowAddSubjectModal(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Add Subject</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-[480px] overflow-y-auto">
                {subjects.map(sub => (
                  <div
                    key={sub.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{sub.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Code: <strong>{sub.code}</strong> · Dept: {sub.department}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSubject(sub)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                      title="Delete Subject"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: GLOBAL EXAMINATIONS OVERSIGHT
        ========================================================================= */}
        {activeTab === 'exams' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-xl font-black text-slate-900">Institutional Examination Directory</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Overview of all examinations configured across all academic subjects and teachers.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3 px-4">Examination Title</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Target Class</th>
                    <th className="py-3 px-4">Term & Session</th>
                    <th className="py-3 px-4">Questions / Duration</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {exams.map(exam => (
                    <tr key={exam.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {exam.title}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-blue-900">
                        {exam.subjectName}
                      </td>
                      <td className="py-3.5 px-4 font-bold">
                        {exam.classGrade}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {exam.term} · {exam.academicSession}
                      </td>
                      <td className="py-3.5 px-4">
                        {exam.totalQuestions} Qs ({exam.durationMinutes} mins)
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                            exam.status === 'published'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {exam.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: SCHOOL SETTINGS & SESSION CONFIGURATION
        ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-2xl mx-auto">
            <div className="pb-6 border-b border-slate-100 mb-6">
              <h2 className="text-xl font-black text-slate-900">Institutional School Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure official school name, active term, and academic evaluation policies.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Institutional Name
                </label>
                <input
                  type="text"
                  required
                  value={settings.schoolName}
                  onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Session
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.academicSession}
                    onChange={(e) => setSettings({ ...settings, academicSession: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Current Active Term
                  </label>
                  <select
                    value={settings.currentTerm}
                    onChange={(e) => setSettings({ ...settings, currentTerm: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="1st Term">1st Term</option>
                    <option value="2nd Term">2nd Term</option>
                    <option value="3rd Term">3rd Term</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Examination Pass Mark (%)
                </label>
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={settings.passMarkPercentage}
                  onChange={(e) => setSettings({ ...settings, passMarkPercentage: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowImmediateResultViewing}
                    onChange={(e) => setSettings({ ...settings, allowImmediateResultViewing: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 border-slate-300"
                  />
                  <span className="text-xs text-slate-700 font-semibold">
                    Allow students to view graded result slips immediately after test submission
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                >
                  Save Institutional Settings
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* =========================================================================
          MODALS
      ========================================================================= */}

      {/* Add / Edit Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  {editingStaff ? 'Edit Faculty Member' : 'Register New Faculty Member'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-6 space-y-4">
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
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

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
                    className="text-[11px] text-blue-900 hover:underline font-semibold"
                  >
                    Regenerate Code
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={staffForm.uniqueId}
                  onChange={(e) => setStaffForm({ ...staffForm, uniqueId: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-900 text-amber-300 font-mono font-black border border-slate-700 rounded-xl uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Teachers enter this ID at the staff login page. Only authorized IDs in database can enter.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Assigned Teaching Subjects (Teacher will only access these)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
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
                  Assigned Classes (e.g. SS 1, SS 2)
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
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
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-slate-900 text-white rounded-xl shadow-md hover:bg-slate-800"
                >
                  {editingStaff ? 'Update Staff Member' : 'Save & Issue Staff ID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">
                  {editingStudent ? 'Edit Student Profile' : 'Enroll New Student'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    First Name
                  </label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Surname
                  </label>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Admission Number
                </label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Class Form
                  </label>
                  <select
                    value={studentForm.classGrade}
                    onChange={(e) => setStudentForm({ ...studentForm, classGrade: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Session
                  </label>
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
                    Auto-Generated Student Code / User ID
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = generateStudentAccessCode(students.map(s => s.accessCode || ''));
                      setStudentForm({ ...studentForm, accessCode: next });
                    }}
                    className="text-[11px] text-blue-900 hover:underline font-semibold"
                  >
                    Regenerate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={studentForm.accessCode}
                  onChange={(e) => setStudentForm({ ...studentForm, accessCode: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-sm bg-blue-950 text-blue-300 font-mono font-black border border-blue-800 rounded-xl uppercase tracking-wider"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Student logs in directly using this unique code or user ID.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-slate-900 text-white rounded-xl shadow-md hover:bg-slate-800"
                >
                  {editingStudent ? 'Update Student' : 'Save Student & Issue Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Class Modal */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6">
            <h3 className="font-black text-sm text-slate-900 mb-4">Add School Class</h3>
            <form onSubmit={handleSaveClass} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Class Name</label>
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
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl"
                >
                  Save Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6">
            <h3 className="font-black text-sm text-slate-900 mb-4">Add Curriculum Subject</h3>
            <form onSubmit={handleSaveSubject} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Studies"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Short Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CSC"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold"
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
                  <option value="Commercial Studies">Commercial Studies</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl"
                >
                  Save Subject
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
        schoolName={settings.schoolName}
      />

      {/* Student Slips Modal */}
      <StudentSlipsModal
        isOpen={showStudentSlipsModal}
        onClose={() => setShowStudentSlipsModal(false)}
        students={students}
        schoolName={settings.schoolName}
        currentSession={settings.academicSession}
        currentTerm={settings.currentTerm}
      />

      {/* Student Batch Upload Modal */}
      <StudentBatchUploadModal
        isOpen={showBatchStudentModal}
        onClose={() => setShowBatchStudentModal(false)}
        classes={classes}
        currentSession={settings.academicSession}
        existingStudents={students}
        onUploadSuccess={(newStudents) => {
          setStudents(prev => [...newStudents, ...prev]);
          setShowBatchStudentModal(false);
          showNotification(`Successfully enrolled and generated unique IDs for ${newStudents.length} students!`);
        }}
      />
    </div>
  );
};
