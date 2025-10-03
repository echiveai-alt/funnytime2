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
  
  // Count total experiences
  const totalExperiences = Object.values(experiencesByRole).reduce((sum, exps) => sum + exps.length, 0);

  return `You are generating resume bullets for a candidate who matched a job (score >= 80%).

MATCHED REQUIREMENTS (for context on what's relevant):
${JSON.stringify(matchedRequirements.map(m => m.jobRequirement), null, 2)}

CANDIDATE EXPERIENCES:
${experiencesText}

KEYWORDS TO EMBED:
${JSON.stringify(allKeywords, null, 2)}

TOTAL EXPERIENCES TO CONVERT: ${totalExperiences}

---

BULLET GENERATION RULES:

1. Create EXACTLY ONE bullet for EVERY experience (NON-NEGOTIABLE)
   - You must create ${totalExperiences} bullets total
   - Each experience ID must appear exactly once in your bulletPoints
   - Count your bullets before responding to ensure ${totalExperiences} bullets were created
   
2. Organize by "Company - Role" keys (e.g., "Cadre - Product Manager")

3. **RELEVANCE SCORING (1-10):**
   Give each bullet a relevanceScore based on how well it matches the job requirements:
   - **10**: Directly addresses multiple key job requirements with quantifiable impact
   - **8-9**: Strongly relevant to main job responsibilities with clear results
   - **6-7**: Moderately relevant, demonstrates transferable skills
   - **4-5**: Somewhat relevant, shows related experience
   - **1-3**: Tangentially relevant or general skills
   
   **Prioritize bullets that:**
   - Include quantitative results (%, $, time saved, growth metrics)
   - Match critical job requirements from the MATCHED REQUIREMENTS list
   - Show direct impact and outcomes
   - Use keywords from the job description

4. Structure: Result-focused with quantified impact when possible
   - Start with action verb
   - Include numbers, percentages, time periods, or metrics whenever possible
   - Show business impact and outcomes

5. Length: Target ${CONSTANTS.VISUAL_WIDTH_TARGET} characters (range: ${CONSTANTS.VISUAL_WIDTH_MIN}-${CONSTANTS.VISUAL_WIDTH_MAX})

6. Keywords: ${keywordInstruction}

7. Only embed keywords that naturally fit the experience content

8. Track which keywords were used and which couldn't fit

QUALITY STANDARDS:
- **Quantify results whenever possible** (numbers are compelling)
- Start with strong action verbs
- Focus on outcomes and business impact
- Make each bullet distinct (no repetitive phrasing)
- Ensure bullets flow naturally and are grammatically correct

VERIFICATION CHECKLIST (verify before responding):
✓ Did I create exactly ${totalExperiences} bullets?
✓ Does each experience ID appear exactly once?
✓ Are bullets organized by "Company - Role" keys?
✓ Did I assign accurate relevanceScore (1-10) to each bullet?
✓ Did I prioritize quantitative results in my relevance scoring?
✓ Did I embed keywords naturally where they fit?

REQUIRED JSON FORMAT:
{
  "bulletPoints": {
    "Company1 - Role1": [
      {
        "text": "Bullet point text here",
        "experienceId": "experience-uuid",
        "keywordsUsed": ["keyword1", "keyword2"],
        "relevanceScore": 9
      }
    ],
    "Company2 - Role2": [...]
  },
  "keywordsUsed": ["keyword1", "keyword2", "keyword3"],
  "keywordsNotUsed": ["keyword4", "keyword5"]
}

CRITICAL: Return valid JSON with these exact top-level keys: bulletPoints, keywordsUsed, keywordsNotUsed.`;
}

export function getStage2bSystemMessage(): string {
  return STAGE2B_SYSTEM_CONTEXT;
}