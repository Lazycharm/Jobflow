import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { filterRows, listRows } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { MessageSquare, CheckCircle, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';

export default function Replies() {
  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => listRows('job_applications', '-updated_at'),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages'],
    queryFn: () => filterRows('email_messages', { direction: 'inbound' }, '-created_at'),
  });

  const repliedApps = applications.filter(a => a.replied);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Replies" description="Track replies and updated application statuses" />

      {repliedApps.length === 0 && messages.length === 0 ? (
        <Card className="p-6">
          <EmptyState 
            icon={MessageSquare} 
            title="No replies detected" 
            description="When you mark an application as replied or receive a response, it will appear here. Use the 'Mark Replied' action on any application."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Replied At</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repliedApps.map(app => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.company_name}</TableCell>
                    <TableCell className="text-sm">{app.role_title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.contact_name || app.contact_email}
                    </TableCell>
                    <TableCell><StatusBadge status={app.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.replied_at ? format(new Date(app.replied_at), 'MMM d, yyyy h:mm a') : '—'}
                    </TableCell>
                    <TableCell>
                      <Link to={`/applications/${app.id}`}>
                        <Button variant="ghost" size="icon" className="w-8 h-8">
                          <LinkIcon className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Inbound Messages */}
      {messages.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Inbound Messages</h2>
          <div className="space-y-3">
            {messages.map(msg => {
              const app = applications.find(a => a.id === msg.application_id);
              return (
                <Card key={msg.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{msg.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {app ? `${app.company_name} · ${app.role_title}` : 'Unknown application'}
                      </p>
                      {msg.received_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Received {format(new Date(msg.received_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      )}
                    </div>
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}