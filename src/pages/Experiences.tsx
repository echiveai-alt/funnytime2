import { useState, useEffect } from "react";
import { Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CompanyTabs } from "@/components/experiences/CompanyTabs";
import { RoleTabs } from "@/components/experiences/RoleTabs";
import { ExperiencesList } from "@/components/experiences/ExperiencesList";
import { STARInputPanel } from "@/components/experiences/STARInputPanel";
import { CompanyModal } from "@/components/experiences/CompanyModal";
import { RoleModal } from "@/components/experiences/RoleModal";
import { ResumeImportModal } from "@/components/experiences/ResumeImportModal";
import { useExperiences } from "@/hooks/useExperiences";
import { useToast } from "@/components/ui/use-toast";

const Experiences = () => {
  // Fixed isLoading reference issue - debugging
  console.log("Experiences component loading...");
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showResumeImportModal, setShowResumeImportModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const { toast } = useToast();

  const {
    companies,
    roles,
    experiences,
    selectedCompany,
    selectedRole,
    selectedExperience,
    isLoading: experiencesLoading,
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
  } = useExperiences();

  // Show company modal if no companies exist
  useEffect(() => {
    if (!experiencesLoading && companies.length === 0) {
      setShowCompanyModal(true);
    }
  }, [experiencesLoading, companies.length]);

  const handleAddExperience = async () => {
    try {
      await createExperience();
    } catch (error) {
      console.error("Failed to create experience:", error);
    }
  };

  const handleSaveExperience = async (data: any) => {
    if (!selectedExperience) return;
    await updateExperience(selectedExperience.id, data);
  };

  const handleDeleteSelectedExperience = async () => {
    if (!selectedExperience) return;
    await deleteExperience(selectedExperience.id);
  };

  const handleResumeImport = async (parsedData: any[]) => {
    try {
      for (const experience of parsedData) {
        // Create or find company
        const existingCompany = companies.find(c => 
          c.name.toLowerCase() === experience.company.toLowerCase()
        );
        
        let companyId = existingCompany?.id;
        
        if (!existingCompany) {
          const companyData = {
            name: experience.company,
            start_date: experience.startDate || new Date().toISOString().split('T')[0],
            end_date: experience.endDate,
            is_current: !experience.endDate
          };
          const newCompany = await createCompany(companyData, experience.role);
          companyId = newCompany?.id;
        }
        
        if (!companyId) continue;
        
        // Create or find role
        const existingRole = roles.find(r => 
          r.company_id === companyId && 
          r.title.toLowerCase() === experience.role.toLowerCase()
        );
        
        let roleId = existingRole?.id;
        
        if (!existingRole) {
          const roleData = {
            company_id: companyId,
            title: experience.role,
            start_date: experience.startDate || new Date().toISOString().split('T')[0],
            end_date: experience.endDate,
            is_current: !experience.endDate
          };
          const newRole = await createRole(roleData);
          roleId = newRole?.id;
        }
        
        if (!roleId) continue;
        
        // Set the role as selected to create experiences for it
        const targetRole = roles.find(r => r.id === roleId) || 
                          (existingRole || { id: roleId, company_id: companyId, title: experience.role, start_date: experience.startDate, end_date: experience.endDate, is_current: !experience.endDate, user_id: '', created_at: '', updated_at: '' });
        setSelectedRole(targetRole);
        
        // Create experiences for each bullet
        for (const bullet of experience.bullets) {
          const newExperience = await createExperience();
          if (newExperience) {
            await updateExperience(newExperience.id, {
              title: bullet.title,
              situation: bullet.situation || '',
              task: bullet.task || '',
              action: bullet.action || '',
              result: bullet.result || '',
              tags: []
            });
          }
        }
      }
      
      toast({
        title: "Resume Imported Successfully",
        description: `Created ${parsedData.length} work experience${parsedData.length > 1 ? 's' : ''} with ${parsedData.reduce((sum, exp) => sum + exp.bullets.length, 0)} STAR stories`,
      });
      
    } catch (error) {
      console.error("Failed to import resume:", error);
      toast({
        title: "Import Failed",
        description: "There was an error importing your resume. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {/* Sticky Navigation Tabs */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6">
          {/* Company Tabs */}
            <CompanyTabs
              companies={companies}
              selectedCompany={selectedCompany}
              onSelectCompany={setSelectedCompany}
              onAddCompany={() => setShowCompanyModal(true)}
              onImportResume={() => setShowResumeImportModal(true)}
              onEditCompany={(company) => {
                setEditingCompany(company);
                setShowCompanyModal(true);
              }}
              isLoading={experiencesLoading}
            />
          
          {/* Role Tabs */}
          {selectedCompany && (
            <RoleTabs
              roles={getFilteredRoles(selectedCompany.id)}
              selectedRole={selectedRole}
              onSelectRole={setSelectedRole}
              onAddRole={() => setShowRoleModal(true)}
              onEditRole={(role) => {
                setEditingRole(role);
                setShowRoleModal(true);
              }}
              isLoading={experiencesLoading}
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Show loading state only when initially loading and no saved role */}
        {experiencesLoading && !selectedRole ? (
          <div className="flex items-center justify-center h-[60vh]">
            <Card className="p-12 shadow-soft text-center max-w-md">
              <div className="flex items-center justify-center w-16 h-16 bg-muted rounded-xl shadow-soft mx-auto mb-6">
                <Brain className="w-8 h-8 text-muted-foreground animate-pulse" />
              </div>
              <p className="text-muted-foreground">Loading...</p>
            </Card>
          </div>
        ) : selectedRole ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-20rem)]">
            {/* Experiences List - 35% width on desktop */}
            <div className="lg:col-span-4 xl:col-span-4">
              <ExperiencesList
                experiences={experiences}
                selectedExperience={selectedExperience}
                onSelectExperience={setSelectedExperience}
                onAddExperience={handleAddExperience}
                onEditExperience={setSelectedExperience}
                onDuplicateExperience={duplicateExperience}
                onDeleteExperience={(exp) => deleteExperience(exp.id)}
                isLoading={experiencesLoading}
              />
            </div>

            {/* STAR Input Panel - 65% width on desktop */}
            <div className="lg:col-span-8 xl:col-span-8">
              <STARInputPanel
                experience={selectedExperience}
                onSave={handleSaveExperience}
                onDelete={selectedExperience ? handleDeleteSelectedExperience : undefined}
                isLoading={experiencesLoading}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[60vh]">
            <Card className="p-12 shadow-soft text-center max-w-md">
              <div className="flex items-center justify-center w-16 h-16 bg-muted rounded-xl shadow-soft mx-auto mb-6">
                <Brain className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Select a role to get started
              </h2>
              <p className="text-muted-foreground">
                Choose a company and role from the tabs above to start adding your STAR experiences.
              </p>
            </Card>
          </div>
        )}
      </main>

      {/* Modals */}
      <CompanyModal
        isOpen={showCompanyModal}
        onClose={() => {
          setShowCompanyModal(false);
          setEditingCompany(null);
        }}
        onSave={async (data, roleTitle) => {
          if (editingCompany) {
            await updateCompany(editingCompany.id, data);
          } else {
            await createCompany(data, roleTitle);
          }
          setEditingCompany(null);
        }}
        onDelete={editingCompany ? deleteCompany : undefined}
        company={editingCompany}
        isLoading={experiencesLoading}
      />

      <RoleModal
        isOpen={showRoleModal}
        onClose={() => {
          setShowRoleModal(false);
          setEditingRole(null);
        }}
        onSave={async (data) => {
          if (editingRole) {
            await updateRole(editingRole.id, data);
          } else {
            await createRole(data);
          }
          setEditingRole(null);
        }}
        onDelete={editingRole ? deleteRole : undefined}
        role={editingRole}
        companyId={selectedCompany?.id || ""}
        isLoading={experiencesLoading}
      />

      <ResumeImportModal
        isOpen={showResumeImportModal}
        onClose={() => setShowResumeImportModal(false)}
        onImportComplete={handleResumeImport}
      />
    </>
  );
};

export default Experiences;