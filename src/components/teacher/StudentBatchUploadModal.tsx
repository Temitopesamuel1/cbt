import React, { useState } from 'react';
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Users,
  KeyRound,
  FileSpreadsheet,
  X,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Student, SchoolClass, generateStudentAccessCode } from '../../types/cbt';
import { saveStudent } from '../../services/firebase';

interface StudentBatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  currentSession: string;
  existingStudents: Student[];
  onUploadSuccess: (newStudents: Student[]) => void;
}

export const StudentBatchUploadModal: React.FC<StudentBatchUploadModalProps> = ({
  isOpen,
  onClose,
  classes,
  currentSession,
  existingStudents,
  onUploadSuccess
}) => {
  const [csvText, setCsvText] = useState('');
  const [selectedClassGrade, setSelectedClassGrade] = useState(classes[0]?.code || 'SS 2');
  const [previewStudents, setPreviewStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  // Download Sample CSV
  const handleDownloadSample = () => {
    const csvContent =
      'FullName,ClassGrade,AdmissionNumber\n' +
      'Emmanuel Adebayo,SS 2,STU/2025/001\n' +
      'Chioma Okonkwo,SS 2,STU/2025/002\n' +
      'Ibrahim Musa,SS 2,STU/2025/003\n' +
      'Zainab Aliyu,SS 2,STU/2025/004\n' +
      'David Adeleke,SS 2,STU/2025/005\n' +
      'Amina Bello,SS 1,STU/2025/006\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'prime_edutech_student_roster_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV text or raw lines
  const handleParseContent = (text: string) => {
    setCsvText(text);
    setError(null);

    const clean = text.trim();
    if (!clean) {
      setPreviewStudents([]);
      return;
    }

    try {
      const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) {
        setPreviewStudents([]);
        return;
      }

      // Check if line 1 is header
      let startIndex = 0;
      const firstLineLower = lines[0].toLowerCase();
      if (
        firstLineLower.includes('fullname') ||
        firstLineLower.includes('name') ||
        firstLineLower.includes('first') ||
        firstLineLower.includes('admission')
      ) {
        startIndex = 1;
      }

      const existingCodes = existingStudents.map(s => s.accessCode || '');
      const allocatedCodes = [...existingCodes];
      const parsedList: Student[] = [];

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split by comma or tab
        const delimiter = line.includes('\t') ? '\t' : ',';
        const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));

        if (cols.length === 0 || !cols[0]) continue;

        let fullName = '';
        let firstName = '';
        let surname = '';
        let classGrade = selectedClassGrade;
        let admissionNumber = '';

        // If format is: FirstName, Surname, ClassGrade, AdmissionNumber
        if (cols.length >= 4) {
          firstName = cols[0];
          surname = cols[1];
          fullName = `${firstName} ${surname}`.trim();
          classGrade = cols[2] || selectedClassGrade;
          admissionNumber = cols[3].toUpperCase();
        } else if (cols.length === 3) {
          // Format: FullName, ClassGrade, AdmissionNumber
          fullName = cols[0];
          const parts = fullName.split(' ');
          firstName = parts[0] || 'Student';
          surname = parts.slice(1).join(' ') || 'Candidate';
          classGrade = cols[1] || selectedClassGrade;
          admissionNumber = cols[2].toUpperCase();
        } else if (cols.length === 2) {
          // Format: FullName, ClassGrade
          fullName = cols[0];
          const parts = fullName.split(' ');
          firstName = parts[0] || 'Student';
          surname = parts.slice(1).join(' ') || 'Candidate';
          classGrade = cols[1] || selectedClassGrade;
        } else {
          // Format: FullName only
          fullName = cols[0];
          const parts = fullName.split(' ');
          firstName = parts[0] || 'Student';
          surname = parts.slice(1).join(' ') || 'Candidate';
        }

        // Auto-generate Admission Number if empty
        if (!admissionNumber) {
          const countIdx = existingStudents.length + parsedList.length + 1;
          const yr = new Date().getFullYear();
          admissionNumber = `STU/${yr}/${String(countIdx).padStart(3, '0')}`;
        }

        // Auto-generate Unique Student Access Code (e.g. PRM-7839)
        const accessCode = generateStudentAccessCode(allocatedCodes);
        allocatedCodes.push(accessCode);

        const newStudent: Student = {
          id: `stu-${Date.now()}-${i}`,
          admissionNumber: admissionNumber.toUpperCase(),
          firstName,
          surname,
          fullName,
          classGrade: classGrade.toUpperCase(),
          academicSession: currentSession,
          status: 'active',
          registeredAt: new Date().toISOString(),
          accessCode
        };

        parsedList.push(newStudent);
      }

      if (parsedList.length === 0) {
        setError('No valid student records could be parsed. Check your CSV rows.');
      }

      setPreviewStudents(parsedList);
    } catch (err) {
      console.error('CSV Parsing error:', err);
      setError('Failed to parse text. Please check format or delimiter.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        handleParseContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleCommitUpload = async () => {
    if (previewStudents.length === 0) return;

    setIsSaving(true);
    setError(null);

    try {
      // Save all students to database
      for (const student of previewStudents) {
        await saveStudent(student);
      }

      onUploadSuccess(previewStudents);
      onClose();
    } catch (err) {
      console.error('Batch save students error:', err);
      setError('Error saving students to Firebase. Please check connectivity and retry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center">
              <Upload className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Bulk Student Upload & Unique ID Generator</h3>
              <p className="text-[11px] text-slate-400">
                Upload student rosters; the system will automatically generate a Unique Login ID for each student
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Instructions & Template Strip */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                <span>Automated Unique ID Assignment</span>
              </div>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Each uploaded candidate is instantly assigned a unique passkey (e.g. <strong>PRM-4821</strong>) for 1-click exam login.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template</span>
            </button>
          </div>

          {/* Default Class Selection for unassigned rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Default Target Class Form
              </label>
              <select
                value={selectedClassGrade}
                onChange={(e) => setSelectedClassGrade(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                ))}
                <option value="SS 1">SS 1</option>
                <option value="SS 2">SS 2</option>
                <option value="SS 3">SS 3</option>
                <option value="JSS 1">JSS 1</option>
                <option value="JSS 2">JSS 2</option>
                <option value="JSS 3">JSS 3</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Academic Session
              </label>
              <input
                type="text"
                disabled
                value={currentSession}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-slate-100 text-slate-600 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Upload File or Paste */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
              <span>Select CSV File (from Excel or Google Sheets):</span>
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-900 hover:file:bg-blue-100 mb-2.5 cursor-pointer"
            />

            <label className="block font-bold text-slate-700 mb-1">
              Or Paste Student Rows Directly:
            </label>
            <textarea
              rows={4}
              placeholder={`FullName, ClassGrade, AdmissionNumber\nEmmanuel Adebayo, SS 2, STU/2025/001\nChioma Okonkwo, SS 2, STU/2025/002\nIbrahim Musa, SS 2, STU/2025/003`}
              value={csvText}
              onChange={(e) => handleParseContent(e.target.value)}
              className="w-full px-3 py-2 font-mono text-[11px] border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Live Preview with Generated Unique Codes */}
          {previewStudents.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Parsed Candidate Roster ({previewStudents.length} Students Ready)</span>
                </h4>
                <span className="text-[11px] text-slate-500">Unique IDs generated automatically</span>
              </div>

              <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[9px] tracking-wider sticky top-0">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3">Class Form</th>
                      <th className="py-2 px-3">Admission Number</th>
                      <th className="py-2 px-3">Generated Unique ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewStudents.map((s, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/40">
                        <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{s.fullName}</td>
                        <td className="py-2 px-3 text-slate-600">{s.classGrade}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">{s.admissionNumber}</td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-900">
                          <span className="bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded">
                            {s.accessCode}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={previewStudents.length === 0 || isSaving}
              onClick={handleCommitUpload}
              className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-40"
            >
              <span>{isSaving ? 'Enrolling Students...' : `Confirm & Enrol ${previewStudents.length} Students`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
