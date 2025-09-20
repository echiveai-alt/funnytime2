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
      id: exp.id,
      company: exp.roles.companies.name,
      role: exp.roles.title,
      title: exp.title,
      situation: exp.situation,
      task: exp.task,
      action: exp.action,
      result: exp.result,
      tags: exp.keywords || []
    }));

// Create structured prompt for comprehensive job fit analysis
    const prompt = `
Analyze the provided professional experience against the job description using the following structured approach. Extract key phrases comprehensively from both the job description and experiences.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE EXPERIENCES:
${JSON.stringify(formattedExperiences, null, 2)}

ANALYSIS REQUIREMENTS:

Step 1: Key Phrase Extraction
From the job description, extract and categorize ALL relevant phrases including:
A. Technical Skills: Programming languages, frameworks, tools, software, methodologies
B. Soft Skills: Leadership, communication, analytical thinking, problem-solving
C. Industry Terms: Domain-specific terminology, business concepts, processes  
D. Qualifications: Education, certifications, experience levels, specializations
E. Job Functions: Specific responsibilities, job duties, operational tasks

For EACH category, extract both individual keywords AND multi-word phrases that are meaningful.

Step 2: Comprehensive Experience Matching
For each extracted phrase, search through ALL parts of the candidate's experiences:
- Job titles and company names
- Situation descriptions
- Task definitions  
- Action details
- Result statements
- User-provided tags

Include synonyms and related terms (e.g., "JavaScript" matches "JS", "machine learning" matches "ML", "led team" matches "managed team").

Step 3: Evidence-Based Scoring
For each requirement, provide:
- Direct matches: Exact phrase found in experience
- Synonym matches: Related/equivalent terms found
- Context matches: Phrases that demonstrate the skill indirectly
- Evidence quality: Strong/Moderate/Weak/None with specific citations

Step 4: Most Relevant Experiences Selection
For each role, identify the top 6 most relevant experiences based on:
- Direct alignment with job requirements
- Quality and impact of results achieved
- Transferable skills demonstrated
- Evidence strength for key job phrases

Step 5: Comprehensive Analysis Output
Provide detailed analysis including matched and unmatched phrases with context.

IMPORTANT: Return the analysis in this JSON format:
{
  "extractedJobPhrases": [
    {
      "phrase": "specific phrase from job description",
      "category": "technical|soft_skill|industry|qualification|function",
      "importance": "high|medium|low"
    }
  ],
  "matchedPhrases": [
    {
      "jobPhrase": "phrase from job description",
      "experienceMatch": "matching text found in experience",
      "experienceContext": "situation|task|action|result|title|tag",
      "matchType": "exact|synonym|related",
      "evidenceStrength": "strong|moderate|weak"
    }
  ],
  "unmatchedPhrases": [
    {
      "phrase": "unmatched phrase from job description", 
      "category": "technical|soft_skill|industry|qualification|function",
      "importance": "high|medium|low",
      "reason": "why this wasn't found in experience"
    }
  ],
  "relevantExperiences": [
    {
      "id": "experience ID",
      "roleTitle": "role title",
      "companyName": "company name", 
      "title": "experience title",
      "situation": "situation text",
      "task": "task text",
      "action": "action text",
      "result": "result text",
      "tags": ["array", "of", "tags"],
      "relevanceScore": 85,
      "matchingPhrases": ["phrases from job description that this experience addresses"]
    }
  ],
  "overallScore": [number from 0-100],
  "fitLevel": "[Excellent|Good|Fair|Poor]",
  "strengths": ["list of key strengths that align with the job"],
  "gaps": ["list of areas where experience may be lacking"],
  "recommendations": ["list of specific recommendations"],
  "summary": "A 2-3 sentence summary of the overall assessment"
}`;

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
        
        // Log extracted key phrases for debugging
        if (analysis.extractedJobPhrases) {
          console.log('Extracted key phrases:', analysis.extractedJobPhrases);
        }
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