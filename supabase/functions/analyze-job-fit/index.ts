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

// HTTP HANDLER
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { jobDescription, userId, keywordMatchType = 'flexible' } = await req.json();

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
      throw new Error('OPENAI_API_KEY not configured');
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

    // ===== FETCH USER DATA FROM DATABASE =====
    
    // 1. Fetch Education
    const { data: educationData, error: educationError } = await supabaseClient
      .from('education')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (educationError) {
      logger.error('Failed to fetch education', { userId, error: educationError.message });
      throw new Error(`Failed to fetch education: ${educationError.message}`);
    }

    // 2. Fetch Companies and Roles
    const { data: companiesData, error: companiesError } = await supabaseClient
      .from('companies')
      .select(`
        *,
        roles (*)
      `)
      .eq('user_id', userId)
      .order('start_date', { ascending: false });

    if (companiesError) {
      logger.error('Failed to fetch companies', { userId, error: companiesError.message });
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    // 3. Fetch Experiences with Role and Company data
    const { data: experiencesData, error: experiencesError } = await supabaseClient
      .from('experiences')
      .select(`
        *,
        roles (
          *,
          companies (*)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

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

    // ===== TRANSFORM DATA =====

    // Build experiencesByRole structure
    const experiencesByRole: Record<string, ExperienceWithRole[]> = {};
    (experiencesData || []).forEach((exp: any) => {
      const roleKey = `${exp.roles.companies.name} - ${exp.roles.title}`;
      if (!experiencesByRole[roleKey]) {
        experiencesByRole[roleKey] = [];
      }
      experiencesByRole[roleKey].push(exp as ExperienceWithRole);
    });

    // Build userRoles with durations
    const userRoles: RoleWithDuration[] = [];
    (companiesData || []).forEach((company: any) => {
      (company.roles || []).forEach((role: any) => {
        userRoles.push({
          ...role,
          company: company.name,
          durationMonths: calculateRoleDuration(role.start_date, role.end_date),
          durationYears: Math.floor(calculateRoleDuration(role.start_date, role.end_date) / 12)
        });
      });
    });

    const educationInfo = (educationData || []) as Education[];

    logger.info('Starting analysis', {
      userId,
      experienceRoles: Object.keys(experiencesByRole).length,
      totalExperiences: Object.values(experiencesByRole).flat().length,
      rolesCount: userRoles.length,
      educationCount: educationInfo.length
    });

    // ===== RUN ANALYSIS =====

    // Stage 1: Extract job requirements
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
        readyForApplication: stage2aResults.isFit && !stage2aResults.absoluteGaps?.length,
        readyForBulletGeneration: stage2aResults.isFit,
        criticalGaps: stage2aResults.criticalGaps || [],
        absoluteGaps: stage2aResults.absoluteGaps || []
      }
    };

    // Add resume bullets metadata if generated
    if (bulletData.bulletPoints) {
      unifiedResults.resumeBullets = {
        bulletOrganization: Object.entries(bulletData.bulletPoints).map(([roleKey, bullets]) => {
          const [companyName, roleTitle] = roleKey.split(' - ');
          return {
            name: companyName,
            roles: [{
              title: roleTitle,
              bulletPoints: bullets
            }]
          };
        }),
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
      hasBullets: !!unifiedResults.bulletPoints,
      readyForApplication: unifiedResults.actionPlan.readyForApplication
    });

    return new Response(JSON.stringify(unifiedResults), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    logger.error('HTTP handler error', { 
      error: error.message,
      stack: error.stack 
    });
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
