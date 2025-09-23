UPDATE profiles 
SET education_onboarding_completed = true 
WHERE user_id = 'f25f6cdf-6753-4d00-bcd9-88b90a244b45' 
AND (degree IS NOT NULL OR school IS NOT NULL OR graduation_date IS NOT NULL);