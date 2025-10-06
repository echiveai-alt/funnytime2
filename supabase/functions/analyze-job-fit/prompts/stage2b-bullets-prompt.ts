import { MatchedRequirement, ExperienceWithRole } from '../types/index.ts';
import { CONSTANTS } from '../constants.ts';

const STAGE2B_SYSTEM_CONTEXT = `You generate resume bullets using a hybrid structure: impact-first when metrics exist (Reduced costs by 15% by...), action-first when qualitative (Developed system that improved...). Always choose the structure that makes the accomplishment most compelling. Embed keywords naturally. Temperature is 0.15 for consistent quality with slight variation.`;

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

4. **BULLET STRUCTURE - HYBRID APPROACH (SMART FORMATTING):**
   
   Use the appropriate structure based on whether the experience has quantifiable results:
   
   **OPTION A: Impact-First (When there's a clear metric)**
   Use this when Result contains: percentages, dollar amounts, time savings, growth numbers
   
   Formula: [IMPACT with METRIC] + by/through + [ACTION] + [METHODS/TECH]
   
   Impact verbs: Increased, Reduced, Improved, Grew, Decreased, Generated, Saved, Achieved, Accelerated
   
   ✅ Examples:
   - "Reduced digital acquisition costs by 15% by analyzing attribution channels using Amplitude and optimizing poor-performing sources"
   - "Increased sales conversion by 10% by developing interactive investment memo that enhanced user understanding of financial metrics"
   - "Grew user acquisition by 70% by leading funnel optimization efforts and implementing cross-functional solutions"
   - "Saved $2M annually by negotiating vendor contracts and consolidating software licenses across departments"
   
   **OPTION B: Action-First (When there's NO clear metric)**
   Use this when Result is qualitative (improved quality, enhanced experience, established process)
   
   Formula: [ACTION verb] + [WHAT] + that/by + [QUALITATIVE IMPACT]
   
   Action verbs: Developed, Built, Created, Designed, Led, Established, Implemented, Launched
   
   ✅ Examples:
   - "Developed acquisition dashboards using Amplitude that improved data-driven decision-making and KPI awareness across leadership"
   - "Created experimentation playbook that simplified A/B test design and embedded insights into PRDs as part of development process"
   - "Designed scalable data infrastructure by collaborating with engineering to create single source of truth for user funnels"
   - "Established quarterly roadmap prioritization using modified RICE methodology, aligning stakeholders on execution"
   
   **DECISION CRITERIA:**
   
   Check the Result field for these patterns:
   - Has number + % → Use Impact-First (Option A)
   - Has $ amount → Use Impact-First (Option A)
   - Has "X% increase/decrease/improvement" → Use Impact-First (Option A)
   - Has time metric (saved 20 hours, reduced from 5 days to 2) → Use Impact-First (Option A)
   - Has growth numbers (2x, 10x, doubled) → Use Impact-First (Option A)
   
   If Result has NONE of the above:
   - Has qualitative improvement (improved, enhanced, streamlined) → Use Action-First (Option B)
   - Describes capability/process established → Use Action-First (Option B)
   
   **COMPARISON:**
   
   Same experience, two approaches:
   
   WITH METRIC (Result: "15% reduction in costs"):
   ✅ Impact-First: "Reduced costs by 15% by implementing automated workflow using Python"
   ❌ Action-First: "Implemented automated workflow using Python that reduced costs by 15%" ← WRONG, metric exists
   
   NO METRIC (Result: "Improved data quality"):
   ✅ Action-First: "Implemented data validation pipeline that improved data quality and reliability"
   ❌ Impact-First: "Improved data quality by implementing validation pipeline" ← Less compelling without metric

5. **CONTEXT MINING FROM SITUATION, TASK, ACTION:**
   - Review Situation, Task, and Action fields for additional context and keyword opportunities
   - Include contextual details (from S, T, A) ONLY when:
     ✓ It enables you to naturally use an unused keyword
     ✓ It adds necessary clarity to the accomplishment
     ✓ It doesn't make the bullet exceed ${CONSTANTS.VISUAL_WIDTH_MAX} characters
   
   Examples:
   - Good: "Reduced page load time by 40% by migrating legacy jQuery codebase to React" (context "legacy jQuery" enables keyword "React" naturally)
   - Bad: "Working in a fast-paced startup environment, reduced page load time by 40%" (context doesn't add value or keywords)

6. **LENGTH & FLOW:**
   - Target ${CONSTANTS.VISUAL_WIDTH_TARGET} characters (range: ${CONSTANTS.VISUAL_WIDTH_MIN}-${CONSTANTS.VISUAL_WIDTH_MAX})
   - Ensure natural readability - avoid awkward phrasing
   - Include context only if it adds value (scale, constraints, keywords)

7. **Keywords:** ${keywordInstruction}

8. Only embed keywords that naturally fit the experience content

9. Track which keywords were used and which couldn't fit

QUALITY STANDARDS:
- **Use hybrid structure intelligently:**
  - Impact-first (Reduced/Increased/Improved X by Y%) when Result has metrics
  - Action-first (Developed/Built/Created X that improved Y) when Result is qualitative
- **Quantify results whenever possible** (%, $, time, growth metrics)
- Choose structure that makes each accomplishment most compelling
- Embed keywords naturally in the action/technology portion
- Make each bullet distinct (no repetitive phrasing)
- Ensure bullets flow naturally and are grammatically correct
- Every bullet should clearly show value delivered

VERIFICATION CHECKLIST (verify before responding):
✓ Did I create exactly ${totalExperiences} bullets?
✓ Does each experience ID appear exactly once?
✓ Are bullets organized by "Company - Role" keys?
✓ Did I assign accurate relevanceScore (1-10) to each bullet?
✓ Did I prioritize quantitative results in my relevance scoring?
✓ **For each bullet with a metric - did I use impact-first structure?**
✓ **For each bullet without metrics - did I use action-first structure?**
✓ Does each bullet use the structure that makes it most compelling?
✓ Did I embed keywords naturally where they fit?

**STRUCTURE SELECTION EXAMPLES:**

Experience: "Result: Increased conversion by 10%"
→ Use Impact-First: "Increased conversion by 10% by developing interactive investment memo"

Experience: "Result: Improved data quality and accessibility"  
→ Use Action-First: "Designed data infrastructure that improved quality and accessibility"

Experience: "Result: Reduced load time by 60%"
→ Use Impact-First: "Reduced page load time by 60% by implementing Redis caching layer"

Experience: "Result: Simplified A/B testing process"
→ Use Action-First: "Created experimentation playbook that simplified A/B testing across teams"

Experience: "Result: Saved $500K annually"
→ Use Impact-First: "Saved $500K annually by renegotiating vendor contracts and consolidating licenses"

Experience: "Result: Established clear roadmap prioritization"
→ Use Action-First: "Established roadmap prioritization using RICE methodology, aligning stakeholders"

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