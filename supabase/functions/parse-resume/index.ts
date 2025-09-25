import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedCompany {
  name: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
}

interface ParsedRole {
  title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  company_name: string;
}

interface ParsedExperience {
  title: string;
  situation: string | null;
  task: string | null;
  action: string;
  result: string;
  role_title: string;
  company_name: string;
}

interface ParsedResumeData {
  companies: ParsedCompany[];
  roles: ParsedRole[];
  experiences: ParsedExperience[];
}

// Improved validation function for parsed data
function validateParsedData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Response is not a valid object');
    return { isValid: false, errors };
  }
  
  // Check required arrays exist
  if (!Array.isArray(data.companies)) {
    errors.push('Missing or invalid companies array');
  }
  if (!Array.isArray(data.roles)) {
    errors.push('Missing or invalid roles array');
  }
  if (!Array.isArray(data.experiences)) {
    errors.push('Missing or invalid experiences array');
  }
  
  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  
  // Check minimum data requirements
  if (data.companies.length === 0) {
    errors.push('No companies found in resume');
  }
  if (data.roles.length === 0) {
    errors.push('No roles found in resume');
  }
  if (data.experiences.length === 0) {
    errors.push('No experiences found in resume');
  }
  
  // Validate company structure
  for (let i = 0; i < data.companies.length; i++) {
    const company = data.companies[i];
    if (!company.name || typeof company.name !== 'string') {
      errors.push(`Company ${i + 1}: missing or invalid name`);
    }
    if (!company.start_date || typeof company.start_date !== 'string') {
      errors.push(`Company ${i + 1}: missing or invalid start_date`);
    }
  }
  
  // Validate role structure
  for (let i = 0; i < data.roles.length; i++) {
    const role = data.roles[i];
    if (!role.title || typeof role.title !== 'string') {
      errors.push(`Role ${i + 1}: missing or invalid title`);
    }
    if (!role.company_name || typeof role.company_name !== 'string') {
      errors.push(`Role ${i + 1}: missing or invalid company_name`);
    }
    if (!role.start_date || typeof role.start_date !== 'string') {
      errors.push(`Role ${i + 1}: missing or invalid start_date`);
    }
  }
  
  // Validate experience structure
  for (let i = 0; i < data.experiences.length; i++) {
    const exp = data.experiences[i];
    if (!exp.title || typeof exp.title !== 'string') {
      errors.push(`Experience ${i + 1}: missing or invalid title`);
    }
    if (!exp.action || typeof exp.action !== 'string') {
      errors.push(`Experience ${i + 1}: missing or invalid action`);
    }
    if (!exp.result || typeof exp.result !== 'string') {
      errors.push(`Experience ${i + 1}: missing or invalid result`);
    }
    if (!exp.role_title || typeof exp.role_title !== 'string') {
      errors.push(`Experience ${i + 1}: missing or invalid role_title`);
    }
    if (!exp.company_name || typeof exp.company_name !== 'string') {
      errors.push(`Experience ${i + 1}: missing or invalid company_name`);
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

// Improved JSON extraction and cleaning
function extractAndCleanJSON(text: string): string | null {
  try {
    // Remove any markdown formatting
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Find JSON object boundaries more accurately
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      return null;
    }
    
    let jsonString = cleaned.substring(jsonStart, jsonEnd);
    
    // Clean common issues
    jsonString = jsonString
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/\n/g, ' ')     // Replace newlines with spaces
      .replace(/\t/g, ' ')     // Replace tabs with spaces
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
    
    return jsonString;
  } catch (error) {
    console.error('JSON extraction error:', error);
    return null;
  }
}

// Simplified text preprocessing focused on experience extraction
function preprocessExperienceText(text: string): string {
  console.log(`Original text length: ${text.length}`);
  
  // Basic normalization
  let cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  // Try to extract experience section if text looks like a full resume
  const experienceSection = extractExperienceSection(cleaned);
  
  if (experienceSection && experienceSection.length > 100) {
    console.log(`✓ Found experience section: ${experienceSection.length} chars`);
    cleaned = experienceSection;
  } else {
    console.log(`✗ No clear experience section found, using full text`);
  }
  
  // Truncate if too long (keeping it reasonable for AI processing)
  if (cleaned.length > 4000) {
    console.log(`Text too long (${cleaned.length}), truncating`);
    cleaned = cleaned.substring(0, 4000);
  }
  
  console.log(`Final processed text: ${cleaned.length} chars`);
  return cleaned;
}

// Extract experience section from resume text
function extractExperienceSection(text: string): string | null {
  // Look for experience section headers
  const experiencePatterns = [
    /(?:^|\n)\s*(?:(?:work\s+)?experience|professional\s+experience|employment\s+(?:history|record)|career\s+(?:history|summary)|work\s+history)\s*[:|\n]([\s\S]*?)(?=(?:\n\s*(?:education|skills?|certifications?|awards?|publications?|references?|additional\s+information|languages?|volunteer)\s*[:|\n])|$)/gi,
    /(?:^|\n)\s*(?:employment|work)\s*[:|\n]([\s\S]*?)(?=(?:\n\s*(?:education|skills?|certifications?|awards?|publications?|references?|additional\s+information|languages?|volunteer)\s*[:|\n])|$)/gi
  ];
  
  for (const pattern of experiencePatterns) {
    const match = pattern.exec(text);
    if (match && match[1] && match[1].trim().length > 100) {
      return match[1].trim();
    }
  }
  
  return null;
}

// Create focused prompt for experience extraction
function createExperiencePrompt(resumeText: string): string {
  return `You are a resume parsing expert. Extract work experience information from this text and convert it to structured JSON data.

TEXT TO PARSE:
${resumeText}

INSTRUCTIONS:
1. Extract all companies, job roles, and individual accomplishments/responsibilities from the work experience
2. Create one experience entry for each bullet point or achievement mentioned
3. Use STAR format for experiences (Situation, Task, Action, Result)
4. Generate clear, descriptive titles for experiences that highlight the impact or action taken
5. If the text contains only partial resume sections, focus on extracting whatever work experience is available

REQUIRED JSON FORMAT:
{
  "companies": [
    {
      "name": "Company Name",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "is_current": false
    }
  ],
  "roles": [
    {
      "title": "Job Title", 
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "is_current": false,
      "company_name": "Exact Company Name"
    }
  ],
  "experiences": [
    {
      "title": "Clear description of achievement or responsibility",
      "situation": "Context or background (can be null)",
      "task": "What needed to be accomplished (can be null)", 
      "action": "Specific actions taken (required)",
      "result": "Measurable outcome or benefit (required)",
      "role_title": "Exact role title from roles array",
      "company_name": "Exact company name from companies array"
    }
  ]
}

IMPORTANT RULES:
- Use "YYYY-MM-DD" date format. If only year available, use "YYYY-01-01" for start dates and "YYYY-12-31" for end dates
- If only month/year available, use "YYYY-MM-01" for start dates and "YYYY-MM-28" for end dates
- Action and result fields are required and cannot be null
- Company names and role titles must exactly match between arrays
- Return ONLY valid JSON, no additional text or formatting
- If no clear work experience is found, return empty arrays for all three sections`;
}

// Improved batch insert with transaction support
async function batchInsert(supabase: any, table: string, data: any[], batchSize = 25) {
  if (data.length === 0) return [];
  
  const results = [];
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    const { data: batchResults, error } = await supabase
      .from(table)
      .insert(batch)
      .select();
    
    if (error) {
      console.error(`Batch insert error for ${table}:`, error);
      console.error('Failed batch data:', JSON.stringify(batch, null, 2));
      throw new Error(`Failed to insert ${table}: ${error.message}`);
    }
    
    if (batchResults) {
      results.push(...batchResults);
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1} for ${table}: ${batchResults.length} records`);
    }
  }
  
  return results;
}

// Enhanced fuzzy matching with better scoring
function findBestMatch(target: string, candidates: any[], nameField: string): any | null {
  if (!target || candidates.length === 0) return null;
  
  const targetLower = target.trim().toLowerCase();
  let bestMatch = null;
  let bestScore = 0;
  
  for (const candidate of candidates) {
    const candidateName = candidate[nameField].trim().toLowerCase();
    
    // Exact match gets highest score
    if (candidateName === targetLower) {
      return candidate;
    }
    
    // Calculate similarity score
    let score = 0;
    
    // Contains match
    if (candidateName.includes(targetLower) || targetLower.includes(candidateName)) {
      score = 0.8;
    }
    
    // Word overlap scoring
    const targetWords = targetLower.split(/\s+/);
    const candidateWords = candidateName.split(/\s+/);
    const commonWords = targetWords.filter(word => candidateWords.includes(word));
    const wordOverlapScore = commonWords.length / Math.max(targetWords.length, candidateWords.length);
    
    score = Math.max(score, wordOverlapScore);
    
    if (score > bestScore && score > 0.5) { // Minimum threshold
      bestScore = score;
      bestMatch = candidate;
    }
  }
  
  return bestMatch;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting experience extraction from resume text');
    
    // Environment and client setup
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not found in environment variables');
      throw new Error('OpenAI API key not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting check
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recentParses, error: rateLimitError } = await supabase
      .from('companies')
      .select('id, created_at')
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);
    
    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    }
    
    if (recentParses && recentParses.length >= 5) {
      return new Response(JSON.stringify({ 
        error: `Rate limit exceeded: ${recentParses.length}/5 resume parses in the last hour. Try again later.` 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get resume text from request body
    const body = await req.json();
    const resumeText = body.resumeText;

    if (!resumeText || typeof resumeText !== 'string') {
      throw new Error('No resume text provided');
    }

    if (resumeText.trim().length < 50) {
      throw new Error('Resume text too short. Please provide your work experience details including company names, job titles, dates, and responsibilities.');
    }

    // Process the text to focus on experience extraction
    const processedText = preprocessExperienceText(resumeText);
    console.log(`Text processing: ${resumeText.length} → ${processedText.length} chars`);

    // AI parsing with retry logic for better reliability
    let parsedData: ParsedResumeData | null = null;
    const maxAttempts = 3;
    const models = ['gpt-5-nano'];
    let currentModelIndex = 0;
    
    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
      try {
        console.log(`AI parsing attempt ${attempts}/${maxAttempts} using model: ${models[currentModelIndex]}`);
        
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify({
            model: models[currentModelIndex],
            messages: [
              { 
                role: 'system', 
                content: 'You are a resume parsing expert. Always respond with valid JSON only. No additional text or formatting.' 
              },
              { 
                role: 'user', 
                content: createExperiencePrompt(processedText) 
              }
            ],
            max_tokens: 4000,
            temperature: 0.1,
            response_format: { type: "json_object" }
          })
        });
        
        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error(`OpenAI API error (attempt ${attempts}):`, errorText);
          
          // Try next model if available
          if (currentModelIndex < models.length - 1) {
            currentModelIndex++;
            continue;
          }
          
          if (attempts === maxAttempts) {
            throw new Error(`AI service error: ${openaiResponse.status}. Please try again later.`);
          }
          continue;
        }
        
        const openaiData = await openaiResponse.json();
        
        if (openaiData.choices?.[0]?.finish_reason === 'content_filter') {
          throw new Error('Resume content was flagged by AI safety filters. Please review and try again.');
        }
        
        const generatedText = openaiData.choices?.[0]?.message?.content;
        
        if (!generatedText) {
          console.error(`No response from OpenAI (attempt ${attempts}):`, JSON.stringify(openaiData, null, 2));
          continue;
        }
        
        console.log(`Raw AI response (attempt ${attempts}):`, generatedText.substring(0, 200) + '...');
        
        // Enhanced JSON extraction
        const jsonString = extractAndCleanJSON(generatedText);
        
        if (!jsonString) {
          console.log(`Attempt ${attempts}: Could not extract valid JSON`);
          continue;
        }
        
        // Parse and validate JSON
        let tempData;
        try {
          tempData = JSON.parse(jsonString);
        } catch (parseError) {
          console.log(`Attempt ${attempts}: JSON parsing failed:`, parseError);
          continue;
        }
        
        // Comprehensive validation
        const validation = validateParsedData(tempData);
        
        if (!validation.isValid) {
          console.log(`Attempt ${attempts}: Validation failed:`, validation.errors);
          
          // If it's the last attempt with current model, try next model
          if (attempts < maxAttempts && currentModelIndex < models.length - 1) {
            currentModelIndex++;
          }
          continue;
        }
        
        // Success!
        parsedData = tempData as ParsedResumeData;
        console.log(`✓ Successfully parsed data on attempt ${attempts}`);
        break;
        
      } catch (attemptError) {
        console.error(`Attempt ${attempts} failed:`, attemptError);
        
        // Try next model if available
        if (currentModelIndex < models.length - 1) {
          currentModelIndex++;
        }
        
        if (attempts === maxAttempts) {
          throw attemptError;
        }
      }
    }
    
    if (!parsedData) {
      throw new Error('Unable to extract work experience from the provided text. Please ensure your text includes:\n- Company names\n- Job titles/roles\n- Employment dates\n- Specific responsibilities or achievements\n\nYou can paste either your full resume or just the work experience section.');
    }

    console.log(`Successfully parsed: ${parsedData.companies.length} companies, ${parsedData.roles.length} roles, ${parsedData.experiences.length} experiences`);

    // Database operations with better error handling and matching
    const results: { companies: any[]; roles: any[]; experiences: any[] } = { companies: [], roles: [], experiences: [] };

    try {
      // Calculate proper company dates from roles
      const companyDateMap = new Map<string, { start_date: string; end_date: string | null; is_current: boolean }>();
      
      for (const role of parsedData.roles) {
        const companyName = role.company_name.trim();
        const existing = companyDateMap.get(companyName);
        
        if (!existing) {
          companyDateMap.set(companyName, {
            start_date: role.start_date,
            end_date: role.end_date,
            is_current: role.is_current
          });
        } else {
          // Update with earliest start date and latest end date
          if (role.start_date < existing.start_date) {
            existing.start_date = role.start_date;
          }
          
          if (role.is_current) {
            existing.is_current = true;
            existing.end_date = null;
          } else if (!existing.is_current && role.end_date && (!existing.end_date || role.end_date > existing.end_date)) {
            existing.end_date = role.end_date;
          }
        }
      }

      // Insert companies with corrected dates
      if (parsedData.companies.length > 0) {
        const companyInserts = parsedData.companies.map(company => {
          const correctedDates = companyDateMap.get(company.name.trim());
          return {
            user_id: user.id,
            name: company.name.trim(),
            start_date: correctedDates?.start_date || company.start_date,
            end_date: correctedDates?.end_date || company.end_date,
            is_current: correctedDates?.is_current || company.is_current
          };
        });
        
        results.companies = await batchInsert(supabase, 'companies', companyInserts);
      }

      // Insert roles with enhanced matching
      if (parsedData.roles.length > 0) {
        const roleInserts = parsedData.roles.map(role => {
          const company = findBestMatch(role.company_name, results.companies, 'name');
          
          if (!company) {
            console.error(`Company not found for role: "${role.title}" at "${role.company_name}"`);
            console.error('Available companies:', results.companies.map(c => c.name));
            throw new Error(`Cannot match role "${role.title}" to any company. Found companies: ${results.companies.map(c => c.name).join(', ')}`);
          }
          
          return {
            user_id: user.id,
            company_id: company.id,
            title: role.title.trim(),
            start_date: role.start_date,
            end_date: role.end_date,
            is_current: role.is_current
          };
        });
        
        results.roles = await batchInsert(supabase, 'roles', roleInserts);
      }

      // Insert experiences with enhanced matching
      if (parsedData.experiences.length > 0) {
        const experienceInserts = parsedData.experiences.map((experience, index) => {
          // Find role that matches both title and company
          const matchingRoles = results.roles.filter(role => {
            const company = results.companies.find(c => c.id === role.company_id);
            return company && 
                   role.title.trim().toLowerCase() === experience.role_title.trim().toLowerCase() &&
                   company.name.trim().toLowerCase() === experience.company_name.trim().toLowerCase();
          });
          
          let role = matchingRoles.length > 0 ? matchingRoles[0] : null;
          
          // Fallback: if exact match fails, try fuzzy matching with company context
          if (!role) {
            role = findBestMatch(experience.role_title, results.roles.filter(r => {
              const company = results.companies.find(c => c.id === r.company_id);
              return company && company.name.trim().toLowerCase().includes(experience.company_name.trim().toLowerCase());
            }), 'title');
          }
          
          // Final fallback: match by role title only
          if (!role) {
            role = findBestMatch(experience.role_title, results.roles, 'title');
          }
          
          if (!role) {
            console.error(`Role not found for experience ${index + 1}: "${experience.title}" with role "${experience.role_title}" at company "${experience.company_name}"`);
            console.error('Available roles:', results.roles.map(r => `${r.title} at ${results.companies.find(c => c.id === r.company_id)?.name}`));
            throw new Error(`Cannot match experience "${experience.title}" to any role. Found roles: ${results.roles.map(r => r.title).join(', ')}`);
          }
          
          return {
            user_id: user.id,
            role_id: role.id,
            title: experience.title.trim(),
            situation: experience.situation?.trim() || null,
            task: experience.task?.trim() || null,
            action: experience.action.trim(),
            result: experience.result?.trim(),
            tags: []
          };
        });
        
        results.experiences = await batchInsert(supabase, 'experiences', experienceInserts);
      }

    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      throw new Error(`Database error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
    }

    // Success response
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully extracted work experience data`,
      data: {
        companies: results.companies.length,
        roles: results.roles.length,
        experiences: results.experiences.length,
        processing_stats: {
          original_text_length: resumeText.length,
          processed_text_length: processedText.length
        }
      },
      sample_data: {
        companies: results.companies.slice(0, 2).map(c => c.name),
        roles: results.roles.slice(0, 3).map(r => r.title),
        experience_titles: results.experiences.slice(0, 5).map(exp => exp.title)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Experience extraction error:', error);
    
    const baseErrorMessage = error instanceof Error ? error.message : 'Failed to extract work experience';
    let statusCode = 500;
    let errorMessage = baseErrorMessage;
    
    // Provide specific error messages and status codes
    if (baseErrorMessage.includes('Rate limit')) {
      statusCode = 429;
    } else if (baseErrorMessage.includes('too short') || baseErrorMessage.includes('No resume text')) {
      statusCode = 400;
    } else if (baseErrorMessage.includes('Unauthorized')) {
      statusCode = 401;
    } else if (baseErrorMessage.includes('Unable to extract work experience')) {
      statusCode = 422;
      errorMessage = baseErrorMessage; // Keep the detailed message as is
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false,
      timestamp: new Date().toISOString(),
      help: {
        what_to_include: [
          'Company names you worked for',
          'Job titles/roles you held',
          'Start and end dates (month/year is fine)',
          'Specific responsibilities and achievements',
          'Bullet points describing your work'
        ],
        format_examples: [
          'Software Engineer at Google (Jan 2020 - Dec 2022)',
          '• Developed web applications using React and Node.js',
          '• Improved system performance by 30%',
          'OR just paste your entire resume - the system will find the experience section'
        ]
      }
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
