import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const norm = status?.toUpperCase().replace(/\s+/g, '_') || 'UNKNOWN';

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  // Green / Success
  if (['APPROVED', 'PAID', 'ACTIVE', 'AVAILABLE', 'COMPLETED', 'ON_TIME', 'ALLOWED'].includes(norm)) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  // Amber / Pending / In-progress
  else if (['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'OTP_GENERATED'].includes(norm)) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  }
  // Blue / Active inside
  else if (['INSIDE', 'OCCUPIED'].includes(norm)) {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  }
  // Red / Error / Danger / Violation
  else if (['REJECTED', 'OVERDUE', 'FAILED', 'DENIED', 'EXPIRED', 'OVERSTAY', 'LATE', 'MAINTENANCE'].includes(norm)) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  }
  // Purple / Special
  else if (['WAIVED'].includes(norm)) {
    colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
  }
  // Gray / Inactive
  else if (['WITHDRAWN', 'CANCELLED', 'VACATED', 'REALLOCATED', 'DRAFT'].includes(norm)) {
    colorClasses = 'bg-slate-100 text-slate-600 border-slate-200';
  }

  const label = status?.replace(/_/g, ' ') || 'Unknown';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide uppercase ${colorClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {label}
    </span>
  );
};
