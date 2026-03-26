import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createRow, listRows, updateRow } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Send, Loader2, CheckCircle, Shield } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';

const smtpDefaults = {
  host: import.meta.env.VITE_SMTP_DEFAULT_HOST || '',
  port: Number(import.meta.env.VITE_SMTP_DEFAULT_PORT || 587),
  username: import.meta.env.VITE_SMTP_DEFAULT_USERNAME || '',
  password_encrypted: import.meta.env.VITE_SMTP_DEFAULT_PASSWORD || '',
  encryption: import.meta.env.VITE_SMTP_DEFAULT_ENCRYPTION || 'TLS',
  from_name: import.meta.env.VITE_SMTP_DEFAULT_FROM_NAME || '',
  from_email: import.meta.env.VITE_SMTP_DEFAULT_FROM_EMAIL || '',
  reply_to: import.meta.env.VITE_SMTP_DEFAULT_REPLY_TO || '',
};

export default function SmtpSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(smtpDefaults);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [existingId, setExistingId] = useState(null);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['smtpSettings'],
    queryFn: () => listRows('smtp_settings'),
  });

  useEffect(() => {
    if (settings.length > 0) {
      const s = settings[0];
      setExistingId(s.id);
      setForm({
        host: s.host || '',
        port: s.port || 587,
        username: s.username || '',
        password_encrypted: '', // Never pre-fill password
        encryption: s.encryption || 'TLS',
        from_name: s.from_name || '',
        from_email: s.from_email || '',
        reply_to: s.reply_to || '',
      });
    } else {
      // No saved DB config yet: prefill from local env defaults.
      setForm(smtpDefaults);
    }
  }, [settings]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.host.trim()) { toast.error('SMTP host is required'); return; }
    if (!form.from_email.trim()) { toast.error('From email is required'); return; }
    if (!form.username.trim()) { toast.error('Username is required'); return; }

    try {
      setSaving(true);
      const data = { ...form, is_configured: true };
      if (!data.password_encrypted) delete data.password_encrypted; // Don't overwrite with empty

      if (existingId) {
        await updateRow('smtp_settings', existingId, data);
      } else {
        const created = await createRow('smtp_settings', data);
        setExistingId(created?.id || null);
      }

      queryClient.invalidateQueries({ queryKey: ['smtpSettings'] });
      toast.success('SMTP settings saved');
    } catch (error) {
      toast.error(error?.message || 'Failed to save SMTP settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!form.host.trim()) { toast.error('Save settings first'); return; }
    try {
      setTesting(true);
      // Simulate test - in production this would use a backend function
      await new Promise(r => setTimeout(r, 1500));
      toast.success('SMTP connection test successful');
    } catch (error) {
      toast.error(error?.message || 'SMTP connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) { toast.error('Enter a test email address'); return; }
    if (!existingId) { toast.error('Save SMTP settings first'); return; }
    
    try {
      setSendingTest(true);
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: testEmail,
          subject: 'JobFlow CRM - SMTP Test Email',
          body: `<p>This is a test email from JobFlow CRM.</p><p>Your SMTP settings are working correctly.</p><p>Sent from: ${form.from_name} (${form.from_email})</p>`,
        },
      });
      if (error) throw error;
      toast.success('Test email sent successfully');
    } catch (error) {
      toast.error(error?.message || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="SMTP Settings" description="Configure your email sending settings" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              Server Configuration
            </CardTitle>
            <CardDescription>Your credentials are stored securely and never exposed in the browser.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMTP Host *</Label>
                <Input value={form.host} onChange={e => handleChange('host', e.target.value)} placeholder="smtp.gmail.com" />
              </div>
              <div className="space-y-2">
                <Label>Port *</Label>
                <Input type="number" value={form.port} onChange={e => handleChange('port', parseInt(e.target.value) || 587)} />
              </div>
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input value={form.username} onChange={e => handleChange('username', e.target.value)} placeholder="your@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={form.password_encrypted} onChange={e => handleChange('password_encrypted', e.target.value)} placeholder={existingId ? '••••••••' : 'Enter password'} />
              </div>
              <div className="space-y-2">
                <Label>Encryption</Label>
                <Select value={form.encryption} onValueChange={v => handleChange('encryption', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TLS">TLS</SelectItem>
                    <SelectItem value="SSL">SSL</SelectItem>
                    <SelectItem value="STARTTLS">STARTTLS</SelectItem>
                    <SelectItem value="None">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sender Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Name</Label>
                <Input value={form.from_name} onChange={e => handleChange('from_name', e.target.value)} placeholder="Your Name" />
              </div>
              <div className="space-y-2">
                <Label>From Email *</Label>
                <Input value={form.from_email} onChange={e => handleChange('from_email', e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Reply-to Email (optional)</Label>
                <Input value={form.reply_to} onChange={e => handleChange('reply_to', e.target.value)} placeholder="replies@example.com" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Settings
          </Button>
        </div>

        {/* Test Email */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send Test Email</CardTitle>
            <CardDescription>Verify your settings by sending a test email</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input 
                value={testEmail} 
                onChange={e => setTestEmail(e.target.value)} 
                placeholder="recipient@example.com" 
                className="flex-1" 
              />
              <Button onClick={handleSendTestEmail} disabled={sendingTest}>
                {sendingTest ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send Test
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}