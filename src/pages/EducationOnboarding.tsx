import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Brain, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const educationSchema = z.object({
  degree: z.string().min(1, "Please enter your degree"),
  school: z.string().min(1, "Please enter your school"),
  graduationDate: z.date({
    required_error: "Please select your graduation date",
  }),
});

type EducationFormData = z.infer<typeof educationSchema>;

const degreeExamples = [
  "B.Sc. in Computer Science",
  "B.A. in Economics", 
  "M.Eng. in Computer Engineering",
  "B.S. in Mathematics",
  "M.B.A.",
  "Ph.D. in Physics"
];

const EducationOnboarding = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EducationFormData>({
    resolver: zodResolver(educationSchema),
  });

  const graduationDate = watch("graduationDate");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/signup");
          return;
        }
      } catch (error) {
        console.error("Auth check error:", error);
        navigate("/signup");
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const onSubmit = async (data: EducationFormData) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        throw new Error("No authenticated user");
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          degree: data.degree,
          school: data.school,
          graduation_date: data.graduationDate.toISOString().split('T')[0],
        })
        .eq("user_id", session.user.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Education details saved!",
        description: "Welcome to echive.ai",
      });

      navigate("/app/experiences");
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast({
        title: "Failed to save education details",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-subtle">
        <Card className="w-full max-w-2xl p-8 shadow-soft">
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-xl shadow-soft mx-auto mb-6">
              <Brain className="w-8 h-8 text-primary-foreground animate-pulse" />
            </div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-subtle">
      <Card className="w-full max-w-2xl p-8 shadow-soft">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-xl shadow-soft mx-auto mb-6">
            <Brain className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-sm text-muted-foreground mb-2">Step 2 of 2</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Education Details</h1>
          <p className="text-muted-foreground">
            Help us personalize your resume suggestions.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="degree">Degree</Label>
            <Input
              id="degree"
              placeholder="e.g., B.Sc. in Computer Science"
              {...register("degree")}
              className={errors.degree ? "border-destructive" : ""}
            />
            <div className="text-xs text-muted-foreground">
              Examples: {degreeExamples.slice(0, 3).join(", ")}
            </div>
            <div className="text-xs text-muted-foreground">
              You can edit this later.
            </div>
            {errors.degree && (
              <p className="text-sm text-destructive">{errors.degree.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="school">School</Label>
            <Input
              id="school"
              placeholder="e.g., University of California, Berkeley"
              {...register("school")}
              className={errors.school ? "border-destructive" : ""}
            />
            {errors.school && (
              <p className="text-sm text-destructive">{errors.school.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Graduation Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !graduationDate && "text-muted-foreground",
                    errors.graduationDate && "border-destructive"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {graduationDate ? format(graduationDate, "PPP") : <span>Select graduation date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={graduationDate}
                  onSelect={(date) => date && setValue("graduationDate", date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <div className="text-xs text-muted-foreground">
              Select your expected graduation date if you haven't graduated yet.
            </div>
            {errors.graduationDate && (
              <p className="text-sm text-destructive">{errors.graduationDate.message}</p>
            )}
          </div>

          <div className="pt-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Continue"}
            </Button>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            This helps personalize your resume suggestions.
          </div>
        </form>
      </Card>
    </div>
  );
};

export default EducationOnboarding;