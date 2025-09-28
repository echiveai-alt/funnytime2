import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants for consistency
const CONSTANTS = {
  VISUAL_WIDTH_LIMIT: 179,
  MIN_SCORE_THRESHOLD: 80,
  MAX_BULLETS_PER_ROLE: 6,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// Enhanced error handling
class BulletGenerationError extends Error {
  constructor(
    message: string, 
    public code: string, 
    public statusCode: number = 500,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'BulletGenerationError';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment validation
    const openaiApiKey = Deno.env.get('GENERATE_RESUME_BULLETS_OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiApiKey) {
      throw new BulletGenerationError(
        'OpenAI API key not configured', 
        'MISSING_API_KEY', 
        500, 
        false
      );
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new BulletGenerationError(
        'Supabase configuration missing', 
        'MISSING_SUPABASE_CONFIG', 
        500, 
        false
      );
    }

    console.log('generate-resume-bullets: Starting bullet generation');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new BulletGenerationError(
        'Authorization header required', 
        'MISSING_AUTH', 
        401, 
        false
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (userError || !user) {
      throw new BulletGenerationError(
        'Authentication failed', 
        'AUTH_FAILED', 
        401, 
        false
      );
    }

    // Parse and validate request body
    const requestBody = await req.json().catch(() => null);
    if (!requestBody) {
      throw new BulletGenerationError(
        'Invalid request body', 
        'INVALID_REQUEST', 
        400, 
        false
      );
    }

    const { 
      experienceIdsByRole, 
      bulletKeywords, 
      jobRequirements,
      overallScore,
      keywordMatchType = 'exact'
    } = requestBody;

    console.log('Request validation:', {
      hasExperienceIds: !!experienceIdsByRole,
      hasBulletKeywords: !!bulletKeywords,
      hasJobRequirements: !!jobRequirements,
      overallScore,
      keywordMatchType,
    });

    // Enhanced input validation
    if (overallScore !== undefined && overallScore < CONSTANTS.MIN_SCORE_THRESHOLD) {
      throw new BulletGenerationError(
        `Job fit score of ${overallScore}% is below the ${CONSTANTS.MIN_SCORE_THRESHOLD}% threshold required for bullet generation. Please improve your profile match first.`,
        'SCORE_TOO_LOW',
        400,
        false
      );
    }

    if (!experienceIdsByRole || typeof experienceIdsByRole !== 'object') {
      throw new BulletGenerationError(
        'Missing or invalid experienceIdsByRole from job fit analysis',
        'MISSING_EXPERIENCE_IDS',
        400,
        false
      );
    }
    
    if (!bulletKeywords || typeof bulletKeywords !== 'object') {
      throw new BulletGenerationError(
        'Missing or invalid bulletKeywords from job fit analysis',
        'MISSING_BULLET_KEYWORDS',
        400,
        false
      );
    }

    if (!jobRequirements || !Array.isArray(jobRequirements)) {
      throw new BulletGenerationError(
        'Missing or invalid jobRequirements from job fit analysis',
        'MISSING_JOB_REQUIREMENTS',
        400,
        false
      );
    }
    
    if (Object.keys(experienceIdsByRole).length === 0) {
      throw new BulletGenerationError(
        'No relevant experiences found for bullet generation',
        'NO_RELEVANT_EXPERIENCES',
        400,
        false
      );
    }

    // Extract and validate experience IDs
    const allExperienceIds = Object.values(experienceIdsByRole)
      .flatMap((roleData: any) => {
        if (!roleData?.experienceIds || !Array.isArray(roleData.experienceIds)) {
          console.warn('Invalid roleData structure:', roleData);
          return [];
        }
        return roleData.experienceIds;
      })
      .filter(id => id);
    
    if (allExperienceIds.length === 0) {
      throw new BulletGenerationError(
        'No valid experience IDs found in experienceIdsByRole',
        'NO_VALID_EXPERIENCE_IDS',
        400,
        false
      );
    }

    console.log(`Fetching ${allExperienceIds.length} experiences for user ${user.id}`);

    // Fetch experiences with error handling
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
      console.error('Database error fetching experiences:', expError);
      throw new BulletGenerationError(
        'Failed to fetch experiences from database',
        'DATABASE_ERROR',
        500,
        true
      );
    }

    if (!experiences || experiences.length === 0) {
      throw new BulletGenerationError(
        'No experiences found for provided IDs',
        'NO_EXPERIENCES_FOUND',
        404,
        false
      );
    }

    console.log(`Successfully fetched ${experiences.length} experiences`);

    // Format and validate experiences
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
          // Validate and format experience data
          if (!exp.roles?.companies?.name || !exp.roles?.title) {
            console.warn('Experience missing role/company data:', exp.id);
          }
          
          return {
            id: exp.id,
            company: exp.roles?.companies?.name || 'Unknown Company',
            role: exp.roles?.title || 'Unknown Role',
            specialty: exp.roles?.specialty || null,
            title: exp.title || 'Untitled Experience',
            situation: exp.situation || null,
            task: exp.task || null,
            action: exp.action || 'No action details provided',
            result: exp.result || 'No results specified',
            tags: Array.isArray(exp.tags) ? exp.tags : []
          };
        });

      if (roleExperiences.length === 0) {
        console.warn(`No experiences found for role ${roleKey} with IDs:`, roleData.experienceIds);
        return;
      }

      formattedExperiencesByRole[roleKey] = {
        companyName: roleData.company || 'Unknown Company',
        roleTitle: roleData.roleTitle || 'Unknown Role',
        specialty: roleData.specialty || null,
        experiences: roleExperiences
      };
    });

    if (Object.keys(formattedExperiencesByRole).length === 0) {
      throw new BulletGenerationError(
        'No valid role experiences found after formatting',
        'NO_FORMATTED_EXPERIENCES',
        400,
        false
      );
    }

    // Visual width calculation function
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
        else score += 0.80;
      }
      return score;
    };

    // Bullet optimization function
    const optimizeBulletLength = (bullet: string): string => {
      const visualWidth = calculateVisualWidth(bullet);
      if (visualWidth <= CONSTANTS.VISUAL_WIDTH_LIMIT) return bullet;
      
      // Enhanced optimization logic
      const words = bullet.split(' ');
      const criticalWords = ['developed', 'implemented', 'created', 'managed', 'led', 'increased', 'decreased', 'improved', 'designed', 'built'];
      
      const optimized = words.filter((word, index) => {
        // Always keep first word (action verb)
        if (index === 0) return true;
        // Keep words with numbers (metrics)
        if (/\d/.test(word)) return true;
        // Keep critical action words
        if (criticalWords.some(cw => word.toLowerCase().includes(cw))) return true;
        // Keep longer, more specific words
        if (word.length > 8) return true;
        // Filter out common filler words if we have too many short words
        const shortWords = words.filter(w => w.length <= 3).length;
        return shortWords < 5;
      }).join(' ');
      
      return optimized || bullet; // Fallback to original if optimization fails
    };

    // Create enhanced prompt
    const createBulletPrompt = () => {
      const keywordMatchInstructions = keywordMatchType === 'exact' 
        ? 'Use keywords exactly as listed - do not modify the form or tense'
        : keywordMatchType === 'word-stem'
        ? 'Use keywords and their variations - you can modify tense, add suffixes (ing, ed, er, etc.), or use related forms'
        : 'Use keywords flexibly - match the meaning and context even if exact words differ';

      // Organize requirements by priority
      const criticalReqs = jobRequirements?.filter((req: any) => req.importance === 'critical') || [];
      const highReqs = jobRequirements?.filter((req: any) => req.importance === 'high') || [];
      const mediumReqs = jobRequirements?.filter((req: any) => req.importance === 'medium') || [];
      
      return `You are an expert resume writer specializing in ATS optimization. Create compelling, keyword-rich resume bullet points that maximize job relevance while staying truthful to the user's experiences.

KEYWORD MATCHING: ${keywordMatchType.toUpperCase()}
${keywordMatchInstructions}

PRIORITY KEYWORDS (integrate where experience supports):
Technical: ${bulletKeywords.technical?.slice(0, 15).join(', ') || 'None'}
Action Verbs: ${bulletKeywords.actionVerbs?.slice(0, 10).join(', ') || 'None'}  
Industry Terms: ${bulletKeywords.industry?.slice(0, 10).join(', ') || 'None'}
Metrics: ${bulletKeywords.metrics?.slice(0, 8).join(', ') || 'None'}
Behavioral: ${bulletKeywords.behavioral?.slice(0, 8).join(', ') || 'None'}

CRITICAL REQUIREMENTS (must address if experience supports):
${criticalReqs.slice(0, 5).map((req: any) => `• ${req.requirement}`).join('\n') || '• None'}

HIGH PRIORITY REQUIREMENTS:
${highReqs.slice(0, 8).map((req: any) => `• ${req.requirement}`).join('\n') || '• None'}

MEDIUM PRIORITY REQUIREMENTS:
${mediumReqs.slice(0, 8).map((req: any) => `• ${req.requirement}`).join('\n') || '• None'}

STRICT REQUIREMENTS:
1. Use ONLY information from user's actual experiences - never invent details
2. Each bullet point must be under ${CONSTANTS.VISUAL_WIDTH_LIMIT} visual characters
3. Maximum ${CONSTANTS.MAX_BULLETS_PER_ROLE} bullets per role
4. Structure: "Strong action verb + specific context + quantified result/impact"
5. Handle null situation/task fields gracefully - focus on action/result
6. No abbreviations, em-dashes, colons, or semicolons
7. Prioritize keywords that match actual experience content
8. Include metrics/numbers when available in original experience

USER EXPERIENCES:
${Object.entries(formattedExperiencesByRole).map(([roleKey, roleData]: [string, any]) => `
ROLE: ${roleData.roleTitle} at ${roleData.companyName}
${roleData.specialty ? `Specialty: ${roleData.specialty}` : ''}

Experiences:
${roleData.experiences.map((exp: any, idx: number) => `
${idx + 1}. ${exp.title}
   Action: ${exp.action}
   Result: ${exp.result}
   ${exp.situation ? `Situation: ${exp.situation}` : ''}
   ${exp.task ? `Task: ${exp.task}` : ''}
   Tags: ${exp.tags?.join(', ') || 'None'}
`).join('')}
`).join('\n')}

Return ONLY JSON (no markdown):
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
  "keywordsUsed": ["successfully integrated keywords"],
  "keywordsNotUsed": ["keywords that didn't fit naturally"],
  "requirementsMatched": ["job requirements addressed"],
  "criticalRequirementsAddressed": ["critical requirements integrated"],
  "matchingType": "${keywordMatchType}",
  "totalRequirements": ${jobRequirements.length}
}`;
    };

    // Generate bullets with retry logic
    const generateWithRetry = async (attempt = 1): Promise<any> => {
      try {
        console.log(`Calling OpenAI API (attempt ${attempt}/${CONSTANTS.MAX_RETRIES})`);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini-2024-07-18',
            messages: [{ role: 'user', content: createBulletPrompt() }],
            max_completion_tokens: 3500,
            temperature: 0.3,
            timeout: 45000, // 45 second timeout
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`OpenAI API error (${response.status}):`, errorText);
          
          // Determine if error is retryable
          const isRetryable = response.status >= 500 || response.status === 429;
          throw new BulletGenerationError(
            `OpenAI API request failed: ${response.status} ${response.statusText}`,
            'OPENAI_API_ERROR',
            500,
            isRetryable
          );
        }

        const data = await response.json();
        
        if (!data.choices?.[0]?.message?.content) {
          throw new BulletGenerationError(
            'Empty response from OpenAI API',
            'EMPTY_API_RESPONSE',
            500,
            true
          );
        }

        return data.choices[0].message.content;
        
      } catch (error) {
        if (attempt < CONSTANTS.MAX_RETRIES && error instanceof BulletGenerationError && error.retryable) {
          console.log(`Retrying in ${CONSTANTS.RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, CONSTANTS.RETRY_DELAY_MS));
          return generateWithRetry(attempt + 1);
        }
        throw error;
      }
    };

    const generatedText = await generateWithRetry();
    console.log('OpenAI response received, parsing JSON...');

    // Enhanced JSON parsing
    let bulletData;
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response:', generatedText.substring(0, 500));
        throw new BulletGenerationError(
          'No valid JSON found in AI response',
          'INVALID_RESPONSE_FORMAT',
          500,
          true
        );
      }
      
      const jsonString = jsonMatch[0];
      bulletData = JSON.parse(jsonString);
      
      // Validate response structure
      if (!bulletData.companies || !Array.isArray(bulletData.companies)) {
        throw new BulletGenerationError(
          'AI response missing required companies array',
          'INVALID_RESPONSE_STRUCTURE',
          500,
          true
        );
      }
      
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Response text:', generatedText);
      
      if (parseError instanceof SyntaxError) {
        throw new BulletGenerationError(
          'Invalid JSON in AI response - response may be truncated',
          'JSON_PARSE_ERROR',
          500,
          true
        );
      }
      throw parseError;
    }

    // Process and validate bullets
    const validatedBullets = {
      bulletOrganization: bulletData.companies?.map((company: any) => ({
        name: company.name,
        roles: company.roles?.map((role: any) => ({
          title: role.title,
          bulletPoints: (role.bulletPoints || []).map((bullet: string) => {
            const originalWidth = calculateVisualWidth(bullet);
            let optimizedBullet = bullet;
            let finalWidth = originalWidth;
            
            // Optimize if needed
            if (originalWidth > CONSTANTS.VISUAL_WIDTH_LIMIT) {
              optimizedBullet = optimizeBulletLength(bullet);
              finalWidth = calculateVisualWidth(optimizedBullet);
              console.log(`Optimized bullet: ${originalWidth} → ${finalWidth} chars`);
            }
            
            return {
              text: optimizedBullet,
              visualWidth: Math.round(finalWidth),
              exceedsWidth: finalWidth > CONSTANTS.VISUAL_WIDTH_LIMIT,
              wasOptimized: originalWidth > CONSTANTS.VISUAL_WIDTH_LIMIT
            };
          })
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

    console.log('Bullet generation completed successfully:', {
      companies: validatedBullets.bulletOrganization.length,
      totalBullets: validatedBullets.bulletOrganization.reduce((acc, comp) => 
        acc + comp.roles.reduce((roleAcc, role) => roleAcc + role.bulletPoints.length, 0), 0
      ),
      keywordsUsed: validatedBullets.keywordsUsed.length,
      keywordsNotUsed: validatedBullets.keywordsNotUsed.length
    });
    
    return new Response(JSON.stringify(validatedBullets), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-resume-bullets function:', error);
    
    // Determine appropriate status code and response
    let statusCode = 500;
    let errorMessage = 'Failed to generate resume bullets';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error instanceof BulletGenerationError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
      retryable: error instanceof BulletGenerationError ? error.retryable : false
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
