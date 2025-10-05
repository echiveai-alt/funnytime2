-- Create a function to check if an email is already registered and verified
-- This function can be called from the client to validate before signup
CREATE OR REPLACE FUNCTION public.is_email_verified(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if a user exists with this email and has verified their email
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE email = email_to_check 
    AND email_confirmed_at IS NOT NULL
  );
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.is_email_verified(text) TO authenticated, anon;
