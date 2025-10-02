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
      const firstExp = exps[0];
      const roleTitle = firstExp.roles.title;
      const roleSpecialty = firstExp.roles.specialty;
      const companyName = firstExp.roles.companies.name;
      const startDate = firstExp.roles.start_date;
      const endDate = firstExp.roles.end_date;
      
      return `
=== ${roleKey} ===
Role: ${roleTitle}${roleSpecialty ? ` | Specialty: ${roleSpecialty}` : ''}
Company: ${companyName}
Duration: ${startDate} to ${endDate || 'Present'}
Number of experiences for this role: ${exps.length}

${exps.map((exp, i) => `
  Experience ${i + 1}:
  - ID: ${exp.id}
  - Title: ${exp.title}
  ${exp.situation ? `- Situation: ${exp.situation}` : ''}
  ${exp.task ? `- Task: ${exp.task}` : ''}
  - Action: ${exp.action}
  - Result: ${exp.result}
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

ROLE-SPECIFIC EXPERIENCE (WITH DURATIONS):
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
   If job requires a specific field or field criteria:
   - Use your knowledge to determine if candidate's field meets the criteria
   - Consider ALL of the candidate's education fields (they may have multiple degrees)
   - Be reasonable in your interpretation of related fields
   
   NOTE: Degree LEVEL requirements have been pre-processed and are NOT in your requirements list.

2. YEARS OF EXPERIENCE MATCHING:
   Two types of experience requirements:
   
   A) GENERAL EXPERIENCE (no specificRole):
      - Use Total Professional Experience duration shown above
      - Compare directly to requirement
   
   B) ROLE-SPECIFIC EXPERIENCE (has specificRole):
      CALCULATION METHOD:
      1. Identify all roles with related titles or relevant specialties
      2. Extract the month duration for each role from "Role-Specific Experience" section above
      3. Sum all months together
      4. Divide by 12 to get years as decimal
      5. Round to NEAREST whole number (0.5 rounds up)
      
      ROLE IDENTIFICATION:
      - Title matching strategies (use ALL that apply):
        * Exact or similar titles (e.g., "Software Engineer" ≈ "Software Developer")
        * Titles sharing key terms (e.g., "Product Manager" and "Product Analyst" both contain "Product")
        * Titles in the same functional area even with different words (e.g., "Data Scientist" and "Analytics Engineer")
      
      - Specialty field matching:
        * The "Specialty:" field describes the domain, industry, product type, or focus area of that role
        * Match specialty to ANY relevant terms in the requirement
        * Examples across different fields:
          - Engineering: "chemical engineering" specialty matches "chemical engineering" requirement
          - Music: "classical music" specialty matches "classical" or "orchestral" requirements  
          - Product: "B2B SaaS" specialty matches "enterprise software" or "B2B" requirements
          - Industry: "FinTech" specialty matches "financial services" or "fintech" requirements
        * Be flexible with terminology (e.g., "B2C" = "Consumer", "EdTech" = "Education Technology")
      
      - Combined matching:
        * A role is relevant if EITHER the title OR the specialty matches
        * Strongest matches have BOTH title and specialty alignment
      
      EVIDENCE FORMAT:
      - Show your calculation clearly
      - List each role with its month contribution
      - Show the sum, decimal years, and rounded result

3. ABSOLUTE REQUIREMENTS:
   - If ANY requirement has importance "absolute", it MUST be matched or score is capped at 79%
   - Absolute requirements are non-negotiable
   - Provide clear explanation if absolute requirement not met

4. ROLE TITLE AND SPECIALTY REQUIREMENTS:
   - Check if candidate has held roles with matching or similar titles
   - Use the same title matching strategies from section 2
   
   - For requirements mentioning domains, industries, or specialty areas:
     * Check the "Specialty:" field in each role section
     * Match keywords between requirement and specialty
     * Cite the specialty terms as evidence

5. TECHNICAL SKILLS:
   - Experience must explicitly mention the skill/tool/technology
   - Check all experience fields: situation, task, action, result

6. SOFT SKILLS & CROSS-FUNCTIONAL WORK:
   - Must have explicit evidence of the skill/collaboration
   - Check all experience fields for evidence
   - For "cross-functional" requirements, look for mentions of working with other departments/teams

7. SCORING CALCULATION:
   - Score = (Matched Requirements / Total Requirements) × 100
   - Round to NEAREST whole number (0.5 rounds up)
   - If missing absolute requirements, cap at 79%
   - Otherwise, use calculated score without artificial caps
   - Be objective: match requirements based on evidence

CRITICAL: Populate BOTH matchedRequirements AND unmatchedRequirements arrays for ALL scores.

CRITICAL: Always provide recommendations.forCandidate array for scores < 80%.

Return JSON in this EXACT format:

FOR SCORES >= 80% (Fit candidates):
{
  "overallScore": 85,
  "isFit": true,
  "fitLevel": "Excellent",
  "matchedRequirements": [
    {
      "jobRequirement": "[requirement text]",
      "experienceEvidence": "[what evidence shows]",
      "experienceSource": "[where evidence is from]"
    }
  ],
  "unmatchedRequirements": [
    {
      "requirement": "[requirement text]",
      "importance": "[importance level]"
    }
  ],
  "bulletPoints": {
    "Company - Role": [
      {
        "text": "[bullet text]",
        "experienceId": "[id]",
        "keywordsUsed": ["keyword1", "keyword2"],
        "relevanceScore": 10
      }
    ]
  },
  "keywordsUsed": ["keyword1"],
  "keywordsNotUsed": ["keyword2"]
}

FOR SCORES < 80% (Not fit candidates):
{
  "overallScore": 55,
  "isFit": false,
  "fitLevel": "Fair",
  "matchedRequirements": [...],
  "unmatchedRequirements": [...],
  "matchableKeywords": [],
  "unmatchableKeywords": [],
  "absoluteGaps": ["[if any]"],
  "criticalGaps": ["[if any]"],
  "recommendations": {
    "forCandidate": [
      "[specific recommendation 1]",
      "[specific recommendation 2]",
      "[specific recommendation 3]"
    ]
  }
}

BULLET GENERATION RULES (ONLY IF SCORE >= 80%):
1. Create EXACTLY ONE bullet for EVERY experience
2. Create SEPARATE entries for EACH "Company - Role" combination
3. Order bullets by relevance (most relevant first)
4. Structure: Result-focused with quantified impact
5. Target width: ${CONSTANTS.VISUAL_WIDTH_TARGET} chars (range: ${CONSTANTS.VISUAL_WIDTH_MIN}-${CONSTANTS.VISUAL_WIDTH_MAX})
6. ${keywordInstruction}
7. ONLY embed keywords if they naturally fit based on experience content
8. Track which keywords were embedded and which couldn't fit`;
}

export function getStage2SystemMessage(): string {
  return STAGE2_SYSTEM_CONTEXT;
}
