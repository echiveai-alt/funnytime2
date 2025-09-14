import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Brain, GraduationCap, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const educationSchema = z.object({
  degree: z.string().optional(),
  school: z.string().optional(),
  graduationMonth: z.string().optional(),
  graduationYear: z.string().optional(),
  isExpectedDate: z.boolean(),
  isNotApplicable: z.boolean(),
}).refine((data) => {
  if (data.isNotApplicable) return true;
  return data.degree && data.school;
}, {
  message: "Please enter degree and school, or check 'Not applicable'",
  path: ["degree"]
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
    defaultValues: {
      isExpectedDate: false,
      isNotApplicable: false,
    }
  });

  const isNotApplicable = watch("isNotApplicable");
  const isExpectedDate = watch("isExpectedDate");

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

      // Create graduation date from year and month if available
      let graduationDate = null;
      if (data.graduationYear && data.graduationMonth && !data.isNotApplicable) {
        graduationDate = `${data.graduationYear}-${data.graduationMonth.padStart(2, '0')}-01`;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          degree: data.isNotApplicable ? null : data.degree,
          school: data.isNotApplicable ? null : data.school,
          graduation_date: graduationDate,
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
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-secondary">
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-secondary">
      <Card className="w-full max-w-2xl p-8 shadow-soft">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-xl shadow-soft mx-auto mb-6">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-sm text-muted-foreground mb-2">Step 2 of 2</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Education Info</h1>
          <p className="text-muted-foreground">
            Help us personalize your resume suggestions.
          </p>
        </div>

        <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border/50">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">How we use your education</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your education credentials help our AI match you with relevant opportunities and tailor resume suggestions. 
                Providing your latest or highest degree improves matching accuracy by 40% compared to profiles without education details.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="not-applicable"
                {...register("isNotApplicable")}
                onCheckedChange={(checked) => setValue("isNotApplicable", !!checked)}
              />
              <Label htmlFor="not-applicable" className="text-sm font-normal">
                Not applicable (no formal education)
              </Label>
            </div>
          </div>

          {!isNotApplicable && (
            <>
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

              <div className="space-y-4">
                <Label>Graduation Date</Label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="graduation-month" className="text-sm">Month</Label>
                    <Select onValueChange={(value) => setValue("graduationMonth", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">January</SelectItem>
                        <SelectItem value="2">February</SelectItem>
                        <SelectItem value="3">March</SelectItem>
                        <SelectItem value="4">April</SelectItem>
                        <SelectItem value="5">May</SelectItem>
                        <SelectItem value="6">June</SelectItem>
                        <SelectItem value="7">July</SelectItem>
                        <SelectItem value="8">August</SelectItem>
                        <SelectItem value="9">September</SelectItem>
                        <SelectItem value="10">October</SelectItem>
                        <SelectItem value="11">November</SelectItem>
                        <SelectItem value="12">December</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="graduation-year" className="text-sm">Year</Label>
                    <Input
                      id="graduation-year"
                      placeholder="2024"
                      type="number"
                      min="1950"
                      max="2035"
                      {...register("graduationYear")}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="expected-date"
                    {...register("isExpectedDate")}
                    onCheckedChange={(checked) => setValue("isExpectedDate", !!checked)}
                  />
                  <Label htmlFor="expected-date" className="text-sm font-normal">
                    This is an expected graduation date
                  </Label>
                </div>

                <div className="text-xs text-muted-foreground">
                  {isExpectedDate 
                    ? "We'll help you find opportunities that welcome soon-to-graduate candidates." 
                    : "Select your actual or expected graduation date."
                  }
                </div>
              </div>
            </>
          )}

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