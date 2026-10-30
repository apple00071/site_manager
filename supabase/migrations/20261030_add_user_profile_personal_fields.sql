-- Migration: 20261030_add_user_profile_personal_fields.sql
-- Add Date of Birth (DOB), emergency contact number, blood group, and residential address to users table

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS dob DATE,
ADD COLUMN IF NOT EXISTS emergency_contact_number TEXT,
ADD COLUMN IF NOT EXISTS blood_group TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

