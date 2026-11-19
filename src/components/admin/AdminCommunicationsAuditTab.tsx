import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  ShieldAlert,
  Download,
  RefreshCw,
  FileText,
  Trash2,
  X,
  Volume2,
  Radio
} from 'lucide-react';
import { ChatMessage, Student, StaffMember } from '../../types/cbt';
import {
  subscribeAllChatMessages,
  fetchAllChatMessagesForAdmin,
  deleteChatMessage
} from '../../services/firebase';

interface AdminCommunicationsAuditTabProps {
  students: Student[];
  staff: StaffMember[];
  showNotification: (text: string, type?: 'success' | 'error') => void;
}

export const AdminCommunicationsAuditTab: React.FC<AdminCommunicationsAuditTabProps> = ({
  showNotification
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    const unsub = subscribeAllChatMessages((liveMsgs) => {
      setMessages(liveMsgs);
    });
    return () => unsub();
  }, []);

  const manualRefresh = async () => {
    setLoading(true);
    try {
      const data = await fetchAllChatMessagesForAdmin();
      setMessages(data);
      showNotification('Audit log synchronized with cloud database.');
    } catch (err) {
      console.warn('Failed to load chat messages for admin audit:', err);
    } finally {
      setLoading(false);
    }
  };

  // Dynamically discover all distinct channels including private DMs & group chats
  const distinctChannels = useMemo(() => {
    const map = new Map<string, { id: string; label: string; isDm: boolean }>();
    messages.forEach(m => {
      if (!m.channelId) return;
      if (!map.has(m.channelId)) {
        const isDm = m.channelId.startsWith('dm_');
        const label = m.channelName
          ? m.channelName
          : m.recipientName
          ? `${m.senderName} ↔ ${m.recipientName}`
          : m.channelId;
        map.set(m.channelId, { id: m.channelId, label, isDm });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [messages]);

  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      if (selectedChannel !== 'all' && msg.channelId !== selectedChannel) return false;
      if (selectedRole !== 'all' && msg.senderRole !== selectedRole) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = (msg.text || '').toLowerCase().includes(q);
        const matchSender = (msg.senderName || '').toLowerCase().includes(q);
        const matchRecipient = (msg.recipientName || '').toLowerCase().includes(q);
        const matchChannel = (msg.channelName || msg.channelId || '').toLowerCase().includes(q);
        if (!matchText && !matchSender && !matchRecipient && !matchChannel) return false;
      }
      return true;
    });
  }, [messages, selectedChannel, selectedRole, searchQuery]);

  const handleModerateDelete = async (msg: ChatMessage) => {
    await deleteChatMessage(msg.id, msg.channelId);
    showNotification('Message redacted from campus communications.');
  };

  const exportAuditLogCsv = () => {
    if (filteredMessages.length === 0) {
      showNotification('No chat logs to export', 'error');
      return;
    }

    const headers = ['Timestamp', 'Sender Name', 'Sender Role', 'Channel', 'Channel ID', 'Message Text', 'Attachment Type', 'Deleted'];
    const rows = filteredMessages.map(m => [
      `"${new Date(m.timestamp).toLocaleString()}"`,
      `"${m.senderName}"`,
      `"${m.senderRole}"`,
      `"${m.channelName || m.channelId}"`,
      `"${m.channelId}"`,
      `"${(m.text || '').replace(/"/g, '""')}"`,
      `"${m.attachmentType || 'None'}"`,
      `"${m.deleted ? 'Yes' : 'No'}"`
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `campus_chat_audit_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('Exported campus chat audit log!');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-900 text-[11px] font-bold border border-emerald-200 uppercase tracking-wide mb-1">
            <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
            <span>Super Admin Live Communications Oversight</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">Campus Chat & Private DM Real-Time Audit</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live stream of all WhatsApp campus group chats, teacher-to-teacher rooms, student study forums, and 1-on-1 direct messages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={manualRefresh}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={exportAuditLogCsv}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export Audit Log</span>
          </button>
        </div>
      </div>

      {/* Live Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Logged Messages</span>
          <span className="text-lg font-black font-mono text-slate-900">{messages.length}</span>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <span className="text-[10px] font-bold uppercase text-emerald-800 block">Active Conversations</span>
          <span className="text-lg font-black font-mono text-emerald-950">{distinctChannels.length}</span>
        </div>
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
          <span className="text-[10px] font-bold uppercase text-blue-800 block">Private DM Threads</span>
          <span className="text-lg font-black font-mono text-blue-950">{distinctChannels.filter(c => c.isDm).length}</span>
        </div>
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
          <span className="text-[10px] font-bold uppercase text-amber-800 block">Media & Voice Notes</span>
          <span className="text-lg font-black font-mono text-amber-950">{messages.filter(m => Boolean(m.attachmentType)).length}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search text, sender, recipient, room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold"
          >
            <option value="all">All Group Rooms & Private DMs ({distinctChannels.length})</option>
            {distinctChannels.map(ch => (
              <option key={ch.id} value={ch.id}>
                {ch.isDm ? `DM · ${ch.label}` : `Group · ${ch.label}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold"
          >
            <option value="all">All Roles</option>
            <option value="student">Students Only</option>
            <option value="teacher">Teachers Only</option>
            <option value="admin">Administrators Only</option>
            <option value="super_admin">Super Admin Only</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        {filteredMessages.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
            <div className="text-xs font-bold text-slate-600">No campus messages match the current filter</div>
            <p className="text-[11px] text-slate-400">
              All text messages, voice notes, images, and documents sent across campus appear here instantaneously.
            </p>
          </div>
        ) : (
          <div className="max-h-[580px] overflow-y-auto divide-y divide-slate-100 text-xs">
            {filteredMessages.map(msg => (
              <div key={msg.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-slate-900">{msg.senderName}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        msg.senderRole === 'teacher'
                          ? 'bg-amber-100 text-amber-900'
                          : msg.senderRole === 'admin' || msg.senderRole === 'super_admin'
                          ? 'bg-purple-100 text-purple-900'
                          : 'bg-blue-100 text-blue-900'
                      }`}
                    >
                      {msg.senderRole.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono truncate">
                      in <strong>{msg.channelName || msg.channelId}</strong>
                    </span>
                    {msg.deleted && (
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded">
                        REDACTED
                      </span>
                    )}
                  </div>

                  {msg.replyToText && (
                    <div className="text-[11px] text-slate-500 border-l-2 border-emerald-500 pl-2 italic">
                      Reply to {msg.replyToSender}: {msg.replyToText}
                    </div>
                  )}

                  {msg.text && (
                    <p className={`text-xs leading-relaxed ${msg.deleted ? 'italic text-slate-400' : 'text-slate-800'}`}>
                      {msg.text}
                    </p>
                  )}

                  {!msg.deleted && msg.attachmentType && (
                    <div className="pt-1">
                      {msg.attachmentType === 'image' && msg.attachmentUrl && (
                        <img
                          src={msg.attachmentUrl}
                          alt={msg.attachmentName || 'Attachment'}
                          onClick={() =>
                            setLightboxImage({
                              url: msg.attachmentUrl!,
                              name: msg.attachmentName || 'attachment.jpg'
                            })
                          }
                          className="max-h-36 rounded-lg border border-slate-200 object-cover cursor-pointer hover:opacity-90"
                        />
                      )}
                      {msg.attachmentType === 'audio' && msg.attachmentUrl && (
                        <div className="inline-flex items-center gap-2 bg-slate-100 px-2.5 py-1.5 rounded-xl">
                          <Volume2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <audio controls src={msg.attachmentUrl} className="h-8 max-w-xs" />
                        </div>
                      )}
                      {msg.attachmentType === 'document' && msg.attachmentUrl && (
                        <a
                          href={msg.attachmentUrl}
                          download={msg.attachmentName || 'document'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-mono"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-600" />
                          <span>{msg.attachmentName || 'Document Attachment'}</span>
                          <Download className="w-3 h-3 text-slate-500" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0 flex flex-col items-end gap-2">
                  <span className="text-[11px] text-slate-400 font-mono block">
                    {new Date(msg.timestamp).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </span>
                  {!msg.deleted && (
                    <button
                      type="button"
                      onClick={() => handleModerateDelete(msg)}
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      title="Redact message as Super Admin"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Redact</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal for Audit Image Inspection */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="w-full max-w-3xl flex items-center justify-between text-white pb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs font-bold">{lightboxImage.name}</span>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={lightboxImage.url}
            alt={lightboxImage.name}
            className="max-h-[82vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
