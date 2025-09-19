import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { storeJobKeyPhrases, storeJobDescription } from '@/utils/jobAnalysis';

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
}

export const useJobAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const analyzeJobFit = async (jobDescription: string): Promise<AnalysisResult | null> => {
    try {
      setIsAnalyzing(true);
      
      // Store job description locally
      storeJobDescription(jobDescription);

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please log in to analyze job fit');
      }

      // Call the analyze-job-fit edge function
      const { data, error } = await supabase.functions.invoke('analyze-job-fit', {
        body: { jobDescription },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      // Store key phrases locally if they exist
      if (data.extractedJobPhrases) {
        storeJobKeyPhrases(data.extractedJobPhrases);
      }

      // Store the complete analysis result
      localStorage.setItem('jobAnalysisResult', JSON.stringify(data));

      toast({
        title: 'Analysis Complete',
        description: 'Your job fit analysis has been completed successfully.',
      });

      return data;
    } catch (error) {
      console.error('Job analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze job fit. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    analyzeJobFit,
    isAnalyzing,
  };
};