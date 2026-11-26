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
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  writeBatch,
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  getDocFromServer,
  getDocsFromServer,
  query,
  where,
  deleteDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove
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
  resolveCaWeights,
  CbtExamEntry,
  CbtTargetComponent,
  resolveExamTargetComponent,
  getTargetComponentMax,
  formatOrdinalExamLabel,
  enrichSubmissionsWithOrdinals,
  buildCanonicalCaRecordId
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
const isBrowserRuntime = typeof window !== 'undefined' && typeof document !== 'undefined';
const browserTransportSettings = isBrowserRuntime
  ? {
      experimentalForceLongPolling: true,
      experimentalLongPollingOptions: { timeoutSeconds: 15 }
    }
  : {};

let dbInstance: Firestore;
try {
  const canUseIndexedDb = isBrowserRuntime && typeof indexedDB !== 'undefined';
  const cache = canUseIndexedDb
    ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    : memoryLocalCache();
  dbInstance = initializeFirestore(
    app,
    {
      ignoreUndefinedProperties: true,
      localCache: cache,
      ...browserTransportSettings
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  try {
    dbInstance = initializeFirestore(
      app,
      {
        ignoreUndefinedProperties: true,
        localCache: memoryLocalCache(),
        ...browserTransportSettings
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
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
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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

// Await Firestore write cleanly when online (fast offline return if browser offline)
async function commitFirestoreFast(
  writePromise: Promise<unknown>,
  operationType: OperationType,
  path: string,
  timeoutMs = 15000
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

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await Promise.race([guarded, new Promise<void>(resolve => setTimeout(resolve, 150))]);
    return;
  }

  await Promise.race([
    guarded,
    new Promise<void>(resolve => setTimeout(resolve, timeoutMs))
  ]);
}

// =========================================================================
// Institutional Administrators Management (Super Admin & Co-Admins)
// =========================================================================
const pickNewerAdmin = (existing: AdminUser | undefined, incoming: AdminUser): AdminUser => {
  if (!existing) return incoming;
  const tExisting = new Date(existing.updatedAt || existing.createdAt || 0).getTime() || 0;
  const tIncoming = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime() || 0;
  if (tIncoming >= tExisting) {
    return { ...existing, ...incoming };
  }
  return { ...incoming, ...existing };
};

function readLocalAdminsList(): AdminUser[] {
  const deleted = getTombstoneSet(DELETED_ADMINS_KEY);
  try {
    const local = localStorage.getItem(SAVED_ADMINS_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        return parsed.filter((a: AdminUser) => a && a.id && !deleted.has(a.id) && !pendingAdminDeletes.has(a.id));
      }
    }
  } catch {}
  return DEFAULT_ADMINS.filter(a => !deleted.has(a.id) && !pendingAdminDeletes.has(a.id));
}

function writeLocalAdminsList(list: AdminUser[]) {
  try {
    localStorage.setItem(SAVED_ADMINS_KEY, JSON.stringify(list));
  } catch {}
}

export async function fetchAdmins(): Promise<AdminUser[]> {
  const path = 'admins';
  await fetchCloudSyncState(true).catch(() => null);
  const deleted = getTombstoneSet(DELETED_ADMINS_KEY);
  const mergedMap = new Map<string, AdminUser>();

  try {
    const snapshot = await fetchCollectionAuthoritative(path, true);
    const isAuthoritative = !snapshot.metadata.fromCache;

    if (!isAuthoritative) {
      readLocalAdminsList().forEach(a => {
        if (!deleted.has(a.id) && !pendingAdminDeletes.has(a.id)) {
          mergedMap.set(a.id, a);
        }
      });
    }

    snapshot.forEach(docSnap => {
      if (deleted.has(docSnap.id) || pendingAdminDeletes.has(docSnap.id)) return;
      const fAdmin = { id: docSnap.id, ...docSnap.data() } as AdminUser;
      mergedMap.set(fAdmin.id, pickNewerAdmin(mergedMap.get(fAdmin.id), fAdmin));
    });

    pendingAdminSaves.forEach((pAdmin, id) => {
      if (!deleted.has(id) && !pendingAdminDeletes.has(id)) {
        mergedMap.set(id, pickNewerAdmin(mergedMap.get(id), pAdmin));
      }
    });

    const admins = Array.from(mergedMap.values());
    const hasMain = admins.some(a => a.email.toLowerCase() === 'fathertemitope@gmail.com');
    if (!hasMain) {
      const mainAdmin = DEFAULT_ADMINS[0];
      mergedMap.set(mainAdmin.id, mainAdmin);
      if (isAuthoritative) {
        setDoc(doc(db, 'admins', mainAdmin.id), sanitizeFirestoreData(mainAdmin), { merge: true }).catch(() => {});
      }
    }
  } catch (error) {
    console.warn('Firestore fetchAdmins notice (using cache):', error);
    readLocalAdminsList().forEach(a => {
      if (!deleted.has(a.id) && !pendingAdminDeletes.has(a.id)) {
        mergedMap.set(a.id, a);
      }
    });
    pendingAdminSaves.forEach((pAdmin, id) => {
      if (!deleted.has(id) && !pendingAdminDeletes.has(id)) {
        mergedMap.set(id, pickNewerAdmin(mergedMap.get(id), pAdmin));
      }
    });
    const admins = Array.from(mergedMap.values());
    if (!admins.some(a => a.email.toLowerCase() === 'fathertemitope@gmail.com')) {
      mergedMap.set(DEFAULT_ADMINS[0].id, DEFAULT_ADMINS[0]);
    }
  }

  const finalAdmins = Array.from(mergedMap.values());
  writeLocalAdminsList(finalAdmins);
  return finalAdmins;
}

export async function saveAdmin(admin: AdminUser): Promise<AdminUser> {
  const cleanEmail = admin.email.trim().toLowerCase();
  const adminId = admin.id || `admin_${cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  pendingAdminDeletes.delete(adminId);
  removeTombstone(DELETED_ADMINS_KEY, adminId);

  const dataToSave = sanitizeFirestoreData<AdminUser>({
    ...admin,
    id: adminId,
    email: cleanEmail,
    phoneNumber: admin.phoneNumber || '',
    passcode: admin.passcode || 'admin2025',
    updatedAt: new Date().toISOString()
  });

  pendingAdminSaves.set(adminId, dataToSave);

  try {
    const list = readLocalAdminsList().filter(
      a => a.id !== adminId && a.email.toLowerCase() !== dataToSave.email.toLowerCase()
    );
    writeLocalAdminsList([dataToSave, ...list]);
  } catch {}

  broadcastEntitySync('adminsUpdated', 'ADMINS_UPDATED', { admin: dataToSave, adminId });

  const writePromise = Promise.all([
    setDoc(doc(db, 'admins', adminId), dataToSave, { merge: true }),
    clearCloudDeletion('deletedAdminIds', adminId)
  ]).then(() => {
    const curr = pendingAdminSaves.get(adminId);
    if (curr && curr.updatedAt === dataToSave.updatedAt) {
      pendingAdminSaves.delete(adminId);
    }
  });

  await commitFirestoreFast(writePromise, OperationType.WRITE, `admins/${adminId}`);
  return dataToSave;
}

export async function deleteAdmin(adminId: string): Promise<void> {
  const admins = await fetchAdmins();
  const target = admins.find(a => a.id === adminId);
  if (target?.isMainSuperAdmin || target?.email.toLowerCase() === 'fathertemitope@gmail.com') {
    throw new Error('The Chief Super Administrator (fathertemitope@gmail.com) is permanently protected and cannot be deleted.');
  }

  pendingAdminSaves.delete(adminId);
  pendingAdminDeletes.add(adminId);
  addTombstone(DELETED_ADMINS_KEY, adminId);

  try {
    writeLocalAdminsList(readLocalAdminsList().filter(a => a.id !== adminId));
  } catch {}

  broadcastEntitySync('adminsUpdated', 'ADMINS_UPDATED', { adminId, deleted: true });

  const delPromise = Promise.all([
    deleteDoc(doc(db, 'admins', adminId)),
    recordCloudDeletion('deletedAdminIds', [adminId])
  ]).finally(() => {
    pendingAdminDeletes.delete(adminId);
  });

  await commitFirestoreFast(delPromise, OperationType.DELETE, `admins/${adminId}`);
}

export function subscribeAdmins(callback: (admins: AdminUser[]) => void): () => void {
  let firestoreList: AdminUser[] = [];
  let hasServerSnapshot = false;
  let hasAnyRemote = false;

  const emitMerged = () => {
    const deleted = getTombstoneSet(DELETED_ADMINS_KEY);
    const merged = new Map<string, AdminUser>();

    if (!hasServerSnapshot) {
      readLocalAdminsList().forEach(a => {
        if (!deleted.has(a.id) && !pendingAdminDeletes.has(a.id)) merged.set(a.id, a);
      });
    }

    if (hasAnyRemote) {
      firestoreList.forEach(fa => {
        if (!deleted.has(fa.id) && !pendingAdminDeletes.has(fa.id)) {
          merged.set(fa.id, pickNewerAdmin(merged.get(fa.id), fa));
        }
      });
    }

    pendingAdminSaves.forEach((pa, id) => {
      if (!deleted.has(id) && !pendingAdminDeletes.has(id)) {
        merged.set(id, pickNewerAdmin(merged.get(id), pa));
      }
    });

    const list = Array.from(merged.values());
    if (!list.some(a => a.email.toLowerCase() === 'fathertemitope@gmail.com')) {
      merged.set(DEFAULT_ADMINS[0].id, DEFAULT_ADMINS[0]);
    }

    const result = Array.from(merged.values());
    writeLocalAdminsList(result);
    callback(result);
  };

  emitMerged();
  const releaseSyncState = retainSyncStateListener();

  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'admins'),
      { includeMetadataChanges: true },
      snapshot => {
        hasAnyRemote = true;
        if (!snapshot.metadata.fromCache) {
          hasServerSnapshot = true;
        }
        const remote: AdminUser[] = [];
        snapshot.forEach(docSnap => {
          remote.push({ id: docSnap.id, ...docSnap.data() } as AdminUser);
        });
        firestoreList = remote;
        emitMerged();
      },
      err => {
        console.warn('Admins snapshot listener fallback:', err);
      }
    );
  } catch {}

  const onSync = () => emitMerged();
  if (typeof window !== 'undefined') {
    window.addEventListener('adminsUpdated', onSync);
    window.addEventListener('storage', onSync);
  }

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('prime_cbt_sync_channel');
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'ADMINS_UPDATED') onSync();
    };
  } catch {}

  return () => {
    releaseSyncState();
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('adminsUpdated', onSync);
      window.removeEventListener('storage', onSync);
    }
    if (bc) {
      try { bc.close(); } catch {}
    }
  };
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
// Cross-System Cloud Sync State, Tombstones & In-Flight Write Guards
// =========================================================================
const SAVED_ADMINS_KEY = 'prime_edutech_saved_admins';
const DELETED_ADMINS_KEY = 'prime_edutech_deleted_admin_ids';
const SAVED_TEACHERS_KEY = 'prime_edutech_saved_teachers';
const DELETED_STAFF_KEY = 'prime_edutech_deleted_staff_ids';
const SAVED_CLASSES_KEY = 'prime_edutech_saved_classes';
const DELETED_CLASSES_KEY = 'prime_edutech_deleted_class_ids';
const SAVED_SUBJECTS_KEY = 'prime_edutech_saved_subjects';
const DELETED_SUBJECTS_KEY = 'prime_edutech_deleted_subject_ids';
const SAVED_STUDENTS_KEY = 'prime_edutech_saved_students_roster';
const DELETED_STUDENTS_KEY = 'prime_edutech_deleted_student_ids';
const DELETED_EXAMS_KEY = 'prime_cbt_deleted_exam_ids';
const DELETED_SUBMISSIONS_KEY = 'prime_cbt_deleted_submission_ids';
const DELETED_CA_RECORDS_KEY = 'prime_edutech_deleted_ca_record_ids';
const SAVED_CA_RECORDS_KEY = 'prime_edutech_ca_records';
const DIRTY_CA_RECORDS_KEY = 'prime_edutech_ca_dirty_records';
const DELETED_LESSON_NOTES_KEY = 'prime_cbt_deleted_lesson_note_ids';
const BOOTSTRAPPED_KEY = 'prime_cbt_has_bootstrapped_v1';

interface CloudSyncState {
  hasBootstrapped?: boolean;
  deletedAdminIds?: string[];
  deletedExamIds?: string[];
  deletedStaffIds?: string[];
  deletedClassIds?: string[];
  deletedSubjectIds?: string[];
  deletedStudentIds?: string[];
  deletedSubmissionIds?: string[];
  deletedCaRecordIds?: string[];
  deletedLessonNoteIds?: string[];
  updatedAt?: string;
}

type DeletionField =
  | 'deletedAdminIds'
  | 'deletedExamIds'
  | 'deletedStaffIds'
  | 'deletedClassIds'
  | 'deletedSubjectIds'
  | 'deletedStudentIds'
  | 'deletedSubmissionIds'
  | 'deletedCaRecordIds'
  | 'deletedLessonNoteIds';

const pendingAdminSaves = new Map<string, AdminUser>();
const pendingAdminDeletes = new Set<string>();
const pendingExamSaves = new Map<string, Examination>();
const pendingExamDeletes = new Set<string>();
const pendingStaffSaves = new Map<string, StaffMember>();
const pendingStaffDeletes = new Set<string>();
const pendingClassSaves = new Map<string, SchoolClass>();
const pendingClassDeletes = new Set<string>();
const pendingSubjectSaves = new Map<string, Subject>();
const pendingSubjectDeletes = new Set<string>();
const pendingStudentSaves = new Map<string, Student>();
const pendingStudentDeletes = new Set<string>();
const pendingSubmissionSaves = new Map<string, Submission>();
const pendingSubmissionDeletes = new Set<string>();
const pendingCaRecordSaves = new Map<string, StudentAssessmentRecord>();
const pendingCaRecordDeletes = new Set<string>();
const pendingLessonNoteSaves = new Map<string, LessonNote>();
const pendingLessonNoteDeletes = new Set<string>();

function readDirtyCaRecordsStorage(): Record<string, StudentAssessmentRecord> {
  try {
    const raw = localStorage.getItem(DIRTY_CA_RECORDS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDirtyCaRecordsStorage(mapObj: Record<string, StudentAssessmentRecord>) {
  try {
    const keys = Object.keys(mapObj);
    if (keys.length === 0) {
      localStorage.removeItem(DIRTY_CA_RECORDS_KEY);
    } else {
      localStorage.setItem(DIRTY_CA_RECORDS_KEY, JSON.stringify(mapObj));
    }
  } catch {}
}

// Hydrate any unsynced CA records from localStorage so page refreshes never lose logged scores
(function hydratePendingCaOutbox() {
  try {
    const storedDirty = readDirtyCaRecordsStorage();
    const deletedRaw = localStorage.getItem(DELETED_CA_RECORDS_KEY);
    const deletedSet = deletedRaw ? new Set<string>(JSON.parse(deletedRaw)) : new Set<string>();
    Object.entries(storedDirty).forEach(([id, rec]) => {
      if (rec && id && !deletedSet.has(id)) {
        pendingCaRecordSaves.set(id, rec);
      }
    });
  } catch {}
})();

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

function addTombstonesBatch(storageKey: string, ids: string[]) {
  try {
    const set = getTombstoneSet(storageKey);
    ids.forEach(id => set.add(id));
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

function pruneLocalStorageListByIds(storageKey: string, ids: string[]) {
  if (!ids || ids.length === 0) return;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const delSet = new Set(ids);
        localStorage.setItem(
          storageKey,
          JSON.stringify(list.filter((item: any) => item && !delSet.has(item.id)))
        );
      }
    }
  } catch {}
}

function isSchoolBootstrapped(): boolean {
  try {
    return localStorage.getItem(BOOTSTRAPPED_KEY) === 'true';
  } catch {
    return false;
  }
}

function markSchoolBootstrappedLocal() {
  try {
    localStorage.setItem(BOOTSTRAPPED_KEY, 'true');
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

function applyCloudSyncState(state?: CloudSyncState | null) {
  if (!state) return;
  if (state.hasBootstrapped) {
    markSchoolBootstrappedLocal();
  }
  if (Array.isArray(state.deletedAdminIds) && state.deletedAdminIds.length > 0) {
    const filtered = state.deletedAdminIds.filter(id => !pendingAdminSaves.has(id));
    if (filtered.length > 0) {
      addTombstonesBatch(DELETED_ADMINS_KEY, filtered);
      pruneLocalStorageListByIds(SAVED_ADMINS_KEY, filtered);
    }
  }
  if (Array.isArray(state.deletedExamIds) && state.deletedExamIds.length > 0) {
    const filtered = state.deletedExamIds.filter(id => !pendingExamSaves.has(id));
    if (filtered.length > 0) {
      addTombstonesBatch(DELETED_EXAMS_KEY, filtered);
      pruneLocalStorageListByIds('prime_cbt_saved_examinations', filtered);
    }
  }
  if (Array.isArray(state.deletedStaffIds) && state.deletedStaffIds.length > 0) {
    const filtered = state.deletedStaffIds.filter(id => !pendingStaffSaves.has(id));
    if (filtered.length > 0) {
      addTombstonesBatch(DELETED_STAFF_KEY, filtered);
      pruneLocalStorageListByIds(SAVED_TEACHERS_KEY, filtered);
    }
  }
  if (Array.isArray(state.deletedClassIds) && state.deletedClassIds.length > 0) {
    const filtered = state.deletedClassIds.filter(id => !pendingClassSaves.has(id));
    if (filtered.length > 0) {
      addTombstonesBatch(DELETED_CLASSES_KEY, filtered);
      pruneLocalStorageListByIds(SAVED_CLASSES_KEY, filtered);
    }
  }
  if (Array.isArray(state.deletedSubjectIds) && state.deletedSubjectIds.length > 0) {
    const filtered = state.deletedSubjectIds.filter(id => !pendingSubjectSaves.has(id));
    if (filtered.length > 0) {
      addTombstonesBatch(DELETED_SUBJECTS_KEY, filtered);
      pruneLocalStorageListByIds(SAVED_SUBJECTS_KEY, filtered);
    }
  }
  if (Array.isArray(state.deletedStudentIds) && state.deletedStudentIds.length > 0) {
    const filtered = state.deletedStudentIds.filter(id => !pendingStudentSaves.has(id));
    if (filtered.length > 0) {
      addTombstonesBatch(DELETED_STUDENTS_KEY, filtered);
      pruneLocalStorageListByIds(SAVED_STUDENTS_KEY, filtered);
    }
  }
  if (Array.isArray(state.deletedSubmissionIds) && state.deletedSubmissionIds.length > 0) {
    const filtered = state.deletedSubmissionIds.filter(id => !pendingSubmissionSaves.has(id));
    if (filtered.length > 0) {
      addTombstonesBatch(DELETED_SUBMISSIONS_KEY, filtered);
      pruneLocalStorageListByIds('prime_cbt_submissions', filtered);
    }
  }
  if (Array.isArray(state.deletedCaRecordIds) && state.deletedCaRecordIds.length > 0) {
    const filtered = state.deletedCaRecordIds.filter(id => !pendingCaRecordSaves.has(id));
    if (filtered.length > 0) {
      addTombstonesBatch(DELETED_CA_RECORDS_KEY, filtered);
      pruneLocalStorageListByIds('prime_edutech_ca_records', filtered);
    }
  }
  if (Array.isArray(state.deletedLessonNoteIds) && state.deletedLessonNoteIds.length > 0) {
    const filtered = state.deletedLessonNoteIds.filter(id => !pendingLessonNoteSaves.has(id));
    if (filtered.length > 0) {
      addTombstonesBatch(DELETED_LESSON_NOTES_KEY, filtered);
      pruneLocalStorageListByIds('prime_cbt_saved_lesson_notes', filtered);
    }
  }
}

async function fetchCloudSyncState(forceServer = false): Promise<CloudSyncState | null> {
  try {
    const ref = doc(db, 'settings', 'syncState');
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    let snap;
    if (forceServer && isOnline) {
      try {
        snap = await getDocFromServer(ref);
      } catch {
        snap = await getDoc(ref);
      }
    } else {
      snap = await getDoc(ref);
    }
    if (snap.exists()) {
      const data = snap.data() as CloudSyncState;
      applyCloudSyncState(data);
      return data;
    }
  } catch (err) {
    console.warn('Cloud syncState fetch notice:', err);
  }
  return null;
}

async function fetchCollectionAuthoritative(collectionPath: string, forceServer = false) {
  const colRef = collection(db, collectionPath);
  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (isOnline && forceServer) {
    try {
      return await getDocsFromServer(colRef);
    } catch {
      return await getDocs(colRef);
    }
  }
  if (isOnline) {
    try {
      return await getDocsFromServer(colRef);
    } catch {
      return await getDocs(colRef);
    }
  }
  return await getDocs(colRef);
}

async function recordCloudDeletion(field: DeletionField, ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  markSchoolBootstrappedLocal();
  try {
    await setDoc(
      doc(db, 'settings', 'syncState'),
      {
        hasBootstrapped: true,
        [field]: arrayUnion(...ids),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn(`Cloud tombstone sync warning (${field}):`, err);
  }
}

async function clearCloudDeletion(field: DeletionField, id: string): Promise<void> {
  if (!id) return;
  markSchoolBootstrappedLocal();
  try {
    await setDoc(
      doc(db, 'settings', 'syncState'),
      {
        hasBootstrapped: true,
        [field]: arrayRemove(id),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn(`Cloud tombstone clear warning (${field}):`, err);
  }
}

async function clearCloudDeletionsBatch(field: DeletionField, ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  markSchoolBootstrappedLocal();
  try {
    for (let i = 0; i < ids.length; i += 400) {
      const chunk = ids.slice(i, i + 400);
      await setDoc(
        doc(db, 'settings', 'syncState'),
        {
          hasBootstrapped: true,
          [field]: arrayRemove(...chunk),
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn(`Cloud batch tombstone clear warning (${field}):`, err);
  }
}

let syncStateUnsub: (() => void) | null = null;
let syncStateSubscribers = 0;

function retainSyncStateListener(): () => void {
  syncStateSubscribers++;
  if (!syncStateUnsub) {
    try {
      syncStateUnsub = onSnapshot(
        doc(db, 'settings', 'syncState'),
        { includeMetadataChanges: true },
        snap => {
          if (snap.exists()) {
            applyCloudSyncState(snap.data() as CloudSyncState);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('adminsUpdated', { detail: { type: 'SYNC_STATE' } }));
              window.dispatchEvent(new CustomEvent('prime_cbt_exams_updated', { detail: { type: 'SYNC_STATE' } }));
              window.dispatchEvent(new CustomEvent('staffUpdated', { detail: { type: 'SYNC_STATE' } }));
              window.dispatchEvent(new CustomEvent('classesUpdated', { detail: { type: 'SYNC_STATE' } }));
              window.dispatchEvent(new CustomEvent('subjectsUpdated', { detail: { type: 'SYNC_STATE' } }));
              window.dispatchEvent(new CustomEvent('studentsUpdated', { detail: { type: 'SYNC_STATE' } }));
              window.dispatchEvent(new CustomEvent('caRecordsUpdated', { detail: { type: 'SYNC_STATE' } }));
              window.dispatchEvent(new CustomEvent('lessonNotesUpdated', { detail: { type: 'SYNC_STATE' } }));
            }
          }
        },
        err => {
          console.warn('SyncState listener fallback:', err);
        }
      );
    } catch {}
  }

  return () => {
    syncStateSubscribers = Math.max(0, syncStateSubscribers - 1);
    if (syncStateSubscribers === 0 && syncStateUnsub) {
      try {
        syncStateUnsub();
      } catch {}
      syncStateUnsub = null;
    }
  };
}

// =========================================================================
// Faculty & Staff Management (Authoritative Cloud Sync + Offline Cache)
// =========================================================================
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
        return parsed.filter((s: StaffMember) => s && s.id && !deleted.has(s.id) && !pendingStaffDeletes.has(s.id));
      }
    }
  } catch {}
  if (isSchoolBootstrapped()) return [];
  return DEFAULT_STAFF.filter(s => !deleted.has(s.id) && !pendingStaffDeletes.has(s.id));
}

function writeLocalStaffList(list: StaffMember[]) {
  try {
    localStorage.setItem(SAVED_TEACHERS_KEY, JSON.stringify(list));
  } catch {}
}

export async function fetchStaffMembers(): Promise<StaffMember[]> {
  const path = 'teachers';
  await fetchCloudSyncState(true).catch(() => null);
  const deleted = getTombstoneSet(DELETED_STAFF_KEY);
  const mergedMap = new Map<string, StaffMember>();

  try {
    const snapshot = await fetchCollectionAuthoritative(path, true);
    const isAuthoritative = !snapshot.metadata.fromCache;

    if (!isAuthoritative) {
      readLocalStaffList().forEach(s => {
        if (!deleted.has(s.id) && !pendingStaffDeletes.has(s.id)) mergedMap.set(s.id, s);
      });
    }

    snapshot.forEach(docSnap => {
      if (deleted.has(docSnap.id) || pendingStaffDeletes.has(docSnap.id)) return;
      const fStaff = { id: docSnap.id, ...docSnap.data() } as StaffMember;
      mergedMap.set(fStaff.id, pickNewerStaff(mergedMap.get(fStaff.id), fStaff));
    });

    pendingStaffSaves.forEach((pStaff, id) => {
      if (!deleted.has(id) && !pendingStaffDeletes.has(id)) {
        mergedMap.set(id, pickNewerStaff(mergedMap.get(id), pStaff));
      }
    });

    if (mergedMap.size === 0 && !isAuthoritative && !isSchoolBootstrapped()) {
      DEFAULT_STAFF.filter(s => !deleted.has(s.id)).forEach(s => mergedMap.set(s.id, s));
    }
  } catch (error) {
    console.warn('Fallback to cached staff roster:', error);
    readLocalStaffList().forEach(s => {
      if (!deleted.has(s.id) && !pendingStaffDeletes.has(s.id)) mergedMap.set(s.id, s);
    });
    pendingStaffSaves.forEach((pStaff, id) => {
      if (!deleted.has(id) && !pendingStaffDeletes.has(id)) {
        mergedMap.set(id, pickNewerStaff(mergedMap.get(id), pStaff));
      }
    });
  }

  const finalStaff = Array.from(mergedMap.values());
  writeLocalStaffList(finalStaff);
  return finalStaff;
}

export async function saveStaffMember(staff: StaffMember): Promise<StaffMember> {
  const path = `teachers/${staff.id}`;
  pendingStaffDeletes.delete(staff.id);
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

  pendingStaffSaves.set(cleanStaff.id, cleanStaff);

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

  // 3. Persist to Firestore cleanly and clear tombstone if any
  const writePromise = Promise.all([
    setDoc(doc(db, 'teachers', cleanStaff.id), cleanStaff, { merge: true }),
    clearCloudDeletion('deletedStaffIds', cleanStaff.id)
  ]).then(() => {
    const curr = pendingStaffSaves.get(cleanStaff.id);
    if (curr && curr.updatedAt === cleanStaff.updatedAt) {
      pendingStaffSaves.delete(cleanStaff.id);
    }
  });

  await commitFirestoreFast(writePromise, OperationType.WRITE, path);

  return cleanStaff;
}

export async function deleteStaffMember(staffId: string): Promise<void> {
  const path = `teachers/${staffId}`;
  pendingStaffSaves.delete(staffId);
  pendingStaffDeletes.add(staffId);
  addTombstone(DELETED_STAFF_KEY, staffId);

  try {
    const list = readLocalStaffList().filter(s => s.id !== staffId);
    writeLocalStaffList(list);
  } catch {}

  broadcastEntitySync('staffUpdated', 'STAFF_UPDATED', { staffId, deleted: true });

  const delPromise = Promise.all([
    deleteDoc(doc(db, 'teachers', staffId)),
    recordCloudDeletion('deletedStaffIds', [staffId])
  ]).finally(() => {
    pendingStaffDeletes.delete(staffId);
  });

  await commitFirestoreFast(delPromise, OperationType.DELETE, path);
}

export function subscribeStaffMembers(callback: (staff: StaffMember[]) => void): () => void {
  let firestoreList: StaffMember[] = [];
  let hasServerSnapshot = false;
  let hasAnyRemote = false;

  const emitMerged = () => {
    const deleted = getTombstoneSet(DELETED_STAFF_KEY);
    const merged = new Map<string, StaffMember>();

    if (!hasServerSnapshot) {
      readLocalStaffList().forEach(s => {
        if (!deleted.has(s.id) && !pendingStaffDeletes.has(s.id)) merged.set(s.id, s);
      });
    }

    if (hasAnyRemote) {
      firestoreList.forEach(fs => {
        if (!deleted.has(fs.id) && !pendingStaffDeletes.has(fs.id)) {
          merged.set(fs.id, pickNewerStaff(merged.get(fs.id), fs));
        }
      });
    }

    pendingStaffSaves.forEach((pStaff, id) => {
      if (!deleted.has(id) && !pendingStaffDeletes.has(id)) {
        merged.set(id, pickNewerStaff(merged.get(id), pStaff));
      }
    });

    const result = Array.from(merged.values());
    writeLocalStaffList(result);
    callback(result);
  };

  // Immediate local emit
  emitMerged();

  const releaseSyncState = retainSyncStateListener();

  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'teachers'),
      { includeMetadataChanges: true },
      snapshot => {
        hasAnyRemote = true;
        if (!snapshot.metadata.fromCache) {
          hasServerSnapshot = true;
        }
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
    releaseSyncState();
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

  // 3. Fallback to default staff roster (only if not deleted and not bootstrapped)
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

  pendingStaffSaves.set(staffId, mergedStaff);

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
  const writePromise = setDoc(doc(db, 'teachers', staffId), cleanUpdates, { merge: true }).then(() => {
    const curr = pendingStaffSaves.get(staffId);
    if (curr && curr.updatedAt === mergedStaff.updatedAt) {
      pendingStaffSaves.delete(staffId);
    }
  });
  await commitFirestoreFast(writePromise, OperationType.WRITE, path);

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
// Classes & Subjects Management (Authoritative Cloud Sync + Offline Cache)
// =========================================================================
function readLocalClassesList(): SchoolClass[] {
  const deleted = getTombstoneSet(DELETED_CLASSES_KEY);
  try {
    const raw = localStorage.getItem(SAVED_CLASSES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((c: SchoolClass) => c && c.id && !deleted.has(c.id) && !pendingClassDeletes.has(c.id));
      }
    }
  } catch {}
  if (isSchoolBootstrapped()) return [];
  return DEFAULT_SCHOOL_CLASSES.filter(c => !deleted.has(c.id) && !pendingClassDeletes.has(c.id));
}

function writeLocalClassesList(list: SchoolClass[]) {
  try {
    localStorage.setItem(SAVED_CLASSES_KEY, JSON.stringify(list));
  } catch {}
}

export async function fetchSchoolClasses(): Promise<SchoolClass[]> {
  const path = 'classes';
  await fetchCloudSyncState(true).catch(() => null);
  const deleted = getTombstoneSet(DELETED_CLASSES_KEY);
  const mergedMap = new Map<string, SchoolClass>();

  try {
    const snapshot = await fetchCollectionAuthoritative(path, true);
    const isAuthoritative = !snapshot.metadata.fromCache;

    if (!isAuthoritative) {
      readLocalClassesList().forEach(c => {
        if (!deleted.has(c.id) && !pendingClassDeletes.has(c.id)) mergedMap.set(c.id, c);
      });
    }

    snapshot.forEach(docSnap => {
      if (deleted.has(docSnap.id) || pendingClassDeletes.has(docSnap.id)) return;
      const fc = { id: docSnap.id, ...docSnap.data() } as SchoolClass;
      mergedMap.set(fc.id, { ...(mergedMap.get(fc.id) || {}), ...fc });
    });

    pendingClassSaves.forEach((pc, id) => {
      if (!deleted.has(id) && !pendingClassDeletes.has(id)) mergedMap.set(id, pc);
    });

    if (mergedMap.size === 0 && !isAuthoritative && !isSchoolBootstrapped()) {
      DEFAULT_SCHOOL_CLASSES.filter(c => !deleted.has(c.id)).forEach(c => mergedMap.set(c.id, c));
    }
  } catch (error) {
    console.warn('Fallback to cached school classes:', error);
    readLocalClassesList().forEach(c => {
      if (!deleted.has(c.id) && !pendingClassDeletes.has(c.id)) mergedMap.set(c.id, c);
    });
    pendingClassSaves.forEach((pc, id) => {
      if (!deleted.has(id) && !pendingClassDeletes.has(id)) mergedMap.set(id, pc);
    });
  }

  const finalClasses = Array.from(mergedMap.values());
  writeLocalClassesList(finalClasses);
  return finalClasses;
}

export async function saveSchoolClass(c: SchoolClass): Promise<void> {
  const path = `classes/${c.id}`;
  pendingClassDeletes.delete(c.id);
  removeTombstone(DELETED_CLASSES_KEY, c.id);
  const cleanClass = sanitizeFirestoreData<SchoolClass>({
    ...c,
    updatedAt: new Date().toISOString()
  });
  pendingClassSaves.set(cleanClass.id, cleanClass);

  try {
    const list = readLocalClassesList();
    const idx = list.findIndex(item => item.id === cleanClass.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...cleanClass };
    else list.push(cleanClass);
    writeLocalClassesList(list);
  } catch {}

  broadcastEntitySync('classesUpdated', 'CLASSES_UPDATED', { classObj: cleanClass, classId: cleanClass.id });

  const writePromise = Promise.all([
    setDoc(doc(db, 'classes', cleanClass.id), cleanClass, { merge: true }),
    clearCloudDeletion('deletedClassIds', cleanClass.id)
  ]).then(() => {
    const curr = pendingClassSaves.get(cleanClass.id);
    if (curr && curr.updatedAt === cleanClass.updatedAt) {
      pendingClassSaves.delete(cleanClass.id);
    }
  });

  await commitFirestoreFast(writePromise, OperationType.WRITE, path);
}

export async function deleteSchoolClass(classId: string): Promise<void> {
  const path = `classes/${classId}`;
  pendingClassSaves.delete(classId);
  pendingClassDeletes.add(classId);
  addTombstone(DELETED_CLASSES_KEY, classId);

  try {
    const list = readLocalClassesList().filter(c => c.id !== classId);
    writeLocalClassesList(list);
  } catch {}

  broadcastEntitySync('classesUpdated', 'CLASSES_UPDATED', { classId, deleted: true });

  const delPromise = Promise.all([
    deleteDoc(doc(db, 'classes', classId)),
    recordCloudDeletion('deletedClassIds', [classId])
  ]).finally(() => {
    pendingClassDeletes.delete(classId);
  });

  await commitFirestoreFast(delPromise, OperationType.DELETE, path);
}

export function subscribeSchoolClasses(callback: (classes: SchoolClass[]) => void): () => void {
  let firestoreList: SchoolClass[] = [];
  let hasServerSnapshot = false;
  let hasAnyRemote = false;

  const emitMerged = () => {
    const deleted = getTombstoneSet(DELETED_CLASSES_KEY);
    const merged = new Map<string, SchoolClass>();
    if (!hasServerSnapshot) {
      readLocalClassesList().forEach(c => {
        if (!deleted.has(c.id) && !pendingClassDeletes.has(c.id)) merged.set(c.id, c);
      });
    }
    if (hasAnyRemote) {
      firestoreList.forEach(fc => {
        if (!deleted.has(fc.id) && !pendingClassDeletes.has(fc.id)) {
          merged.set(fc.id, { ...(merged.get(fc.id) || {}), ...fc });
        }
      });
    }
    pendingClassSaves.forEach((pc, id) => {
      if (!deleted.has(id) && !pendingClassDeletes.has(id)) merged.set(id, pc);
    });
    const result = Array.from(merged.values());
    writeLocalClassesList(result);
    callback(result);
  };

  emitMerged();
  const releaseSyncState = retainSyncStateListener();

  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'classes'),
      { includeMetadataChanges: true },
      snapshot => {
        hasAnyRemote = true;
        if (!snapshot.metadata.fromCache) {
          hasServerSnapshot = true;
        }
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
    releaseSyncState();
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
        return parsed.filter((s: Subject) => s && s.id && !deleted.has(s.id) && !pendingSubjectDeletes.has(s.id));
      }
    }
  } catch {}
  if (isSchoolBootstrapped()) return [];
  return DEFAULT_SUBJECTS.filter(s => !deleted.has(s.id) && !pendingSubjectDeletes.has(s.id));
}

function writeLocalSubjectsList(list: Subject[]) {
  try {
    localStorage.setItem(SAVED_SUBJECTS_KEY, JSON.stringify(list));
  } catch {}
}

export async function fetchSubjects(): Promise<Subject[]> {
  const path = 'subjects';
  await fetchCloudSyncState(true).catch(() => null);
  const deleted = getTombstoneSet(DELETED_SUBJECTS_KEY);
  const mergedMap = new Map<string, Subject>();

  try {
    const snapshot = await fetchCollectionAuthoritative(path, true);
    const isAuthoritative = !snapshot.metadata.fromCache;

    if (!isAuthoritative) {
      readLocalSubjectsList().forEach(s => {
        if (!deleted.has(s.id) && !pendingSubjectDeletes.has(s.id)) mergedMap.set(s.id, s);
      });
    }

    snapshot.forEach(docSnap => {
      if (deleted.has(docSnap.id) || pendingSubjectDeletes.has(docSnap.id)) return;
      const fs = { id: docSnap.id, ...docSnap.data() } as Subject;
      mergedMap.set(fs.id, { ...(mergedMap.get(fs.id) || {}), ...fs });
    });

    pendingSubjectSaves.forEach((ps, id) => {
      if (!deleted.has(id) && !pendingSubjectDeletes.has(id)) mergedMap.set(id, ps);
    });

    if (mergedMap.size === 0 && !isAuthoritative && !isSchoolBootstrapped()) {
      DEFAULT_SUBJECTS.filter(s => !deleted.has(s.id)).forEach(s => mergedMap.set(s.id, s));
    }
  } catch (error) {
    console.warn('Fallback to cached subjects:', error);
    readLocalSubjectsList().forEach(s => {
      if (!deleted.has(s.id) && !pendingSubjectDeletes.has(s.id)) mergedMap.set(s.id, s);
    });
    pendingSubjectSaves.forEach((ps, id) => {
      if (!deleted.has(id) && !pendingSubjectDeletes.has(id)) mergedMap.set(id, ps);
    });
  }

  const finalSubjects = Array.from(mergedMap.values());
  writeLocalSubjectsList(finalSubjects);
  return finalSubjects;
}

export async function saveSubject(sub: Subject): Promise<void> {
  const path = `subjects/${sub.id}`;
  pendingSubjectDeletes.delete(sub.id);
  removeTombstone(DELETED_SUBJECTS_KEY, sub.id);
  const cleanSub = sanitizeFirestoreData<Subject>({
    ...sub,
    updatedAt: new Date().toISOString()
  });
  pendingSubjectSaves.set(cleanSub.id, cleanSub);

  try {
    const list = readLocalSubjectsList();
    const idx = list.findIndex(item => item.id === cleanSub.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...cleanSub };
    else list.push(cleanSub);
    writeLocalSubjectsList(list);
  } catch {}

  broadcastEntitySync('subjectsUpdated', 'SUBJECTS_UPDATED', { subject: cleanSub, subjectId: cleanSub.id });

  const writePromise = Promise.all([
    setDoc(doc(db, 'subjects', cleanSub.id), cleanSub, { merge: true }),
    clearCloudDeletion('deletedSubjectIds', cleanSub.id)
  ]).then(() => {
    const curr = pendingSubjectSaves.get(cleanSub.id);
    if (curr && curr.updatedAt === cleanSub.updatedAt) {
      pendingSubjectSaves.delete(cleanSub.id);
    }
  });

  await commitFirestoreFast(writePromise, OperationType.WRITE, path);
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const path = `subjects/${subjectId}`;
  pendingSubjectSaves.delete(subjectId);
  pendingSubjectDeletes.add(subjectId);
  addTombstone(DELETED_SUBJECTS_KEY, subjectId);

  try {
    const list = readLocalSubjectsList().filter(s => s.id !== subjectId);
    writeLocalSubjectsList(list);
  } catch {}

  broadcastEntitySync('subjectsUpdated', 'SUBJECTS_UPDATED', { subjectId, deleted: true });

  const delPromise = Promise.all([
    deleteDoc(doc(db, 'subjects', subjectId)),
    recordCloudDeletion('deletedSubjectIds', [subjectId])
  ]).finally(() => {
    pendingSubjectDeletes.delete(subjectId);
  });

  await commitFirestoreFast(delPromise, OperationType.DELETE, path);
}

export function subscribeSubjects(callback: (subjects: Subject[]) => void): () => void {
  let firestoreList: Subject[] = [];
  let hasServerSnapshot = false;
  let hasAnyRemote = false;

  const emitMerged = () => {
    const deleted = getTombstoneSet(DELETED_SUBJECTS_KEY);
    const merged = new Map<string, Subject>();
    if (!hasServerSnapshot) {
      readLocalSubjectsList().forEach(s => {
        if (!deleted.has(s.id) && !pendingSubjectDeletes.has(s.id)) merged.set(s.id, s);
      });
    }
    if (hasAnyRemote) {
      firestoreList.forEach(fs => {
        if (!deleted.has(fs.id) && !pendingSubjectDeletes.has(fs.id)) {
          merged.set(fs.id, { ...(merged.get(fs.id) || {}), ...fs });
        }
      });
    }
    pendingSubjectSaves.forEach((ps, id) => {
      if (!deleted.has(id) && !pendingSubjectDeletes.has(id)) merged.set(id, ps);
    });
    const result = Array.from(merged.values());
    writeLocalSubjectsList(result);
    callback(result);
  };

  emitMerged();
  const releaseSyncState = retainSyncStateListener();

  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'subjects'),
      { includeMetadataChanges: true },
      snapshot => {
        hasAnyRemote = true;
        if (!snapshot.metadata.fromCache) {
          hasServerSnapshot = true;
        }
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
    releaseSyncState();
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
let pendingSchoolSettingsSave: SchoolSettings | null = null;

function normalizeSchoolSettingsData(raw?: Partial<SchoolSettings> | null): SchoolSettings {
  return {
    ...DEFAULT_SCHOOL_SETTINGS,
    ...(raw || {}),
    caWeights: resolveCaWeights(raw?.caWeights)
  };
}

export async function fetchSchoolSettings(): Promise<SchoolSettings> {
  let localCached: SchoolSettings | null = null;
  try {
    const raw = localStorage.getItem('prime_edutech_school_settings');
    if (raw) {
      localCached = normalizeSchoolSettingsData(JSON.parse(raw) as SchoolSettings);
    }
  } catch {}

  try {
    const ref = doc(db, 'settings', 'school');
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const snap = isOnline
      ? await getDocFromServer(ref).catch(() => getDoc(ref))
      : await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data() as SchoolSettings;
      if (!data.schoolName || data.schoolName === 'PRIME EDUTECH') {
        const merged = normalizeSchoolSettingsData({
          ...data,
          schoolName: "Honey's World High School",
          address: data.address !== undefined ? data.address : DEFAULT_SCHOOL_SETTINGS.address,
          location: data.location !== undefined ? data.location : DEFAULT_SCHOOL_SETTINGS.location
        });
        saveSchoolSettings(merged).catch(() => {});
        return merged;
      }
      const normalized = normalizeSchoolSettingsData(
        pendingSchoolSettingsSave &&
        new Date(pendingSchoolSettingsSave.updatedAt || 0).getTime() > new Date(data.updatedAt || 0).getTime()
          ? pendingSchoolSettingsSave
          : data
      );
      try {
        localStorage.setItem('prime_edutech_school_settings', JSON.stringify(normalized));
      } catch {}
      return normalized;
    }
    if (localCached) return localCached;
    const defaultWithWeights = normalizeSchoolSettingsData(DEFAULT_SCHOOL_SETTINGS);
    saveSchoolSettings(defaultWithWeights).catch(() => {});
    return defaultWithWeights;
  } catch {
    return localCached || normalizeSchoolSettingsData(DEFAULT_SCHOOL_SETTINGS);
  }
}

export async function saveSchoolSettings(settings: SchoolSettings): Promise<void> {
  const path = 'settings/school';
  const cleanSettings = sanitizeFirestoreData<SchoolSettings>({
    ...settings,
    address: settings.address ?? '',
    location: settings.location ?? '',
    motto: settings.motto ?? '',
    nextTermBegins: settings.nextTermBegins ?? '',
    nextTermFees: settings.nextTermFees ?? '',
    caWeights: resolveCaWeights(settings.caWeights),
    updatedAt: new Date().toISOString()
  });
  pendingSchoolSettingsSave = cleanSettings;

  try {
    localStorage.setItem('prime_edutech_school_settings', JSON.stringify(cleanSettings));
  } catch {}

  broadcastEntitySync('schoolSettingsUpdated', 'SCHOOL_SETTINGS_UPDATED', cleanSettings);

  const writePromise = setDoc(doc(db, 'settings', 'school'), cleanSettings, { merge: true }).then(() => {
    if (pendingSchoolSettingsSave?.updatedAt === cleanSettings.updatedAt) {
      pendingSchoolSettingsSave = null;
    }
  });

  await commitFirestoreFast(writePromise, OperationType.WRITE, path);
}

export function subscribeSchoolSettings(callback: (settings: SchoolSettings) => void): () => void {
  const emitLocal = () => {
    try {
      const raw = localStorage.getItem('prime_edutech_school_settings');
      if (raw) {
        callback(normalizeSchoolSettingsData(JSON.parse(raw) as SchoolSettings));
        return;
      }
    } catch {}
    callback(normalizeSchoolSettingsData(DEFAULT_SCHOOL_SETTINGS));
  };

  emitLocal();

  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = onSnapshot(
      doc(db, 'settings', 'school'),
      { includeMetadataChanges: true },
      snap => {
        if (!snap.exists()) return;
        const remote = normalizeSchoolSettingsData(snap.data() as SchoolSettings);
        const current =
          pendingSchoolSettingsSave &&
          new Date(pendingSchoolSettingsSave.updatedAt || 0).getTime() > new Date(remote.updatedAt || 0).getTime()
            ? pendingSchoolSettingsSave
            : remote;
        try {
          localStorage.setItem('prime_edutech_school_settings', JSON.stringify(current));
        } catch {}
        callback(current);
      },
      err => {
        console.warn('School settings snapshot fallback:', err);
      }
    );
  } catch {}

  const onSync = () => emitLocal();
  if (typeof window !== 'undefined') {
    window.addEventListener('schoolSettingsUpdated', onSync);
    window.addEventListener('storage', onSync);
  }

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('prime_cbt_sync_channel');
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'SCHOOL_SETTINGS_UPDATED') onSync();
    };
  } catch {}

  return () => {
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('schoolSettingsUpdated', onSync);
      window.removeEventListener('storage', onSync);
    }
    if (bc) {
      try { bc.close(); } catch {}
    }
  };
}

// Examination Tombstones & Cross-Tab Broadcast Sync
export function getDeletedExamIds(): Set<string> {
  return getTombstoneSet(DELETED_EXAMS_KEY);
}

export function markExamAsDeleted(examId: string) {
  addTombstone(DELETED_EXAMS_KEY, examId);
}

export function markExamsAsDeletedBatch(examIds: string[]) {
  addTombstonesBatch(DELETED_EXAMS_KEY, examIds);
}

export function unmarkExamAsDeleted(examId: string) {
  removeTombstone(DELETED_EXAMS_KEY, examId);
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

const pickNewerExam = (a: Examination | undefined, b: Examination): Examination => {
  if (!a) return b;
  const tA = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
  const tB = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
  return tB >= tA ? b : a;
};

const readLocalExaminations = (): Examination[] => {
  try {
    const raw = localStorage.getItem('prime_cbt_saved_examinations');
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
};

const writeLocalExaminations = (exams: Examination[]) => {
  try {
    localStorage.setItem('prime_cbt_saved_examinations', JSON.stringify(exams));
  } catch {}
};

// Examination Service methods (Authoritative Cloud Sync)
export async function fetchExaminations(
  filterPublishedOnly = false,
  forceServer = true
): Promise<Examination[]> {
  const path = 'examinations';
  await fetchCloudSyncState(forceServer).catch(() => null);
  const deletedIds = getDeletedExamIds();

  try {
    const snapshot = await fetchCollectionAuthoritative(path, forceServer);
    const isAuthoritative = !snapshot.metadata.fromCache;
    const latestDeleted = getDeletedExamIds();
    const mergedMap: Record<string, Examination> = {};

    if (!isAuthoritative) {
      readLocalExaminations().forEach(e => {
        if (!latestDeleted.has(e.id) && !pendingExamDeletes.has(e.id)) {
          mergedMap[e.id] = pickNewerExam(mergedMap[e.id], e);
        }
      });
    }

    snapshot.forEach(docSnap => {
      if (!latestDeleted.has(docSnap.id) && !pendingExamDeletes.has(docSnap.id)) {
        const remoteExam = { id: docSnap.id, ...docSnap.data() } as Examination;
        mergedMap[docSnap.id] = pickNewerExam(mergedMap[docSnap.id], remoteExam);
      }
    });

    pendingExamSaves.forEach((pExam, id) => {
      if (!latestDeleted.has(id) && !pendingExamDeletes.has(id)) {
        mergedMap[id] = pickNewerExam(mergedMap[id], pExam);
      }
    });

    const finalExams = Object.values(mergedMap)
      .filter(e => !latestDeleted.has(e.id) && !pendingExamDeletes.has(e.id))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    writeLocalExaminations(finalExams);
    return filterPublishedOnly
      ? finalExams.filter(e => (e.status || '').trim().toLowerCase() === 'published')
      : finalExams;
  } catch (error) {
    console.warn('Network fallback for examinations:', error);
  }

  const cachedMap: Record<string, Examination> = {};
  readLocalExaminations().forEach(e => {
    if (!deletedIds.has(e.id) && !pendingExamDeletes.has(e.id)) {
      cachedMap[e.id] = pickNewerExam(cachedMap[e.id], e);
    }
  });
  pendingExamSaves.forEach((pExam, id) => {
    if (!deletedIds.has(id) && !pendingExamDeletes.has(id)) {
      cachedMap[id] = pickNewerExam(cachedMap[id], pExam);
    }
  });
  const finalExams = Object.values(cachedMap)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return filterPublishedOnly
    ? finalExams.filter(e => (e.status || '').trim().toLowerCase() === 'published')
    : finalExams;
}

export function subscribeExaminations(
  filterPublishedOnly: boolean,
  callback: (exams: Examination[]) => void
): () => void {
  let firestoreExams: Examination[] = [];
  let hasAnyRemote = false;
  let hasServerSnapshot = false;

  const emitMerged = () => {
    const deletedIds = getDeletedExamIds();
    const mergedMap: Record<string, Examination> = {};

    // Before first authoritative server response arrives (or while offline), render local cache
    if (!hasServerSnapshot) {
      readLocalExaminations().forEach(e => {
        if (!deletedIds.has(e.id) && !pendingExamDeletes.has(e.id)) {
          mergedMap[e.id] = pickNewerExam(mergedMap[e.id], e);
        }
      });
    }

    if (hasAnyRemote) {
      firestoreExams.forEach(e => {
        if (!deletedIds.has(e.id) && !pendingExamDeletes.has(e.id)) {
          mergedMap[e.id] = pickNewerExam(mergedMap[e.id], e);
        }
      });
    }

    // Always preserve active in-flight writes in this tab until settled on server
    pendingExamSaves.forEach((pExam, id) => {
      if (!deletedIds.has(id) && !pendingExamDeletes.has(id)) {
        mergedMap[id] = pickNewerExam(mergedMap[id], pExam);
      }
    });

    const sorted = Object.values(mergedMap)
      .filter(e => !deletedIds.has(e.id) && !pendingExamDeletes.has(e.id))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    writeLocalExaminations(sorted);
    callback(
      filterPublishedOnly
        ? sorted.filter(e => (e.status || '').trim().toLowerCase() === 'published')
        : sorted
    );
  };

  // Immediate local emit while waiting for live server snapshot
  emitMerged();

  const releaseSyncState = retainSyncStateListener();

  let syncedStateOnCache = false;
  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'examinations'),
      { includeMetadataChanges: true },
      snapshot => {
        hasAnyRemote = true;
        if (!snapshot.metadata.fromCache) {
          hasServerSnapshot = true;
        } else if (!syncedStateOnCache && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
          syncedStateOnCache = true;
          fetchCloudSyncState(true).then(() => emitMerged()).catch(() => {});
        }
        const deletedIds = getDeletedExamIds();
        const list: Examination[] = [];
        snapshot.forEach(docSnap => {
          if (!deletedIds.has(docSnap.id) && !pendingExamDeletes.has(docSnap.id)) {
            list.push({ id: docSnap.id, ...docSnap.data() } as Examination);
          }
        });
        firestoreExams = list;
        emitMerged();
      },
      err => {
        console.warn('Examinations real-time listener fallback:', err);
      }
    );
  } catch (err) {
    console.warn('Unable to attach examinations snapshot:', err);
  }

  const onSync = () => emitMerged();
  if (typeof window !== 'undefined') {
    window.addEventListener('prime_cbt_exams_updated', onSync);
    window.addEventListener('storage', onSync);
  }

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('prime_cbt_sync_channel');
    bc.onmessage = (ev) => {
      if (
        ev.data?.type === 'EXAM_SAVED' ||
        ev.data?.type === 'EXAM_DELETED' ||
        ev.data?.type === 'EXAMS_BATCH_DELETED' ||
        ev.data?.type === 'EXAMS_UPDATED' ||
        ev.data?.type === 'TIMER_RESTARTED'
      ) {
        onSync();
      }
    };
  } catch {}

  return () => {
    releaseSyncState();
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('prime_cbt_exams_updated', onSync);
      window.removeEventListener('storage', onSync);
    }
    if (bc) {
      try { bc.close(); } catch {}
    }
  };
}

export async function getExaminationById(examId: string): Promise<Examination | null> {
  const deletedIds = getDeletedExamIds();
  if (deletedIds.has(examId) || pendingExamDeletes.has(examId)) return null;

  const pending = pendingExamSaves.get(examId);
  if (pending) return pending;

  try {
    const ref = doc(db, 'examinations', examId);
    const snap = (typeof navigator === 'undefined' || navigator.onLine !== false)
      ? await getDocFromServer(ref).catch(() => getDoc(ref))
      : await getDoc(ref);
    if (snap.exists() && !getDeletedExamIds().has(snap.id)) {
      return { id: snap.id, ...snap.data() } as Examination;
    }
    if (!snap.metadata.fromCache) {
      return null;
    }
  } catch {}

  try {
    const list = readLocalExaminations();
    const match = list.find(e => e.id === examId);
    if (match && !deletedIds.has(match.id)) return match;
  } catch {}

  return null;
}

export async function saveExamination(exam: Examination): Promise<void> {
  // Clear any tombstone for this exam ID
  pendingExamDeletes.delete(exam.id);
  unmarkExamAsDeleted(exam.id);
  markSchoolBootstrappedLocal();

  // Explicitly preserve empty string for cleared dates so merge:true overwrites stale dates in Firestore
  const normalizedExam: Examination = {
    ...exam,
    startDate: (exam.startDate || '').trim(),
    endDate: (exam.endDate || '').trim(),
    updatedAt: new Date().toISOString()
  };
  const cleanExam = sanitizeFirestoreData(normalizedExam);
  pendingExamSaves.set(cleanExam.id, cleanExam);

  // 1. Immediately mirror to localStorage without resurrecting default exams
  try {
    const list = readLocalExaminations();
    const filtered = list.filter(e => e.id !== cleanExam.id);
    const updated = [cleanExam, ...filtered];
    writeLocalExaminations(updated);
  } catch (err) {
    console.warn('LocalStorage exam cache error:', err);
  }

  // 2. Broadcast immediately to student portals and all browser tabs
  broadcastExamSync('EXAM_SAVED', { examId: cleanExam.id, status: cleanExam.status });

  // 3. Sync directly to Firestore and remove any cloud deletion tombstone
  const path = `examinations/${cleanExam.id}`;
  const writePromise = Promise.all([
    setDoc(doc(db, 'examinations', cleanExam.id), cleanExam, { merge: true }),
    clearCloudDeletion('deletedExamIds', cleanExam.id)
  ]).then(() => {
    const curr = pendingExamSaves.get(cleanExam.id);
    if (curr && curr.updatedAt === cleanExam.updatedAt) {
      pendingExamSaves.delete(cleanExam.id);
    }
  });

  await commitFirestoreFast(writePromise, OperationType.WRITE, path);
}

async function deleteExamQuestionsSubcollection(examId: string): Promise<void> {
  try {
    const qSnap = await getDocs(collection(db, 'examinations', examId, 'questions'));
    if (!qSnap.empty) {
      await Promise.all(qSnap.docs.map(d => deleteDoc(d.ref).catch(() => {})));
    }
  } catch {}
}

export async function deleteExamination(examId: string): Promise<void> {
  pendingExamSaves.delete(examId);
  pendingExamDeletes.add(examId);
  markExamAsDeleted(examId);
  markSchoolBootstrappedLocal();

  // Update localStorage immediately
  try {
    const raw = localStorage.getItem('prime_cbt_saved_examinations');
    if (raw) {
      const list: Examination[] = JSON.parse(raw);
      localStorage.setItem('prime_cbt_saved_examinations', JSON.stringify(list.filter(e => e.id !== examId)));
    }
    localStorage.removeItem(`prime_cbt_questions_${examId}`);
  } catch (e) {}

  // Broadcast deletion to student portals and tabs immediately
  broadcastExamSync('EXAM_DELETED', { examId });

  const path = `examinations/${examId}`;
  const delPromise = Promise.all([
    deleteDoc(doc(db, 'examinations', examId)),
    deleteExamQuestionsSubcollection(examId),
    recordCloudDeletion('deletedExamIds', [examId])
  ]).finally(() => {
    pendingExamDeletes.delete(examId);
  });

  await commitFirestoreFast(delPromise, OperationType.DELETE, path, 12000);
}

// Mass Delete Examinations
export async function deleteExaminationsBatch(examIds: string[]): Promise<void> {
  if (!examIds || examIds.length === 0) return;
  examIds.forEach(id => {
    pendingExamSaves.delete(id);
    pendingExamDeletes.add(id);
  });
  markExamsAsDeletedBatch(examIds);
  markSchoolBootstrappedLocal();

  const idSet = new Set(examIds);
  try {
    const raw = localStorage.getItem('prime_cbt_saved_examinations');
    if (raw) {
      const list: Examination[] = JSON.parse(raw);
      localStorage.setItem('prime_cbt_saved_examinations', JSON.stringify(list.filter(e => !idSet.has(e.id))));
    }
    examIds.forEach(id => localStorage.removeItem(`prime_cbt_questions_${id}`));
  } catch (e) {}

  // Broadcast mass deletion immediately
  broadcastExamSync('EXAMS_BATCH_DELETED', { examIds });

  const delPromise = Promise.all([
    ...examIds.map(async (id) => {
      await deleteDoc(doc(db, 'examinations', id));
      await deleteExamQuestionsSubcollection(id);
    }),
    recordCloudDeletion('deletedExamIds', examIds)
  ]).finally(() => {
    examIds.forEach(id => pendingExamDeletes.delete(id));
  });

  await commitFirestoreFast(delPromise, OperationType.DELETE, 'examinations/batch', 12000);
}

// Restart Student Exam Timer & Unlock Retake (Preserves all prior exam submissions as 1st Exam, 2nd Exam, etc.)
export async function restartStudentExamTimer(studentId: string, examId: string): Promise<void> {
  const attemptId = `attempt_${studentId}_${examId}`;
  const now = new Date().toISOString();

  // 1. Clear local active timer/answers cache (keep past submissions intact!)
  try {
    localStorage.removeItem(`prime_cbt_attempt_${attemptId}`);
    localStorage.removeItem(`cbt_timer_${attemptId}`);
    localStorage.removeItem(`cbt_answers_${attemptId}`);
    localStorage.removeItem(`cbt_flagged_${attemptId}`);
    sessionStorage.removeItem(`prime_cbt_attempt_${attemptId}`);
  } catch (e) {}

  const retakeAttempt: ExamAttempt = {
    id: attemptId,
    examId,
    studentId,
    studentAdmissionNumber: '',
    studentName: '',
    startTime: now,
    endTime: now,
    status: 'retake_granted',
    savedAnswers: {},
    flaggedQuestions: {},
    lastHeartbeatAt: now,
    retakeGrantedAt: now
  };

  try {
    localStorage.setItem(`prime_cbt_attempt_${attemptId}`, JSON.stringify(retakeAttempt));
  } catch {}

  // 2. Broadcast immediately so student dashboard/screen enables retake right now
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('prime_cbt_timer_restarted', { detail: { studentId, examId, retakeGrantedAt: now } }));
    window.dispatchEvent(new CustomEvent('prime_cbt_exams_updated', { detail: { type: 'TIMER_RESTARTED', studentId, examId } }));
    window.dispatchEvent(new Event('storage'));
    try {
      const bc = new BroadcastChannel('prime_cbt_sync_channel');
      bc.postMessage({ type: 'TIMER_RESTARTED', studentId, examId, retakeGrantedAt: now, timestamp: Date.now() });
      bc.close();
    } catch (e) {}
  }

  // 3. Persist retake unlock on attempts/{attemptId} in Firestore (prior submissions stay preserved)
  await commitFirestoreFast(
    setDoc(doc(db, 'attempts', attemptId), sanitizeFirestoreData(retakeAttempt), { merge: true }),
    OperationType.WRITE,
    `attempts/${attemptId}`
  );
}

export async function markExamAttemptSubmitted(attemptId: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    localStorage.removeItem(`prime_cbt_attempt_${attemptId}`);
  } catch {}
  await commitFirestoreFast(
    setDoc(
      doc(db, 'attempts', attemptId),
      { status: 'submitted', lastHeartbeatAt: now },
      { merge: true }
    ),
    OperationType.WRITE,
    `attempts/${attemptId}`
  );
}

export async function fetchStudentAttempts(studentId: string): Promise<ExamAttempt[]> {
  const map = new Map<string, ExamAttempt>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`prime_cbt_attempt_attempt_${studentId}_`)) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw) as ExamAttempt;
          if (parsed && parsed.id) map.set(parsed.id, parsed);
        }
      }
    }
  } catch {}

  try {
    const q = query(collection(db, 'attempts'), where('studentId', '==', studentId));
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const snap = isOnline ? await getDocsFromServer(q).catch(() => getDocs(q)) : await getDocs(q);
    snap.forEach(d => {
      const data = { id: d.id, ...d.data() } as ExamAttempt;
      map.set(d.id, data);
    });
  } catch {}

  return Array.from(map.values());
}

// Question Service methods (Server-First Sync across Systems)
export async function fetchQuestions(examId: string): Promise<Question[]> {
  if (getDeletedExamIds().has(examId) || pendingExamDeletes.has(examId)) {
    return [];
  }

  const colRef = collection(db, 'examinations', examId, 'questions');
  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

  try {
    const snapshot = isOnline
      ? await getDocsFromServer(colRef).catch(() => getDocs(colRef))
      : await getDocs(colRef);

    if (!snapshot.metadata.fromCache) {
      const questions: Question[] = [];
      snapshot.forEach(docSnap => {
        questions.push({ id: docSnap.id, ...docSnap.data() } as Question);
      });
      const sorted = questions.sort((a, b) => a.questionNumber - b.questionNumber);
      try {
        localStorage.setItem(`prime_cbt_questions_${examId}`, JSON.stringify(sorted));
      } catch {}
      return sorted;
    }
  } catch (error) {
    console.warn('Firestore questions fetch fallback to local cache:', examId, error);
  }

  try {
    const raw = localStorage.getItem(`prime_cbt_questions_${examId}`);
    if (raw) {
      const parsed: Question[] = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.sort((a, b) => a.questionNumber - b.questionNumber);
    }
  } catch {}

  if (!isSchoolBootstrapped()) {
    return DEFAULT_QUESTIONS_MAP[examId] || [];
  }
  return [];
}

export async function saveQuestion(examId: string, question: Question): Promise<void> {
  const cleanQuestion = sanitizeFirestoreData(question);
  let totalCount = 1;

  // Update local cache
  try {
    const raw = localStorage.getItem(`prime_cbt_questions_${examId}`);
    const list: Question[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(q => q.id !== cleanQuestion.id);
    const updated = [...filtered, cleanQuestion].sort((a, b) => a.questionNumber - b.questionNumber);
    totalCount = updated.length;
    localStorage.setItem(`prime_cbt_questions_${examId}`, JSON.stringify(updated));
  } catch {}

  const path = `examinations/${examId}/questions/${cleanQuestion.id}`;
  const writePromise = Promise.all([
    setDoc(doc(db, 'examinations', examId, 'questions', cleanQuestion.id), cleanQuestion, { merge: true }),
    setDoc(
      doc(db, 'examinations', examId),
      { totalQuestions: totalCount, updatedAt: new Date().toISOString() },
      { merge: true }
    ).catch(() => {})
  ]);

  await commitFirestoreFast(writePromise, OperationType.WRITE, path);
  broadcastExamSync('EXAM_SAVED', { examId });
}

// Batch save questions atomically via chunked writeBatch with explicit Replace vs Append control
export async function saveQuestionsBatch(examId: string, newQuestions: Question[], replaceExisting = true): Promise<void> {
  const cleanNew = newQuestions.map(q => sanitizeFirestoreData(q));
  let finalList: Question[] = [];

  try {
    if (replaceExisting) {
      finalList = [...cleanNew];
    } else {
      const raw = localStorage.getItem(`prime_cbt_questions_${examId}`);
      const list: Question[] = raw ? JSON.parse(raw) : [];
      const newIds = new Set(cleanNew.map(q => q.id));
      finalList = [...list.filter(q => !newIds.has(q.id)), ...cleanNew];
    }
    finalList.sort((a, b) => a.questionNumber - b.questionNumber);
    localStorage.setItem(`prime_cbt_questions_${examId}`, JSON.stringify(finalList));
  } catch {}

  // Update exam's totalQuestions in local cache
  try {
    const rawExams = localStorage.getItem('prime_cbt_saved_examinations');
    if (rawExams) {
      const exams: Examination[] = JSON.parse(rawExams);
      const target = exams.find(e => e.id === examId);
      if (target) {
        target.totalQuestions = finalList.length;
        target.updatedAt = new Date().toISOString();
        localStorage.setItem('prime_cbt_saved_examinations', JSON.stringify(exams));
      }
    }
  } catch {}

  const syncBatch = async () => {
    const deleteRefs: ReturnType<typeof doc>[] = [];
    if (replaceExisting) {
      try {
        const existingSnap = await getDocs(collection(db, 'examinations', examId, 'questions'));
        const keepIds = new Set(cleanNew.map(q => q.id));
        existingSnap.forEach(d => {
          if (!keepIds.has(d.id)) {
            deleteRefs.push(d.ref);
          }
        });
      } catch {}
    }

    const ops: Array<() => void> = [];
    const CHUNK_SIZE = 350;
    const now = new Date().toISOString();

    type BatchOp =
      | { type: 'delete'; ref: ReturnType<typeof doc> }
      | { type: 'set'; q: Question };

    const allOps: BatchOp[] = [
      ...deleteRefs.map(ref => ({ type: 'delete' as const, ref })),
      ...cleanNew.map(q => ({ type: 'set' as const, q }))
    ];

    if (allOps.length === 0) {
      const batch = writeBatch(db);
      batch.set(
        doc(db, 'examinations', examId),
        { totalQuestions: finalList.length, updatedAt: now },
        { merge: true }
      );
      await batch.commit();
      return;
    }

    for (let i = 0; i < allOps.length; i += CHUNK_SIZE) {
      const chunk = allOps.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(op => {
        if (op.type === 'delete') {
          batch.delete(op.ref);
        } else {
          batch.set(doc(db, 'examinations', examId, 'questions', op.q.id), op.q, { merge: true });
        }
      });
      if (i + CHUNK_SIZE >= allOps.length) {
        batch.set(
          doc(db, 'examinations', examId),
          { totalQuestions: finalList.length, updatedAt: now },
          { merge: true }
        );
      }
      await batch.commit();
    }
    void ops;
  };

  await commitFirestoreFast(syncBatch(), OperationType.WRITE, `examinations/${examId}/questions`, 15000);
  broadcastExamSync('EXAM_SAVED', { examId });
}

export async function deleteQuestion(examId: string, questionId: string): Promise<void> {
  let remainingCount: number | null = null;
  try {
    const raw = localStorage.getItem(`prime_cbt_questions_${examId}`);
    if (raw) {
      const list: Question[] = JSON.parse(raw);
      const updated = list.filter(q => q.id !== questionId);
      remainingCount = updated.length;
      localStorage.setItem(`prime_cbt_questions_${examId}`, JSON.stringify(updated));
    }
  } catch {}

  const path = `examinations/${examId}/questions/${questionId}`;
  const runDelete = async () => {
    await deleteDoc(doc(db, 'examinations', examId, 'questions', questionId));
    if (remainingCount === null) {
      try {
        const colRef = collection(db, 'examinations', examId, 'questions');
        const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
        const snap = isOnline
          ? await getDocsFromServer(colRef).catch(() => getDocs(colRef))
          : await getDocs(colRef);
        const remaining: Question[] = [];
        snap.forEach(d => {
          if (d.id !== questionId) remaining.push({ id: d.id, ...d.data() } as Question);
        });
        remainingCount = remaining.length;
        try {
          localStorage.setItem(
            `prime_cbt_questions_${examId}`,
            JSON.stringify(remaining.sort((a, b) => a.questionNumber - b.questionNumber))
          );
        } catch {}
      } catch {}
    }

    if (remainingCount !== null) {
      const now = new Date().toISOString();
      try {
        const exams = readLocalExaminations().map(e =>
          e.id === examId ? { ...e, totalQuestions: remainingCount!, updatedAt: now } : e
        );
        writeLocalExaminations(exams);
      } catch {}
      await setDoc(
        doc(db, 'examinations', examId),
        { totalQuestions: remainingCount, updatedAt: now },
        { merge: true }
      ).catch(() => {});
    }
  };

  await commitFirestoreFast(runDelete(), OperationType.DELETE, path);
  broadcastExamSync('EXAM_SAVED', { examId });
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
const pickNewerLessonNote = (a: LessonNote | undefined, b: LessonNote): LessonNote => {
  if (!a) return b;
  const tA = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
  const tB = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
  return tB >= tA ? { ...a, ...b } : { ...b, ...a };
};

export async function fetchLessonNotes(teacherId?: string): Promise<LessonNote[]> {
  await fetchCloudSyncState(true).catch(() => null);
  const deleted = getTombstoneSet(DELETED_LESSON_NOTES_KEY);
  let cachedList: LessonNote[] = [];
  try {
    const raw = localStorage.getItem('prime_cbt_saved_lesson_notes');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedList = parsed.filter((n: LessonNote) => n && !deleted.has(n.id) && !pendingLessonNoteDeletes.has(n.id));
      }
    }
  } catch {}

  try {
    const q = teacherId
      ? query(collection(db, 'lesson_notes'), where('teacherId', '==', teacherId))
      : collection(db, 'lesson_notes');
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const snapshot = isOnline
      ? await getDocsFromServer(q).catch(() => getDocs(q))
      : await getDocs(q);
    const isAuthoritative = !snapshot.metadata.fromCache;

    const mergedMap: Record<string, LessonNote> = {};
    if (!isAuthoritative) {
      cachedList.forEach(n => {
        if (!teacherId || n.teacherId === teacherId) mergedMap[n.id] = n;
      });
    } else if (teacherId) {
      cachedList.forEach(n => {
        if (n.teacherId !== teacherId) mergedMap[n.id] = n;
      });
    }

    snapshot.forEach(docSnap => {
      if (deleted.has(docSnap.id) || pendingLessonNoteDeletes.has(docSnap.id)) return;
      const note = { id: docSnap.id, ...docSnap.data() } as LessonNote;
      mergedMap[note.id] = pickNewerLessonNote(mergedMap[note.id], note);
    });

    pendingLessonNoteSaves.forEach((pn, id) => {
      if (!deleted.has(id) && !pendingLessonNoteDeletes.has(id)) {
        mergedMap[id] = pickNewerLessonNote(mergedMap[id], pn);
      }
    });

    const allNotes = Object.values(mergedMap).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    try {
      localStorage.setItem('prime_cbt_saved_lesson_notes', JSON.stringify(allNotes));
    } catch {}
    return teacherId ? allNotes.filter(n => n.teacherId === teacherId) : allNotes;
  } catch (e) {
    console.warn('Lesson notes fetch fallback:', e);
  }

  const fallback = teacherId ? cachedList.filter(n => n.teacherId === teacherId) : cachedList;
  return fallback.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export async function saveLessonNote(note: LessonNote): Promise<void> {
  pendingLessonNoteDeletes.delete(note.id);
  removeTombstone(DELETED_LESSON_NOTES_KEY, note.id);

  const cleanNote = sanitizeFirestoreData<LessonNote>({
    ...note,
    updatedAt: new Date().toISOString()
  });
  pendingLessonNoteSaves.set(cleanNote.id, cleanNote);

  try {
    const raw = localStorage.getItem('prime_cbt_saved_lesson_notes');
    const list: LessonNote[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(n => n.id !== cleanNote.id);
    localStorage.setItem('prime_cbt_saved_lesson_notes', JSON.stringify([cleanNote, ...filtered]));
  } catch {}

  broadcastEntitySync('lessonNotesUpdated', 'LESSON_NOTES_UPDATED', { noteId: cleanNote.id });

  const writePromise = Promise.all([
    setDoc(doc(db, 'lesson_notes', cleanNote.id), cleanNote, { merge: true }),
    clearCloudDeletion('deletedLessonNoteIds', cleanNote.id)
  ]).then(() => {
    const curr = pendingLessonNoteSaves.get(cleanNote.id);
    if (curr && curr.updatedAt === cleanNote.updatedAt) {
      pendingLessonNoteSaves.delete(cleanNote.id);
    }
  });

  await commitFirestoreFast(writePromise, OperationType.WRITE, `lesson_notes/${cleanNote.id}`);
}

export async function deleteLessonNote(noteId: string): Promise<void> {
  pendingLessonNoteSaves.delete(noteId);
  pendingLessonNoteDeletes.add(noteId);
  addTombstone(DELETED_LESSON_NOTES_KEY, noteId);

  try {
    pruneLocalStorageListByIds('prime_cbt_saved_lesson_notes', [noteId]);
  } catch {}

  broadcastEntitySync('lessonNotesUpdated', 'LESSON_NOTES_UPDATED', { noteId, deleted: true });

  const delPromise = Promise.all([
    deleteDoc(doc(db, 'lesson_notes', noteId)),
    recordCloudDeletion('deletedLessonNoteIds', [noteId])
  ]).finally(() => {
    pendingLessonNoteDeletes.delete(noteId);
  });

  await commitFirestoreFast(delPromise, OperationType.DELETE, `lesson_notes/${noteId}`);
}

// Student Management methods
const pickNewerStudent = (existing: Student | undefined, incoming: Student): Student => {
  if (!existing) return incoming;
  const tExisting = new Date(existing.updatedAt || existing.registeredAt || 0).getTime() || 0;
  const tIncoming = new Date(incoming.updatedAt || incoming.registeredAt || 0).getTime() || 0;
  if (tIncoming >= tExisting) {
    return { ...existing, ...incoming };
  }
  return { ...incoming, ...existing };
};

function readLocalStudentsList(): Student[] {
  const deleted = getTombstoneSet(DELETED_STUDENTS_KEY);
  try {
    const local = localStorage.getItem(SAVED_STUDENTS_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        return parsed.filter((s: Student) => s && s.id && !deleted.has(s.id) && !pendingStudentDeletes.has(s.id));
      }
    }
  } catch {}
  if (isSchoolBootstrapped()) return [];
  return DEFAULT_STUDENTS.filter(s => !deleted.has(s.id) && !pendingStudentDeletes.has(s.id));
}

function writeLocalStudentsList(list: Student[]) {
  try {
    localStorage.setItem(SAVED_STUDENTS_KEY, JSON.stringify(list));
  } catch {}
}

export async function fetchStudents(classGrade?: string): Promise<Student[]> {
  const path = 'students';
  await fetchCloudSyncState(true).catch(() => null);
  const deleted = getTombstoneSet(DELETED_STUDENTS_KEY);
  const mergedMap = new Map<string, Student>();

  try {
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const q = classGrade
      ? query(collection(db, path), where('classGrade', '==', classGrade))
      : collection(db, path);

    const snapshot = isOnline
      ? await getDocsFromServer(q).catch(() => getDocs(q))
      : await getDocs(q);

    const isAuthoritative = !snapshot.metadata.fromCache;

    if (!isAuthoritative) {
      readLocalStudentsList().forEach(s => {
        if (!deleted.has(s.id) && !pendingStudentDeletes.has(s.id)) mergedMap.set(s.id, s);
      });
    } else if (classGrade) {
      readLocalStudentsList().forEach(s => {
        if (s.classGrade !== classGrade && !deleted.has(s.id) && !pendingStudentDeletes.has(s.id)) {
          mergedMap.set(s.id, s);
        }
      });
    }

    snapshot.forEach(docSnap => {
      if (deleted.has(docSnap.id) || pendingStudentDeletes.has(docSnap.id)) return;
      const data = docSnap.data() as Student;
      const accessCode = data.accessCode || `PRM-${docSnap.id.slice(-4).toUpperCase()}`;
      const fStu: Student = { ...data, id: docSnap.id, accessCode };
      mergedMap.set(fStu.id, pickNewerStudent(mergedMap.get(fStu.id), fStu));
    });

    pendingStudentSaves.forEach((ps, id) => {
      if (!deleted.has(id) && !pendingStudentDeletes.has(id)) {
        mergedMap.set(id, pickNewerStudent(mergedMap.get(id), ps));
      }
    });

    if (mergedMap.size === 0 && !isAuthoritative && !isSchoolBootstrapped()) {
      DEFAULT_STUDENTS.filter(s => !deleted.has(s.id)).forEach(s => mergedMap.set(s.id, s));
    }
  } catch (error) {
    console.warn('Fallback to cached students directory:', error);
    readLocalStudentsList().forEach(s => {
      if (!deleted.has(s.id) && !pendingStudentDeletes.has(s.id)) mergedMap.set(s.id, s);
    });
    pendingStudentSaves.forEach((ps, id) => {
      if (!deleted.has(id) && !pendingStudentDeletes.has(id)) {
        mergedMap.set(id, pickNewerStudent(mergedMap.get(id), ps));
      }
    });
  }

  const allStudents = Array.from(mergedMap.values());
  writeLocalStudentsList(allStudents);

  if (classGrade) {
    return allStudents.filter(s => s.classGrade === classGrade);
  }
  return allStudents;
}

export async function saveStudent(student: Student): Promise<Student> {
  const path = `students/${student.id}`;
  pendingStudentDeletes.delete(student.id);
  removeTombstone(DELETED_STUDENTS_KEY, student.id);

  const accessCode =
    student.accessCode && student.accessCode.trim() !== ''
      ? student.accessCode.trim().toUpperCase()
      : generateStudentAccessCode();

  const cleanStudent = sanitizeFirestoreData<Student>({
    ...student,
    accessCode,
    email: student.email ?? '',
    password: student.password ?? '',
    passportUrl: student.passportUrl ?? '',
    phoneNumber: student.phoneNumber ?? '',
    withheldReason: student.withheldReason ?? '',
    bio: student.bio ?? '',
    department: student.department ?? '',
    gender: student.gender ?? '',
    dateOfBirth: student.dateOfBirth ?? '',
    stateOfOrigin: student.stateOfOrigin ?? '',
    withheldSubjectIds: Array.isArray(student.withheldSubjectIds) ? student.withheldSubjectIds : [],
    updatedAt: new Date().toISOString()
  });

  pendingStudentSaves.set(cleanStudent.id, cleanStudent);

  try {
    const list = readLocalStudentsList();
    const idx = list.findIndex(
      s => s.id === cleanStudent.id || s.admissionNumber.toUpperCase() === cleanStudent.admissionNumber.toUpperCase()
    );
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...cleanStudent };
    } else {
      list.push(cleanStudent);
    }
    writeLocalStudentsList(list);
  } catch {}

  try {
    const activeRaw = sessionStorage.getItem('prime_edutech_active_student');
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw) as Student;
      if (parsed.id === cleanStudent.id) {
        sessionStorage.setItem('prime_edutech_active_student', JSON.stringify({ ...parsed, ...cleanStudent }));
      }
    }
  } catch {}

  broadcastEntitySync('studentsUpdated', 'STUDENTS_UPDATED', { student: cleanStudent, studentId: cleanStudent.id });

  const writePromise = Promise.all([
    setDoc(doc(db, 'students', cleanStudent.id), cleanStudent, { merge: true }),
    clearCloudDeletion('deletedStudentIds', cleanStudent.id)
  ]).then(() => {
    const curr = pendingStudentSaves.get(cleanStudent.id);
    if (curr && curr.updatedAt === cleanStudent.updatedAt) {
      pendingStudentSaves.delete(cleanStudent.id);
    }
  });

  await commitFirestoreFast(writePromise, OperationType.WRITE, path);
  return cleanStudent;
}

export async function saveStudentsBatch(
  studentsList: Student[]
): Promise<{ savedCount: number; syncedToCloud: boolean; students: Student[] }> {
  if (!studentsList || studentsList.length === 0) {
    return { savedCount: 0, syncedToCloud: true, students: [] };
  }

  const now = new Date().toISOString();
  const cleanList: Student[] = studentsList.map(student => {
    pendingStudentDeletes.delete(student.id);
    removeTombstone(DELETED_STUDENTS_KEY, student.id);
    const accessCode =
      student.accessCode && student.accessCode.trim() !== ''
        ? student.accessCode.trim().toUpperCase()
        : generateStudentAccessCode();
    return sanitizeFirestoreData<Student>({
      ...student,
      accessCode,
      email: student.email ?? '',
      password: student.password ?? '',
      passportUrl: student.passportUrl ?? '',
      phoneNumber: student.phoneNumber ?? '',
      withheldReason: student.withheldReason ?? '',
      bio: student.bio ?? '',
      department: student.department ?? '',
      gender: student.gender ?? '',
      dateOfBirth: student.dateOfBirth ?? '',
      stateOfOrigin: student.stateOfOrigin ?? '',
      withheldSubjectIds: Array.isArray(student.withheldSubjectIds) ? student.withheldSubjectIds : [],
      updatedAt: now
    });
  });

  cleanList.forEach(s => pendingStudentSaves.set(s.id, s));

  try {
    const existing = readLocalStudentsList();
    const byId = new Map<string, Student>();
    existing.forEach(s => byId.set(s.id, s));
    cleanList.forEach(s => byId.set(s.id, { ...byId.get(s.id), ...s }));
    writeLocalStudentsList(Array.from(byId.values()));
  } catch {}

  broadcastEntitySync('studentsUpdated', 'STUDENTS_UPDATED', { count: cleanList.length });

  let syncedToCloud = true;
  try {
    const commitBatch = async () => {
      const CHUNK_SIZE = 350;
      for (let i = 0; i < cleanList.length; i += CHUNK_SIZE) {
        const chunk = cleanList.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(s => {
          batch.set(doc(db, 'students', s.id), s, { merge: true });
        });
        await batch.commit();
      }
      await clearCloudDeletionsBatch('deletedStudentIds', cleanList.map(s => s.id));
    };

    await commitFirestoreFast(commitBatch(), OperationType.WRITE, 'students/batch', 15000);
    cleanList.forEach(s => {
      const curr = pendingStudentSaves.get(s.id);
      if (curr && curr.updatedAt === s.updatedAt) {
        pendingStudentSaves.delete(s.id);
      }
    });
  } catch (err) {
    console.warn('Batch student cloud write warning (saved locally):', err);
    syncedToCloud = false;
  }

  return { savedCount: cleanList.length, syncedToCloud, students: cleanList };
}

export async function promoteStudentsClassBatch(
  allStudents: Student[],
  studentIds: string[],
  targetClassGrade: string,
  targetAcademicSession: string,
  newStatus: 'active' | 'graduated' = 'active'
): Promise<{ promotedCount: number; syncedToCloud: boolean }> {
  const idSet = new Set(studentIds);
  const targets = allStudents
    .filter(s => idSet.has(s.id))
    .map(s => ({
      ...s,
      classGrade: newStatus === 'graduated' ? s.classGrade : targetClassGrade,
      academicSession: targetAcademicSession || s.academicSession,
      status: newStatus,
      updatedAt: new Date().toISOString()
    }));

  if (targets.length === 0) {
    return { promotedCount: 0, syncedToCloud: true };
  }

  const res = await saveStudentsBatch(targets);
  return { promotedCount: res.savedCount, syncedToCloud: res.syncedToCloud };
}

export async function deleteStudent(studentId: string): Promise<void> {
  const path = `students/${studentId}`;
  pendingStudentSaves.delete(studentId);
  pendingStudentDeletes.add(studentId);
  addTombstone(DELETED_STUDENTS_KEY, studentId);

  try {
    writeLocalStudentsList(readLocalStudentsList().filter(s => s.id !== studentId));
  } catch {}

  broadcastEntitySync('studentsUpdated', 'STUDENTS_UPDATED', { studentId, deleted: true });

  const delPromise = Promise.all([
    deleteDoc(doc(db, 'students', studentId)),
    recordCloudDeletion('deletedStudentIds', [studentId])
  ]).finally(() => {
    pendingStudentDeletes.delete(studentId);
  });

  await commitFirestoreFast(delPromise, OperationType.DELETE, path);
}

export function subscribeStudents(callback: (students: Student[]) => void): () => void {
  let firestoreList: Student[] = [];
  let hasServerSnapshot = false;
  let hasAnyRemote = false;

  const emitMerged = () => {
    const deleted = getTombstoneSet(DELETED_STUDENTS_KEY);
    const merged = new Map<string, Student>();

    if (!hasServerSnapshot) {
      readLocalStudentsList().forEach(s => {
        if (!deleted.has(s.id) && !pendingStudentDeletes.has(s.id)) merged.set(s.id, s);
      });
    }

    if (hasAnyRemote) {
      firestoreList.forEach(fs => {
        if (!deleted.has(fs.id) && !pendingStudentDeletes.has(fs.id)) {
          merged.set(fs.id, pickNewerStudent(merged.get(fs.id), fs));
        }
      });
    }

    pendingStudentSaves.forEach((ps, id) => {
      if (!deleted.has(id) && !pendingStudentDeletes.has(id)) {
        merged.set(id, pickNewerStudent(merged.get(id), ps));
      }
    });

    const result = Array.from(merged.values());
    writeLocalStudentsList(result);
    callback(result);
  };

  emitMerged();
  const releaseSyncState = retainSyncStateListener();

  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = onSnapshot(
      collection(db, 'students'),
      { includeMetadataChanges: true },
      snapshot => {
        hasAnyRemote = true;
        if (!snapshot.metadata.fromCache) {
          hasServerSnapshot = true;
        }
        const remote: Student[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as Student;
          remote.push({
            ...data,
            id: docSnap.id,
            accessCode: data.accessCode || `PRM-${docSnap.id.slice(-4).toUpperCase()}`
          });
        });
        firestoreList = remote;
        emitMerged();
      },
      err => {
        console.warn('Students snapshot listener fallback:', err);
      }
    );
  } catch {}

  const onSync = () => emitMerged();
  if (typeof window !== 'undefined') {
    window.addEventListener('studentsUpdated', onSync);
    window.addEventListener('storage', onSync);
  }

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('prime_cbt_sync_channel');
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'STUDENTS_UPDATED') onSync();
    };
  } catch {}

  return () => {
    releaseSyncState();
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('studentsUpdated', onSync);
      window.removeEventListener('storage', onSync);
    }
    if (bc) {
      try { bc.close(); } catch {}
    }
  };
}

// Student Authentication via Unique Passcode (e.g. PRM-4821)
export async function authenticateStudentByCode(rawCode: string): Promise<Student | null> {
  const cleanCode = rawCode.trim().toUpperCase();
  if (!cleanCode) return null;

  const deleted = getTombstoneSet(DELETED_STUDENTS_KEY);
  const path = 'students';
  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  try {
    const qCode = query(collection(db, path), where('accessCode', '==', cleanCode));
    const snapCode = isOnline
      ? await getDocsFromServer(qCode).catch(() => getDocs(qCode))
      : await getDocs(qCode);
    if (!snapCode.empty) {
      for (const docSnap of snapCode.docs) {
        if (deleted.has(docSnap.id)) continue;
        const data = docSnap.data() as Student;
        if (data.status === 'active') {
          return { ...data, id: docSnap.id, accessCode: data.accessCode || cleanCode };
        }
      }
    }

    const qAdm = query(collection(db, path), where('admissionNumber', '==', cleanCode));
    const snapAdm = isOnline
      ? await getDocsFromServer(qAdm).catch(() => getDocs(qAdm))
      : await getDocs(qAdm);
    if (!snapAdm.empty) {
      for (const docSnap of snapAdm.docs) {
        if (deleted.has(docSnap.id)) continue;
        const data = docSnap.data() as Student;
        if (data.status === 'active') {
          return { ...data, id: docSnap.id, accessCode: data.accessCode || cleanCode };
        }
      }
    }
  } catch (error) {
    console.warn('Student Firestore query by passcode fallback to local list:', error);
  }

  const localMatch = readLocalStudentsList().find(
    s => s.status === 'active' &&
         ((s.accessCode && s.accessCode.toUpperCase() === cleanCode) ||
          s.admissionNumber.toUpperCase() === cleanCode)
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
  const deleted = getTombstoneSet(DELETED_STUDENTS_KEY);

  const path = 'students';
  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  try {
    const q = query(collection(db, path), where('admissionNumber', '==', cleanAdm));
    const snapshot = isOnline
      ? await getDocsFromServer(q).catch(() => getDocs(q))
      : await getDocs(q);
    if (!snapshot.empty) {
      for (const docSnap of snapshot.docs) {
        if (deleted.has(docSnap.id)) continue;
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
    console.warn('Student Firestore query fallback to cached roster:', error);
  }

  const localMatch = readLocalStudentsList().find(
    s => s.status === 'active' &&
         s.admissionNumber.toUpperCase() === cleanAdm &&
         s.firstName.toLowerCase() === cleanFirst &&
         s.surname.toLowerCase() === cleanSurname
  );

  return localMatch || null;
}

// Asynchronously bootstrap school data ONCE on fresh database; never re-seeds deleted items
export async function ensureInitialSchoolData(): Promise<void> {
  try {
    const syncState = await fetchCloudSyncState(true);
    if (syncState?.hasBootstrapped) {
      markSchoolBootstrappedLocal();
      return;
    }

    const [examSnap, staffSnap, classSnap, subjectSnap, studentSnap] = await Promise.all([
      fetchCollectionAuthoritative('examinations', true),
      fetchCollectionAuthoritative('teachers', true),
      fetchCollectionAuthoritative('classes', true),
      fetchCollectionAuthoritative('subjects', true),
      fetchCollectionAuthoritative('students', true)
    ]);

    const alreadyProvisioned =
      !examSnap.empty || !staffSnap.empty || !classSnap.empty || !studentSnap.empty;

    if (alreadyProvisioned) {
      // School already exists in Firestore — lock bootstrap so deleted defaults never resurrect
      await setDoc(
        doc(db, 'settings', 'syncState'),
        { hasBootstrapped: true, updatedAt: new Date().toISOString() },
        { merge: true }
      ).catch(() => {});
      markSchoolBootstrappedLocal();

      // Only seed teachers if teachers collection itself was completely empty
      if (staffSnap.empty) {
        for (const staff of DEFAULT_STAFF) {
          await saveStaffMember(staff).catch(() => {});
        }
      }
      return;
    }

    // Fresh blank database: seed defaults once
    for (const cls of DEFAULT_SCHOOL_CLASSES) {
      await saveSchoolClass(cls).catch(() => {});
    }
    if (subjectSnap.empty) {
      for (const sub of DEFAULT_SUBJECTS) {
        await saveSubject(sub).catch(() => {});
      }
    }
    for (const std of DEFAULT_STUDENTS) {
      await saveStudent(std).catch(() => {});
    }
    for (const staff of DEFAULT_STAFF) {
      await saveStaffMember(staff).catch(() => {});
    }
    for (const exam of DEFAULT_EXAMINATIONS) {
      await saveExamination(exam).catch(() => {});
      const qs = DEFAULT_QUESTIONS_MAP[exam.id] || [];
      for (const q of qs) {
        await saveQuestion(exam.id, q).catch(() => {});
      }
    }

    await setDoc(
      doc(db, 'settings', 'syncState'),
      { hasBootstrapped: true, updatedAt: new Date().toISOString() },
      { merge: true }
    ).catch(() => {});
    markSchoolBootstrappedLocal();
  } catch (err) {
    console.warn('Initial school data ensure notice:', err);
  }
}

// Exam Attempts & Disconnection Recovery
export async function createExamAttempt(attempt: ExamAttempt): Promise<void> {
  const cleanAttempt = sanitizeFirestoreData<ExamAttempt>({
    ...attempt,
    tabSwitchCount: attempt.tabSwitchCount ?? 0,
    answeredCount: attempt.answeredCount ?? Object.keys(attempt.savedAnswers || {}).length,
    lastHeartbeatAt: attempt.lastHeartbeatAt || new Date().toISOString()
  });
  try {
    localStorage.setItem(`prime_cbt_attempt_${attempt.id}`, JSON.stringify(cleanAttempt));
  } catch {}
  try {
    await commitFirestoreFast(
      setDoc(doc(db, 'attempts', attempt.id), cleanAttempt, { merge: true }),
      OperationType.WRITE,
      `attempts/${attempt.id}`
    );
  } catch (error) {
    console.warn('Attempt cached in localStorage:', error);
  }
}

export async function getExamAttempt(attemptId: string): Promise<ExamAttempt | null> {
  try {
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const docRef = doc(db, 'attempts', attemptId);
    const snap = isOnline
      ? await getDocFromServer(docRef).catch(() => getDoc(docRef))
      : await getDoc(docRef);
    if (snap.exists()) {
      const data = { id: snap.id, ...snap.data() } as ExamAttempt;
      try {
        localStorage.setItem(`prime_cbt_attempt_${attemptId}`, JSON.stringify(data));
      } catch {}
      return data;
    }
    const local = localStorage.getItem(`prime_cbt_attempt_${attemptId}`);
    return local ? JSON.parse(local) : null;
  } catch {
    const local = localStorage.getItem(`prime_cbt_attempt_${attemptId}`);
    return local ? JSON.parse(local) : null;
  }
}

export async function updateExamAttemptProgress(
  attemptId: string,
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>,
  flagged?: Record<string, boolean>,
  meta?: {
    tabSwitchCount?: number;
    currentQuestionIndex?: number;
    answeredCount?: number;
    totalQuestions?: number;
    lastWarning?: string;
    examTitle?: string;
    subjectName?: string;
    classGrade?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const payload = sanitizeFirestoreData({
    savedAnswers: answers,
    flaggedQuestions: flagged || {},
    answeredCount: meta?.answeredCount ?? Object.keys(answers || {}).length,
    ...(meta?.tabSwitchCount !== undefined ? { tabSwitchCount: meta.tabSwitchCount } : {}),
    ...(meta?.currentQuestionIndex !== undefined ? { currentQuestionIndex: meta.currentQuestionIndex } : {}),
    ...(meta?.totalQuestions !== undefined ? { totalQuestions: meta.totalQuestions } : {}),
    ...(meta?.lastWarning !== undefined ? { lastWarning: meta.lastWarning } : {}),
    ...(meta?.examTitle ? { examTitle: meta.examTitle } : {}),
    ...(meta?.subjectName ? { subjectName: meta.subjectName } : {}),
    ...(meta?.classGrade ? { classGrade: meta.classGrade } : {}),
    lastHeartbeatAt: now
  });

  try {
    const local = localStorage.getItem(`prime_cbt_attempt_${attemptId}`);
    if (local) {
      const parsed = JSON.parse(local);
      localStorage.setItem(`prime_cbt_attempt_${attemptId}`, JSON.stringify({ ...parsed, ...payload }));
    }
  } catch {}

  try {
    await setDoc(doc(db, 'attempts', attemptId), payload, { merge: true });
  } catch (err) {
    console.warn('Attempt heartbeat cached locally:', err);
  }
}

export function subscribeExamAttempts(
  callback: (attempts: ExamAttempt[]) => void,
  examId?: string
): () => void {
  const colRef = examId
    ? query(collection(db, 'attempts'), where('examId', '==', examId))
    : collection(db, 'attempts');

  let unsub: (() => void) | null = null;
  try {
    unsub = onSnapshot(
      colRef,
      { includeMetadataChanges: true },
      snapshot => {
        const list: ExamAttempt[] = [];
        snapshot.forEach(d => {
          list.push({ id: d.id, ...d.data() } as ExamAttempt);
        });
        list.sort(
          (a, b) => new Date(b.lastHeartbeatAt || 0).getTime() - new Date(a.lastHeartbeatAt || 0).getTime()
        );
        callback(list);
      },
      err => {
        console.warn('Live exam monitor snapshot warning:', err);
      }
    );
  } catch (err) {
    console.warn('Live exam monitor subscription failed:', err);
  }

  return () => {
    if (unsub) unsub();
  };
}

export async function extendExamAttemptTime(attemptId: string, extraMinutes: number): Promise<ExamAttempt | null> {
  const existing = await getExamAttempt(attemptId);
  const nowMs = Date.now();
  const baseDeadline = existing?.endTime ? Math.max(nowMs, new Date(existing.endTime).getTime()) : nowMs;
  const newEndTime = new Date(baseDeadline + Math.max(1, extraMinutes) * 60 * 1000).toISOString();
  const nowIso = new Date(nowMs).toISOString();

  const patch: Partial<ExamAttempt> = {
    endTime: newEndTime,
    status: 'in_progress',
    lastWarning: `Invigilator extended timer by +${extraMinutes} min(s)`,
    lastHeartbeatAt: nowIso
  };

  await commitFirestoreFast(
    setDoc(doc(db, 'attempts', attemptId), sanitizeFirestoreData(patch), { merge: true }),
    OperationType.WRITE,
    `attempts/${attemptId}`
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('prime_cbt_attempt_updated', { detail: { attemptId, ...patch } }));
    try {
      const bc = new BroadcastChannel('prime_cbt_sync_channel');
      bc.postMessage({ type: 'TIMER_EXTENDED', attemptId, ...patch });
      bc.close();
    } catch {}
  }

  return existing ? { ...existing, ...patch } : null;
}

export async function forceSubmitExamAttempt(attemptId: string, reason = 'Force-submitted by Invigilator'): Promise<void> {
  const nowIso = new Date().toISOString();
  const patch: Partial<ExamAttempt> = {
    status: 'submitted',
    lastWarning: reason,
    lastHeartbeatAt: nowIso
  };
  await commitFirestoreFast(
    setDoc(doc(db, 'attempts', attemptId), sanitizeFirestoreData(patch), { merge: true }),
    OperationType.WRITE,
    `attempts/${attemptId}`
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('prime_cbt_force_submit_attempt', { detail: { attemptId, reason } }));
    try {
      const bc = new BroadcastChannel('prime_cbt_sync_channel');
      bc.postMessage({ type: 'FORCE_SUBMIT_ATTEMPT', attemptId, reason });
      bc.close();
    } catch {}
  }
}

// Submissions & Results (Every sitting stored separately: 1st Exam, 2nd Exam, etc.)
export async function saveSubmission(submission: Submission): Promise<string> {
  const path = 'submissions';
  const subId =
    submission.id ||
    `sub_${submission.studentId}_${submission.examId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  let localList: Submission[] = [];
  try {
    const raw = localStorage.getItem('prime_cbt_submissions');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localList = parsed;
    }
  } catch {}

  // Compute ordinal sitting number per student + normalized subject + session + term
  let computedAttemptNumber = submission.attemptNumber;
  if (!computedAttemptNumber) {
    try {
      const normSubj = (submission.subject || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const normSess = (submission.academicSession || '').trim().toUpperCase();
      const normTerm = (submission.term || '').trim().toUpperCase().replace(/\s+/g, '');

      const existingForStudent = await fetchSubmissions(undefined, submission.studentId).catch(() =>
        localList.filter(s => s.studentId === submission.studentId)
      );
      const priorSameSubject = existingForStudent.filter(s => {
        if (s.id === subId) return false;
        const sSubj = (s.subject || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const sSess = (s.academicSession || '').trim().toUpperCase();
        const sTerm = (s.term || '').trim().toUpperCase().replace(/\s+/g, '');
        return sSubj === normSubj && sSess === normSess && sTerm === normTerm;
      });
      computedAttemptNumber = priorSameSubject.length + 1;
    } catch {
      computedAttemptNumber = 1;
    }
  }

  pendingSubmissionDeletes.delete(subId);
  removeTombstone(DELETED_SUBMISSIONS_KEY, subId);

  const sittingLabel = submission.sittingLabel || formatOrdinalExamLabel(computedAttemptNumber);
  const cleanSub = sanitizeFirestoreData({
    ...submission,
    id: subId,
    attemptNumber: computedAttemptNumber,
    sittingLabel
  });
  pendingSubmissionSaves.set(subId, cleanSub);

  // Mutate caller object so immediate result slip displays exact sitting label & ID
  submission.id = subId;
  submission.attemptNumber = computedAttemptNumber;
  submission.sittingLabel = sittingLabel;

  // Mirror immediately in localStorage — NEVER erase previous sittings for same exam or subject
  try {
    const deleted = getTombstoneSet(DELETED_SUBMISSIONS_KEY);
    const filtered = localList.filter(s => s.id !== subId && !deleted.has(s.id || ''));
    filtered.unshift(cleanSub);
    localStorage.setItem('prime_cbt_submissions', JSON.stringify(filtered));
  } catch {}

  broadcastExamSync('SUBMISSIONS_UPDATED', { examId: cleanSub.examId, studentId: cleanSub.studentId, submissionId: subId });

  try {
    await commitFirestoreFast(
      Promise.all([
        setDoc(doc(db, path, subId), cleanSub, { merge: true }),
        clearCloudDeletion('deletedSubmissionIds', subId)
      ]).then(() => {
        pendingSubmissionSaves.delete(subId);
      }),
      OperationType.WRITE,
      `${path}/${subId}`
    );
  } catch (error) {
    console.warn('Submission Firestore write queued offline:', error);
  }

  return subId;
}

// Auto-fill CBT score into the student's Continuous Assessment / Terminal Report Sheet record
// Routes into 1st CA, 2nd CA, or Term's Exam based on exam.targetCaComponent while preserving all sittings separately
export async function syncCbtSubmissionToReportSheet(
  submission: Submission,
  exam?: Examination
): Promise<{ scaledExamScore: number; examMax: number; targetCaComponent: CbtTargetComponent }> {
  const settings = await fetchSchoolSettings().catch(() => DEFAULT_SCHOOL_SETTINGS);
  const caWeights = resolveCaWeights(settings?.caWeights);

  let resolvedExam: Partial<Examination> | undefined = exam;
  if (!resolvedExam && !submission.targetCaComponent && submission.examId) {
    try {
      const examsList = await fetchExaminations(false);
      resolvedExam = examsList.find(e => e.id === submission.examId);
    } catch {}
  }

  const targetComponent: CbtTargetComponent = resolveExamTargetComponent(resolvedExam, submission);
  const componentMax = getTargetComponentMax(targetComponent, caWeights);
  const scaledScore = Math.min(
    componentMax,
    Math.max(0, Math.round(((submission.percentage || 0) / 100) * componentMax))
  );

  // Resolve subject ID reliably
  let resolvedSubjectId = resolvedExam?.subjectId || '';
  if (!resolvedSubjectId) {
    try {
      const subjects = await fetchSubjects();
      const matchedSub = subjects.find(
        s => s.name.trim().toLowerCase() === (submission.subject || '').trim().toLowerCase()
      );
      if (matchedSub) resolvedSubjectId = matchedSub.id;
    } catch {}
  }
  if (!resolvedSubjectId) {
    resolvedSubjectId = `sub_${(submission.subject || 'general').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  }

  // Locate any existing CA record for this student, subject, session & term so other columns & prior sittings are preserved
  const normSubjName = (submission.subject || '').trim().toLowerCase();
  const normAdm = (submission.admissionNumber || '').trim().toUpperCase();
  const existingPool = await fetchAssessmentRecords(
    resolvedSubjectId,
    submission.classGrade,
    submission.academicSession,
    submission.term,
    submission.subject
  ).catch(() => []);

  const existing = existingPool.find(r => {
    const sameStudent =
      (submission.studentId && r.studentId === submission.studentId) ||
      (normAdm && (r.admissionNumber || '').trim().toUpperCase() === normAdm);
    const sameSubject =
      (resolvedSubjectId && r.subjectId === resolvedSubjectId) ||
      (normSubjName && (r.subjectName || '').trim().toLowerCase() === normSubjName);
    return sameStudent && sameSubject;
  });

  const recordId =
    existing?.id ||
    buildCanonicalCaRecordId(
      submission.studentId || submission.admissionNumber || 'stu',
      resolvedSubjectId,
      submission.academicSession || settings.academicSession || '2025/2026',
      submission.term || settings.currentTerm || '1st Term'
    );

  // Build separate CBT sitting entries list without overwriting earlier sittings or other columns
  const priorEntries: CbtExamEntry[] = Array.isArray(existing?.examEntries) ? [...existing.examEntries] : [];
  if (priorEntries.length === 0 && existing?.cbtSubmissionId && existing.cbtSubmissionId !== submission.id && (existing.examScore || 0) > 0) {
    priorEntries.push({
      submissionId: existing.cbtSubmissionId,
      examId: 'legacy',
      examTitle: `${submission.subject} CBT Paper`,
      sittingNumber: 1,
      sittingLabel: '1st Exam',
      targetCaComponent: 'exam',
      rawScore: existing.examScore,
      totalQuestions: caWeights.examMax,
      percentage: Math.round((existing.examScore / Math.max(1, caWeights.examMax)) * 100),
      scaledScore: existing.examScore,
      examMax: caWeights.examMax,
      submittedAt: existing.updatedAt || new Date().toISOString()
    });
  }

  const subId = submission.id || `sub_${submission.studentId}_${submission.examId}_${Date.now()}`;
  const incomingEntry: CbtExamEntry = {
    submissionId: subId,
    examId: submission.examId,
    examTitle: submission.examTitle,
    sittingNumber: submission.attemptNumber || (priorEntries.length + 1),
    sittingLabel: submission.sittingLabel || formatOrdinalExamLabel(submission.attemptNumber || (priorEntries.length + 1)),
    targetCaComponent: targetComponent,
    rawScore: submission.score,
    totalQuestions: submission.totalQuestions,
    percentage: submission.percentage,
    scaledScore,
    examMax: componentMax,
    submittedAt: submission.submittedAt
  };

  const mergedEntriesMap = new Map<string, CbtExamEntry>();
  priorEntries.forEach(e => { if (e && e.submissionId) mergedEntriesMap.set(e.submissionId, e); });
  mergedEntriesMap.set(subId, incomingEntry);

  const nextEntries = Array.from(mergedEntriesMap.values())
    .sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime())
    .map((entry, idx) => ({
      ...entry,
      sittingNumber: idx + 1,
      sittingLabel: formatOrdinalExamLabel(idx + 1)
    }));

  const matchingComponentEntries = nextEntries.filter(
    e => (e.targetCaComponent || 'exam') === targetComponent
  );
  const aggregatedComponentScore = matchingComponentEntries.length > 0
    ? Math.min(
        componentMax,
        Math.round(
          matchingComponentEntries.reduce((sum, e) => sum + (e.scaledScore || 0), 0) /
            matchingComponentEntries.length
        )
      )
    : scaledScore;

  const assignmentScore = Math.min(caWeights.assignmentMax, Math.max(0, existing?.assignmentScore ?? 0));
  let firstCaScore = Math.min(caWeights.firstCaMax, Math.max(0, existing?.firstCaScore ?? existing?.testScore ?? 0));
  let secondCaScore = Math.min(caWeights.secondCaMax, Math.max(0, existing?.secondCaScore ?? existing?.projectScore ?? 0));
  let examScore = Math.min(caWeights.examMax, Math.max(0, existing?.examScore ?? 0));

  if (targetComponent === 'first_ca') {
    firstCaScore = aggregatedComponentScore;
  } else if (targetComponent === 'second_ca') {
    secondCaScore = aggregatedComponentScore;
  } else {
    examScore = aggregatedComponentScore;
  }

  const maxTotal =
    (caWeights.assignmentMax || 0) +
    (caWeights.firstCaMax || 0) +
    (caWeights.secondCaMax || 0) +
    (caWeights.examMax || 0) || 100;
  const totalScore = Math.min(maxTotal, assignmentScore + firstCaScore + secondCaScore + examScore);
  const pct = maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : totalScore;

  let grade = 'F9';
  let remark = 'FAIL';
  if (pct >= 75) {
    grade = 'A';
    remark = 'EXCELLENT';
  } else if (pct >= 60) {
    grade = 'B';
    remark = 'V.GOOD';
  } else if (pct >= 50) {
    grade = 'C';
    remark = 'GOOD';
  } else if (pct >= 40) {
    grade = 'D';
    remark = 'FAIR';
  }

  const record: StudentAssessmentRecord = {
    id: recordId,
    studentId: submission.studentId,
    studentName: submission.studentName,
    admissionNumber: submission.admissionNumber,
    classGrade: submission.classGrade,
    subjectId: existing?.subjectId || resolvedSubjectId,
    subjectName: submission.subject || existing?.subjectName || 'Subject',
    academicSession: submission.academicSession || settings.academicSession,
    term: (submission.term as '1st Term' | '2nd Term' | '3rd Term') || (settings.currentTerm as any) || '1st Term',
    assignmentScore,
    firstCaScore,
    secondCaScore,
    testScore: firstCaScore,
    projectScore: secondCaScore,
    examScore,
    totalScore,
    grade,
    remark,
    cbtSubmissionId: subId,
    examEntries: nextEntries,
    isAutoSynced: true,
    teacherComment: existing?.teacherComment || '',
    teacherSignature: existing?.teacherSignature || 'Signed',
    updatedAt: new Date().toISOString()
  };

  await saveAssessmentRecord(record);
  return { scaledExamScore: scaledScore, examMax: componentMax, targetCaComponent: targetComponent };
}

export async function fetchSubmissions(examId?: string, studentId?: string): Promise<Submission[]> {
  const path = 'submissions';
  await fetchCloudSyncState(true).catch(() => null);
  const deleted = getTombstoneSet(DELETED_SUBMISSIONS_KEY);
  const mergedMap = new Map<string, Submission>();

  const matches = (s: Submission) => {
    if (s.id && (deleted.has(s.id) || pendingSubmissionDeletes.has(s.id))) return false;
    if (examId && s.examId !== examId) return false;
    if (studentId && s.studentId !== studentId) return false;
    return true;
  };

  let allLocal: Submission[] = [];
  try {
    const raw = localStorage.getItem('prime_cbt_submissions');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        allLocal = parsed.filter((s: Submission) => s && (!s.id || (!deleted.has(s.id) && !pendingSubmissionDeletes.has(s.id))));
      }
    }
  } catch {}

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

    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const snapshot = isOnline
      ? await getDocsFromServer(q).catch(() => getDocs(q))
      : await getDocs(q);

    const isAuthoritative = !snapshot.metadata.fromCache;
    if (!isAuthoritative) {
      allLocal.forEach(s => {
        if (matches(s)) mergedMap.set(s.id || `${s.studentId}_${s.examId}_${s.submittedAt}`, s);
      });
    }

    const remoteSubs: Submission[] = [];
    snapshot.forEach(docSnap => {
      if (deleted.has(docSnap.id) || pendingSubmissionDeletes.has(docSnap.id)) return;
      const sub = { id: docSnap.id, ...docSnap.data() } as Submission;
      remoteSubs.push(sub);
      mergedMap.set(sub.id || `${sub.studentId}_${sub.examId}_${sub.submittedAt}`, sub);
    });

    pendingSubmissionSaves.forEach((ps, id) => {
      if (!deleted.has(id) && !pendingSubmissionDeletes.has(id) && matches(ps)) {
        mergedMap.set(id, ps);
      }
    });

    if (isAuthoritative) {
      const preserved = allLocal.filter(s => !matches(s));
      const pendingMatching = Array.from(pendingSubmissionSaves.values()).filter(
        ps => matches(ps) && !remoteSubs.some(rs => rs.id === ps.id)
      );
      try {
        localStorage.setItem('prime_cbt_submissions', JSON.stringify([...pendingMatching, ...remoteSubs, ...preserved]));
      } catch {}
    }
  } catch (error) {
    console.warn('Submissions fetch fallback to local cache:', error);
    allLocal.forEach(s => {
      if (matches(s)) mergedMap.set(s.id || `${s.studentId}_${s.examId}_${s.submittedAt}`, s);
    });
    pendingSubmissionSaves.forEach((ps, id) => {
      if (!deleted.has(id) && !pendingSubmissionDeletes.has(id) && matches(ps)) {
        mergedMap.set(id, ps);
      }
    });
  }

  return enrichSubmissionsWithOrdinals(Array.from(mergedMap.values()));
}

export function subscribeStudentSubmissions(
  studentId: string,
  callback: (subs: Submission[]) => void
): () => void {
  let remoteSubs: Submission[] = [];
  let hasServer = false;
  let hasAny = false;

  const emit = () => {
    const deleted = getTombstoneSet(DELETED_SUBMISSIONS_KEY);
    let allLocal: Submission[] = [];
    try {
      const raw = localStorage.getItem('prime_cbt_submissions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          allLocal = parsed.filter((s: Submission) => s && (!s.id || (!deleted.has(s.id) && !pendingSubmissionDeletes.has(s.id))));
        }
      }
    } catch {}

    const map = new Map<string, Submission>();
    if (!hasServer) {
      allLocal.filter(s => s.studentId === studentId).forEach(s => {
        map.set(s.id || `${s.studentId}_${s.examId}_${s.submittedAt}`, s);
      });
    }
    if (hasAny) {
      remoteSubs.forEach(s => {
        if (!s.id || (!deleted.has(s.id) && !pendingSubmissionDeletes.has(s.id))) {
          map.set(s.id || `${s.studentId}_${s.examId}_${s.submittedAt}`, s);
        }
      });
    }
    pendingSubmissionSaves.forEach((ps, id) => {
      if (ps.studentId === studentId && !deleted.has(id) && !pendingSubmissionDeletes.has(id)) {
        map.set(id, ps);
      }
    });

    const list = enrichSubmissionsWithOrdinals(Array.from(map.values()));
    if (hasServer) {
      const others = allLocal.filter(s => s.studentId !== studentId);
      try {
        localStorage.setItem('prime_cbt_submissions', JSON.stringify([...list, ...others]));
      } catch {}
    }
    callback(list);
  };

  emit();
  const releaseSyncState = retainSyncStateListener();

  let unsub: (() => void) | null = null;
  try {
    const q = query(collection(db, 'submissions'), where('studentId', '==', studentId));
    unsub = onSnapshot(
      q,
      { includeMetadataChanges: true },
      snapshot => {
        hasAny = true;
        if (!snapshot.metadata.fromCache) hasServer = true;
        const arr: Submission[] = [];
        snapshot.forEach(docSnap => {
          arr.push({ id: docSnap.id, ...docSnap.data() } as Submission);
        });
        remoteSubs = arr;
        emit();
      },
      err => console.warn('Student submissions snapshot fallback:', err)
    );
  } catch {}

  const onSync = () => emit();
  if (typeof window !== 'undefined') {
    window.addEventListener('prime_cbt_exams_updated', onSync);
    window.addEventListener('prime_cbt_timer_restarted', onSync);
    window.addEventListener('storage', onSync);
  }

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('prime_cbt_sync_channel');
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'SUBMISSIONS_UPDATED' || ev.data?.type === 'TIMER_RESTARTED') {
        onSync();
      }
    };
  } catch {}

  return () => {
    releaseSyncState();
    if (unsub) unsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('prime_cbt_exams_updated', onSync);
      window.removeEventListener('prime_cbt_timer_restarted', onSync);
      window.removeEventListener('storage', onSync);
    }
    if (bc) {
      try { bc.close(); } catch {}
    }
  };
}

export function subscribeSubmissions(callback: (subs: Submission[]) => void): () => void {
  let remoteSubs: Submission[] = [];
  let hasServer = false;
  let hasAny = false;

  const emit = () => {
    const deleted = getTombstoneSet(DELETED_SUBMISSIONS_KEY);
    let allLocal: Submission[] = [];
    try {
      const raw = localStorage.getItem('prime_cbt_submissions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          allLocal = parsed.filter((s: Submission) => s && (!s.id || (!deleted.has(s.id) && !pendingSubmissionDeletes.has(s.id))));
        }
      }
    } catch {}

    const map = new Map<string, Submission>();
    if (!hasServer) {
      allLocal.forEach(s => map.set(s.id || `${s.studentId}_${s.examId}_${s.submittedAt}`, s));
    }
    if (hasAny) {
      remoteSubs.forEach(s => {
        if (!s.id || (!deleted.has(s.id) && !pendingSubmissionDeletes.has(s.id))) {
          map.set(s.id || `${s.studentId}_${s.examId}_${s.submittedAt}`, s);
        }
      });
    }
    pendingSubmissionSaves.forEach((ps, id) => {
      if (!deleted.has(id) && !pendingSubmissionDeletes.has(id)) {
        map.set(id, ps);
      }
    });

    const list = enrichSubmissionsWithOrdinals(Array.from(map.values()));
    try {
      localStorage.setItem('prime_cbt_submissions', JSON.stringify(list));
    } catch {}
    callback(list);
  };

  emit();
  const releaseSyncState = retainSyncStateListener();

  let unsub: (() => void) | null = null;
  try {
    unsub = onSnapshot(
      collection(db, 'submissions'),
      { includeMetadataChanges: true },
      snapshot => {
        hasAny = true;
        if (!snapshot.metadata.fromCache) hasServer = true;
        const arr: Submission[] = [];
        snapshot.forEach(docSnap => {
          arr.push({ id: docSnap.id, ...docSnap.data() } as Submission);
        });
        remoteSubs = arr;
        emit();
      },
      err => console.warn('Submissions snapshot fallback:', err)
    );
  } catch {}

  const onSync = () => emit();
  if (typeof window !== 'undefined') {
    window.addEventListener('prime_cbt_exams_updated', onSync);
    window.addEventListener('prime_cbt_timer_restarted', onSync);
    window.addEventListener('storage', onSync);
  }

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('prime_cbt_sync_channel');
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'SUBMISSIONS_UPDATED' || ev.data?.type === 'TIMER_RESTARTED') {
        onSync();
      }
    };
  } catch {}

  return () => {
    releaseSyncState();
    if (unsub) unsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('prime_cbt_exams_updated', onSync);
      window.removeEventListener('prime_cbt_timer_restarted', onSync);
      window.removeEventListener('storage', onSync);
    }
    if (bc) {
      try { bc.close(); } catch {}
    }
  };
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

const normalizeSessionCode = (val?: string) =>
  (val || '').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const normalizeCaSubjectKey = (val?: string) =>
  (val || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const pickNewerRecord = (
  a: StudentAssessmentRecord | undefined,
  b: StudentAssessmentRecord
): StudentAssessmentRecord => {
  if (!a) return b;
  const tA = new Date(a.updatedAt || 0).getTime() || 0;
  const tB = new Date(b.updatedAt || 0).getTime() || 0;
  return tB >= tA ? b : a;
};

function resolveSubjectNameFromLocal(subjectId?: string): string {
  if (!subjectId) return '';
  try {
    const raw = localStorage.getItem(SAVED_SUBJECTS_KEY);
    if (raw) {
      const list = JSON.parse(raw) as Subject[];
      const match = Array.isArray(list) ? list.find(s => s && s.id === subjectId) : undefined;
      if (match?.name) return match.name;
    }
  } catch {}
  return '';
}

function readLocalCaRecords(): StudentAssessmentRecord[] {
  const deleted = getTombstoneSet(DELETED_CA_RECORDS_KEY);
  try {
    const raw = localStorage.getItem(SAVED_CA_RECORDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (r: StudentAssessmentRecord) => r && r.id && !deleted.has(r.id) && !pendingCaRecordDeletes.has(r.id)
        );
      }
    }
  } catch {}
  return [];
}

function writeLocalCaRecordsMerged(incoming: StudentAssessmentRecord[]) {
  try {
    const deleted = getTombstoneSet(DELETED_CA_RECORDS_KEY);
    const map = new Map<string, StudentAssessmentRecord>();
    incoming.forEach(r => {
      if (r && r.id && !deleted.has(r.id) && !pendingCaRecordDeletes.has(r.id)) {
        map.set(r.id, pickNewerRecord(map.get(r.id), r));
      }
    });
    // Always preserve every dirty record in localStorage so server snapshots never erase unsynced scores
    pendingCaRecordSaves.forEach((pr, id) => {
      if (pr && !deleted.has(id) && !pendingCaRecordDeletes.has(id)) {
        map.set(id, pickNewerRecord(map.get(id), pr));
      }
    });
    localStorage.setItem(SAVED_CA_RECORDS_KEY, JSON.stringify(Array.from(map.values())));
  } catch {}
}

function normalizeCleanCaRecord(record: StudentAssessmentRecord): StudentAssessmentRecord {
  const canonicalId = record.id
    ? record.id.replace(/[^a-zA-Z0-9_-]/g, '_')
    : buildCanonicalCaRecordId(
        record.studentId || record.admissionNumber || 'stu',
        record.subjectId || record.subjectName || 'sub',
        record.academicSession || '2025/2026',
        record.term || '1st Term'
      );

  const firstCa =
    typeof record.firstCaScore === 'number'
      ? record.firstCaScore
      : (record.testScore ?? 0);
  const secondCa =
    typeof record.secondCaScore === 'number'
      ? record.secondCaScore
      : (record.projectScore ?? 0);

  return sanitizeFirestoreData<StudentAssessmentRecord>({
    ...record,
    id: canonicalId,
    firstCaScore: firstCa,
    secondCaScore: secondCa,
    testScore: firstCa,
    projectScore: secondCa,
    explicitlySaved: true,
    teacherComment: record.teacherComment ?? '',
    teacherSignature: record.teacherSignature ?? 'Signed',
    updatedAt: record.updatedAt || new Date().toISOString()
  });
}

function stageCaRecordsIntoOutbox(cleanRecords: StudentAssessmentRecord[]) {
  if (cleanRecords.length === 0) return;
  const ids = cleanRecords.map(r => r.id);
  ids.forEach(id => {
    pendingCaRecordDeletes.delete(id);
    removeTombstone(DELETED_CA_RECORDS_KEY, id);
  });

  const dirtyStorage = readDirtyCaRecordsStorage();
  cleanRecords.forEach(rec => {
    pendingCaRecordSaves.set(rec.id, rec);
    dirtyStorage[rec.id] = rec;
  });
  writeDirtyCaRecordsStorage(dirtyStorage);

  const existingLocal = readLocalCaRecords();
  writeLocalCaRecordsMerged([...existingLocal, ...cleanRecords]);
}

function clearConfirmedDirtyCaRecords(committedRecords: StudentAssessmentRecord[]) {
  if (committedRecords.length === 0) return;
  const dirtyStorage = readDirtyCaRecordsStorage();
  let changed = false;

  committedRecords.forEach(rec => {
    const curr = pendingCaRecordSaves.get(rec.id);
    if (curr && curr.updatedAt === rec.updatedAt) {
      pendingCaRecordSaves.delete(rec.id);
    }
    if (dirtyStorage[rec.id] && dirtyStorage[rec.id].updatedAt === rec.updatedAt) {
      delete dirtyStorage[rec.id];
      changed = true;
    }
  });

  if (changed) {
    writeDirtyCaRecordsStorage(dirtyStorage);
  }
}

/**
 * Synchronously persists edited CA rows to localStorage & the durable dirty-outbox
 * so an immediate page refresh or browser close never loses typed scores.
 */
export function stageCaRecordsLocalDraft(records: StudentAssessmentRecord[]): void {
  if (!records || records.length === 0) return;
  const cleanRecords = records.map(r =>
    normalizeCleanCaRecord({
      ...r,
      updatedAt: r.updatedAt || new Date().toISOString()
    })
  );
  stageCaRecordsIntoOutbox(cleanRecords);
  broadcastEntitySync('caRecordsUpdated', 'CA_RECORDS_UPDATED', {
    stagedCount: cleanRecords.length
  });
}

export function getDirtyCaRecordsCount(): number {
  return pendingCaRecordSaves.size;
}

function deduplicateCaRecordsByEntity(records: StudentAssessmentRecord[]): StudentAssessmentRecord[] {
  const byLogicalKey = new Map<string, StudentAssessmentRecord>();
  records.forEach(rec => {
    if (!rec) return;
    const stuKey = (rec.studentId || rec.admissionNumber || rec.id || '').trim().toUpperCase();
    const subjKey = normalizeCaSubjectKey(rec.subjectName || rec.subjectId);
    const sessKey = normalizeSessionCode(rec.academicSession);
    const termKey = normalizeTermCode(rec.term);
    const logicalKey = stuKey && subjKey ? `${stuKey}::${subjKey}::${sessKey}::${termKey}` : rec.id;
    const prev = byLogicalKey.get(logicalKey);
    if (!prev) {
      byLogicalKey.set(logicalKey, rec);
      return;
    }
    byLogicalKey.set(logicalKey, pickNewerRecord(prev, rec));
  });
  return Array.from(byLogicalKey.values());
}

function isRetryableNetworkError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('could not reach') ||
    msg.includes('deadline-exceeded') ||
    msg.includes('timed out')
  );
}

async function commitCaRecordsBatchToFirestore(
  cleanRecords: StudentAssessmentRecord[],
  timeoutMs = 20000
): Promise<boolean> {
  if (cleanRecords.length === 0) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const commitWork = async () => {
    const CHUNK_SIZE = 350;
    for (let i = 0; i < cleanRecords.length; i += CHUNK_SIZE) {
      const chunk = cleanRecords.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(rec => {
        batch.set(doc(db, 'caRecords', rec.id), rec, { merge: true });
      });
      await batch.commit();
    }
    await clearCloudDeletionsBatch(
      'deletedCaRecordIds',
      cleanRecords.map(r => r.id)
    );
  };

  let timedOut = false;
  try {
    await Promise.race([
      commitWork(),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          timedOut = true;
          reject(new Error('Firestore commit timed out'));
        }, timeoutMs)
      )
    ]);
    clearConfirmedDirtyCaRecords(cleanRecords);
    return true;
  } catch (error) {
    if (timedOut || isRetryableNetworkError(error)) {
      console.warn('CA records queued in durable outbox awaiting cloud reconnection:', error);
      return false;
    }
    handleFirestoreError(error, OperationType.WRITE, 'caRecords');
  }
}

let activeCaFlushPromise: Promise<{ flushed: number; remaining: number; syncedToCloud: boolean }> | null = null;

export async function flushDirtyCaRecords(): Promise<{
  flushed: number;
  remaining: number;
  syncedToCloud: boolean;
}> {
  if (pendingCaRecordSaves.size === 0) {
    return { flushed: 0, remaining: 0, syncedToCloud: true };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { flushed: 0, remaining: pendingCaRecordSaves.size, syncedToCloud: false };
  }
  if (activeCaFlushPromise) {
    return activeCaFlushPromise;
  }

  activeCaFlushPromise = (async () => {
    const snapshotList = Array.from(pendingCaRecordSaves.values());
    if (snapshotList.length === 0) {
      return { flushed: 0, remaining: 0, syncedToCloud: true };
    }
    try {
      const synced = await commitCaRecordsBatchToFirestore(snapshotList, 20000);
      return {
        flushed: synced ? snapshotList.length : 0,
        remaining: pendingCaRecordSaves.size,
        syncedToCloud: synced
      };
    } finally {
      activeCaFlushPromise = null;
    }
  })();

  return activeCaFlushPromise;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (pendingCaRecordSaves.size > 0) {
      flushDirtyCaRecords()
        .then(res => {
          if (res.flushed > 0) {
            broadcastEntitySync('caRecordsUpdated', 'CA_RECORDS_UPDATED', { flushed: res.flushed });
          }
        })
        .catch(() => {});
    }
    if (pendingTermReportSaves.size > 0) {
      flushDirtyTermReports()
        .then(res => {
          if (res.flushed > 0) {
            broadcastEntitySync('termReportsUpdated', 'TERM_REPORT_UPDATED', { flushed: res.flushed });
          }
        })
        .catch(() => {});
    }
  });
}

// Continuous Assessment / Master Gradebook Records
export async function fetchAssessmentRecords(
  subjectId?: string,
  classGrade?: string,
  academicSession?: string,
  term?: string,
  subjectName?: string
): Promise<StudentAssessmentRecord[]> {
  const path = 'caRecords';
  if (pendingCaRecordSaves.size > 0 && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    // Replay any queued local edits before reading so server and local converge immediately
    await flushDirtyCaRecords().catch(() => null);
  }
  await fetchCloudSyncState(true).catch(() => null);

  const deleted = getTombstoneSet(DELETED_CA_RECORDS_KEY);
  const mergedMap: Record<string, StudentAssessmentRecord> = {};

  const normClass = normalizeClassCode(classGrade);
  const normTerm = normalizeTermCode(term);
  const normSession = normalizeSessionCode(academicSession);
  const resolvedSubjName = subjectName || resolveSubjectNameFromLocal(subjectId);
  const normSubjKey = normalizeCaSubjectKey(resolvedSubjName);

  const matchesFilters = (r: StudentAssessmentRecord) => {
    if (r.id && (deleted.has(r.id) || pendingCaRecordDeletes.has(r.id))) return false;
    if (subjectId) {
      const idMatches = r.subjectId === subjectId;
      const nameMatches = Boolean(normSubjKey && normalizeCaSubjectKey(r.subjectName) === normSubjKey);
      if (!idMatches && !nameMatches) return false;
    } else if (normSubjKey) {
      if (normalizeCaSubjectKey(r.subjectName) !== normSubjKey) return false;
    }
    if (normClass && normalizeClassCode(r.classGrade) !== normClass) return false;
    if (normSession && normalizeSessionCode(r.academicSession) !== normSession) return false;
    if (normTerm && normalizeTermCode(r.term) !== normTerm) return false;
    return true;
  };

  const allLocal = readLocalCaRecords();

  try {
    // When resolvedSubjName is known, read caRecords collection so legacy/alternate subjectIds for the same subject name are recovered
    const q = subjectId && !normSubjKey
      ? query(collection(db, path), where('subjectId', '==', subjectId))
      : collection(db, path);
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const snapshot = isOnline
      ? await getDocsFromServer(q).catch(() => getDocs(q))
      : await getDocs(q);
    const isAuthoritative = !snapshot.metadata.fromCache;

    if (!isAuthoritative) {
      allLocal.forEach(r => {
        if (matchesFilters(r)) {
          mergedMap[r.id] = pickNewerRecord(mergedMap[r.id], r);
        }
      });
    }

    snapshot.forEach(docSnap => {
      if (deleted.has(docSnap.id) || pendingCaRecordDeletes.has(docSnap.id)) return;
      const rec = { id: docSnap.id, ...docSnap.data() } as StudentAssessmentRecord;
      if (matchesFilters(rec)) {
        mergedMap[rec.id] = pickNewerRecord(mergedMap[rec.id], rec);
      }
    });

    // Always merge durable dirty-outbox records on top so unsynced scores survive refreshes
    pendingCaRecordSaves.forEach((pRec, id) => {
      if (!deleted.has(id) && !pendingCaRecordDeletes.has(id) && matchesFilters(pRec)) {
        mergedMap[id] = pickNewerRecord(mergedMap[id], pRec);
      }
    });

    if (isAuthoritative) {
      const preserved = allLocal.filter(r => !matchesFilters(r));
      writeLocalCaRecordsMerged([...preserved, ...Object.values(mergedMap)]);
    }
  } catch (error) {
    console.warn('Fallback fetching CA records from local cache:', error);
    allLocal.forEach(r => {
      if (matchesFilters(r)) {
        mergedMap[r.id] = pickNewerRecord(mergedMap[r.id], r);
      }
    });
    pendingCaRecordSaves.forEach((pRec, id) => {
      if (!deleted.has(id) && !pendingCaRecordDeletes.has(id) && matchesFilters(pRec)) {
        mergedMap[id] = pickNewerRecord(mergedMap[id], pRec);
      }
    });
  }

  return deduplicateCaRecordsByEntity(Object.values(mergedMap));
}

export async function saveAssessmentRecord(
  record: StudentAssessmentRecord
): Promise<{ savedCount: number; syncedToCloud: boolean }> {
  return saveAssessmentBatch([record]);
}

export async function saveAssessmentBatch(
  records: StudentAssessmentRecord[]
): Promise<{ savedCount: number; syncedToCloud: boolean }> {
  if (!records || records.length === 0) {
    return { savedCount: 0, syncedToCloud: true };
  }

  const now = new Date().toISOString();
  const cleanRecords = records.map(rec =>
    normalizeCleanCaRecord({
      ...rec,
      updatedAt: now
    })
  );

  // Persist locally & into durable dirty outbox immediately BEFORE cloud commit
  stageCaRecordsIntoOutbox(cleanRecords);

  broadcastEntitySync('caRecordsUpdated', 'CA_RECORDS_UPDATED', {
    recordIds: cleanRecords.map(r => r.id),
    count: cleanRecords.length
  });

  const syncedToCloud = await commitCaRecordsBatchToFirestore(cleanRecords);
  return { savedCount: cleanRecords.length, syncedToCloud };
}

export async function deleteAssessmentRecord(recordId: string): Promise<void> {
  const cleanId = recordId.replace(/[^a-zA-Z0-9_-]/g, '_');
  pendingCaRecordSaves.delete(cleanId);
  const dirtyStorage = readDirtyCaRecordsStorage();
  if (dirtyStorage[cleanId]) {
    delete dirtyStorage[cleanId];
    writeDirtyCaRecordsStorage(dirtyStorage);
  }
  pendingCaRecordDeletes.add(cleanId);
  addTombstone(DELETED_CA_RECORDS_KEY, cleanId);

  try {
    pruneLocalStorageListByIds(SAVED_CA_RECORDS_KEY, [cleanId]);
  } catch {}

  broadcastEntitySync('caRecordsUpdated', 'CA_RECORDS_UPDATED', { id: cleanId, recordId: cleanId, deleted: true });

  const delPromise = Promise.all([
    deleteDoc(doc(db, 'caRecords', cleanId)),
    recordCloudDeletion('deletedCaRecordIds', [cleanId])
  ]).finally(() => {
    pendingCaRecordDeletes.delete(cleanId);
  });

  await commitFirestoreFast(delPromise, OperationType.DELETE, `caRecords/${cleanId}`);
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  const path = `submissions/${submissionId}`;
  pendingSubmissionSaves.delete(submissionId);
  pendingSubmissionDeletes.add(submissionId);
  addTombstone(DELETED_SUBMISSIONS_KEY, submissionId);

  try {
    pruneLocalStorageListByIds('prime_cbt_submissions', [submissionId]);
  } catch {}

  broadcastExamSync('SUBMISSIONS_UPDATED', { submissionId, deleted: true });

  const delPromise = Promise.all([
    deleteDoc(doc(db, 'submissions', submissionId)),
    recordCloudDeletion('deletedSubmissionIds', [submissionId])
  ]).finally(() => {
    pendingSubmissionDeletes.delete(submissionId);
  });

  await commitFirestoreFast(delPromise, OperationType.DELETE, path);
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
  let hasServerSnapshot = false;
  let hasAnyRemote = false;

  if (pendingCaRecordSaves.size > 0 && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    flushDirtyCaRecords().catch(() => {});
  }

  const normAdm = (admissionNumber || '').trim().toUpperCase();
  const isStudentMatch = (r: Partial<StudentAssessmentRecord>) => {
    if (studentId && r.studentId === studentId) return true;
    const rAdm = (r.admissionNumber || '').trim().toUpperCase();
    return Boolean(normAdm && rAdm && rAdm === normAdm);
  };

  const mergeAndEmit = () => {
    const deleted = getTombstoneSet(DELETED_CA_RECORDS_KEY);
    const mergedMap: Record<string, StudentAssessmentRecord> = {};

    const allLocal = readLocalCaRecords();

    if (!hasServerSnapshot) {
      allLocal.forEach(lr => {
        if (isStudentMatch(lr)) {
          mergedMap[lr.id] = pickNewerRecord(mergedMap[lr.id], lr);
        }
      });
    }

    if (hasAnyRemote) {
      firestoreRecords.forEach(r => {
        if (!deleted.has(r.id) && !pendingCaRecordDeletes.has(r.id) && isStudentMatch(r)) {
          mergedMap[r.id] = pickNewerRecord(mergedMap[r.id], r);
        }
      });
    }

    // Always merge durable dirty-outbox records on top
    pendingCaRecordSaves.forEach((pr, id) => {
      if (!deleted.has(id) && !pendingCaRecordDeletes.has(id) && isStudentMatch(pr)) {
        mergedMap[id] = pickNewerRecord(mergedMap[id], pr);
      }
    });

    const result = deduplicateCaRecordsByEntity(Object.values(mergedMap));
    if (hasServerSnapshot) {
      const others = allLocal.filter(r => !isStudentMatch(r));
      writeLocalCaRecordsMerged([...others, ...result]);
    }
    callback(result);
  };

  mergeAndEmit();
  const releaseSyncState = retainSyncStateListener();

  try {
    const q = collection(db, path);
    unsubFirestore = onSnapshot(
      q,
      { includeMetadataChanges: true },
      snapshot => {
        hasAnyRemote = true;
        if (!snapshot.metadata.fromCache) {
          hasServerSnapshot = true;
        }
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
    releaseSyncState();
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
  if (pendingCaRecordSaves.size > 0 && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    await flushDirtyCaRecords().catch(() => null);
  }
  await fetchCloudSyncState(true).catch(() => null);
  const deleted = getTombstoneSet(DELETED_CA_RECORDS_KEY);
  const normAdm = (admissionNumber || '').trim().toUpperCase();

  const isStudentMatch = (r: Partial<StudentAssessmentRecord>) =>
    (studentId && r.studentId === studentId) ||
    Boolean(normAdm && r.admissionNumber && r.admissionNumber.toUpperCase() === normAdm);

  const allLocal = readLocalCaRecords();
  const mergedMap: Record<string, StudentAssessmentRecord> = {};

  try {
    const q = collection(db, path);
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const snapshot = isOnline
      ? await getDocsFromServer(q).catch(() => getDocs(q))
      : await getDocs(q);
    const isAuthoritative = !snapshot.metadata.fromCache;

    if (!isAuthoritative) {
      allLocal.forEach(lr => {
        if (isStudentMatch(lr)) mergedMap[lr.id] = pickNewerRecord(mergedMap[lr.id], lr);
      });
    }

    snapshot.forEach(docSnap => {
      if (deleted.has(docSnap.id) || pendingCaRecordDeletes.has(docSnap.id)) return;
      const data = docSnap.data() as StudentAssessmentRecord;
      if (isStudentMatch(data)) {
        const rec = { ...data, id: docSnap.id };
        mergedMap[rec.id] = pickNewerRecord(mergedMap[rec.id], rec);
      }
    });

    pendingCaRecordSaves.forEach((pr, id) => {
      if (!deleted.has(id) && !pendingCaRecordDeletes.has(id) && isStudentMatch(pr)) {
        mergedMap[id] = pickNewerRecord(mergedMap[id], pr);
      }
    });

    const result = deduplicateCaRecordsByEntity(Object.values(mergedMap));
    if (isAuthoritative) {
      const others = allLocal.filter(r => !isStudentMatch(r));
      writeLocalCaRecordsMerged([...others, ...result]);
    }
    return result;
  } catch (err) {
    console.warn('Fallback fetching cumulative student records:', err);
    allLocal.forEach(lr => {
      if (isStudentMatch(lr)) mergedMap[lr.id] = pickNewerRecord(mergedMap[lr.id], lr);
    });
    pendingCaRecordSaves.forEach((pr, id) => {
      if (!deleted.has(id) && !pendingCaRecordDeletes.has(id) && isStudentMatch(pr)) {
        mergedMap[id] = pickNewerRecord(mergedMap[id], pr);
      }
    });
    return deduplicateCaRecordsByEntity(Object.values(mergedMap));
  }
}

// Update student profile (passport, email, password, etc.)
export async function updateStudentProfile(
  studentId: string,
  updates: Partial<Student>
): Promise<Student> {
  const path = `students/${studentId}`;
  pendingStudentDeletes.delete(studentId);
  removeTombstone(DELETED_STUDENTS_KEY, studentId);

  const cleanUpdates = sanitizeFirestoreData<Partial<Student>>({
    ...updates,
    updatedAt: new Date().toISOString()
  });

  let mergedStudent: Student = { id: studentId, ...cleanUpdates } as Student;
  try {
    const list = readLocalStudentsList();
    const idx = list.findIndex(
      s => s.id === studentId || (cleanUpdates.admissionNumber && s.admissionNumber === cleanUpdates.admissionNumber)
    );
    if (idx >= 0) {
      mergedStudent = { ...list[idx], ...cleanUpdates, id: studentId };
      list[idx] = mergedStudent;
    } else {
      list.push(mergedStudent);
    }
    writeLocalStudentsList(list);
  } catch {}

  try {
    const activeRaw = sessionStorage.getItem('prime_edutech_active_student');
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw) as Student;
      if (parsed.id === studentId) {
        mergedStudent = { ...parsed, ...mergedStudent };
        sessionStorage.setItem('prime_edutech_active_student', JSON.stringify(mergedStudent));
      }
    }
  } catch {}

  pendingStudentSaves.set(studentId, mergedStudent);
  broadcastEntitySync('studentsUpdated', 'STUDENTS_UPDATED', { student: mergedStudent, studentId });

  const writePromise = setDoc(doc(db, 'students', studentId), cleanUpdates, { merge: true }).then(() => {
    const curr = pendingStudentSaves.get(studentId);
    if (curr && curr.updatedAt === mergedStudent.updatedAt) {
      pendingStudentSaves.delete(studentId);
    }
  });

  await commitFirestoreFast(writePromise, OperationType.WRITE, path);
  return mergedStudent;
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

  const deleted = getTombstoneSet(DELETED_STUDENTS_KEY);
  const fallback = readLocalStudentsList().find(
    s => !deleted.has(s.id) &&
         ((s.accessCode && s.accessCode.toUpperCase() === cleanId.toUpperCase()) ||
          s.admissionNumber.toUpperCase() === cleanId.toUpperCase())
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
 * Class-wide assessment fetch across ALL subjects for Master Broadsheet ranking & class averages
 */
export async function fetchClassAllAssessmentRecords(
  classGrade: string,
  academicSession: string,
  term: string
): Promise<StudentAssessmentRecord[]> {
  return fetchAssessmentRecords(undefined, classGrade, academicSession, term);
}

/**
 * Durable Outbox & Batch Persistence for Terminal Student Report Cards (Psychomotor, Skills, Remarks, Ranking)
 */
const DIRTY_TERM_REPORTS_KEY = 'prime_term_reports_dirty';
const pendingTermReportSaves = new Map<string, StudentTermReportData>();

function readDirtyTermReportsStorage(): Record<string, StudentTermReportData> {
  try {
    const raw = localStorage.getItem(DIRTY_TERM_REPORTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDirtyTermReportsStorage(mapObj: Record<string, StudentTermReportData>): void {
  try {
    if (Object.keys(mapObj).length === 0) {
      localStorage.removeItem(DIRTY_TERM_REPORTS_KEY);
    } else {
      localStorage.setItem(DIRTY_TERM_REPORTS_KEY, JSON.stringify(mapObj));
    }
  } catch {}
}

(function hydrateTermReportOutbox() {
  const stored = readDirtyTermReportsStorage();
  Object.entries(stored).forEach(([id, rep]) => {
    if (rep && id) pendingTermReportSaves.set(id, rep);
  });
})();

function stageTermReportsIntoOutbox(reports: StudentTermReportData[]): void {
  const dirty = readDirtyTermReportsStorage();
  reports.forEach(r => {
    pendingTermReportSaves.set(r.id, r);
    dirty[r.id] = r;
    try {
      localStorage.setItem(`prime_term_report_${r.id}`, JSON.stringify(r));
    } catch {}
  });
  writeDirtyTermReportsStorage(dirty);

  try {
    const allKey = 'prime_term_reports_all';
    const existing = localStorage.getItem(allKey);
    const list: StudentTermReportData[] = existing ? JSON.parse(existing) : [];
    const byId = new Map<string, StudentTermReportData>();
    if (Array.isArray(list)) list.forEach(item => byId.set(item.id, item));
    reports.forEach(r => byId.set(r.id, r));
    localStorage.setItem(allKey, JSON.stringify(Array.from(byId.values())));
  } catch {}
}

function clearConfirmedDirtyTermReports(reports: StudentTermReportData[]): void {
  const dirty = readDirtyTermReportsStorage();
  reports.forEach(r => {
    const inMem = pendingTermReportSaves.get(r.id);
    if (!inMem || inMem.updatedAt === r.updatedAt) {
      pendingTermReportSaves.delete(r.id);
    }
    const stored = dirty[r.id];
    if (!stored || stored.updatedAt === r.updatedAt) {
      delete dirty[r.id];
    }
  });
  writeDirtyTermReportsStorage(dirty);
}

async function commitTermReportsBatchToFirestore(
  cleanReports: StudentTermReportData[],
  timeoutMs = 20000
): Promise<boolean> {
  if (cleanReports.length === 0) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const commitWork = async () => {
    const CHUNK_SIZE = 350;
    for (let i = 0; i < cleanReports.length; i += CHUNK_SIZE) {
      const chunk = cleanReports.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(rep => {
        batch.set(doc(db, 'termReports', rep.id), rep, { merge: true });
      });
      await batch.commit();
    }
  };

  let timedOut = false;
  try {
    await Promise.race([
      commitWork(),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          timedOut = true;
          reject(new Error('Firestore termReports batch timed out'));
        }, timeoutMs)
      )
    ]);
    clearConfirmedDirtyTermReports(cleanReports);
    return true;
  } catch (err) {
    if (timedOut || isRetryableNetworkError(err)) {
      console.warn('Term reports queued in durable outbox awaiting reconnection:', err);
      return false;
    }
    throw err;
  }
}

export async function flushDirtyTermReports(): Promise<{
  flushed: number;
  remaining: number;
  syncedToCloud: boolean;
}> {
  if (pendingTermReportSaves.size === 0) {
    return { flushed: 0, remaining: 0, syncedToCloud: true };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { flushed: 0, remaining: pendingTermReportSaves.size, syncedToCloud: false };
  }
  const snapshot = Array.from(pendingTermReportSaves.values());
  const synced = await commitTermReportsBatchToFirestore(snapshot, 20000).catch(() => false);
  return {
    flushed: synced ? snapshot.length : 0,
    remaining: pendingTermReportSaves.size,
    syncedToCloud: synced
  };
}

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

  const dirtyDraft = pendingTermReportSaves.get(reportDocId);

  try {
    const docRef = doc(db, 'termReports', reportDocId);
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const snap = isOnline
      ? await getDocFromServer(docRef).catch(() => getDoc(docRef))
      : await getDoc(docRef);
    if (snap.exists()) {
      const serverData = { id: snap.id, ...snap.data() } as StudentTermReportData;
      if (
        dirtyDraft &&
        new Date(dirtyDraft.updatedAt || 0).getTime() > new Date(serverData.updatedAt || 0).getTime()
      ) {
        return dirtyDraft;
      }
      try {
        localStorage.setItem(`prime_term_report_${reportDocId}`, JSON.stringify(serverData));
      } catch {}
      return serverData;
    }
  } catch (err) {
    console.warn('Firestore fetch warning for termReport, checking local cache:', err);
  }

  if (dirtyDraft) return dirtyDraft;

  try {
    const local = localStorage.getItem(`prime_term_report_${reportDocId}`);
    if (local) {
      return JSON.parse(local) as StudentTermReportData;
    }
  } catch {}

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
    overallPosition: '',
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

export async function saveTermReportsBatch(
  reports: StudentTermReportData[]
): Promise<{ savedCount: number; syncedToCloud: boolean }> {
  if (!reports || reports.length === 0) {
    return { savedCount: 0, syncedToCloud: true };
  }
  const now = new Date().toISOString();
  const cleanReports = reports.map(rep => {
    const cleanId = (rep.id || `report_${rep.studentId}_${rep.academicSession}_${rep.term}`)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    return sanitizeFirestoreData<StudentTermReportData>({
      ...rep,
      id: cleanId,
      updatedAt: now
    });
  });

  stageTermReportsIntoOutbox(cleanReports);
  broadcastEntitySync('termReportsUpdated', 'TERM_REPORT_UPDATED', {
    count: cleanReports.length,
    reportIds: cleanReports.map(r => r.id)
  });

  const syncedToCloud = await commitTermReportsBatchToFirestore(cleanReports, 20000);
  return { savedCount: cleanReports.length, syncedToCloud };
}

export async function saveStudentTermReport(report: StudentTermReportData): Promise<void> {
  await saveTermReportsBatch([report]);
}

export async function fetchClassTermReports(
  classGrade: string,
  academicSession: string,
  term: string
): Promise<StudentTermReportData[]> {
  const mergedMap: Record<string, StudentTermReportData> = {};
  const allKey = 'prime_term_reports_all';

  let allLocal: StudentTermReportData[] = [];
  try {
    const existing = localStorage.getItem(allKey);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed)) allLocal = parsed;
    }
  } catch {}

  try {
    const q = query(collection(db, 'termReports'), where('classGrade', '==', classGrade));
    const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
    const snap = isOnline
      ? await getDocsFromServer(q).catch(() => getDocs(q))
      : await getDocs(q);
    const isAuthoritative = !snap.metadata.fromCache;

    if (!isAuthoritative) {
      allLocal.forEach(r => {
        if (r.classGrade === classGrade && r.academicSession === academicSession && r.term === term) {
          mergedMap[r.id] = r;
        }
      });
    }

    snap.forEach(d => {
      const r = { id: d.id, ...d.data() } as StudentTermReportData;
      if (r.academicSession === academicSession && r.term === term) {
        mergedMap[r.id] = r;
      }
    });

    pendingTermReportSaves.forEach(pr => {
      if (pr.classGrade === classGrade && pr.academicSession === academicSession && pr.term === term) {
        const prev = mergedMap[pr.id];
        if (!prev || new Date(pr.updatedAt || 0).getTime() >= new Date(prev.updatedAt || 0).getTime()) {
          mergedMap[pr.id] = pr;
        }
      }
    });

    if (isAuthoritative) {
      const others = allLocal.filter(
        r => !(r.classGrade === classGrade && r.academicSession === academicSession && r.term === term)
      );
      try {
        localStorage.setItem(allKey, JSON.stringify([...others, ...Object.values(mergedMap)]));
      } catch {}
    }
  } catch (err) {
    console.warn('Firestore fetchClassTermReports fallback to local:', err);
    allLocal.forEach(r => {
      if (r.classGrade === classGrade && r.academicSession === academicSession && r.term === term) {
        mergedMap[r.id] = r;
      }
    });
    pendingTermReportSaves.forEach(pr => {
      if (pr.classGrade === classGrade && pr.academicSession === academicSession && pr.term === term) {
        mergedMap[pr.id] = pr;
      }
    });
  }

  return Object.values(mergedMap);
}

