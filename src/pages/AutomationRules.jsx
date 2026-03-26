import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createRow, listRows, updateRow } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Save, Loader2, Zap, Clock, Shield, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';

export default function AutomationRules() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    followup1_delay_days: 3,
    followup2_delay_days: 7,
    business_days_only: true,
    daily_send_limit: 20,
    duplicate_protection: true,
    auto_stop_on_reply: true,
    send_time_hour: 9,
  });
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automationRules'],
    queryFn: () => listRows('automation_rules'),
  });

  useEffect(() => {
    if (rules.length > 0) {
      const r = rules[0];
      setExistingId(r.id);
      setForm({
        followup1_delay_days: r.followup1_delay_days ?? 3,
        followup2_delay_days: r.followup2_delay_days ?? 7,
        business_days_only: r.business_days_only !== false,
        daily_send_limit: r.daily_send_limit ?? 20,
        duplicate_protection: r.duplicate_protection !== false,
        auto_stop_on_reply: r.auto_stop_on_reply !== false,
        send_time_hour: r.send_time_hour ?? 9,
      });
    }
  }, [rules]);

  const handleSave = async () => {
    if (form.followup1_delay_days < 1) { toast.error('Follow-up 1 delay must be at least 1 day'); return; }
    if (form.followup2_delay_days <= form.followup1_delay_days) { toast.error('Follow-up 2 delay must be greater than Follow-up 1'); return; }
    if (form.daily_send_limit < 1 || form.daily_send_limit > 50) { toast.error('Daily limit must be between 1 and 50'); return; }
    
    try {
      setSaving(true);
      if (existingId) {
        await updateRow('automation_rules', existingId, form);
      } else {
        const created = await createRow('automation_rules', form);
        setExistingId(created?.id || null);
      }
      queryClient.invalidateQueries({ queryKey: ['automationRules'] });
      toast.success('Automation rules saved');
    } catch (error) {
      toast.error(error?.message || 'Failed to save automation rules');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Automation Rules" description="Configure how follow-up emails are scheduled and sent" />

      <div className="space-y-6">
        {/* Follow-up Timing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Follow-up Schedule
            </CardTitle>
            <CardDescription>Set the delay between emails in business days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Follow-up 1 Delay (days)</Label>
                <Input 
                  type="number" min={1} max={30}
                  value={form.followup1_delay_days} 
                  onChange={e => setForm({...form, followup1_delay_days: parseInt(e.target.value) || 3})} 
                />
                <p className="text-xs text-muted-foreground">Business days after initial send</p>
              </div>
              <div className="space-y-2">
                <Label>Follow-up 2 Delay (days)</Label>
                <Input 
                  type="number" min={2} max={60}
                  value={form.followup2_delay_days} 
                  onChange={e => setForm({...form, followup2_delay_days: parseInt(e.target.value) || 7})} 
                />
                <p className="text-xs text-muted-foreground">Business days after initial send</p>
              </div>
              <div className="space-y-2">
                <Label>Send Time (hour, 24h)</Label>
                <Input 
                  type="number" min={6} max={20}
                  value={form.send_time_hour} 
                  onChange={e => setForm({...form, send_time_hour: parseInt(e.target.value) || 9})} 
                />
                <p className="text-xs text-muted-foreground">e.g. 9 = 9:00 AM</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Safety Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" /> Safety & Guardrails
            </CardTitle>
            <CardDescription>Protections to ensure professional outreach behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label>Business Days Only</Label>
                <p className="text-xs text-muted-foreground">Skip weekends when scheduling</p>
              </div>
              <Switch checked={form.business_days_only} onCheckedChange={v => setForm({...form, business_days_only: v})} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Duplicate Protection</Label>
                <p className="text-xs text-muted-foreground">Max 1 email per contact per business day</p>
              </div>
              <Switch checked={form.duplicate_protection} onCheckedChange={v => setForm({...form, duplicate_protection: v})} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-stop on Reply</Label>
                <p className="text-xs text-muted-foreground">Stop all follow-ups when reply is detected</p>
              </div>
              <Switch checked={form.auto_stop_on_reply} onCheckedChange={v => setForm({...form, auto_stop_on_reply: v})} />
            </div>
            <div className="space-y-2">
              <Label>Daily Send Limit</Label>
              <Input 
                type="number" min={1} max={50}
                value={form.daily_send_limit} 
                onChange={e => setForm({...form, daily_send_limit: parseInt(e.target.value) || 20})} 
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">Maximum emails sent per day across all applications</p>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="pt-5">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Professional Outreach Behavior</p>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  The system enforces a maximum of 2 follow-ups per application. After the second follow-up,
                  no more automated emails will be sent. Automation stops immediately when a reply is detected,
                  or when the application status changes to Interview, Rejected, or Closed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Rules
          </Button>
        </div>
      </div>
    </div>
  );
}