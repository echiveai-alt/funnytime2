-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create roles table
CREATE TABLE public.roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create experiences table
CREATE TABLE public.experiences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  situation TEXT,
  task TEXT,
  action TEXT,
  result TEXT,
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;

-- Create policies for companies
CREATE POLICY "Users can view their own companies" 
ON public.companies 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own companies" 
ON public.companies 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own companies" 
ON public.companies 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for roles
CREATE POLICY "Users can view their own roles" 
ON public.roles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own roles" 
ON public.roles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own roles" 
ON public.roles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own roles" 
ON public.roles 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for experiences
CREATE POLICY "Users can view their own experiences" 
ON public.experiences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own experiences" 
ON public.experiences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own experiences" 
ON public.experiences 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own experiences" 
ON public.experiences 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_experiences_updated_at
BEFORE UPDATE ON public.experiences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_companies_user_id ON public.companies(user_id);
CREATE INDEX idx_roles_user_id ON public.roles(user_id);
CREATE INDEX idx_roles_company_id ON public.roles(company_id);
CREATE INDEX idx_experiences_user_id ON public.experiences(user_id);
CREATE INDEX idx_experiences_role_id ON public.experiences(role_id);