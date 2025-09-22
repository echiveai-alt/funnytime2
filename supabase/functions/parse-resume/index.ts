import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simplified interfaces
interface CompanyData {
  name: string;
  period: string; // "2020-2023" or "2020-present"
}

interface RoleData {
  title: string;
  company: string;
  period: string;
  bullets: string[];
}

interface ParsedResumeData {
  companies: CompanyData[];
  roles: RoleData[];
}

// Pre-process resume text to reduce size
function preprocessResumeText(text: string): string {
  return text
    // Remove common resume fluff
    .replace(/references available upon request/gi, '')
    .replace(/\bemail:\s*\S+@\S+/gi, '')
    .replace(/\bphone:\s*[\d\-\(\)\s]+/gi, '')
    .replace(/\baddress:\s*[^\n]+/gi, '')
    // Remove excessive whitespace
    .replace(/\n\s*\n/g, '\n')
    .replace(/\s{3,}/g, ' ')
    .trim()
    // Limit to reasonable size (adjust based on your needs)
    .substring(0, 4000); // Truncate if too long
}

// Simplified prompt that focuses on extraction, not formatting
function createOptimizedPrompt(resumeText: string): string {
  return `Extract work history from this resume. Return only JSON:

${resumeText}

Format:
{
  "companies": [{"name": "CompanyName", "period": "YYYY-YYYY"}],
  "roles": [{"title": "JobTitle", "company": "CompanyName", "period": "YYYY-YYYY", "bullets": ["achievement1", "achievement2"]}]
}`;
}

// Batch processing helper
async function processInBatches<T>(items: T[], batchSize: number, processor: (batch: T[]) => Promise<any[]>) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting optimized resume parsing');
    
    // Environment and auth setup (same as before)
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!geminiApiKey) throw new Error('Gemini API key not configured');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
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

    // Extract and preprocess text
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const resumeText = formData.get('resumeText') as string;

    let extractedText = '';
    if (file) {
      if (file.type === 'text/plain') {
        extractedText = await file.text();
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Simplified PDF extraction
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const pdfText = new TextDecoder().decode(uint8Array);
        
        // Basic PDF text extraction
        extractedText = pdfText
          .replace(/[^\w\s\.\,\-\(\)\/\:\n]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
          
        if (extractedText.length < 50) {
          throw new Error('Could not extract text from PDF');
        }
      } else {
        throw new Error('Unsupported file format');
      }
    } else if (resumeText) {
      extractedText = resumeText;
    } else {
      throw new Error('No file or text provided');
    }

    // Preprocess to reduce size
    const processedText = preprocessResumeText(extractedText);
    console.log(`Text reduced from ${extractedText.length} to ${processedText.length} characters`);

    // Use smaller, faster model if available (gemini-1.5-flash is cheaper/faster)
    const model = 'gemini-1.5-flash'; // or keep gemini-1.5-pro for better accuracy
    const optimizedPrompt = createOptimizedPrompt(processedText);

    // Call Gemini with optimized settings
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: optimizedPrompt }] }],
        generationConfig: {
          maxOutputTokens: 2048, // Limit output size
          temperature: 0.1, // Lower temperature for more consistent output
        }
      })
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error('No response from Gemini API');
    }

    // Parse response
    let parsedData: ParsedResumeData;
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      parsedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      throw new Error('Invalid JSON response from AI');
    }

    // Batch database operations for efficiency
    console.log('Starting batch database operations');
    
    // Create companies in batch
    const companyInserts = parsedData.companies.map(company => ({
      user_id: user.id,
      name: company.name,
      start_date: company.period.split('-')[0] + '-01-01',
      end_date: company.period.includes('present') ? null : company.period.split('-')[1] + '-12-31',
      is_current: company.period.includes('present')
    }));

    const { data: companies, error: companyError } = await supabase
      .from('companies')
      .insert(companyInserts)
      .select();

    if (companyError) {
      console.error('Company insert error:', companyError);
      throw new Error('Failed to create companies');
    }

    // Create roles and experiences in batches
    const roleInserts = [];
    const experienceInserts = [];

    for (const role of parsedData.roles) {
      const company = companies.find(c => c.name === role.company);
      if (!company) continue;

      const roleData = {
        user_id: user.id,
        company_id: company.id,
        title: role.title,
        start_date: role.period.split('-')[0] + '-01-01',
        end_date: role.period.includes('present') ? null : role.period.split('-')[1] + '-12-31',
        is_current: role.period.includes('present')
      };
      
      roleInserts.push(roleData);
    }

    const { data: roles, error: roleError } = await supabase
      .from('roles')
      .insert(roleInserts)
      .select();

    if (roleError) {
      console.error('Role insert error:', roleError);
      throw new Error('Failed to create roles');
    }

    // Create experiences
    for (let i = 0; i < parsedData.roles.length; i++) {
      const role = parsedData.roles[i];
      const dbRole = roles[i];
      
      if (!dbRole) continue;

      for (const bullet of role.bullets) {
        experienceInserts.push({
          user_id: user.id,
          role_id: dbRole.id,
          title: bullet.substring(0, 100), // First 100 chars as title
          action: bullet,
          situation: null,
          task: null,
          result: null,
          tags: []
        });
      }
    }

    // Insert experiences in smaller batches to avoid timeouts
    const experienceResults = await processInBatches(
      experienceInserts, 
      10, // Batch size
      async (batch) => {
        const { data, error } = await supabase
          .from('experiences')
          .insert(batch)
          .select();
        if (error) throw error;
        return data || [];
      }
    );

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Imported ${companies.length} companies, ${roles.length} roles, ${experienceResults.length} experiences`,
      data: {
        companies: companies.length,
        roles: roles.length, 
        experiences: experienceResults.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
