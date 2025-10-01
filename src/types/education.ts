export interface Education {
  id: string;
  user_id: string;
  degree: string | null;
  field: string | null;
  school: string;
  graduation_date: string | null;
  is_expected_graduation: boolean;
  created_at: string;
  updated_at: string;
}

export interface EducationFormData {
  degree: string;
  field: string;
  school: string;
  graduationMonth: string;
  graduationYear: string;
  isExpectedDate: boolean;
}