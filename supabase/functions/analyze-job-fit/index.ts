import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MINIMAL DEBUG VERSION - Step by step logging
serve(async (req) => {
  console.log('🟢 1. Function invoked - Method:', req.method);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log('🟢 2. CORS preflight - returning OK');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🟢 3. Parsing request body...');
    const body = await req.json();
    console.log('🟢 4. Body parsed:', { 
      hasJobDescription: !!body.jobDescription,
      hasUserId: !!body.userId,
      jdLength: body.jobDescription?.length 
    });

    const { jobDescription, userId } = body;

    if (!userId) {
      throw new Error('userId is required');
    }

    if (!jobDescription || jobDescription.length < 100) {
      throw new Error('jobDescription is required and must be at least 100 characters');
    }

    console.log('🟢 5. Checking environment variables...');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    console.log('🟢 6. Environment check:', {
      hasOpenAI: !!openaiApiKey,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseAnonKey
    });

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('🟢 7. Creating Supabase client...');
    const supabaseClient = createClient(
      supabaseUrl ?? '',
      supabaseAnonKey ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    console.log('🟢 8. Fetching education data...');
    const { data: educationData, error: educationError } = await supabaseClient
      .from('education')
      .select('*')
      .eq('user_id', userId);

    if (educationError) {
      console.error('❌ Education fetch error:', educationError);
      throw new Error(`Education fetch failed: ${educationError.message}`);
    }
    console.log('🟢 9. Education fetched:', educationData?.length || 0, 'records');

    console.log('🟢 10. Fetching companies data...');
    const { data: companiesData, error: companiesError } = await supabaseClient
      .from('companies')
      .select('*, roles (*)')
      .eq('user_id', userId);

    if (companiesError) {
      console.error('❌ Companies fetch error:', companiesError);
      throw new Error(`Companies fetch failed: ${companiesError.message}`);
    }
    console.log('🟢 11. Companies fetched:', companiesData?.length || 0, 'records');

    console.log('🟢 12. Fetching experiences data...');
    const { data: experiencesData, error: experiencesError } = await supabaseClient
      .from('experiences')
      .select(`
        *,
        roles (
          *,
          companies (*)
        )
      `)
      .eq('user_id', userId);

    if (experiencesError) {
      console.error('❌ Experiences fetch error:', experiencesError);
      throw new Error(`Experiences fetch failed: ${experiencesError.message}`);
    }
    console.log('🟢 13. Experiences fetched:', experiencesData?.length || 0, 'records');

    // For now, just return the data we fetched to verify database connection
    console.log('🟢 14. Returning test response...');
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database connection successful!',
        data: {
          educationCount: educationData?.length || 0,
          companiesCount: companiesData?.length || 0,
          experiencesCount: experiencesData?.length || 0,
          userId: userId,
          hasOpenAIKey: !!openaiApiKey
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ ERROR:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        type: error.name
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/*
TESTING CHECKLIST:
1. ✅ Function receives request
2. ✅ CORS headers work
3. ✅ Request body parsed
4. ✅ Environment variables set
5. ✅ Supabase client created
6. ✅ Database queries work (education, companies, experiences)
7. ✅ Returns successful response

If ANY step fails, you'll see exactly which number (🟢) didn't appear in logs
*/
