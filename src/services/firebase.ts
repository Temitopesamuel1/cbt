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
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
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
  AdminUser,
  ChatMessage,
  LessonNote,
  StudentTermReportData,
  DEFAULT_PSYCHOMOTOR,
  DEFAULT_SKILLS,
  resolveCaWeights
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
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = dbInstance;
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
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (msg.includes('client is offline') || msg.includes('unavailable') || msg.includes('respond')) {
      console.warn('Firebase client operating with cached persistence while reconnecting.');
      return false;
    }
    return true;
  }
}

// Deeply strip undefined properties so Firestore setDoc/updateDoc never throws
export function sanitizeFirestoreData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => sanitizeFirestoreData(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(value as Record<string, any>)) {
      if (val !== undefined) {
        cleaned[key] = sanitizeFirestoreData(val);
      }
    }
    return cleaned as T;
  }
  return value;
}

// Await Firestore write up to 2s for fast UI response while IndexedDB localCache finishes sync cleanly
async function commitFirestoreFast(
  writePromise: Promise<unknown>,
  operationType: OperationType,
  path: string
): Promise<void> {
  const guarded = writePromise.catch((error: unknown) => {
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    if (
      msg.includes('offline') ||
      msg.includes('unavailable') ||
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('could not reach')
    ) {
      console.warn(`Firestore ${operationType} queued offline for ${path}:`, error);
      return;
    }
    handleFirestoreError(error, operationType, path);
  });

  await Promise.race([
    guarded,
    new Promise<void>(resolve => setTimeout(resolve, 1800))
  ]);
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

// =========================================================================
// Faculty & Staff Management (Real-Time Sync + Offline Cache + Tombstones)
// =========================================================================
const SAVED_TEACHERS_KEY = 'prime_edutech_saved_teachers';
const DELETED_STAFF_KEY = 'prime_edutech_deleted_staff_ids';
const SAVED_CLASSES_KEY = 'prime_edutech_saved_classes';
const DELETED_CLASSES_KEY = 'prime_edutech_deleted_class_ids';
const SAVED_SUBJECTS_KEY = 'prime_edutech_saved_subjects';
const DELETED_SUBJECTS_KEY = 'prime_edutech_deleted_subject_ids';

function getTombstoneSet(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function addTombstone(storageKey: string, id: string) {
  try {
    const set = getTombstoneSet(storageKey);
    set.add(id);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(set)));
  } catch {}
}

function removeTombstone(storageKey: string, id: string) {
  try {
    const set = getTombstoneSet(storageKey);
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(storageKey, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

function broadcastEntitySync(windowEvent: string, channelType: string, detail: any = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(windowEvent, { detail }));
    try {
      const bc = new BroadcastChannel('prime_cbt_sync_channel');
      bc.postMessage({ type: channelType, ...detail, timestamp: Date.now() });
      bc.close();
    } catch {}
  }
}

const pickNewerStaff = (existing: StaffMember | undefined, incoming: StaffMember): StaffMember => {
  if (!existing) return incoming;
  const tExisting = new Date(existing.updatedAt || existing.createdAt || 0).getTime() || 0;
  const tIncoming = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime() || 0;
  if (tIncoming > tExisting) {
    return { ...existing, ...incoming };
  }
  if (tExisting > tIncoming) {
    return { ...incoming, ...existing };
  }
  return { ...existing, ...incoming };
};

function readLocalStaffList(): StaffMember[] {
  const deleted = getTombstoneSet(DELETED_STAFF_KEY);
  try {
    const local = localStorage.getItem(SAVED_TEACHERS_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        return parsed.filter((s: StaffMember) => s && s.id && !deleted.has(s.id));
      }
    }
  } catch {}
  return DEFAULT_STAFF.filter(s => !deleted.has(s.id));
}

function writeLocalStaffList(list: StaffMember[]) {
  try {
    localStorage.setItem(SAVED_TEACHERS_KEY, JSON.stringify(list));
  } catch {}
}

export async function fetchStaffMembers(): Promise<StaffMember[]> {
  const path = 'teachers';
  const deleted = getTombstoneSet(DELETED_STAFF_KEY);
  const mergedMap = new Map<string, StaffMember>();

  // 1. Read local cache first
  const localStaff = readLocalStaffList();
  for (const s of localStaff) {
    if (!deleted.has(s.id)) mergedMap.set(s.id, s);
  }

  // 2. Fetch live from Firestore
  try {
    const snapshot = await getDocs(collection(db, path));
    if (!snapshot.empty) {
      snapshot.forEach(docSnap => {
        if (deleted.has(docSnap.id)) return;
        const fStaff = { id: docSnap.id, ...docSnap.data() } as StaffMember;
        mergedMap.set(fStaff.id, pickNewerStaff(mergedMap.get(fStaff.id), fStaff));
      });
    } else if (mergedMap.size === 0) {
      DEFAULT_STAFF.filter(s => !deleted.has(s.id)).forEach(s => mergedMap.set(s.id, s));
    }
  } catch (error) {
    console.warn('Fallback to cached staff roster:', error);
    if (mergedMap.size === 0) {
      DEFAULT_STAFF.filter(s => !deleted.has(s.id)).forEach(s => mergedMap.set(s.id, s));
    }
  }

  const finalStaff = Array.from(mergedMap.values());
  writeLocalStaffList(finalStaff);
  return finalStaff;
}

export async function saveStaffMember(staff: StaffMember): Promise<StaffMember> {
  const path = `teachers/${staff.id}`;
  removeTombstone(DELETED_STAFF_KEY, staff.id);

  const normalizedUniqueId =
    staff.uniqueId && staff.uniqueId.trim() !== ''
      ? staff.uniqueId.trim().toUpperCase()
      : generateStaffUniqueId();

  const cleanStaff = sanitizeFirestoreData<StaffMember>({
    ...staff,
    uniqueId: normalizedUniqueId,
    assignedSubjectIds: Array.isArray(staff.assignedSubjectIds) ? staff.assignedSubjectIds : [],
    assignedSubjectNames: Array.isArray(staff.assignedSubjectNames) ? staff.assignedSubjectNames : [],
    assignedClasses: Array.isArray(staff.assignedClasses) ? staff.assignedClasses : [],
    updatedAt: new Date().toISOString()
  });

  // 1. Update local cache immediately
  try {
    const list = readLocalStaffList();
    const idx = list.findIndex(s => s.id === cleanStaff.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...cleanStaff };
    } else {
      list.unshift(cleanStaff);
    }
    writeLocalStaffList(list);
  } catch {}

  // 2. Broadcast real-time update immediately across portals & tabs
  broadcastEntitySync('staffUpdated', 'STAFF_UPDATED', { staff: cleanStaff, staffId: cleanStaff.id });

  // 3. Persist to Firestore fast (queued in IndexedDB immediately + synced to backend)
  await commitFirestoreFast(
    setDoc(doc(db, 'teachers', cleanStaff.id), cleanStaff, { merge: true }),
    OperationType.WRITE,
    path
  );

  return cleanStaff;
}

export async function deleteStaffMember(staffId: string): Promise<void> {
  const path = `teachers/${staffId}`;
  addTombstone(DELETED_STAFF_KEY, staffId);

  try {
    const list = readLocalStaffList().filter(s => s.id !== staffId);
    writeLocalStaffList(list);
  } catch {}

  broadcastEntitySync('staffUpdated', 'STAFF_UPDATED', { staffId, deleted: true });

  await commitFirestoreFast(
    deleteDoc(doc(db, 'teachers', staffId)),
    OperationType.DELETE,
    path
  );
}

export function subscribeStaffMembers(callback: (staff: StaffMember[]) => void): () => void {
  let firestoreList: StaffMember[] = [];
  let hasRemote = false;

  const emitMerged = () => {
    const deleted = getTombstoneSet(DELETED_STAFF_KEY);
    const merged = new Map<string, StaffMember>();

    readLocalStaffList().forEach(s => {
      if (!deleted.has(s.id)) merged.set(s.id, s);
    });

    if (hasRemote) {
      firestoreList.forEach(fs => {
        if (!deleted.has(fs.id)) {
          merged.set(fs.id, pickNewerStaff(merged.get(fs.id), fs));
        }
      });
    }

    const result = Array.from(merged.values());
    writeLocalStaffList(result);
    callback(result);
  };

  // Immediate local emit
  emitMerged();

  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'teachers'),
      snapshot => {
        hasRemote = true;
        const remote: StaffMember[] = [];
        snapshot.forEach(docSnap => {
          remote.push({ id: docSnap.id, ...docSnap.data() } as StaffMember);
        });
        firestoreList = remote;
        emitMerged();
      },
      err => {
        console.warn('Staff snapshot listener fallback:', err);
      }
    );
  } catch (err) {
    console.warn('Unable to attach staff snapshot:', err);
  }

  const onSync = () => emitMerged();
  if (typeof window !== 'undefined') {
    window.addEventListener('staffUpdated', onSync);
    window.addEventListener('storage', onSync);
  }

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('prime_cbt_sync_channel');
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'STAFF_UPDATED') onSync();
    };
  } catch {}

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('staffUpdated', onSync);
      window.removeEventListener('storage', onSync);
    }
    if (bc) {
      try { bc.close(); } catch {}
    }
  };
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
    const list = readLocalStaffList();
    matchedStaff = list.find(
      s => (s.uniqueId && s.uniqueId.toUpperCase() === cleanUpper) ||
           (s.email && s.email.toLowerCase() === cleanLower)
    ) || null;
  } catch {}

  // 2. Query Firestore to get latest profile, password & assigned subjects
  try {
    const qCode = query(collection(db, path), where('uniqueId', '==', cleanUpper));
    const snapCode = await getDocs(qCode);
    if (!snapCode.empty) {
      const docSnap = snapCode.docs[0];
      const remote = { ...(docSnap.data() as StaffMember), id: docSnap.id };
      matchedStaff = pickNewerStaff(matchedStaff || undefined, remote);
    } else {
      const qEmail = query(collection(db, path), where('email', '==', cleanLower));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const docSnap = snapEmail.docs[0];
        const remote = { ...(docSnap.data() as StaffMember), id: docSnap.id };
        matchedStaff = pickNewerStaff(matchedStaff || undefined, remote);
      }
    }
  } catch (err) {
    console.warn('Teacher lookup from Firestore failed, checking local default staff:', err);
  }

  // 3. Fallback to default staff roster (only if not deleted)
  if (!matchedStaff) {
    const deleted = getTombstoneSet(DELETED_STAFF_KEY);
    const local = DEFAULT_STAFF.find(
      s => !deleted.has(s.id) &&
           ((s.uniqueId && s.uniqueId.toUpperCase() === cleanUpper) ||
            (s.email && s.email.toLowerCase() === cleanLower))
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

// Update teacher profile & password with immediate local + cross-tab + Firestore sync
export async function updateTeacherProfile(staffId: string, updates: Partial<StaffMember>): Promise<StaffMember> {
  const path = `teachers/${staffId}`;
  const cleanUpdates = sanitizeFirestoreData<Partial<StaffMember>>({
    ...updates,
    updatedAt: new Date().toISOString()
  });

  // 1. Update local cache immediately and build merged StaffMember
  let mergedStaff: StaffMember = { id: staffId, ...cleanUpdates } as StaffMember;
  try {
    const list = readLocalStaffList();
    const idx = list.findIndex(s => s.id === staffId);
    if (idx >= 0) {
      mergedStaff = { ...list[idx], ...cleanUpdates };
      list[idx] = mergedStaff;
    } else {
      list.unshift(mergedStaff);
    }
    writeLocalStaffList(list);
  } catch {}

  // Update active session if it belongs to this teacher
  try {
    const activeRaw = sessionStorage.getItem('prime_edutech_active_teacher');
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw) as StaffMember;
      if (parsed.id === staffId) {
        mergedStaff = { ...parsed, ...mergedStaff };
        sessionStorage.setItem('prime_edutech_active_teacher', JSON.stringify(mergedStaff));
      }
    }
  } catch {}

  // 2. Broadcast immediately across all portals & tabs
  broadcastEntitySync('staffUpdated', 'STAFF_UPDATED', { staff: mergedStaff, staffId });

  // 3. Persist to Firestore
  await commitFirestoreFast(
    setDoc(doc(db, 'teachers', staffId), cleanUpdates, { merge: true }),
    OperationType.WRITE,
    path
  );

  return mergedStaff;
}

export async function logoutTeacher(): Promise<void> {
  try {
    await fbSignOut(auth);
  } catch (e) {
    // Ignore sign out error
  }
}

// =========================================================================
// Classes & Subjects Management (Real-Time Sync + Offline Cache + Tombstones)
// =========================================================================
function readLocalClassesList(): SchoolClass[] {
  const deleted = getTombstoneSet(DELETED_CLASSES_KEY);
  try {
    const raw = localStorage.getItem(SAVED_CLASSES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((c: SchoolClass) => c && c.id && !deleted.has(c.id));
      }
    }
  } catch {}
  return DEFAULT_SCHOOL_CLASSES.filter(c => !deleted.has(c.id));
}

function writeLocalClassesList(list: SchoolClass[]) {
  try {
    localStorage.setItem(SAVED_CLASSES_KEY, JSON.stringify(list));
  } catch {}
}

export async function fetchSchoolClasses(): Promise<SchoolClass[]> {
  const path = 'classes';
  const deleted = getTombstoneSet(DELETED_CLASSES_KEY);
  const mergedMap = new Map<string, SchoolClass>();

  readLocalClassesList().forEach(c => {
    if (!deleted.has(c.id)) mergedMap.set(c.id, c);
  });

  try {
    const snapshot = await getDocs(collection(db, path));
    if (!snapshot.empty) {
      snapshot.forEach(docSnap => {
        if (deleted.has(docSnap.id)) return;
        const fc = { id: docSnap.id, ...docSnap.data() } as SchoolClass;
        mergedMap.set(fc.id, { ...(mergedMap.get(fc.id) || {}), ...fc });
      });
    } else if (mergedMap.size === 0) {
      DEFAULT_SCHOOL_CLASSES.filter(c => !deleted.has(c.id)).forEach(c => mergedMap.set(c.id, c));
    }
  } catch (error) {
    console.warn('Fallback to cached school classes:', error);
    if (mergedMap.size === 0) {
      DEFAULT_SCHOOL_CLASSES.filter(c => !deleted.has(c.id)).forEach(c => mergedMap.set(c.id, c));
    }
  }

  const finalClasses = Array.from(mergedMap.values());
  writeLocalClassesList(finalClasses);
  return finalClasses;
}

export async function saveSchoolClass(c: SchoolClass): Promise<void> {
  const path = `classes/${c.id}`;
  removeTombstone(DELETED_CLASSES_KEY, c.id);
  const cleanClass = sanitizeFirestoreData(c);

  try {
    const list = readLocalClassesList();
    const idx = list.findIndex(item => item.id === cleanClass.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...cleanClass };
    else list.push(cleanClass);
    writeLocalClassesList(list);
  } catch {}

  broadcastEntitySync('classesUpdated', 'CLASSES_UPDATED', { classObj: cleanClass, classId: cleanClass.id });

  await commitFirestoreFast(
    setDoc(doc(db, 'classes', cleanClass.id), cleanClass, { merge: true }),
    OperationType.WRITE,
    path
  );
}

export async function deleteSchoolClass(classId: string): Promise<void> {
  const path = `classes/${classId}`;
  addTombstone(DELETED_CLASSES_KEY, classId);

  try {
    const list = readLocalClassesList().filter(c => c.id !== classId);
    writeLocalClassesList(list);
  } catch {}

  broadcastEntitySync('classesUpdated', 'CLASSES_UPDATED', { classId, deleted: true });

  await commitFirestoreFast(
    deleteDoc(doc(db, 'classes', classId)),
    OperationType.DELETE,
    path
  );
}

export function subscribeSchoolClasses(callback: (classes: SchoolClass[]) => void): () => void {
  let firestoreList: SchoolClass[] = [];
  let hasRemote = false;

  const emitMerged = () => {
    const deleted = getTombstoneSet(DELETED_CLASSES_KEY);
    const merged = new Map<string, SchoolClass>();
    readLocalClassesList().forEach(c => {
      if (!deleted.has(c.id)) merged.set(c.id, c);
    });
    if (hasRemote) {
      firestoreList.forEach(fc => {
        if (!deleted.has(fc.id)) merged.set(fc.id, { ...(merged.get(fc.id) || {}), ...fc });
      });
    }
    const result = Array.from(merged.values());
    writeLocalClassesList(result);
    callback(result);
  };

  emitMerged();

  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'classes'),
      snapshot => {
        hasRemote = true;
        const remote: SchoolClass[] = [];
        snapshot.forEach(docSnap => {
          remote.push({ id: docSnap.id, ...docSnap.data() } as SchoolClass);
        });
        firestoreList = remote;
        emitMerged();
      },
      err => {
        console.warn('Classes snapshot fallback:', err);
      }
    );
  } catch {}

  const onSync = () => emitMerged();
  if (typeof window !== 'undefined') {
    window.addEventListener('classesUpdated', onSync);
    window.addEventListener('storage', onSync);
  }

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('prime_cbt_sync_channel');
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'CLASSES_UPDATED') onSync();
    };
  } catch {}

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('classesUpdated', onSync);
      window.removeEventListener('storage', onSync);
    }
    if (bc) {
      try { bc.close(); } catch {}
    }
  };
}

function readLocalSubjectsList(): Subject[] {
  const deleted = getTombstoneSet(DELETED_SUBJECTS_KEY);
  try {
    const raw = localStorage.getItem(SAVED_SUBJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((s: Subject) => s && s.id && !deleted.has(s.id));
      }
    }
  } catch {}
  return DEFAULT_SUBJECTS.filter(s => !deleted.has(s.id));
}

function writeLocalSubjectsList(list: Subject[]) {
  try {
    localStorage.setItem(SAVED_SUBJECTS_KEY, JSON.stringify(list));
  } catch {}
}

export async function fetchSubjects(): Promise<Subject[]> {
  const path = 'subjects';
  const deleted = getTombstoneSet(DELETED_SUBJECTS_KEY);
  const mergedMap = new Map<string, Subject>();

  readLocalSubjectsList().forEach(s => {
    if (!deleted.has(s.id)) mergedMap.set(s.id, s);
  });

  try {
    const snapshot = await getDocs(collection(db, path));
    if (!snapshot.empty) {
      snapshot.forEach(docSnap => {
        if (deleted.has(docSnap.id)) return;
        const fs = { id: docSnap.id, ...docSnap.data() } as Subject;
        mergedMap.set(fs.id, { ...(mergedMap.get(fs.id) || {}), ...fs });
      });
    } else if (mergedMap.size === 0) {
      DEFAULT_SUBJECTS.filter(s => !deleted.has(s.id)).forEach(s => mergedMap.set(s.id, s));
    }
  } catch (error) {
    console.warn('Fallback to cached subjects:', error);
    if (mergedMap.size === 0) {
      DEFAULT_SUBJECTS.filter(s => !deleted.has(s.id)).forEach(s => mergedMap.set(s.id, s));
    }
  }

  const finalSubjects = Array.from(mergedMap.values());
  writeLocalSubjectsList(finalSubjects);
  return finalSubjects;
}

export async function saveSubject(sub: Subject): Promise<void> {
  const path = `subjects/${sub.id}`;
  removeTombstone(DELETED_SUBJECTS_KEY, sub.id);
  const cleanSub = sanitizeFirestoreData(sub);

  try {
    const list = readLocalSubjectsList();
    const idx = list.findIndex(item => item.id === cleanSub.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...cleanSub };
    else list.push(cleanSub);
    writeLocalSubjectsList(list);
  } catch {}

  broadcastEntitySync('subjectsUpdated', 'SUBJECTS_UPDATED', { subject: cleanSub, subjectId: cleanSub.id });

  await commitFirestoreFast(
    setDoc(doc(db, 'subjects', cleanSub.id), cleanSub, { merge: true }),
    OperationType.WRITE,
    path
  );
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const path = `subjects/${subjectId}`;
  addTombstone(DELETED_SUBJECTS_KEY, subjectId);

  try {
    const list = readLocalSubjectsList().filter(s => s.id !== subjectId);
    writeLocalSubjectsList(list);
  } catch {}

  broadcastEntitySync('subjectsUpdated', 'SUBJECTS_UPDATED', { subjectId, deleted: true });

  await commitFirestoreFast(
    deleteDoc(doc(db, 'subjects', subjectId)),
    OperationType.DELETE,
    path
  );
}

export function subscribeSubjects(callback: (subjects: Subject[]) => void): () => void {
  let firestoreList: Subject[] = [];
  let hasRemote = false;

  const emitMerged = () => {
    const deleted = getTombstoneSet(DELETED_SUBJECTS_KEY);
    const merged = new Map<string, Subject>();
    readLocalSubjectsList().forEach(s => {
      if (!deleted.has(s.id)) merged.set(s.id, s);
    });
    if (hasRemote) {
      firestoreList.forEach(fs => {
        if (!deleted.has(fs.id)) merged.set(fs.id, { ...(merged.get(fs.id) || {}), ...fs });
      });
    }
    const result = Array.from(merged.values());
    writeLocalSubjectsList(result);
    callback(result);
  };

  emitMerged();

  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'subjects'),
      snapshot => {
        hasRemote = true;
        const remote: Subject[] = [];
        snapshot.forEach(docSnap => {
          remote.push({ id: docSnap.id, ...docSnap.data() } as Subject);
        });
        firestoreList = remote;
        emitMerged();
      },
      err => {
        console.warn('Subjects snapshot fallback:', err);
      }
    );
  } catch {}

  const onSync = () => emitMerged();
  if (typeof window !== 'undefined') {
    window.addEventListener('subjectsUpdated', onSync);
    window.addEventListener('storage', onSync);
  }

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('prime_cbt_sync_channel');
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'SUBJECTS_UPDATED') onSync();
    };
  } catch {}

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('subjectsUpdated', onSync);
      window.removeEventListener('storage', onSync);
    }
    if (bc) {
      try { bc.close(); } catch {}
    }
  };
}

// School Settings
export async function fetchSchoolSettings(): Promise<SchoolSettings> {
  const path = 'settings/school';
  let localCached: SchoolSettings | null = null;
  try {
    const raw = localStorage.getItem('prime_edutech_school_settings');
    if (raw) {
      const parsed = JSON.parse(raw) as SchoolSettings;
      localCached = { ...parsed, caWeights: resolveCaWeights(parsed.caWeights) };
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, 'settings', 'school'));
    if (snap.exists()) {
      const data = snap.data() as SchoolSettings;
      const normalizedWeights = resolveCaWeights(data.caWeights);
      if (!data.schoolName || data.schoolName === 'PRIME EDUTECH' || !data.address) {
        const merged: SchoolSettings = {
          ...DEFAULT_SCHOOL_SETTINGS,
          ...data,
          schoolName: "Honey's World High School",
          address: 'Gaa Ajanaku, Ilorin, Kwara State',
          location: 'Ilorin, Kwara State, Nigeria',
          caWeights: normalizedWeights
        };
        saveSchoolSettings(merged).catch(() => {});
        return merged;
      }
      const normalized: SchoolSettings = {
        ...(localCached || DEFAULT_SCHOOL_SETTINGS),
        ...data,
        caWeights: normalizedWeights
      };
      try {
        localStorage.setItem('prime_edutech_school_settings', JSON.stringify(normalized));
      } catch {}
      return normalized;
    }
    if (localCached) return localCached;
    const defaultWithWeights: SchoolSettings = {
      ...DEFAULT_SCHOOL_SETTINGS,
      caWeights: resolveCaWeights(DEFAULT_SCHOOL_SETTINGS.caWeights)
    };
    saveSchoolSettings(defaultWithWeights).catch(() => {});
    return defaultWithWeights;
  } catch (error) {
    return localCached || {
      ...DEFAULT_SCHOOL_SETTINGS,
      caWeights: resolveCaWeights(DEFAULT_SCHOOL_SETTINGS.caWeights)
    };
  }
}

export async function saveSchoolSettings(settings: SchoolSettings): Promise<void> {
  const path = 'settings/school';
  try {
    localStorage.setItem('prime_edutech_school_settings', JSON.stringify(settings));
  } catch {}
  try {
    await setDoc(doc(db, 'settings', 'school'), settings, { merge: true });
  } catch (error) {
    console.warn('Firestore settings write warning (saved locally):', error);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('schoolSettingsUpdated', { detail: settings }));
  }
}

// Examination Tombstones & Cross-Tab Broadcast Sync
const DELETED_EXAMS_KEY = 'prime_cbt_deleted_exam_ids';

export function getDeletedExamIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_EXAMS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    return new Set();
  }
}

export function markExamAsDeleted(examId: string) {
  try {
    const ids = getDeletedExamIds();
    ids.add(examId);
    localStorage.setItem(DELETED_EXAMS_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {}
}

export function markExamsAsDeletedBatch(examIds: string[]) {
  try {
    const ids = getDeletedExamIds();
    examIds.forEach(id => ids.add(id));
    localStorage.setItem(DELETED_EXAMS_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {}
}

export function unmarkExamAsDeleted(examId: string) {
  try {
    const ids = getDeletedExamIds();
    ids.delete(examId);
    localStorage.setItem(DELETED_EXAMS_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {}
}

export function broadcastExamSync(type = 'EXAMS_UPDATED', payload: any = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('prime_cbt_exams_updated', { detail: { type, ...payload } }));
    window.dispatchEvent(new Event('storage'));
    try {
      const bc = new BroadcastChannel('prime_cbt_sync_channel');
      bc.postMessage({ type, ...payload, timestamp: Date.now() });
      bc.close();
    } catch (e) {}
  }
}

// Examination Service methods
export async function fetchExaminations(filterPublishedOnly = false): Promise<Examination[]> {
  const path = 'examinations';
  const deletedIds = getDeletedExamIds();

  // Read local cache first for instant speed
  let cached: Examination[] = [];
  try {
    const raw = localStorage.getItem('prime_cbt_saved_examinations');
    if (raw) {
      cached = JSON.parse(raw);
    }
  } catch (e) {
    // ignore
  }

  // Filter out any tombstoned/deleted exams
  cached = cached.filter(e => !deletedIds.has(e.id));

  try {
    let q;
    if (filterPublishedOnly) {
      q = query(collection(db, path), where('status', '==', 'published'));
    } else {
      q = collection(db, path);
    }
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const firestoreExams: Examination[] = [];
      snapshot.forEach(docSnap => {
        if (!deletedIds.has(docSnap.id)) {
          firestoreExams.push({ id: docSnap.id, ...docSnap.data() } as Examination);
        }
      });

      // Build authoritative map
      const mergedMap: Record<string, Examination> = {};
      DEFAULT_EXAMINATIONS.forEach(e => {
        if (!deletedIds.has(e.id)) mergedMap[e.id] = e;
      });
      cached.forEach(e => {
        if (!deletedIds.has(e.id)) mergedMap[e.id] = e;
      });
      firestoreExams.forEach(e => {
        if (!deletedIds.has(e.id)) mergedMap[e.id] = e;
      });

      const finalExams = Object.values(mergedMap)
        .filter(e => !deletedIds.has(e.id))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      localStorage.setItem('prime_cbt_saved_examinations', JSON.stringify(finalExams));
      return filterPublishedOnly ? finalExams.filter(e => e.status === 'published') : finalExams;
    }
  } catch (error) {
    console.warn('Network fallback for examinations:', error);
  }

  // Fallback to cache + non-deleted defaults
  const mergedMap: Record<string, Examination> = {};
  DEFAULT_EXAMINATIONS.forEach(e => {
    if (!deletedIds.has(e.id)) mergedMap[e.id] = e;
  });
  cached.forEach(e => {
    if (!deletedIds.has(e.id)) mergedMap[e.id] = e;
  });
  const finalExams = Object.values(mergedMap)
    .filter(e => !deletedIds.has(e.id))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return filterPublishedOnly ? finalExams.filter(e => e.status === 'published') : finalExams;
}

export async function getExaminationById(examId: string): Promise<Examination | null> {
  const deletedIds = getDeletedExamIds();
  if (deletedIds.has(examId)) return null;

  const path = `examinations/${examId}`;
  try {
    const raw = localStorage.getItem('prime_cbt_saved_examinations');
    if (raw) {
      const list: Examination[] = JSON.parse(raw);
      const match = list.find(e => e.id === examId);
      if (match && !deletedIds.has(match.id)) return match;
    }
  } catch (e) {
    // ignore
  }

  try {
    const snap = await getDoc(doc(db, 'examinations', examId));
    if (snap.exists() && !deletedIds.has(snap.id)) {
      return { id: snap.id, ...snap.data() } as Examination;
    }
  } catch (error) {
    // ignore
  }

  const def = DEFAULT_EXAMINATIONS.find(e => e.id === examId);
  return def && !deletedIds.has(def.id) ? def : null;
}

export async function saveExamination(exam: Examination): Promise<void> {
  // Clear any tombstone for this exam ID
  unmarkExamAsDeleted(exam.id);
  const cleanExam = sanitizeFirestoreData(exam);

  // 1. Immediately mirror to localStorage so UI never blocks or fails
  try {
    const raw = localStorage.getItem('prime_cbt_saved_examinations');
    const list: Examination[] = raw ? JSON.parse(raw) : [...DEFAULT_EXAMINATIONS];
    const filtered = list.filter(e => e.id !== cleanExam.id);
    const updated = [cleanExam, ...filtered];
    localStorage.setItem('prime_cbt_saved_examinations', JSON.stringify(updated));
  } catch (err) {
    console.warn('LocalStorage exam cache error:', err);
  }

  // 2. Broadcast immediately to student portals and all browser tabs
  broadcastExamSync('EXAM_SAVED', { examId: cleanExam.id, status: cleanExam.status });

  // 3. Sync to Firestore cleanly
  const path = `examinations/${cleanExam.id}`;
  try {
    await setDoc(doc(db, 'examinations', cleanExam.id), cleanExam, { merge: true });
  } catch (error) {
    console.warn('Firestore examination write fallback:', error);
  }
}

export async function deleteExamination(examId: string): Promise<void> {
  // Permanently mark tombstone
  markExamAsDeleted(examId);

  // Update localStorage immediately
  try {
    const raw = localStorage.getItem('prime_cbt_saved_examinations');
    if (raw) {
      const list: Examination[] = JSON.parse(raw);
      localStorage.setItem('prime_cbt_saved_examinations', JSON.stringify(list.filter(e => e.id !== examId)));
    }
  } catch (e) {
    // ignore
  }

  // Broadcast deletion to student portals and tabs immediately
  broadcastExamSync('EXAM_DELETED', { examId });

  const path = `examinations/${examId}`;
  try {
    await deleteDoc(doc(db, 'examinations', examId));
  } catch (error) {
    console.warn('Firestore examination delete error:', error);
  }
}

// Mass Delete Examinations
export async function deleteExaminationsBatch(examIds: string[]): Promise<void> {
  if (!examIds || examIds.length === 0) return;
  markExamsAsDeletedBatch(examIds);

  const idSet = new Set(examIds);
  try {
    const raw = localStorage.getItem('prime_cbt_saved_examinations');
    if (raw) {
      const list: Examination[] = JSON.parse(raw);
      localStorage.setItem('prime_cbt_saved_examinations', JSON.stringify(list.filter(e => !idSet.has(e.id))));
    }
  } catch (e) {
    // ignore
  }

  // Broadcast mass deletion immediately
  broadcastExamSync('EXAMS_BATCH_DELETED', { examIds });

  await Promise.all(
    examIds.map(async (id) => {
      try {
        await deleteDoc(doc(db, 'examinations', id));
      } catch (e) {
        console.warn('Batch delete error for exam:', id, e);
      }
    })
  );
}

// Restart Student Exam Timer & Reset Attempt
export async function restartStudentExamTimer(studentId: string, examId: string): Promise<void> {
  const attemptId = `attempt_${studentId}_${examId}`;

  // 1. Clear local attempt & timer cache
  try {
    localStorage.removeItem(`prime_cbt_attempt_${attemptId}`);
    localStorage.removeItem(`cbt_timer_${attemptId}`);
    localStorage.removeItem(`cbt_answers_${attemptId}`);
    localStorage.removeItem(`cbt_flagged_${attemptId}`);
    sessionStorage.removeItem(`prime_cbt_attempt_${attemptId}`);
  } catch (e) {}

  // 2. Remove submission from local cache
  try {
    const rawSubs = localStorage.getItem('prime_cbt_submissions');
    if (rawSubs) {
      const list: Submission[] = JSON.parse(rawSubs);
      const filtered = list.filter(s => !(s.studentId === studentId && s.examId === examId));
      localStorage.setItem('prime_cbt_submissions', JSON.stringify(filtered));
    }
  } catch (e) {}

  // 3. Broadcast immediately so student screen/portal resets timer right now
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('prime_cbt_timer_restarted', { detail: { studentId, examId } }));
    window.dispatchEvent(new CustomEvent('prime_cbt_exams_updated'));
    window.dispatchEvent(new Event('storage'));
    try {
      const bc = new BroadcastChannel('prime_cbt_sync_channel');
      bc.postMessage({ type: 'TIMER_RESTARTED', studentId, examId, timestamp: Date.now() });
      bc.close();
    } catch (e) {}
  }

  // 4. Delete attempt from Firestore 'attempts' collection
  try {
    await deleteDoc(doc(db, 'attempts', attemptId));
  } catch (err) {
    console.warn('Error deleting attempt from Firestore:', err);
  }

  // 5. Delete any submissions in Firestore
  try {
    const q = query(
      collection(db, 'submissions'),
      where('studentId', '==', studentId),
      where('examId', '==', examId)
    );
    const snap = await getDocs(q);
    const delPromises: Promise<any>[] = [];
    snap.forEach(d => delPromises.push(deleteDoc(d.ref)));
    await Promise.all(delPromises);
  } catch (err) {
    console.warn('Error deleting submission from Firestore on timer restart:', err);
  }
}

// Question Service methods
export async function fetchQuestions(examId: string): Promise<Question[]> {
  const path = `examinations/${examId}/questions`;
  // Read local cache first
  try {
    const raw = localStorage.getItem(`prime_cbt_questions_${examId}`);
    if (raw) {
      const parsed: Question[] = JSON.parse(raw);
      if (parsed.length > 0) return parsed.sort((a, b) => a.questionNumber - b.questionNumber);
    }
  } catch (e) {
    // ignore
  }

  try {
    const snapshot = await getDocs(collection(db, 'examinations', examId, 'questions'));
    if (!snapshot.empty) {
      const questions: Question[] = [];
      snapshot.forEach(docSnap => {
        questions.push({ id: docSnap.id, ...docSnap.data() } as Question);
      });
      const sorted = questions.sort((a, b) => a.questionNumber - b.questionNumber);
      localStorage.setItem(`prime_cbt_questions_${examId}`, JSON.stringify(sorted));
      return sorted;
    }
  } catch (error) {
    console.warn('Fallback to default questions for exam:', examId);
  }

  const defaults = DEFAULT_QUESTIONS_MAP[examId] || [];
  return defaults;
}

export async function saveQuestion(examId: string, question: Question): Promise<void> {
  // Update local cache
  try {
    const raw = localStorage.getItem(`prime_cbt_questions_${examId}`);
    const list: Question[] = raw ? JSON.parse(raw) : (DEFAULT_QUESTIONS_MAP[examId] || []);
    const filtered = list.filter(q => q.id !== question.id);
    const updated = [...filtered, question].sort((a, b) => a.questionNumber - b.questionNumber);
    localStorage.setItem(`prime_cbt_questions_${examId}`, JSON.stringify(updated));
  } catch (e) {
    // ignore
  }

  const path = `examinations/${examId}/questions/${question.id}`;
  try {
    await setDoc(doc(db, 'examinations', examId, 'questions', question.id), question, { merge: true });
  } catch (error) {
    console.warn('Firestore question write fallback:', error);
  }
}

// Batch save questions with explicit Replace vs Append control
export async function saveQuestionsBatch(examId: string, newQuestions: Question[], replaceExisting = true): Promise<void> {
  let finalList: Question[] = [];
  try {
    if (replaceExisting) {
      finalList = [...newQuestions];
    } else {
      const raw = localStorage.getItem(`prime_cbt_questions_${examId}`);
      const list: Question[] = raw ? JSON.parse(raw) : (DEFAULT_QUESTIONS_MAP[examId] || []);
      finalList = [...list, ...newQuestions];
    }
    finalList.sort((a, b) => a.questionNumber - b.questionNumber);
    localStorage.setItem(`prime_cbt_questions_${examId}`, JSON.stringify(finalList));
  } catch (e) {
    // ignore
  }

  // Update exam's totalQuestions in examination record
  try {
    const rawExams = localStorage.getItem('prime_cbt_saved_examinations');
    if (rawExams) {
      const exams: Examination[] = JSON.parse(rawExams);
      const target = exams.find(e => e.id === examId);
      if (target) {
        target.totalQuestions = finalList.length;
        localStorage.setItem('prime_cbt_saved_examinations', JSON.stringify(exams));
      }
    }
  } catch (e) {
    // ignore
  }

  // Parallel write to Firestore
  await Promise.all(
    newQuestions.map(async (q) => {
      try {
        await setDoc(doc(db, 'examinations', examId, 'questions', q.id), q, { merge: true });
      } catch (err) {
        console.warn('Firestore batch question write error:', err);
      }
    })
  );
}

export async function deleteQuestion(examId: string, questionId: string): Promise<void> {
  try {
    const raw = localStorage.getItem(`prime_cbt_questions_${examId}`);
    if (raw) {
      const list: Question[] = JSON.parse(raw);
      localStorage.setItem(`prime_cbt_questions_${examId}`, JSON.stringify(list.filter(q => q.id !== questionId)));
    }
  } catch (e) {
    // ignore
  }

  const path = `examinations/${examId}/questions/${questionId}`;
  try {
    await deleteDoc(doc(db, 'examinations', examId, 'questions', questionId));
  } catch (error) {
    console.warn('Firestore question delete error:', error);
  }
}

// -------------------------------------------------------------
// Campus Communications & WhatsApp-Style Real-Time Chat Services
// -------------------------------------------------------------
function broadcastChatSync(channelId: string) {
  try {
    const bc = new BroadcastChannel('prime_cbt_chat_channel');
    bc.postMessage({ type: 'CHAT_UPDATED', channelId });
    bc.close();
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('campusChatUpdated', { detail: { channelId } }));
  }
}

function readLocalChannelMessages(channelId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`prime_cbt_chat_${channelId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalChannelMessages(channelId: string, msgs: ChatMessage[]) {
  try {
    localStorage.setItem(`prime_cbt_chat_${channelId}`, JSON.stringify(msgs));
  } catch {}
}

function mergeSortedMessages(a: ChatMessage[], b: ChatMessage[], descending = false): ChatMessage[] {
  const map: Record<string, ChatMessage> = {};
  a.forEach(m => { if (m && m.id) map[m.id] = m; });
  b.forEach(m => { if (m && m.id) map[m.id] = m; });
  return Object.values(map).sort((x, y) => {
    const diff = new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime();
    return descending ? -diff : diff;
  });
}

export async function fetchChatMessages(channelId: string): Promise<ChatMessage[]> {
  const cached = readLocalChannelMessages(channelId);
  try {
    const q = query(collection(db, 'chat_messages'), where('channelId', '==', channelId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const msgs: ChatMessage[] = [];
      snapshot.forEach(docSnap => {
        msgs.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
      });
      const sorted = mergeSortedMessages(cached, msgs);
      writeLocalChannelMessages(channelId, sorted);
      return sorted;
    }
  } catch (e) {
    console.warn('Chat fetch fallback:', e);
  }
  return cached;
}

export function subscribeChatMessages(
  channelId: string,
  onUpdate: (msgs: ChatMessage[]) => void
): () => void {
  // Emit cached immediately for instant zero-lag WhatsApp UI
  onUpdate(readLocalChannelMessages(channelId));

  let unsubFirestore = () => {};
  try {
    const q = query(collection(db, 'chat_messages'), where('channelId', '==', channelId));
    unsubFirestore = onSnapshot(
      q,
      (snapshot) => {
        const remote: ChatMessage[] = [];
        snapshot.forEach(docSnap => {
          remote.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
        });
        const merged = mergeSortedMessages(readLocalChannelMessages(channelId), remote);
        writeLocalChannelMessages(channelId, merged);
        onUpdate(merged);
      },
      (err) => {
        console.warn('Real-time channel subscription fallback:', err);
      }
    );
  } catch (e) {
    console.warn('Unable to attach channel snapshot:', e);
  }

  const handleLocalSync = () => {
    onUpdate(readLocalChannelMessages(channelId));
  };

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('prime_cbt_chat_channel');
    bc.onmessage = (ev) => {
      if (ev.data?.channelId === channelId) {
        handleLocalSync();
      }
    };
  } catch {}

  if (typeof window !== 'undefined') {
    window.addEventListener('campusChatUpdated', handleLocalSync);
  }

  return () => {
    unsubFirestore();
    if (bc) {
      try { bc.close(); } catch {}
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('campusChatUpdated', handleLocalSync);
    }
  };
}

export function subscribeAllChatMessages(
  onUpdate: (msgs: ChatMessage[]) => void
): () => void {
  const readMaster = (): ChatMessage[] => {
    try {
      const raw = localStorage.getItem('prime_cbt_all_campus_chats');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  onUpdate(readMaster());

  let unsubFirestore = () => {};
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'chat_messages'),
      (snapshot) => {
        const remote: ChatMessage[] = [];
        snapshot.forEach(docSnap => {
          remote.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
        });
        const merged = mergeSortedMessages(readMaster(), remote, true).slice(0, 1000);
        try {
          localStorage.setItem('prime_cbt_all_campus_chats', JSON.stringify(merged));
        } catch {}
        onUpdate(merged);
      },
      (err) => {
        console.warn('Master chat subscription fallback:', err);
      }
    );
  } catch (e) {
    console.warn('Unable to attach master chat snapshot:', e);
  }

  const handleLocalSync = () => {
    onUpdate(readMaster());
  };

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('prime_cbt_chat_channel');
    bc.onmessage = () => handleLocalSync();
  } catch {}

  if (typeof window !== 'undefined') {
    window.addEventListener('campusChatUpdated', handleLocalSync);
  }

  return () => {
    unsubFirestore();
    if (bc) {
      try { bc.close(); } catch {}
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('campusChatUpdated', handleLocalSync);
    }
  };
}

export async function sendChatMessage(message: ChatMessage): Promise<void> {
  // Sanitize undefined properties so Firestore never rejects optional fields
  const cleanMsg = Object.fromEntries(
    Object.entries(message).filter(([, val]) => val !== undefined)
  ) as ChatMessage;

  // 1. Immediately update local caches for instant WhatsApp-speed bubble render
  try {
    const channelList = readLocalChannelMessages(cleanMsg.channelId);
    const updatedChannel = mergeSortedMessages(channelList, [cleanMsg]);
    writeLocalChannelMessages(cleanMsg.channelId, updatedChannel);

    const masterRaw = localStorage.getItem('prime_cbt_all_campus_chats');
    const masterList: ChatMessage[] = masterRaw ? JSON.parse(masterRaw) : [];
    const updatedMaster = mergeSortedMessages(masterList, [cleanMsg], true).slice(0, 1000);
    localStorage.setItem('prime_cbt_all_campus_chats', JSON.stringify(updatedMaster));
  } catch {}

  broadcastChatSync(cleanMsg.channelId);

  // 2. Persist to Firestore
  try {
    await setDoc(doc(db, 'chat_messages', cleanMsg.id), cleanMsg, { merge: true });
  } catch (e) {
    console.warn('Firestore chat write error:', e);
  }
}

export async function deleteChatMessage(messageId: string, channelId: string): Promise<void> {
  const deletedPatch: Partial<ChatMessage> = {
    deleted: true,
    text: 'This message was deleted',
    attachmentUrl: '',
    attachmentName: ''
  };

  try {
    const channelList = readLocalChannelMessages(channelId).map(m =>
      m.id === messageId ? { ...m, ...deletedPatch, attachmentType: undefined } : m
    );
    writeLocalChannelMessages(channelId, channelList);

    const masterRaw = localStorage.getItem('prime_cbt_all_campus_chats');
    if (masterRaw) {
      const masterList: ChatMessage[] = JSON.parse(masterRaw);
      const updatedMaster = masterList.map(m =>
        m.id === messageId ? { ...m, ...deletedPatch, attachmentType: undefined } : m
      );
      localStorage.setItem('prime_cbt_all_campus_chats', JSON.stringify(updatedMaster));
    }
  } catch {}

  broadcastChatSync(channelId);

  try {
    await setDoc(
      doc(db, 'chat_messages', messageId),
      { deleted: true, text: 'This message was deleted', attachmentUrl: '', attachmentName: '' },
      { merge: true }
    );
  } catch (e) {
    console.warn('Firestore chat delete error:', e);
  }
}

// Super Admin Chat Oversight
export async function fetchAllChatMessagesForAdmin(): Promise<ChatMessage[]> {
  let cached: ChatMessage[] = [];
  try {
    const masterRaw = localStorage.getItem('prime_cbt_all_campus_chats');
    if (masterRaw) cached = JSON.parse(masterRaw);
  } catch {}

  try {
    const snapshot = await getDocs(collection(db, 'chat_messages'));
    if (!snapshot.empty) {
      const msgs: ChatMessage[] = [];
      snapshot.forEach(docSnap => {
        msgs.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
      });
      const sorted = mergeSortedMessages(cached, msgs, true);
      try {
        localStorage.setItem('prime_cbt_all_campus_chats', JSON.stringify(sorted.slice(0, 1000)));
      } catch {}
      return sorted;
    }
  } catch (e) {
    console.warn('Master chat fetch fallback:', e);
  }

  return cached;
}

// -------------------------------------------------------------
// Teacher Lesson Notes & Scheme of Work Studio Services
// -------------------------------------------------------------
export async function fetchLessonNotes(teacherId?: string): Promise<LessonNote[]> {
  let list: LessonNote[] = [];
  try {
    const raw = localStorage.getItem('prime_cbt_saved_lesson_notes');
    if (raw) list = JSON.parse(raw);
  } catch (e) {
    // ignore
  }

  try {
    let q;
    if (teacherId) {
      q = query(collection(db, 'lesson_notes'), where('teacherId', '==', teacherId));
    } else {
      q = collection(db, 'lesson_notes');
    }
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const notes: LessonNote[] = [];
      snapshot.forEach(docSnap => {
        notes.push({ id: docSnap.id, ...docSnap.data() } as LessonNote);
      });
      const mergedMap: Record<string, LessonNote> = {};
      list.forEach(n => { mergedMap[n.id] = n; });
      notes.forEach(n => { mergedMap[n.id] = n; });
      const finalNotes = Object.values(mergedMap).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      localStorage.setItem('prime_cbt_saved_lesson_notes', JSON.stringify(finalNotes));
      return teacherId ? finalNotes.filter(n => n.teacherId === teacherId) : finalNotes;
    }
  } catch (e) {
    console.warn('Lesson notes fetch fallback:', e);
  }

  return teacherId ? list.filter(n => n.teacherId === teacherId) : list;
}

export async function saveLessonNote(note: LessonNote): Promise<void> {
  try {
    const raw = localStorage.getItem('prime_cbt_saved_lesson_notes');
    const list: LessonNote[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(n => n.id !== note.id);
    const updated = [note, ...filtered];
    localStorage.setItem('prime_cbt_saved_lesson_notes', JSON.stringify(updated));
  } catch (e) {
    // ignore
  }

  try {
    await setDoc(doc(db, 'lesson_notes', note.id), note, { merge: true });
  } catch (e) {
    console.warn('Firestore lesson note write fallback:', e);
  }
}

export async function deleteLessonNote(noteId: string): Promise<void> {
  try {
    const raw = localStorage.getItem('prime_cbt_saved_lesson_notes');
    if (raw) {
      const list: LessonNote[] = JSON.parse(raw);
      localStorage.setItem('prime_cbt_saved_lesson_notes', JSON.stringify(list.filter(n => n.id !== noteId)));
    }
  } catch (e) {
    // ignore
  }

  try {
    await deleteDoc(doc(db, 'lesson_notes', noteId));
  } catch (e) {
    console.warn('Firestore lesson note delete fallback:', e);
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
  const cleanStudent = sanitizeFirestoreData(student);

  // Save to local cache immediately
  try {
    const local = localStorage.getItem('prime_edutech_saved_students_roster');
    let list: Student[] = local ? JSON.parse(local) : [...DEFAULT_STUDENTS];
    const idx = list.findIndex(s => s.id === cleanStudent.id || s.admissionNumber.toUpperCase() === cleanStudent.admissionNumber.toUpperCase());
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...cleanStudent };
    } else {
      list.push(cleanStudent);
    }
    localStorage.setItem('prime_edutech_saved_students_roster', JSON.stringify(list));
  } catch {}

  broadcastEntitySync('studentsUpdated', 'STUDENTS_UPDATED', { studentId: cleanStudent.id });

  // Persist to Firestore cleanly
  await commitFirestoreFast(
    setDoc(doc(db, 'students', cleanStudent.id), cleanStudent, { merge: true }),
    OperationType.WRITE,
    path
  );
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

const normalizeClassCode = (val?: string) =>
  (val || '').trim().toLowerCase().replace(/[\s\-_]/g, '');

const normalizeTermCode = (val?: string) => {
  const clean = (val || '').trim().toLowerCase().replace(/[\s\-_]/g, '');
  if (clean.startsWith('first') || clean === '1st') return '1stterm';
  if (clean.startsWith('second') || clean === '2nd') return '2ndterm';
  if (clean.startsWith('third') || clean === '3rd') return '3rdterm';
  return clean;
};

const pickNewerRecord = (
  a: StudentAssessmentRecord | undefined,
  b: StudentAssessmentRecord
): StudentAssessmentRecord => {
  if (!a) return b;
  const tA = new Date(a.updatedAt || 0).getTime() || 0;
  const tB = new Date(b.updatedAt || 0).getTime() || 0;
  return tB >= tA ? b : a;
};

// Continuous Assessment / Master Gradebook Records
export async function fetchAssessmentRecords(
  subjectId?: string,
  classGrade?: string,
  academicSession?: string,
  term?: string
): Promise<StudentAssessmentRecord[]> {
  const path = 'caRecords';
  const mergedMap: Record<string, StudentAssessmentRecord> = {};

  const normClass = normalizeClassCode(classGrade);
  const normTerm = normalizeTermCode(term);
  const normSession = (academicSession || '').trim();

  const matchesFilters = (r: StudentAssessmentRecord) => {
    if (subjectId && r.subjectId !== subjectId) return false;
    if (normClass && normalizeClassCode(r.classGrade) !== normClass) return false;
    if (normSession && (r.academicSession || '').trim() !== normSession) return false;
    if (normTerm && normalizeTermCode(r.term) !== normTerm) return false;
    return true;
  };

  // 1. Read local cache first
  try {
    const local = localStorage.getItem('prime_edutech_ca_records');
    if (local) {
      const parsed: StudentAssessmentRecord[] = JSON.parse(local);
      parsed.forEach(r => {
        if (matchesFilters(r)) {
          mergedMap[r.id] = pickNewerRecord(mergedMap[r.id], r);
        }
      });
    }
  } catch {}

  // 2. Fetch from Firestore using single-field index query and filter remaining fields in memory
  try {
    const q = subjectId
      ? query(collection(db, path), where('subjectId', '==', subjectId))
      : collection(db, path);

    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      const rec = { id: docSnap.id, ...docSnap.data() } as StudentAssessmentRecord;
      if (matchesFilters(rec)) {
        mergedMap[rec.id] = pickNewerRecord(mergedMap[rec.id], rec);
      }
    });
  } catch (error) {
    console.warn('Fallback fetching CA records from local cache:', error);
  }

  return Object.values(mergedMap);
}

export async function saveAssessmentRecord(record: StudentAssessmentRecord): Promise<void> {
  const sanitizedId = (record.id || `ca_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanRecord = sanitizeFirestoreData({
    ...record,
    id: sanitizedId,
    updatedAt: record.updatedAt || new Date().toISOString()
  });

  // Always mirror in localStorage immediately for instant offline access
  try {
    const local = localStorage.getItem('prime_edutech_ca_records');
    const records: StudentAssessmentRecord[] = local ? JSON.parse(local) : [];
    const filtered = records.filter(r => r.id !== sanitizedId);
    filtered.push(cleanRecord);
    localStorage.setItem('prime_edutech_ca_records', JSON.stringify(filtered));
  } catch {}

  // Broadcast real-time score update event across components & tabs immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('caRecordsUpdated', { detail: cleanRecord }));
    try {
      const channel = new BroadcastChannel('prime_cbt_sync_channel');
      channel.postMessage({ type: 'CA_RECORDS_UPDATED', recordId: sanitizedId });
      channel.close();
    } catch {}
  }

  try {
    await commitFirestoreFast(
      setDoc(doc(db, 'caRecords', sanitizedId), cleanRecord, { merge: true }),
      OperationType.WRITE,
      `caRecords/${sanitizedId}`
    );
  } catch (error) {
    console.warn('Firestore write warning for caRecord, falling back to local cache:', error);
  }
}

export async function saveAssessmentBatch(records: StudentAssessmentRecord[]): Promise<void> {
  for (const record of records) {
    await saveAssessmentRecord(record);
  }
}

export async function deleteAssessmentRecord(recordId: string): Promise<void> {
  const cleanId = recordId.replace(/[^a-zA-Z0-9_-]/g, '_');
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
    try {
      const channel = new BroadcastChannel('prime_cbt_sync_channel');
      channel.postMessage({ type: 'CA_RECORDS_UPDATED', recordId: cleanId, deleted: true });
      channel.close();
    } catch {}
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
  let firestoreRecords: StudentAssessmentRecord[] = [];

  const normAdm = (admissionNumber || '').trim().toUpperCase();
  const isStudentMatch = (r: Partial<StudentAssessmentRecord>) => {
    if (studentId && r.studentId === studentId) return true;
    const rAdm = (r.admissionNumber || '').trim().toUpperCase();
    return Boolean(normAdm && rAdm && rAdm === normAdm);
  };

  const mergeAndEmit = () => {
    const mergedMap: Record<string, StudentAssessmentRecord> = {};
    firestoreRecords.forEach(r => {
      if (isStudentMatch(r)) {
        mergedMap[r.id] = pickNewerRecord(mergedMap[r.id], r);
      }
    });
    try {
      const local = localStorage.getItem('prime_edutech_ca_records');
      if (local) {
        const parsed: StudentAssessmentRecord[] = JSON.parse(local);
        parsed.forEach(lr => {
          if (isStudentMatch(lr)) {
            mergedMap[lr.id] = pickNewerRecord(mergedMap[lr.id], lr);
          }
        });
      }
    } catch {}
    callback(Object.values(mergedMap));
  };

  // Immediate local cache dispatch
  mergeAndEmit();

  try {
    const q = collection(db, path);
    unsubFirestore = onSnapshot(
      q,
      snapshot => {
        const list: StudentAssessmentRecord[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as StudentAssessmentRecord;
          if (isStudentMatch(data)) {
            list.push({ ...data, id: docSnap.id });
          }
        });
        firestoreRecords = list;
        mergeAndEmit();
      },
      err => {
        console.warn('Real-time score listener fallback:', err);
        mergeAndEmit();
      }
    );
  } catch (error) {
    console.warn('Firestore onSnapshot error, falling back to local events:', error);
  }

  // Cross-tab and local broadcast listener
  const handleLocalUpdate = () => mergeAndEmit();
  if (typeof window !== 'undefined') {
    window.addEventListener('caRecordsUpdated', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);
  }

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('prime_cbt_sync_channel');
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'CA_RECORDS_UPDATED') {
        mergeAndEmit();
      }
    };
  } catch {}

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('caRecordsUpdated', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    }
    if (bc) {
      try { bc.close(); } catch {}
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
  const cleanUpdates = sanitizeFirestoreData(updates);
  try {
    await setDoc(doc(db, 'students', studentId), cleanUpdates, { merge: true });
  } catch (err) {
    console.warn('Firestore write warning for student profile:', err);
  }

  // Update in localStorage
  try {
    const stored = localStorage.getItem('prime_edutech_saved_students');
    if (stored) {
      const list = JSON.parse(stored);
      const updatedList = list.map((s: any) =>
        s.id === studentId || s.admissionNumber === cleanUpdates.admissionNumber ? { ...s, ...cleanUpdates } : s
      );
      localStorage.setItem('prime_edutech_saved_students', JSON.stringify(updatedList));
    }
  } catch {}

  return cleanUpdates as Student;
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

/**
 * Terminal Student Report Card Data (Psychomotor, Skills, Remarks, Bio)
 */
export async function fetchStudentTermReport(
  studentId: string,
  academicSession: string,
  term: string,
  fallbackStudent?: Partial<Student> | null
): Promise<StudentTermReportData> {
  const cleanStudentId = (studentId || fallbackStudent?.admissionNumber || 'stu').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanSession = (academicSession || '2024-2025').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanTerm = (term || '1stTerm').replace(/[^a-zA-Z0-9_-]/g, '_');
  const reportDocId = `report_${cleanStudentId}_${cleanSession}_${cleanTerm}`;

  try {
    const docRef = doc(db, 'termReports', reportDocId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as StudentTermReportData;
    }
  } catch (err) {
    console.warn('Firestore fetch warning for termReport, checking local cache:', err);
  }

  // Check localStorage
  try {
    const local = localStorage.getItem(`prime_term_report_${reportDocId}`);
    if (local) {
      return JSON.parse(local) as StudentTermReportData;
    }
  } catch {}

  // Dynamic defaults using actual student data (no stale sample overrides)
  const clsUpper = (fallbackStudent?.classGrade || '').toUpperCase();
  return {
    id: reportDocId,
    studentId: studentId || fallbackStudent?.id || 'stu-default',
    studentName: fallbackStudent?.fullName || '',
    admissionNumber: fallbackStudent?.admissionNumber || '',
    classGrade: fallbackStudent?.classGrade || '',
    academicSession: academicSession || '2025/2026',
    term: (term as any) || '1st Term',
    age: '',
    house: '',
    sex: fallbackStudent?.gender || '',
    noInClass: '',
    department: fallbackStudent?.department || '',
    category: clsUpper.includes('JSS') ? 'JUNIOR SECONDARY' : 'SENIOR SECONDARY',
    classAverage: '',
    behaviours: { ...DEFAULT_PSYCHOMOTOR },
    skills: { ...DEFAULT_SKILLS },
    classTeacherRemarks: "STAY FOCUS AND YOU'LL REACH YOUR GOALS.",
    principalRemarks: "GOOD PROGRESS! BUT MORE EFFORT ARE NEEDED.",
    nextTermBegins: "5TH JANUARY, 2026",
    nextTermFees: "26,000",
    principalSignature: "Signed",
    proprietressSignature: "Signed",
    customLabels: {},
    updatedAt: new Date().toISOString()
  };
}

export async function saveStudentTermReport(report: StudentTermReportData): Promise<void> {
  const cleanId = (report.id || `report_${report.studentId}_${report.academicSession}_${report.term}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanReport = sanitizeFirestoreData({
    ...report,
    id: cleanId,
    updatedAt: new Date().toISOString()
  });

  try {
    await setDoc(doc(db, 'termReports', cleanId), cleanReport, { merge: true });
  } catch (err) {
    console.warn('Firestore write warning for termReport:', err);
  }

  // Always mirror in localStorage
  try {
    localStorage.setItem(`prime_term_report_${cleanId}`, JSON.stringify(report));
    const allKey = 'prime_term_reports_all';
    const existing = localStorage.getItem(allKey);
    const list: StudentTermReportData[] = existing ? JSON.parse(existing) : [];
    const filtered = list.filter(r => r.id !== cleanId);
    filtered.push(report);
    localStorage.setItem(allKey, JSON.stringify(filtered));
  } catch {}

  // Broadcast real-time update event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('termReportsUpdated', { detail: report }));
    try {
      const channel = new BroadcastChannel('prime_cbt_sync_channel');
      channel.postMessage({ type: 'TERM_REPORT_UPDATED', reportId: cleanId });
      channel.close();
    } catch {}
  }
}

export async function fetchClassTermReports(
  classGrade: string,
  academicSession: string,
  term: string
): Promise<StudentTermReportData[]> {
  const mergedMap: Record<string, StudentTermReportData> = {};

  try {
    const allKey = 'prime_term_reports_all';
    const existing = localStorage.getItem(allKey);
    if (existing) {
      const list: StudentTermReportData[] = JSON.parse(existing);
      list.forEach(r => {
        if (r.classGrade === classGrade && r.academicSession === academicSession && r.term === term) {
          mergedMap[r.id] = r;
        }
      });
    }
  } catch {}

  try {
    const q = query(collection(db, 'termReports'), where('classGrade', '==', classGrade));
    const snap = await getDocs(q);
    snap.forEach(d => {
      const r = d.data() as StudentTermReportData;
      if (r.academicSession === academicSession && r.term === term) {
        mergedMap[r.id] = r;
      }
    });
  } catch (err) {
    console.warn('Firestore fetchClassTermReports fallback to local:', err);
  }

  return Object.values(mergedMap);
}

