import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!geminiApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    const { jobDescription } = await req.json();

    if (!jobDescription) {
      throw new Error('Job description is required');
    }

    // Fetch user's experiences
    const { data: experiences, error: experiencesError } = await supabase
      .from('experiences')
      .select(`
        *,
        roles!inner(
          title,
          companies!inner(name)
        )
      `)
      .eq('user_id', user.id);

    if (experiencesError) {
      throw new Error('Failed to fetch experiences: ' + experiencesError.message);
    }

    if (!experiences || experiences.length === 0) {
      throw new Error('No experiences found. Please add at least one experience before analyzing job fit.');
    }

    // Format experiences for AI analysis
    const formattedExperiences = experiences.map(exp => ({
      company: exp.roles.companies.name,
      role: exp.roles.title,
      title: exp.title,
      situation: exp.situation,
      task: exp.task,
      action: exp.action,
      result: exp.result,
      keywords: exp.keywords || []
    }));

    // Create prompt for Gemini
    const prompt = `
You are an expert career counselor and recruiter. Analyze the following job description against the candidate's work experiences and provide a comprehensive assessment.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE EXPERIENCES:
${JSON.stringify(formattedExperiences, null, 2)}

Please provide a detailed analysis in the following JSON format:
{
  "overallScore": [number from 0-100],
  "fitLevel": "[Excellent|Good|Fair|Poor]",
  "strengths": ["list of 3-5 key strengths that align with the job"],
  "gaps": ["list of 3-5 areas where experience may be lacking"],
  "recommendations": ["list of 3-5 specific recommendations for the candidate"],
  "keywordMatch": {
    "matchedKeywords": ["keywords from job description found in experiences"],
    "missingKeywords": ["important keywords from job description not found in experiences"]
  },
  "summary": "A 2-3 sentence summary of the overall assessment"
}

Focus on:
1. Technical skills alignment
2. Experience level match
3. Industry/domain relevance
4. Leadership and soft skills
5. Career progression compatibility

Be honest but constructive in your assessment.`;

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates || !geminiData.candidates[0]) {
      throw new Error('Invalid response from Gemini API');
    }

    const responseText = geminiData.candidates[0].content.parts[0].text;
    
    // Extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    let analysis;
    
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Failed to parse JSON from Gemini response:', parseError);
        throw new Error('Failed to parse analysis results');
      }
    } else {
      throw new Error('No valid JSON found in Gemini response');
    }

    console.log('Job fit analysis completed successfully');

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-job-fit function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});