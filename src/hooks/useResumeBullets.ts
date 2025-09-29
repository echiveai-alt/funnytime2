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

    // Simplified validation for the new structure
    if (!analysisResult.isFit) {
      return `Job fit score of ${analysisResult.overallScore}% is below the 80% threshold required for bullet generation.`;
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
