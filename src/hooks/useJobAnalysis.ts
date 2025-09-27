import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { storeJobKeyPhrases, storeJobDescription, storeRelevantExperiences, clearAllJobAnalysisData } from '@/utils/jobAnalysis';
import { useResumeBullets } from '@/hooks/useResumeBullets';

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
  const { generateResumeBullets } = useResumeBullets();

  const analyzeJobFit = async (jobDescription: string): Promise<AnalysisResult | null> => {
    try {
      setIsAnalyzing(true);
      
      // Clear all previous job analysis data to prevent mixing
      clearAllJobAnalysisData();
      
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

      // Store relevant experiences if they exist
      if (data.relevantExperiences) {
        storeRelevantExperiences(data.relevantExperiences);
      }

      // Store the complete analysis result
      localStorage.setItem('jobAnalysisResult', JSON.stringify(data));

      // If score is 80% or higher, generate resume bullets and navigate to bullets page
      if (data.overallScore && data.overallScore >= 80 && data.experienceIdsByRole) {
        console.log('Score at or above 80%, generating resume bullets...');
        
        await generateResumeBullets(data);
        
        // Navigate directly to resume bullets page
        navigate('/app/resume-bullets');
      } else {
        // Navigate to detailed analysis page for scores below 80%
        navigate('/app/job-analysis-result');
      }

      toast({
        title: 'Analysis Complete',
        description: data.overallScore && data.overallScore >= 80 
          ? 'Resume bullets have been generated successfully.'
          : 'Your job fit analysis has been completed successfully.',
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
