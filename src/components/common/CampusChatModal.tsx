import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Users,
  Send,
  Paperclip,
  Image as ImageIcon,
  Mic,
  X,
  FileText,
  ShieldCheck,
  CheckCheck,
  Search,
  Volume2,
  ArrowLeft,
  Reply,
  Trash2,
  Download,
  Smile,
  StopCircle,
  Eye,
  AlertCircle
} from 'lucide-react';
import {
  ChatMessage,
  Student,
  StaffMember,
  SchoolClass
} from '../../types/cbt';
import {
  subscribeChatMessages,
  subscribeAllChatMessages,
  sendChatMessage,
  deleteChatMessage,
  fetchStaffMembers,
  fetchStudents,
  fetchSchoolClasses
} from '../../services/firebase';
import { DEFAULT_SCHOOL_CLASSES } from '../../data/initialSchoolData';

interface CampusChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    name: string;
    role: 'super_admin' | 'admin' | 'teacher' | 'student';
    classGrade?: string;
  };
  availableStaff?: StaffMember[];
  availableStudents?: Student[];
}

interface ChatChannelItem {
  id: string;
  name: string;
  subtitle: string;
  kind: 'group' | 'teacher' | 'student' | 'audit_dm';
  channelType: ChatMessage['channelType'];
  targetId?: string;
  targetName?: string;
  lastTimestamp?: number;
  lastPreview?: string;
  lastSender?: string;
  unreadCount: number;
}

const MAX_BINARY_BYTES = 700 * 1024; // ~700KB raw binary fits comfortably inside Firestore 1MB limit

const normalizeClassId = (cls?: string) =>
  `class-${(cls || 'SS 2').toLowerCase().replace(/\s+/g, '')}`;

const canonicalDmId = (idA: string, idB: string) =>
  `dm_${[idA.trim(), idB.trim()].sort().join('__')}`;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatTimeShort = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatListTimestamp = (ts?: number) => {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
};

const formatDateDivider = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return 'TODAY';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return 'YESTERDAY';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
};

const SENDER_COLORS = [
  'text-emerald-700',
  'text-sky-700',
  'text-amber-700',
  'text-purple-700',
  'text-rose-700',
  'text-teal-700',
  'text-indigo-700'
];

const getSenderColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

const compressImageFile = (file: File): Promise<{ url: string; sizeLabel: string }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 1000;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      const approxBytes = Math.round((dataUrl.length * 3) / 4);
      resolve({ url: dataUrl, sizeLabel: formatBytes(approxBytes) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Invalid image file'));
    };
    img.src = objectUrl;
  });

const QUICK_EMOJIS = ['👍', '👏', '✅', '📚', '📝', '❓', '💡', '🙏', '😊', '🎉', '🔥', '👋'];

export const CampusChatModal: React.FC<CampusChatModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  availableStaff = [],
  availableStudents = []
}) => {
  const isStaffOrAdmin =
    currentUser.role === 'teacher' ||
    currentUser.role === 'admin' ||
    currentUser.role === 'super_admin';
  const isSuperAdmin = currentUser.role === 'super_admin';

  const defaultChannelId = isStaffOrAdmin
    ? 'staff-general'
    : normalizeClassId(currentUser.classGrade);

  const [activeChannelId, setActiveChannelId] = useState<string>(defaultChannelId);
  const [showMobileChat, setShowMobileChat] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<'all' | 'groups' | 'teachers' | 'students' | 'monitor'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Roster & classes directory (self-hydrating + prop merge)
  const [staffDirectory, setStaffDirectory] = useState<StaffMember[]>(availableStaff);
  const [studentDirectory, setStudentDirectory] = useState<Student[]>(availableStudents);
  const [classesDirectory, setClassesDirectory] = useState<SchoolClass[]>(DEFAULT_SCHOOL_CLASSES);

  // Live messages state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [lastReadMap, setLastReadMap] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(`prime_cbt_chat_lastread_${currentUser.id}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Composer & media states
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [chatNotice, setChatNotice] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<{
    url: string;
    type: 'image' | 'audio' | 'document';
    name: string;
    sizeLabel?: string;
    voiceDurationSeconds?: number;
  } | null>(null);

  // Live microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef<number>(0);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load safe directory lists on open so teachers, students, and classes always appear
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;

    Promise.all([
      fetchStaffMembers().catch(() => [] as StaffMember[]),
      fetchStudents().catch(() => [] as Student[]),
      fetchSchoolClasses().catch(() => DEFAULT_SCHOOL_CLASSES)
    ]).then(([remoteStaff, remoteStudents, remoteClasses]) => {
      if (!mounted) return;

      // Merge & deduplicate staff (strip private password/passcode in memory representation)
      const staffMap = new Map<string, StaffMember>();
      [...availableStaff, ...remoteStaff].forEach(st => {
        const key = (st.uniqueId || st.id || '').trim();
        if (!key || key === currentUser.id) return;
        staffMap.set(key, {
          ...st,
          password: ''
        });
      });
      setStaffDirectory(Array.from(staffMap.values()));

      // Merge & deduplicate students
      const stuMap = new Map<string, Student>();
      [...availableStudents, ...remoteStudents].forEach(stu => {
        const key = (stu.id || stu.admissionNumber || '').trim();
        if (!key || key === currentUser.id) return;
        stuMap.set(key, {
          ...stu,
          password: '',
          accessCode: ''
        });
      });
      setStudentDirectory(Array.from(stuMap.values()));

      if (remoteClasses && remoteClasses.length > 0) {
        setClassesDirectory(remoteClasses);
      }
    });

    return () => {
      mounted = false;
    };
  }, [isOpen, currentUser.id, availableStaff, availableStudents]);

  // Subscribe to ALL campus chats for live previews, unread badges, and Super Admin monitor
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeAllChatMessages((msgs) => {
      setAllMessages(msgs);
    });
    return () => unsub();
  }, [isOpen]);

  // Subscribe to currently selected conversation in real time
  useEffect(() => {
    if (!isOpen || !activeChannelId) return;
    const unsub = subscribeChatMessages(activeChannelId, (msgs) => {
      setMessages(msgs);
      // Update read timestamp for active channel
      setLastReadMap(prev => {
        const next = { ...prev, [activeChannelId]: Date.now() };
        try {
          localStorage.setItem(`prime_cbt_chat_lastread_${currentUser.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    });
    return () => unsub();
  }, [activeChannelId, isOpen, currentUser.id]);

  // Cleanup active recorder if modal closes or unmounts
  useEffect(() => {
    if (!isOpen && isRecording) {
      cancelVoiceRecording();
    }
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
    };
  }, [isOpen]);

  // Compute aggregated channel stats (last message, preview, unread count)
  const channelStats = useMemo(() => {
    const stats: Record<
      string,
      { lastMsg?: ChatMessage; lastTs: number; unread: number; channelName?: string }
    > = {};

    allMessages.forEach(msg => {
      const ts = new Date(msg.timestamp).getTime() || 0;
      const existing = stats[msg.channelId];
      if (!existing) {
        stats[msg.channelId] = {
          lastMsg: msg,
          lastTs: ts,
          unread: 0,
          channelName: msg.channelName
        };
      } else if (ts >= existing.lastTs) {
        existing.lastMsg = msg;
        existing.lastTs = ts;
        if (msg.channelName) existing.channelName = msg.channelName;
      }

      const lastRead = lastReadMap[msg.channelId] || 0;
      if (
        msg.channelId !== activeChannelId &&
        msg.senderId !== currentUser.id &&
        ts > lastRead &&
        !msg.deleted
      ) {
        stats[msg.channelId].unread += 1;
      }
    });

    return stats;
  }, [allMessages, lastReadMap, activeChannelId, currentUser.id]);

  const formatPreview = (msg?: ChatMessage) => {
    if (!msg) return '';
    if (msg.deleted) return '🚫 This message was deleted';
    if (msg.attachmentType === 'image') return msg.text ? `📷 ${msg.text}` : '📷 Photo';
    if (msg.attachmentType === 'audio') return msg.voiceDurationSeconds ? `🎤 Voice note (${formatDuration(msg.voiceDurationSeconds)})` : '🎵 Audio message';
    if (msg.attachmentType === 'document') return `📎 ${msg.attachmentName || 'Document'}`;
    return msg.text || '';
  };

  // Build unified sidebar channels list based on role
  const channels = useMemo<ChatChannelItem[]>(() => {
    const list: ChatChannelItem[] = [];
    const seenIds = new Set<string>();

    const attachStats = (item: Omit<ChatChannelItem, 'unreadCount' | 'lastTimestamp' | 'lastPreview' | 'lastSender'>): ChatChannelItem => {
      const st = channelStats[item.id];
      return {
        ...item,
        lastTimestamp: st?.lastTs,
        lastPreview: st?.lastMsg ? formatPreview(st.lastMsg) : undefined,
        lastSender: st?.lastMsg?.senderId === currentUser.id ? 'You' : st?.lastMsg?.senderName,
        unreadCount: st?.unread || 0
      };
    };

    // 1. Group Rooms
    if (isStaffOrAdmin) {
      seenIds.add('staff-general');
      list.push(
        attachStats({
          id: 'staff-general',
          name: 'Faculty Staff Room',
          subtitle: 'Teachers & Administration group chat',
          kind: 'group',
          channelType: 'staff_group'
        })
      );

      seenIds.add('campus-general');
      list.push(
        attachStats({
          id: 'campus-general',
          name: 'Campus General Forum',
          subtitle: 'School-wide faculty & student updates',
          kind: 'group',
          channelType: 'campus_group'
        })
      );

      classesDirectory.forEach(cls => {
        const cid = normalizeClassId(cls.code || cls.name);
        if (seenIds.has(cid)) return;
        seenIds.add(cid);
        list.push(
          attachStats({
            id: cid,
            name: `${cls.code || cls.name} Class Room`,
            subtitle: `${cls.name} students & subject teachers`,
            kind: 'group',
            channelType: 'student_class_group'
          })
        );
      });
    } else {
      // Student Groups: Own Class Room + All Students Forum
      const ownClassId = normalizeClassId(currentUser.classGrade);
      seenIds.add(ownClassId);
      list.push(
        attachStats({
          id: ownClassId,
          name: `${currentUser.classGrade || 'SS 2'} Class Room`,
          subtitle: 'Classmates & subject teachers group',
          kind: 'group',
          channelType: 'student_class_group'
        })
      );

      seenIds.add('campus-students');
      list.push(
        attachStats({
          id: 'campus-students',
          name: 'All Students Study Forum',
          subtitle: 'School-wide student study & peer group',
          kind: 'group',
          channelType: 'campus_group'
        })
      );
    }

    // 2. Faculty Teachers Direct Messages
    staffDirectory.forEach(st => {
      const targetId = st.uniqueId || st.id;
      if (!targetId || targetId === currentUser.id) return;
      const cid = canonicalDmId(currentUser.id, targetId);
      if (seenIds.has(cid)) return;
      seenIds.add(cid);
      list.push(
        attachStats({
          id: cid,
          name: st.fullName,
          subtitle: st.assignedSubjectNames?.length ? `Teacher · ${st.assignedSubjectNames.slice(0, 2).join(', ')}` : 'Faculty Teacher',
          kind: 'teacher',
          channelType: currentUser.role === 'student' ? 'student_to_teacher' : 'direct_teacher',
          targetId,
          targetName: st.fullName
        })
      );
    });

    // 3. Students Direct Messages (for both fellow Students and Teachers/Admins)
    const sortedStudents = [...studentDirectory].sort((a, b) => {
      if (currentUser.classGrade) {
        const aSame = a.classGrade === currentUser.classGrade ? 0 : 1;
        const bSame = b.classGrade === currentUser.classGrade ? 0 : 1;
        if (aSame !== bSame) return aSame - bSame;
      }
      return a.fullName.localeCompare(b.fullName);
    });

    sortedStudents.forEach(stu => {
      const targetId = stu.id || stu.admissionNumber;
      if (!targetId || targetId === currentUser.id) return;
      const cid = canonicalDmId(currentUser.id, targetId);
      if (seenIds.has(cid)) return;
      seenIds.add(cid);
      list.push(
        attachStats({
          id: cid,
          name: stu.fullName,
          subtitle: `Student · ${stu.classGrade} (${stu.admissionNumber})`,
          kind: 'student',
          channelType: currentUser.role === 'student' ? 'direct_student' : 'student_to_teacher',
          targetId,
          targetName: stu.fullName
        })
      );
    });

    // 4. Super Admin Audit Threads (every other private DM or group room across the school)
    if (isSuperAdmin) {
      Object.entries(channelStats).forEach(([cid, st]) => {
        if (seenIds.has(cid)) return;
        seenIds.add(cid);
        list.push({
          id: cid,
          name: st.channelName || cid,
          subtitle: cid.startsWith('dm_') ? 'Private DM Audit (Super Admin)' : 'Campus Thread Audit',
          kind: 'audit_dm',
          channelType: st.lastMsg?.channelType || 'direct_student',
          lastTimestamp: st.lastTs,
          lastPreview: st.lastMsg ? formatPreview(st.lastMsg) : undefined,
          lastSender: st.lastMsg?.senderName,
          unreadCount: 0
        });
      });
    }

    // Sort: active conversations with recent messages bubble to top (groups stay easy to reach)
    return list.sort((a, b) => {
      const tsA = a.lastTimestamp || 0;
      const tsB = b.lastTimestamp || 0;
      if (tsA !== tsB) return tsB - tsA;
      if (a.kind === 'group' && b.kind !== 'group') return -1;
      if (b.kind === 'group' && a.kind !== 'group') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [channelStats, isStaffOrAdmin, isSuperAdmin, classesDirectory, staffDirectory, studentDirectory, currentUser]);

  const filteredChannels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return channels.filter(c => {
      if (sidebarTab === 'groups' && c.kind !== 'group') return false;
      if (sidebarTab === 'teachers' && c.kind !== 'teacher') return false;
      if (sidebarTab === 'students' && c.kind !== 'student') return false;
      if (sidebarTab === 'monitor' && c.kind !== 'audit_dm') return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q) ||
        (c.lastPreview || '').toLowerCase().includes(q)
      );
    });
  }, [channels, sidebarTab, searchQuery]);

  const activeChannel = useMemo(
    () => channels.find(c => c.id === activeChannelId) || channels[0],
    [channels, activeChannelId]
  );

  // Ensure activeChannelId exists when role is student
  useEffect(() => {
    if (!isStaffOrAdmin && activeChannelId === 'staff-general') {
      setActiveChannelId(normalizeClassId(currentUser.classGrade));
    }
  }, [isStaffOrAdmin, activeChannelId, currentUser.classGrade]);

  const showTempNotice = (text: string) => {
    setChatNotice(text);
    window.setTimeout(() => setChatNotice(null), 4000);
  };

  // File & Media Upload Handlers (Client-side image compression + size cap)
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setShowAttachMenu(false);
    if (!file) return;

    try {
      const { url, sizeLabel } = await compressImageFile(file);
      if (url.length > 900_000) {
        showTempNotice('Image is still too large after compression. Please select a smaller photo.');
        return;
      }
      setAttachmentPreview({
        url,
        type: 'image',
        name: file.name,
        sizeLabel
      });
    } catch {
      showTempNotice('Could not read selected image file.');
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>, type: 'document' | 'audio') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setShowAttachMenu(false);
    if (!file) return;

    if (file.size > MAX_BINARY_BYTES) {
      showTempNotice(`File too large (${formatBytes(file.size)}). Maximum allowed size is 700 KB for instant delivery.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentPreview({
        url: reader.result as string,
        type,
        name: file.name,
        sizeLabel: formatBytes(file.size)
      });
    };
    reader.onerror = () => showTempNotice('Failed to read file.');
    reader.readAsDataURL(file);
  };

  // Real-time Microphone Voice Note Recording
  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showTempNotice('Microphone recording is not supported in this browser. Use Attach Audio File instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      setIsRecording(true);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;

      recordingTimerRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
        if (recordingSecondsRef.current >= 90) {
          stopAndAttachVoiceNote(true);
        }
      }, 1000);
    } catch {
      showTempNotice('Microphone permission denied. Enable microphone access or upload an audio file.');
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
      };
      if (mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const stopAndAttachVoiceNote = (sendImmediately = false) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const finalDuration = Math.max(1, recordingSecondsRef.current);
    const stream = recorder.stream;

    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      setIsRecording(false);
      setRecordingSeconds(0);

      if (blob.size > MAX_BINARY_BYTES) {
        showTempNotice(`Voice note too large (${formatBytes(blob.size)}). Keep recordings under 60 seconds.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const audioUrl = reader.result as string;
        const name = `voice_note_${Date.now()}.webm`;
        const sizeLabel = formatBytes(blob.size);
        if (sendImmediately) {
          await dispatchMessage('', {
            url: audioUrl,
            type: 'audio',
            name,
            sizeLabel,
            voiceDurationSeconds: finalDuration
          });
        } else {
          setAttachmentPreview({
            url: audioUrl,
            type: 'audio',
            name,
            sizeLabel,
            voiceDurationSeconds: finalDuration
          });
        }
      };
      reader.readAsDataURL(blob);
    };

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const dispatchMessage = async (
    textToSend: string,
    attachmentOverride?: {
      url: string;
      type: 'image' | 'audio' | 'document';
      name: string;
      sizeLabel?: string;
      voiceDurationSeconds?: number;
    } | null
  ) => {
    const media = attachmentOverride !== undefined ? attachmentOverride : attachmentPreview;
    const cleanText = textToSend.trim();
    if (!cleanText && !media) return;

    const targetChannelName =
      activeChannel?.targetId && activeChannel?.targetName
        ? `${currentUser.name} ↔ ${activeChannel.targetName}`
        : activeChannel?.name || activeChannelId;

    const newMsg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      channelId: activeChannelId,
      channelName: targetChannelName,
      channelType: activeChannel?.channelType || 'campus_group',
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      recipientId: activeChannel?.targetId,
      recipientName: activeChannel?.targetName,
      text: cleanText,
      attachmentUrl: media?.url,
      attachmentType: media?.type,
      attachmentName: media?.name,
      attachmentSize: media?.sizeLabel,
      voiceDurationSeconds: media?.voiceDurationSeconds,
      replyToId: replyingTo?.id,
      replyToSender: replyingTo?.senderName,
      replyToText: replyingTo
        ? replyingTo.text || (replyingTo.attachmentType === 'image' ? '📷 Photo' : replyingTo.attachmentType === 'audio' ? '🎤 Voice note' : `📎 ${replyingTo.attachmentName || 'Attachment'}`)
        : undefined,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMsg]);
    if (attachmentOverride === undefined) {
      setInputText('');
      setAttachmentPreview(null);
    }
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 40);

    await sendChatMessage(newMsg);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatchMessage(inputText);
  };

  const handleDeleteMsg = async (msg: ChatMessage) => {
    if (msg.senderId !== currentUser.id && !isSuperAdmin) return;
    await deleteChatMessage(msg.id, msg.channelId);
  };

  if (!isOpen) return null;

  // Group visible messages by date divider
  let lastDateLabel = '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div className="bg-[#f0f2f5] sm:rounded-2xl max-w-6xl w-full h-full sm:h-[90vh] shadow-2xl border border-slate-300 flex overflow-hidden relative">
        {/* ============================================================
            LEFT PANE: WHATSAPP CHATS & DIRECTORY SIDEBAR
           ============================================================ */}
        <div
          className={`${
            showMobileChat ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex-col shrink-0`}
        >
          {/* WhatsApp Header */}
          <div className="px-4 py-3 bg-[#008069] text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-black text-sm shrink-0">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm truncate leading-tight">{currentUser.name}</div>
                <div className="text-[10px] text-emerald-100 uppercase tracking-wider font-semibold">
                  {currentUser.role.replace('_', ' ')} {currentUser.classGrade ? `· ${currentUser.classGrade}` : ''}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/15 text-white transition-colors cursor-pointer"
              title="Close Campus Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Input */}
          <div className="p-2.5 bg-white border-b border-slate-100 shrink-0 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or start new chat..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#f0f2f5] border border-transparent focus:border-[#008069] focus:bg-white rounded-lg focus:outline-hidden text-slate-800"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] font-semibold">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'groups', label: 'Groups' },
                  { id: 'teachers', label: 'Teachers' },
                  { id: 'students', label: 'Students' },
                  ...(isSuperAdmin ? [{ id: 'monitor', label: 'Audit Monitor' }] : [])
                ] as Array<{ id: typeof sidebarTab; label: string }>
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSidebarTab(tab.id)}
                  className={`px-2.5 py-1 rounded-full shrink-0 transition-colors cursor-pointer ${
                    sidebarTab === tab.id
                      ? 'bg-[#d9fdd3] text-[#008069] font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredChannels.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No matching chats or contacts found.
              </div>
            ) : (
              filteredChannels.map(item => {
                const isSelected = item.id === activeChannelId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveChannelId(item.id);
                      setShowMobileChat(true);
                      setReplyingTo(null);
                    }}
                    className={`w-full px-3.5 py-3 text-left flex items-center gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#f0f2f5]' : 'hover:bg-slate-50 bg-white'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                        item.kind === 'group'
                          ? 'bg-[#008069]/15 text-[#008069]'
                          : item.kind === 'teacher'
                          ? 'bg-amber-100 text-amber-800'
                          : item.kind === 'audit_dm'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {item.kind === 'group' ? (
                        <Users className="w-5 h-5" />
                      ) : item.kind === 'audit_dm' ? (
                        <Eye className="w-5 h-5" />
                      ) : (
                        item.name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {item.name}
                        </span>
                        {item.lastTimestamp ? (
                          <span
                            className={`text-[10px] shrink-0 ${
                              item.unreadCount > 0 ? 'text-[#25D366] font-bold' : 'text-slate-400'
                            }`}
                          >
                            {formatListTimestamp(item.lastTimestamp)}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-[11px] text-slate-500 truncate">
                          {item.lastPreview
                            ? `${item.lastSender ? `${item.lastSender}: ` : ''}${item.lastPreview}`
                            : item.subtitle}
                        </p>
                        {item.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#25D366] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                            {item.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3 py-2 bg-emerald-50 border-t border-emerald-200 text-[10px] text-emerald-950 flex items-center gap-1.5 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-[#008069] shrink-0" />
            <span>Encrypted school network · Monitored by Super Admin</span>
          </div>
        </div>

        {/* ============================================================
            RIGHT PANE: ACTIVE WHATSAPP CONVERSATION WINDOW
           ============================================================ */}
        <div
          className={`${
            showMobileChat ? 'flex' : 'hidden md:flex'
          } flex-1 flex-col bg-[#efeae2] overflow-hidden relative`}
        >
          {/* WhatsApp-style Doodle Wallpaper Overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "radial-gradient(#008069 1px, transparent 1px), radial-gradient(#075e54 1px, #efeae2 1px)",
              backgroundSize: '28px 28px',
              backgroundPosition: '0 0, 14px 14px'
            }}
          />

          {/* Top Conversation Bar */}
          <div className="relative z-10 px-3 sm:px-4 py-2.5 bg-[#f0f2f5] border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setShowMobileChat(false)}
                className="md:hidden p-1.5 rounded-full hover:bg-slate-200 text-slate-700 cursor-pointer"
                aria-label="Back to chats"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                  activeChannel?.kind === 'group'
                    ? 'bg-[#008069] text-white'
                    : activeChannel?.kind === 'teacher'
                    ? 'bg-amber-600 text-white'
                    : 'bg-sky-700 text-white'
                }`}
              >
                {activeChannel?.kind === 'group' ? (
                  <Users className="w-5 h-5" />
                ) : (
                  (activeChannel?.name || 'C').charAt(0).toUpperCase()
                )}
              </div>

              <div className="min-w-0">
                <h4 className="font-bold text-sm text-slate-900 truncate flex items-center gap-2">
                  <span>{activeChannel?.name || 'Campus Chat'}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  {activeChannel?.subtitle || 'Text, photos, voice notes & files'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="hidden md:flex p-1.5 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-200 cursor-pointer"
              title="Close Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Inline Error / Notice Toast */}
          {chatNotice && (
            <div className="relative z-20 mx-4 mt-2 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-xs">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {chatNotice}
              </span>
              <button type="button" onClick={() => setChatNotice(null)} className="text-rose-500 hover:text-rose-800 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div className="relative z-10 flex-1 px-3 sm:px-6 py-4 overflow-y-auto space-y-2">
            {messages.length === 0 ? (
              <div className="my-12 max-w-sm mx-auto bg-white/90 backdrop-blur-xs rounded-2xl p-6 text-center shadow-xs border border-slate-200/70 space-y-2">
                <MessageSquare className="w-9 h-9 mx-auto text-[#008069]" />
                <div className="font-bold text-xs text-slate-800">
                  Start messaging in {activeChannel?.name || 'this chat'}
                </div>
                <p className="text-[11px] text-slate-500">
                  Messages, photos, documents, and voice notes sync instantly in real time across devices.
                </p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.senderId === currentUser.id;
                const dateLabel = formatDateDivider(msg.timestamp);
                const showDateChip = dateLabel && dateLabel !== lastDateLabel;
                if (dateLabel) lastDateLabel = dateLabel;

                const isGroupChannel =
                  activeChannel?.kind === 'group' || activeChannel?.kind === 'audit_dm';

                return (
                  <React.Fragment key={msg.id}>
                    {showDateChip && (
                      <div className="flex justify-center my-2">
                        <span className="px-3 py-1 rounded-lg bg-white/90 text-slate-600 text-[10px] font-bold shadow-2xs border border-slate-200/60">
                          {dateLabel}
                        </span>
                      </div>
                    )}

                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                      <div
                        className={`relative max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-xl shadow-xs text-xs ${
                          isMe
                            ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-xs'
                            : 'bg-white text-slate-900 rounded-tl-xs'
                        }`}
                      >
                        {/* Sender Header inside Groups or Audit Threads */}
                        {(!isMe && isGroupChannel) && (
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`font-black text-[11px] ${getSenderColor(msg.senderName)}`}>
                              {msg.senderName}
                            </span>
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-bold">
                              {msg.senderRole.replace('_', ' ')}
                            </span>
                          </div>
                        )}

                        {/* Hover Actions: Reply & Delete */}
                        {!msg.deleted && (
                          <div
                            className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 absolute -top-3 ${
                              isMe ? 'left-1' : 'right-1'
                            } bg-white border border-slate-200 rounded-full px-1.5 py-0.5 shadow-sm z-10`}
                          >
                            <button
                              type="button"
                              onClick={() => setReplyingTo(msg)}
                              className="p-0.5 text-slate-500 hover:text-[#008069] cursor-pointer"
                              title="Reply"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>
                            {(isMe || isSuperAdmin) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMsg(msg)}
                                className="p-0.5 text-slate-500 hover:text-rose-600 cursor-pointer"
                                title="Delete message"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Quoted Reply Preview inside Bubble */}
                        {!msg.deleted && msg.replyToText && (
                          <div className="border-l-4 border-[#00a884] bg-black/5 rounded px-2 py-1 mb-1.5 text-[11px]">
                            <span className="font-bold text-[#008069] block truncate">
                              {msg.replyToSender || 'Message'}
                            </span>
                            <span className="text-slate-600 line-clamp-2">{msg.replyToText}</span>
                          </div>
                        )}

                        {/* Message Body */}
                        {msg.deleted ? (
                          <p className="italic text-slate-500 text-[11px] py-0.5">
                            🚫 This message was deleted
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {/* Image Attachment -> In-App Lightbox */}
                            {msg.attachmentUrl && msg.attachmentType === 'image' && (
                              <div className="rounded-lg overflow-hidden border border-black/10 bg-black/5 max-h-64">
                                <img
                                  src={msg.attachmentUrl}
                                  alt={msg.attachmentName || 'Shared photo'}
                                  className="w-full max-h-64 object-cover cursor-pointer hover:opacity-95"
                                  onClick={() =>
                                    setLightboxImage({
                                      url: msg.attachmentUrl!,
                                      name: msg.attachmentName || 'photo.jpg'
                                    })
                                  }
                                />
                              </div>
                            )}

                            {/* Audio / Voice Note */}
                            {msg.attachmentUrl && msg.attachmentType === 'audio' && (
                              <div className="flex items-center gap-2 bg-black/5 p-2 rounded-lg min-w-[210px] sm:min-w-[250px]">
                                <div className="w-8 h-8 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0">
                                  <Volume2 className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <audio controls src={msg.attachmentUrl} className="w-full h-8" />
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                                    <span>{msg.voiceDurationSeconds ? `Voice Note · ${formatDuration(msg.voiceDurationSeconds)}` : msg.attachmentName || 'Audio'}</span>
                                    {msg.attachmentSize && <span>{msg.attachmentSize}</span>}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Document / File Card */}
                            {msg.attachmentUrl && msg.attachmentType === 'document' && (
                              <a
                                href={msg.attachmentUrl}
                                download={msg.attachmentName || 'document'}
                                className="flex items-center justify-between gap-2.5 p-2.5 rounded-lg bg-black/5 hover:bg-black/10 transition-colors border border-black/10"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-[#008069] text-white flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 truncate max-w-[180px]">
                                      {msg.attachmentName || 'Attachment'}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {msg.attachmentSize || 'Document'} · Click to download
                                    </div>
                                  </div>
                                </div>
                                <Download className="w-4 h-4 text-[#008069] shrink-0" />
                              </a>
                            )}

                            {/* Text & Timestamp Row */}
                            <div className="flex items-end justify-between gap-3">
                              {msg.text ? (
                                <p className="whitespace-pre-wrap leading-relaxed text-[13px] break-words">
                                  {msg.text}
                                </p>
                              ) : (
                                <span />
                              )}
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 shrink-0 ml-auto pt-1">
                                <span>{formatTimeShort(msg.timestamp)}</span>
                                {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Replying-To Banner */}
          {replyingTo && (
            <div className="relative z-10 px-4 py-2 bg-[#f0f2f5] border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="flex-1 border-l-4 border-[#00a884] bg-white rounded-r-lg px-3 py-1.5 text-xs min-w-0">
                <span className="font-bold text-[#008069] block truncate">
                  Replying to {replyingTo.senderId === currentUser.id ? 'Yourself' : replyingTo.senderName}
                </span>
                <span className="text-slate-600 truncate block">
                  {formatPreview(replyingTo)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Staged Attachment Preview */}
          {attachmentPreview && (
            <div className="relative z-10 px-4 py-2 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between text-xs text-emerald-950">
              <div className="flex items-center gap-2.5 truncate">
                {attachmentPreview.type === 'image' && (
                  <img src={attachmentPreview.url} alt="Preview" className="w-10 h-10 rounded object-cover border border-emerald-300" />
                )}
                {attachmentPreview.type === 'audio' && <Volume2 className="w-5 h-5 text-[#008069]" />}
                {attachmentPreview.type === 'document' && <FileText className="w-5 h-5 text-[#008069]" />}
                <div className="truncate">
                  <div className="font-bold truncate">{attachmentPreview.name}</div>
                  <div className="text-[10px] text-emerald-700">
                    {attachmentPreview.sizeLabel || 'Ready'}
                    {attachmentPreview.voiceDurationSeconds ? ` · ${formatDuration(attachmentPreview.voiceDurationSeconds)}` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttachmentPreview(null)}
                className="text-rose-600 hover:text-rose-800 font-bold px-2 py-1 cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}

          {/* Bottom Composer Area */}
          <div className="relative z-20 px-3 py-2.5 bg-[#f0f2f5] border-t border-slate-200 shrink-0">
            {/* Hidden Inputs */}
            <input
              type="file"
              ref={imageInputRef}
              onChange={handleImageSelected}
              accept="image/*"
              className="hidden"
            />
            <input
              type="file"
              ref={docInputRef}
              onChange={(e) => handleFileSelected(e, 'document')}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              className="hidden"
            />
            <input
              type="file"
              ref={audioInputRef}
              onChange={(e) => handleFileSelected(e, 'audio')}
              accept="audio/*"
              className="hidden"
            />

            {/* Attach Popover Menu */}
            {showAttachMenu && (
              <div className="absolute bottom-14 left-12 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 w-52 space-y-1 z-30">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-purple-600" />
                  <span>Photos & Homework</span>
                </button>
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Document / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-amber-600" />
                  <span>Audio File</span>
                </button>
              </div>
            )}

            {/* Emoji Quick Picker Popover */}
            {showEmojiPicker && (
              <div className="absolute bottom-14 left-3 bg-white rounded-2xl shadow-xl border border-slate-200 p-2.5 grid grid-cols-6 gap-1.5 z-30">
                {QUICK_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setInputText(prev => prev + emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-slate-100 text-base flex items-center justify-center cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {isRecording ? (
              <div className="flex items-center justify-between gap-3 bg-white rounded-full px-4 py-2 border border-rose-300 shadow-xs">
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  className="p-1.5 text-slate-500 hover:text-rose-600 rounded-full hover:bg-rose-50 cursor-pointer"
                  title="Discard recording"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 text-xs font-bold text-rose-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                  <span>Recording Voice Note... {formatDuration(recordingSeconds)}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => stopAndAttachVoiceNote(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Preview before sending"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => stopAndAttachVoiceNote(true)}
                    className="w-9 h-9 bg-[#00a884] hover:bg-[#008069] text-white rounded-full flex items-center justify-center shadow-xs cursor-pointer"
                    title="Send Voice Note"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitForm} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiPicker(p => !p);
                    setShowAttachMenu(false);
                  }}
                  className="p-2 text-slate-600 hover:text-[#008069] rounded-full hover:bg-slate-200/70 transition-colors cursor-pointer"
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(p => !p);
                    setShowEmojiPicker(false);
                  }}
                  className="p-2 text-slate-600 hover:text-[#008069] rounded-full hover:bg-slate-200/70 transition-colors cursor-pointer"
                  title="Attach photo, document, or audio"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Message ${activeChannel?.name || ''}...`}
                  className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-full focus:outline-hidden focus:border-[#00a884] text-slate-900"
                />

                {inputText.trim() || attachmentPreview ? (
                  <button
                    type="submit"
                    className="w-10 h-10 bg-[#00a884] hover:bg-[#008069] text-white rounded-full flex items-center justify-center shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    className="w-10 h-10 bg-[#00a884] hover:bg-[#008069] text-white rounded-full flex items-center justify-center shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
                    title="Record live voice note"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      </div>

      {/* In-App Image Lightbox Modal (No window.open) */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="w-full max-w-4xl flex items-center justify-between text-white pb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs font-bold truncate">{lightboxImage.name}</span>
            <div className="flex items-center gap-2">
              <a
                href={lightboxImage.url}
                download={lightboxImage.name}
                className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008069] text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <img
            src={lightboxImage.url}
            alt={lightboxImage.name}
            className="max-h-[82vh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
