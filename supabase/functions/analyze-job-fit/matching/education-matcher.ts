import { Education, DegreeLevel, EducationCheckResult, JobRequirement } from '../types/index.ts';
import { DEGREE_HIERARCHY } from '../constants.ts';

export function getDegreeLevel(degree: string): number {
  return DEGREE_HIERARCHY[degree as DegreeLevel] ?? 0;
}

export function meetsEducationRequirement(
  userEducation: Education[],
  requiredDegreeLevel: string
): EducationCheckResult {
  if (userEducation.length === 0) {
    return { meets: false, evidence: "", source: "" };
  }

  // Filter out education entries with NULL degrees
  const educationWithDegrees = userEducation.filter(edu => edu.degree !== null && edu.degree !== undefined && edu.degree !== '');
  
  // If no education has a degree level specified, be lenient and check if they have education at all
  if (educationWithDegrees.length === 0) {
    // They have education records but no degree level specified
    // Be lenient - assume they meet the requirement if they have education from a school
    const firstEducation = userEducation[0];
    return {
      meets: true,
      evidence: `Education from ${firstEducation.school}${firstEducation.field ? ` (${firstEducation.field})` : ''}`,
      source: `Education: ${firstEducation.school}${firstEducation.field ? ` - ${firstEducation.field}` : ''}`
    };
  }

  // Get user's highest degree from entries that have degree levels
  const highestDegree = educationWithDegrees.reduce((highest, edu) => {
    const currentLevel = getDegreeLevel(edu.degree);
    const highestLevel = getDegreeLevel(highest.degree);
    return currentLevel > highestLevel ? edu : highest;
  }, educationWithDegrees[0]);

  const userLevel = getDegreeLevel(highestDegree.degree);
  const requiredLevel = getDegreeLevel(requiredDegreeLevel);

  const meets = userLevel >= requiredLevel;

  return {
    meets,
    evidence: `${highestDegree.degree}${highestDegree.field ? ` in ${highestDegree.field}` : ''}`,
    source: `Education: ${highestDegree.degree}${highestDegree.field ? ` in ${highestDegree.field}` : ''} from ${highestDegree.school}`
  };
}

export function getLowestDegreeRequirement(jobRequirements: JobRequirement[]): string | null {
  const degreeReqs = jobRequirements
    .filter(req => req.category === 'education_degree')
    .map(req => req.minimumDegreeLevel)
    .filter(Boolean) as string[];

  if (degreeReqs.length === 0) return null;

  // Return the degree with lowest numeric value (most lenient requirement)
  return degreeReqs.reduce((lowest, current) => {
    return getDegreeLevel(current) < getDegreeLevel(lowest) ? current : lowest;
  });
}

export function formatEducationSummary(educationInfo: Education[]): string {
  if (educationInfo.length === 0) {
    return "No formal education provided";
  }

  // Filter education with degree levels
  const educationWithDegrees = educationInfo.filter(edu => edu.degree !== null && edu.degree !== undefined && edu.degree !== '');

  // If no degrees specified, just show the education
  if (educationWithDegrees.length === 0) {
    const summary = educationInfo.map(edu => 
      `- ${edu.school}${edu.field ? ` (${edu.field})` : ''}`
    ).join('\n');

    return `Education provided (degree level not specified):

${summary}`;
  }

  // Find highest degree
  const highestDegree = educationWithDegrees.reduce((highest, edu) => {
    const currentLevel = getDegreeLevel(edu.degree);
    const highestLevel = getDegreeLevel(highest.degree);
    return currentLevel > highestLevel ? edu : highest;
  }, educationWithDegrees[0]);

  const summary = educationInfo.map(edu => {
    const degreeInfo = edu.degree ? edu.degree : 'Education';
    return `- ${degreeInfo}${edu.field ? ` in ${edu.field}` : ''} from ${edu.school}`;
  }).join('\n');

  return `Highest Degree: ${highestDegree.degree}${highestDegree.field ? ` in ${highestDegree.field}` : ''}

All Education:
${summary}`;
}
