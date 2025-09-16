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
      
      // Automatically select the newest experience if available
      if (data && data.length > 0) {
        setSelectedExperience(data[0]); // First item is newest due to ordering
      } else {
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

      // Check for duplicate company name (excluding current editing item)
      const existingCompany = companies.find(
        company => company.name.toLowerCase().trim() === companyData.name.toLowerCase().trim()
      );
      if (existingCompany) {
        toast({
          title: "Duplicate company",
          description: "A company with this name already exists.",
          variant: "destructive",
        });
        throw new Error("Duplicate company name");
      }

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
      setSelectedRole(role);

      // Automatically create a new experience for the new role
      try {
        const { data: experience, error: expError } = await supabase
          .from("experiences")
          .insert({
            user_id: user.id,
            role_id: role.id,
            title: "",
            situation: "",
            task: "",
            action: "",
            result: "",
            keywords: [],
          })
          .select()
          .single();

        if (expError) throw expError;

        setExperiences([experience]);
        setSelectedExperience(experience);
      } catch (expError) {
        console.error("Error creating initial experience:", expError);
        // Don't throw here - company and role creation was successful
      }

      toast({
        title: "Company added",
        description: "Company has been added successfully.",
      });

      return company;
    } catch (error) {
      console.error("Error creating company:", error);
      if (error.message !== "Duplicate company name") {
        toast({
          title: "Error creating company",
          description: "Failed to create company. Please try again.",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  const updateCompany = async (companyId: string, companyData: Omit<Company, "id" | "user_id" | "created_at" | "updated_at">) => {
    try {
      // Check for duplicate company name (excluding current company being edited)
      const existingCompany = companies.find(
        company => company.id !== companyId && company.name.toLowerCase().trim() === companyData.name.toLowerCase().trim()
      );
      if (existingCompany) {
        toast({
          title: "Duplicate company",
          description: "A company with this name already exists.",
          variant: "destructive",
        });
        throw new Error("Duplicate company name");
      }

      const { data: company, error } = await supabase
        .from("companies")
        .update(companyData)
        .eq("id", companyId)
        .select()
        .single();

      if (error) throw error;

      // Update state
      setCompanies(prev => prev.map(c => c.id === companyId ? company : c));
      
      // Update selected company if it's the one being edited
      if (selectedCompany?.id === companyId) {
        setSelectedCompany(company);
      }

      toast({
        title: "Company updated",
        description: "Company has been updated successfully.",
      });

      return company;
    } catch (error) {
      console.error("Error updating company:", error);
      if (error.message !== "Duplicate company name") {
        toast({
          title: "Error updating company",
          description: "Failed to update company. Please try again.",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  const createRole = async (roleData: Omit<Role, "id" | "user_id" | "created_at" | "updated_at">) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Check for duplicate role title within the same company (excluding current editing item)
      const existingRole = roles.find(
        role => role.company_id === roleData.company_id && 
        role.title.toLowerCase().trim() === roleData.title.toLowerCase().trim()
      );
      if (existingRole) {
        toast({
          title: "Duplicate role",
          description: "A role with this title already exists in this company.",
          variant: "destructive",
        });
        throw new Error("Duplicate role title");
      }

      const { data: role, error } = await supabase
        .from("roles")
        .insert({ ...roleData, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      setRoles(prev => [...prev, role]);
      setSelectedRole(role);

      // Automatically create a new experience for the new role
      try {
        const { data: experience, error: expError } = await supabase
          .from("experiences")
          .insert({
            user_id: user.id,
            role_id: role.id,
            title: "",
            situation: "",
            task: "",
            action: "",
            result: "",
            keywords: [],
          })
          .select()
          .single();

        if (expError) throw expError;

        setExperiences([experience]);
        setSelectedExperience(experience);
      } catch (expError) {
        console.error("Error creating initial experience:", expError);
        // Don't throw here - role creation was successful
      }

      toast({
        title: "Role added",
        description: "Role has been added successfully.",
      });

      return role;
    } catch (error) {
      console.error("Error creating role:", error);
      if (error.message !== "Duplicate role title") {
        toast({
          title: "Error creating role",
          description: "Failed to create role. Please try again.",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  const updateRole = async (roleId: string, roleData: Omit<Role, "id" | "user_id" | "created_at" | "updated_at">) => {
    try {
      // Check for duplicate role title within the same company (excluding current role being edited)
      const existingRole = roles.find(
        role => role.id !== roleId && role.company_id === roleData.company_id && 
        role.title.toLowerCase().trim() === roleData.title.toLowerCase().trim()
      );
      if (existingRole) {
        toast({
          title: "Duplicate role",
          description: "A role with this title already exists in this company.",
          variant: "destructive",
        });
        throw new Error("Duplicate role title");
      }

      const { data: role, error } = await supabase
        .from("roles")
        .update(roleData)
        .eq("id", roleId)
        .select()
        .single();

      if (error) throw error;

      // Update state
      setRoles(prev => prev.map(r => r.id === roleId ? role : r));
      
      // Update selected role if it's the one being edited
      if (selectedRole?.id === roleId) {
        setSelectedRole(role);
      }

      toast({
        title: "Role updated",
        description: "Role has been updated successfully.",
      });

      return role;
    } catch (error) {
      console.error("Error updating role:", error);
      if (error.message !== "Duplicate role title") {
        toast({
          title: "Error updating role",
          description: "Failed to update role. Please try again.",
          variant: "destructive",
        });
      }
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

  const deleteCompany = async (companyId: string) => {
    try {
      // First delete all experiences for roles in this company
      const companyRoles = roles.filter(role => role.company_id === companyId);
      for (const role of companyRoles) {
        const { error: expError } = await supabase
          .from("experiences")
          .delete()
          .eq("role_id", role.id);
        if (expError) throw expError;
      }

      // Then delete all roles for this company
      const { error: rolesError } = await supabase
        .from("roles")
        .delete()
        .eq("company_id", companyId);
      if (rolesError) throw rolesError;

      // Finally delete the company
      const { error: companyError } = await supabase
        .from("companies")
        .delete()
        .eq("id", companyId);
      if (companyError) throw companyError;

      // Update state
      setCompanies(prev => prev.filter(company => company.id !== companyId));
      setRoles(prev => prev.filter(role => role.company_id !== companyId));
      setExperiences(prev => prev.filter(exp => !companyRoles.some(role => role.id === exp.role_id)));
      
      // Clear selections if they belonged to the deleted company
      if (selectedCompany?.id === companyId) {
        setSelectedCompany(companies.find(c => c.id !== companyId) || null);
        setSelectedRole(null);
        setSelectedExperience(null);
      }

      toast({
        title: "Company deleted",
        description: "Company and all associated roles and experiences have been deleted.",
      });
    } catch (error) {
      console.error("Error deleting company:", error);
      toast({
        title: "Error deleting company",
        description: "Failed to delete company. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteRole = async (roleId: string) => {
    try {
      // First delete all experiences for this role
      const { error: expError } = await supabase
        .from("experiences")
        .delete()
        .eq("role_id", roleId);
      if (expError) throw expError;

      // Then delete the role
      const { error: roleError } = await supabase
        .from("roles")
        .delete()
        .eq("id", roleId);
      if (roleError) throw roleError;

      // Update state
      setRoles(prev => prev.filter(role => role.id !== roleId));
      setExperiences(prev => prev.filter(exp => exp.role_id !== roleId));
      
      // Clear selections if they belonged to the deleted role
      if (selectedRole?.id === roleId) {
        const remainingRoles = roles.filter(role => role.id !== roleId && role.company_id === selectedCompany?.id);
        setSelectedRole(remainingRoles[0] || null);
        setSelectedExperience(null);
      }

      toast({
        title: "Role deleted",
        description: "Role and all associated experiences have been deleted.",
      });
    } catch (error) {
      console.error("Error deleting role:", error);
      toast({
        title: "Error deleting role",
        description: "Failed to delete role. Please try again.",
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
    updateCompany,
    createRole,
    updateRole,
    createExperience,
    updateExperience,
    duplicateExperience,
    deleteExperience,
    deleteCompany,
    deleteRole,
    getFilteredRoles,
    loadData,
  };
};