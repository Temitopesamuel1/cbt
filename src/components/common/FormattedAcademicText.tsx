import React from 'react';
import { renderFormattedAcademicNodes } from '../../utils/mathText';

interface FormattedAcademicTextProps {
  text?: string | null;
  className?: string;
}

export const FormattedAcademicText: React.FC<FormattedAcademicTextProps> = ({
  text,
  className = ''
}) => {
  if (!text) return null;

  const lines = String(text).split('\n');
  return (
    <span className={className}>
      {lines.map((line, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <br />}
          {renderFormattedAcademicNodes(line)}
        </React.Fragment>
      ))}
    </span>
  );
};
