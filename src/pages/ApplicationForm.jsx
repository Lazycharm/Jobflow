import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createRow, filterRows, getCurrentUserProfile, listRows, updateRow } from '@/lib/db';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Send, ArrowLeft, Loader2, Paperclip } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { calculateFollowUpDate, renderTemplate } from '@/lib/automationUtils';

export default function ApplicationForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const editId = window.location.pathname.split('/').pop();
  const isNew = editId === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    company_name: '',
    role_title: '',
    contact_name: '',
    contact_email: '',
    job_link: '',
    source: '',
    notes: '',
    initial_template_id: '',
    followup1_template_id: '',
    followup2_template_id: '',
    cv_url: '',
    automation_enabled: true,
    status: 'Draft',
  });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => listRows('email_templates'),
  });

  const { data: resumes = [] } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => listRows('resumes', '-created_at'),
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['automationRules'],
    queryFn: () => listRows('automation_rules'),
  });

  const { data: existingApp } = useQuery({
    queryKey: ['application', editId],
    queryFn: () => filterRows('job_applications', { id: editId }),
    enabled: !isNew,
  });

  // Pre-select default resume for new applications
  useEffect(() => {
    if (isNew && resumes.length > 0 && !form.cv_url) {
      const def = resumes.find(r => r.is_default) || resumes[0];
      if (def) handleChange('cv_url', def.file_url);
    }
  }, [resumes, isNew]);

  useEffect(() => {
    if (existingApp && existingApp.length > 0) {
      const app = existingApp[0];
      setForm({
        company_name: app.company_name || '',
        role_title: app.role_title || '',
        contact_name: app.contact_name || '',
        contact_email: app.contact_email || '',
        job_link: app.job_link || '',
        source: app.source || '',
        notes: app.notes || '',
        initial_template_id: app.initial_template_id || '',
        followup1_template_id: app.followup1_template_id || '',
        followup2_template_id: app.followup2_template_id || '',
        cv_url: app.cv_url || '',
        automation_enabled: app.automation_enabled !== false,
        status: app.status || 'Draft',
      });
    }
  }, [existingApp]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!form.company_name.trim()) { toast.error('Company name is required'); return false; }
    if (!form.role_title.trim()) { toast.error('Role title is required'); return false; }
    if (!form.contact_email.trim()) { toast.error('Contact email is required'); return false; }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(form.contact_email)) { toast.error('Invalid email address'); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    if (isNew) {
      await createRow('job_applications', form);
      toast.success('Application saved as draft');
    } else {
      await updateRow('job_applications', editId, form);
      toast.success('Application updated');
    }
    queryClient.invalidateQueries({ queryKey: ['applications'] });
    setSaving(false);
    navigate('/applications');
  };

  const handleSendNow = async () => {
    if (!validate()) return;
    if (!form.initial_template_id) {
      toast.error('Please select an initial email template');
      return;
    }
    setSending(true);

    const user = await getCurrentUserProfile();
    const template = templates.find(t => t.id === form.initial_template_id);
    const rendered = renderTemplate(template, { ...form, user_name: user?.full_name || '' });

    let appId = editId;
    if (isNew) {
      const created = await createRow('job_applications', {
        ...form,
        status: 'Sent',
        follow_up_stage: 0,
        last_sent_at: new Date().toISOString(),
      });
      appId = created.id;
    } else {
      await updateRow('job_applications', editId, {
        ...form,
        status: 'Sent',
        follow_up_stage: 0,
        last_sent_at: new Date().toISOString(),
      });
    }

    // Record the sent email
    await createRow('email_messages', {
      application_id: appId,
      template_id: form.initial_template_id,
      direction: 'outbound',
      subject: rendered.subject,
      body: rendered.body,
      sent_at: new Date().toISOString(),
      status: 'sent',
      stage: 'initial',
    });

    // Schedule follow-up 1 if automation enabled
    if (form.automation_enabled && form.followup1_template_id) {
      const rule = rules[0] || { followup1_delay_days: 3, send_time_hour: 9 };
      const fu1Date = calculateFollowUpDate(new Date(), rule.followup1_delay_days || 3, rule.send_time_hour || 9);
      await createRow('scheduled_emails', {
        application_id: appId,
        template_id: form.followup1_template_id,
        scheduled_for: fu1Date.toISOString(),
        stage: 'follow_up_1',
        status: 'pending',
        attempts: 0,
      });
      await updateRow('job_applications', appId, {
        next_scheduled_at: fu1Date.toISOString(),
      });
    }

    toast.success('Application email sent successfully');
    queryClient.invalidateQueries({ queryKey: ['applications'] });
    queryClient.invalidateQueries({ queryKey: ['scheduled'] });
    setSending(false);
    navigate('/applications');
  };

  const initialTemplates = templates.filter(t => t.template_type === 'initial' || t.template_type === 'custom');
  const fu1Templates = templates.filter(t => t.template_type === 'follow_up_1' || t.template_type === 'custom');
  const fu2Templates = templates.filter(t => t.template_type === 'follow_up_2' || t.template_type === 'custom');

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title={isNew ? 'New Application' : 'Edit Application'}>
        <Button variant="outline" onClick={() => navigate('/applications')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </PageHeader>

      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input value={form.company_name} onChange={e => handleChange('company_name', e.target.value)} placeholder="e.g. Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label>Role Title *</Label>
                <Input value={form.role_title} onChange={e => handleChange('role_title', e.target.value)} placeholder="e.g. Senior Developer" />
              </div>
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input value={form.contact_name} onChange={e => handleChange('contact_name', e.target.value)} placeholder="e.g. Jane Smith" />
              </div>
              <div className="space-y-2">
                <Label>Contact Email *</Label>
                <Input type="email" value={form.contact_email} onChange={e => handleChange('contact_email', e.target.value)} placeholder="e.g. jane@acme.com" />
              </div>
              <div className="space-y-2">
                <Label>Job Link</Label>
                <Input value={form.job_link} onChange={e => handleChange('job_link', e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Input value={form.source} onChange={e => handleChange('source', e.target.value)} placeholder="e.g. LinkedIn, Indeed" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} placeholder="Additional notes..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Email Templates */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Email Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Initial Email Template</Label>
              <Select value={form.initial_template_id} onValueChange={v => handleChange('initial_template_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  {initialTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Follow-up 1 Template</Label>
                <Select value={form.followup1_template_id} onValueChange={v => handleChange('followup1_template_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>
                    {fu1Templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Follow-up 2 Template</Label>
                <Select value={form.followup2_template_id} onValueChange={v => handleChange('followup2_template_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>
                    {fu2Templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* CV Attachment */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" /> Attach Resume / CV
              </Label>
              {resumes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No resumes uploaded yet.{' '}
                  <a href="/resumes" className="text-primary underline underline-offset-2">Upload one here</a>.
                </p>
              ) : (
                <Select value={form.cv_url || 'none'} onValueChange={v => handleChange('cv_url', v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No CV attached" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No CV attached</SelectItem>
                    {resumes.map(r => (
                      <SelectItem key={r.id} value={r.file_url}>
                        {r.name}{r.is_default ? ' ★' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <Label>Enable Automation</Label>
                <p className="text-xs text-muted-foreground">Automatically send follow-ups if no reply</p>
              </div>
              <Switch checked={form.automation_enabled} onCheckedChange={v => handleChange('automation_enabled', v)} />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save as Draft
          </Button>
          <Button onClick={handleSendNow} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Now
          </Button>
        </div>
      </div>
    </div>
  );
}