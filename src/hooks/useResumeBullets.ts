import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BulletPoint {
  text: string;
  visualWidth: number;
  exceedsWidth: boolean;
}

interface BulletRole {
  title: string;
  bulletPoints: BulletPoint[];
}

interface BulletCompany {
  name: string;
  roles: BulletRole[];
}

export interface ResumeBulletsResult {
  companies: BulletCompany[];
  missingKeywords: string[];
}

export const useResumeBullets = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateResumeBullets = async (
    analysisResult: any
  ): Promise<ResumeBulletsResult | null> => {
    try {
      setIsGenerating(true);
      
      // Clear previous resume bullets to prevent mixing
      localStorage.removeItem('resumeBullets');
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please log in to generate resume bullets');
      }

      console.log('Calling generate-resume-bullets function...');
      
      // Get the keyword matching type from localStorage
      const keywordMatchType = localStorage.getItem('keywordMatchType') || 'exact';
      
      // Call the generate-resume-bullets edge function with analysis data
      const { data, error } = await supabase.functions.invoke('generate-resume-bullets', {
        body: { 
          experienceIdsByRole: analysisResult.experienceIdsByRole,
          bulletKeywords: analysisResult.bulletKeywords,
          jobRequirements: analysisResult.extractedJobPhrases,
          keywordMatchType: keywordMatchType
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      console.log('Resume bullets generated:', data);

      // Store the result in localStorage
      localStorage.setItem('resumeBullets', JSON.stringify(data));

      toast({
        title: 'Resume Bullets Generated',
        description: 'Your resume bullet points have been created successfully.',
      });

      return data;
      
    } catch (error) {
      console.error('Resume bullets generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate resume bullets. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateResumeBullets,
    isGenerating,
  };
};