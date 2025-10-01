import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { Logger } from './utils/logger.ts';
import { AnalysisError, validateJobDescription } from './validation/response-validator.ts';
import { extractJobRequirements } from './stages/stage1-extraction.ts';
import { matchCandidateToJob } from './stages/stage2-matching.ts';
import { getCachedStage1Results, setCachedStage1Results } from './cache.ts';
import { enrichRolesWithDuration } from './matching/experience-calculator.ts';
import { CONSTANTS } from './constants.ts';
import type { 
  ExperienceWithRole, 
  Education, 
  UnifiedAnalysisResult,
  BulletPoint 
} from './types.ts';

const logger = new Logger();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-keyword-match-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment validation
    const openaiApiKey = Deno.env.get('ANALYZE_JOB_FIT_OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new AnalysisError(
        'Missing required environment variables. Check ANALYZE_JOB_FIT_OPENAI_API_KEY, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY',
        'CONFIG_ERROR',
        500
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new AnalysisError('Authorization required', 'AUTH_REQUIRED', 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new AnalysisError('Authentication failed', 'AUTH_FAILED', 401);
    }

    logger.info('Analysis request received', { userId: user.id });

    // Get request data
    const { jobDescription } = await req.json();
    
    // Validate job description
    const validation = validateJobDescription(jobDescription);
    if (!validation.valid) {
      throw new AnalysisError(validation.error!, 'INVALID_INPUT', 400);
    }

    const keywordMatchType = (req.headers.get('x-keyword-match-type') || 'exact') as 'exact' | 'flexible';

    logger.info('Request validated', {
      userId: user.id,
      jdLength: jobDescription.trim().length,
      keywordMatchType
    });

    // Fetch user experiences with role information
    const { data: experiences, error: expError } = await supabase
      .from('experiences')
      .select(`
        *,
        roles!inner(
          id,
          title,
          specialty,
          start_date,
          end_date,
          companies!inner(name)
        )
      `)
      .eq('user_id', user.id);

    if (expError || !experiences?.length) {
      throw new AnalysisError(
        'No experiences found. Please add professional experiences before analyzing job fit.',
        'NO_EXPERIENCES',
        400
      );
    }

    logger.info('User data fetched', {
      userId: user.id,
      experiencesCount: experiences.length
    });

    // Fetch user education
    const { data: education, error: eduError } = await supabase
      .from('education')
      .select('*')
      .eq('user_id', user.id);

    if (eduError) {
      logger.warn('Error fetching education', {
        userId: user.id,
        error: eduError.message
      });
    }

    const educationInfo: Education[] = education?.map(edu => ({
      id: edu.id,
      user_id: edu.user_id,
      degree: edu.degree,
      field: edu.field,
      school: edu.school,
      graduation_date: edu.graduation_date,
      is_expected_graduation: edu.is_expected_graduation,
      created_at: edu.created_at,
      updated_at: edu.updated_at
    })) || [];

    // Extract unique roles
    const rolesMap = new Map();
    const experiencesWithRoles: ExperienceWithRole[] = experiences;
    
    experiencesWithRoles.forEach(exp => {
      const roleKey = `${exp.roles.id}`;
      if (!rolesMap.has(roleKey)) {
        rolesMap.set(roleKey, {
          id: exp.roles.id,
          user_id: user.id,
          company_id: exp.roles.companies.name, // We'll use company name
          title: exp.roles.title,
          specialty: exp.roles.specialty,
          start_date: exp.roles.start_date,
          end_date: exp.roles.end_date,
          is_current: exp.roles.end_date === null,
          created_at: exp.created_at,
          updated_at: exp.updated_at
        });
      }
    });
    
    const userRoles = enrichRolesWithDuration(
      Array.from(rolesMap.values()),
      '' // Company name already in role
    );

    // Group experiences by role
    const experiencesByRole: Record<string, ExperienceWithRole[]> = {};
    experiencesWithRoles.forEach(exp => {
      const roleKey = `${exp.roles.companies.name} - ${exp.roles.title}`;
      if (!experiencesByRole[roleKey]) {
        experiencesByRole[roleKey] = [];
      }
      experiencesByRole[roleKey].push(exp);
    });

    logger.info('Data organized', {
      userId: user.id,
      rolesCount: userRoles.length,
      educationCount: educationInfo.length,
      roleGroups: Object.keys(experiencesByRole).length
    });

    // STAGE 1: Extract requirements (with caching)
    let stage1Results;
    const cachedStage1 = await getCachedStage1Results(supabase, user.id, jobDescription.trim());
    
    if (cachedStage1) {
      logger.info('Using cached Stage 1 results', { userId: user.id });
      stage1Results = cachedStage1;
    } else {
      stage1Results = await extractJobRequirements(
        openaiApiKey,
        jobDescription.trim(),
        user.id
      );
      
      // Cache the results
      await setCachedStage1Results(supabase, user.id, jobDescription.trim(), stage1Results);
    }

    // STAGE 2: Match candidate to job
    const stage2Results = await matchCandidateToJob(
      openaiApiKey,
      stage1Results,
      experiencesByRole,
      educationInfo,
      userRoles,
      keywordMatchType,
      user.id
    );

    // Build unified response
    const analysis: UnifiedAnalysisResult = {
      ...stage2Results,
      jobRequirements: stage1Results.jobRequirements,
      allKeywords: stage1Results.allKeywords,
      jobTitle: stage1Results.jobTitle,
      companySummary: stage1Results.companySummary,
      actionPlan: {
        readyForApplication: stage2Results.isFit,
        readyForBulletGeneration: stage2Results.isFit,
        criticalGaps: stage2Results.criticalGaps || [],
        absoluteGaps: stage2Results.absoluteGaps || []
      }
    };

    // Format resume bullets if fit
    if (analysis.isFit && analysis.bulletPoints) {
      const companyRoleMap: Record<string, any[]> = {};
      
      Object.entries(analysis.bulletPoints).forEach(([roleKey, bullets]) => {
        const dashIndex = roleKey.indexOf(' - ');
        if (dashIndex === -1) return;
        
        const company = roleKey.substring(0, dashIndex).trim();
        const role = roleKey.substring(dashIndex + 3).trim();
        
        if (!companyRoleMap[company]) {
          companyRoleMap[company] = [];
        }
        
        companyRoleMap[company].push({
          title: role,
          bulletPoints: bullets
        });
      });

      const bulletOrganization = Object.entries(companyRoleMap).map(([company, roles]) => ({
        name: company,
        roles: roles
      }));

      analysis.resumeBullets = {
        bulletOrganization,
        keywordsUsed: analysis.keywordsUsed || [],
        keywordsNotUsed: analysis.keywordsNotUsed || [],
        generatedFrom: {
          totalExperiences: experiences.length,
          keywordMatchType: keywordMatchType,
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
      userId: user.id,
      score: analysis.overallScore,
      isFit: analysis.isFit,
      hasAbsoluteGaps: (analysis.absoluteGaps?.length || 0) > 0
    });

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Analysis failed', error as Error, {
      errorType: error instanceof AnalysisError ? error.code : 'UNKNOWN'
    });
    
    let statusCode = 500;
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error instanceof AnalysisError) {
      statusCode = error.statusCode;
      errorCode = error.code;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      code: errorCode
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
