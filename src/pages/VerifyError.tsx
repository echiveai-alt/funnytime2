import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import KeystepLogo from "@/components/KeystepLogo";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const VerifyError = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();
  
  const reason = searchParams.get("reason") || "invalid";
  const errorMessages = {
    expired: "Your verification link has expired.",
    invalid: "Your verification link is invalid or has already been used.",
    error: "There was an error verifying your email address."
  };

  const handleResendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (error) {
        toast({
          title: "Failed to resend email",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setEmailSent(true);
        toast({
          title: "Verification email sent",
          description: "Please check your inbox for the new verification link.",
        });
      }
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-secondary">
        <Card className="w-full max-w-md p-8 shadow-soft">
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-xl shadow-soft mx-auto mb-6">
              <Mail className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Check your inbox</h1>
            <p className="text-muted-foreground mb-6">
              We've sent a new verification link to <strong>{email}</strong>
            </p>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open(`mailto:${email}`, '_blank')}
              >
                Open Mail App
              </Button>
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => setEmailSent(false)}
              >
                Send to Different Email
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-secondary">
      <Card className="w-full max-w-md p-8 shadow-soft">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 bg-destructive rounded-xl shadow-soft mx-auto mb-6">
            <KeystepLogo className="w-12 h-8 text-destructive-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Verification failed</h1>
          <Alert className="mb-6 text-left">
            <AlertDescription>
              {errorMessages[reason as keyof typeof errorMessages]}
            </AlertDescription>
          </Alert>
        </div>

        <form onSubmit={handleResendEmail} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email to resend verification"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Resend verification email"}
          </Button>

          <div className="text-center space-y-2">
            <Link 
              to="/signup" 
              className="block text-sm text-muted-foreground hover:text-foreground transition-smooth"
            >
              Create a new account
            </Link>
            <Link 
              to="/login" 
              className="block text-sm text-muted-foreground hover:text-foreground transition-smooth"
            >
              Already verified? Sign in
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default VerifyError;