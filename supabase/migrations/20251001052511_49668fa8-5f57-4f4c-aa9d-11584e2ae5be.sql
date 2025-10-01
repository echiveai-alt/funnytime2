-- Add field column to education table
ALTER TABLE public.education ADD COLUMN field text;

-- Migrate existing degree data to field column
UPDATE public.education SET field = degree WHERE degree IS NOT NULL;

-- Make degree column nullable and clear it
ALTER TABLE public.education ALTER COLUMN degree DROP NOT NULL;
UPDATE public.education SET degree = NULL;

-- Update column comments
COMMENT ON COLUMN public.education.degree IS 'Degree level: Bachelor''s, Master''s, PhD, Associate, Diploma, Other';
COMMENT ON COLUMN public.education.field IS 'Field of study: e.g., Computer Science, Economics, Mathematics';