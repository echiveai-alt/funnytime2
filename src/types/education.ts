export interface Education {
  id: string;
  user_id: string;
  degree: string;
  school: string;
  graduation_date: string | null;
  is_expected_graduation: boolean;
  created_at: string;
  updated_at: string;
}

export interface EducationFormData {
  degree: string;
  school: string;
  graduationMonth: string;
  graduationYear: string;
  isExpectedDate: boolean;
}