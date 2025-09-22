-- Add completion flag for education onboarding
ALTER TABLE public.profiles 
ADD COLUMN education_onboarding_completed BOOLEAN NOT NULL DEFAULT false;