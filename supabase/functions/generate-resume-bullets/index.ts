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
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Authentication failed');
    }

    const { jobDescription, relevantExperiences, selectedKeywords } = await req.json();

    console.log('Generating resume bullets for user:', user.id);
    console.log('Selected keywords:', selectedKeywords);
    console.log('Relevant experiences count:', relevantExperiences?.length || 0);

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

    // Group experiences by company and role
    const experiencesByRole = relevantExperiences?.reduce((acc: any, exp: any) => {
      const key = `${exp.companyName}-${exp.roleTitle}`;
      if (!acc[key]) {
        acc[key] = {
          companyName: exp.companyName,
          roleTitle: exp.roleTitle,
          experiences: []
        };
      }
      acc[key].experiences.push(exp);
      return acc;
    }, {}) || {};

    // Create comprehensive prompt for Gemini
    const prompt = `You are a professional resume writer specializing in creating impactful bullet points. Create up to 6 resume bullet points for each role based on the user's STAR format experiences and job description alignment.

CRITICAL REQUIREMENTS:
1. ACCURACY: Only use information explicitly provided in the user's experiences - never invent or exaggerate
2. KEYWORDS: Naturally integrate these selected keywords where they fit: ${selectedKeywords?.join(', ') || ''}
3. STRUCTURE: Use "Result, Action, Context" OR "Action, Context, Result" OR "Action, Result"
4. NO abbreviations unless they appear in the job description
5. NO em-dashes, colons, or semicolons
6. Each bullet point MUST be under 179 visual width score
7. Prioritize experiences with quantified results
8. Maximum 6 bullets per role

JOB DESCRIPTION:
${jobDescription}

USER EXPERIENCES BY ROLE:
${Object.values(experiencesByRole).map((role: any) => `
Company: ${role.companyName}
Role: ${role.roleTitle}

Experiences:
${role.experiences.map((exp: any, idx: number) => `
${idx + 1}. Title: ${exp.title}
   Situation: ${exp.situation}
   Task: ${exp.task}
   Action: ${exp.action}
   Result: ${exp.result}
   Tags: ${exp.tags?.join(', ') || 'None'}
`).join('')}
`).join('\n')}

Return ONLY a JSON object with this exact structure:
{
  "companies": [
    {
      "name": "Company Name",
      "roles": [
        {
          "title": "Role Title",
          "bulletPoints": [
            "bullet point 1",
            "bullet point 2"
          ]
        }
      ]
    }
  ],
  "missingKeywords": ["keyword1", "keyword2"]
}

Remember:
- Use ONLY the information provided in the user's experiences
- Integrate selected keywords naturally where appropriate
- Keep bullet points professional and impactful
- Focus on achievements and results where available
- Each bullet point must be factually accurate to the user's actual experience`;

    // Call Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
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
        },
      }),
    });

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
    console.log('Generated text:', generatedText);

    // Parse JSON response from Gemini
    let bulletData;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = generatedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : generatedText;
      bulletData = JSON.parse(jsonText);
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
            console.log(`Bullet: "${bullet}" - Visual Width: ${visualWidth}`);
            return {
              text: bullet,
              visualWidth,
              exceedsWidth: visualWidth > 179
            };
          }) || []
        })) || []
      })) || [],
      missingKeywords: bulletData.missingKeywords || []
    };

    console.log('Resume bullets generated successfully');
    
    return new Response(JSON.stringify(validatedBullets), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-resume-bullets function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to generate resume bullets' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});