import { MatchedRequirement, ExperienceWithRole } from '../types/index.ts';
import { CONSTANTS } from '../constants.ts';

const STAGE2B_SYSTEM_CONTEXT = `You generate resume bullets from candidate experiences. Embed keywords naturally. Temperature is 0.15 for consistent quality with slight variation.`;

function formatExperiencesText(experiencesByRole: Record<string, ExperienceWithRole[]>): string {
  return Object.entries(experiencesByRole)
    .map(([roleKey, exps]) => {
      const firstExp = exps[0];
      const roleTitle = firstExp.roles.title;
      const companyName = firstExp.roles.companies.name;
      
      return `
=== ${roleKey} ===
Role: ${roleTitle}
Company: ${companyName}

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

export function buildStage2bPrompt(
  experiencesByRole: Record<string, ExperienceWithRole[]>,
  matchedRequirements: MatchedRequirement[],
  allKeywords: string[],
  keywordMatchType: 'exact' | 'flexible'
): string {
  const keywordInstruction = keywordMatchType === 'exact' 
    ? 'Use keywords EXACTLY as they appear in the list'
    : 'Use keywords or their natural variations (managed/led, developed/built, etc.)';

  const experiencesText = formatExperiencesText(experiencesByRole);

  return `You are generating resume bullets for a candidate who matched a job (score >= 80%).

MATCHED REQUIREMENTS (for context on what's relevant):
${JSON.stringify(matchedRequirements.map(m => m.jobRequirement), null, 2)}

CANDIDATE EXPERIENCES:
${experiencesText}

KEYWORDS TO EMBED:
${JSON.stringify(allKeywords, null, 2)}

---

BULLET GENERATION RULES:

1. Create EXACTLY ONE bullet for EVERY experience
2. Organize by "Company - Role" keys (e.g., "Cadre - Product Manager")
3. Order bullets within each role by relevance (most relevant first)
4. Structure: Result-focused with quantified impact when possible
5. Length: Target ${CONSTANTS.VISUAL_WIDTH_TARGET} characters (range: ${CONSTANTS.VISUAL_WIDTH_MIN}-${CONSTANTS.VISUAL_WIDTH_MAX})
6. Keywords: ${keywordInstruction}
7. Only embed keywords that naturally fit the experience content
8. Track which keywords were used and which couldn't fit

QUALITY STANDARDS:
- Start with strong action verbs
- Include metrics/numbers when available
- Focus on outcomes and business impact
- Make each bullet distinct (no repetitive phrasing)
- Ensure bullets flow naturally and are grammatically correct

The JSON schema enforces the exact structure. Each bullet must have: text, experienceId, keywordsUsed array, and relevanceScore (1-10).`;
}

export function getStage2bSystemMessage(): string {
  return STAGE2B_SYSTEM_CONTEXT;
}
