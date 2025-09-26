import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Visual width scoring constants
const VISUAL_WIDTH_LIMIT = 179;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('GENERATE_RESUME_BULLETS_OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiApiKey) {
      throw new Error('Missing GENERATE_RESUME_BULLETS_OPENAI_API_KEY environment variable');
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required Supabase environment variables');
    }

    console.log('generate-resume-bullets: Using dedicated OpenAI API key');

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
    const requestBody = await req.json();
    const { 
      experienceIdsByRole, 
      bulletKeywords, 
      jobRequirements,
      overallScore, // Add score validation
      keywordMatchType = 'exact'
    } = requestBody;

    console.log('Request body keys:', Object.keys(requestBody));
    console.log('experienceIdsByRole type:', typeof experienceIdsByRole);
    console.log('bulletKeywords type:', typeof bulletKeywords);
    console.log('jobRequirements type:', typeof jobRequirements);
    console.log('overallScore:', overallScore);
    console.log('keywordMatchType:', keywordMatchType);

    // Enhanced validation with score threshold enforcement
    if (overallScore && overallScore < 85) {
      throw new Error(`Job fit score of ${overallScore}% is below the 85% threshold required for bullet generation. Please improve your job fit first.`);
    }

    if (!experienceIdsByRole) {
      throw new Error('Missing experienceIdsByRole from job fit analysis. Ensure job fit analysis has been completed first.');
    }
    
    if (!bulletKeywords) {
      throw new Error('Missing bulletKeywords from job fit analysis. Please run job fit analysis first.');
    }

    if (!jobRequirements) {
      throw new Error('Missing jobRequirements from job fit analysis. Please run job fit analysis first.');
    }
    
    if (typeof experienceIdsByRole !== 'object' || Object.keys(experienceIdsByRole).length === 0) {
      throw new Error('experienceIdsByRole must be a non-empty object with role keys.');
    }
    
    if (typeof bulletKeywords !== 'object') {
      throw new Error('bulletKeywords must be an object with keyword categories.');
    }

    if (!Array.isArray(jobRequirements)) {
      throw new Error('jobRequirements must be an array.');
    }

    console.log('Generating resume bullets for user:', user.id);
    console.log('Experience IDs by role:', Object.keys(experienceIdsByRole));
    console.log('Bullet keywords:', bulletKeywords);
    console.log('Job requirements count:', jobRequirements.length);

    // Fetch the actual experience data using the IDs from job fit analysis
    const allExperienceIds = Object.values(experienceIdsByRole)
      .flatMap((roleData: any) => {
        if (!roleData?.experienceIds || !Array.isArray(roleData.experienceIds)) {
          console.warn('Invalid roleData structure:', roleData);
          return [];
        }
        return roleData.experienceIds;
      })
      .filter(id => id); // Remove any undefined/null IDs
    
    if (allExperienceIds.length === 0) {
      throw new Error('No valid experience IDs found in experienceIdsByRole.');
    }

    const { data: experiences, error: expError } = await supabase
      .from('experiences')
      .select(`
        *,
        roles!inner(
          title,
          specialty,
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
    const formattedExperiencesByRole: any = {};
    
    Object.entries(experienceIdsByRole).forEach(([roleKey, roleData]: [string, any]) => {
      if (!roleData?.experienceIds || !Array.isArray(roleData.experienceIds)) {
        console.warn(`Skipping invalid roleData for ${roleKey}:`, roleData);
        return;
      }
      
      const roleExperiences = experiences
        .filter(exp => {
          if (!exp?.id) {
            console.warn('Experience missing ID:', exp);
            return false;
          }
          return roleData.experienceIds.includes(exp.id);
        })
        .map(exp => {
          // Validate experience structure and handle null values
          if (!exp.roles?.companies?.name || !exp.roles?.title) {
            console.warn('Experience missing role/company data:', exp);
          }
          
          return {
            id: exp.id,
            company: exp.roles?.companies?.name || 'Unknown Company',
            role: exp.roles?.title || 'Unknown Role',
            specialty: exp.roles?.specialty || null, // Handle null specialty
            title: exp.title || 'Untitled Experience',
            situation: exp.situation || null, // Handle null situation
            task: exp.task || null, // Handle null task
            action: exp.action || 'No action details provided',
            result: exp.result || 'No results specified',
            tags: exp.tags || []
          };
        });

      if (roleExperiences.length === 0) {
        console.warn(`No experiences found for role ${roleKey} with IDs:`, roleData.experienceIds);
      }

      formattedExperiencesByRole[roleKey] = {
        companyName: roleData.company || 'Unknown Company',
        roleTitle: roleData.roleTitle || 'Unknown Role',
        specialty: roleData.specialty || null, // Handle null specialty
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

    // Function to optimize bullets that exceed width limits
    const optimizeBulletLength = (bullet: string): string => {
      const visualWidth = calculateVisualWidth(bullet);
      if (visualWidth <= VISUAL_WIDTH_LIMIT) return bullet;
      
      // Simple optimization: trim by removing less critical words
      const words = bullet.split(' ');
      const criticalWords = ['developed', 'implemented', 'created', 'managed', 'led', 'increased', 'decreased', 'improved'];
      
      // Keep critical action words and numbers, remove filler words
      const optimized = words.filter((word, index) => {
        if (index === 0) return true; // Keep first word (action verb)
        if (/\d/.test(word)) return true; // Keep words with numbers
        if (criticalWords.some(cw => word.toLowerCase().includes(cw))) return true;
        if (word.length > 8) return true; // Keep longer, more specific words
        return words.length - words.filter(w => w.length <= 3).length < 10; // Keep if not too many short words
      }).join(' ');
      
      return optimized;
    };

    // Create optimized prompt using extracted keywords and job requirements
    const createBulletPrompt = () => {
      const keywordMatchInstructions = keywordMatchType === 'exact' 
        ? 'Use keywords exactly as listed - do not modify the form or tense'
        : keywordMatchType === 'word-stem'
        ? 'Use keywords and their variations - you can modify tense, add suffixes (ing, ed, er, etc.), or use related forms'
        : 'Use keywords flexibly - match the meaning and context even if exact words differ';

      // Group job requirements by category and importance for better organization
      const reqsByCategory = {
        technical: jobRequirements?.filter((req: any) => req.category === 'technical') || [],
        experience_level: jobRequirements?.filter((req: any) => req.category === 'experience_level') || [],
        domain_industry: jobRequirements?.filter((req: any) => req.category === 'domain_industry') || [],
        leadership_impact: jobRequirements?.filter((req: any) => req.category === 'leadership_impact') || [],
        cultural_soft: jobRequirements?.filter((req: any) => req.category === 'cultural_soft') || []
      };

      const criticalReqs = jobRequirements?.filter((req: any) => req.importance === 'critical') || [];
      const highReqs = jobRequirements?.filter((req: any) => req.importance === 'high') || [];
      
      return `You are a professional resume writer. Create up to 6 impactful resume bullet points for each role using ONLY the user's provided experiences.

KEYWORD MATCHING TYPE: ${keywordMatchType.toUpperCase()}
${keywordMatchInstructions}

PRIORITY KEYWORDS TO INTEGRATE (from job analysis):
Technical Skills: ${bulletKeywords.technical?.join(', ') || 'None'}
Action Verbs: ${bulletKeywords.actionVerbs?.join(', ') || 'None'}  
Industry Terms: ${bulletKeywords.industry?.join(', ') || 'None'}
Metrics/Measurements: ${bulletKeywords.metrics?.join(', ') || 'None'}
Behavioral Terms: ${bulletKeywords.behavioral?.join(', ') || 'None'}
Qualifications: ${bulletKeywords.qualifications?.join(', ') || 'None'}

CRITICAL REQUIREMENTS (must integrate if experience supports):
${criticalReqs.map((req: any) => `• ${req.requirement}`).join('\n') || '• None'}

HIGH PRIORITY REQUIREMENTS (strongly preferred):
${highReqs.map((req: any) => `• ${req.requirement}`).join('\n') || '• None'}

JOB REQUIREMENTS BY CATEGORY:
${reqsByCategory.technical.length > 0 ? `Technical Requirements:
${reqsByCategory.technical.map((req: any) => `• ${req.requirement} (${req.importance} importance)`).join('\n')}` : ''}

${reqsByCategory.experience_level.length > 0 ? `Experience Level:
${reqsByCategory.experience_level.map((req: any) => `• ${req.requirement} (${req.importance} importance)`).join('\n')}` : ''}

${reqsByCategory.domain_industry.length > 0 ? `Domain/Industry Knowledge:
${reqsByCategory.domain_industry.map((req: any) => `• ${req.requirement} (${req.importance} importance)`).join('\n')}` : ''}

${reqsByCategory.leadership_impact.length > 0 ? `Leadership/Impact Requirements:
${reqsByCategory.leadership_impact.map((req: any) => `• ${req.requirement} (${req.importance} importance)`).join('\n')}` : ''}

${reqsByCategory.cultural_soft.length > 0 ? `Cultural/Soft Skills Requirements:
${reqsByCategory.cultural_soft.map((req: any) => `• ${req.requirement} (${req.importance} importance)`).join('\n')}` : ''}

CRITICAL RULES:
1. Use ONLY information from user's experiences - never invent details
2. Integrate keywords naturally where they match the actual experience
3. Prioritize CRITICAL and HIGH importance requirements over medium/low
4. Follow ${keywordMatchType} matching rules for keywords
5. Structure: "Strong action verb + context + quantified result when possible"
6. No abbreviations, em-dashes, colons, semicolons
7. Each bullet MUST be under ${VISUAL_WIDTH_LIMIT} visual width score
8. Maximum 6 bullets per role
9. Handle null situation/task fields gracefully - focus on action/result
10. Keep bullets concise and impactful

USER EXPERIENCES BY ROLE:
${Object.entries(formattedExperiencesByRole).map(([roleKey, roleData]: [string, any]) => `
Company: ${roleData.companyName}
Role: ${roleData.roleTitle}
${roleData.specialty ? `Specialty: ${roleData.specialty}` : ''}

Experiences:
${roleData.experiences.map((exp: any, idx: number) => `
${idx + 1}. Title: ${exp.title}
   Situation: ${exp.situation || 'Not specified'}
   Task: ${exp.task || 'Not specified'}
   Action: ${exp.action}
   Result: ${exp.result}
   Tags: ${exp.tags?.join(', ') || 'None'}
`).join('')}
`).join('\n')}

Return ONLY JSON (no markdown formatting):
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
  "keywordsUsed": ["keywords successfully integrated with ${keywordMatchType} matching"],
  "keywordsNotUsed": ["keywords that didn't fit naturally into experiences"],
  "requirementsMatched": ["job requirements successfully addressed in bullets"],
  "matchingType": "${keywordMatchType}",
  "totalRequirements": ${jobRequirements.length},
  "criticalRequirementsAddressed": ["critical requirements that were integrated"]
}`;
    };

    const prompt = createBulletPrompt();

    console.log('Prompt length:', prompt.length);

    // Call OpenAI API with optimized settings
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-2024-07-18', // Use consistent model
        messages: [
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 3072, // Increased for better bullet generation
        temperature: 0.3 // Slightly higher for creativity in phrasing
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OpenAI API response received');

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI API');
    }

    const generatedText = data.choices[0].message.content;
    console.log('Generated text preview:', generatedText.substring(0, 200) + '...');

    // Enhanced JSON parsing with better error handling
    let bulletData;
    try {
      // Try to find JSON block in response
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in OpenAI response. Full text:', generatedText);
        throw new Error('No JSON found in AI response. Response may be truncated or malformed.');
      }
      
      const jsonString = jsonMatch[0];
      console.log('Extracted JSON string preview:', jsonString.substring(0, 200) + '...');
      
      bulletData = JSON.parse(jsonString);
      
      // Validate required structure
      if (!bulletData.companies || !Array.isArray(bulletData.companies)) {
        throw new Error('AI response missing required "companies" array');
      }
      
      if (bulletData.companies.length === 0) {
        console.warn('AI generated no companies/bullets');
      }
      
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Full OpenAI response:', generatedText);
      
      if (parseError instanceof SyntaxError) {
        throw new Error(`Invalid JSON in AI response: ${parseError.message}. This may indicate the response was truncated or contains syntax errors.`);
      }
      throw new Error(`Failed to parse bullet points: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    // Validate and calculate visual width for each bullet point with optimization
    const validatedBullets = {
      companies: bulletData.companies?.map((company: any) => ({
        name: company.name,
        roles: company.roles?.map((role: any) => ({
          title: role.title,
          bulletPoints: role.bulletPoints?.map((bullet: string) => {
            const originalWidth = calculateVisualWidth(bullet);
            let optimizedBullet = bullet;
            let finalWidth = originalWidth;
            
            // Optimize if bullet exceeds width limit
            if (originalWidth > VISUAL_WIDTH_LIMIT) {
              optimizedBullet = optimizeBulletLength(bullet);
              finalWidth = calculateVisualWidth(optimizedBullet);
              console.log(`Optimized bullet: ${originalWidth} → ${finalWidth} chars: "${optimizedBullet.substring(0, 50)}..."`);
            } else {
              console.log(`Bullet within limits: ${finalWidth} chars: "${bullet.substring(0, 50)}..."`);
            }
            
            return {
              text: optimizedBullet,
              visualWidth: finalWidth,
              exceedsWidth: finalWidth > VISUAL_WIDTH_LIMIT,
              wasOptimized: originalWidth > VISUAL_WIDTH_LIMIT
            };
          }) || []
        })) || []
      })) || [],
      keywordsUsed: bulletData.keywordsUsed || [],
      keywordsNotUsed: bulletData.keywordsNotUsed || [],
      requirementsMatched: bulletData.requirementsMatched || [],
      criticalRequirementsAddressed: bulletData.criticalRequirementsAddressed || [],
      generatedFrom: {
        totalExperiences: allExperienceIds.length,
        rolesProcessed: Object.keys(experienceIdsByRole).length,
        keywordCategories: Object.keys(bulletKeywords).length,
        totalRequirements: jobRequirements.length,
        keywordMatchType: keywordMatchType,
        scoreThreshold: overallScore || 'not provided'
      }
    };

    console.log('Resume bullets generated successfully');
    console.log('Keywords used:', validatedBullets.keywordsUsed);
    console.log('Keywords not used:', validatedBullets.keywordsNotUsed);
    console.log('Requirements matched:', validatedBullets.requirementsMatched);
    
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
