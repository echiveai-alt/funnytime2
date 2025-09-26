import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApiKeyResult {
  exists: boolean;
  length: number;
  prefix: string;
  apiTest?: string;
}

interface TestResults {
  analyzeJobFitKey: ApiKeyResult;
  generateResumeBulletsKey: ApiKeyResult;
  originalOpenaiKey: ApiKeyResult;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Testing API key configuration...');

    // Test analyze-job-fit API key
    const analyzeKey = Deno.env.get('ANALYZE_JOB_FIT_OPENAI_API_KEY');
    const bulletKey = Deno.env.get('GENERATE_RESUME_BULLETS_OPENAI_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    const results: TestResults = {
      analyzeJobFitKey: {
        exists: !!analyzeKey,
        length: analyzeKey?.length || 0,
        prefix: analyzeKey?.substring(0, 10) + '...' || 'Not found'
      },
      generateResumeBulletsKey: {
        exists: !!bulletKey,
        length: bulletKey?.length || 0,
        prefix: bulletKey?.substring(0, 10) + '...' || 'Not found'  
      },
      originalOpenaiKey: {
        exists: !!openaiKey,
        length: openaiKey?.length || 0,
        prefix: openaiKey?.substring(0, 10) + '...' || 'Not found'
      },
      timestamp: new Date().toISOString()
    };

    // Test API connectivity for analyze-job-fit key
    if (analyzeKey) {
      try {
        const testResponse = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${analyzeKey}`
          }
        });
        results.analyzeJobFitKey.apiTest = testResponse.ok ? 'SUCCESS' : `FAILED: ${testResponse.status}`;
      } catch (error) {
        results.analyzeJobFitKey.apiTest = `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    // Test API connectivity for generate-resume-bullets key
    if (bulletKey) {
      try {
        const testResponse = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${bulletKey}`
          }
        });
        results.generateResumeBulletsKey.apiTest = testResponse.ok ? 'SUCCESS' : `FAILED: ${testResponse.status}`;
      } catch (error) {
        results.generateResumeBulletsKey.apiTest = `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    console.log('API Key Test Results:', JSON.stringify(results, null, 2));

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in test-api-keys function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Test failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});