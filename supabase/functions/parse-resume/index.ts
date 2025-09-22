// Smart optimization: Keep quality, reduce costs strategically

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
  result: string | null;
  role_title: string;
  company_name: string;
}

interface ParsedResumeData {
  companies: ParsedCompany[];
  roles: ParsedRole[];
  experiences: ParsedExperience[];
}

// Smart text preprocessing - removes fluff but keeps structure
function preprocessResumeText(text: string): string {
  // Remove contact info and common fluff, but preserve work experience structure
  const cleaned = text
    .replace(/(?:references available|email:|phone:|address:|linkedin:|github:)[^\n]*/gi, '')
    .replace(/(?:objective|summary|profile)[:\s]*[^\n]*/gi, '') // Remove objective/summary
    .replace(/(?:skills|technologies|competencies)[:\s]*[^\n]*/gi, '') // Remove skills section
    .replace(/education[:\s]*[\s\S]*?(?=(?:experience|work|employment|professional))/gi, '') // Remove education
    .replace(/\n\s*\n/g, '\n')
    .replace(/\s{3,}/g, ' ')
    .trim();
    
  // If still too long, intelligently truncate by keeping work experience sections
  if (cleaned.length > 6000) {
    const experienceMatch = cleaned.match(/(experience|work|employment|professional)[\s\S]*/gi);
    if (experienceMatch && experienceMatch[0]) {
      return experienceMatch[0].substring(0, 6000);
    }
    return cleaned.substring(0, 6000);
  }
  
  return cleaned;
}

// More efficient but still precise prompt
function createOptimizedPrompt(resumeText: string): string {
  return `Parse this resume into structured data. For each bullet point, create ONE experience entry with proper STAR breakdown and meaningful titles.

Resume:
${resumeText}

CRITICAL REQUIREMENTS:
1. Create ONE experience per bullet point
2. Break each bullet into STAR format (Situation, Task, Action, Result)
3. Generate titles as: "Result/Impact - Action Keywords" (e.g., "Increased sales 25% - automated reporting system")

Return ONLY valid JSON:
{
  "companies": [{"name": "Company", "start_date": "YYYY-MM", "end_date": "YYYY-MM", "is_current": false}],
  "roles": [{"title": "Role", "start_date": "YYYY-MM", "end_date": "YYYY-MM", "is_current": false, "company_name": "Company"}],
  "experiences": [
    {
      "title": "Impact/Result - Action Keywords",
      "situation": "Context/background or null",
      "task": "What needed to be done or null", 
      "action": "Specific actions taken",
      "result": "Quantified outcome or null",
      "role_title": "Exact role from roles array",
      "company_name": "Exact company from companies array"
    }
  ]
}

Title Examples:
- "Reduced costs 30% - process automation"
- "Led team of 8 - project management"  
- "Improved accuracy 95% - system redesign"
- "Generated $2M revenue - client acquisition"`;
}

// Batch database operations with better error handling
async function batchInsert(supabase: any, table: string, data: any[], batchSize = 50) {
  const results = [];
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const { data: batchResults, error } = await supabase
      .from(table)
      .insert(batch)
      .select();
    
    if (error) {
      console.error(`Batch insert error for ${table}:`, error);
      throw new Error(`Failed to insert ${table}: ${error.message}`);
    }
    
    if (batchResults) {
      results.push(...batchResults);
    }
  }
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting smart resume parsing');
    
    // Setup (same as before)
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!geminiApiKey) throw new Error('Gemini API key not configured');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Auth check
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
    const { data: recentParses } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);
    
    if (recentParses && recentParses.length >= 3) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit: Maximum 3 resume parses per hour' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract text (same PDF/text handling as before)
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const resumeText = formData.get('resumeText') as string;

    let extractedText = '';
    if (file) {
      if (file.type === 'text/plain') {
        extractedText = await file.text();
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const pdfText = new TextDecoder().decode(uint8Array);
        const textMatches = pdfText.match(/stream\s*\n(.*?)\nendstream/gs);
        
        if (textMatches && textMatches.length > 0) {
          extractedText = textMatches
            .map(match => match.replace(/stream\s*\n|\nendstream/g, ''))
            .join(' ')
            .replace(/[^\w\s\.\,\-\(\)\/\:]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
        
        if (!extractedText || extractedText.length < 50) {
          throw new Error('Could not extract readable text from PDF');
        }
      } else {
        throw new Error('Unsupported file format');
      }
    } else if (resumeText) {
      extractedText = resumeText;
    } else {
      throw new Error('No file or text provided');
    }

    // Smart preprocessing
    const processedText = preprocessResumeText(extractedText);
    console.log(`Text optimized: ${extractedText.length} → ${processedText.length} chars`);

    // Use Gemini Flash for better cost efficiency while maintaining quality
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: createOptimizedPrompt(processedText) }] }],
        generationConfig: {
          maxOutputTokens: 4096, // Enough for detailed parsing
          temperature: 0, // Consistent results
          topP: 0.8,
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error('No response from Gemini API');
    }

    // Parse and validate
    let parsedData: ParsedResumeData;
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in Gemini response');
      parsedData = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (!parsedData.companies || !parsedData.roles || !parsedData.experiences) {
        throw new Error('Invalid data structure from AI parser');
      }
      
      // Validate that experiences have proper STAR format
      for (const exp of parsedData.experiences) {
        if (!exp.title || !exp.action) {
          throw new Error('Experiences missing required title or action');
        }
      }
      
    } catch (parseError) {
      console.error('Parse error:', generatedText.substring(0, 500));
      throw new Error('Invalid JSON response from AI parser');
    }

    console.log(`Parsed: ${parsedData.companies.length} companies, ${parsedData.roles.length} roles, ${parsedData.experiences.length} experiences`);

    // Batch database operations
    const results = { companies: [], roles: [], experiences: [] };

    // Insert companies
    if (parsedData.companies.length > 0) {
      const companyInserts = parsedData.companies.map(company => ({
        user_id: user.id,
        name: company.name,
        start_date: company.start_date,
        end_date: company.end_date,
        is_current: company.is_current
      }));
      
      results.companies = await batchInsert(supabase, 'companies', companyInserts);
    }

    // Insert roles
    if (parsedData.roles.length > 0) {
      const roleInserts = parsedData.roles.map(role => {
        const company = results.companies.find(c => c.name === role.company_name);
        if (!company) throw new Error(`Company not found: ${role.company_name}`);
        
        return {
          user_id: user.id,
          company_id: company.id,
          title: role.title,
          start_date: role.start_date,
          end_date: role.end_date,
          is_current: role.is_current
        };
      });
      
      results.roles = await batchInsert(supabase, 'roles', roleInserts);
    }

    // Insert experiences
    if (parsedData.experiences.length > 0) {
      const experienceInserts = parsedData.experiences.map(experience => {
        const role = results.roles.find(r => r.title === experience.role_title);
        if (!role) throw new Error(`Role not found: ${experience.role_title}`);
        
        return {
          user_id: user.id,
          role_id: role.id,
          title: experience.title,
          situation: experience.situation,
          task: experience.task,
          action: experience.action,
          result: experience.result,
          tags: []
        };
      });
      
      results.experiences = await batchInsert(supabase, 'experiences', experienceInserts);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully imported ${results.companies.length} companies, ${results.roles.length} roles, and ${results.experiences.length} experiences`,
      data: {
        companies: results.companies.length,
        roles: results.roles.length,
        experiences: results.experiences.length
      },
      sample_titles: results.experiences.slice(0, 3).map(exp => exp.title)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in parse-resume function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse resume';
    const statusCode = errorMessage.includes('Rate limit') ? 429 : 
                      errorMessage.includes('Unsupported') || errorMessage.includes('extract') ? 400 : 500;
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
