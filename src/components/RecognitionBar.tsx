import React, { useState } from 'react';
import type { RowResult } from '../recognition/pipeline';
import './RecognitionBar.css';

interface RecognitionBarProps {
  rows: readonly RowResult[];
}

export const RecognitionBar: React.FC<RecognitionBarProps> = ({ rows }) => {
  const [expanded, setExpanded] = useState<boolean>(true);

  if (!rows || rows.length === 0) {
    return null;
  }

  // Filter rows that actually have recognized tokens
  const activeRows = rows.filter(r => r.tokens && r.tokens.length > 0);
  if (activeRows.length === 0) {
    return null;
  }

  // Only show the current (most recent active) expression
  const currentRowIndex = activeRows.length - 1;
  const currentRow = activeRows[currentRowIndex]!;

  const getSummary = () => {
    const expr = currentRow.expression || currentRow.tokens.join('');
    const res = currentRow.result ? `➜ ${currentRow.result}` : '';
    return `${expr} ${res}`.trim();
  };

  const getTokenClass = (token: string) => {
    if (token === '(' || token === ')') return 'token-bracket';
    if (['+', '-', '×', '÷', '='].includes(token)) return 'token-op';
    if (/^[a-zA-Z]$/.test(token)) return 'token-var';
    return '';
  };

  const hasResult = currentRow.result !== null;

  return (
    <div className="recognition-bar" role="region" aria-label="Current Recognized Expression">
      <div className="recognition-bar-header" onClick={() => setExpanded(prev => !prev)}>
        <div className="recognition-bar-title">
          <span className="recognition-bar-dot" />
          <span>Recognized{activeRows.length > 1 ? ` (${currentRowIndex + 1}/${activeRows.length})` : ''}</span>
        </div>
        {!expanded && (
          <span className="recognition-bar-summary">{getSummary()}</span>
        )}
        <button className="recognition-bar-toggle" type="button" aria-expanded={expanded}>
          {expanded ? '▾ Collapse' : '▴ Details'}
        </button>
      </div>

      {expanded && (
        <div className="recognition-bar-content">
          <div className="recognition-row">
            <div className="recognition-tokens">
              {currentRow.tokens.map((tok, tIdx) => (
                <span
                  key={`${currentRow.rowId}-tok-${tIdx}`}
                  className={`recognition-token ${getTokenClass(tok)}`}
                >
                  {tok}
                </span>
              ))}
            </div>
            {hasResult ? (
              <>
                <span className="recognition-arrow">➜</span>
                <span className="recognition-result">{currentRow.result}</span>
              </>
            ) : (
              <span className="recognition-result result-none">(waiting for =)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
