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

const educationEntrySchema = z.object({
  degree: z.string().optional(),
  school: z.string().optional(),
  graduationMonth: z.string().optional(),
  graduationYear: z.string().optional(),
  isExpectedDate: z.boolean(),
});

const educationSchema = z.object({
  education: z.array(educationEntrySchema).min(1),
  isNotApplicable: z.boolean(),
}).refine((data) => {
  if (data.isNotApplicable) return true;
  return data.education.some(entry => entry.degree && entry.school);
}, {
  message: "Please enter at least one degree and school, or check 'Not applicable'",
  path: ["education"]
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
  const [educationEntries, setEducationEntries] = useState(1);
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
      education: [{ 
        degree: "",
        school: "",
        graduationMonth: "",
        graduationYear: "",
        isExpectedDate: false
      }],
      isNotApplicable: false,
    }
  });

  const isNotApplicable = watch("isNotApplicable");
  const education = watch("education");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/signup");
          return;
        }

        // Load existing education data
        const { data: existingEducation, error } = await supabase
          .from("education")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Error loading education:", error);
        } else if (existingEducation && existingEducation.length > 0) {
          // Pre-populate form with existing data
          const educationData = existingEducation.map(edu => {
            let graduationMonth = "";
            let graduationYear = "";
            
            if (edu.graduation_date) {
              const date = new Date(edu.graduation_date);
              graduationMonth = String(date.getMonth() + 1);
              graduationYear = String(date.getFullYear());
            }

            return {
              degree: edu.degree || "",
              school: edu.school || "",
              graduationMonth,
              graduationYear,
              isExpectedDate: edu.is_expected_graduation
            };
          });

          setValue("education", educationData);
          setEducationEntries(educationData.length);
          setValue("isNotApplicable", false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        navigate("/signup");
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAuth();
  }, [navigate, setValue]);

  const onSubmit = async (data: EducationFormData) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        throw new Error("No authenticated user");
      }

      // Delete existing education records first
      const { error: deleteError } = await supabase
        .from("education")
        .delete()
        .eq("user_id", session.user.id);

      if (deleteError) {
        throw deleteError;
      }

      if (!data.isNotApplicable && data.education) {
        // Save all education entries to the new education table
        const educationEntries = data.education
          .filter(entry => entry.degree && entry.school)
          .map(entry => {
            let graduationDate = null;
            if (entry.graduationYear && entry.graduationMonth) {
              graduationDate = `${entry.graduationYear}-${entry.graduationMonth.padStart(2, '0')}-01`;
            }

            return {
              user_id: session.user.id,
              degree: entry.degree,
              school: entry.school,
              graduation_date: graduationDate,
              is_expected_graduation: entry.isExpectedDate
            };
          });

        if (educationEntries.length > 0) {
          const { error: insertError } = await supabase
            .from("education")
            .insert(educationEntries);

          if (insertError) {
            throw insertError;
          }
        }
      }

      // Mark education onboarding as completed
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          education_onboarding_completed: true,
        })
        .eq("user_id", session.user.id);

      if (profileError) {
        throw profileError;
      }

      toast({
        title: "Education details saved!",
        description: "Welcome to keystep.ai",
      });

      navigate("/app/experiences?showResumeImport=true");
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
                Your education credentials help our AI to accurately analyze your alignment with the provided job description.
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
              {Array.from({ length: educationEntries }, (_, index) => (
                <div key={index} className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">
                      {index === 0 ? "Primary Education" : `Additional Education #${index}`}
                    </h3>
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEducationEntries(prev => prev - 1);
                          const currentEducation = education || [];
                          setValue("education", currentEducation.slice(0, -1));
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`degree-${index}`}>Degree</Label>
                    <Input
                      id={`degree-${index}`}
                      placeholder="e.g., B.Sc. in Computer Science"
                      {...register(`education.${index}.degree` as const)}
                      className={errors.education?.[index]?.degree ? "border-destructive" : ""}
                    />
                    {index === 0 && (
                      <>
                        <div className="text-xs text-muted-foreground">
                          Examples: {degreeExamples.slice(0, 3).join(", ")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          You can edit this later.
                        </div>
                      </>
                    )}
                    {errors.education?.[index]?.degree && (
                      <p className="text-sm text-destructive">{errors.education[index]?.degree?.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`school-${index}`}>School</Label>
                    <Input
                      id={`school-${index}`}
                      placeholder="e.g., University of California, Berkeley"
                      {...register(`education.${index}.school` as const)}
                      className={errors.education?.[index]?.school ? "border-destructive" : ""}
                    />
                    {errors.education?.[index]?.school && (
                      <p className="text-sm text-destructive">{errors.education[index]?.school?.message}</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <Label>Graduation Date</Label>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`graduation-month-${index}`} className="text-sm">Month</Label>
                        <Select onValueChange={(value) => setValue(`education.${index}.graduationMonth` as const, value)}>
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
                        <Label htmlFor={`graduation-year-${index}`} className="text-sm">Year</Label>
                        <Input
                          id={`graduation-year-${index}`}
                          placeholder="2024"
                          type="number"
                          min="1950"
                          max="2035"
                          {...register(`education.${index}.graduationYear` as const)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`expected-date-${index}`}
                        {...register(`education.${index}.isExpectedDate` as const)}
                        onCheckedChange={(checked) => setValue(`education.${index}.isExpectedDate` as const, !!checked)}
                      />
                      <Label htmlFor={`expected-date-${index}`} className="text-sm font-normal">
                        This is an expected graduation date
                      </Label>
                    </div>

                    {index === 0 && (
                      <div className="text-xs text-muted-foreground">
                        {education?.[0]?.isExpectedDate 
                          ? "We'll help you find opportunities that welcome soon-to-graduate candidates." 
                          : "Select your actual or expected graduation date."
                        }
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {educationEntries < 3 && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEducationEntries(prev => prev + 1);
                      const currentEducation = education || [];
                      setValue("education", [
                        ...currentEducation,
                        { 
                          degree: "",
                          school: "",
                          graduationMonth: "",
                          graduationYear: "",
                          isExpectedDate: false
                        }
                      ]);
                    }}
                    className="w-full"
                  >
                    Add More Education
                  </Button>
                </div>
              )}
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