import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
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
          // Check if user has completed education onboarding
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("degree, school")
            .eq("user_id", data.session.user.id)
            .single();

          if (profileError && profileError.code !== "PGRST116") {
            console.error("Profile fetch error:", profileError);
            navigate("/onboarding/education");
            return;
          }

          if (profile?.degree && profile?.school) {
            navigate("/app/experiences");
          } else {
            navigate("/onboarding/education");
          }
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
            <Brain className="w-8 h-8 text-primary-foreground animate-pulse" />
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