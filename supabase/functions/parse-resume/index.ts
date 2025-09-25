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

// Optimized hybrid text preprocessing approach
function preprocessResumeText(text: string): string {
  console.log(`Original text length: ${text.length}`);
  
  // Step 1: Quick normalization
  let cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  // Step 2: Fast attempt to isolate experience section
  const experienceSection = fastExtractExperience(cleaned);
  
  if (experienceSection && experienceSection.length > 200) {
    console.log(`✓ Isolated experience section: ${experienceSection.length} chars (${Math.round((experienceSection.length/text.length)*100)}% of original)`);
    cleaned = experienceSection;
  } else {
    console.log(`✗ Experience isolation failed, using removal approach`);
    cleaned = efficientRemovalCleaning(cleaned);
  }
  
  // Step 3: Smart truncation only if still too long
  if (cleaned.length > 6000) {
    console.log(`Text still too long (${cleaned.length}), applying intelligent truncation`);
    cleaned = intelligentTruncation(cleaned);
  }
  
  console.log(`Final processed text: ${cleaned.length} chars`);
  return cleaned;
}

// Fast experience extraction with minimal regex operations
function fastExtractExperience(text: string): string | null {
  // Single pass to find experience section bounds
  const experienceRegex = /(?:^|\n)\s*(?:(?:work\s+)?experience|professional\s+experience|employment\s+(?:history|record)|career\s+(?:history|summary)|work\s+history)\s*(?:[:|\n])([\s\S]*?)(?=(?:\n\s*(?:education|skills?|certifications?|awards?|publications?|references?|additional\s+information)\s*[:|\n])|$)/gi;
  
  const match = experienceRegex.exec(text);
  return match && match[1] && match[1].trim().length > 100 ? match[1].trim() : null;
}

// Optimized removal approach - single pass with combined regex
function efficientRemovalCleaning(text: string): string {
  // Single regex that removes multiple section types in one pass
  return text
    // Remove everything before first work section
    .replace(/^[\s\S]*?(?=(?:objective|summary|profile|experience|work|employment|professional))/gi, '')
    // Remove non-work sections in one pass
    .replace(/(?:^|\n)\s*(?:(?:contact|personal)\s+(?:information|details)|email:|phone:|tel:|mobile:|address:|linkedin:|github:|portfolio:)[^\n]*/gi, '')
    .replace(/(?:^|\n)\s*(?:objective|summary|profile|skills?|technologies|competencies|technical\s+skills|education|certifications?|awards?|publications?|references?|additional\s+information)\s*[:|\n][\s\S]*?(?=(?:\n\s*(?:experience|work|employment|professional|\w+\s+(?:engineer|developer|manager|analyst|specialist|coordinator|director|lead|senior|junior))))|$/gi, '')
    // Clean up whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/\s{3,}/g, ' ')
    .trim();
}





// NEW: Intelligent truncation that preserves complete job entries
function intelligentTruncation(text: string): string {
  const lines = text.split('\n');
  let result = '';
  let currentLength = 0;
  const maxLength = 5800; // Leave room for processing
  
  // Try to identify job entries and keep them complete
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for newline
    
    // If adding this line would exceed limit
    if (currentLength + lineLength > maxLength) {
      // Check if this looks like the start of a new job entry
      if (isJobEntryStart(line)) {
        // Don't start a new job entry if we're near the limit
        break;
      }
      // If it's a bullet point or continuation, add it if there's some room
      if (currentLength < maxLength - 100) {
        result += line + '\n';
        currentLength += lineLength;
      }
      break;
    }
    
    result += line + '\n';
    currentLength += lineLength;
  }
  
  return result.trim();
}

// Helper function to identify job entry starts
function isJobEntryStart(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  
  // Check for job title patterns
  const jobTitlePatterns = [
    /^[a-z\s]+(?:engineer|developer|manager|analyst|specialist|coordinator|director|lead|senior|junior|associate|consultant|advisor)/,
    /^(?:senior|junior|lead|principal|staff|associate)\s+[a-z\s]+/,
    /^\w+\s+(?:at|@)\s+\w+/, // "Position at Company" format
  ];
  
  // Check for company/date patterns
  const companyDatePattern = /\b(?:19|20)\d{2}\b.*(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
  
  return jobTitlePatterns.some(pattern => pattern.test(trimmed)) || 
         companyDatePattern.test(line);
}

// Enhanced prompt with better guidance for experience extraction
function createOptimizedPrompt(resumeText: string): string {
  return `Parse this resume text into structured data. Extract work experience information and convert each responsibility/achievement bullet point into a separate experience entry with STAR format.

Resume Text:
${resumeText}

PARSING INSTRUCTIONS:
1. COMPANIES: Extract all companies worked at (dates will be calculated from roles)
2. ROLES: Extract job titles with their exact date ranges and associated companies  
3. EXPERIENCES: For each bullet point under each role, create ONE experience entry
4. IMPORTANT: Create exactly one experience entry per bullet point - do not create extra entries

EXPERIENCE TITLE GENERATION:
- Format: "Result/Impact - Action Keywords" 
- Focus on measurable outcomes when available
- Examples: "Increased sales 25% - automated reporting", "Led team of 8 - agile development"
- If no clear result: "Action description - key skills used"

STAR FORMAT BREAKDOWN:
- Situation: Context or background (can be null if not clear)
- Task: What needed to be accomplished (can be null if merged with action)  
- Action: Specific actions taken (REQUIRED - never null)
- Result: Quantified outcome or benefit (REQUIRED - never null)

DATE FORMAT: Use "YYYY-MM-DD" format. If only year available, use "YYYY-01-01" for start dates and "YYYY-12-31" for end dates. If month but no day, use "YYYY-MM-01" for start dates and "YYYY-MM-28" for end dates.

Return ONLY valid JSON in this exact format:
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
      "title": "Impact/Result - Action Keywords",
      "situation": "Context or null",
      "task": "What needed to be done or null",
      "action": "Specific actions taken", 
      "result": "Outcome",
      "role_title": "Exact role title from roles array",
      "company_name": "Exact company name from companies array"
    }
  ]
}`;
}

// Enhanced PDF text extraction with better methods
async function extractPDFText(arrayBuffer: ArrayBuffer): Promise<string> {
  const uint8Array = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(uint8Array);
  
  let extractedText = '';
  
  // Method 1: Look for uncompressed stream content with better regex
  const streamPattern = /stream\s*?\n([\s\S]*?)\s*?endstream/gi;
  const streamMatches = [...text.matchAll(streamPattern)];
  
  if (streamMatches.length > 0) {
    extractedText = streamMatches
      .map(match => match[1])
      .join('\n')
      .replace(/BT\s+/, '') // Remove text matrix commands
      .replace(/ET\s+/, '')
      .replace(/\/[A-Za-z0-9]+\s+\d+\.?\d*\s+Tf/g, '') // Remove font commands
      .replace(/\d+\.?\d*\s+\d+\.?\d*\s+Td/g, ' ') // Remove text positioning
      .replace(/\d+\.?\d*\s+TL/g, '') // Remove leading commands
      .replace(/[<>]/g, '') // Remove hex string markers
      .replace(/\[|\]/g, '') // Remove array markers
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  
  // Method 2: Look for text objects with improved pattern
  if (!extractedText || extractedText.length < 100) {
    const textPattern = /\(([^)]+)\)\s*?(?:Tj|TJ|'|")/gi;
    const textMatches = [...text.matchAll(textPattern)];
    
    if (textMatches.length > 0) {
      extractedText = textMatches
        .map(match => match[1])
        .join(' ')
        .replace(/\\[nrt]/g, ' ')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
  
  // Method 3: Look for readable text in the raw PDF (fallback)
  if (!extractedText || extractedText.length < 100) {
    // Extract readable ASCII text
    const readableText = text
      .replace(/[\x00-\x1F\x7F-\xFF]/g, ' ') // Remove non-printable chars
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(word => word.length > 1 && /[a-zA-Z]/.test(word))
      .join(' ')
      .trim();
      
    if (readableText.length > 100) {
      extractedText = readableText;
    }
  }
  
  if (!extractedText || extractedText.length < 100) {
    throw new Error('Could not extract sufficient text from PDF. The PDF may be scanned or have complex formatting. Try converting to text format or use a different PDF.');
  }
  
  console.log(`Extracted ${extractedText.length} characters from PDF`);
  return extractedText;
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
    console.log('Starting enhanced resume parsing');
    
    // Environment and client setup
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!openaiApiKey) {
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

    // Enhanced rate limiting check
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recentParses, error: rateLimitError } = await supabase
      .from('companies')
      .select('id, created_at')
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);
    
    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    }
    
    if (recentParses && recentParses.length >= 5) { // Increased limit slightly
      return new Response(JSON.stringify({ 
        error: `Rate limit exceeded: ${recentParses.length}/5 resume parses in the last hour. Try again later.` 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // File processing
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const resumeText = formData.get('resumeText') as string;

    let extractedText = '';
    
    if (file) {
      console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);
      
      if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
        extractedText = await file.text();
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        extractedText = await extractPDFText(arrayBuffer);
      } else {
        throw new Error(`Unsupported file format: ${file.type}. Please use PDF or TXT files.`);
      }
    } else if (resumeText) {
      extractedText = resumeText;
    } else {
      throw new Error('No file or text provided');
    }

    if (extractedText.length < 100) {
      throw new Error('Resume text too short. Please provide a complete resume.');
    }

    // Enhanced text preprocessing with fallback
    let processedText = preprocessResumeText(extractedText);
    console.log(`Text processing: ${extractedText.length} → ${processedText.length} chars`);
    
    // If preprocessing removed too much content, use original with basic cleaning
    if (processedText.length < extractedText.length * 0.1) {
      console.log('Preprocessing removed too much content, using fallback');
      processedText = extractedText
        .replace(/\r\n/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/\s{3,}/g, ' ')
        .trim()
        .substring(0, 6000); // Truncate if too long
    }

    // AI parsing with retry logic for better reliability
    let geminiResponse;
    let geminiData;
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`AI parsing attempt ${attempts}/${maxAttempts}`);
      
      geminiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-5-nano-2025-08-07',
          messages: [
            { role: 'user', content: createOptimizedPrompt(processedText) }
          ],
          max_completion_tokens: 4096
        })
      });
      
      if (geminiResponse.ok) {
        geminiData = await geminiResponse.json();
        const testText = geminiData.choices?.[0]?.message?.content;
        
        // Check if response contains valid JSON structure
        if (testText && testText.includes('"companies"') && testText.includes('"roles"') && testText.includes('"experiences"')) {
          break;
        } else {
          console.log(`Attempt ${attempts} failed - invalid response structure`);
          if (attempts === maxAttempts) {
            throw new Error('AI service returned unusable responses after multiple attempts. Please try reformatting your resume.');
          }
        }
      } else {
        if (attempts === maxAttempts) {
          const errorText = await geminiResponse.text();
          console.error('Gemini API error:', errorText);
          throw new Error(`AI service error: ${geminiResponse.status}. Please try again.`);
        }
      }
    }

    if (!geminiData) {
      throw new Error('Failed to get valid response from AI service');
    }

    
    if (geminiData.choices?.[0]?.finish_reason === 'content_filter') {
      throw new Error('Resume content was flagged by AI safety filters. Please review and try again.');
    }
    
    const generatedText = geminiData.choices?.[0]?.message?.content;
    
    if (!generatedText) {
      console.error('No response from OpenAI:', JSON.stringify(geminiData, null, 2));
      throw new Error('No response from AI service. Please try again.');
    }

    // Enhanced JSON parsing and validation
    let parsedData: ParsedResumeData;
    try {
      // More robust JSON extraction
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response:', generatedText.substring(0, 500));
        throw new Error('Invalid AI response format');
      }
      
      const jsonString = jsonMatch[0];
      parsedData = JSON.parse(jsonString);
      
      // Enhanced validation
      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('Invalid data structure');
      }
      
      if (!Array.isArray(parsedData.companies) || !Array.isArray(parsedData.roles) || !Array.isArray(parsedData.experiences)) {
        throw new Error('Missing required arrays in parsed data');
      }
      
      if (parsedData.companies.length === 0) {
        console.error('Response text:', generatedText);
        throw new Error('Unable to extract work experience from the resume. Please ensure your resume contains clear employment history with company names, job titles, and dates. You may also try uploading a text version of your resume for better parsing.');
      }
      
      if (parsedData.roles.length === 0) {
        console.error('Companies found but no roles:', parsedData.companies);
        throw new Error('Found companies but no job roles. Please ensure your resume clearly lists job titles for each position.');  
      }
      
      if (parsedData.experiences.length === 0) {
        console.error('Companies and roles found but no experiences:', { companies: parsedData.companies, roles: parsedData.roles });
        throw new Error('Found job history but no detailed responsibilities or achievements. Please ensure your resume includes bullet points describing your work accomplishments.');
      }
      
      // Validate experience structure
      for (const [index, exp] of parsedData.experiences.entries()) {
        if (!exp.title || !exp.action || !exp.role_title || !exp.company_name) {
          console.error(`Invalid experience at index ${index}:`, exp);
          throw new Error(`Experience ${index + 1} missing required fields`);
        }
      }
      
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Response text:', generatedText.substring(0, 1000));
      
      // Try to provide more helpful error messages based on the response
      if (generatedText.includes('cannot') || generatedText.includes('unable') || generatedText.includes('unclear')) {
        throw new Error('The AI could not clearly identify work experience in your resume. Please ensure your resume has a clear work experience section with company names, job titles, dates, and bullet points describing your responsibilities.');
      }
      
      throw new Error('Failed to parse AI response. The resume format may be unclear or corrupted. Try uploading a text version or reformatting your PDF.');
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
          
          // Final fallback: match by role title only (original behavior)
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
            tags: [] // Initialize empty tags array
          };
        });
        
        results.experiences = await batchInsert(supabase, 'experiences', experienceInserts);
      }

    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      throw new Error(`Database error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
    }

    // Success response with enhanced details
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully imported resume data`,
      data: {
        companies: results.companies.length,
        roles: results.roles.length,
        experiences: results.experiences.length,
        processing_stats: {
          original_text_length: extractedText.length,
          processed_text_length: processedText.length,
          compression_ratio: Math.round((processedText.length / extractedText.length) * 100)
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
    console.error('Resume parsing error:', error);
    
    const baseErrorMessage = error instanceof Error ? error.message : 'Failed to parse resume';
    let statusCode = 500;
    let errorMessage = baseErrorMessage;
    
    // Provide more specific error messages and status codes
    if (baseErrorMessage.includes('Rate limit')) {
      statusCode = 429;
    } else if (baseErrorMessage.includes('Unsupported') || baseErrorMessage.includes('too short')) {
      statusCode = 400;
    } else if (baseErrorMessage.includes('Unauthorized')) {
      statusCode = 401;
    } else if (baseErrorMessage.includes('extract work experience') || baseErrorMessage.includes('clearly identify') || baseErrorMessage.includes('No companies found')) {
      statusCode = 422; // Unprocessable Entity
      errorMessage += ' Try uploading a text version of your resume or ensure it has a clear work experience section with company names, job titles, and dates.';
    } else if (baseErrorMessage.includes('corrupted') || baseErrorMessage.includes('unclear')) {
      statusCode = 422;
      errorMessage += ' Consider reformatting your resume or converting it to a text file for better parsing.';
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false,
      timestamp: new Date().toISOString()
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
