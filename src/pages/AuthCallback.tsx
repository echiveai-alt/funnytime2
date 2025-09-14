import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (data.session) {
          toast({
            title: "Email verified successfully!",
            description: "Welcome to echive.ai",
          });
          navigate("/onboarding/education");
        } else {
          throw new Error("No session found");
        }
      } catch (error: any) {
        console.error("Auth callback error:", error);
        setError(error.message || "Verification failed");
      } finally {
        setIsLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  const handleResendEmail = () => {
    navigate("/signup");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-subtle">
        <Card className="w-full max-w-md p-8 shadow-soft">
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-xl shadow-soft mx-auto mb-6">
              <Brain className="w-8 h-8 text-primary-foreground animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Verifying your email</h1>
            <p className="text-muted-foreground">
              Please wait while we verify your email address...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-subtle">
        <Card className="w-full max-w-md p-8 shadow-soft">
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-xl shadow-soft mx-auto mb-6">
              <Brain className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Verification failed</h1>
            <p className="text-muted-foreground mb-6">
              {error === "Email link is invalid or has expired" 
                ? "Your verification link has expired or is invalid."
                : "There was a problem verifying your email address."
              }
            </p>
            <div className="space-y-3">
              <Button onClick={handleResendEmail} className="w-full">
                Try signing up again
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/")}
                className="w-full"
              >
                Back to home
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return null;
};

export default AuthCallback;