-- Drop the existing trigger that creates profiles immediately on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a new function to handle verified user profile creation
CREATE OR REPLACE FUNCTION public.handle_verified_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only create profile if user is verified and profile doesn't exist
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    INSERT INTO public.profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for verified users only
CREATE TRIGGER on_auth_user_verified
  AFTER UPDATE ON auth.users
  FOR EACH ROW 
  WHEN (NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL)
  EXECUTE FUNCTION public.handle_verified_user();

-- Add email verification tracking to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified_at timestamp with time zone DEFAULT NULL;

-- Create trigger to update email_verified_at when profile is created for verified user
CREATE OR REPLACE FUNCTION public.update_profile_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_verified_at timestamp with time zone;
BEGIN
  -- Get the user's email verification time
  SELECT email_confirmed_at INTO user_verified_at
  FROM auth.users
  WHERE id = NEW.user_id;
  
  -- Set the email_verified_at to match the user's verification time
  NEW.email_verified_at = user_verified_at;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profile_verification
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_verification();