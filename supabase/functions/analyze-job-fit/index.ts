import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractJobRequirements } from './stages/stage1-extraction.ts';
import { matchCandidateToJob } from './stages/stage2a-matching.ts';
import { generateBullets } from './stages/stage2b-bullets.ts';
import { 
  ExperienceWithRole, 
  Education, 
  RoleWithDuration, 
  UnifiedAnalysisResult,
  Role,
  Company
} from './types/index.ts';
import { Logger } from './utils/logger.ts';
import { validateJobDescription } from './validation/response-validator.ts';
import { CONSTANTS } from './constants.ts';
import { calculateRoleDuration } from './matching/experience-calculator.ts';

const logger = new Logger();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { jobDescription, userId, keywordMatchType = 'flexible' } = await req.json();

    logger.info('Request received', {
      userId,
      jdLength: jobDescription?.length,
      keywordMatchType
    });

    // Validate inputs
    if (!userId) {
      throw new Error('userId is required');
    }

    const validation = validateJobDescription(jobDescription);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      logger.error('OPENAI_API_KEY not configured', { userId });
      throw new Error('Server configuration error - OPENAI_API_KEY not set');
    }

    // Create Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    logger.info('Fetching user data', { userId });

    // ===== FETCH USER DATA FROM DATABASE (PARALLEL QUERIES) =====
    
    // OPTIMIZED: Run all queries in parallel instead of sequentially
    const [
      { data: educationData, error: educationError },
      { data: companiesData, error: companiesError },
      { data: experiencesData, error: experiencesError }
    ] = await Promise.all([
      // 1. Fetch Education
      supabaseClient
        .from('education')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      
      // 2. Fetch Companies and Roles
      supabaseClient
        .from('companies')
        .select(`
          *,
          roles (*)
        `)
        .eq('user_id', userId)
        .order('start_date', { ascending: false }),
      
      // 3. Fetch Experiences with Role and Company data
      supabaseClient
        .from('experiences')
        .select(`
          *,
          roles (
            *,
            companies (*)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false})
    ]);

    // Error handling for parallel queries
    if (educationError) {
      logger.error('Failed to fetch education', { userId, error: educationError.message });
      throw new Error(`Failed to fetch education: ${educationError.message}`);
    }

    if (companiesError) {
      logger.error('Failed to fetch companies', { userId, error: companiesError.message });
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    if (experiencesError) {
      logger.error('Failed to fetch experiences', { userId, error: experiencesError.message });
      throw new Error(`Failed to fetch experiences: ${experiencesError.message}`);
    }

    logger.info('User data fetched', {
      userId,
      educationCount: educationData?.length || 0,
      companiesCount: companiesData?.length || 0,
      experiencesCount: experiencesData?.length || 0
    });

    // Check if user has data
    if (!experiencesData || experiencesData.length === 0) {
      logger.warn('No experiences found for user', { userId });
      return new Response(
        JSON.stringify({ 
          error: 'No professional experiences found. Please add at least one experience with STAR format details before analyzing job fit.' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // ===== TRANSFORM DATA =====

    // Build experiencesByRole structure
    const experiencesByRole: Record<string, ExperienceWithRole[]> = {};
    
    if (experiencesData && experiencesData.length > 0) {
      experiencesData.forEach((exp: any) => {
        const roleKey = `${exp.roles.companies.name} - ${exp.roles.title}`;
        if (!experiencesByRole[roleKey]) {
          experiencesByRole[roleKey] = [];
        }
        experiencesByRole[roleKey].push(exp as ExperienceWithRole);
      });
    }

    // Build userRoles with durations
    const userRoles: RoleWithDuration[] = [];
    
    if (companiesData && companiesData.length > 0) {
      companiesData.forEach((company: any) => {
        if (company.roles && Array.isArray(company.roles)) {
          company.roles.forEach((role: any) => {
            const roleDuration = calculateRoleDuration(role.start_date, role.end_date);
            userRoles.push({
              ...role,
              company: company.name,
              durationMonths: roleDuration,
              durationYears: Math.floor(roleDuration / 12)
            } as RoleWithDuration);
          });
        }
      });
    }

    const educationInfo: Education[] = (educationData || []) as Education[];

    logger.info('Starting analysis', {
      userId,
      experienceRoles: Object.keys(experiencesByRole).length,
      totalExperiences: Object.values(experiencesByRole).flat().length,
      rolesCount: userRoles.length,
      educationCount: educationInfo.length,
      keywordMatchType
    });

    // ===== RUN ANALYSIS =====

    // Stage 1: Extract job requirements
    logger.info('Starting Stage 1: Job requirement extraction', { userId });
    const stage1Results = await extractJobRequirements(
      openaiApiKey,
      jobDescription,
      userId
    );

    logger.info('Stage 1 complete', {
      userId,
      requirementsExtracted: stage1Results.jobRequirements.length,
      keywordsExtracted: stage1Results.allKeywords.length,
      jobTitle: stage1Results.jobTitle
    });

    // Stage 2a: Match candidate to job
    logger.info('Starting Stage 2a: Candidate matching', { userId });
    const stage2aResults = await matchCandidateToJob(
      openaiApiKey,
      stage1Results,
      experiencesByRole,
      educationInfo,
      userRoles,
      userId
    );

    logger.info('Stage 2a complete', {
      userId,
      score: stage2aResults.overallScore,
      isFit: stage2aResults.isFit,
      matchedCount: stage2aResults.matchedRequirements.length,
      unmatchedCount: stage2aResults.unmatchedRequirements.length
    });

    // Stage 2b: Generate bullets (only if fit)
    let bulletData: {
      bulletPoints?: Record<string, any[]>;
      keywordsUsed?: string[];
      keywordsNotUsed?: string[];
    } = {};

    if (stage2aResults.isFit) {
      logger.info('Candidate is a fit - generating bullets', { userId });
      
      bulletData = await generateBullets(
        openaiApiKey,
        experiencesByRole,
        stage2aResults.matchedRequirements,
        stage1Results.allKeywords,
        keywordMatchType,
        userId
      );

      logger.info('Stage 2b complete', {
        userId,
        totalBullets: Object.values(bulletData.bulletPoints || {}).reduce((sum, arr) => sum + arr.length, 0),
        keywordsUsed: bulletData.keywordsUsed?.length || 0,
        keywordsNotUsed: bulletData.keywordsNotUsed?.length || 0
      });
    } else {
      logger.info('Candidate is not a fit - skipping bullet generation', { 
        userId,
        score: stage2aResults.overallScore 
      });
    }

    // ===== BUILD UNIFIED RESPONSE =====
    const unifiedResults: UnifiedAnalysisResult = {
      // Stage 1
      jobRequirements: stage1Results.jobRequirements,
      allKeywords: stage1Results.allKeywords,
      jobTitle: stage1Results.jobTitle,
      companySummary: stage1Results.companySummary,

      // Stage 2a
      overallScore: stage2aResults.overallScore,
      isFit: stage2aResults.isFit,
      fitLevel: stage2aResults.fitLevel,
      matchedRequirements: stage2aResults.matchedRequirements,
      unmatchedRequirements: stage2aResults.unmatchedRequirements,
      absoluteGaps: stage2aResults.absoluteGaps,
      absoluteGapExplanation: stage2aResults.absoluteGapExplanation,
      criticalGaps: stage2aResults.criticalGaps,
      recommendations: stage2aResults.recommendations,

      // Stage 2b
      bulletPoints: bulletData.bulletPoints,
      keywordsUsed: bulletData.keywordsUsed,
      keywordsNotUsed: bulletData.keywordsNotUsed,

      // Action plan
      actionPlan: {
        readyForApplication: stage2aResults.isFit,
        readyForBulletGeneration: stage2aResults.isFit,
        criticalGaps: stage2aResults.criticalGaps || [],
        absoluteGaps: stage2aResults.absoluteGaps
      }
    };

    // If fit, create resumeBullets structure for UI
    if (stage2aResults.isFit && bulletData.bulletPoints) {
      const bulletOrganization: Array<{
        name: string;
        roles: Array<{
          title: string;
          bulletPoints: any[];
        }>;
      }> = [];

      // Group by company
      const companiesBullets: Record<string, Record<string, any[]>> = {};
      
      Object.entries(bulletData.bulletPoints).forEach(([roleKey, bullets]) => {
        const [companyName, roleTitle] = roleKey.split(' - ');
        
        if (!companiesBullets[companyName]) {
          companiesBullets[companyName] = {};
        }
        
        companiesBullets[companyName][roleTitle] = bullets;
      });

      // Convert to array format
      Object.entries(companiesBullets).forEach(([companyName, roles]) => {
        const rolesArray = Object.entries(roles).map(([roleTitle, bulletPoints]) => ({
          title: roleTitle,
          bulletPoints
        }));

        bulletOrganization.push({
          name: companyName,
          roles: rolesArray
        });
      });

      unifiedResults.resumeBullets = {
        bulletOrganization,
        keywordsUsed: bulletData.keywordsUsed || [],
        keywordsNotUsed: bulletData.keywordsNotUsed || [],
        generatedFrom: {
          totalExperiences: Object.values(experiencesByRole).flat().length,
          keywordMatchType,
          scoreThreshold: CONSTANTS.FIT_THRESHOLD,
          visualWidthRange: {
            min: CONSTANTS.VISUAL_WIDTH_MIN,
            max: CONSTANTS.VISUAL_WIDTH_MAX,
            target: CONSTANTS.VISUAL_WIDTH_TARGET
          }
        }
      };
    }

    logger.info('Analysis complete', {
      userId,
      overallScore: unifiedResults.overallScore,
      isFit: unifiedResults.isFit,
      hasBullets: !!unifiedResults.resumeBullets
    });

    return new Response(
      JSON.stringify(unifiedResults),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    logger.error('Edge function error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
