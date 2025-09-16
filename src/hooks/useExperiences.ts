import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Company, Role, Experience, STARFormData } from "@/types/experience";
import { useToast } from "@/hooks/use-toast";

export const useExperiences = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null);
  const { toast } = useToast();

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Update roles when company changes
  useEffect(() => {
    if (selectedCompany) {
      const companyRoles = roles.filter(role => role.company_id === selectedCompany.id);
      const currentRole = companyRoles.find(role => role.is_current) || companyRoles[0];
      setSelectedRole(currentRole || null);
    } else {
      setSelectedRole(null);
    }
  }, [selectedCompany, roles]);

  // Update experiences when role changes
  useEffect(() => {
    if (selectedRole) {
      loadExperiences(selectedRole.id);
    } else {
      setExperiences([]);
      setSelectedExperience(null);
    }
  }, [selectedRole]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("*")
        .order("is_current", { ascending: false })
        .order("end_date", { ascending: false, nullsFirst: true });

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      // Load roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("roles")
        .select("*")
        .order("is_current", { ascending: false })
        .order("end_date", { ascending: false, nullsFirst: true });

      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // Set initial selections
      if (companiesData && companiesData.length > 0) {
        const currentCompany = companiesData.find(c => c.is_current) || companiesData[0];
        setSelectedCompany(currentCompany);
      }

    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error loading data",
        description: "Failed to load your experiences. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadExperiences = async (roleId: string) => {
    try {
      const { data, error } = await supabase
        .from("experiences")
        .select("*")
        .eq("role_id", roleId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExperiences(data || []);
      
      // Clear selected experience if it's not in the current role
      if (selectedExperience && !data?.find(exp => exp.id === selectedExperience.id)) {
        setSelectedExperience(null);
      }
    } catch (error) {
      console.error("Error loading experiences:", error);
      toast({
        title: "Error loading experiences",
        description: "Failed to load experiences for this role.",
        variant: "destructive",
      });
    }
  };

  const createCompany = async (companyData: Omit<Company, "id" | "user_id" | "created_at" | "updated_at">, roleTitle: string = "New Role") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({ ...companyData, user_id: user.id })
        .select()
        .single();

      if (companyError) throw companyError;

      // Create initial role
      const { data: role, error: roleError } = await supabase
        .from("roles")
        .insert({
          user_id: user.id,
          company_id: company.id,
          title: roleTitle,
          start_date: companyData.start_date,
          end_date: companyData.end_date,
          is_current: companyData.is_current,
        })
        .select()
        .single();

      if (roleError) throw roleError;

      // Update state
      setCompanies(prev => [...prev, company]);
      setRoles(prev => [...prev, role]);
      setSelectedCompany(company);

      toast({
        title: "Company added",
        description: "Company has been added successfully.",
      });

      return company;
    } catch (error) {
      console.error("Error creating company:", error);
      toast({
        title: "Error creating company",
        description: "Failed to create company. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const createRole = async (roleData: Omit<Role, "id" | "user_id" | "created_at" | "updated_at">) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: role, error } = await supabase
        .from("roles")
        .insert({ ...roleData, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      setRoles(prev => [...prev, role]);
      setSelectedRole(role);

      toast({
        title: "Role added",
        description: "Role has been added successfully.",
      });

      return role;
    } catch (error) {
      console.error("Error creating role:", error);
      toast({
        title: "Error creating role",
        description: "Failed to create role. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const createExperience = async (): Promise<Experience> => {
    try {
      if (!selectedRole) throw new Error("No role selected");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: experience, error } = await supabase
        .from("experiences")
        .insert({
          user_id: user.id,
          role_id: selectedRole.id,
          title: "",
          situation: "",
          task: "",
          action: "",
          result: "",
          keywords: [],
        })
        .select()
        .single();

      if (error) throw error;

      setExperiences(prev => [experience, ...prev]);
      setSelectedExperience(experience);

      return experience;
    } catch (error) {
      console.error("Error creating experience:", error);
      toast({
        title: "Error creating experience",
        description: "Failed to create experience. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateExperience = async (experienceId: string, data: STARFormData) => {
    try {
      const { data: experience, error } = await supabase
        .from("experiences")
        .update(data)
        .eq("id", experienceId)
        .select()
        .single();

      if (error) throw error;

      setExperiences(prev => 
        prev.map(exp => exp.id === experienceId ? experience : exp)
      );
      
      if (selectedExperience?.id === experienceId) {
        setSelectedExperience(experience);
      }

      return experience;
    } catch (error) {
      console.error("Error updating experience:", error);
      throw error;
    }
  };

  const duplicateExperience = async (experience: Experience) => {
    try {
      if (!selectedRole) throw new Error("No role selected");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: newExperience, error } = await supabase
        .from("experiences")
        .insert({
          user_id: user.id,
          role_id: selectedRole.id,
          title: `${experience.title} (Copy)`,
          situation: experience.situation,
          task: experience.task,
          action: experience.action,
          result: experience.result,
          keywords: experience.keywords,
        })
        .select()
        .single();

      if (error) throw error;

      setExperiences(prev => [newExperience, ...prev]);
      setSelectedExperience(newExperience);

      toast({
        title: "Experience duplicated",
        description: "Experience has been duplicated successfully.",
      });

      return newExperience;
    } catch (error) {
      console.error("Error duplicating experience:", error);
      toast({
        title: "Error duplicating experience",
        description: "Failed to duplicate experience. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteExperience = async (experienceId: string) => {
    try {
      const { error } = await supabase
        .from("experiences")
        .delete()
        .eq("id", experienceId);

      if (error) throw error;

      setExperiences(prev => prev.filter(exp => exp.id !== experienceId));
      
      if (selectedExperience?.id === experienceId) {
        setSelectedExperience(null);
      }

      toast({
        title: "Experience deleted",
        description: "Experience has been deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting experience:", error);
      toast({
        title: "Error deleting experience",
        description: "Failed to delete experience. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getFilteredRoles = (companyId: string) => {
    return roles.filter(role => role.company_id === companyId);
  };

  return {
    // Data
    companies,
    roles,
    experiences,
    selectedCompany,
    selectedRole,
    selectedExperience,
    isLoading,

    // Actions
    setSelectedCompany,
    setSelectedRole,
    setSelectedExperience,
    createCompany,
    createRole,
    createExperience,
    updateExperience,
    duplicateExperience,
    deleteExperience,
    getFilteredRoles,
    loadData,
  };
};