// Job Description Analysis Utilities

export interface KeyPhrase {
  phrase: string;
  category: 'technical' | 'soft_skill' | 'industry' | 'tool' | 'general';
  importance: 'high' | 'medium' | 'low';
}

export interface RelevantExperience {
  id: string;
  roleTitle: string;
  companyName: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  tags: string[];
  relevanceScore: number;
  matchingPhrases: string[];
}

export interface JobAnalysisResult {
  extractedKeyPhrases: KeyPhrase[];
  matchedPhrases: {
    phrase: string;
    experienceContext: string;
    matchType: 'exact' | 'synonym' | 'related';
  }[];
  unmatchedPhrases: KeyPhrase[];
}

// Store extracted key phrases in localStorage
export const storeJobKeyPhrases = (keyPhrases: KeyPhrase[]) => {
  try {
    localStorage.setItem('jobKeyPhrases', JSON.stringify(keyPhrases));
  } catch (error) {
    console.error('Failed to store job key phrases:', error);
  }
};

// Retrieve stored key phrases from localStorage
export const getStoredJobKeyPhrases = (): KeyPhrase[] => {
  try {
    const stored = localStorage.getItem('jobKeyPhrases');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to retrieve job key phrases:', error);
    return [];
  }
};

// Clear stored key phrases
export const clearStoredJobKeyPhrases = () => {
  try {
    localStorage.removeItem('jobKeyPhrases');
  } catch (error) {
    console.error('Failed to clear job key phrases:', error);
  }
};

// Store job description text
export const storeJobDescription = (jobDescription: string) => {
  try {
    localStorage.setItem('currentJobDescription', jobDescription);
  } catch (error) {
    console.error('Failed to store job description:', error);
  }
};

// Get stored job description
export const getStoredJobDescription = (): string => {
  try {
    return localStorage.getItem('currentJobDescription') || '';
  } catch (error) {
    console.error('Failed to retrieve job description:', error);
    return '';
  }
};

// Store most relevant experiences per role
export const storeRelevantExperiences = (experiences: RelevantExperience[]) => {
  try {
    localStorage.setItem('relevantExperiences', JSON.stringify(experiences));
  } catch (error) {
    console.error('Failed to store relevant experiences:', error);
  }
};

// Retrieve stored relevant experiences
export const getStoredRelevantExperiences = (): RelevantExperience[] => {
  try {
    const stored = localStorage.getItem('relevantExperiences');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to retrieve relevant experiences:', error);
    return [];
  }
};

// Clear stored relevant experiences
export const clearStoredRelevantExperiences = () => {
  try {
    localStorage.removeItem('relevantExperiences');
  } catch (error) {
    console.error('Failed to clear relevant experiences:', error);
  }
};