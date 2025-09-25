import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Brain, Eye, EyeOff, Check, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one symbol");

const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: passwordSchema,
});

type SignUpFormData = z.infer<typeof signUpSchema>;

const SignUp = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [resendAttempts, setResendAttempts] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const password = watch("password", "");

  const getPasswordStrength = (password: string) => {
    const checks = [
      { test: password.length >= 12, label: "At least 12 characters" },
      { test: /[0-9]/.test(password), label: "One number" },
      { test: /[^A-Za-z0-9]/.test(password), label: "One symbol" },
    ];
    return checks;
  };

  const onSubmit = async (data: SignUpFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setUserEmail(data.email);
        setEmailSent(true);
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

  const handleResendVerification = async () => {
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
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
        setResendAttempts(prev => prev + 1);
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
      setResendLoading(false);
    }
  };

  const getResendErrorMessage = () => {
    if (resendAttempts === 1) {
      return "Please check if the provided email address is correct.";
    } else if (resendAttempts === 2) {
      return "Please check your spam and other inboxes.";
    }
    return null;
  };

  if (emailSent) {
    return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-secondary">
      <Card className="w-full max-w-md p-8 shadow-soft">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-xl shadow-soft mx-auto mb-6">
            <Brain className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Check your inbox</h1>
          <p className="text-muted-foreground mb-6">
            We've sent a verification link to <strong>{userEmail}</strong>
          </p>
          {getResendErrorMessage() && (
            <Alert className="mb-4 border-destructive bg-destructive/10">
              <AlertDescription className="text-destructive">
                {getResendErrorMessage()}
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleResendVerification}
              disabled={resendLoading || resendAttempts >= 3}
            >
              {resendLoading ? "Sending..." : "Resend Verification"}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full"
              onClick={() => {
                setEmailSent(false);
                setResendAttempts(0);
              }}
            >
              Change Email
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
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-xl shadow-soft mx-auto mb-6">
            <Brain className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Sign up</h1>
          <p className="text-muted-foreground">
            We'll email a verification link to confirm your address.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoFocus
              {...register("email")}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                {...register("password")}
                className={errors.password ? "border-destructive pr-10" : "pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {password && (
              <div className="space-y-2 mt-3">
                {getPasswordStrength(password).map((check, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {check.test ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className={check.test ? "text-green-600" : "text-muted-foreground"}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Create account"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By signing up, you agree to the{" "}
            <Link to="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>
          </p>

          <div className="text-center">
            <Link 
              to="/login" 
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default SignUp;
