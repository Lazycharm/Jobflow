import React from 'react';
import { Card } from '@/components/ui/card';

export default function StatsCard({ label, value, icon: Icon, color = 'text-primary' }) {
  return (
    <Card className="p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-muted ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </div>
    </Card>
  );
}