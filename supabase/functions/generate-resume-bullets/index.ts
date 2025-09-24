import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    // Get analysis results from job fit analysis function
    const { 
      experienceIdsByRole, 
      bulletKeywords, 
      jobRequirements,
      jobDescription 
    } = await req.json();

    if (!experienceIdsByRole || !bulletKeywords) {
      throw new Error('Missing required data from job fit analysis. Please run job fit analysis first with score >= 85%.');
    }

    console.log('Generating resume bullets for user:', user.id);
    console.log('Experience IDs by role:', Object.keys(experienceIdsByRole));
    console.log('Bullet keywords:', bulletKeywords);

    // Fetch the actual experience data using the IDs from job fit analysis
    const allExperienceIds = Object.values(experienceIdsByRole)
      .flatMap((roleData: any) => roleData.experienceIds);

    const { data: experiences, error: expError } = await supabase
      .from('experiences')
      .select(`
        *,
        roles!inner(
          title,
          companies!inner(name)
        )
      `)
      .in('id', allExperienceIds)
      .eq('user_id', user.id);

    if (expError) {
      throw new Error('Failed to fetch experiences: ' + expError.message);
    }

    if (!experiences || experiences.length === 0) {
      throw new Error('No experiences found for provided IDs');
    }

    // Format experiences and group by role according to job fit analysis results
    const formattedExperiencesByRole = {};
    
    Object.entries(experienceIdsByRole).forEach(([roleKey, roleData]: [string, any]) => {
      const roleExperiences = experiences
        .filter(exp => roleData.experienceIds.includes(exp.id))
        .map(exp => ({
          id: exp.id,
          company: exp.roles.companies.name,
          role: exp.roles.title,
          title: exp.title,
          situation: exp.situation,
          task: exp.task,
          action: exp.action,
          result: exp.result,
          tags: exp.tags || []
        }));

      formattedExperiencesByRole[roleKey] = {
        companyName: roleData.company,
        roleTitle: roleData.roleTitle,
        experiences: roleExperiences
      };
    });

    // Calculate visual width score
    const calculateVisualWidth = (text: string): number => {
      let score = 0;
      for (const char of text) {
        if (char === ' ') score += 0.55;
        else if (['W', 'M', '@', '%', '&'].includes(char)) score += 1.25;
        else if (['m', 'w', 'Q', 'G', 'O', 'D', 'B', 'H', 'N', 'U', 'A', 'K', 'R'].includes(char)) score += 1.15;
        else if (['i', 'l', 'j', 't', 'f', 'r', 'I', 'J', '1', '!', ';', ':', '.', ',', "'", '"', '`', '|', '/'].includes(char)) score += 0.55;
        else if (char === '-') score += 0.70;
        else if (['0', '2', '3', '4', '5', '6', '7', '8', '9'].includes(char)) score += 1.00;
        else if (char >= 'A' && char <= 'Z') score += 1.10;
        else if (char >= 'a' && char <= 'z') score += 1.00;
        else score += 0.80; // other punctuation
      }
      return score;
    };

    // Create optimized prompt using extracted keywords instead of full job description
    const createBulletPrompt = () => {
      return `You are a professional resume writer. Create up to 6 impactful resume bullet points for each role using ONLY the user's provided experiences.

KEYWORDS TO INTEGRATE (from job analysis):
Technical: ${bulletKeywords.technical?.join(', ') || 'None'}
Action Verbs: ${bulletKeywords.actionVerbs?.join(', ') || 'None'}
Industry Terms: ${bulletKeywords.industry?.join(', ') || 'None'}
Metrics: ${bulletKeywords.metrics?.join(', ') || 'None'}
Responsibilities: ${bulletKeywords.responsibilities?.join(', ') || 'None'}

KEY REQUIREMENTS (from job):
${jobRequirements?.technical?.map((req: any) => `• ${req.phrase} (${req.importance})`).join('\n') || ''}

CRITICAL RULES:
1. Use ONLY information from user's experiences - never invent details
2. Integrate keywords naturally where they fit the actual experience
3. Structure: "Action, Context, Result" or "Result from Action"
4. No abbreviations, em-dashes, colons, semicolons
5. Each bullet MUST be under 179 visual width score
6. Prioritize quantified results
7. Maximum 6 bullets per role

USER EXPERIENCES BY ROLE:
${Object.entries(formattedExperiencesByRole).map(([roleKey, roleData]: [string, any]) => `
Company: ${roleData.companyName}
Role: ${roleData.roleTitle}

Experiences:
${roleData.experiences.map((exp: any, idx: number) => `
${idx + 1}. Title: ${exp.title}
   Situation: ${exp.situation}
   Task: ${exp.task}
   Action: ${exp.action}
   Result: ${exp.result}
   Tags: ${exp.tags?.join(', ') || 'None'}
`).join('')}
`).join('\n')}

Return ONLY JSON:
{
  "companies": [
    {
      "name": "Company Name",
      "roles": [
        {
          "title": "Role Title",
          "bulletPoints": ["bullet 1", "bullet 2"]
        }
      ]
    }
  ],
  "keywordsUsed": ["keywords successfully integrated"],
  "keywordsNotUsed": ["keywords that didn't fit naturally"]
}`;
    };

    const prompt = createBulletPrompt();

    // Call Gemini API with optimized settings
    const response = await fetch(
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
            temperature: 0.2,  // Low for consistency
            topK: 30,
            topP: 0.9,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Gemini API response received');

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response from Gemini API');
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    console.log('Generated text preview:', generatedText.substring(0, 200) + '...');

    // Parse JSON response
    let bulletData;
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      bulletData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      console.error('Raw text:', generatedText);
      throw new Error('Failed to parse bullet points from AI response');
    }

    // Validate and calculate visual width for each bullet point
    const validatedBullets = {
      companies: bulletData.companies?.map((company: any) => ({
        name: company.name,
        roles: company.roles?.map((role: any) => ({
          title: role.title,
          bulletPoints: role.bulletPoints?.map((bullet: string) => {
            const visualWidth = calculateVisualWidth(bullet);
            console.log(`Bullet: "${bullet.substring(0, 50)}..." - Visual Width: ${visualWidth}`);
            return {
              text: bullet,
              visualWidth,
              exceedsWidth: visualWidth > 179
            };
          }) || []
        })) || []
      })) || [],
      keywordsUsed: bulletData.keywordsUsed || [],
      keywordsNotUsed: bulletData.keywordsNotUsed || [],
      generatedFrom: {
        totalExperiences: allExperienceIds.length,
        rolesProcessed: Object.keys(experienceIdsByRole).length,
        keywordCategories: Object.keys(bulletKeywords).length
      }
    };

    console.log('Resume bullets generated successfully');
    console.log('Keywords used:', validatedBullets.keywordsUsed);
    console.log('Keywords not used:', validatedBullets.keywordsNotUsed);
    
    return new Response(JSON.stringify(validatedBullets), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-resume-bullets function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to generate resume bullets',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
