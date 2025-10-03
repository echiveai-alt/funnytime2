import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { storeJobDescription, clearAllJobAnalysisData } from '@/utils/jobAnalysis';
import { useNavigate } from 'react-router-dom';

const ANALYSIS_CONSTANTS = {
  MIN_SCORE_FOR_BULLETS: 80,
  MIN_JOB_DESCRIPTION_LENGTH: 400,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
} as const;

interface UnifiedAnalysisResult {
  overallScore: number;
  fitLevel: string;
  isFit: boolean;
  jobRequirements: Array<any>;
  matchedRequirements: Array<any>;
  unmatchedRequirements: Array<any>;
  allKeywords: string[];
  bulletPoints?: Record<string, any[]>;
  keywordsUsed?: string[];
  keywordsNotUsed?: string[];
  resumeBullets?: {
    bulletOrganization: any[];
    keywordsUsed: string[];
    keywordsNotUsed: string[];
    generatedFrom: any;
  };
  matchableKeywords?: string[];
  unmatchableKeywords?: string[];
  criticalGaps?: string[];
  absoluteGaps?: string[];
  absoluteGapExplanation?: string;
  recommendations?: {
    forCandidate: string[];
  };
  actionPlan: {
    readyForApplication: boolean;
    readyForBulletGeneration: boolean;
    criticalGaps?: string[];
    absoluteGaps?: string[];
  };
}

export const useJobAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const { toast } = useToast();
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

  const handleAnalysisError = (error: any): { code: string; message: string; retryable: boolean } => {
    console.error('Analysis error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    if (error?.message?.includes('FunctionsRelayError') || 
        error?.message?.includes('Function not found') ||
        error?.message?.includes('404')) {
      return {
        code: 'FUNCTION_NOT_FOUND',
        message: 'Edge function not found. Please check if the function is deployed in Supabase.',
        retryable: false,
      };
    }

    if (error?.message?.includes('CONFIG_ERROR') || 
        error?.message?.includes('Missing required environment variables')) {
      return {
        code: 'CONFIG_ERROR',
        message: 'Server configuration error. Please check environment variables in Supabase Edge Functions settings.',
        retryable: false,
      };
    }
    
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
    
    if (error?.message?.includes('authentication') || 
        error?.message?.includes('401') ||
        error?.message?.includes('AUTH_FAILED')) {
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

    if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network connection error. Please check your connection and try again.',
        retryable: true,
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
      const errorInfo = handleAnalysisError(error);
      
      if (retries > 0 && errorInfo.retryable) {
        console.log(`Retrying analysis, ${retries} attempts remaining...`);
        return new Promise(resolve => {
          setTimeout(() => resolve(retryWithDelay(fn, retries - 1)), ANALYSIS_CONSTANTS.RETRY_DELAY_MS);
        });
      }
      throw error;
    });
  };

  const performAnalysis = async (jobDescription: string, keywordMatchType: string): Promise<UnifiedAnalysisResult> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Please log in to analyze job fit');
    }

    setAnalysisProgress(25);

    console.log('About to invoke edge function with:', {
      functionName: 'analyze-job-fit',
      hasSession: !!session,
      userId: session.user.id,
      bodyLength: jobDescription.length,
      keywordMatchType
    });

    console.log('Calling unified analyze-job-fit edge function...');

    const { data, error } = await supabase.functions.invoke('analyze-job-fit', {
      body: { 
        jobDescription,
        userId: session.user.id,
        keywordMatchType
      }
    });

    // ✅ ENHANCED LOGGING
    console.log('=== EDGE FUNCTION RESPONSE ===');
    console.log('Has data:', !!data);
    console.log('Has error:', !!error);
    
    if (data) {
      console.log('Data type:', typeof data);
      console.log('Data keys:', Object.keys(data));
      console.log('Full data:', JSON.stringify(data, null, 2));
      
      // Check if this is the test response (wrong deployment)
      if (data.success && data.message === 'Database connection successful!') {
        console.error('❌ WRONG DEPLOYMENT: Edge Function is returning test response, not analysis!');
        throw new Error('Edge Function deployment error: Function is returning test data instead of analysis. Please redeploy the production version of index.ts');
      }
      
      // Check for embedded error
      if (data.error) {
        console.error('❌ Error embedded in response data:', data.error);
      }
      
      // Check for expected properties
      console.log('Has overallScore:', 'overallScore' in data, typeof data.overallScore);
      console.log('Has isFit:', 'isFit' in data, typeof data.isFit);
      console.log('Has jobRequirements:', 'jobRequirements' in data);
      console.log('Has matchedRequirements:', 'matchedRequirements' in data);
    }
    
    if (error) {
      console.error('❌ Error object:', JSON.stringify(error, null, 2));
    }
    console.log('=== END RESPONSE ===');

    if (error) {
      console.error('Edge function error:', error);
      
      if (error.message?.includes('FunctionsRelayError')) {
        throw new Error('Edge function not found or not deployed. Please verify the function "analyze-job-fit" is deployed in your Supabase project.');
      }
      
      if (error.context?.body) {
        console.error('Error response body:', error.context.body);
        throw new Error(error.context.body.error || error.message);
      }
      
      throw error;
    }

    // Check if we got an error in the response data itself
    if (data?.error) {
      console.error('Error in response data:', data.error);
      throw new Error(data.error);
    }

    setAnalysisProgress(90);

    // Validate response with more detailed error
    if (!data) {
      throw new Error('No data returned from Edge Function');
    }
    
    if (typeof data.overallScore !== 'number') {
      console.error('Invalid overallScore:', data.overallScore, typeof data.overallScore);
      throw new Error(`Invalid response: overallScore is ${typeof data.overallScore}, expected number. Response: ${JSON.stringify(data)}`);
    }
    
    if (typeof data.isFit !== 'boolean') {
      console.error('Invalid isFit:', data.isFit, typeof data.isFit);
      throw new Error(`Invalid response: isFit is ${typeof data.isFit}, expected boolean. Response: ${JSON.stringify(data)}`);
    }

    console.log('✅ Valid response received:', {
      overallScore: data.overallScore,
      isFit: data.isFit,
      hasResumeBullets: !!data.resumeBullets
    });

    return data;
  };

  const analyzeJobFit = async (
    jobDescription: string, 
    keywordMatchType: string = 'exact'
  ): Promise<UnifiedAnalysisResult | null> => {
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      
      console.log('Starting job analysis with:', {
        descriptionLength: jobDescription.length,
        keywordMatchType
      });
      
      const validationError = validateJobDescription(jobDescription);
      if (validationError) {
        throw new Error(validationError);
      }
      
      clearAllJobAnalysisData();
      storeJobDescription(jobDescription);
      setAnalysisProgress(10);

      const data = await retryWithDelay(
        () => performAnalysis(jobDescription, keywordMatchType),
        ANALYSIS_CONSTANTS.MAX_RETRIES
      );

      setAnalysisProgress(95);

      console.log('Storing analysis results...');
      localStorage.setItem('jobAnalysisResult', JSON.stringify(data));
      
      if (data.resumeBullets) {
        console.log('Storing resume bullets...');
        localStorage.setItem('resumeBullets', JSON.stringify(data.resumeBullets));
      }

      setAnalysisProgress(100);

      console.log(`Score ${data.overallScore}% - ${data.isFit ? 'bullets generated' : 'showing gap analysis'}`);
      
      toast({
        title: 'Analysis Complete',
        description: data.isFit 
          ? 'Resume bullets have been generated successfully.' 
          : `Job fit: ${data.overallScore}%. Improvements needed.`,
      });
      
      navigate('/app/job-analysis-result');

      return data;
      
    } catch (error) {
      const analysisError = handleAnalysisError(error);
      
      console.error('Final error handler:', {
        code: analysisError.code,
        message: analysisError.message,
        retryable: analysisError.retryable
      });
      
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
