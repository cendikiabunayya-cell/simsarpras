import React from 'react';
import { cn } from '../../lib/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  color = 'blue',
  onClick,
}) => {
  const colorMap = {
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-100',
      iconBg: 'bg-blue-600 text-white',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-100',
      iconBg: 'bg-emerald-600 text-white',
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-100',
      iconBg: 'bg-amber-600 text-white',
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-100',
      iconBg: 'bg-rose-600 text-white',
    },
    indigo: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-100',
      iconBg: 'bg-indigo-600 text-white',
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-100',
      iconBg: 'bg-purple-600 text-white',
    },
  };

  const scheme = colorMap[color];

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm transition-all duration-200 hover:shadow-md flex flex-col justify-between',
        onClick && 'cursor-pointer hover:border-slate-300'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{title}</p>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
        </div>
        <div className={cn('p-2.5 rounded-lg shrink-0 shadow-sm', scheme.iconBg)}>
          {icon}
        </div>
      </div>
      {subtitle && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center text-xs text-slate-500">
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
};
