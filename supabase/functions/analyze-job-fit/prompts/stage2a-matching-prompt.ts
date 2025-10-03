import { Stage1Results, Education, RoleWithDuration, ExperienceWithRole } from '../types/index.ts';
import { formatEducationSummary } from '../matching/education-matcher.ts';
import { calculateTotalExperienceMonths, formatRoleDurations } from '../matching/experience-calculator.ts';

const STAGE2A_SYSTEM_CONTEXT = `You match candidates against job requirements with precise evidence. For experience requirements, you MUST show detailed calculations with all role durations. Temperature is 0.0 for maximum consistency.`;

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

export function buildStage2aPrompt(
  stage1Results: Stage1Results,
  experiencesByRole: Record<string, ExperienceWithRole[]>,
  educationInfo: Education[],
  userRoles: RoleWithDuration[]
): string {
  const totalMonths = calculateTotalExperienceMonths(userRoles);
  const totalYears = Math.floor(totalMonths / 12);
  
  const educationSummary = formatEducationSummary(educationInfo);
  const roleDurationsText = formatRoleDurations(userRoles);
  const experiencesText = formatExperiencesText(experiencesByRole);

  return `You are matching a candidate against job requirements. Your output format is strictly enforced by JSON schema.

CANDIDATE DATA:

EDUCATION:
${educationSummary}

TOTAL EXPERIENCE: ${totalYears} years (${totalMonths} months)

ROLES WITH DURATIONS (USE THESE FOR CALCULATIONS):
${roleDurationsText}

EXPERIENCES BY ROLE:
${experiencesText}

JOB REQUIREMENTS TO MATCH:
${JSON.stringify(stage1Results.jobRequirements, null, 2)}

---

MATCHING INSTRUCTIONS:

1. EDUCATION MATCHING
   
   DEGREE LEVEL (Pre-checked by system using hierarchy: PhD > Master's > Bachelor's > Associate > Diploma > Other):
   - System automatically compares degree levels hierarchically
   - Higher degrees satisfy lower requirements (e.g., Master's meets Bachelor's requirement)
   - Lower degrees do NOT meet higher requirements (e.g., Bachelor's does NOT meet Master's requirement)
   - You will only see degree requirements if the system couldn't match them automatically
   
   EDUCATION FIELD (You check this):
   - Use your knowledge to verify if candidate's field of study meets the requirement
   - Related fields may qualify (e.g., "Computer Engineering" for "Computer Science")

2. YEARS OF EXPERIENCE (CRITICAL - SHOW ALL WORK)
   
   For requirements with "or related/similar/adjacent":
   - Find ALL functionally related roles using semantic understanding
   - "Product management or related" includes: Product Manager, Product Operations Manager, Product Analyst, Technical Product Manager, Associate Product Manager
   - "Consumer products" includes roles working on consumer-facing products regardless of exact title
   - Check specialty fields - matching keywords indicate relevance
   - Check experience descriptions - relevant work qualifies even if title differs slightly
   - Check for semantic matches: "Product Analyst" doing product work IS product-related experience
   - List EVERY qualifying role with company and months
   - Format: Role1 at Company1 (Xmo) + Role2 at Company2 (Ymo) + ... = Total ÷ 12 = Y years
   
   IMPORTANT: Be inclusive when matching "or related" roles. If a role has:
   - Related responsibilities in the experience text (e.g., product decisions, roadmap work)
   - Relevant specialty tags (e.g., "Consumer", "Product", "Growth")
   - Similar title keywords (Analyst working on products → product-related)
   Then it DOES qualify for "or related role" requirements.
   
   For specific roles without "or":
   - Same process, stricter matching - title must closely match
   
   For general experience:
   - Use total shown above

3. SPECIALTY MATCHING (APPLIES TO ALL REQUIREMENT TYPES)
   
   Check EVERY role's "Specialty:" field against ALL requirements.
   
   If requirement mentions: growth, subscription, B2B, B2C, SaaS, streaming, industries, domains, consumer products
   → Check if ANY role specialty contains matching terms
   → If yes, requirement is MET
   
   Examples:
   - Req: "subscription products" + Specialty: "SaaS, Subscription" = MATCH
   - Req: "growth experience" + Specialty: "Growth, Consumer" = MATCH
   - Req: "consumer focused products" + Specialty: "Consumer, Subscription" = MATCH

4. SKILLS & COLLABORATION
   - Technical: must appear in experience text
   - Soft skills: need clear evidence

5. SCORING
   - Weights: absolute/critical/high=1.0, medium=0.75, low=0.5
   - Score = (matched weight sum / total weight sum) × 100, round to nearest
   - Cap at 79% if missing absolute requirement

6. COMPLETENESS
   - Every requirement must appear in EITHER matchedRequirements OR unmatchedRequirements
   - Do not skip any requirements
   - If uncertain about a match, include it in unmatchedRequirements

OUTPUT REQUIREMENTS (ENFORCED BY SCHEMA):

For experienceSource field in matched experience requirements:
REQUIRED FORMAT: "Role1 at Company1 (12mo) + Role2 at Company2 (15mo) + Role3 at Company3 (8mo) + Role4 at Company4 (30mo) = 65mo ÷ 12 = 5.4yr → 5yr"

This calculation is MANDATORY for all experience requirements. The schema will reject responses without it.

For optional fields (return empty arrays/objects if not applicable):
- absoluteGaps: [] (empty if no absolute requirements are missing)
- criticalGaps: [] (empty if no critical requirements are missing)
- recommendations: { "forCandidate": [] } (empty array if score >= 80%)`;
}

export function getStage2aSystemMessage(): string {
  return STAGE2A_SYSTEM_CONTEXT;
}
