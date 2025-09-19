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

    // Create structured prompt for comprehensive job fit analysis
    const prompt = `
Analyze the provided professional experience against the job description using the following structured approach. Maintain objectivity and provide specific evidence for all assessments.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE EXPERIENCES:
${JSON.stringify(formattedExperiences, null, 2)}

Step 1: Extract and Categorize Job Requirements
From the job description, identify and list:
A. Hard Skills/Technical Requirements
Programming languages, software, tools
Technical methodologies, frameworks
Industry-specific knowledge
Certifications or licenses required

B. Soft Skills/Competencies
Leadership abilities
Communication skills
Problem-solving approaches
Collaboration/teamwork
Project management capabilities

C. Experience Requirements
Years of experience (total and in specific areas)
Industry experience
Company size/type experience
Role level/seniority

D. Education/Credentials
Degree requirements
Specific educational background
Professional certifications
Continuing education

Step 2: Evidence-Based Matching
For each requirement identified in Step 1, search the professional experience for:
Direct evidence: Explicit mentions with context
Indirect evidence: Related experiences that demonstrate the skill
Quantifiable proof: Metrics, outcomes, duration, scope

Use this format for each requirement:
Requirement: [Specific requirement from job description]
Evidence Found: [Specific examples from experience with context]
Evidence Quality: Strong/Moderate/Weak/None
Supporting Details: [Metrics, duration, scope, outcomes]

Step 3: Scored Assessment
Rate each requirement using this 5-point scale:
4 - Exceeds Requirements: Extensive evidence with measurable outcomes, experience goes beyond what's required, multiple examples demonstrating mastery
3 - Fully Meets Requirements: Clear, direct evidence matching the requirement, sufficient depth and breadth of experience, demonstrable competency with results
2 - Partially Meets Requirements: Some relevant experience but gaps in depth/breadth, related but not directly matching experience, limited evidence or unclear outcomes
1 - Minimal Evidence: Very limited or tangential evidence, experience exists but lacks depth or relevance, no clear outcomes demonstrated
0 - No Evidence: No relevant experience found, requirement not addressed in any capacity

Step 4: Summary Analysis
Overall Match Assessment
Strong Matches (Score 3-4): [List with brief explanations]
Partial Matches (Score 2): [List with brief explanations]
Significant Gaps (Score 0-1): [List with brief explanations]

Quantitative Summary
Total requirements assessed: [Number]
Requirements fully/strongly met (3-4): [Number and percentage]
Requirements partially met (2): [Number and percentage]
Requirements not met (0-1): [Number and percentage]
Overall Match Percentage: [Calculate weighted average]

Gap Analysis
Critical Missing Elements: [Requirements scored 0-1 that appear essential]
Development Areas: [Requirements scored 2 that could be strengthened]
Competitive Advantages: [Requirements scored 4 where candidate exceeds expectations]

Step 5: Recommendations
Skills/experiences to emphasize in application
Areas for professional development
How to better present existing experience

IMPORTANT: After completing the full analysis above, provide a summary in the following JSON format:
{
  "overallScore": [number from 0-100 based on weighted average],
  "fitLevel": "[Excellent|Good|Fair|Poor]",
  "strengths": ["list of 3-5 key strengths that align with the job"],
  "gaps": ["list of 3-5 areas where experience may be lacking"],
  "recommendations": ["list of 3-5 specific recommendations for the candidate"],
  "keywordMatch": {
    "matchedKeywords": ["keywords from job description found in experiences"],
    "missingKeywords": ["important keywords from job description not found in experiences"]
  },
  "summary": "A 2-3 sentence summary of the overall assessment",
  "detailedAnalysis": {
    "hardSkills": {
      "requirements": ["list of technical requirements found"],
      "matches": ["requirements that were fully/strongly met"],
      "gaps": ["requirements that were not met or only partially met"]
    },
    "softSkills": {
      "requirements": ["list of soft skill requirements found"],
      "matches": ["requirements that were fully/strongly met"],
      "gaps": ["requirements that were not met or only partially met"]
    },
    "experienceLevel": {
      "required": "description of experience level required",
      "candidate": "assessment of candidate's experience level",
      "match": "Strong/Moderate/Weak"
    }
  }
}

Analysis Standards:
- Be specific and cite exact text when providing evidence
- Avoid assumptions or inferences not supported by the text
- Consider context and scope, not just keyword matches
- Maintain consistency in scoring criteria across all requirements
- Focus on demonstrable experience rather than stated skills without context`;

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