import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { filterRows, getCurrentUserProfile, listRows } from '@/lib/db';
import { Link } from 'react-router-dom';
import { 
  Briefcase, Clock, Send, MessageSquare, Calendar, 
  XCircle, Archive, AlertCircle, ArrowRight 
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import StatsCard from '@/components/shared/StatsCard';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';

export default function Dashboard() {
  const { data: applications = [], isLoading: loadingApps } = useQuery({
    queryKey: ['applications'],
    queryFn: () => listRows('job_applications', '-created_at'),
  });

  const { data: scheduled = [], isLoading: loadingSched } = useQuery({
    queryKey: ['scheduled'],
    queryFn: () => filterRows('scheduled_emails', { status: 'pending' }, 'scheduled_for', 10),
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUserProfile,
  });

  const stats = {
    total: applications.length,
    scheduled: applications.filter(a => a.status === 'Scheduled').length,
    sent: applications.filter(a => a.status === 'Sent').length,
    replied: applications.filter(a => a.status === 'Replied').length,
    interview: applications.filter(a => a.status === 'Interview').length,
    rejected: applications.filter(a => a.status === 'Rejected').length,
    closed: applications.filter(a => a.status === 'Closed').length,
  };

  const needsAttention = applications.filter(a => 
    a.status === 'Sent' && !a.replied && !a.automation_enabled
  );

  const recentReplies = applications
    .filter(a => a.replied)
    .sort((a, b) => {
      const bTime = new Date(b.replied_at || b.updated_at).getTime();
      const aTime = new Date(a.replied_at || a.updated_at).getTime();
      return bTime - aTime;
    })
    .slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader 
        title={`Welcome back${user?.full_name ? `, ${user.full_name}` : ''}`}
        description="Your job application pipeline at a glance"
      >
        <Link to="/applications/new">
          <Button>New Application</Button>
        </Link>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-8">
        <StatsCard label="Total" value={stats.total} icon={Briefcase} />
        <StatsCard label="Scheduled" value={stats.scheduled} icon={Clock} color="text-blue-600" />
        <StatsCard label="Sent" value={stats.sent} icon={Send} color="text-emerald-600" />
        <StatsCard label="Replied" value={stats.replied} icon={MessageSquare} color="text-purple-600" />
        <StatsCard label="Interview" value={stats.interview} icon={Calendar} color="text-amber-600" />
        <StatsCard label="Rejected" value={stats.rejected} icon={XCircle} color="text-red-500" />
        <StatsCard label="Closed" value={stats.closed} icon={Archive} color="text-gray-500" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Scheduled */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Upcoming Emails</CardTitle>
              <Link to="/applications" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {scheduled.length === 0 ? (
              <EmptyState icon={Clock} title="No upcoming emails" description="Scheduled emails will appear here" />
            ) : (
              <div className="space-y-3">
                {scheduled.slice(0, 5).map(sched => {
                  const app = applications.find(a => a.id === sched.application_id);
                  return (
                    <div key={sched.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{app?.company_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{app?.role_title} · {sched.stage?.replace('_', ' ')}</p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap ml-3">
                        {format(new Date(sched.scheduled_for), 'MMM d, h:mm a')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Replies */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Replies</CardTitle>
              <Link to="/replies" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentReplies.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No replies yet" description="Replies will show here when detected" />
            ) : (
              <div className="space-y-3">
                {recentReplies.map(app => (
                  <div key={app.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{app.company_name}</p>
                      <p className="text-xs text-muted-foreground">{app.role_title} · {app.contact_name}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Needs Attention */}
        {needsAttention.length > 0 && (
          <Card className="lg:col-span-2 border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {needsAttention.slice(0, 5).map(app => (
                  <div key={app.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{app.company_name} — {app.role_title}</p>
                      <p className="text-xs text-muted-foreground">Automation paused, no reply yet</p>
                    </div>
                    <Link to={`/applications/${app.id}`}>
                      <Button variant="outline" size="sm">Review</Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}