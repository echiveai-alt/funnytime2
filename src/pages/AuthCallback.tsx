import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import KeystepLogo from "@/components/KeystepLogo";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth callback error:", error);
          const errorType = error.message.includes("expired") ? "expired" : 
                           error.message.includes("invalid") ? "invalid" : "error";
          navigate(`/verify/error?reason=${errorType}`);
          return;
        }

        if (data?.session?.user) {
          // Wait a moment for the profile creation trigger to complete
          let profileCheckAttempts = 0;
          const maxAttempts = 5;
          
          const checkProfile = async (): Promise<void> => {
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("education_onboarding_completed, email_verified_at")
              .eq("user_id", data.session.user.id)
              .maybeSingle();

            // If profile doesn't exist yet and we haven't exceeded max attempts, retry
            if (!profile && profileCheckAttempts < maxAttempts) {
              profileCheckAttempts++;
              setTimeout(checkProfile, 1000); // Wait 1 second before retry
              return;
            }

            if (profileError && profileError.code !== "PGRST116") {
              console.error("Profile fetch error:", profileError);
              navigate("/onboarding/education");
              return;
            }

            // If profile exists and education onboarding is completed, go to experiences
            if (profile?.education_onboarding_completed) {
              toast({
                title: "Welcome back!",
                description: "Your account has been verified successfully.",
              });
              navigate("/app/experiences");
            } else {
              // Profile exists but education onboarding not completed, go to onboarding
              toast({
                title: "Email verified!",
                description: "Let's complete your profile setup.",
              });
              navigate("/onboarding/education");
            }
          };

          await checkProfile();
        } else {
          navigate("/verify/error?reason=invalid");
        }
      } catch (error) {
        console.error("Unexpected auth callback error:", error);
        navigate("/verify/error?reason=error");
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-secondary">
      <Card className="w-full max-w-md p-8 shadow-soft">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-xl shadow-soft mx-auto mb-6">
            <KeystepLogo className="w-12 h-5 text-primary-foreground animate-pulse relative left-[3px]" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Verifying your email</h1>
          <p className="text-muted-foreground">
            Please wait while we confirm your account...
          </p>
        </div>
      </Card>
    </div>
  );
};

export default AuthCallback;