-- Add subscription and trial tracking fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS free_bullets_used INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_free_access BOOLEAN NOT NULL DEFAULT false;