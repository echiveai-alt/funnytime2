import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { storeJobKeyPhrases, storeJobDescription, storeRelevantExperiences, clearAllJobAnalysisData } from '@/utils/jobAnalysis';
import { useResumeBullets } from '@/hooks/useResumeBullets';
import { useNavigate } from 'react-router-dom';

// Constants for consistent thresholds
export const ANALYSIS_CONSTANTS = {
  MIN_SCORE_FOR_BULLETS: 80,
  MIN_JOB_DESCRIPTION_LENGTH: 100,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

interface AnalysisResult {
  extractedJobPhrases?: Array<{
    phrase: string;
    category: string;
    importance: string;
  }>;
  matchedPhrases?: Array<{
    jobPhrase: string;
    experienceMatch: string;
    experienceContext: string;
    matchType: string;
    evidenceStrength: string;
  }>;
  unmatchedPhrases?: Array<{
    phrase: string;
    category: string;
    importance: string;
    reason: string;
  }>;
  overallScore?: number;
  fitLevel?: string;
  strengths?: string[];
  gaps?: string[];
  recommendations?: string[];
  summary?: string;
  experienceIdsByRole?: Record<string, any>;
  bulletKeywords?: Record<string, string[]>;
  jobRequirements?: Array<any>;
}

interface AnalysisError {
  code: string;
  message: string;
  retryable: boolean;
}

export const useJobAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const { toast } = useToast();
  const { generateResumeBullets } = useResumeBullets();
  const navigate = useNavigate();

  const validateJobDescription = (jobDescription: string): string | null => {
    if (!jobDescription?.trim()) {
      return 'Job description is required';
    }
    
    if (jobDescription.trim().length < ANALYSIS_CONSTANTS.MIN_JOB_DESCRIPTION_LENGTH) {
      return `Job description must be at least ${ANALYSIS_CONSTANTS.MIN_JOB_DESCRIPTION_LENGTH} characters`;
    }
    
    // Basic content validation - ensure it's not just random text
    const wordCount = jobDescription.trim().split(/\s+/).length;
    if (wordCount < 20) {
      return 'Job description seems too short to be meaningful';
    }
    
    return null;
  };

  const handleAnalysisError = (error: any): AnalysisError => {
    console.error('Analysis error details:', error);
    
    // Categorize errors for better user experience
    if (error?.message?.includes('rate limit') || error?.message?.includes('429')) {
      return {
        code: 'RATE_LIMITED',
        message: 'Analysis service is temporarily busy. Please try again in a moment.',
        retryable: true,
      };
    }
    
    if (error?.message?.includes('timeout') || error?.message?.includes('504')) {
      return {
        code: 'TIMEOUT',
        message: 'Analysis took too long. Please try again with a shorter job description.',
        retryable: true,
      };
    }
    
    if (error?.message?.includes('authentication') || error?.message?.includes('401')) {
      return {
        code: 'AUTH_ERROR',
        message: 'Session expired. Please refresh the page and log in again.',
        retryable: false,
      };
    }
    
    if (error?.message?.includes('No experiences found')) {
      return {
        code: 'NO_EXPERIENCES',
        message: 'No professional experiences found. Please add some experiences before analyzing.',
        retryable: false,
      };
    }

    return {
      code: 'UNKNOWN',
      message: error?.message || 'Analysis failed. Please try again.',
      retryable: true,
    };
  };

  const retryWithDelay = (fn: () => Promise<any>, retries: number): Promise<any> => {
    return fn().catch(error => {
      if (retries > 0) {
        console.log(`Retrying analysis, ${retries} attempts remaining...`);
        return new Promise(resolve => {
          setTimeout(() => resolve(retryWithDelay(fn, retries - 1)), ANALYSIS_CONSTANTS.RETRY_DELAY_MS);
        });
      }
      throw error;
    });
  };

  const performAnalysis = async (jobDescription: string): Promise<AnalysisResult> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Please log in to analyze job fit');
    }

    setAnalysisProgress(25);

    const { data, error } = await supabase.functions.invoke('analyze-job-fit', {
      body: { jobDescription },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      throw error;
    }

    setAnalysisProgress(75);

    // Validate the response structure
    if (!data || typeof data.overallScore !== 'number') {
      throw new Error('Invalid analysis response received');
    }

    return data;
  };

  const analyzeJobFit = async (jobDescription: string): Promise<AnalysisResult | null> => {
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      
      // Validate input
      const validationError = validateJobDescription(jobDescription);
      if (validationError) {
        throw new Error(validationError);
      }
      
      // Clear previous data to prevent conflicts
      clearAllJobAnalysisData();
      
      // Store job description
      storeJobDescription(jobDescription);
      setAnalysisProgress(10);

      // Perform analysis with retry logic
      const data = await retryWithDelay(
        () => performAnalysis(jobDescription),
        ANALYSIS_CONSTANTS.MAX_RETRIES
      );

      setAnalysisProgress(85);

      // Store results
      if (data.relevantExperiences) {
        storeRelevantExperiences(data.relevantExperiences);
      }
      
      localStorage.setItem('jobAnalysisResult', JSON.stringify(data));
      setAnalysisProgress(90);

      // Route based on score with consistent logic
      const score = data.overallScore || 0;
      const hasRequiredData = data.experienceIdsByRole && data.bulletKeywords && data.jobRequirements;
      
      if (score >= ANALYSIS_CONSTANTS.MIN_SCORE_FOR_BULLETS && hasRequiredData) {
        console.log(`Score ${score}% meets threshold, generating bullets...`);
        
        try {
          await generateResumeBullets(data);
          setAnalysisProgress(100);
          
          toast({
            title: 'Analysis Complete',
            description: 'Resume bullets have been generated successfully.',
          });
          
          navigate('/app/resume-bullets');
        } catch (bulletError) {
          console.error('Bullet generation failed:', bulletError);
          // Fall back to analysis results page
          toast({
            title: 'Analysis Complete',
            description: 'Analysis completed but bullet generation failed. Showing detailed results.',
          });
          navigate('/app/analysis-results');
        }
      } else {
        setAnalysisProgress(100);
        
        const reason = score < ANALYSIS_CONSTANTS.MIN_SCORE_FOR_BULLETS 
          ? `Score ${score}% is below the ${ANALYSIS_CONSTANTS.MIN_SCORE_FOR_BULLETS}% threshold`
          : 'Missing required data for bullet generation';
          
        console.log(`Redirecting to analysis results: ${reason}`);
        
        toast({
          title: 'Analysis Complete',
          description: 'Your job fit analysis is ready for review.',
        });
        
        navigate('/app/analysis-results');
      }

      return data;
      
    } catch (error) {
      const analysisError = handleAnalysisError(error);
      
      toast({
        title: 'Analysis Failed',
        description: analysisError.message,
        variant: 'destructive',
        action: analysisError.retryable ? {
          altText: 'Retry',
          onClick: () => analyzeJobFit(jobDescription),
        } : undefined,
      });
      
      return null;
      
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  return {
    analyzeJobFit,
    isAnalyzing,
    analysisProgress,
    constants: ANALYSIS_CONSTANTS,
  };
};
