import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedExperience {
  company: string;
  role: string;
  startDate: string | null;
  endDate: string | null;
  location?: string;
  bullets: Array<{
    bullet: string;
    title: string;
    situation: string | null;
    task: string | null;
    action: string | null;
    result: string | null;
  }>;
}

interface ResumeParseResult {
  success: boolean;
  data?: ParsedExperience[];
  error?: string;
}

// Date parsing regex
const dateRegex = /(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|Present|\d{4})/gi;
const dateRangeRegex = /(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|Present|\d{4})\s*[-–—to]+\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|Present|\d{4})/gi;

// Action verbs for detecting actions
const actionVerbs = [
  'led', 'built', 'analyzed', 'shipped', 'launched', 'partnered', 'implemented', 'created', 
  'defined', 'developed', 'managed', 'designed', 'executed', 'coordinated', 'established',
  'improved', 'optimized', 'streamlined', 'increased', 'decreased', 'reduced', 'grew',
  'saved', 'cut', 'accelerated', 'boosted', 'raised', 'lowered', 'achieved', 'delivered'
];

// Result indicators
const resultIndicators = [
  '%', '$', 'increased', 'decreased', 'reduced', 'grew', 'saved', 'cut', 'accelerated',
  'boosted', 'raised', 'lowered', 'weeks', 'months', 'days', 'faster', 'efficiency'
];

function parseText(text: string): ResumeParseResult {
  try {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const experiences: ParsedExperience[] = [];
    
    let currentExperience: Partial<ParsedExperience> | null = null;
    let bullets: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this looks like a company/role header
      const isHeader = detectExperienceHeader(line);
      
      if (isHeader) {
        // Save previous experience if exists
        if (currentExperience && bullets.length > 0) {
          currentExperience.bullets = processBullets(bullets);
          experiences.push(currentExperience as ParsedExperience);
        }
        
        // Parse new experience header
        const parsed = parseExperienceHeader(line);
        if (parsed.company && parsed.role) {
          currentExperience = parsed;
          bullets = [];
        }
      } else if (isBulletPoint(line)) {
        // Collect bullet points
        bullets.push(line);
      } else if (currentExperience && line.length > 20) {
        // Might be a continuation of previous bullet or description
        if (bullets.length > 0) {
          bullets[bullets.length - 1] += ' ' + line;
        }
      }
    }
    
    // Add final experience
    if (currentExperience && bullets.length > 0) {
      currentExperience.bullets = processBullets(bullets);
      experiences.push(currentExperience as ParsedExperience);
    }
    
    // Validate we found at least some meaningful data
    if (experiences.length === 0) {
      return {
        success: false,
        error: "Unable to parse. Please reformat your resume and resubmit."
      };
    }
    
    // Check if critical data is missing
    const hasValidExperiences = experiences.some(exp => 
      exp.company && exp.role && exp.startDate && exp.bullets.length > 0
    );
    
    if (!hasValidExperiences) {
      return {
        success: false,
        error: "Unable to parse. Please reformat your resume and resubmit."
      };
    }
    
    return {
      success: true,
      data: experiences
    };
  } catch (error) {
    console.error('Parse error:', error);
    return {
      success: false,
      error: "Unable to parse. Please reformat your resume and resubmit."
    };
  }
}

function detectExperienceHeader(line: string): boolean {
  // Look for patterns like:
  // "Software Engineer | Google | San Francisco | 2020-2023"
  // "Google — Software Engineer"
  // "Software Engineer at Google"
  
  const hasJobTitle = /\b(engineer|developer|manager|analyst|designer|director|specialist|coordinator|associate|intern|consultant|lead|senior|junior)\b/i.test(line);
  const hasSeparators = /[|—–\-]/.test(line) || /\bat\b/i.test(line);
  const hasDates = dateRegex.test(line);
  
  return (hasJobTitle && hasSeparators) || (hasJobTitle && hasDates);
}

function parseExperienceHeader(line: string): Partial<ParsedExperience> {
  const result: Partial<ParsedExperience> = {};
  
  // Extract date ranges first
  const dates = extractDates(line);
  result.startDate = dates.start;
  result.endDate = dates.end;
  
  // Remove dates from line for easier parsing
  const lineWithoutDates = line.replace(dateRangeRegex, '').replace(dateRegex, '').trim();
  
  // Try different parsing patterns
  if (lineWithoutDates.includes('|')) {
    const parts = lineWithoutDates.split('|').map(p => p.trim());
    if (parts.length >= 2) {
      result.role = parts[0];
      result.company = parts[1];
      if (parts.length >= 3) result.location = parts[2];
    }
  } else if (lineWithoutDates.includes('—') || lineWithoutDates.includes('–')) {
    const separator = lineWithoutDates.includes('—') ? '—' : '–';
    const parts = lineWithoutDates.split(separator).map(p => p.trim());
    if (parts.length >= 2) {
      result.company = parts[0];
      result.role = parts[1];
    }
  } else if (lineWithoutDates.toLowerCase().includes(' at ')) {
    const parts = lineWithoutDates.split(/\sat\s/i);
    if (parts.length >= 2) {
      result.role = parts[0].trim();
      result.company = parts[1].trim();
    }
  }
  
  return result;
}

function extractDates(text: string): { start: string | null; end: string | null } {
  const matches = text.match(dateRangeRegex);
  if (matches && matches.length > 0) {
    const range = matches[0];
    const parts = range.split(/[-–—to]+/i).map(p => p.trim());
    return {
      start: normalizeDate(parts[0]) || null,
      end: normalizeDate(parts[1]) || null
    };
  }
  
  // Try single date
  const singleMatch = text.match(dateRegex);
  if (singleMatch) {
    return {
      start: normalizeDate(singleMatch[0]) || null,
      end: null
    };
  }
  
  return { start: null, end: null };
}

function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  dateStr = dateStr.trim();
  if (dateStr.toLowerCase() === 'present') return null;
  
  // Try to parse various date formats
  if (/^\d{4}$/.test(dateStr)) {
    return `${dateStr}-01-01`;
  }
  
  const monthMap: { [key: string]: string } = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'aug': '08', 'sep': '09', 'sept': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  
  const match = dateStr.match(/^([a-z]+)\s+(\d{4})$/i);
  if (match) {
    const month = monthMap[match[1].toLowerCase().substring(0, 3)];
    if (month) {
      return `${match[2]}-${month}-01`;
    }
  }
  
  return null;
}

function isBulletPoint(line: string): boolean {
  return /^[•–—\-\*]\s/.test(line) || /^\s*[•–—\-\*]\s/.test(line);
}

function processBullets(bullets: string[]): Array<{
  bullet: string;
  title: string;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
}> {
  return bullets.map(bullet => {
    const cleanBullet = bullet.replace(/^[•–—\-\*]\s*/, '').trim();
    
    const star = decomposeSTAR(cleanBullet);
    const title = generateTitle(cleanBullet);
    
    return {
      bullet: cleanBullet,
      title,
      ...star
    };
  });
}

function decomposeSTAR(bullet: string): {
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
} {
  // Look for explicit result indicators
  let result: string | null = null;
  const resultPatterns = [
    /(?:resulting in|achieved|leading to|saved|increased|decreased|reduced|grew|boosted|improved by)\s+([^.,;]+)/i,
    /(\d+(?:\.\d+)?%[^.,;]*)/g,
    /(\$[\d,]+[^.,;]*)/g,
    /(\d+(?:\.\d+)?\s*(?:weeks?|months?|days?)[^.,;]*faster)/gi
  ];
  
  for (const pattern of resultPatterns) {
    const matches = bullet.match(pattern);
    if (matches) {
      result = matches[0];
      break;
    }
  }
  
  // Look for situation/task context
  let situation: string | null = null;
  const situationPatterns = [
    /(?:due to|because|needed to|goal was|in order to|to address|to solve)\s+([^.,;]+)/i,
    /(?:funnel drop-offs?|data inconsistency|performance issues?|customer complaints?)[^.,;]*/gi
  ];
  
  for (const pattern of situationPatterns) {
    const match = bullet.match(pattern);
    if (match) {
      situation = match[0];
      break;
    }
  }
  
  // Extract actions - look for action verbs
  let action: string | null = null;
  const actionPattern = new RegExp(`\\b(${actionVerbs.join('|')})\\b[^.,;]*`, 'i');
  const actionMatch = bullet.match(actionPattern);
  if (actionMatch) {
    // Extract until we hit 'by', 'through', 'including', 'and', or punctuation
    const actionText = actionMatch[0];
    const splitOn = actionText.split(/\s+(?:by|through|including|and)\s+/i);
    action = splitOn[0].trim();
  }
  
  return {
    situation,
    task: null, // Task is rarely explicit, set to null as per requirements
    action,
    result
  };
}

function generateTitle(bullet: string): string {
  // Extract the main objective/impact and key words
  const words = bullet.toLowerCase().split(/\s+/);
  
  // Look for impact words
  const impactWords = words.filter(word => 
    ['increased', 'improved', 'optimized', 'reduced', 'enhanced', 'streamlined', 
     'developed', 'built', 'created', 'implemented', 'launched', 'designed'].includes(word)
  );
  
  // Look for key domain words
  const domainWords = words.filter(word =>
    ['performance', 'efficiency', 'revenue', 'conversion', 'user', 'customer', 
     'system', 'process', 'data', 'analytics', 'platform', 'infrastructure'].includes(word)
  );
  
  const impactWord = impactWords[0] || 'enhanced';
  const keyWords = domainWords.slice(0, 2);
  
  if (keyWords.length === 0) {
    // Fallback: extract first noun-like words
    const nouns = words.filter(word => word.length > 3 && 
      !['the', 'and', 'for', 'with', 'that', 'this', 'from', 'were', 'have'].includes(word)
    ).slice(0, 2);
    keyWords.push(...nouns);
  }
  
  return `${impactWord} ${keyWords.join(' ')}`.trim();
}

async function parseFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    // PDF parsing would require pdf-parse or similar
    // For now, return error as we can't import it in edge functions
    throw new Error('PDF parsing not yet supported in edge functions');
  } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
    // DOCX parsing would require mammoth
    throw new Error('DOCX parsing not yet supported in edge functions');
  } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
    return await file.text();
  } else {
    throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT files.');
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let text = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return new Response(
          JSON.stringify({ success: false, error: 'No file provided' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      text = await parseFile(file);
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      text = body.text;
      
      if (!text) {
        return new Response(
          JSON.stringify({ success: false, error: 'No text provided' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid content type' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = parseText(text);
    
    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Parse resume error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to parse resume'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});