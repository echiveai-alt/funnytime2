import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const JobDescription = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [keywordMatchType, setKeywordMatchType] = useState("exact");
  const [errors, setErrors] = useState<{ jobDescription?: string; keywordMatchType?: string }>({});
  const { toast } = useToast();


  const validateForm = () => {
    const newErrors: { jobDescription?: string; keywordMatchType?: string } = {};
    
    if (!jobDescription.trim()) {
      newErrors.jobDescription = "Job description is required";
    } else if (jobDescription.trim().length < 100) {
      newErrors.jobDescription = "Job description must be at least 100 characters";
    }

    if (!keywordMatchType) {
      newErrors.keywordMatchType = "Please select a keyword matching type";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors below",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Here you would typically submit the data to your backend
      // For now, we'll just simulate a successful submission
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Success",
        description: "Job description submitted successfully",
      });
      
      // Navigate to next step (placeholder for now)
      console.log("Form submitted:", { jobDescription, keywordMatchType });
      
    } catch (error) {
      console.error("Submission error:", error);
      toast({
        title: "Error",
        description: "Failed to submit job description. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <Card className="shadow-soft border border-border/50">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-3xl font-bold text-foreground mb-2">
              Job Description
            </CardTitle>
            <p className="text-lg text-muted-foreground">
              Paste the job description you'd like to target for your resume
            </p>
          </CardHeader>
          
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Job Description Text Area */}
              <div className="space-y-3">
                <Label htmlFor="jobDescription" className="text-base font-semibold text-foreground">
                  Job Description Text
                </Label>
                <Textarea
                  id="jobDescription"
                  placeholder="Paste the complete job description here..."
                  value={jobDescription}
                  onChange={(e) => {
                    setJobDescription(e.target.value);
                    // Save to localStorage for cross-page checking
                    localStorage.setItem('jobDescription', e.target.value);
                    if (errors.jobDescription) {
                      setErrors(prev => ({ ...prev, jobDescription: undefined }));
                    }
                  }}
                  className="min-h-[300px] w-full resize-y text-base"
                  style={{ width: '720px', maxWidth: '100%' }}
                />
                {errors.jobDescription && (
                  <p className="text-sm text-destructive">{errors.jobDescription}</p>
                )}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Character count: {jobDescription.length}</span>
                  <span>Minimum: 100 characters</span>
                </div>
              </div>

              {/* Keyword Matching Dropdown */}
              <div className="space-y-3">
                <Label htmlFor="keywordMatchType" className="text-base font-semibold text-foreground">
                  Keyword Matching Type
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Choose how closely keywords should match between your experience and the job description
                </p>
                <Select
                  value={keywordMatchType}
                  onValueChange={(value) => {
                    setKeywordMatchType(value);
                    if (errors.keywordMatchType) {
                      setErrors(prev => ({ ...prev, keywordMatchType: undefined }));
                    }
                  }}
                >
                  <SelectTrigger className="w-[300px] h-[45px]">
                    <SelectValue placeholder="Select matching type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">
                      <div>
                        <div className="font-medium">Exact Match</div>
                        <div className="text-xs text-muted-foreground">
                          Matches words precisely (e.g., 'manage' ≠ 'managing')
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="word-stem">
                      <div>
                        <div className="font-medium">Word-Stem Match</div>
                        <div className="text-xs text-muted-foreground">
                          Matches word roots (e.g., 'manage' = 'managing', 'management')
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.keywordMatchType && (
                  <p className="text-sm text-destructive">{errors.keywordMatchType}</p>
                )}
              </div>

              {/* Action Button */}
              <div className="flex justify-center pt-6">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8"
                >
                  {isSubmitting ? "Processing..." : "Create"}
                </Button>
              </div>
            </form>

          </CardContent>
        </Card>
      </main>
    </>
  );
};

export default JobDescription;