-- Migration to update notifications_type_check constraint
-- Run this in Supabase SQL Editor

ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'task_assigned',
  'design_approved',
  'design_rejected',
  'design_uploaded',
  'project_update',
  'inventory_added',
  'comment_added',
  'bill_approved',
  'bill_rejected',
  'bill_resubmitted',
  'snag_created',
  'snag_assigned',
  'snag_resolved',
  'snag_verified',
  'snag_comment',
  'proposal_sent',
  'proposal_approved',
  'proposal_rejected',
  'invoice_created',
  'invoice_approved',
  'invoice_rejected',
  'mention',
  'general',
  'expense_created',
  'expense_approved',
  'site_log_submitted',
  'report_generated',
  'payment_recorded',
  'expense_rejected'
));
