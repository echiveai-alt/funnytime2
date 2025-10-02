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

0. "OR" REQUIREMENTS - PROCESS THESE FIRST BEFORE OTHER RULES:
   
   DETECTION:
   If a requirement contains: "or related", "or similar", "or adjacent", "or equivalent", "or comparable"
   → This is an OR requirement - candidate needs to meet EITHER option, not both
   
   MATCHING PROCESS FOR OR REQUIREMENTS:
   Step 1: Identify the primary term (words before "or")
   Step 2: Look at ALL candidate roles in the "Role-Specific Experience" section
   Step 3: Use your semantic understanding to identify which roles are related to the primary term
   Step 4: For qualifying roles, extract their month duration
   Step 5: Sum ALL qualifying role durations in months
   Step 6: Divide by 12 and round to nearest whole number
   Step 7: Compare to required years
   
   ROLE MATCHING FOR OR REQUIREMENTS:
   - Use your knowledge of professional functions and career paths
   - Consider roles that perform similar work even with different titles
   - The phrase "or related" signals flexible matching - be generous but logical
   
   REQUIRED OUTPUT FORMAT FOR MATCHED OR REQUIREMENTS:
   You MUST include in experienceEvidence and experienceSource:
   - List EACH qualifying role with its duration in months
   - Show the calculation: Role1 (Xmo) + Role2 (Ymo) + ... = Total months ÷ 12 = Z years
   - Explain why roles qualify based on functional similarity
   
   Example format:
   experienceEvidence: "5 years across related roles: [Role A] (12mo), [Role B] (15mo), [Role C] (8mo), [Role D] (30mo). All roles perform similar functions within the same professional domain."
   
   experienceSource: "[Role A] at [Company] (12mo) + [Role B] at [Company] (15mo) + [Role C] at [Company] (8mo) + [Role D] at [Company] (30mo) = 65 months ÷ 12 = 5.4 years → 5 years"
   
   THEN proceed with the remaining rules below:

1. EDUCATION FIELD MATCHING (if applicable):
   If job requires a specific field or field criteria:
   - Use your knowledge to determine if candidate's field meets the criteria
   - Consider ALL of the candidate's education fields (they may have multiple degrees)
   - Be reasonable in your interpretation of related fields
   
   NOTE: Degree LEVEL requirements have been pre-processed and are NOT in your requirements list.

2. YEARS OF EXPERIENCE MATCHING (for non-OR requirements):
   Two types of experience requirements:
   
   A) GENERAL EXPERIENCE (no specificRole):
      - Use Total Professional Experience duration shown above
      - Compare directly to requirement
   
   B) ROLE-SPECIFIC EXPERIENCE (has specificRole, but no "or" in the phrase):
      CALCULATION METHOD:
      1. Identify all roles with related titles or relevant specialties
      2. Extract the month duration for each role from "Role-Specific Experience" section above
      3. Sum all months together
      4. Divide by 12 to get years as decimal
      5. Round to NEAREST whole number (0.5 rounds up)
      
      ROLE IDENTIFICATION:
      Use your semantic understanding of job functions to determine if roles are related.
      
      A role is relevant to a requirement if ANY of these apply:
      
      1. FUNCTIONAL SIMILARITY:
         * Use your knowledge of professional roles to identify functional groupings
         * Roles can have different titles but serve similar functions
         * Consider: What is the primary professional activity of this role?
      
      2. CAREER PROGRESSION:
         * Junior/Associate, Mid-level, Senior, Lead, Principal variants of similar roles
         * Related roles at different seniority levels within the same function
      
      3. ADJACENT ROLES:
         * Roles that commonly work together or are part of the same discipline
         * Roles that typically transition between each other in career paths
      
      SPECIALTY FIELD MATCHING:
      - The "Specialty:" field describes the domain, industry, product type, or focus area
      - Match specialty to ANY relevant terms in the requirement
      - Be flexible with terminology and synonyms
      
      IMPORTANT PRINCIPLE:
      - Different companies use different titles for similar roles
      - Focus on what the person actually DID (the function) rather than exact title matching
      - Use the specialty, duration, and experience content to understand the role's true function
      
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
   - Use the same flexible matching approach from section 2
   
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

7. SCORING CALCULATION (WEIGHTED):
   This uses a weighted scoring system where different importance levels contribute different amounts:
   
   WEIGHTS:
   - absolute/critical/high: 1.0 (full weight - required qualifications)
   - medium: 0.75 (preferred qualifications)
   - low: 0.5 (nice-to-have qualifications)
   
   CALCULATION:
   1. For each MATCHED requirement, add its weight to the numerator
   2. For ALL requirements (matched + unmatched), add their weights to the denominator
   3. Weighted Score = (Sum of matched weights / Sum of all weights) × 100
   4. Round to NEAREST whole number (0.5 rounds up)
   
   SPECIAL RULES:
   - If missing ANY absolute requirements, cap final score at 79%
   - Otherwise, use calculated weighted score
   
   EXAMPLE:
   - 3 critical matched (3 × 1.0 = 3.0)
   - 1 critical missed (adds 1.0 to denominator only)
   - 2 medium matched (2 × 0.75 = 1.5)
   - 1 low matched (1 × 0.5 = 0.5)
   - Score: 5.0 / 6.75 = 74%
   
   This means meeting preferred (medium/low) requirements improves your score even if you have some required gaps.

CRITICAL: Populate BOTH matchedRequirements AND unmatchedRequirements arrays for ALL scores.

CRITICAL: Always provide recommendations.forCandidate array for scores < 80%.

CRITICAL: For ALL OR requirements (containing "or related/similar/adjacent"), you MUST show the detailed calculation in both experienceEvidence and experienceSource fields as specified in Rule 0.

Return JSON in this EXACT format:

FOR SCORES >= 80% (Fit candidates):
{
  "overallScore": 85,
  "isFit": true,
  "fitLevel": "Excellent",
  "matchedRequirements": [
    {
      "jobRequirement": "[requirement text]",
      "experienceEvidence": "FOR OR REQUIREMENTS: Show detailed calculation with all qualifying roles and months. FOR OTHERS: [what evidence shows]",
      "experienceSource": "[where evidence is from - for OR requirements include full calculation]"
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
