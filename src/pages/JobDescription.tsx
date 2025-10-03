import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useJobAnalysis } from "@/hooks/useJobAnalysis";
import { Brain, FileText, AlertTriangle } from "lucide-react";

const JobDescription = () => {
  const [jobDescription, setJobDescription] = useState(() => {
    // Initialize from localStorage
    const stored = localStorage.getItem('jobDescription');
    return stored || "";
  });
  
  const [keywordMatchType, setKeywordMatchType] = useState(() => {
    return localStorage.getItem('keywordMatchType') || "exact";
  });
  
  const [errors, setErrors] = useState<{ jobDescription?: string; keywordMatchType?: string }>({});
  const [characterCount, setCharacterCount] = useState(0);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { analyzeJobFit, isAnalyzing, analysisProgress, constants } = useJobAnalysis();

  // Update character count when job description changes
  useEffect(() => {
    setCharacterCount(jobDescription.length);
  }, [jobDescription]);

  // Handle navigation error flag
  useEffect(() => {
    const showError = localStorage.getItem('showJobDescriptionError');
    if (showError === 'required') {
      localStorage.removeItem('showJobDescriptionError');
      setErrors({ jobDescription: "Job description is required" });
      toast({
        title: "Job Description Required",
        description: "Please provide a job description to continue.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const validateForm = () => {
    const newErrors: { jobDescription?: string; keywordMatchType?: string } = {};
    
    const trimmedDescription = jobDescription.trim();
    
    if (!trimmedDescription) {
      newErrors.jobDescription = "Job description is required";
    } else if (trimmedDescription.length < constants.MIN_JOB_DESCRIPTION_LENGTH) {
      newErrors.jobDescription = `Job description must be at least ${constants.MIN_JOB_DESCRIPTION_LENGTH} characters (currently ${trimmedDescription.length})`;
    } else {
      // Additional content validation
      const wordCount = trimmedDescription.split(/\s+/).length;
      if (wordCount < 20) {
        newErrors.jobDescription = "Job description seems too short to contain meaningful requirements";
      } else if (trimmedDescription.length > 10000) {
        newErrors.jobDescription = "Job description is too long. Please provide a more concise version (max 10,000 characters)";
      }
    }
    
    if (trimmedDescription.length < constants.MIN_JOB_DESCRIPTION_LENGTH) {
      newErrors.jobDescription = `Job description must be at least ${constants.MIN_JOB_DESCRIPTION_LENGTH} characters (currently ${trimmedDescription.length})`;
    }
    
    if (!keywordMatchType) {
      newErrors.keywordMatchType = "Please select a keyword matching type";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleJobDescriptionChange = (value: string) => {
    setJobDescription(value);
    
    // Clear validation errors as user types
    if (errors.jobDescription) {
      const newErrors = { ...errors };
      delete newErrors.jobDescription;
      setErrors(newErrors);
    }
  };

  const handleKeywordMatchTypeChange = (value: string) => {
    setKeywordMatchType(value);
    
    // Clear validation errors
    if (errors.keywordMatchType) {
      const newErrors = { ...errors };
      delete newErrors.keywordMatchType;
      setErrors(newErrors);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors below before submitting.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Store data in localStorage when submitting
      localStorage.setItem('jobDescription', jobDescription.trim());
      localStorage.setItem('keywordMatchType', keywordMatchType);
      localStorage.removeItem('selectedKeywords'); // Clear any old data
      
      // Trigger the job analysis
      await analyzeJobFit(jobDescription.trim(), keywordMatchType);
      
    } catch (error) {
      console.error("Analysis error:", error);
      // Error handling is done in the hook
    }
  };

  const getCharacterCountColor = () => {
    if (characterCount < constants.MIN_JOB_DESCRIPTION_LENGTH) {
      return 'text-red-500';
    } else if (characterCount < 200) {
      return 'text-yellow-600';
    } else {
      return 'text-green-600';
    }
  };

  const getProgressColor = () => {
    const progressPercentage = Math.min(100, (characterCount / constants.MIN_JOB_DESCRIPTION_LENGTH) * 100);
    if (progressPercentage < 100) {
      return '[&>div]:bg-red-500';
    } else if (characterCount < 200) {
      return '[&>div]:bg-yellow-500';
    } else {
      return '[&>div]:bg-green-500';
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <Card className="shadow-soft border border-border/50">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-3xl font-bold text-foreground mb-2">
            Job Description Analysis
          </CardTitle>
          <p className="text-lg text-muted-foreground">
            Paste the complete job description to analyze your fit and generate tailored resume bullets
          </p>
        </CardHeader>
        
        <CardContent className="px-8 pb-8">
          {isAnalyzing ? (
            <div className="space-y-6 text-center">
              <div className="flex items-center justify-center gap-3">
                <Brain className="w-8 h-8 animate-pulse text-primary" />
                <div>
                  <h3 className="text-lg font-semibold">Analyzing Your Job Fit</h3>
                  <p className="text-sm text-muted-foreground">
                    This may take 15-45 seconds depending on content length
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Progress value={analysisProgress} className="w-full h-3" />
                <p className="text-sm text-muted-foreground">
                  {analysisProgress < 25 && "Preprocessing job description..."}
                  {analysisProgress >= 25 && analysisProgress < 75 && "Extracting requirements and matching experiences..."}
                  {analysisProgress >= 75 && analysisProgress < 90 && "Calculating fit score..."}
                  {analysisProgress >= 90 && "Finalizing results..."}
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">What's happening:</h4>
                <ul className="space-y-1 text-sm text-blue-800 text-left">
                  <li>• Extracting key requirements and skills from job description</li>
                  <li>• Matching against your professional experiences</li>
                  <li>• Calculating overall job fit percentage</li>
                </ul>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Job Description Text Area */}
              <div className="space-y-3">
                <Label htmlFor="jobDescription" className="text-base font-semibold text-foreground">
                  Job Description Text
                </Label>
                <Textarea
                  id="jobDescription"
                  placeholder="Paste the complete job description here, including requirements, responsibilities, and qualifications..."
                  value={jobDescription}
                  onChange={(e) => handleJobDescriptionChange(e.target.value)}
                  className="min-h-[300px] w-full resize-y text-base"
                />
                
                {errors.jobDescription && (
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{errors.jobDescription}</span>
                  </div>
                )}
                
                {/* Character count with visual progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={getCharacterCountColor()}>
                      Character count: {characterCount.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      Minimum: {constants.MIN_JOB_DESCRIPTION_LENGTH} characters
                    </span>
                  </div>
                  
                  <Progress 
                    value={Math.min(100, (characterCount / constants.MIN_JOB_DESCRIPTION_LENGTH) * 100)} 
                    className="w-full h-2"
                  />
                </div>
              </div>

              {/* Keyword Matching Strategy */}
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">
                  Keyword Matching Strategy
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Choose how precisely keywords should match between your experience and the job description
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant={keywordMatchType === "exact" ? "default" : "outline"}
                    className="h-auto py-4 px-4 w-full"
                    onClick={() => handleKeywordMatchTypeChange("exact")}
                  >
                    <div className="text-left w-full space-y-2">
                      <div className="font-semibold">Exact Match</div>
                      <div className="text-xs font-normal opacity-90 break-words">
                        Matches words precisely (e.g., 'manage' ≠ 'managing')
                      </div>
                      <div className="text-xs font-normal opacity-75 break-words">
                        Best for: Workday, Greenhouse, Lever, and most ATS
                      </div>
                    </div>
                  </Button>
                  
                  <Button
                    type="button"
                    variant={keywordMatchType === "flexible" ? "default" : "outline"}
                    className="h-auto py-4 px-4 w-full"
                    onClick={() => handleKeywordMatchTypeChange("flexible")}
                  >
                    <div className="text-left w-full space-y-2">
                      <div className="font-semibold">Flexible Match</div>
                      <div className="text-xs font-normal opacity-90 break-words">
                        Matches word roots (e.g., 'manage' = 'managing')
                      </div>
                      <div className="text-xs font-normal opacity-75 break-words">
                        Best for: Workable, Eightfold, and other AI based ATS
                      </div>
                    </div>
                  </Button>
                </div>
                
                {errors.keywordMatchType && (
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{errors.keywordMatchType}</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex justify-center items-center py-2">
                <Button
                  type="submit"
                  disabled={isAnalyzing || characterCount < constants.MIN_JOB_DESCRIPTION_LENGTH}
                  size="lg"
                  className="min-w-[240px]"
                >
                  {isAnalyzing ? (
                    <>
                      <Brain className="w-5 h-5 mr-2 animate-pulse" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5 mr-2" />
                      Analyze Job Fit
                    </>
                  )}
                </Button>
              </div>

              {/* Help Text */}
              <div className="text-center text-sm text-muted-foreground space-y-1 mb-4">
                <p>Analysis typically takes 15-45 seconds</p>
                <p>Higher scores (80%+) automatically generate resume bullets</p>
              </div>

              {/* Information Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-blue-900 mb-2">Analysis Process:</h4>
                    <ul className="space-y-1 text-sm text-blue-800">
                      <li>• Extract key requirements and skills from job description</li>
                      <li>• Match against your STAR-format experiences</li>
                      <li>• Calculate overall job fit percentage (0-100%)</li>
                      <li>• Generate tailored resume bullets if score ≥ 80%</li>
                      <li>• Provide improvement recommendations if score &lt; 80%</li>
                    </ul>
                  </div>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default JobDescription;
