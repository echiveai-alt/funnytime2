export interface Company {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  user_id: string;
  company_id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface Experience {
  id: string;
  user_id: string;
  role_id: string;
  title: string | null;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface STARFormData {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  tags: string[];
}