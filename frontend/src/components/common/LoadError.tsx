import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface LoadErrorProps {
  message: string;
  onRetry: () => void;
}

export const LoadError: React.FC<LoadErrorProps> = ({ message, onRetry }) => (
  <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900">
    <AlertCircle className="h-8 w-8 text-rose-600" />
    <p className="text-sm font-semibold">{message}</p>
    <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800">
      <RotateCcw className="h-3.5 w-3.5" /> Retry
    </button>
  </div>
);
