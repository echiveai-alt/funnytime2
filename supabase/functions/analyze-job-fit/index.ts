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

    // ===== API KEY CONFIGURATION WITH FALLBACK =====
    // Get OpenAI API keys with fallback for backwards compatibility
    // This allows gradual migration: set stage-specific keys when ready,
    // or continue using the single OPENAI_API_KEY for all stages
    const fallbackKey = Deno.env.get('OPENAI_API_KEY');
    const stage1ApiKey = Deno.env.get('OPENAI_API_KEY_STAGE1') || fallbackKey;
    const stage2aApiKey = Deno.env.get('OPENAI_API_KEY_STAGE2A') || fallbackKey;
    const stage2bApiKey = Deno.env.get('OPENAI_API_KEY_STAGE2B') || fallbackKey;

    // Validate at least one key configuration path is available
    if (!stage1ApiKey || !stage2aApiKey || !stage2bApiKey) {
      const missing = [];
      if (!stage1ApiKey) missing.push('OPENAI_API_KEY_STAGE1 or OPENAI_API_KEY');
      if (!stage2aApiKey) missing.push('OPENAI_API_KEY_STAGE2A or OPENAI_API_KEY');
      if (!stage2bApiKey) missing.push('OPENAI_API_KEY_STAGE2B or OPENAI_API_KEY');
      
      logger.error('Missing API keys', { userId, missing });
      throw new Error(`Server configuration error - Missing API keys: ${missing.join(', ')}`);
    }

    // Log which keys are being used (for debugging/monitoring)
    // Using console.log for better visibility in Supabase logs
    const keyConfig = {
      stage1: stage1ApiKey === fallbackKey ? 'using fallback' : 'using dedicated key',
      stage2a: stage2aApiKey === fallbackKey ? 'using fallback' : 'using dedicated key',
      stage2b: stage2bApiKey === fallbackKey ? 'using fallback' : 'using dedicated key',
      hasFallbackKey: !!fallbackKey,
      hasStage1Key: !!Deno.env.get('OPENAI_API_KEY_STAGE1'),
      hasStage2aKey: !!Deno.env.get('OPENAI_API_KEY_STAGE2A'),
      hasStage2bKey: !!Deno.env.get('OPENAI_API_KEY_STAGE2B')
    };
    
    console.log('='.repeat(70));
    console.log('🔑 API KEY CONFIGURATION');
    console.log('='.repeat(70));
    console.log(JSON.stringify(keyConfig, null, 2));
    console.log('='.repeat(70));
    
    logger.info('API key configuration', { userId, ...keyConfig });

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

    // ===== RUN ANALYSIS - THREE STAGES WITH DEDICATED API KEYS =====

    // Stage 1: Extract job requirements (using stage1ApiKey)
    logger.info('Starting Stage 1: Job requirement extraction', { userId });
    const stage1Results = await extractJobRequirements(
      stage1ApiKey,  // ← Stage-specific API key
      jobDescription,
      userId
    );

    logger.info('Stage 1 complete', {
      userId,
      requirementsExtracted: stage1Results.jobRequirements.length,
      keywordsExtracted: stage1Results.allKeywords.length,
      jobTitle: stage1Results.jobTitle
    });

    // Stage 2a: Match candidate to job (using stage2aApiKey)
    logger.info('Starting Stage 2a: Candidate matching', { userId });
    const stage2aResults = await matchCandidateToJob(
      stage2aApiKey,  // ← Stage-specific API key
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

    // Stage 2b: Generate bullets (only if fit, using stage2bApiKey)
    let bulletData: {
      bulletPoints?: Record<string, any[]>;
      keywordsUsed?: string[];
      keywordsNotUsed?: string[];
    } = {};

    if (stage2aResults.isFit) {
      logger.info('Candidate is a fit - generating bullets', { userId });
      
      bulletData = await generateBullets(
        stage2bApiKey,  // ← Stage-specific API key
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

      // Stage 2b (only if fit)
      bulletPoints: bulletData.bulletPoints,
      keywordsUsed: bulletData.keywordsUsed,
      keywordsNotUsed: bulletData.keywordsNotUsed,

      // Resume bullets format (for backwards compatibility)
      // In supabase/functions/analyze-job-fit/index.ts
// Replace the resumeBullets section with this:

// Resume bullets format (reorganized by company)
resumeBullets: bulletData.bulletPoints ? (() => {
  // Group bullets by company
  const bulletsByCompany: Record<string, { 
    roles: Array<{ 
      title: string; 
      bulletPoints: any[]; 
      startDate: string;
    }> 
  }> = {};
  
  Object.entries(bulletData.bulletPoints).forEach(([roleKey, bullets]) => {
    const [companyName, roleTitle] = roleKey.split(' - ');
    
    // Find the role's start date for sorting
    const role = userRoles.find(r => r.company === companyName && r.title === roleTitle);
    const startDate = role?.start_date || '1900-01-01';
    
    if (!bulletsByCompany[companyName]) {
      bulletsByCompany[companyName] = { roles: [] };
    }
    
    bulletsByCompany[companyName].roles.push({
      title: roleTitle,
      bulletPoints: bullets,
      startDate
    });
  });
  
  // Sort roles within each company by date (most recent first)
  Object.values(bulletsByCompany).forEach(company => {
    company.roles.sort((a, b) => {
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
  });
  
  // Convert to array and sort companies by most recent role start date
  const bulletOrganization = Object.entries(bulletsByCompany)
    .map(([companyName, companyData]) => {
      const mostRecentDate = companyData.roles[0].startDate;
      return {
        name: companyName,
        roles: companyData.roles.map(({ title, bulletPoints }) => ({
          title,
          bulletPoints
        })),
        _sortDate: mostRecentDate
      };
    })
    .sort((a, b) => {
      return new Date(b._sortDate).getTime() - new Date(a._sortDate).getTime();
    })
    .map(({ name, roles }) => ({ name, roles })); // Remove sort field
  
  logger.info('Bullet organization complete', {
    userId,
    companiesCount: bulletOrganization.length,
    totalRoles: bulletOrganization.reduce((sum, c) => sum + c.roles.length, 0),
    totalBullets: bulletOrganization.reduce((sum, c) => 
      sum + c.roles.reduce((roleSum, r) => roleSum + r.bulletPoints.length, 0), 0
    )
  });
  
  return {
    bulletOrganization,
    keywordsUsed: bulletData.keywordsUsed || [],
    keywordsNotUsed: bulletData.keywordsNotUsed || [],
    generatedFrom: {
      totalExperiences: Object.values(experiencesByRole).flat().length,
      keywordMatchType,
      scoreThreshold: 80,
      visualWidthRange: {
        min: 70,
        max: 95,
        target: 85
      }
    }
  };
})() : undefined,

      // Action plan
      actionPlan: {
        readyForApplication: stage2aResults.isFit,
        readyForBulletGeneration: stage2aResults.isFit,
        criticalGaps: stage2aResults.criticalGaps
      }
    };

    logger.info('Analysis complete', {
      userId,
      score: unifiedResults.overallScore,
      isFit: unifiedResults.isFit,
      bulletsGenerated: !!unifiedResults.bulletPoints
    });

    return new Response(
      JSON.stringify(unifiedResults),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    logger.error('Analysis failed', {
      error: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({ 
        error: error.message || 'Analysis failed unexpectedly'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
