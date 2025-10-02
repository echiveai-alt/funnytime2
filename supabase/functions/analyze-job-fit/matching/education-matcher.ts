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

  // Get user's highest degree
  const highestDegree = userEducation.reduce((highest, edu) => {
    const currentLevel = getDegreeLevel(edu.degree);
    const highestLevel = getDegreeLevel(highest.degree);
    return currentLevel > highestLevel ? edu : highest;
  }, userEducation[0]);

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

  // Find highest degree
  const highestDegree = educationInfo.reduce((highest, edu) => {
    const currentLevel = getDegreeLevel(edu.degree);
    const highestLevel = getDegreeLevel(highest.degree);
    return currentLevel > highestLevel ? edu : highest;
  }, educationInfo[0]);

  const summary = educationInfo.map(edu => 
    `- ${edu.degree}${edu.field ? ` in ${edu.field}` : ''} from ${edu.school}`
  ).join('\n');

  return `Highest Degree: ${highestDegree.degree}${highestDegree.field ? ` in ${highestDegree.field}` : ''}

All Education:
${summary}`;
}
