import React from 'react';

const SYMBOL_MAP: Record<string, string> = {
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\gamma': 'γ',
  '\\delta': 'δ',
  '\\Delta': 'Δ',
  '\\theta': 'θ',
  '\\lambda': 'λ',
  '\\mu': 'μ',
  '\\pi': 'π',
  '\\sigma': 'σ',
  '\\Sigma': 'Σ',
  '\\omega': 'ω',
  '\\Omega': 'Ω',
  '\\phi': 'φ',
  '\\rho': 'ρ',
  '\\pm': '±',
  '\\times': '×',
  '\\div': '÷',
  '\\cdot': '·',
  '\\leq': '≤',
  '\\le': '≤',
  '\\geq': '≥',
  '\\ge': '≥',
  '\\neq': '≠',
  '\\ne': '≠',
  '\\approx': '≈',
  '\\equiv': '≡',
  '\\degree': '°',
  '\\deg': '°',
  '\\rightarrow': '→',
  '\\to': '→',
  '\\leftarrow': '←',
  '\\leftrightarrow': '⇌',
  '\\infty': '∞',
  '\\angle': '∠',
  '\\perp': '⊥',
  '\\parallel': '∥',
  '\\therefore': '∴',
  '\\because': '∵',
  '\\sqrt': '√'
};

const SYMBOL_REGEX = new RegExp(
  Object.keys(SYMBOL_MAP)
    .sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g'
);

export function normalizeAcademicSymbols(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\^o\b/g, '°')
    .replace(SYMBOL_REGEX, match => SYMBOL_MAP[match] || match);
}

/**
 * Safely renders academic notation (superscripts like x^2 / x^{-3}, subscripts like H_2O / log_{10},
 * fractions, roots, Greek letters, and chemical equations) into structured React elements without HTML injection.
 */
export function renderFormattedAcademicNodes(text: string): React.ReactNode[] {
  const normalized = normalizeAcademicSymbols(text);
  const tokenRegex = /(\^\{[^}]+\}|\^[A-Za-z0-9+\-°]+|_\{[^}]+\}|_[A-Za-z0-9+\-]+)/g;

  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(normalized)) !== null) {
    if (match.index > lastIdx) {
      nodes.push(normalized.slice(lastIdx, match.index));
    }

    const token = match[0];
    const isSup = token.startsWith('^');
    let inner = token.slice(1);
    if (inner.startsWith('{') && inner.endsWith('}')) {
      inner = inner.slice(1, -1);
    }

    if (isSup) {
      nodes.push(
        React.createElement(
          'sup',
          { key: `sup-${keyIdx++}`, className: 'text-[0.72em] leading-none font-semibold' },
          inner
        )
      );
    } else {
      nodes.push(
        React.createElement(
          'sub',
          { key: `sub-${keyIdx++}`, className: 'text-[0.72em] leading-none font-semibold' },
          inner
        )
      );
    }

    lastIdx = match.index + token.length;
  }

  if (lastIdx < normalized.length) {
    nodes.push(normalized.slice(lastIdx));
  }

  return nodes;
}
