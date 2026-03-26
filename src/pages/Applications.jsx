import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { filterRows, listRows, updateRow } from '@/lib/db';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, MoreHorizontal, Pause, Play, CheckCircle, XCircle, Calendar, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { getStageLabel } from '@/lib/automationUtils';

export default function Applications() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [repliedFilter, setRepliedFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => listRows('job_applications', '-created_at'),
  });

  const handleStatusChange = async (app, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === 'Replied') {
      updates.replied = true;
      updates.replied_at = new Date().toISOString();
      updates.automation_enabled = false;
    }
    if (['Interview', 'Rejected', 'Closed'].includes(newStatus)) {
      updates.automation_enabled = false;
    }
    await updateRow('job_applications', app.id, updates);
    queryClient.invalidateQueries({ queryKey: ['applications'] });

    // Cancel pending scheduled emails when stopping automation
    if (['Replied', 'Interview', 'Rejected', 'Closed'].includes(newStatus)) {
      const scheduled = await filterRows('scheduled_emails', { application_id: app.id, status: 'pending' }, 'scheduled_for');
      for (const sched of scheduled) {
        await updateRow('scheduled_emails', sched.id, { status: 'cancelled' });
      }
    }

    toast.success(`Status updated to ${newStatus}`);
  };

  const toggleAutomation = async (app) => {
    const newVal = !app.automation_enabled;
    await updateRow('job_applications', app.id, { automation_enabled: newVal });
    queryClient.invalidateQueries({ queryKey: ['applications'] });
    
    if (!newVal) {
      const scheduled = await filterRows('scheduled_emails', { application_id: app.id, status: 'pending' }, 'scheduled_for');
      for (const sched of scheduled) {
        await updateRow('scheduled_emails', sched.id, { status: 'cancelled' });
      }
    }
    
    toast.success(newVal ? 'Automation resumed' : 'Automation paused');
  };

  const filtered = useMemo(() => {
    return applications.filter(app => {
      const matchSearch = !search || 
        app.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        app.role_title?.toLowerCase().includes(search.toLowerCase()) ||
        app.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
        app.contact_email?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || app.status === statusFilter;
      const matchReplied = repliedFilter === 'all' || 
        (repliedFilter === 'replied' && app.replied) || 
        (repliedFilter === 'not_replied' && !app.replied);
      return matchSearch && matchStatus && matchReplied;
    });
  }, [applications, search, statusFilter, repliedFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Applications" description="Manage your job applications">
        <Link to="/applications/new">
          <Button><Plus className="w-4 h-4 mr-2" /> New Application</Button>
        </Link>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search company, role, contact..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Scheduled">Scheduled</SelectItem>
            <SelectItem value="Sent">Sent</SelectItem>
            <SelectItem value="Replied">Replied</SelectItem>
            <SelectItem value="Interview">Interview</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={repliedFilter} onValueChange={setRepliedFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Reply Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="not_replied">No Reply</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState 
            title="No applications found" 
            description={applications.length === 0 ? "Create your first job application to get started" : "Try adjusting your filters"}
          >
            {applications.length === 0 && (
              <Link to="/applications/new">
                <Button><Plus className="w-4 h-4 mr-2" /> Add Application</Button>
              </Link>
            )}
          </EmptyState>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Stage</TableHead>
                  <TableHead className="hidden lg:table-cell">Next Send</TableHead>
                  <TableHead className="hidden md:table-cell">Replied</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(app => (
                  <TableRow key={app.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{app.company_name}</TableCell>
                    <TableCell className="text-sm">{app.role_title}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {app.contact_name || app.contact_email}
                    </TableCell>
                    <TableCell><StatusBadge status={app.status} /></TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {getStageLabel(app.follow_up_stage || 0)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {app.next_scheduled_at ? format(new Date(app.next_scheduled_at), 'MMM d, h:mm a') : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {app.replied ? (
                        <span className="text-xs text-purple-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-8 h-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/applications/${app.id}`} className="flex items-center gap-2">
                              <Eye className="w-3.5 h-3.5" /> View / Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toggleAutomation(app)} className="flex items-center gap-2">
                            {app.automation_enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            {app.automation_enabled ? 'Pause Automation' : 'Resume Automation'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(app, 'Replied')} className="flex items-center gap-2">
                            <CheckCircle className="w-3.5 h-3.5" /> Mark Replied
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(app, 'Interview')} className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" /> Mark Interview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(app, 'Rejected')} className="flex items-center gap-2 text-destructive">
                            <XCircle className="w-3.5 h-3.5" /> Mark Rejected
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}