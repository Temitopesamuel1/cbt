import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  Filter,
  Users,
  ShieldAlert,
  Clock,
  Download,
  RefreshCw,
  FileText,
  User,
  GraduationCap
} from 'lucide-react';
import { ChatMessage, Student, StaffMember } from '../../types/cbt';
import { fetchAllChatMessagesForAdmin } from '../../services/firebase';

interface AdminCommunicationsAuditTabProps {
  students: Student[];
  staff: StaffMember[];
  showNotification: (text: string, type?: 'success' | 'error') => void;
}

export const AdminCommunicationsAuditTab: React.FC<AdminCommunicationsAuditTabProps> = ({
  students,
  staff,
  showNotification
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await fetchAllChatMessagesForAdmin();
      setMessages(data);
    } catch (err) {
      console.warn('Failed to load chat messages for admin audit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const filteredMessages = messages.filter(msg => {
    if (selectedChannel !== 'all' && msg.channelId !== selectedChannel) return false;
    if (selectedRole !== 'all' && msg.senderRole !== selectedRole) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = msg.text.toLowerCase().includes(q);
      const matchSender = msg.senderName.toLowerCase().includes(q);
      const matchChannel = (msg.channelName || '').toLowerCase().includes(q);
      if (!matchText && !matchSender && !matchChannel) return false;
    }
    return true;
  });

  const exportAuditLogCsv = () => {
    if (filteredMessages.length === 0) {
      showNotification('No chat logs to export', 'error');
      return;
    }

    const headers = ['Timestamp', 'Sender Name', 'Sender Role', 'Channel', 'Message Text', 'Attachment Type'];
    const rows = filteredMessages.map(m => [
      `"${new Date(m.timestamp).toLocaleString()}"`,
      `"${m.senderName}"`,
      `"${m.senderRole}"`,
      `"${m.channelName || m.channelId}"`,
      `"${m.text.replace(/"/g, '""')}"`,
      `"${m.attachmentType || 'None'}"`
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
    showNotification('Exported campus chat audit log!');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-900 text-[11px] font-bold border border-blue-200 uppercase tracking-wide mb-1">
            <ShieldAlert className="w-3 h-3 text-blue-700" />
            <span>Super Admin Communications Oversight</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">Campus Chat & Communications Audit</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time audit log of all communications across staff rooms, class cohorts, and peer messages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadMessages}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
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

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search message text, sender name..."
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
            <option value="all">All Channels & Groups</option>
            <option value="staff_general">Staff Room (General)</option>
            <option value="class_ss1">SS 1 Class Room</option>
            <option value="class_ss2">SS 2 Class Room</option>
            <option value="class_ss3">SS 3 Class Room</option>
            <option value="class_jss1">JSS 1 Class Room</option>
            <option value="class_jss2">JSS 2 Class Room</option>
            <option value="class_jss3">JSS 3 Class Room</option>
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
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        {filteredMessages.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
            <div className="text-xs font-bold text-slate-600">No campus messages logged yet</div>
            <p className="text-[11px] text-slate-400">
              When teachers and students send messages, voice notes, or file attachments, they will appear here.
            </p>
          </div>
        ) : (
          <div className="max-h-[550px] overflow-y-auto divide-y divide-slate-100 text-xs">
            {filteredMessages.map(msg => (
              <div key={msg.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-slate-900">{msg.senderName}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        msg.senderRole === 'teacher'
                          ? 'bg-amber-100 text-amber-900'
                          : msg.senderRole === 'admin'
                          ? 'bg-purple-100 text-purple-900'
                          : 'bg-blue-100 text-blue-900'
                      }`}
                    >
                      {msg.senderRole.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      in <strong>{msg.channelName || msg.channelId}</strong>
                    </span>
                  </div>

                  <p className="text-slate-800 text-xs leading-relaxed">{msg.text}</p>

                  {msg.attachmentType && (
                    <div className="pt-1">
                      {msg.attachmentType === 'image' && msg.attachmentUrl && (
                        <img
                          src={msg.attachmentUrl}
                          alt="Attachment"
                          className="max-h-32 rounded-lg border border-slate-200 object-cover"
                        />
                      )}
                      {msg.attachmentType === 'audio' && msg.attachmentUrl && (
                        <audio controls src={msg.attachmentUrl} className="h-8 max-w-xs mt-1" />
                      )}
                      {msg.attachmentType === 'document' && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-mono">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          <span>{msg.attachmentName || 'Document Attachment'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] text-slate-400 font-mono block">
                    {new Date(msg.timestamp).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
