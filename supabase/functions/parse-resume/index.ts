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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the authenticated user
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
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Authenticated user:', user.id);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const resumeText = formData.get('resumeText') as string;

    let extractedText = '';

    if (file) {
      // Extract text based on file type
      if (file.type === 'text/plain') {
        extractedText = await file.text();
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Parse PDF using a simple text extraction approach
        try {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Simple PDF text extraction - look for text between stream objects
          const pdfText = new TextDecoder().decode(uint8Array);
          const textMatches = pdfText.match(/stream\s*\n(.*?)\nendstream/gs);
          
          if (textMatches && textMatches.length > 0) {
            // Extract and clean text from PDF streams
            extractedText = textMatches
              .map(match => match.replace(/stream\s*\n|\nendstream/g, ''))
              .join(' ')
              .replace(/[^\w\s\.\,\-\(\)\/\:]/g, ' ') // Clean non-printable chars
              .replace(/\s+/g, ' ') // Normalize whitespace
              .trim();
          }
          
          if (!extractedText || extractedText.length < 50) {
            throw new Error('Could not extract readable text from PDF. Please try converting to text format or paste the content manually.');
          }
        } catch (pdfError) {
          console.error('PDF parsing error:', pdfError);
          throw new Error('Failed to parse PDF. Please convert to text format or paste the resume content manually.');
        }
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
        // For DOCX, we'll need a DOCX parsing library
        throw new Error('DOCX parsing not yet supported. Please convert to text format.');
      } else {
        throw new Error('Unsupported file format. Please upload PDF, DOCX, or TXT files.');
      }
    } else if (resumeText) {
      extractedText = resumeText;
    } else {
      throw new Error('No file or text provided');
    }

    console.log('Extracted text length:', extractedText.length);

    // Use Gemini to parse the resume text
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Parse this resume text and extract structured data. Return ONLY a valid JSON object with no additional text or formatting.

Resume text:
${extractedText}

Extract the following information and format as JSON:
{
  "companies": [
    {
      "name": "Company Name",
      "start_date": "YYYY-MM-DD or YYYY-MM if no day",
      "end_date": "YYYY-MM-DD or null if current",
      "is_current": true/false
    }
  ],
  "roles": [
    {
      "title": "Job Title",
      "start_date": "YYYY-MM-DD or YYYY-MM if no day", 
      "end_date": "YYYY-MM-DD or null if current",
      "is_current": true/false,
      "company_name": "Exact company name from companies array"
    }
  ],
  "experiences": [
    {
      "title": "Brief title for this achievement/project",
      "situation": "Context/background (can be null)",
      "task": "What needed to be done (can be null)", 
      "action": "What you did - this is required",
      "result": "Outcome/impact (can be null)",
      "role_title": "Exact role title from roles array",
      "company_name": "Exact company name from companies array"
    }
  ]
}

Guidelines:
- Convert each bullet point or achievement into one experience entry
- If dates are missing, use reasonable estimates based on context
- Ensure company_name and role_title exactly match entries in their respective arrays
- For start_date/end_date, prefer YYYY-MM-DD format but YYYY-MM is acceptable if day is unknown
- Action field is required for experiences, others can be null
- Extract meaningful titles for experiences from bullet points`
          }]
        }]
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response:', JSON.stringify(geminiData, null, 2));
    
    const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      throw new Error('No response from Gemini API');
    }

    // Parse the JSON response
    let parsedData: ParsedResumeData;
    try {
      // Clean the response to extract JSON
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Gemini response');
      }
      parsedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', generatedText);
      throw new Error('Invalid JSON response from AI parser');
    }

    // Validate the parsed data structure
    if (!parsedData.companies || !parsedData.roles || !parsedData.experiences) {
      throw new Error('Invalid data structure from AI parser');
    }

    console.log('Parsed resume data:', JSON.stringify(parsedData, null, 2));

    // Save to database
    const results = {
      companies: [],
      roles: [], 
      experiences: []
    };

    console.log('Starting database operations for user:', user.id);

    // Create companies
    for (const company of parsedData.companies) {
      console.log('Creating company:', company.name);
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          user_id: user.id,
          name: company.name,
          start_date: company.start_date,
          end_date: company.end_date,
          is_current: company.is_current
        })
        .select()
        .single();

      if (companyError) {
        console.error('Error creating company:', companyError);
        continue;
      }
      console.log('Successfully created company:', companyData);
      results.companies.push(companyData);
    }

    // Create roles
    for (const role of parsedData.roles) {
      // Find the corresponding company
      const company = results.companies.find(c => c.name === role.company_name);
      if (!company) {
        console.error('Company not found for role:', role.company_name);
        continue;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .insert({
          user_id: user.id,
          company_id: company.id,
          title: role.title,
          start_date: role.start_date,
          end_date: role.end_date,
          is_current: role.is_current
        })
        .select()
        .single();

      if (roleError) {
        console.error('Error creating role:', roleError);
        continue;
      }
      results.roles.push(roleData);
    }

    // Create experiences
    for (const experience of parsedData.experiences) {
      // Find the corresponding role
      const role = results.roles.find(r => r.title === experience.role_title);
      if (!role) {
        console.error('Role not found for experience:', experience.role_title);
        continue;
      }

      const { data: experienceData, error: experienceError } = await supabase
        .from('experiences')
        .insert({
          user_id: user.id,
          role_id: role.id,
          title: experience.title,
          situation: experience.situation,
          task: experience.task,
          action: experience.action,
          result: experience.result,
          tags: []
        })
        .select()
        .single();

      if (experienceError) {
        console.error('Error creating experience:', experienceError);
        continue;
      }
      results.experiences.push(experienceData);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully imported ${results.companies.length} companies, ${results.roles.length} roles, and ${results.experiences.length} experiences`,
      data: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in parse-resume function:', error);
    
    // Return appropriate error status and message
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse resume';
    const statusCode = errorMessage.includes('not yet supported') || 
                      errorMessage.includes('Unsupported file format') || 
                      errorMessage.includes('Could not extract') ||
                      errorMessage.includes('Failed to parse') ? 400 : 500;
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});