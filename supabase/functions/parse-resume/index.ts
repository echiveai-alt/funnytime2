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

// New function to parse and normalize dates
function parseDate(dateStr: string): { date: string | null; is_current: boolean } {
  if (!dateStr || typeof dateStr !== 'string') {
    return { date: null, is_current: false };
  }
  
  const cleanDate = dateStr.trim().toLowerCase();
  
  // Check for current/present indicators
  const currentIndicators = [
    'present', 'current', 'now', 'ongoing', 'today', 
    'currently', 'till date', 'to date', 'continuing',
    'active', 'still working', 'still employed'
  ];
  
  const isCurrent = currentIndicators.some(indicator => 
    cleanDate.includes(indicator) || cleanDate === indicator
  );
  
  if (isCurrent) {
    return { date: null, is_current: true };
  }
  
  // Try to parse various date formats
  try {
    // Handle common formats like "Nov 2023", "November 2023", "11/2023", "2023-11", etc.
    
    // Format: "Nov 2023", "November 2023"
    const monthYearMatch = cleanDate.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})$/i);
    if (monthYearMatch) {
      const monthMap: { [key: string]: string } = {
        'jan': '01', 'january': '01',
        'feb': '02', 'february': '02',
        'mar': '03', 'march': '03',
        'apr': '04', 'april': '04',
        'may': '05',
        'jun': '06', 'june': '06',
        'jul': '07', 'july': '07',
        'aug': '08', 'august': '08',
        'sep': '09', 'september': '09',
        'oct': '10', 'october': '10',
        'nov': '11', 'november': '11',
        'dec': '12', 'december': '12'
      };
      const month = monthMap[monthYearMatch[1].toLowerCase()];
      const year = monthYearMatch[2];
      return { date: `${year}-${month}-01`, is_current: false };
    }
    
    // Format: "MM/YYYY" or "MM-YYYY"
    const mmYearMatch = cleanDate.match(/^(\d{1,2})[\/-](\d{4})$/);
    if (mmYearMatch) {
      const month = mmYearMatch[1].padStart(2, '0');
      const year = mmYearMatch[2];
      return { date: `${year}-${month}-01`, is_current: false };
    }
    
    // Format: "YYYY-MM" or "YYYY/MM"
    const yearMmMatch = cleanDate.match(/^(\d{4})[\/-](\d{1,2})$/);
    if (yearMmMatch) {
      const year = yearMmMatch[1];
      const month = yearMmMatch[2].padStart(2, '0');
      return { date: `${year}-${month}-01`, is_current: false };
    }
    
    // Format: Just year "2023"
    const yearMatch = cleanDate.match(/^(\d{4})$/);
    if (yearMatch) {
      return { date: `${yearMatch[1]}-01-01`, is_current: false };
    }
    
    // Format: Already in ISO format "YYYY-MM-DD"
    const isoMatch = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return { date: cleanDate, is_current: false };
    }
    
    // Try to parse as a regular date
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return { date: parsed.toISOString().split('T')[0], is_current: false };
    }
    
  } catch (error) {
    console.log(`Could not parse date: "${dateStr}"`, error);
  }
  
  // If we can't parse it, assume it's not current
  return { date: null, is_current: false };
}

// Updated function to normalize parsed data with proper date handling
function normalizeParsedData(data: any): ParsedResumeData {
  // Normalize companies
  const companies = (data.companies || []).map((company: any) => {
    const startDateInfo = parseDate(company.start_date);
    const endDateInfo = parseDate(company.end_date);
    
    return {
      name: company.name,
      start_date: startDateInfo.date || '1900-01-01', // Fallback date
      end_date: endDateInfo.is_current ? null : endDateInfo.date,
      is_current: endDateInfo.is_current || company.is_current === true
    };
  });
  
  // Normalize roles
  const roles = (data.roles || []).map((role: any) => {
    const startDateInfo = parseDate(role.start_date);
    const endDateInfo = parseDate(role.end_date);
    
    return {
      title: role.title,
      start_date: startDateInfo.date || '1900-01-01', // Fallback date
      end_date: endDateInfo.is_current ? null : endDateInfo.date,
      is_current: endDateInfo.is_current || role.is_current === true,
      company_name: role.company_name
    };
  });
  
  // Experiences don't need date normalization
  const experiences = data.experiences || [];
  
  return { companies, roles, experiences };
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

// Updated prompt with better date handling instructions
function createExperiencePrompt(resumeText: string): string {
  return `Extract work experience from this resume text and format as JSON.

TEXT:
${resumeText}

IMPORTANT: Create ONE experience entry for EACH bullet point (•) or achievement line. Do not group multiple bullets into one experience.

For dates, handle these formats properly:
- "Nov 2023" → "2023-11-01" with is_current: false
- "November 2023" → "2023-11-01" with is_current: false  
- "Present" → end_date: null, is_current: true
- "Current" → end_date: null, is_current: true
- "11/2023" → "2023-11-01" with is_current: false
- "2023" → "2023-01-01" with is_current: false

Extract:
1. All companies with start/end dates (avoid duplicates)
2. All job roles with start/end dates and company names  
3. EACH individual bullet point as a separate experience with STAR format

Example: If a role has 5 bullet points, create 5 separate experience entries.

Return JSON in this exact format:
{
  "companies": [{"name": "Company Name", "start_date": "YYYY-MM-DD or original format", "end_date": "YYYY-MM-DD or 'Present' or 'Current' or null", "is_current": false}],
  "roles": [{"title": "Job Title", "start_date": "YYYY-MM-DD or original format", "end_date": "YYYY-MM-DD or 'Present' or 'Current' or null", "is_current": false, "company_name": "Company Name"}],
  "experiences": [{"title": "Achievement description", "situation": "Context or null", "task": "Task or null", "action": "What was done", "result": "Outcome", "role_title": "Job Title", "company_name": "Company Name"}]
}

Rules:
- Keep original date formats as provided (e.g., "Nov 2023", "Present", "Current")
- Set is_current: true ONLY if end_date contains words like "Present", "Current", "Now", "Ongoing"
- Create exactly ONE experience entry per bullet point or responsibility
- Each bullet point becomes one separate experience object
- Company names must be unique (no duplicates)
- Return only valid JSON`;
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
    let body;
    let resumeText;
    
    const contentType = req.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    
    try {
      if (contentType.includes('application/json')) {
        // Handle JSON request
        body = await req.json();
        resumeText = body.resumeText;
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        // Handle form data
        const formData = await req.formData();
        resumeText = formData.get('resumeText') as string;
      } else {
        // Try to read as text and then parse
        const rawBody = await req.text();
        console.log('Raw request body (first 200 chars):', rawBody.substring(0, 200));
        
        // Try to parse as JSON first
        try {
          body = JSON.parse(rawBody);
          resumeText = body.resumeText;
        } catch (jsonError) {
          console.log('Not valid JSON, checking other formats');
          
          // Check if it might be form data
          if (rawBody.includes('resumeText=')) {
            const params = new URLSearchParams(rawBody);
            resumeText = params.get('resumeText');
          } else {
            // Treat the entire body as resume text
            resumeText = rawBody.trim();
          }
        }
      }
    } catch (error) {
      console.error('Error reading request body:', error);
      throw new Error('Failed to read request data. Please check the request format.');
    }

    if (!resumeText || typeof resumeText !== 'string') {
      console.error('Invalid resume text received:', resumeText);
      console.error('Request headers:', req.headers);
      throw new Error('No valid resume text provided. Please ensure you\'re sending the resume text in the request body.');
    }

    if (resumeText.trim().length < 50) {
      throw new Error('Resume text too short. Please provide your work experience details including company names, job titles, dates, and responsibilities.');
    }

    // Process the text to focus on experience extraction
    const processedText = preprocessExperienceText(resumeText);
    console.log(`Text processing: ${resumeText.length} → ${processedText.length} chars`);
    console.log(`Processed text preview:`, processedText.substring(0, 300) + '...');

    // AI parsing with retry logic for better reliability
    let parsedData: ParsedResumeData | null = null;
    const maxAttempts = 3;
    const models = ['gpt-4o-mini-2024-07-18']; // Use only the most reliable model for now
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
                content: 'You are a resume parsing expert. Always respond with valid JSON only. No additional text, explanations, or formatting.' 
              },
              { 
                role: 'user', 
                content: createExperiencePrompt(processedText) 
              }
            ],
            max_completion_tokens: 4000,
            temperature: 0.1
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
        
        console.log(`Raw AI response (attempt ${attempts}):`, generatedText.substring(0, 500) + '...');
        
        // Enhanced JSON extraction
        const jsonString = extractAndCleanJSON(generatedText);
        
        if (!jsonString) {
          console.log(`Attempt ${attempts}: Could not extract valid JSON from response`);
          console.log(`Full response was:`, generatedText);
          continue;
        }
        
        console.log(`Extracted JSON string (attempt ${attempts}):`, jsonString.substring(0, 200) + '...');
        
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
          console.log(`Raw data that failed validation:`, JSON.stringify(tempData, null, 2));
          
          // If it's the last attempt with current model, try next model
          if (attempts < maxAttempts && currentModelIndex < models.length - 1) {
            currentModelIndex++;
          }
          continue;
        }
        
        // Normalize dates and current status
        parsedData = normalizeParsedData(tempData);
        console.log(`✓ Successfully parsed and normalized data on attempt ${attempts}`);
        
        // Log the normalized data for debugging
        console.log('Normalized companies:', parsedData.companies.map(c => ({
          name: c.name,
          start_date: c.start_date,
          end_date: c.end_date,
          is_current: c.is_current
        })));
        console.log('Normalized roles:', parsedData.roles.map(r => ({
          title: r.title,
          company: r.company_name,
          start_date: r.start_date,
          end_date: r.end_date,
          is_current: r.is_current
        })));
        
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
      throw new Error('Unable to extract work experience from the provided text after multiple attempts with different models. Please ensure your text includes company names, job titles, employment dates, and specific responsibilities or achievements. You can paste either your full resume or just the work experience section.');
    }

    console.log(`Successfully parsed: ${parsedData.companies.length} companies, ${parsedData.roles.length} roles, ${parsedData.experiences.length} experiences`);

    // Database operations with better error handling and matching
    const results: { companies: any[]; roles: any[]; experiences: any[] } = { companies: [], roles: [], experiences: [] };

    try {
      // Calculate proper company dates from roles and remove duplicates
      const companyDateMap = new Map<string, { start_date: string; end_date: string | null; is_current: boolean }>();
      
      for (const role of parsedData.roles) {
        const companyName = role.company_name.trim().toLowerCase(); // Use lowercase for comparison
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

      // Create unique companies list by consolidating duplicates
      const uniqueCompanies = new Map<string, ParsedCompany>();
      
      for (const company of parsedData.companies) {
        const companyKey = company.name.trim().toLowerCase();
        const correctedDates = companyDateMap.get(companyKey);
        
        if (!uniqueCompanies.has(companyKey)) {
          uniqueCompanies.set(companyKey, {
            name: company.name.trim(), // Keep original casing
            start_date: correctedDates?.start_date || company.start_date,
            end_date: correctedDates?.end_date || company.end_date,
            is_current: correctedDates?.is_current || company.is_current
          });
        }
      }

      // Insert unique companies
      if (uniqueCompanies.size > 0) {
        const companyInserts = Array.from(uniqueCompanies.values()).map(company => ({
          user_id: user.id,
          name: company.name,
          start_date: company.start_date,
          end_date: company.end_date,
          is_current: company.is_current
        }));
        
        results.companies = await batchInsert(supabase, 'companies', companyInserts);
        console.log(`✓ Inserted ${results.companies.length} unique companies`);
        
        // Log the inserted companies for debugging
        results.companies.forEach(company => {
          console.log(`Company: ${company.name}, Current: ${company.is_current}, End Date: ${company.end_date}`);
        });
      }

      // Insert roles with enhanced matching (case-insensitive)
      if (parsedData.roles.length > 0) {
        const roleInserts = parsedData.roles.map(role => {
          // Find company using case-insensitive matching
          const company = results.companies.find(c => 
            c.name.trim().toLowerCase() === role.company_name.trim().toLowerCase()
          );
          
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
        console.log(`✓ Inserted ${results.roles.length} roles`);
        
        // Log the inserted roles for debugging
        results.roles.forEach(role => {
          const company = results.companies.find(c => c.id === role.company_id);
          console.log(`Role: ${role.title} at ${company?.name}, Current: ${role.is_current}, End Date: ${role.end_date}`);
        });
      }

      // Insert experiences with enhanced matching (case-insensitive)
      if (parsedData.experiences.length > 0) {
        const experienceInserts = parsedData.experiences.map((experience, index) => {
          // Find role that matches both title and company (case-insensitive)
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
        console.log(`✓ Inserted ${results.experiences.length} experiences`);
      }

    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      throw new Error(`Database error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
    }

    // Success response with better debugging info
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
        companies: results.companies.slice(0, 2).map(c => ({
          name: c.name,
          is_current: c.is_current,
          end_date: c.end_date
        })),
        roles: results.roles.slice(0, 3).map(r => ({
          title: r.title,
          is_current: r.is_current,
          end_date: r.end_date
        })),
        experience_titles: results.experiences.slice(0, 5).map(exp => exp.title)
      },
      debug_info: {
        date_parsing_examples: [
          "Nov 2023 → 2023-11-01 (is_current: false)",
          "Present → null (is_current: true)", 
          "Current → null (is_current: true)"
        ]
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
          'Use "Present", "Current", "Now" for ongoing roles',
          'Specific responsibilities and achievements',
          'Bullet points describing your work'
        ],
        format_examples: [
          'Software Engineer at Google (Jan 2020 - Present)',
          'Marketing Manager at Apple (Mar 2018 - Nov 2023)',
          '• Developed web applications using React and Node.js',
          '• Improved system performance by 30%',
          'OR just paste your entire resume - the system will find the experience section'
        ],
        date_formats_supported: [
          '"Nov 2023", "November 2023" for ended roles',
          '"Present", "Current", "Now", "Ongoing" for current roles',
          '"11/2023", "2023-11", "2023" also supported'
        ]
      }
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
