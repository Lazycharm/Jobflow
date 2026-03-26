import React from 'react';
import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS } from '@/lib/automationUtils';

export default function StatusBadge({ status }) {
  const colorClass = STATUS_COLORS[status] || 'bg-muted text-muted-foreground';
  return (
    <Badge variant="outline" className={`${colorClass} text-xs font-medium border`}>
      {status}
    </Badge>
  );
}