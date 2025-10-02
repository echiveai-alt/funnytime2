import { Stage1Results, Education, RoleWithDuration, ExperienceWithRole } from '../types.ts';
import { formatEducationSummary } from '../matching/education-matcher.ts';
import { calculateTotalExperienceMonths, formatRoleDurations } from '../matching/experience-calculator.ts';
import { CONSTANTS } from '../constants.ts';

const STAGE2_SYSTEM_CONTEXT = `You match candidates against job requirements using clear evidence. Show your work for experience calculations. Check specialty fields for all requirements.`;

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

  return `CANDIDATE DATA:

EDUCATION:
${educationSummary}

TOTAL EXPERIENCE: ${totalYears} years (${totalMonths} months)

ROLES WITH DURATIONS:
${roleDurationsText}

EXPERIENCES BY ROLE:
${experiencesText}

JOB REQUIREMENTS:
${JSON.stringify(stage1Results.jobRequirements, null, 2)}

KEYWORDS TO USE IN BULLETS (if candidate qualifies):
${JSON.stringify(stage1Results.allKeywords, null, 2)}

---

MATCHING RULES:

1. EDUCATION FIELD
   If requirement needs specific field: use your knowledge to check if candidate's field qualifies.
   Note: Degree LEVEL already checked - not in your requirement list.

2. YEARS OF EXPERIENCE
   
   For requirements with "or related/similar/adjacent":
   - Identify the main term (e.g., "product management" from "product management or related")
   - Find ALL roles that are functionally related (use semantic understanding)
   - Check specialty fields - if specialty contains relevant keywords, role likely qualifies
   - Sum months of qualifying roles → divide by 12 → round to nearest whole number
   - Show calculation: Role1(Xmo) + Role2(Ymo) = Total ÷ 12 = Y years
   
   For specific role requirements without "or":
   - Same process but be stricter about functional similarity
   
   For general experience:
   - Use total experience shown above

3. SPECIALTY MATCHING (CRITICAL - APPLIES TO ALL REQUIREMENTS)
   
   The "Specialty:" field shows product types, industries, domains for each role.
   
   For ANY requirement mentioning: growth, subscription, B2B, B2C, SaaS, streaming, specific industries, etc.
   → Check EVERY role's specialty field
   → If specialty contains matching keywords, requirement is MET
   
   Examples:
   - Requirement: "subscription products" → Specialty: "SaaS, Subscription" → MATCH
   - Requirement: "growth experience" → Specialty: "Growth, B2C" → MATCH
   - Requirement: "B2B software" → Specialty: "B2B, Enterprise, SaaS" → MATCH

4. SKILLS & COLLABORATION
   Technical skills: must appear explicitly in experience text
   Soft skills / cross-functional: must have clear evidence in experience text

5. SCORING
   Weights: absolute/critical/high = 1.0, medium = 0.75, low = 0.5
   Score = (sum of matched weights / sum of all weights) × 100, round to nearest
   If missing absolute requirement: cap at 79%

---

OUTPUT REQUIREMENTS:

CRITICAL: For experience requirements, ALWAYS show your calculation in experienceSource.
CRITICAL: Check specialty fields for ALL requirements, not just role-based ones.
CRITICAL: Include both matchedRequirements and unmatchedRequirements arrays.

Return JSON:

{
  "overallScore": 67,
  "isFit": false,
  "fitLevel": "Fair",
  "matchedRequirements": [
    {
      "jobRequirement": "3 years in product management or related",
      "experienceEvidence": "Description of why it matches",
      "experienceSource": "Role1 at Company1 (12mo) + Role2 at Company2 (15mo) + Role3 at Company3 (8mo) + Role4 at Company4 (30mo) = 65mo ÷ 12 = 5.4yr → 5yr"
    },
    {
      "jobRequirement": "Experience with growth products",
      "experienceEvidence": "Product Analyst role at Codecademy focused on growth",
      "experienceSource": "Product Analyst specialty: 'B2C, Growth, SaaS, Subscription'"
    }
  ],
  "unmatchedRequirements": [
    {
      "requirement": "requirement text",
      "importance": "medium"
    }
  ],
  "recommendations": {
    "forCandidate": ["recommendation 1", "recommendation 2"]
  }
}

If score >= 80%, also generate bulletPoints using:
- Create ONE bullet per experience
- Target ${CONSTANTS.VISUAL_WIDTH_TARGET} chars (range: ${CONSTANTS.VISUAL_WIDTH_MIN}-${CONSTANTS.VISUAL_WIDTH_MAX})
- ${keywordInstruction}
- Only use keywords that naturally fit`;
}

export function getStage2SystemMessage(): string {
  return STAGE2_SYSTEM_CONTEXT;
}
