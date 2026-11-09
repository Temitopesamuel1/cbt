import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  getDocFromServer,
  query,
  where,
  deleteDoc,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Examination,
  Question,
  Student,
  Submission,
  SchoolClass,
  Subject,
  SchoolSettings,
  ExamAttempt,
  generateStudentAccessCode,
  StaffMember,
  generateStaffUniqueId,
  StudentAssessmentRecord,
  AdminUser
} from '../types/cbt';
import {
  DEFAULT_SCHOOL_CLASSES,
  DEFAULT_SUBJECTS,
  DEFAULT_SCHOOL_SETTINGS,
  DEFAULT_STUDENTS,
  DEFAULT_EXAMINATIONS,
  DEFAULT_QUESTIONS_MAP,
  DEFAULT_STAFF,
  DEFAULT_ADMINS
} from '../data/initialSchoolData';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initializing.');
      return false;
    }
    return true;
  }
}

// =========================================================================
// Institutional Administrators Management (Super Admin & Co-Admins)
// =========================================================================
export async function fetchAdmins(): Promise<AdminUser[]> {
  const path = 'admins';
  let admins: AdminUser[] = [];

  // Read local cache first
  try {
    const local = localStorage.getItem('prime_edutech_saved_admins');
    if (local) {
      const parsed: AdminUser[] = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        admins = [...parsed];
      }
    }
  } catch {}

  // Fetch live from Firestore
  try {
    const snapshot = await getDocs(collection(db, path));
    if (!snapshot.empty) {
      const firestoreAdmins: AdminUser[] = [];
      snapshot.forEach(docSnap => {
        firestoreAdmins.push({ id: docSnap.id, ...docSnap.data() } as AdminUser);
      });

      // Merge: Firestore docs take priority, but keep any newly added local admins not yet indexed
      for (const fAdmin of firestoreAdmins) {
        const idx = admins.findIndex(
          a => a.id === fAdmin.id || a.email.toLowerCase() === fAdmin.email.toLowerCase()
        );
        if (idx >= 0) {
          admins[idx] = { ...admins[idx], ...fAdmin };
        } else {
          admins.push(fAdmin);
        }
      }
    }
  } catch (error) {
    console.warn('Firestore fetchAdmins notice (using cache):', error);
  }

  // Always ensure the primary Super Admin (fathertemitope@gmail.com) exists
  const hasMain = admins.some(a => a.email.toLowerCase() === 'fathertemitope@gmail.com');
  if (!hasMain) {
    const mainAdmin = DEFAULT_ADMINS[0];
    admins = [mainAdmin, ...admins];
    setDoc(doc(db, 'admins', mainAdmin.id), mainAdmin, { merge: true }).catch(() => {});
  }

  // Ensure all local admins exist in Firestore
  for (const a of admins) {
    setDoc(doc(db, 'admins', a.id), a, { merge: true }).catch(() => {});
  }

  // Update persistent local cache
  try {
    localStorage.setItem('prime_edutech_saved_admins', JSON.stringify(admins));
  } catch {}

  return admins;
}

export async function saveAdmin(admin: AdminUser): Promise<void> {
  const cleanEmail = admin.email.trim().toLowerCase();
  const adminId = admin.id || `admin_${cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const dataToSave: AdminUser = {
    ...admin,
    id: adminId,
    email: cleanEmail,
    passcode: admin.passcode || 'admin2025'
  };

  // 1. Immediately update localStorage so state reflects without delay
  try {
    const stored = localStorage.getItem('prime_edutech_saved_admins');
    const list: AdminUser[] = stored ? JSON.parse(stored) : [...DEFAULT_ADMINS];
    const filtered = list.filter(
      a => a.id !== adminId && a.email.toLowerCase() !== dataToSave.email.toLowerCase()
    );
    const updated = [dataToSave, ...filtered];
    localStorage.setItem('prime_edutech_saved_admins', JSON.stringify(updated));
  } catch {}

  // 2. Persist directly to Firestore
  try {
    await setDoc(doc(db, 'admins', adminId), dataToSave, { merge: true });
  } catch (error) {
    console.warn('Firestore setDoc warning for admin:', error);
  }
}

export async function deleteAdmin(adminId: string): Promise<void> {
  // Prevent deleting the main super admin
  const admins = await fetchAdmins();
  const target = admins.find(a => a.id === adminId);
  if (target?.isMainSuperAdmin || target?.email.toLowerCase() === 'fathertemitope@gmail.com') {
    throw new Error('The Chief Super Administrator (fathertemitope@gmail.com) is permanently protected and cannot be deleted.');
  }

  // Update localStorage immediately
  try {
    const stored = localStorage.getItem('prime_edutech_saved_admins');
    if (stored) {
      const list: AdminUser[] = JSON.parse(stored);
      localStorage.setItem('prime_edutech_saved_admins', JSON.stringify(list.filter(a => a.id !== adminId)));
    }
  } catch {}

  // Delete from Firestore
  try {
    await deleteDoc(doc(db, 'admins', adminId));
  } catch (error) {
    console.warn('Firestore delete warning for admin:', error);
  }
}

export async function verifyAdminLogin(
  email: string,
  passcode: string
): Promise<{ success: boolean; admin?: AdminUser; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPasscode = passcode.trim();

  if (!cleanEmail) {
    return { success: false, error: 'Please enter your registered Administrator Email.' };
  }
  if (!cleanPasscode) {
    return { success: false, error: 'Please enter your administrative Security Key / Password.' };
  }

  // Fetch all admins
  let admins: AdminUser[] = [];
  try {
    admins = await fetchAdmins();
  } catch {
    admins = DEFAULT_ADMINS;
  }

  // Ensure fathertemitope is present even if DB was blank
  if (!admins.some(a => a.email.toLowerCase() === 'fathertemitope@gmail.com')) {
    admins = [...DEFAULT_ADMINS, ...admins];
  }

  const matched = admins.find(a => a.email.toLowerCase() === cleanEmail);

  if (!matched) {
    return {
      success: false,
      error: `Access Denied: "${cleanEmail}" is not recognized as an authorized Administrator. Only administrators configured by the Chief Super Admin (fathertemitope@gmail.com) may access this console.`
    };
  }

  if (matched.status === 'suspended') {
    return {
      success: false,
      error: `Access Suspended: The administrator account for "${matched.fullName}" (${cleanEmail}) has been suspended. Please contact the Chief Super Administrator.`
    };
  }

  // Check password
  if (matched.passcode && matched.passcode !== cleanPasscode) {
    return {
      success: false,
      error: 'Invalid Administrative Security Key / Password. Please check your credentials.'
    };
  }

  // Update last login
  const updatedAdmin: AdminUser = {
    ...matched,
    lastLoginAt: new Date().toISOString()
  };
  saveAdmin(updatedAdmin).catch(() => {});

  return { success: true, admin: updatedAdmin };
}

// Faculty & Staff Management
export async function fetchStaffMembers(): Promise<StaffMember[]> {
  const path = 'teachers';
  let staff: StaffMember[] = [];

  // Read local cache first
  try {
    const local = localStorage.getItem('prime_edutech_saved_teachers');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        staff = [...parsed];
      }
    }
  } catch {}

  // Fetch from Firestore
  try {
    const snapshot = await getDocs(collection(db, path));
    if (!snapshot.empty) {
      const firestoreStaff: StaffMember[] = [];
      snapshot.forEach(docSnap => {
        firestoreStaff.push({ id: docSnap.id, ...docSnap.data() } as StaffMember);
      });

      // Merge: Firestore takes precedence, but keep local additions not yet indexed
      for (const fStaff of firestoreStaff) {
        const idx = staff.findIndex(
          s => s.id === fStaff.id || (s.uniqueId && s.uniqueId.toUpperCase() === fStaff.uniqueId?.toUpperCase())
        );
        if (idx >= 0) {
          staff[idx] = { ...staff[idx], ...fStaff };
        } else {
          staff.push(fStaff);
        }
      }
    } else if (staff.length === 0) {
      staff = [...DEFAULT_STAFF];
    }
  } catch (error) {
    console.warn('Fallback to default staff roster:', error);
    if (staff.length === 0) {
      staff = [...DEFAULT_STAFF];
    }
  }

  // Update local cache
  try {
    localStorage.setItem('prime_edutech_saved_teachers', JSON.stringify(staff));
  } catch {}

  return staff;
}

export async function saveStaffMember(staff: StaffMember): Promise<void> {
  const path = `teachers/${staff.id}`;
  if (!staff.uniqueId || staff.uniqueId.trim() === '') {
    staff.uniqueId = generateStaffUniqueId();
  }

  // Save to local cache immediately
  try {
    const local = localStorage.getItem('prime_edutech_saved_teachers');
    let list: StaffMember[] = local ? JSON.parse(local) : [...DEFAULT_STAFF];
    const idx = list.findIndex(s => s.id === staff.id || s.uniqueId === staff.uniqueId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...staff };
    } else {
      list.push(staff);
    }
    localStorage.setItem('prime_edutech_saved_teachers', JSON.stringify(list));
  } catch {}

  // Persist to Firestore
  try {
    await setDoc(doc(db, 'teachers', staff.id), staff, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteStaffMember(staffId: string): Promise<void> {
  const path = `teachers/${staffId}`;
  try {
    const local = localStorage.getItem('prime_edutech_saved_teachers');
    if (local) {
      const list: StaffMember[] = JSON.parse(local);
      const filtered = list.filter(s => s.id !== staffId);
      localStorage.setItem('prime_edutech_saved_teachers', JSON.stringify(filtered));
    }
  } catch {}

  try {
    await deleteDoc(doc(db, 'teachers', staffId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface StaffAuthResult {
  success: boolean;
  staff?: StaffMember;
  error?: string;
  requiresPassword?: boolean;
  isFirstTime?: boolean;
}

// Teacher Authentication via Unique Staff ID or Registered Email & Optional Password
export async function authenticateStaffWithCredentials(
  rawInput: string,
  providedPassword?: string
): Promise<StaffAuthResult> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { success: false, error: 'Please enter your unique Staff ID or registered Email address.' };
  }

  const cleanUpper = trimmed.toUpperCase();
  const cleanLower = trimmed.toLowerCase();

  let matchedStaff: StaffMember | null = null;
  const path = 'teachers';

  // 1. Check local cache first for fast response
  try {
    const local = localStorage.getItem('prime_edutech_saved_teachers');
    if (local) {
      const list: StaffMember[] = JSON.parse(local);
      matchedStaff = list.find(
        s => (s.uniqueId && s.uniqueId.toUpperCase() === cleanUpper) ||
             (s.email && s.email.toLowerCase() === cleanLower)
      ) || null;
    }
  } catch {}

  // 2. Query Firestore if not found or to get most up to date password
  try {
    const qCode = query(collection(db, path), where('uniqueId', '==', cleanUpper));
    const snapCode = await getDocs(qCode);
    if (!snapCode.empty) {
      const docSnap = snapCode.docs[0];
      matchedStaff = { ...(docSnap.data() as StaffMember), id: docSnap.id };
    } else {
      const qEmail = query(collection(db, path), where('email', '==', cleanLower));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const docSnap = snapEmail.docs[0];
        matchedStaff = { ...(docSnap.data() as StaffMember), id: docSnap.id };
      }
    }
  } catch (err) {
    console.warn('Teacher lookup from Firestore failed, checking local default staff:', err);
  }

  // 3. Fallback to default staff roster
  if (!matchedStaff) {
    const local = DEFAULT_STAFF.find(
      s => (s.uniqueId && s.uniqueId.toUpperCase() === cleanUpper) ||
           (s.email && s.email.toLowerCase() === cleanLower)
    );
    if (local) {
      matchedStaff = { ...local };
    }
  }

  if (!matchedStaff) {
    return {
      success: false,
      error: `Access Denied: Staff ID or Email "${trimmed}" was not found in the faculty database. Please verify your credentials with the Administrator.`
    };
  }

  if (matchedStaff.status !== 'active') {
    return {
      success: false,
      error: `Your faculty account is currently marked as ${matchedStaff.status}. Please contact the institutional administrator.`
    };
  }

  // Password verification:
  if (matchedStaff.password && matchedStaff.password.trim().length > 0) {
    if (!providedPassword || providedPassword.trim().length === 0) {
      return {
        success: false,
        requiresPassword: true,
        error: 'Please enter your account password to verify your login.'
      };
    }
    if (matchedStaff.password !== providedPassword.trim()) {
      return {
        success: false,
        requiresPassword: true,
        error: 'Incorrect security password. Please re-enter your password.'
      };
    }
    return { success: true, staff: matchedStaff };
  }

  // Teacher has no password set yet (first-time login)
  return {
    success: true,
    staff: matchedStaff,
    isFirstTime: true
  };
}

// Legacy helper for direct ID lookup
export async function authenticateStaffByUniqueId(rawUniqueId: string): Promise<StaffMember | null> {
  const res = await authenticateStaffWithCredentials(rawUniqueId);
  return res.success && res.staff ? res.staff : null;
}

// Update teacher profile & password
export async function updateTeacherProfile(staffId: string, updates: Partial<StaffMember>): Promise<StaffMember> {
  const path = `teachers/${staffId}`;
  try {
    await setDoc(doc(db, 'teachers', staffId), updates, { merge: true });
    const snap = await getDoc(doc(db, 'teachers', staffId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as StaffMember;
    }
  } catch (err) {
    console.warn('Firestore update error, updating local representation:', err);
  }
  return { id: staffId, ...updates } as StaffMember;
}

export async function logoutTeacher(): Promise<void> {
  try {
    await fbSignOut(auth);
  } catch (e) {
    // Ignore sign out error
  }
}

// Classes & Subjects Management
export async function fetchSchoolClasses(): Promise<SchoolClass[]> {
  const path = 'classes';
  try {
    const snapshot = await getDocs(collection(db, path));
    if (snapshot.empty) {
      return DEFAULT_SCHOOL_CLASSES;
    }
    const classes: SchoolClass[] = [];
    snapshot.forEach(docSnap => {
      classes.push({ id: docSnap.id, ...docSnap.data() } as SchoolClass);
    });
    return classes;
  } catch (error) {
    console.warn('Fallback to local school classes:', error);
    return DEFAULT_SCHOOL_CLASSES;
  }
}

export async function saveSchoolClass(c: SchoolClass): Promise<void> {
  const path = `classes/${c.id}`;
  try {
    await setDoc(doc(db, 'classes', c.id), c, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSchoolClass(classId: string): Promise<void> {
  const path = `classes/${classId}`;
  try {
    await deleteDoc(doc(db, 'classes', classId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchSubjects(): Promise<Subject[]> {
  const path = 'subjects';
  try {
    const snapshot = await getDocs(collection(db, path));
    if (snapshot.empty) {
      return DEFAULT_SUBJECTS;
    }
    const subjects: Subject[] = [];
    snapshot.forEach(docSnap => {
      subjects.push({ id: docSnap.id, ...docSnap.data() } as Subject);
    });
    return subjects;
  } catch (error) {
    console.warn('Fallback to default subjects:', error);
    return DEFAULT_SUBJECTS;
  }
}

export async function saveSubject(sub: Subject): Promise<void> {
  const path = `subjects/${sub.id}`;
  try {
    await setDoc(doc(db, 'subjects', sub.id), sub, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const path = `subjects/${subjectId}`;
  try {
    await deleteDoc(doc(db, 'subjects', subjectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// School Settings
export async function fetchSchoolSettings(): Promise<SchoolSettings> {
  const path = 'settings/school';
  try {
    const snap = await getDoc(doc(db, 'settings', 'school'));
    if (snap.exists()) {
      const data = snap.data() as SchoolSettings;
      if (!data.schoolName || data.schoolName === 'PRIME EDUTECH' || !data.address) {
        const merged: SchoolSettings = {
          ...DEFAULT_SCHOOL_SETTINGS,
          ...data,
          schoolName: "Honey's World High School",
          address: 'Gaa Ajanaku, Ilorin, Kwara State',
          location: 'Ilorin, Kwara State, Nigeria'
        };
        saveSchoolSettings(merged).catch(() => {});
        return merged;
      }
      return data;
    }
    saveSchoolSettings(DEFAULT_SCHOOL_SETTINGS).catch(() => {});
    return DEFAULT_SCHOOL_SETTINGS;
  } catch (error) {
    return DEFAULT_SCHOOL_SETTINGS;
  }
}

export async function saveSchoolSettings(settings: SchoolSettings): Promise<void> {
  const path = 'settings/school';
  try {
    await setDoc(doc(db, 'settings', 'school'), settings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Examination Service methods
export async function fetchExaminations(filterPublishedOnly = false): Promise<Examination[]> {
  const path = 'examinations';
  try {
    let q;
    if (filterPublishedOnly) {
      q = query(collection(db, path), where('status', '==', 'published'));
    } else {
      q = collection(db, path);
    }
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return filterPublishedOnly
        ? DEFAULT_EXAMINATIONS.filter(e => e.status === 'published')
        : DEFAULT_EXAMINATIONS;
    }
    const exams: Examination[] = [];
    snapshot.forEach(docSnap => {
      exams.push({ id: docSnap.id, ...docSnap.data() } as Examination);
    });
    return exams.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('Fallback to default examinations:', error);
    return filterPublishedOnly
      ? DEFAULT_EXAMINATIONS.filter(e => e.status === 'published')
      : DEFAULT_EXAMINATIONS;
  }
}

export async function getExaminationById(examId: string): Promise<Examination | null> {
  const path = `examinations/${examId}`;
  try {
    const snap = await getDoc(doc(db, 'examinations', examId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Examination;
    }
    const defaultMatch = DEFAULT_EXAMINATIONS.find(e => e.id === examId);
    return defaultMatch || null;
  } catch (error) {
    const defaultMatch = DEFAULT_EXAMINATIONS.find(e => e.id === examId);
    return defaultMatch || null;
  }
}

export async function saveExamination(exam: Examination): Promise<void> {
  const path = `examinations/${exam.id}`;
  try {
    await setDoc(doc(db, 'examinations', exam.id), exam, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteExamination(examId: string): Promise<void> {
  const path = `examinations/${examId}`;
  try {
    await deleteDoc(doc(db, 'examinations', examId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Question Service methods
export async function fetchQuestions(examId: string): Promise<Question[]> {
  const path = `examinations/${examId}/questions`;
  try {
    const snapshot = await getDocs(collection(db, 'examinations', examId, 'questions'));
    if (snapshot.empty) {
      return DEFAULT_QUESTIONS_MAP[examId] || [];
    }
    const questions: Question[] = [];
    snapshot.forEach(docSnap => {
      questions.push({ id: docSnap.id, ...docSnap.data() } as Question);
    });
    return questions.sort((a, b) => a.questionNumber - b.questionNumber);
  } catch (error) {
    console.warn('Fallback to default questions for exam:', examId);
    return DEFAULT_QUESTIONS_MAP[examId] || [];
  }
}

export async function saveQuestion(examId: string, question: Question): Promise<void> {
  const path = `examinations/${examId}/questions/${question.id}`;
  try {
    await setDoc(doc(db, 'examinations', examId, 'questions', question.id), question, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteQuestion(examId: string, questionId: string): Promise<void> {
  const path = `examinations/${examId}/questions/${questionId}`;
  try {
    await deleteDoc(doc(db, 'examinations', examId, 'questions', questionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Student Management methods
export async function fetchStudents(classGrade?: string): Promise<Student[]> {
  const path = 'students';
  let students: Student[] = [];

  // Read local cache first
  try {
    const local = localStorage.getItem('prime_edutech_saved_students_roster');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        students = [...parsed];
      }
    }
  } catch {}

  // Fetch from Firestore
  try {
    let q;
    if (classGrade) {
      q = query(collection(db, path), where('classGrade', '==', classGrade));
    } else {
      q = collection(db, path);
    }
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const firestoreStudents: Student[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Student;
        const accessCode = data.accessCode || `PRM-${docSnap.id.slice(-4).toUpperCase()}`;
        firestoreStudents.push({ ...data, id: docSnap.id, accessCode });
      });

      // Merge: Firestore docs take priority, but retain local additions
      for (const fStu of firestoreStudents) {
        const idx = students.findIndex(s => s.id === fStu.id || s.admissionNumber.toUpperCase() === fStu.admissionNumber.toUpperCase());
        if (idx >= 0) {
          students[idx] = { ...students[idx], ...fStu };
        } else {
          students.push(fStu);
        }
      }
    } else if (students.length === 0) {
      students = [...DEFAULT_STUDENTS];
    }
  } catch (error) {
    console.warn('Fallback to default students directory:', error);
    if (students.length === 0) {
      students = [...DEFAULT_STUDENTS];
    }
  }

  // Update local cache
  try {
    localStorage.setItem('prime_edutech_saved_students_roster', JSON.stringify(students));
  } catch {}

  if (classGrade) {
    return students.filter(s => s.classGrade === classGrade);
  }
  return students;
}

export async function saveStudent(student: Student): Promise<void> {
  const path = `students/${student.id}`;
  if (!student.accessCode || student.accessCode.trim() === '') {
    student.accessCode = generateStudentAccessCode();
  }

  // Save to local cache immediately
  try {
    const local = localStorage.getItem('prime_edutech_saved_students_roster');
    let list: Student[] = local ? JSON.parse(local) : [...DEFAULT_STUDENTS];
    const idx = list.findIndex(s => s.id === student.id || s.admissionNumber.toUpperCase() === student.admissionNumber.toUpperCase());
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...student };
    } else {
      list.push(student);
    }
    localStorage.setItem('prime_edutech_saved_students_roster', JSON.stringify(list));
  } catch {}

  // Persist to Firestore
  try {
    await setDoc(doc(db, 'students', student.id), student, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteStudent(studentId: string): Promise<void> {
  const path = `students/${studentId}`;
  try {
    const local = localStorage.getItem('prime_edutech_saved_students_roster');
    if (local) {
      const list: Student[] = JSON.parse(local);
      const filtered = list.filter(s => s.id !== studentId);
      localStorage.setItem('prime_edutech_saved_students_roster', JSON.stringify(filtered));
    }
  } catch {}

  try {
    await deleteDoc(doc(db, 'students', studentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Student Authentication via Unique Passcode (e.g. PRM-4821)
export async function authenticateStudentByCode(rawCode: string): Promise<Student | null> {
  const cleanCode = rawCode.trim().toUpperCase();
  if (!cleanCode) return null;

  const path = 'students';
  try {
    // 1. Primary lookup: Match by unique accessCode
    const qCode = query(collection(db, path), where('accessCode', '==', cleanCode));
    const snapCode = await getDocs(qCode);
    if (!snapCode.empty) {
      for (const docSnap of snapCode.docs) {
        const data = docSnap.data() as Student;
        if (data.status === 'active') {
          return { ...data, id: docSnap.id, accessCode: data.accessCode || cleanCode };
        }
      }
    }

    // 2. Secondary lookup: Match by admissionNumber (in case student enters admission ID)
    const qAdm = query(collection(db, path), where('admissionNumber', '==', cleanCode));
    const snapAdm = await getDocs(qAdm);
    if (!snapAdm.empty) {
      for (const docSnap of snapAdm.docs) {
        const data = docSnap.data() as Student;
        if (data.status === 'active') {
          return { ...data, id: docSnap.id, accessCode: data.accessCode || cleanCode };
        }
      }
    }
  } catch (error) {
    console.warn('Student Firestore query by passcode fallback to local list:', error);
  }

  // Fallback lookup against default enrolled students
  const localMatch = DEFAULT_STUDENTS.find(
    s => (s.accessCode && s.accessCode.toUpperCase() === cleanCode) ||
         s.admissionNumber.toUpperCase() === cleanCode
  );

  return localMatch || null;
}

// Legacy Student Authentication: Validates Admission Number, First Name, and Surname
export async function authenticateStudent(
  admissionNumber: string,
  firstName: string,
  surnamePassword: string
): Promise<Student | null> {
  const cleanAdm = admissionNumber.trim().toUpperCase();
  const cleanFirst = firstName.trim().toLowerCase();
  const cleanSurname = surnamePassword.trim().toLowerCase();

  const path = 'students';
  try {
    const q = query(collection(db, path), where('admissionNumber', '==', cleanAdm));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Student;
        if (
          data.status === 'active' &&
          data.firstName.trim().toLowerCase() === cleanFirst &&
          data.surname.trim().toLowerCase() === cleanSurname
        ) {
          return { ...data, id: docSnap.id, accessCode: data.accessCode || `PRM-${docSnap.id.slice(-4).toUpperCase()}` };
        }
      }
    }
  } catch (error) {
    console.warn('Student Firestore query fallback to default roster:', error);
  }

  // Fallback check against default registered students
  const localMatch = DEFAULT_STUDENTS.find(
    s => s.admissionNumber.toUpperCase() === cleanAdm &&
         s.firstName.toLowerCase() === cleanFirst &&
         s.surname.toLowerCase() === cleanSurname
  );

  return localMatch || null;
}

// Asynchronously bootstrap school data to Firestore if not already present
export async function ensureInitialSchoolData(): Promise<void> {
  try {
    const examSnap = await getDocs(collection(db, 'examinations'));
    if (examSnap.empty) {
      // 1. Seed classes
      for (const cls of DEFAULT_SCHOOL_CLASSES) {
        await saveSchoolClass(cls).catch(() => {});
      }
      // 2. Seed subjects
      for (const sub of DEFAULT_SUBJECTS) {
        await saveSubject(sub).catch(() => {});
      }
      // 3. Seed students
      for (const std of DEFAULT_STUDENTS) {
        await saveStudent(std).catch(() => {});
      }
      // 4. Seed faculty staff
      for (const staff of DEFAULT_STAFF) {
        await saveStaffMember(staff).catch(() => {});
      }
      // 5. Seed exams & questions
      for (const exam of DEFAULT_EXAMINATIONS) {
        await saveExamination(exam).catch(() => {});
        const qs = DEFAULT_QUESTIONS_MAP[exam.id] || [];
        for (const q of qs) {
          await saveQuestion(exam.id, q).catch(() => {});
        }
      }
    } else {
      // Check teachers collection specifically
      const staffSnap = await getDocs(collection(db, 'teachers'));
      if (staffSnap.empty) {
        for (const staff of DEFAULT_STAFF) {
          await saveStaffMember(staff).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('Initial school data ensure notice:', err);
  }
}

// Exam Attempts & Disconnection Recovery
export async function createExamAttempt(attempt: ExamAttempt): Promise<void> {
  const path = `attempts/${attempt.id}`;
  try {
    await setDoc(doc(db, 'attempts', attempt.id), attempt);
    // Also save in localStorage for client-side offline tolerance
    localStorage.setItem(`prime_cbt_attempt_${attempt.id}`, JSON.stringify(attempt));
  } catch (error) {
    console.warn('Attempt cached in localStorage:', error);
    localStorage.setItem(`prime_cbt_attempt_${attempt.id}`, JSON.stringify(attempt));
  }
}

export async function getExamAttempt(attemptId: string): Promise<ExamAttempt | null> {
  const path = `attempts/${attemptId}`;
  try {
    const snap = await getDoc(doc(db, 'attempts', attemptId));
    if (snap.exists()) {
      return snap.data() as ExamAttempt;
    }
    const local = localStorage.getItem(`prime_cbt_attempt_${attemptId}`);
    return local ? JSON.parse(local) : null;
  } catch (error) {
    const local = localStorage.getItem(`prime_cbt_attempt_${attemptId}`);
    return local ? JSON.parse(local) : null;
  }
}

export async function updateExamAttemptProgress(
  attemptId: string,
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>,
  flagged?: Record<string, boolean>
): Promise<void> {
  const path = `attempts/${attemptId}`;
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'attempts', attemptId), {
      savedAnswers: answers,
      flaggedQuestions: flagged || {},
      lastHeartbeatAt: now
    });
  } catch (err) {
    // Keep local cache up to date even if network drops
    const local = localStorage.getItem(`prime_cbt_attempt_${attemptId}`);
    if (local) {
      const parsed = JSON.parse(local);
      parsed.savedAnswers = answers;
      parsed.flaggedQuestions = flagged;
      parsed.lastHeartbeatAt = now;
      localStorage.setItem(`prime_cbt_attempt_${attemptId}`, JSON.stringify(parsed));
    }
  }
}

// Submissions & Results
export async function saveSubmission(submission: Submission): Promise<string> {
  const path = 'submissions';
  try {
    const docRef = doc(collection(db, path));
    const subWithId = { ...submission, id: docRef.id };
    await setDoc(docRef, subWithId);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchSubmissions(examId?: string, studentId?: string): Promise<Submission[]> {
  const path = 'submissions';
  try {
    let q;
    if (examId && studentId) {
      q = query(
        collection(db, path),
        where('examId', '==', examId),
        where('studentId', '==', studentId)
      );
    } else if (examId) {
      q = query(collection(db, path), where('examId', '==', examId));
    } else if (studentId) {
      q = query(collection(db, path), where('studentId', '==', studentId));
    } else {
      q = collection(db, path);
    }
    const snapshot = await getDocs(q);
    const submissions: Submission[] = [];
    snapshot.forEach(docSnap => {
      submissions.push({ id: docSnap.id, ...docSnap.data() } as Submission);
    });
    return submissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// Continuous Assessment / Master Gradebook Records
export async function fetchAssessmentRecords(
  subjectId?: string,
  classGrade?: string,
  academicSession?: string,
  term?: string
): Promise<StudentAssessmentRecord[]> {
  const path = 'caRecords';
  try {
    const qList: any[] = [];
    if (subjectId) qList.push(where('subjectId', '==', subjectId));
    if (classGrade) qList.push(where('classGrade', '==', classGrade));
    if (academicSession) qList.push(where('academicSession', '==', academicSession));
    if (term) qList.push(where('term', '==', term));

    const q = qList.length > 0 ? query(collection(db, path), ...qList) : collection(db, path);
    const snapshot = await getDocs(q);
    const records: StudentAssessmentRecord[] = [];
    snapshot.forEach(docSnap => {
      records.push({ id: docSnap.id, ...docSnap.data() } as StudentAssessmentRecord);
    });
    return records;
  } catch (error) {
    console.warn('Fallback fetching CA records from local cache:', error);
    try {
      const local = localStorage.getItem('prime_edutech_ca_records');
      if (local) {
        const parsed: StudentAssessmentRecord[] = JSON.parse(local);
        return parsed.filter(r => {
          if (subjectId && r.subjectId !== subjectId) return false;
          if (classGrade && r.classGrade !== classGrade) return false;
          if (academicSession && r.academicSession !== academicSession) return false;
          if (term && r.term !== term) return false;
          return true;
        });
      }
    } catch {}
    return [];
  }
}

export async function saveAssessmentRecord(record: StudentAssessmentRecord): Promise<void> {
  const sanitizedId = (record.id || `ca_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  record.id = sanitizedId;
  const path = `caRecords/${sanitizedId}`;
  try {
    await setDoc(doc(db, 'caRecords', sanitizedId), record, { merge: true });
  } catch (error) {
    console.warn('Firestore write warning for caRecord, falling back to local cache:', error);
  }

  // Always mirror in localStorage for instant offline access
  try {
    const local = localStorage.getItem('prime_edutech_ca_records');
    const records: StudentAssessmentRecord[] = local ? JSON.parse(local) : [];
    const filtered = records.filter(r => r.id !== record.id);
    filtered.push(record);
    localStorage.setItem('prime_edutech_ca_records', JSON.stringify(filtered));
  } catch {}

  // Broadcast real-time score update event across components & tabs
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('caRecordsUpdated', { detail: record }));
  }
}

export async function saveAssessmentBatch(records: StudentAssessmentRecord[]): Promise<void> {
  for (const record of records) {
    await saveAssessmentRecord(record);
  }
}

export async function deleteAssessmentRecord(recordId: string): Promise<void> {
  const cleanId = recordId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `caRecords/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'caRecords', cleanId));
  } catch (error) {
    console.warn('Firestore CA delete warning:', error);
  }

  try {
    const local = localStorage.getItem('prime_edutech_ca_records');
    if (local) {
      const records: StudentAssessmentRecord[] = JSON.parse(local);
      const filtered = records.filter(r => r.id !== cleanId);
      localStorage.setItem('prime_edutech_ca_records', JSON.stringify(filtered));
    }
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('caRecordsUpdated', { detail: { id: cleanId, deleted: true } }));
  }
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  const path = `submissions/${submissionId}`;
  try {
    await deleteDoc(doc(db, 'submissions', submissionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Real-time listener for a student's continuous assessment records across all subjects
export function subscribeStudentAssessmentRecords(
  studentId: string,
  admissionNumber: string,
  callback: (records: StudentAssessmentRecord[]) => void
): () => void {
  const path = 'caRecords';
  let unsubFirestore: (() => void) | null = null;

  const triggerFromLocalCache = () => {
    try {
      const local = localStorage.getItem('prime_edutech_ca_records');
      if (local) {
        const parsed: StudentAssessmentRecord[] = JSON.parse(local);
        const matched = parsed.filter(
          r => r.studentId === studentId || (r.admissionNumber && r.admissionNumber.toUpperCase() === admissionNumber.toUpperCase())
        );
        callback(matched);
      }
    } catch {}
  };

  // Immediate local cache dispatch
  triggerFromLocalCache();

  try {
    const q = collection(db, path);
    unsubFirestore = onSnapshot(
      q,
      snapshot => {
        const records: StudentAssessmentRecord[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as StudentAssessmentRecord;
          if (
            data.studentId === studentId ||
            (data.admissionNumber && data.admissionNumber.toUpperCase() === admissionNumber.toUpperCase())
          ) {
            records.push({ ...data, id: docSnap.id });
          }
        });

        // Merge any local unsynced records
        try {
          const local = localStorage.getItem('prime_edutech_ca_records');
          if (local) {
            const parsed: StudentAssessmentRecord[] = JSON.parse(local);
            parsed.forEach(lr => {
              if (
                (lr.studentId === studentId || lr.admissionNumber.toUpperCase() === admissionNumber.toUpperCase()) &&
                !records.some(r => r.id === lr.id)
              ) {
                records.push(lr);
              }
            });
          }
        } catch {}

        callback(records);
      },
      err => {
        console.warn('Real-time score listener fallback:', err);
        triggerFromLocalCache();
      }
    );
  } catch (error) {
    console.warn('Firestore onSnapshot error, falling back to local events:', error);
  }

  // Cross-tab and local broadcast listener
  const handleLocalUpdate = () => triggerFromLocalCache();
  if (typeof window !== 'undefined') {
    window.addEventListener('caRecordsUpdated', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);
  }

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('caRecordsUpdated', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    }
  };
}

// Fetch cumulative records across all terms for a student
export async function fetchStudentAllAssessmentRecords(
  studentId: string,
  admissionNumber: string
): Promise<StudentAssessmentRecord[]> {
  const path = 'caRecords';
  try {
    const q = collection(db, path);
    const snapshot = await getDocs(q);
    const records: StudentAssessmentRecord[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as StudentAssessmentRecord;
      if (
        data.studentId === studentId ||
        (data.admissionNumber && data.admissionNumber.toUpperCase() === admissionNumber.toUpperCase())
      ) {
        records.push({ ...data, id: docSnap.id });
      }
    });

    // Check local cache
    try {
      const local = localStorage.getItem('prime_edutech_ca_records');
      if (local) {
        const parsed: StudentAssessmentRecord[] = JSON.parse(local);
        parsed.forEach(lr => {
          if (
            (lr.studentId === studentId || lr.admissionNumber.toUpperCase() === admissionNumber.toUpperCase()) &&
            !records.some(r => r.id === lr.id)
          ) {
            records.push(lr);
          }
        });
      }
    } catch {}

    return records;
  } catch (err) {
    console.warn('Fallback fetching cumulative student records:', err);
    try {
      const local = localStorage.getItem('prime_edutech_ca_records');
      if (local) {
        const parsed: StudentAssessmentRecord[] = JSON.parse(local);
        return parsed.filter(
          r => r.studentId === studentId || r.admissionNumber.toUpperCase() === admissionNumber.toUpperCase()
        );
      }
    } catch {}
    return [];
  }
}

// Update student profile (passport, email, password, etc.)
export async function updateStudentProfile(
  studentId: string,
  updates: Partial<Student>
): Promise<Student> {
  const path = `students/${studentId}`;
  try {
    await updateDoc(doc(db, 'students', studentId), updates);
  } catch (error) {
    try {
      await setDoc(doc(db, 'students', studentId), updates, { merge: true });
    } catch (err) {
      console.warn('Firestore write warning for student profile:', err);
    }
  }

  // Update in localStorage
  try {
    const stored = localStorage.getItem('prime_edutech_saved_students');
    if (stored) {
      const list = JSON.parse(stored);
      const updatedList = list.map((s: any) =>
        s.id === studentId || s.admissionNumber === updates.admissionNumber ? { ...s, ...updates } : s
      );
      localStorage.setItem('prime_edutech_saved_students', JSON.stringify(updatedList));
    }
  } catch {}

  return updates as Student;
}

// Comprehensive Student Authentication (Passcode, Admission No, or Connected Email + Password)
export async function authenticateStudentWithCredentials(
  identifier: string,
  password?: string
): Promise<{ success: boolean; student?: Student; error?: string }> {
  const cleanId = identifier.trim();
  if (!cleanId) {
    return { success: false, error: 'Please enter your unique Passcode, Admission Number, or Connected Email.' };
  }

  const path = 'students';
  try {
    const allStudents = await fetchStudents();
    const cleanUpper = cleanId.toUpperCase();
    const cleanLower = cleanId.toLowerCase();

    // 1. Match by Email
    const byEmail = allStudents.find(s => s.email && s.email.toLowerCase() === cleanLower);
    if (byEmail) {
      if (byEmail.password) {
        if (!password || password.trim() !== byEmail.password) {
          return { success: false, error: 'Incorrect personal security password. Please re-enter your password.' };
        }
      }
      return { success: true, student: byEmail };
    }

    // 2. Match by Passcode or Admission Number
    const byCode = allStudents.find(
      s => (s.accessCode && s.accessCode.toUpperCase() === cleanUpper) || s.admissionNumber.toUpperCase() === cleanUpper
    );
    if (byCode) {
      if (byCode.password && password && password.trim() !== byCode.password) {
        return { success: false, error: 'Invalid password. You have set a personal password for this account.' };
      }
      return { success: true, student: byCode };
    }
  } catch (err) {
    console.warn('Student authentication check fallback:', err);
  }

  // Local fallback
  const fallback = DEFAULT_STUDENTS.find(
    s => (s.accessCode && s.accessCode.toUpperCase() === cleanId.toUpperCase()) ||
         s.admissionNumber.toUpperCase() === cleanId.toUpperCase()
  );
  if (fallback) {
    return { success: true, student: fallback };
  }

  return {
    success: false,
    error: `No student profile found for "${cleanId}". Please verify your credentials or ask your subject teacher.`
  };
}
