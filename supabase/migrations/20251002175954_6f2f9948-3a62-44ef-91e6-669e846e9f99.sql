-- Add column to track free bullet point generations separately from analyses
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS free_bullets_generated integer NOT NULL DEFAULT 0;