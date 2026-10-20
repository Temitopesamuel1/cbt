import React, { useState } from 'react';
import { X, Calculator as CalcIcon } from 'lucide-react';

interface CbtCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CbtCalculator: React.FC<CbtCalculatorProps> = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (display === '0' || overwrite) {
      setDisplay(digit);
      setOverwrite(false);
    } else {
      if (display.length < 10) {
        setDisplay(display + digit);
      }
    }
  };

  const handleDecimal = () => {
    if (overwrite) {
      setDisplay('0.');
      setOverwrite(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperation(null);
    setOverwrite(false);
  };

  const handleClearEntry = () => {
    setDisplay('0');
    setOverwrite(false);
  };

  const handleOp = (op: string) => {
    const current = parseFloat(display);
    if (prevValue === null) {
      setPrevValue(current);
    } else if (operation) {
      const res = calculate(prevValue, current, operation);
      setPrevValue(res);
      setDisplay(String(res).slice(0, 10));
    }
    setOperation(op);
    setOverwrite(true);
  };

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? 0 : a / b;
      default: return b;
    }
  };

  const handleEquals = () => {
    if (prevValue !== null && operation) {
      const current = parseFloat(display);
      const res = calculate(prevValue, current, operation);
      setDisplay(String(res).slice(0, 10));
      setPrevValue(null);
      setOperation(null);
      setOverwrite(true);
    }
  };

  const handleSqrt = () => {
    const current = parseFloat(display);
    if (current >= 0) {
      const res = Math.sqrt(current);
      setDisplay(String(parseFloat(res.toFixed(6))).slice(0, 10));
      setOverwrite(true);
    }
  };

  const handleToggleSign = () => {
    const current = parseFloat(display);
    setDisplay(String(-current));
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 overflow-hidden font-sans">
      <div className="flex items-center justify-between px-3 py-2.5 bg-blue-900 border-b border-blue-950">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-100">
          <CalcIcon className="w-3.5 h-3.5 text-amber-400" />
          <span>Institutional CBT Calculator</span>
        </div>
        <button
          onClick={onClose}
          className="text-blue-200 hover:text-white transition-colors p-0.5 rounded"
          title="Close Calculator"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 bg-slate-950">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 mb-3 text-right">
          <div className="text-[10px] text-slate-400 h-4 font-mono">
            {prevValue !== null && operation ? `${prevValue} ${operation}` : ''}
          </div>
          <div className="text-2xl font-mono tabular-nums font-bold tracking-wider text-emerald-400 overflow-hidden text-ellipsis">
            {display}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-xs font-medium">
          <button onClick={handleClear} className="p-2 bg-rose-900/60 hover:bg-rose-800 text-rose-200 rounded transition-colors">C</button>
          <button onClick={handleClearEntry} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">CE</button>
          <button onClick={handleSqrt} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">√</button>
          <button onClick={() => handleOp('÷')} className="p-2 bg-blue-800 hover:bg-blue-700 rounded font-bold transition-colors">÷</button>

          <button onClick={() => handleDigit('7')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">7</button>
          <button onClick={() => handleDigit('8')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">8</button>
          <button onClick={() => handleDigit('9')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">9</button>
          <button onClick={() => handleOp('×')} className="p-2 bg-blue-800 hover:bg-blue-700 rounded font-bold transition-colors">×</button>

          <button onClick={() => handleDigit('4')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">4</button>
          <button onClick={() => handleDigit('5')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">5</button>
          <button onClick={() => handleDigit('6')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">6</button>
          <button onClick={() => handleOp('-')} className="p-2 bg-blue-800 hover:bg-blue-700 rounded font-bold transition-colors">-</button>

          <button onClick={() => handleDigit('1')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">1</button>
          <button onClick={() => handleDigit('2')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">2</button>
          <button onClick={() => handleDigit('3')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">3</button>
          <button onClick={() => handleOp('+')} className="p-2 bg-blue-800 hover:bg-blue-700 rounded font-bold transition-colors">+</button>

          <button onClick={handleToggleSign} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">±</button>
          <button onClick={() => handleDigit('0')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">0</button>
          <button onClick={handleDecimal} className="p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors">.</button>
          <button onClick={handleEquals} className="p-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded transition-colors">=</button>
        </div>
      </div>
    </div>
  );
};
