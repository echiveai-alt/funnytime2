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

/* =========================
   Company de-dupe helpers
   ========================= */
function normalizeCompanyName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isoMin(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a ?? null;
  return a < b ? a : b;
}

function isoMax(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a ?? null;
  return a > b ? a : b;
}

function mergeDateEnvelope(
  items: Array<{ start_date: string; end_date: string | null; is_current: boolean }>
): { start_date: string; end_date: string | null; is_current: boolean } {
  let start: string | null = null;
  let end: string | null = null;
  let is_current = false;

  for (const it of items) {
    start = isoMin(start, it.start_date);
    if (it.is_current) {
      is_current = true;
      end = null;
    } else if (!is_current) {
      end = isoMax(end, it.end_date ?? null);
    }
  }
  return { start_date: start ?? items[0].start_date, end_date: is_current ? null : end, is_current };
}

/* cache whether DB has the name_normalized column */
let HAS_NORMALIZED_COL: boolean | null = null;
function looksLikeMissingColumn(err: any): boolean {
  const msg = (err?.message || err?.hint || '').toString().toLowerCase();
  return msg.includes('column') && msg.includes('name_normalized') && msg.includes('does not exist');
}

/**
 * Returns a single canonical company row for this user+name.
 * - Prefers fast, index-backed equality on name_normalized (if available)
 * - Falls back to ILIKE if the column doesn’t exist yet
 * - Merges dates
 * - Reassigns roles from duplicates to canonical and deletes extras
 * - Handles concurrent insert races (unique violation 23505)
 */
async function upsertOrGetCompany(
  supabase: any,
  userId: string,
  company: { name: string; start_date: string; end_date: string | null; is_current: boolean }
): Promise<any> {
  const displayName = company.name.trim();
  const norm = normalizeCompanyName(displayName);

  async function selectExisting(): Promise<{ rows: any[]; usedNormalized: boolean }> {
    // If we already learned the column is missing, go straight to ILIKE
    if (HAS_NORMALIZED_COL === false) {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, start_date, end_date, is_current, created_at')
        .eq('user_id', userId)
        .ilike('name', displayName)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return { rows: data ?? [], usedNormalized: false };
    }

    // Try normalized match
    const sel = await supabase
      .from('companies')
      .select('id, name, start_date, end_date, is_current, created_at')
      .eq('user_id', userId)
      .eq('name_normalized', norm)
      .order('created_at', { ascending: true });

    if (sel.error) {
      if (looksLikeMissingColumn(sel.error)) {
        HAS_NORMALIZED_COL = false;
        // Retry with ILIKE
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, start_date, end_date, is_current, created_at')
          .eq('user_id', userId)
          .ilike('name', displayName)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return { rows: data ?? [], usedNormalized: false };
      }
      throw sel.error;
    } else {
      HAS_NORMALIZED_COL = true;
      return { rows: sel.data ?? [], usedNormalized: true };
    }
  }

  let existingSel = await selectExisting();
  const existing = existingSel.rows;

  // Nothing exists — insert new (handle race if unique index present)
  if (!existing || existing.length === 0) {
    const { data: inserted, error: insErr } = await supabase
      .from('companies')
      .insert({
        user_id: userId,
        name: displayName,
        start_date: company.start_date,
        end_date: company.end_date,
        is_current: company.is_current,
      })
      .select()
      .single();

    if (insErr) {
      const code = (insErr as any)?.code;
      const msg = (insErr as any)?.message || '';
      if (code === '23505' || /duplicate key value/i.test(msg)) {
        // Someone else inserted concurrently — reselect canonical
        existingSel = await selectExisting();
        if (existingSel.rows.length > 0) return existingSel.rows[0];
      }
      throw insErr;
    }
    return inserted;
  }

  // We found one or more — pick the canonical (oldest created)
  const canonical = existing[0];

  // Merge date envelope across existing + incoming
  const merged = mergeDateEnvelope([
    ...existing.map((e: any) => ({
      start_date: e.start_date,
      end_date: e.end_date,
      is_current: e.is_current,
    })),
    {
      start_date: company.start_date,
      end_date: company.end_date,
      is_current: company.is_current,
    },
  ]);

  // Update canonical if dates changed
  if (
    canonical.start_date !== merged.start_date ||
    canonical.is_current !== merged.is_current ||
    (canonical.end_date ?? null) !== (merged.end_date ?? null)
  ) {
    const { data: updated, error: updErr } = await supabase
      .from('companies')
      .update({
        start_date: merged.start_date,
        end_date: merged.end_date,
        is_current: merged.is_current,
      })
      .eq('id', canonical.id)
      .select()
      .single();
    if (updErr) throw updErr;
    Object.assign(canonical, updated);
  }

  // If duplicates exist, move roles and delete extras
  if (existing.length > 1) {
    const duplicateIds = existing.slice(1).map((r: any) => r.id);

    const { error: moveErr } = await supabase
      .from('roles')
      .update({ company_id: canonical.id })
      .in('company_id', duplicateIds);
    if (moveErr) throw moveErr;

    const { error: delErr } = await supabase.from('companies').delete().in('id', duplicateIds);
    if (delErr) throw delErr;
  }

  return canonical;
}

/* =========================
   Validation & Parsing
   ========================= */

// Improved validation function for parsed data
function validateParsedData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Response is not a valid object');
    return { isValid: false, errors };
  }
  
  if (!Array.isArray(data.companies)) errors.push('Missing or invalid companies array');
  if (!Array.isArray(data.roles)) errors.push('Missing or invalid roles array');
  if (!Array.isArray(data.experiences)) errors.push('Missing or invalid experiences array');
  if (errors.length > 0) return { isValid: false, errors };
  
  if (data.companies.length === 0) errors.push('No companies found in resume');
  if (data.roles.length === 0) errors.push('No roles found in resume');
  if (data.experiences.length === 0) errors.push('No experiences found in resume');
  
  for (let i = 0; i < data.companies.length; i++) {
    const company = data.companies[i];
    if (!company.name || typeof company.name !== 'string') errors.push(`Company ${i + 1}: missing or invalid name`);
    if (!company.start_date || typeof company.start_date !== 'string') errors.push(`Company ${i + 1}: missing or invalid start_date`);
  }
  
  for (let i = 0; i < data.roles.length; i++) {
    const role = data.roles[i];
    if (!role.title || typeof role.title !== 'string') errors.push(`Role ${i + 1}: missing or invalid title`);
    if (!role.company_name || typeof role.company_name !== 'string') errors.push(`Role ${i + 1}: missing or invalid company_name`);
    if (!role.start_date || typeof role.start_date !== 'string') errors.push(`Role ${i + 1}: missing or invalid start_date`);
  }
  
  for (let i = 0; i < data.experiences.length; i++) {
    const exp = data.experiences[i];
    if (!exp.title || typeof exp.title !== 'string') errors.push(`Experience ${i + 1}: missing or invalid title`);
    if (!exp.action || typeof exp.action !== 'string') errors.push(`Experience ${i + 1}: missing or invalid action`);
    if (!exp.result || typeof exp.result !== 'string') errors.push(`Experience ${i + 1}: missing or invalid result`);
    if (!exp.role_title || typeof exp.role_title !== 'string') errors.push(`Experience ${i + 1}: missing or invalid role_title`);
    if (!exp.company_name || typeof exp.company_name !== 'string') errors.push(`Experience ${i + 1}: missing or invalid company_name`);
  }
  
  return { isValid: errors.length === 0, errors };
}

// Improved JSON extraction and cleaning
function extractAndCleanJSON(text: string): string | null {
  try {
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}') + 1;
    if (jsonStart === -1 || jsonEnd === 0) return null;
    let jsonString = cleaned.substring(jsonStart, jsonEnd);
    jsonString = jsonString
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/\n/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
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
  let cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  const experienceSection = extractExperienceSection(cleaned);
  if (experienceSection && experienceSection.length > 100) {
    console.log(`✓ Found experience section: ${experienceSection.length} chars`);
    cleaned = experienceSection;
  } else {
    console.log(`✗ No clear experience section found, using full text`);
  }
  if (cleaned.length > 4000) {
    console.log(`Text too long (${cleaned.length}), truncating`);
    cleaned = cleaned.substring(0, 4000);
  }
  console.log(`Final processed text: ${cleaned.length} chars`);
  return cleaned;
}

// Extract experience section from resume text
function extractExperienceSection(text: string): string | null {
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
  return `Extract work experience from this resume text and format as JSON.

TEXT:
${resumeText}

IMPORTANT: Create ONE experience entry for EACH bullet point (•) or achievement line. Do not group multiple bullets into one experience.

Extract:
1. All companies with start/end dates (avoid duplicates)
2. All job roles with start/end dates and company names  
3. EACH individual bullet point as a separate experience with STAR format

Example: If a role has 5 bullet points, create 5 separate experience entries.

Return JSON in this exact format:
{
  "companies": [{"name": "Company Name", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "is_current": false}],
  "roles": [{"title": "Job Title", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "is_current": false, "company_name": "Company Name"}],
  "experiences": [{"title": "Achievement description", "situation": "Context or null", "task": "Task or null", "action": "What was done", "result": "Outcome", "role_title": "Job Title", "company_name": "Company Name"}]
}

Rules:
- Use YYYY-MM-DD format. If only month/year, use YYYY-MM-01 for start, YYYY-MM-28 for end
- Create exactly ONE experience entry per bullet point or responsibility
- Each bullet point becomes one separate experience object
- Company names must be unique (no duplicates)
- Return only valid JSON`;
}

// Batch insert helper
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
    const candidateName = String(candidate[nameField] ?? '').trim().toLowerCase();
    if (!candidateName) continue;

    if (candidateName === targetLower) return candidate;

    let score = 0;
    if (candidateName.includes(targetLower) || targetLower.includes(candidateName)) {
      score = 0.8;
    }
    const targetWords = targetLower.split(/\s+/);
    const candidateWords = candidateName.split(/\s+/);
    const commonWords = targetWords.filter(word => candidateWords.includes(word));
    const wordOverlapScore = commonWords.length / Math.max(targetWords.length, candidateWords.length);
    score = Math.max(score, wordOverlapScore);
    if (score > bestScore && score > 0.5) {
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
    let body: any;
    let resumeText: string | undefined;
    
    const contentType = req.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    
    try {
      if (contentType.includes('application/json')) {
        body = await req.json();
        resumeText = body.resumeText;
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData();
        resumeText = formData.get('resumeText') as string;
      } else {
        const rawBody = await req.text();
        console.log('Raw request body (first 200 chars):', rawBody.substring(0, 200));
        try {
          body = JSON.parse(rawBody);
          resumeText = body.resumeText;
        } catch (_jsonError) {
          if (rawBody.includes('resumeText=')) {
            const params = new URLSearchParams(rawBody);
            resumeText = params.get('resumeText') ?? undefined;
          } else {
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

    // AI parsing with retry logic
    let parsedData: ParsedResumeData | null = null;
    const maxAttempts = 3;
    const models = ['gpt-5-nano']; // your current model
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
        const jsonString = extractAndCleanJSON(generatedText);
        if (!jsonString) {
          console.log(`Attempt ${attempts}: Could not extract valid JSON from response`);
          console.log(`Full response was:`, generatedText);
          continue;
        }
        console.log(`Extracted JSON string (attempt ${attempts}):`, jsonString.substring(0, 200) + '...');
        
        let tempData;
        try {
          tempData = JSON.parse(jsonString);
        } catch (parseError) {
          console.log(`Attempt ${attempts}: JSON parsing failed:`, parseError);
          continue;
        }
        
        const validation = validateParsedData(tempData);
        if (!validation.isValid) {
          console.log(`Attempt ${attempts}: Validation failed:`, validation.errors);
          console.log(`Raw data that failed validation:`, JSON.stringify(tempData, null, 2));
          if (attempts < maxAttempts && currentModelIndex < models.length - 1) {
            currentModelIndex++;
          }
          continue;
        }
        
        parsedData = tempData as ParsedResumeData;
        console.log(`✓ Successfully parsed data on attempt ${attempts}`);
        break;
        
      } catch (attemptError) {
        console.error(`Attempt ${attempts} failed:`, attemptError);
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

    // Database operations with de-dupe/merge
    const results: { companies: any[]; roles: any[]; experiences: any[] } = { companies: [], roles: [], experiences: [] };

    try {
      // Calculate proper company dates from roles and remove duplicates (by name)
      const companyDateMap = new Map<string, { start_date: string; end_date: string | null; is_current: boolean }>();
      for (const role of parsedData.roles) {
        const companyNameKey = normalizeCompanyName(role.company_name);
        const existing = companyDateMap.get(companyNameKey);
        if (!existing) {
          companyDateMap.set(companyNameKey, {
            start_date: role.start_date,
            end_date: role.end_date,
            is_current: role.is_current
          });
        } else {
          if (role.start_date < existing.start_date) existing.start_date = role.start_date;
          if (role.is_current) {
            existing.is_current = true;
            existing.end_date = null;
          } else if (!existing.is_current && role.end_date && (!existing.end_date || role.end_date > existing.end_date)) {
            existing.end_date = role.end_date;
          }
        }
      }

      // Create map of unique companies using normalized key, correcting dates via roles
      const uniqueCompanies = new Map<string, ParsedCompany>();
      for (const company of parsedData.companies) {
        const companyKey = normalizeCompanyName(company.name);
        const correctedDates = companyDateMap.get(companyKey);
        if (!uniqueCompanies.has(companyKey)) {
          uniqueCompanies.set(companyKey, {
            name: company.name.trim(), // preserve original casing
            start_date: correctedDates?.start_date || company.start_date,
            end_date: correctedDates?.end_date || company.end_date,
            is_current: correctedDates?.is_current ?? company.is_current
          });
        }
      }

      // Upsert/merge companies (no duplicates) and keep a canonical map
      const companiesByKey = new Map<string, any>();
      const canonicalCompanies: any[] = [];

      for (const company of Array.from(uniqueCompanies.values())) {
        const canonical = await upsertOrGetCompany(supabase, user.id, {
          name: company.name,
          start_date: company.start_date,
          end_date: company.end_date,
          is_current: company.is_current,
        });
        canonicalCompanies.push(canonical);
        companiesByKey.set(normalizeCompanyName(company.name), canonical);
      }

      results.companies = canonicalCompanies;
      console.log(`✓ Upserted/merged ${results.companies.length} companies`);

      // Insert roles with enhanced matching to canonical companies
      if (parsedData.roles.length > 0) {
        const roleInserts: any[] = [];

        for (const role of parsedData.roles) {
          const byKey = companiesByKey.get(normalizeCompanyName(role.company_name));
          let companyId: string | null = byKey?.id ?? null;

          // Fallback: case-insensitive DB lookup using name_normalized if we have it
          if (!companyId) {
            if (HAS_NORMALIZED_COL) {
              const { data: found, error: findErr } = await supabase
                .from('companies')
                .select('id, name')
                .eq('user_id', user.id)
                .eq('name_normalized', normalizeCompanyName(role.company_name))
                .limit(1);
              if (findErr) throw findErr;
              if (found && found.length > 0) companyId = found[0].id;
            } else {
              const { data: found, error: findErr } = await supabase
                .from('companies')
                .select('id, name')
                .eq('user_id', user.id)
                .ilike('name', role.company_name.trim())
                .limit(1);
              if (findErr) throw findErr;
              if (found && found.length > 0) companyId = found[0].id;
            }
          }

          if (!companyId) {
            throw new Error(`Cannot match role "${role.title}" to company "${role.company_name}".`);
          }

          roleInserts.push({
            user_id: user.id,
            company_id: companyId,
            title: role.title.trim(),
            start_date: role.start_date,
            end_date: role.end_date,
            is_current: role.is_current
          });
        }

        results.roles = await batchInsert(supabase, 'roles', roleInserts);
        console.log(`✓ Inserted ${results.roles.length} roles`);
      }

      // Insert experiences (role matching unchanged)
      if (parsedData.experiences.length > 0) {
        const experienceInserts = parsedData.experiences.map((experience, index) => {
          const matchingRoles = results.roles.filter(role => {
            const company = results.companies.find(c => c.id === role.company_id);
            return company && 
                   role.title.trim().toLowerCase() === experience.role_title.trim().toLowerCase() &&
                   company.name.trim().toLowerCase() === experience.company_name.trim().toLowerCase();
          });
          
          let role = matchingRoles.length > 0 ? matchingRoles[0] : null;
          
          if (!role) {
            role = findBestMatch(
              experience.role_title,
              results.roles.filter(r => {
                const company = results.companies.find(c => c.id === r.company_id);
                return company && company.name.trim().toLowerCase().includes(experience.company_name.trim().toLowerCase());
              }),
              'title'
            );
          }
          
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
    
    if (baseErrorMessage.includes('Rate limit')) {
      statusCode = 429;
    } else if (baseErrorMessage.includes('too short') || baseErrorMessage.includes('No resume text')) {
      statusCode = 400;
    } else if (baseErrorMessage.includes('Unauthorized')) {
      statusCode = 401;
    } else if (baseErrorMessage.includes('Unable to extract work experience')) {
      statusCode = 422;
      errorMessage = baseErrorMessage;
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
