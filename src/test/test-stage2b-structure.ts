// Quick test to verify the prompt generates impact-first bullets
import { buildStage2bPrompt } from './supabase/functions/analyze-job-fit/prompts/stage2b-bullets-prompt.ts';

const testExperiences = {
  "TestCo - Engineer": [
    {
      id: "test-1",
      title: "Performance Optimization",
      situation: "Legacy system was slow",
      task: "Improve performance",
      action: "Implemented caching layer using Redis",
      result: "Reduced API response time by 60%",
      roles: {
        title: "Software Engineer",
        companies: { name: "TestCo" }
      }
    }
  ]
};

const testRequirements = [
  { jobRequirement: "Backend optimization experience", weight: "high" }
];

const testKeywords = ["Redis", "caching", "performance"];

const prompt = buildStage2bPrompt(
  testExperiences,
  testRequirements,
  testKeywords,
  'flexible'
);

console.log("=== GENERATED PROMPT ===");
console.log(prompt);
console.log("\n=== CHECK FOR IMPACT-FIRST STRUCTURE ===");
console.log("Prompt includes '✓' examples:", prompt.includes('✓'));
console.log("Prompt includes '✗' examples:", prompt.includes('✗'));
console.log("Prompt includes '[IMPACT] by [ACTION]':", prompt.includes('[IMPACT]'));