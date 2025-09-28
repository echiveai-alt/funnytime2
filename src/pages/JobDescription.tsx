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
    // Initialize from localStorage but validate it
    const stored = localStorage.getItem('jobDescription');
    return stored || "";
  });
  
  const [keywordMatchType, setKeywordMatchType] = useState(() => {
    return localStorage.getItem('keywordMatchType') || "exact";
  });
  
  const [errors, setErrors] = useState<{ jobDescription?: string; keywordMatchType?: string }>({});
  
  // Character count with validation feedback
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
      await analyzeJobFit(jobDescription.trim());
      
      // Navigation is handled by useJobAnalysis based on score
      
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
    if (characterCount < constants.MIN_JOB_DESCRIPTION_LENGTH) {
      return 'bg-red-500';
    } else if (characterCount < 200) {
      return 'bg-yellow-500';
    } else {
      return 'bg-green-500';
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
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>• Extracting key requirements and skills from job description</li>
                  <li>• Matching against your professional experiences</li>
                  <li>• Calculating overall job fit percentage</li>
                  <li>• Preparing personalized recommendations</li>
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
                  style={{ width: '100%', maxWidth: '100%' }}
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
                  
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                      style={{ 
                        width: `${Math.min(100, (characterCount / constants.MIN_JOB_DESCRIPTION_LENGTH) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Keyword Matching Dropdown */}
              <div className="space-y-3">
                <Label htmlFor="keywordMatchType" className="text-base font-semibold text-foreground">
                  Keyword Matching Strategy
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Choose how precisely keywords should match between your experience and the job description
                </p>
                <Select
                  value={keywordMatchType}
                  onValueChange={handleKeywordMatchTypeChange}
                >
                  <SelectTrigger className="w-full max-w-md h-[55px]">
                    <SelectValue placeholder="Select matching strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">
                      <div className="py-1">
                        <div className="font-medium">Exact Match</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Matches words precisely (e.g., 'manage' ≠ 'managing')
                          <br />Best for: Technical roles, compliance positions
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="word-stem">
                      <div className="py-1">
                        <div className="font-medium">Word-Stem Match</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Matches word roots (e.g., 'manage' = 'managing', 'management')
                          <br />Best for: Most roles, creative flexibility
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {errors.
