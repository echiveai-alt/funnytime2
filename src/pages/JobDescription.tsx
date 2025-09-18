import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const JobDescription = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobDescription, setJobDescription] = useState(() => {
    // Initialize from localStorage to prevent flash
    return localStorage.getItem('jobDescription') || "";
  });
  const [keywordMatchType, setKeywordMatchType] = useState("exact");
  const [errors, setErrors] = useState<{ jobDescription?: string; keywordMatchType?: string }>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();


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
      
      // Navigate to resume bullet points page
      navigate('/app/resume-bullets');
      
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

  const analyzeJobFit = async () => {
    if (!jobDescription.trim()) {
      toast({
        title: "Error",
        description: "Please enter a job description first.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-job-fit', {
        body: { jobDescription: jobDescription.trim() }
      });

      if (error) {
        throw error;
      }

      setAnalysis(data);
      toast({
        title: "Analysis Complete",
        description: "Your job fit analysis is ready!",
      });

    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze job fit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
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

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? "Processing..." : "Submit Job Description"}
                </Button>
                
                <Button 
                  type="button"
                  onClick={analyzeJobFit}
                  disabled={isAnalyzing || !jobDescription.trim()}
                  variant="outline"
                  className="flex-1"
                >
                  {isAnalyzing ? "Analyzing..." : "Analyze Job Fit"}
                </Button>
              </div>
            </form>

          </CardContent>
        </Card>

        {analysis && (
          <Card className="shadow-soft border border-border/50 mt-8">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-foreground">Job Fit Analysis</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="space-y-6">
                {/* Overall Score */}
                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                  <div>
                    <h3 className="text-lg font-semibold">Overall Fit Score</h3>
                    <p className="text-sm text-muted-foreground">{analysis.fitLevel} Match</p>
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {analysis.overallScore}/100
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">Summary</h3>
                  <p className="text-muted-foreground">{analysis.summary}</p>
                </div>

                {/* Strengths */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-green-600">Strengths</h3>
                  <ul className="space-y-2">
                    {analysis.strengths?.map((strength: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Gaps */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-orange-600">Areas for Improvement</h3>
                  <ul className="space-y-2">
                    {analysis.gaps?.map((gap: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-orange-500 mt-1">△</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-blue-600">Recommendations</h3>
                  <ul className="space-y-2">
                    {analysis.recommendations?.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">💡</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Keyword Match */}
                {analysis.keywordMatch && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Keyword Analysis</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-green-600 mb-2">Matched Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.keywordMatch.matchedKeywords?.map((keyword: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-orange-600 mb-2">Missing Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.keywordMatch.missingKeywords?.map((keyword: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
};

export default JobDescription;