import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { storeJobDescription, clearAllJobAnalysisData } from '@/utils/jobAnalysis';
import { useResumeBullets } from '@/hooks/useResumeBullets';
import { useNavigate } from 'react-router-dom';

// Simplified constants
const ANALYSIS_CONSTANTS = {
  MIN_SCORE_FOR_BULLETS: 80,
  MIN_JOB_DESCRIPTION_LENGTH: 50,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
} as const;

// Simplified interface matching backend response
interface SimplifiedAnalysisResult {
  overallScore: number;
  fitLevel: string;
  isFit: boolean;
  jobRequirements: Array<any>;
  matchedRequirements: Array<any>;
  unmatchedRequirements: Array<any>;
  experienceIdsByRole?: Record<string, any>;
  bulletKeywords?: Record<string, string[]>;
  fitAssessment?: {
    overallScore: number;
    fitLevel: string;
  };
  actionPlan?: {
    readyForApplication: boolean;
    readyForBulletGeneration: boolean;
  };
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
    
    return null;
  };

  const handleAnalysisError = (error: any): AnalysisError => {
    console.error('Analysis error:', error);
    
    if (error?.message?.includes('rate limit') || error?.message?.includes('429')) {
      return {
        code: 'RATE_LIMITED',
        message: 'Analysis service is busy. Please try again in a moment.',
        retryable: true,
      };
    }
    
    if (error?.message?.includes('timeout') || error?.message?.includes('504')) {
      return {
        code: 'TIMEOUT',
        message: 'Analysis took too long. Please try again.',
        retryable: true,
      };
    }
    
    if (error?.message?.includes('authentication') || error?.message?.includes('401')) {
      return {
        code: 'AUTH_ERROR',
        message: 'Session expired. Please refresh and log in again.',
        retryable: false,
      };
    }
    
    if (error?.message?.includes('No experiences found')) {
      return {
        code: 'NO_EXPERIENCES',
        message: 'No professional experiences found. Please add experiences first.',
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
      if (retries > 0 && error?.retryable !== false) {
        console.log(`Retrying analysis, ${retries} attempts remaining...`);
        return new Promise(resolve => {
          setTimeout(() => resolve(retryWithDelay(fn, retries - 1)), ANALYSIS_CONSTANTS.RETRY_DELAY_MS);
        });
      }
      throw error;
    });
  };

  const performAnalysis = async (jobDescription: string, keywordMatchType: string): Promise<SimplifiedAnalysisResult> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Please log in to analyze job fit');
    }

    setAnalysisProgress(25);

    const { data, error } = await supabase.functions.invoke('analyze-job-fit', {
      body: { jobDescription },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'x-keyword-match-type': keywordMatchType
      },
    });

    if (error) {
      throw error;
    }

    setAnalysisProgress(75);

    // Validate the simplified response structure
    if (!data || typeof data.overallScore !== 'number' || typeof data.isFit !== 'boolean') {
      throw new Error('Invalid analysis response received');
    }

    return data;
  };

  const analyzeJobFit = async (
    jobDescription: string, 
    keywordMatchType: string = 'exact'
  ): Promise<SimplifiedAnalysisResult | null> => {
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      
      // Validate input
      const validationError = validateJobDescription(jobDescription);
      if (validationError) {
        throw new Error(validationError);
      }
      
      // Clear previous data
      clearAllJobAnalysisData();
      storeJobDescription(jobDescription);
      setAnalysisProgress(10);

      // Perform analysis with retry logic
      const data = await retryWithDelay(
        () => performAnalysis(jobDescription, keywordMatchType),
        ANALYSIS_CONSTANTS.MAX_RETRIES
      );

      setAnalysisProgress(85);

      // Store results
      localStorage.setItem('jobAnalysisResult', JSON.stringify(data));
      setAnalysisProgress(90);

      // Simple routing based on fit status
      if (data.isFit && data.experienceIdsByRole && data.bulletKeywords) {
        console.log(`Score ${data.overallScore}% - generating bullets...`);
        
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
          // Fall back to analysis results
          toast({
            title: 'Analysis Complete',
            description: 'Analysis completed but bullet generation failed.',
          });
          navigate('/app/job-analysis-result');
        }
      } else {
        setAnalysisProgress(100);
        
        console.log(`Score ${data.overallScore}% - showing analysis results`);
        
        toast({
          title: 'Analysis Complete',
          description: `Job fit: ${data.overallScore}%. ${data.isFit ? 'Ready for bullets!' : 'Improvements needed.'}`,
        });
        
        navigate('/app/job-analysis-result');
      }

      return data;
      
    } catch (error) {
      const analysisError = handleAnalysisError(error);
      
      toast({
        title: 'Analysis Failed',
        description: analysisError.message,
        variant: 'destructive',
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
