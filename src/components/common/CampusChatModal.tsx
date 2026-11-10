import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Users,
  Send,
  Paperclip,
  Image,
  Mic,
  X,
  FileText,
  Clock,
  ShieldCheck,
  CheckCheck,
  Search,
  Volume2
} from 'lucide-react';
import { ChatMessage, Student, StaffMember, AdminUser } from '../../types/cbt';
import { fetchChatMessages, sendChatMessage } from '../../services/firebase';

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

export const CampusChatModal: React.FC<CampusChatModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  availableStaff = [],
  availableStudents = []
}) => {
  // Active Channel
  const defaultChannel = currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.role === 'super_admin'
    ? 'staff-general'
    : `class-${(currentUser.classGrade || 'SS 2').toLowerCase().replace(/\s+/g, '')}`;

  const [activeChannelId, setActiveChannelId] = useState<string>(defaultChannel);
  const [activeChannelName, setActiveChannelName] = useState<string>(
    currentUser.role === 'student' ? `${currentUser.classGrade || 'SS 2'} Class Group` : 'Faculty Staff Room'
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{
    url: string;
    type: 'image' | 'audio' | 'document';
    name: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages for current active channel
  useEffect(() => {
    if (!isOpen) return;
    let isSubscribed = true;

    const loadMessages = async () => {
      const msgs = await fetchChatMessages(activeChannelId);
      if (isSubscribed) {
        setMessages(msgs);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    };

    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeChannelId, isOpen]);

  // Handle Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachmentPreview) return;

    const newMsg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      channelId: activeChannelId,
      channelType: activeChannelId.startsWith('staff')
        ? 'staff_group'
        : activeChannelId.startsWith('class')
        ? 'student_class_group'
        : 'direct_teacher',
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text: inputText.trim(),
      attachmentUrl: attachmentPreview?.url,
      attachmentType: attachmentPreview?.type,
      attachmentName: attachmentPreview?.name,
      timestamp: new Date().toISOString()
    };

    // Optimistic update
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setAttachmentPreview(null);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    await sendChatMessage(newMsg);
  };

  // Handle File / Image Upload from Device
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, forceType?: 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const isImg = file.type.startsWith('image/');
      const isAud = forceType === 'audio' || file.type.startsWith('audio/');

      setAttachmentPreview({
        url: result,
        type: isImg ? 'image' : isAud ? 'audio' : 'document',
        name: file.name
      });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white rounded-2xl max-w-4xl w-full h-[88vh] shadow-2xl border border-slate-300 flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar: Channels & Contacts */}
        <div className="w-full md:w-72 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm">Campus Communications</h3>
            </div>
            <button
              onClick={onClose}
              className="md:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 border-b border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Logged in as:
            </span>
            <span className="text-xs font-black text-slate-900 block truncate">
              {currentUser.name} ({currentUser.role})
            </span>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
            {/* General Group Channels */}
            <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Group Rooms
            </div>

            {(currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.role === 'super_admin') && (
              <button
                onClick={() => {
                  setActiveChannelId('staff-general');
                  setActiveChannelName('Faculty Staff Room');
                }}
                className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  activeChannelId === 'staff-general'
                    ? 'bg-blue-900 text-white font-bold shadow-xs'
                    : 'hover:bg-slate-200 text-slate-800'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <div className="truncate">
                  <div className="font-bold text-xs truncate">Faculty Staff Room</div>
                  <div className={`text-[10px] truncate ${activeChannelId === 'staff-general' ? 'text-amber-300' : 'text-slate-500'}`}>
                    General teachers & administration
                  </div>
                </div>
              </button>
            )}

            {/* Class Group for Students or Teachers */}
            <button
              onClick={() => {
                const cId = `class-${(currentUser.classGrade || 'SS 2').toLowerCase().replace(/\s+/g, '')}`;
                setActiveChannelId(cId);
                setActiveChannelName(`${currentUser.classGrade || 'SS 2'} Class Cohort Group`);
              }}
              className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                activeChannelId.startsWith('class-')
                  ? 'bg-blue-900 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-200 text-slate-800'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <div className="truncate">
                <div className="font-bold text-xs truncate">
                  {currentUser.classGrade || 'SS 2'} Class Room
                </div>
                <div className={`text-[10px] truncate ${activeChannelId.startsWith('class-') ? 'text-amber-300' : 'text-slate-500'}`}>
                  Academic discussion & files
                </div>
              </div>
            </button>

            {/* Direct Contacts List */}
            <div className="px-2 pt-4 pb-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              {currentUser.role === 'student' ? 'Faculty Teachers (Ask Teacher)' : 'Faculty Colleagues'}
            </div>

            {availableStaff.map(st => {
              const pairId = [currentUser.id, st.id || st.uniqueId].sort().join('_');
              return (
                <button
                  key={st.id || st.uniqueId}
                  onClick={() => {
                    setActiveChannelId(`dm_${pairId}`);
                    setActiveChannelName(`Chat with ${st.fullName}`);
                  }}
                  className={`w-full p-2 rounded-lg text-left flex items-center gap-2 transition-colors cursor-pointer ${
                    activeChannelId === `dm_${pairId}`
                      ? 'bg-blue-900 text-white font-bold'
                      : 'hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center font-bold text-[10px] text-slate-800 shrink-0">
                    {st.fullName.charAt(0)}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold block truncate text-[11px]">{st.fullName}</span>
                    <span className="text-[9px] text-slate-400 block truncate">
                      {st.assignedSubjectNames.join(', ') || st.role}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-amber-50 border-t border-amber-200 text-[10px] text-amber-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Super Admin oversees campus communications for student safety.</span>
          </div>
        </div>

        {/* Right Main Area: Active Chat Window */}
        <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
          {/* Channel Top Bar */}
          <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-2xs">
            <div>
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span>{activeChannelName}</span>
                <span className="text-[10px] bg-blue-50 text-blue-900 px-2 py-0.5 rounded-full border border-blue-200 font-mono">
                  Active
                </span>
              </h4>
              <p className="text-[11px] text-slate-500">
                Send messages, academic questions, homework photos, documents, and voice audio notes
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer hidden md:block"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <MessageSquare className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-bold text-xs">No messages yet in {activeChannelName}.</p>
                <p className="text-[11px] text-slate-500">
                  Be the first to start the academic conversation!
                </p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.senderId === currentUser.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-baseline gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-bold text-slate-600">
                        {isMe ? 'You' : msg.senderName}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div
                      className={`max-w-[85%] sm:max-w-md p-3 rounded-2xl text-xs space-y-2 shadow-xs ${
                        isMe
                          ? 'bg-blue-900 text-white rounded-tr-none'
                          : 'bg-white text-slate-900 border border-slate-200 rounded-tl-none'
                      }`}
                    >
                      {/* Attached Image */}
                      {msg.attachmentUrl && msg.attachmentType === 'image' && (
                        <div className="rounded-lg overflow-hidden border border-white/20 max-h-60 bg-black/10">
                          <img
                            src={msg.attachmentUrl}
                            alt="Attachment"
                            className="w-full h-auto object-contain cursor-pointer hover:opacity-95"
                            onClick={() => window.open(msg.attachmentUrl, '_blank')}
                          />
                        </div>
                      )}

                      {/* Attached Audio */}
                      {msg.attachmentUrl && msg.attachmentType === 'audio' && (
                        <div className={`p-2 rounded-xl flex items-center gap-2 ${isMe ? 'bg-blue-950/60' : 'bg-slate-100'}`}>
                          <Volume2 className="w-4 h-4 shrink-0 text-amber-400" />
                          <audio controls className="w-full h-8" src={msg.attachmentUrl}>
                            Your browser does not support audio playback.
                          </audio>
                        </div>
                      )}

                      {/* Attached Document */}
                      {msg.attachmentUrl && msg.attachmentType === 'document' && (
                        <a
                          href={msg.attachmentUrl}
                          download={msg.attachmentName || 'document'}
                          className={`p-2.5 rounded-xl flex items-center gap-2.5 font-bold underline transition-opacity ${
                            isMe ? 'bg-blue-950/60 text-amber-200 hover:opacity-90' : 'bg-slate-100 text-blue-900 hover:opacity-90'
                          }`}
                        >
                          <FileText className="w-4 h-4 shrink-0 text-amber-400" />
                          <span className="truncate">{msg.attachmentName || 'Download File'}</span>
                        </a>
                      )}

                      {/* Message Text */}
                      {msg.text && (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachment Preview Banner */}
          {attachmentPreview && (
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center justify-between text-xs text-amber-900 shrink-0">
              <div className="flex items-center gap-2 truncate">
                {attachmentPreview.type === 'image' && <Image className="w-4 h-4 text-amber-600" />}
                {attachmentPreview.type === 'audio' && <Volume2 className="w-4 h-4 text-amber-600" />}
                {attachmentPreview.type === 'document' && <FileText className="w-4 h-4 text-amber-600" />}
                <span className="truncate font-bold">Ready to send: {attachmentPreview.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachmentPreview(null)}
                className="text-amber-800 hover:text-amber-950 font-bold p-1 cursor-pointer"
              >
                ✕ Remove
              </button>
            </div>
          )}

          {/* Input Control Box */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            {/* Hidden Inputs for File and Audio Upload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e)}
              accept="image/*,.pdf,.doc,.docx,.txt,.csv"
              className="hidden"
            />
            <input
              type="file"
              ref={audioInputRef}
              onChange={(e) => handleFileUpload(e, 'audio')}
              accept="audio/*"
              className="hidden"
            />

            {/* Photo / Document Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Attach photo or document file from phone/computer"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Audio Voice Note Upload Button */}
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="p-2 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Send voice note or audio recording"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message ${activeChannelName}...`}
              className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-blue-900"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() && !attachmentPreview}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-40 flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
