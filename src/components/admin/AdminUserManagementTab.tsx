import React, { useState } from 'react';
import {
  ShieldAlert,
  UserPlus,
  KeyRound,
  Mail,
  Phone,
  Edit3,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  UserCheck
} from 'lucide-react';
import { AdminUser } from '../../types/cbt';
import { saveAdmin, deleteAdmin } from '../../services/firebase';

interface AdminUserManagementTabProps {
  currentAdminEmail: string;
  admins: AdminUser[];
  onAdminsUpdated: () => void;
  showNotification: (text: string, type?: 'success' | 'error') => void;
}

export const AdminUserManagementTab: React.FC<AdminUserManagementTabProps> = ({
  currentAdminEmail,
  admins,
  onAdminsUpdated,
  showNotification
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState<{
    fullName: string;
    email: string;
    role: 'super_admin' | 'admin' | 'vice_principal' | 'examination_officer';
    passcode: string;
    phoneNumber: string;
    status: 'active' | 'suspended';
  }>({
    fullName: '',
    email: '',
    role: 'admin',
    passcode: '',
    phoneNumber: '',
    status: 'active'
  });

  const togglePasswordVisibility = (adminId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [adminId]: !prev[adminId] }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = 'ADM-';
    for (let i = 0; i < 6; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const handleOpenAdd = () => {
    setEditingAdmin(null);
    setForm({
      fullName: '',
      email: '',
      role: 'admin',
      passcode: generateRandomKey(),
      phoneNumber: '',
      status: 'active'
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setForm({
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
      passcode: admin.passcode,
      phoneNumber: admin.phoneNumber || '',
      status: admin.status
    });
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim() || !form.passcode.trim()) {
      showNotification('Please fill in Administrator Full Name, Email, and Security Passcode.', 'error');
      return;
    }

    const cleanEmail = form.email.trim().toLowerCase();
    const isMainAdmin = cleanEmail === 'fathertemitope@gmail.com' || editingAdmin?.isMainSuperAdmin;

    const adminId = editingAdmin ? editingAdmin.id : `admin_${cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    const newAdmin: AdminUser = {
      id: adminId,
      fullName: form.fullName.trim(),
      email: cleanEmail,
      role: isMainAdmin ? 'super_admin' : form.role,
      passcode: form.passcode.trim(),
      phoneNumber: form.phoneNumber.trim(),
      status: form.status,
      isMainSuperAdmin: isMainAdmin,
      assignedPermissions: ['all'],
      createdAt: editingAdmin ? editingAdmin.createdAt : new Date().toISOString()
    };

    try {
      await saveAdmin(newAdmin);
      setShowAddModal(false);
      onAdminsUpdated();
      showNotification(
        editingAdmin
          ? `Administrator "${newAdmin.fullName}" was successfully updated.`
          : `New Administrator "${newAdmin.fullName}" (${newAdmin.email}) added with total administrative privileges!`
      );
    } catch (err: any) {
      showNotification(err.message || 'Failed to save administrator.', 'error');
    }
  };

  const handleDelete = async (admin: AdminUser) => {
    if (admin.isMainSuperAdmin || admin.email.toLowerCase() === 'fathertemitope@gmail.com') {
      showNotification('The Chief Super Administrator (fathertemitope@gmail.com) is permanently protected and cannot be deleted.', 'error');
      return;
    }

    if (confirm(`Are you sure you want to delete administrator "${admin.fullName}" (${admin.email})? They will immediately lose access to the administrative console.`)) {
      try {
        await deleteAdmin(admin.id);
        onAdminsUpdated();
        showNotification(`Administrator "${admin.fullName}" has been removed.`);
      } catch (err: any) {
        showNotification(err.message || 'Failed to delete administrator.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200 uppercase tracking-wide mb-1">
              <ShieldAlert className="w-3 h-3 text-amber-600" />
              <span>Multi-Admin Governance</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">Institutional Administrators & Co-Admins</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              As the Chief Super Administrator, you can add and delegate full or specialized administrative privileges to vice principals, academic directors, and examination officers.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-amber-400" />
            <span>Add New Administrator</span>
          </button>
        </div>

        {/* Security Notice Card */}
        <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 leading-relaxed">
            <strong className="text-slate-900 font-bold">Total App Authority:</strong> All authorized administrators configured here have full access to manage school identity, teacher assignments, student directories, examinations, question banks, Continuous Assessment (CA) scores, and grading scale thresholds.
          </div>
        </div>

        {/* Administrators Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3 px-4">Administrator Name & Email</th>
                <th className="py-3 px-4">Administrative Role</th>
                <th className="py-3 px-4">Security Passcode / Key</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No administrators registered yet.
                  </td>
                </tr>
              ) : (
                admins.map(admin => {
                  const isChief = admin.isMainSuperAdmin || admin.email.toLowerCase() === 'fathertemitope@gmail.com';
                  const isCurrent = admin.email.toLowerCase() === currentAdminEmail.toLowerCase();
                  const showPass = visiblePasswords[admin.id];

                  return (
                    <tr key={admin.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{admin.fullName}</span>
                          {isChief && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-slate-950 shadow-xs">
                              Chief Super Admin
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-900">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono font-normal flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{admin.email}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 capitalize">
                          <UserCheck className="w-3 h-3 text-amber-500" />
                          <span>{admin.role.replace('_', ' ')}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 bg-slate-900 text-amber-300 font-mono text-xs px-2.5 py-1 rounded-lg border border-slate-800">
                          <span>{showPass ? admin.passcode : '••••••••'}</span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(admin.id)}
                            className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                            title={showPass ? 'Hide passcode' : 'Show passcode'}
                          >
                            {showPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(admin.passcode, `pass_${admin.id}`)}
                            className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                            title="Copy passcode"
                          >
                            {copiedId === `pass_${admin.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">
                        {admin.phoneNumber || '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                            admin.status === 'active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {admin.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(admin)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Administrator"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {!isChief && (
                            <button
                              onClick={() => handleDelete(admin)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Administrator"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  {editingAdmin ? 'Edit Administrator Profile' : 'Enroll New Administrator'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name & Title (e.g. Dr. A. K. Bello / Vice Principal)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vice Principal Mrs. S. A. Oladipo"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Administrator Email Address (Login ID)
                </label>
                <input
                  type="email"
                  required
                  disabled={editingAdmin?.isMainSuperAdmin}
                  placeholder="admin@honeysworldhigh.edu.ng"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-60"
                />
                {editingAdmin?.isMainSuperAdmin && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    Chief Super Admin email address cannot be modified.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Administrative Role
                  </label>
                  <select
                    value={form.role}
                    disabled={editingAdmin?.isMainSuperAdmin}
                    onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  >
                    <option value="super_admin">Chief Super Admin (Total Control)</option>
                    <option value="admin">Co-Administrator (General Admin)</option>
                    <option value="vice_principal">Vice Principal / Academic Dean</option>
                    <option value="examination_officer">Examination Officer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Status
                  </label>
                  <select
                    value={form.status}
                    disabled={editingAdmin?.isMainSuperAdmin}
                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                  >
                    <option value="active">Active (Full Access Allowed)</option>
                    <option value="suspended">Suspended (Access Blocked)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Security Key / Password</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, passcode: generateRandomKey() })}
                    className="text-[11px] text-amber-600 hover:underline font-semibold cursor-pointer"
                  >
                    Generate Passcode
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="••••••••••••"
                  value={form.passcode}
                  onChange={(e) => setForm({ ...form, passcode: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-900 text-amber-300 font-mono font-black border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  This admin will enter their email and this security passcode to unlock the administrative console.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Phone Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="+234 803 123 4567"
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md cursor-pointer"
                >
                  {editingAdmin ? 'Update Administrator' : 'Save & Authorize Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
