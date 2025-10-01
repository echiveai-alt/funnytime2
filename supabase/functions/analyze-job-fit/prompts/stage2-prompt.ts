import { Stage1Results, Education, RoleWithDuration, ExperienceWithRole } from '../types.ts';
import { formatEducationSummary } from '../matching/education-matcher.ts';
import { calculateTotalExperienceMonths, formatRoleDurations } from '../matching/experience-calculator.ts';
import { CONSTANTS } from '../constants.ts';

const STAGE2_SYSTEM_CONTEXT = `You are a strict resume analyzer. Match candidate experiences AND education against pre-extracted job requirements. Use structured matching: AI reasoning for education_field, date calculations for years_experience, role similarity for role_title, explicit evidence for skills. 

NOTE: education_degree requirements have been pre-processed and removed from your requirements list. 

ALWAYS provide both matchedRequirements and unmatchedRequirements arrays. For scores < 80%, ALWAYS provide recommendations.`;

function formatExperiencesText(experiencesByRole: Record<string, ExperienceWithRole[]>): string {
  return Object.entries(experiencesByRole)
    .map(([roleKey, exps]) => {
      // Extract role info from first experience
      const firstExp = exps[0];
      const roleTitle = firstExp.roles.title;
      const roleSpecialty = firstExp.roles.specialty;
      const companyName = firstExp.roles.companies.name;
      
      return `
=== ${roleKey} ===
Role: ${roleTitle}${roleSpecialty ? ` | Specialty: ${roleSpecialty}` : ''}
Company: ${companyName}
Number of experiences for this role: ${exps.length}

${exps.map((exp, i) => `
  Experience ${i + 1}:
  - ID: ${exp.id}
  - Title: ${exp.title}
  - Action: ${exp.action}
  - Result: ${exp.result}
  ${exp.situation ? `- Context: ${exp.situation}` : ''}
  ${exp.task ? `- Task: ${exp.task}` : ''}
`).join('')}`;
    }).join('\n');
}

export function buildStage2Prompt(
  stage1Results: Stage1Results,
  experiencesByRole: Record<string, ExperienceWithRole[]>,
  educationInfo: Education[],
  userRoles: RoleWithDuration[],
  keywordMatchType: 'exact' | 'flexible'
): string {
  const keywordInstruction = keywordMatchType === 'exact' 
    ? 'Use keywords EXACTLY as they appear in the provided keyword list'
    : 'Use keywords and their variations (different tenses, forms, related terms like "managed" for "led")';

  const totalMonths = calculateTotalExperienceMonths(userRoles);
  const totalYears = Math.floor(totalMonths / 12);
  
  const educationSummary = formatEducationSummary(educationInfo);
  const roleDurationsText = formatRoleDurations(userRoles);
  const experiencesText = formatExperiencesText(experiencesByRole);

  return `CANDIDATE PROFILE SUMMARY:

EDUCATION:
${educationSummary}

TOTAL PROFESSIONAL EXPERIENCE:
- Total Duration: ${totalYears} years (${totalMonths} months)

ROLE-SPECIFIC EXPERIENCE:
${roleDurationsText}

You are matching a candidate's experiences and education against job requirements that were already extracted from a job description.

JOB REQUIREMENTS (extracted in previous stage):
${JSON.stringify(stage1Results.jobRequirements, null, 2)}

KEYWORDS TO EMBED (extracted in previous stage):
${JSON.stringify(stage1Results.allKeywords, null, 2)}

CANDIDATE EXPERIENCES (GROUPED BY ROLE):
${experiencesText}

MATCHING RULES - STRUCTURED AND PRECISE:

1. EDUCATION FIELD MATCHING (if applicable):
   If job requires a specific field or field criteria (e.g., "Computer Science", "STEM", "Technical field"):
   
   - Use your knowledge to determine if candidate's field meets the criteria
   - Consider ALL of the candidate's education fields (they may have multiple degrees)
   - "Actuarial Science" for "STEM" requirement → likely MATCH
   - "Computer Science" for "Computer Science or related" → MATCH
   - "English Literature" for "STEM" → NO MATCH
   
   Be reasonable in your interpretation of related fields.
   
   NOTE: Degree LEVEL requirements (Bachelor's, Master's, etc.) have already been pre-processed and are NOT in your requirements list.

2. YEARS OF EXPERIENCE MATCHING:
   Two types of experience requirements:
   
   A) GENERAL EXPERIENCE (no specificRole):
      - Use Total Professional Experience duration
      - Example: Requires 5 years, candidate has ${totalYears} years → ${totalYears >= 5 ? 'MATCH' : 'NO MATCH'}
   
   B) ROLE-SPECIFIC EXPERIENCE (has specificRole):
      - Sum durations of RELATED roles based on BOTH title AND specialty
      - SPECIALTY IS CRITICAL - check the "Specialty:" field for each role above
      - Be flexible with role matching (e.g., "Product Analyst" can count toward "Product Management")
      - Examples of matching logic:
        * JD requires: "3 years in product management for B2B SaaS"
        * Candidate has: "Product Manager | Specialty: B2B SaaS" → STRONG MATCH (both title and specialty align)
        * Candidate has: "Product Analyst | Specialty: B2B SaaS" → MATCH (related title, specialty matches)
        * Candidate has: "Product Manager | Specialty: Consumer Apps" → PARTIAL MATCH (title matches, specialty different)
      - For growth/subscription product requirements, look for these terms in the Specialty field
      - Sum ALL related role durations and compare to requirement
   
   For matches, cite the specific role(s) with their specialty and combined duration.

3. ABSOLUTE REQUIREMENTS:
   - If ANY requirement has importance "absolute", it MUST be matched or the score is capped at 79%
   - Absolute requirements are non-negotiable (e.g., citizenship, security clearance, required certifications)
   - Provide clear explanation if absolute requirement not met

4. ROLE TITLE REQUIREMENTS:
   - Check if candidate has held a role with matching or similar title
   - Be flexible: "Software Engineer" matches "Software Developer"
   - "Product Analyst" is related to "Product Manager"
   - Cite the role title and company as evidence

5. TECHNICAL SKILLS:
   - Experience must explicitly mention the skill/tool/technology in situation, task, action, or result
   - "Wrote SQL queries" → matches "SQL" requirement
   - "Used Python for analysis" → matches "Python" requirement
   - "Analyzed data" → does NOT match "SQL" requirement (too generic)

6. SOFT SKILLS & CROSS-FUNCTIONAL WORK:
   - Must have explicit evidence of the skill/collaboration
   - For "cross-functional" requirements: LOOK CAREFULLY in ALL fields (situation, task, action, result)
   - BE GENEROUS: If experience mentions working with ANY other department/function, it counts as cross-functional
   - Examples of cross-functional evidence:
     * "Collaborated with engineering team to..."
     * "Partnered with UX designers..."
     * "Worked with marketing to launch..."
     * "Led stakeholders across product, engineering, and design..."
     * ANY mention of other departments: engineering, design, marketing, sales, data, legal, etc.
   - "Led team of 5" → matches "team leadership"
   - "Worked with team" alone → does NOT match "leadership" (no leadership evidence)

7. SCORING CALCULATION:
   - Score = (Number of Matched Requirements / Total Requirements) × 100
   - Round DOWN to nearest whole number
   - If missing ANY absolute requirements, cap score at 79% and provide absoluteGapExplanation
   - NO other score caps - calculate based purely on requirements matched
   - Be objective: if candidate matches 85% of requirements, score should be 85%
   - Do not artificially lower scores - use the strict matching criteria above to ensure accuracy

CRITICAL: YOU MUST POPULATE BOTH matchedRequirements AND unmatchedRequirements ARRAYS FOR ALL SCORES.

CRITICAL: YOU MUST ALWAYS PROVIDE recommendations.forCandidate array for scores < 80%.

Return JSON in this EXACT format:

FOR SCORES >= 80% (Fit candidates):
{
  "overallScore": 85,
  "isFit": true,
  "fitLevel": "Excellent",
  "matchedRequirements": [
    {
      "jobRequirement": "Computer Science or related field",
      "experienceEvidence": "Bachelor of Science in Computer Science",
      "experienceSource": "Education: B.Sc in Computer Science from University X"
    },
    {
      "jobRequirement": "5+ years of experience",
      "experienceEvidence": "Total ${totalYears} years of professional experience",
      "experienceSource": "All professional roles combined"
    },
    {
      "jobRequirement": "Experience with growth products",
      "experienceEvidence": "Product management experience in growth domain",
      "experienceSource": "Product Manager | Specialty: Growth at TechCorp"
    },
    {
      "jobRequirement": "3+ years in product management",
      "experienceEvidence": "5 years combined in product management roles",
      "experienceSource": "Product Manager | Specialty: B2B SaaS at TechCorp (2 years) + Product Analyst | Specialty: Enterprise Software at StartupCo (3 years)"
    }
  ],
  "unmatchedRequirements": [
    {
      "requirement": "Tableau certification",
      "importance": "medium"
    }
  ],
  "bulletPoints": {
    "Company - Role": [
      {
        "text": "Increased customer retention by 23% through SQL-driven analysis of 50K+ user behaviors",
        "experienceId": "exp_123",
        "keywordsUsed": ["SQL", "customer retention", "analysis"],
        "relevanceScore": 10
      }
    ]
  },
  "keywordsUsed": ["SQL", "customer retention"],
  "keywordsNotUsed": ["Tableau"]
}

FOR SCORES < 80% (Not fit candidates):
{
  "overallScore": 55,
  "isFit": false,
  "fitLevel": "Fair",
  "matchedRequirements": [
    {
      "jobRequirement": "STEM degree",
      "experienceEvidence": "Bachelor of Science in Actuarial Science",
      "experienceSource": "Education: B.Sc in Actuarial Science from University X"
    }
  ],
  "unmatchedRequirements": [
    {
      "requirement": "5+ years of experience",
      "importance": "critical"
    },
    {
      "requirement": "US citizenship",
      "importance": "absolute"
    }
  ],
  "matchableKeywords": [],
  "unmatchableKeywords": [],
  "absoluteGaps": ["US citizenship"],
  "criticalGaps": ["5+ years of experience"],
  "recommendations": {
    "forCandidate": [
      "Gain ${5 - totalYears} more years of professional experience",
      "Focus on roles that will build toward the required experience level",
      "Highlight your strong educational foundation in your applications"
    ]
  }
}

BULLET GENERATION RULES (ONLY IF SCORE >= 80%):
1. Create EXACTLY ONE bullet for EVERY experience
2. Create SEPARATE entries for EACH "Company - Role" combination
3. Order bullets by relevance (most relevant first)
4. Structure: "Result (with numbers) + Action verb + context" OR "Action verb + context + quantified result"
5. Target width: ${CONSTANTS.VISUAL_WIDTH_TARGET} chars (range: ${CONSTANTS.VISUAL_WIDTH_MIN}-${CONSTANTS.VISUAL_WIDTH_MAX})
6. ${keywordInstruction}
7. ONLY embed keywords if they naturally fit based on the experience content
8. Track which keywords were embedded and which couldn't fit`;
}

export function getStage2SystemMessage(): string {
  return STAGE2_SYSTEM_CONTEXT;
}
