import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createRow, deleteRow, getCurrentUser, listRows, updateRow } from '@/lib/db';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { renderTemplate } from '@/lib/automationUtils';

const typeLabels = {
  initial: 'Initial',
  follow_up_1: 'Follow-up 1',
  follow_up_2: 'Follow-up 2',
  custom: 'Custom',
};

const typeColors = {
  initial: 'bg-blue-50 text-blue-700 border-blue-200',
  follow_up_1: 'bg-amber-50 text-amber-700 border-amber-200',
  follow_up_2: 'bg-purple-50 text-purple-700 border-purple-200',
  custom: 'bg-gray-50 text-gray-600 border-gray-200',
};

const emptyForm = { name: '', template_type: 'initial', subject: '', body: '' };

export default function EmailTemplates() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [previewData, setPreviewData] = useState(null);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => listRows('email_templates', '-created_at'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => (editId
      ? updateRow('email_templates', editId, data)
      : createRow('email_templates', data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm);
      toast.success(editId ? 'Template updated' : 'Template created');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to save template');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteRow('email_templates', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to delete template');
    },
  });

  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (t) => {
    setEditId(t.id);
    setForm({ name: t.name, template_type: t.template_type, subject: t.subject, body: t.body });
    setDialogOpen(true);
  };

  const openPreview = (t) => {
    const sample = {
      contact_name: 'Sarah Johnson',
      company_name: 'TechCorp Inc.',
      role_title: 'Senior Software Engineer',
      user_name: 'Alex Smith',
    };
    setPreviewData(renderTemplate(t, sample));
    setPreviewOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Template name required'); return; }
    if (!form.subject.trim()) { toast.error('Subject required'); return; }
    if (!form.body.trim()) { toast.error('Body required'); return; }
    const user = await getCurrentUser();
    if (!user) {
      toast.error('You are not logged in. Please log in and try again.');
      return;
    }
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Email Templates" description="Create reusable email templates with variable support">
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> New Template</Button>
      </PageHeader>

      <p className="text-xs text-muted-foreground mb-6">
        Available variables: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{contact_name}}'}</code>{' '}
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{company}}'}</code>{' '}
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{role_title}}'}</code>{' '}
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{user_name}}'}</code>
      </p>

      {templates.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No templates yet" description="Create your first email template to get started">
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Create Template</Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <Badge variant="outline" className={`mt-1 text-xs ${typeColors[t.template_type]}`}>
                      {typeLabels[t.template_type]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openPreview(t)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(t)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-1"><span className="font-medium text-foreground">Subject:</span> {t.subject}</p>
                <p className="text-xs text-muted-foreground line-clamp-3">{t.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Template' : 'New Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Initial Application" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.template_type} onValueChange={v => setForm({ ...form, template_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="initial">Initial Application</SelectItem>
                  <SelectItem value="follow_up_1">Follow-up 1</SelectItem>
                  <SelectItem value="follow_up_2">Follow-up 2</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Application for {{role_title}} at {{company}}" />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={8} placeholder={"Dear {{contact_name}},\n\nI'm writing to express my interest in..."} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <p className="text-sm font-medium mt-1 p-3 bg-muted rounded-lg">{previewData.subject}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Body</Label>
                <div className="text-sm mt-1 p-4 bg-muted rounded-lg whitespace-pre-wrap leading-relaxed">
                  {previewData.body}
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Sample values: Sarah Johnson (contact), TechCorp Inc. (company), Senior Software Engineer (role), Alex Smith (user)
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}