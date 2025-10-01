import { Role, RoleWithDuration } from '../types.ts';

export function calculateRoleDuration(startDate: string, endDate: string | null): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  
  const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                 (end.getMonth() - start.getMonth());
  
  return Math.max(0, months);
}

export function calculateTotalExperienceMonths(roles: Role[]): number {
  return roles.reduce((total, role) => {
    return total + calculateRoleDuration(role.start_date!, role.end_date);
  }, 0);
}

export function enrichRolesWithDuration(roles: Role[], companyName: string): RoleWithDuration[] {
  return roles.map(role => ({
    ...role,
    company: companyName,
    durationMonths: calculateRoleDuration(role.start_date!, role.end_date),
    durationYears: Math.floor(calculateRoleDuration(role.start_date!, role.end_date) / 12)
  }));
}

export function formatRoleDurations(roles: RoleWithDuration[]): string {
  return roles.map(rd => 
    `- ${rd.title}${rd.specialty ? ` (${rd.specialty})` : ''} at ${rd.company}: ${rd.durationYears} years (${rd.durationMonths} months)`
  ).join('\n');
}
