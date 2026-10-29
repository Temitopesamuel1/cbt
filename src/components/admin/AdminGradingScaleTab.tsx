import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Award,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import {
  SchoolSettings,
  CaWeightsConfig,
  GradeScaleItem,
  DEFAULT_CA_WEIGHTS,
  DEFAULT_GRADE_SCALE
} from '../../types/cbt';
import { saveSchoolSettings } from '../../services/firebase';

interface AdminGradingScaleTabProps {
  settings: SchoolSettings;
  onSettingsUpdated: (updated: SchoolSettings) => void;
  showNotification: (text: string, type?: 'success' | 'error') => void;
}

export const AdminGradingScaleTab: React.FC<AdminGradingScaleTabProps> = ({
  settings,
  onSettingsUpdated,
  showNotification
}) => {
  const [session, setSession] = useState(settings.academicSession || '2025/2026');
  const [term, setTerm] = useState(settings.currentTerm || '1st Term');
  const [passMark, setPassMark] = useState(settings.passMarkPercentage || 50);
  const [immediateResult, setImmediateResult] = useState(settings.allowImmediateResultViewing ?? true);

  const [caWeights, setCaWeights] = useState<CaWeightsConfig>(
    settings.caWeights || DEFAULT_CA_WEIGHTS
  );

  const [gradingScale, setGradingScale] = useState<GradeScaleItem[]>(
    settings.gradingScale && settings.gradingScale.length > 0
      ? settings.gradingScale
      : DEFAULT_GRADE_SCALE
  );

  const [saving, setSaving] = useState(false);

  const totalCaMax = caWeights.assignmentMax + caWeights.projectMax + caWeights.testMax;
  const grandTotal = totalCaMax + caWeights.examMax;

  const handleResetDefaults = () => {
    if (confirm('Reset Continuous Assessment weights and Grading Scale to standard WAEC defaults?')) {
      setCaWeights(DEFAULT_CA_WEIGHTS);
      setGradingScale(DEFAULT_GRADE_SCALE);
      showNotification('Grading system reset to WAEC standard defaults.');
    }
  };

  const handleGradeScaleChange = (index: number, field: keyof GradeScaleItem, value: any) => {
    setGradingScale(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: field === 'minScore' || field === 'maxScore' || field === 'gradePoint' ? Number(value) : value
      };
      return copy;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (grandTotal !== 100) {
      if (!confirm(`Warning: The sum of CA weights and Examination (${grandTotal}) is not 100. Do you still wish to proceed?`)) {
        return;
      }
    }

    setSaving(true);
    const updatedSettings: SchoolSettings = {
      ...settings,
      academicSession: session,
      currentTerm: term,
      passMarkPercentage: Number(passMark),
      allowImmediateResultViewing: immediateResult,
      caWeights,
      gradingScale
    };

    try {
      await saveSchoolSettings(updatedSettings);
      onSettingsUpdated(updatedSettings);
      showNotification('Academic evaluation policies, CA weightings, and grading scale successfully saved!');
    } catch (err: any) {
      showNotification(err.message || 'Failed to save grading system.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-900 text-[11px] font-bold border border-emerald-200 uppercase tracking-wide mb-1">
            <Award className="w-3.5 h-3.5 text-emerald-700" />
            <span>Curriculum Governance</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">Academic Policies, CA Broadsheet Weights & Grading Scale</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure how continuous assessments and CBT exams are scored, aggregated into 100 marks, and mapped to WAEC grades (A1 - F9) and the 5.0 CGPA scale.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-amber-400" />
            <span>{saving ? 'Saving...' : 'Save Policies & Scale'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Term & Session Settings */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-700" />
            <span>1. Current Term & Session Parameters</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Active Academic Session
              </label>
              <input
                type="text"
                required
                placeholder="2025/2026"
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Current Active Term
              </label>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="1st Term">1st Term</option>
                <option value="2nd Term">2nd Term</option>
                <option value="3rd Term">3rd Term</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Institutional Pass Mark (%)
              </label>
              <input
                type="number"
                min="30"
                max="100"
                value={passMark}
                onChange={(e) => setPassMark(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={immediateResult}
                onChange={(e) => setImmediateResult(e.target.checked)}
                className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 border-slate-300"
              />
              <span className="text-xs text-slate-700 font-semibold">
                Allow students to view their graded CBT result slip immediately upon submission
              </span>
            </label>
          </div>
        </div>

        {/* Continuous Assessment (CA) Weightings */}
        <div className="pt-6 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-900" />
                <span>2. Continuous Assessment (CA) Weightings & Total Marks</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Customize maximum points allocated to each assessment component on the teacher broadsheet.
              </p>
            </div>

            <div
              className={`px-3 py-1.5 rounded-xl font-mono font-bold text-xs flex items-center gap-1.5 ${
                grandTotal === 100
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}
            >
              <span>Total Points:</span>
              <strong className="text-sm">{grandTotal}/100</strong>
              {grandTotal === 100 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Assignment Max
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={caWeights.assignmentMax}
                onChange={(e) => setCaWeights({ ...caWeights, assignmentMax: Number(e.target.value) })}
                className="w-full px-3 py-2 text-base font-black bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 10 marks</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Project Work Max
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={caWeights.projectMax}
                onChange={(e) => setCaWeights({ ...caWeights, projectMax: Number(e.target.value) })}
                className="w-full px-3 py-2 text-base font-black bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 10 marks</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                CA Test Max
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={caWeights.testMax}
                onChange={(e) => setCaWeights({ ...caWeights, testMax: Number(e.target.value) })}
                className="w-full px-3 py-2 text-base font-black bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Default: 20 marks</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-blue-50/50 border-blue-200">
              <label className="block text-[11px] font-bold uppercase text-blue-900 mb-1">
                Terminal Exam Max
              </label>
              <input
                type="number"
                min="10"
                max="80"
                value={caWeights.examMax}
                onChange={(e) => setCaWeights({ ...caWeights, examMax: Number(e.target.value) })}
                className="w-full px-3 py-2 text-base font-black bg-white border border-blue-300 rounded-xl text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
              <span className="text-[10px] text-blue-700 mt-1 block">Default: 60 marks</span>
            </div>
          </div>
        </div>

        {/* WAEC Grading Scale Editor */}
        <div className="pt-6 border-t border-slate-100">
          <div className="mb-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              <span>3. Standard Secondary School Grading Scale (WAEC/NECO Standard)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Edit the score range thresholds, 5.0 CGPA scale points, and institutional remarks for every letter grade.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/60">
                  <th className="py-2.5 px-3">Grade Letter</th>
                  <th className="py-2.5 px-3">Min Score (%)</th>
                  <th className="py-2.5 px-3">Max Score (%)</th>
                  <th className="py-2.5 px-3">Grade Point (5.0 Scale)</th>
                  <th className="py-2.5 px-3">Official Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {gradingScale.map((item, idx) => (
                  <tr key={item.grade} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-mono font-black text-sm text-slate-900">
                      <span className="inline-block px-2.5 py-0.5 rounded bg-slate-900 text-amber-300">
                        {item.grade}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.minScore}
                        onChange={(e) => handleGradeScaleChange(idx, 'minScore', e.target.value)}
                        className="w-20 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.maxScore}
                        onChange={(e) => handleGradeScaleChange(idx, 'maxScore', e.target.value)}
                        className="w-20 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5.0"
                        value={item.gradePoint}
                        onChange={(e) => handleGradeScaleChange(idx, 'gradePoint', e.target.value)}
                        className="w-20 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={item.remark}
                        onChange={(e) => handleGradeScaleChange(idx, 'remark', e.target.value)}
                        className="w-full max-w-xs px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4 text-amber-400" />
            <span>{saving ? 'Publishing Scale...' : 'Save Policies & Grading Scale'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
