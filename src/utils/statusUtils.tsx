import React from 'react';
import { SubscriberCard } from '../types';
import { CheckCircle2, AlertCircle, Clock, Lock } from 'lucide-react';

export type SubscriberStatusType = 'ACTIVE' | 'PENDING' | 'EXPIRED';

export interface SubscriberStatusDetails {
  type: SubscriberStatusType;
  label: 'Ativo' | 'Pendente' | 'Expirado';
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  daysRemaining?: number;
  daysOverdue?: number;
}

/**
 * Dynamically computes subscriber status based on payment status, 
 * expiration date, and current system date.
 */
export function getSubscriberDynamicStatus(sub: SubscriberCard): SubscriberStatusDetails {
  // Check pending payment status first
  const isPaymentPending = sub.paymentStatus === 'PENDING' || sub.status === 'PAYMENT_PENDING';

  // Parse expiration date
  let expDate: Date | null = null;
  if (sub.expirationDate) {
    if (sub.expirationDate.includes('/')) {
      const parts = sub.expirationDate.split('/');
      if (parts.length === 3) {
        // Format: DD/MM/YYYY
        expDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 23, 59, 59);
      }
    } else if (sub.expirationDate.includes('-')) {
      const parts = sub.expirationDate.split('-');
      if (parts.length === 3) {
        // Format: YYYY-MM-DD
        expDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59);
      }
    }
  }

  const now = new Date();
  let isExpiredByDate = false;
  let daysRemaining: number | undefined = undefined;
  let daysOverdue: number | undefined = undefined;

  if (expDate && !isNaN(expDate.getTime())) {
    const diffTime = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      isExpiredByDate = true;
      daysOverdue = Math.abs(diffDays);
    } else {
      daysRemaining = diffDays;
    }
  }

  // Priority 1: Pending Payment
  if (isPaymentPending) {
    return {
      type: 'PENDING',
      label: 'Pendente',
      badgeBg: 'bg-amber-950/80',
      badgeText: 'text-amber-300',
      badgeBorder: 'border-amber-500/50',
      dotColor: 'bg-amber-400',
    };
  }

  // Priority 2: Expired (either status is explicitly EXPIRED or expiration date is in the past)
  if (sub.status === 'EXPIRED' || isExpiredByDate) {
    return {
      type: 'EXPIRED',
      label: 'Expirado',
      badgeBg: 'bg-rose-950/80',
      badgeText: 'text-rose-300',
      badgeBorder: 'border-rose-500/50',
      dotColor: 'bg-rose-500',
      daysOverdue,
    };
  }

  // Priority 3: Active
  return {
    type: 'ACTIVE',
    label: 'Ativo',
    badgeBg: 'bg-emerald-950/80',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/50',
    dotColor: 'bg-emerald-400',
    daysRemaining,
  };
}

interface SubscriberStatusBadgeProps {
  subscriber: SubscriberCard;
  showDaysDetail?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SubscriberStatusBadge: React.FC<SubscriberStatusBadgeProps> = ({
  subscriber,
  showDaysDetail = false,
  size = 'md',
  className = '',
}) => {
  const statusInfo = getSubscriberDynamicStatus(subscriber);

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[9px] gap-1',
    md: 'px-2 py-0.5 text-[10px] gap-1.5',
    lg: 'px-2.5 py-1 text-xs gap-1.5',
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
  };

  return (
    <span
      className={`inline-flex items-center font-bold font-mono uppercase tracking-wider rounded-md border ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.badgeBorder} ${sizeClasses[size]} ${className}`}
      title={`Plano ${statusInfo.label} - Expira em: ${subscriber.expirationDate || 'N/A'}`}
    >
      {/* Pulsing status dot */}
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusInfo.dotColor} opacity-75`}></span>
        <span className={`relative inline-flex rounded-full h-2 w-2 ${statusInfo.dotColor}`}></span>
      </span>

      {/* Status Icon */}
      {statusInfo.type === 'ACTIVE' && <CheckCircle2 className={iconSizes[size]} />}
      {statusInfo.type === 'PENDING' && <Lock className={iconSizes[size]} />}
      {statusInfo.type === 'EXPIRED' && <Clock className={iconSizes[size]} />}

      <span>{statusInfo.label}</span>

      {showDaysDetail && statusInfo.type === 'ACTIVE' && statusInfo.daysRemaining !== undefined && (
        <span className="text-[9px] opacity-80 font-normal lowercase">
          ({statusInfo.daysRemaining}d)
        </span>
      )}

      {showDaysDetail && statusInfo.type === 'EXPIRED' && statusInfo.daysOverdue !== undefined && (
        <span className="text-[9px] opacity-80 font-normal lowercase">
          (-{statusInfo.daysOverdue}d)
        </span>
      )}
    </span>
  );
};
