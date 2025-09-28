import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BulletPoint {
  text: string;
  visualWidth: number;
  exceedsWidth: boolean;
  wasOptimized?: boolean;
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
  bulletOrganization: BulletCompany[];
  keywordsUsed: string[];
  keywordsNotUsed: string[];
  requirementsMatched: string[];
  criticalRequirementsAddressed: string[];
  generatedFrom: {
    totalExperiences: number;
    rolesProcessed: number;
    keywordCategories: number;
    totalRequirements: number;
    keywordMatchType: string;
    scoreThreshold: number | string;
  };
}

interface BulletGenerationError {
  code: string;
  message: string;
  details?: string;
}

export const useResumeBullets = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const { toast } = useToast();

  const validateAnalysisData = (analysisResult: any): string | null => {
    if (!analysisResult) {
      return 'Analysis result is required';
    }

    if (!analysisResult.experienceIdsByRole) {
      return 'Missing experience data from job fit analysis. Please run job analysis first.';
    }

    if (!analysisResult.bulletKeywords) {
      return 'Missing bullet keywords from job fit analysis. Please run job analysis first.';
    }

    if (!analysisResult.jobRequirements) {
      return 'Missing job requirements from job fit analysis. Please run job analysis first.';
    }

    if (typeof analysisResult.experienceIdsByRole !== 'object' || 
        Object.keys(analysisResult.experienceIdsByRole).length === 0) {
      return 'No relevant experiences found for bullet generation.';
    }

    // Check score threshold
    const score = analysisResult.overallScore || analysisResult.fitAssessment?.overallScore || 0;
    if (score < 80) {
      return `Job fit score of ${score}% is below the 80% threshold required for bullet generation.`;
    }

    return null;
  };

  const handleBulletError = (error: any): BulletGenerationError => {
    console.error('Bullet generation error:', error);

    if (error?.message?.includes('80% threshold')) {
      return {
        code: 'SCORE_TOO_LOW',
        message: 'Job fit score is too low for bullet generation.',
        details: 'Please improve your profile match before generating bullets.',
      };
    }

    if (error?.message?.includes('Missing required Supabase')) {
      return {
        code: 'CONFIG_ERROR',
        message: 'System configuration error.',
        details: 'Please contact support if this persists.',
      };
    }

    if (error?.message?.includes('No valid experience IDs')) {
      return {
        code: 'NO_EXPERIENCES',
        message: 'No relevant experiences found.',
        details: 'Please add more detailed experiences before generating bullets.',
      };
    }

    if (error?.message?.includes('Invalid JSON') || error?.message?.includes('truncated')) {
      return {
        code: 'GENERATION_ERROR',
        message: 'Bullet generation was incomplete.',
        details: 'Try with a shorter job description or fewer experiences.',
      };
    }

    if (error?.message?.includes('OpenAI API')) {
      return {
        code: 'API_ERROR',
        message: 'AI service temporarily unavailable.',
        details: 'Please try again in a moment.',
      };
    }

    return {
      code: 'UNKNOWN',
      message: error?.message || 'Failed to generate resume bullets.',
      details: 'Please try again or contact support if the issue persists.',
    };
  };

  const validateBulletResult = (data: any): string | null => {
    if (!data || typeof data !== 'object') {
      return 'Invalid response format received';
    }

    if (!data.bulletOrganization || !Array.isArray(data.bulletOrganization)) {
      return 'No bullet points were generated';
    }

    if (data.bulletOrganization.length === 0) {
      return 'Bullet generation produced no results';
    }

    // Check if bullets contain actual content
    const hasBullets = data.bulletOrganization.some((company: any) =>
      company.roles?.some((role: any) =>
        role.bulletPoints?.length > 0
      )
    );

    if (!hasBullets) {
      return 'Generated bullets are empty';
    }

    return null;
  };

  const generateResumeBullets = async (
    analysisResult: any
  ): Promise<ResumeBulletsResult | null> => {
    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      
      // Validate input data
      const validationError = validateAnalysisData(analysisResult);
      if (validationError) {
        throw new Error(validationError);
      }
      
      setGenerationProgress(10);
      
      // Clear previous results
      localStorage.removeItem('resumeBullets');
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please log in to generate resume bullets');
      }

      setGenerationProgress(25);
      
      // Get keyword matching type with fallback
      const keywordMatchType = localStorage.getItem('keywordMatchType') || 'exact';
      
      console.log('Calling generate-resume-bullets function...');
      console.log('Data being sent:', {
        experienceIdsByRole: Object.keys(analysisResult.experienceIdsByRole || {}),
        bulletKeywords: Object.keys(analysisResult.bulletKeywords || {}),
        jobRequirements: (analysisResult.jobRequirements || []).length,
        keywordMatchType,
      });
      
      setGenerationProgress(40);
      
      // Call the edge function
      const { data, error } = await supabase.functions.invoke('generate-resume-bullets', {
        body: { 
          experienceIdsByRole: analysisResult.experienceIdsByRole,
          bulletKeywords: analysisResult.bulletKeywords,
          jobRequirements: analysisResult.jobRequirements,
          overallScore: analysisResult.overallScore || analysisResult.fitAssessment?.overallScore,
          keywordMatchType: keywordMatchType
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      setGenerationProgress(70);

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      // Validate the response
      const resultValidationError = validateBulletResult(data);
      if (resultValidationError) {
        throw new Error(resultValidationError);
      }

      setGenerationProgress(85);
      
      console.log('Resume bullets generated successfully:', {
        companies: data.bulletOrganization?.length || 0,
        keywordsUsed: data.keywordsUsed?.length || 0,
        keywordsNotUsed: data.keywordsNotUsed?.length || 0,
      });

      // Store the result
      localStorage.setItem('resumeBullets', JSON.stringify(data));
      setGenerationProgress(100);

      toast({
        title: 'Resume Bullets Generated',
        description: `Successfully created bullets for ${data.bulletOrganization?.length || 0} companies.`,
      });

      return data;
      
    } catch (error) {
      const bulletError = handleBulletError(error);
      
      toast({
        title: 'Generation Failed',
        description: bulletError.message,
        variant: 'destructive',
        ...(bulletError.details && {
          action: {
            altText: 'Details',
            onClick: () => {
              toast({
                title: 'Error Details',
                description: bulletError.details,
                variant: 'destructive',
              });
            },
          },
        }),
      });
      
      return null;
      
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  return {
    generateResumeBullets,
    isGenerating,
    generationProgress,
  };
};
