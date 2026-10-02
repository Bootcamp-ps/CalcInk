import React from 'react';

interface StatusBarProps {
  tokens: string[];
  result: string;
  isRecognizing: boolean;
  confidence: number | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  tokens,
  result,
  isRecognizing,
  confidence,
}) => {
  return (
    <div className="status-bar">
      <div className="status-section">
        <span className="status-label">Recognized:</span>
        <span className="status-tokens">
          {tokens.length > 0
            ? tokens.join(' ')
            : <span className="status-placeholder">Draw something…</span>
          }
        </span>
      </div>

      {result && (
        <div className="status-section">
          <span className="status-label">Result:</span>
          <span className={`status-result ${result === 'Undefined' ? 'status-error' : ''}`}>
            {result}
          </span>
        </div>
      )}

      <div className="status-section status-right">
        {isRecognizing && (
          <span className="status-recognizing">
            <span className="spinner" />
            Recognizing…
          </span>
        )}
        {confidence !== null && !isRecognizing && (
          <span className="status-confidence">
            Confidence: {Math.round(confidence * 100)}%
          </span>
        )}
      </div>
    </div>
  );
};
