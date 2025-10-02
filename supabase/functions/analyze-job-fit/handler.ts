import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeJobFit } from './core.ts';
import { Logger } from './utils/logger.ts';
import { validateJobDescription } from './validation/response-validator.ts';

const logger = new Logger();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!openaiApiKey) {
      logger.error('Missing OPENAI_API_KEY', new Error('Configuration error'));
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      logger.error('Authentication failed', userError || new Error('No user'));
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { jobDescription, keywordMatchType = 'exact' } = await req.json();

    // Validate job description
    const validation = validateJobDescription(jobDescription);
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info('Request received', {
      userId: user.id,
      jdLength: jobDescription.length,
      keywordMatchType
    });

    // Fetch user's profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('free_analyses_used, free_bullets_generated, subscription_tier')
      .eq('user_id', user.id)
      .single();

    // Check free tier limits
    if (!profile?.subscription_tier || profile.subscription_tier === 'free') {
      const analysesUsed = profile?.free_analyses_used || 0;
      if (analysesUsed >= 10) {
        return new Response(
          JSON.stringify({ 
            error: 'Free analysis limit reached',
            limitReached: true,
            type: 'analysis_limit'
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch user's experiences grouped by role
    const { data: experiences } = await supabase
      .from('experiences')
      .select('*')
      .eq('user_id', user.id);

    const experiencesByRole: Record<string, any[]> = {};
    (experiences || []).forEach((exp: any) => {
      const key = `${exp.company_name} - ${exp.role_title}`;
      if (!experiencesByRole[key]) {
        experiencesByRole[key] = [];
      }
      experiencesByRole[key].push(exp);
    });

    // Fetch user's education
    const { data: education } = await supabase
      .from('education')
      .select('*')
      .eq('user_id', user.id);

    // Fetch user's roles
    const { data: roles } = await supabase
      .from('roles')
      .select('*')
      .eq('user_id', user.id);

    const userRoles = (roles || []).map((r: any) => ({
      roleTitle: r.role_title,
      companyName: r.company_name,
      startDate: r.start_date,
      endDate: r.end_date
    }));

    // Perform analysis
    const results = await analyzeJobFit(
      openaiApiKey,
      jobDescription,
      experiencesByRole,
      education || [],
      userRoles,
      keywordMatchType,
      user.id
    );

    // Update usage counters
    const analysesUsed = (profile?.free_analyses_used || 0) + 1;
    let bulletsGenerated = profile?.free_bullets_generated || 0;
    
    if (results.bulletPoints) {
      bulletsGenerated += 1;
    }

    await supabase
      .from('profiles')
      .update({ 
        free_analyses_used: analysesUsed,
        free_bullets_generated: bulletsGenerated
      })
      .eq('user_id', user.id);

    // Check if bullet limit reached (after this generation)
    if (results.bulletPoints && bulletsGenerated >= 3 && (!profile?.subscription_tier || profile.subscription_tier === 'free')) {
      results.limitReached = true;
    }

    logger.info('Analysis completed successfully', {
      userId: user.id,
      score: results.overallScore,
      isFit: results.isFit
    });

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logger.error('Handler error', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
