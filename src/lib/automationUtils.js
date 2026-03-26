import { addDays, isWeekend, format } from 'date-fns';

/**
 * Calculate the next business day from a given date, skipping weekends.
 */
export function getNextBusinessDay(date) {
  let d = new Date(date);
  while (isWeekend(d)) {
    d = addDays(d, 1);
  }
  return d;
}

/**
 * Add N business days to a date.
 */
export function addBusinessDays(date, days) {
  let d = new Date(date);
  let added = 0;
  while (added < days) {
    d = addDays(d, 1);
    if (!isWeekend(d)) {
      added++;
    }
  }
  return d;
}

/**
 * Calculate the scheduled date for a follow-up based on the last sent date and delay in business days.
 */
export function calculateFollowUpDate(lastSentDate, delayBusinessDays, sendHour = 9) {
  const nextDate = addBusinessDays(new Date(lastSentDate), delayBusinessDays);
  nextDate.setHours(sendHour, 0, 0, 0);
  return nextDate;
}

/**
 * Check if an application is eligible for automation.
 */
export function isEligibleForAutomation(application) {
  const stopStatuses = ['Replied', 'Interview', 'Rejected', 'Closed'];
  if (stopStatuses.includes(application.status)) return false;
  if (!application.automation_enabled) return false;
  if (application.replied) return false;
  if (application.follow_up_stage >= 2) return false;
  return true;
}

/**
 * Check if we already sent to this contact today (duplicate protection).
 */
export function wasSentToday(lastSentAt) {
  if (!lastSentAt) return false;
  const today = format(new Date(), 'yyyy-MM-dd');
  const sentDay = format(new Date(lastSentAt), 'yyyy-MM-dd');
  return today === sentDay;
}

/**
 * Render template variables with application data.
 */
export function renderTemplate(template, data) {
  if (!template) return { subject: '', body: '' };
  
  const variables = {
    '{{contact_name}}': data.contact_name || 'Hiring Manager',
    '{{company}}': data.company_name || '',
    '{{role_title}}': data.role_title || '',
    '{{user_name}}': data.user_name || '',
  };

  let subject = template.subject || '';
  let body = template.body || '';

  Object.entries(variables).forEach(([key, value]) => {
    subject = subject.split(key).join(value);
    body = body.split(key).join(value);
  });

  return { subject, body };
}

/**
 * Get the stage label for display.
 */
export function getStageLabel(stage) {
  const labels = {
    0: 'Initial',
    1: 'Follow-up 1',
    2: 'Follow-up 2',
  };
  return labels[stage] || `Stage ${stage}`;
}

/**
 * Status color mapping.
 */
export const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  Sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Replied: 'bg-purple-50 text-purple-700 border-purple-200',
  Interview: 'bg-amber-50 text-amber-700 border-amber-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
  Closed: 'bg-gray-50 text-gray-600 border-gray-200',
};