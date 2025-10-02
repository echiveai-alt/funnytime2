-- Rename free_bullets_used to free_analyses_used to track total analyses
ALTER TABLE public.profiles
RENAME COLUMN free_bullets_used TO free_analyses_used;

-- Add comment to clarify this tracks job analyses
COMMENT ON COLUMN public.profiles.free_analyses_used IS 'Tracks the number of free job analyses used (max 10 for free users)';