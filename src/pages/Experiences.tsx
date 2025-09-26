import { useEffect, useMemo, useState } from "react";
import { Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CompanyTabs } from "@/components/experiences/CompanyTabs";
import { RoleTabs } from "@/components/experiences/RoleTabs";
import { ExperiencesList } from "@/components/experiences/ExperiencesList";
import { STARInputPanel } from "@/components/experiences/STARInputPanel";
import { CompanyModal } from "@/components/experiences/CompanyModal";
import { RoleModal } from "@/components/experiences/RoleModal";
import { OnboardingResumeModal } from "@/components/experiences/OnboardingResumeModal";
import { useExperiences } from "@/hooks/useExperiences";

type Modal = null | "resume" | "company" | "role";
const SESSION_FLAG = "exp_onboarding_shown";

const Experiences = () => {
  console.log("Experiences component loading...");

  // Single source of truth for which modal is open
  const [openModal, setOpenModal] = useState<Modal>(null);

  // Session-scoped "has auto-shown resume modal" flag
  const [hasAutoShownThisSession, setHasAutoShownThisSession] = useState<boolean>(() => {
    return sessionStorage.getItem(SESSION_FLAG) === "1";
  });

  // Track successful resume import to prevent company modal from auto-opening
  const [resumeImportSuccessful, setResumeImportSuccessful] = useState(false);

  // Editing payloads (kept separate)
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [editingRole, setEditingRole] = useState<any>(null);

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
    refreshAndSelectLatest,
  } = useExperiences();

  const noCompanies = companies.length === 0;

  /**
   * 1) First visit this session + no companies => auto-open Resume (once per session).
   *    Won't trigger if any modal is already open.
   * 2) Listen for custom event from MainTabs to open resume modal
   */
  useEffect(() => {
    if (experiencesLoading) return;
    if (!hasAutoShownThisSession && noCompanies && openModal === null) {
      setOpenModal("resume");
      setHasAutoShownThisSession(true);
      sessionStorage.setItem(SESSION_FLAG, "1");
    }
  }, [experiencesLoading, hasAutoShownThisSession, noCompanies, openModal]);

  // Listen for custom event from MainTabs to open resume modal
  useEffect(() => {
    const handleOpenResumeModal = () => {
      setOpenModal("resume");
    };

    window.addEventListener('openResumeModal', handleOpenResumeModal);
    
    return () => {
      window.removeEventListener('openResumeModal', handleOpenResumeModal);
    };
  }, []);

  /**
   * Experience actions
   */
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

  /**
   * Button handlers (openers)
   */
  const openImportResume = () => setOpenModal("resume");

  const openAddCompany = () => {
    setEditingCompany(null);
    setOpenModal("company");
  };

  const openEditCompany = (company: any) => {
    setEditingCompany(company);
    setOpenModal("company");
  };

  const openAddRole = () => {
    setEditingRole(null);
    setOpenModal("role");
  };

  const openEditRole = (role: any) => {
    setEditingRole(role);
    setOpenModal("role");
  };

  /**
   * Modal close helpers
   */
  const closeAllModals = () => setOpenModal(null);

  /**
   * Unified resume import handler - works for both auto-opened and manual modals
   */
  const handleResumeImportComplete = async (parsedData: any) => {
    console.log('Resume import completed in Experiences component:', parsedData);
    
    try {
      // Mark import as successful BEFORE starting the refresh
      setResumeImportSuccessful(true);
      await refreshAndSelectLatest();
      console.log('Successfully refreshed data after resume import');
    } catch (error) {
      console.error('Failed to refresh data after resume import:', error);
      setResumeImportSuccessful(false); // Reset on error
      throw error; // Re-throw so the modal can handle the error
    }
    // Don't close modal here - let the modal handle its own closing
  };

  /**
   * Unified resume modal close handler
   */
  const handleResumeModalClose = () => {
    // Only open company modal if this was NOT a successful import AND we have no companies
    if (!resumeImportSuccessful && noCompanies) {
      setOpenModal("company");
    } else {
      setOpenModal(null);
    }
    // Reset the flag for next time
    setResumeImportSuccessful(false);
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
            onAddCompany={openAddCompany}
            onEditCompany={openEditCompany}
            isLoading={experiencesLoading}
            // Wire up the import resume functionality to the CompanyTabs if it has that button
            onImportExperiences={openImportResume}
          />

          {/* Role Tabs */}
          {selectedCompany && (
            <RoleTabs
              roles={getFilteredRoles(selectedCompany.id)}
              selectedRole={selectedRole}
              onSelectRole={setSelectedRole}
              onAddRole={openAddRole}
              onEditRole={openEditRole}
              isLoading={experiencesLoading}
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
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
            {/* Experiences List */}
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

            {/* STAR Input Panel */}
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

      {/* Resume (Onboarding) Modal - Unified handler for both auto-open and manual open */}
      <OnboardingResumeModal
        isOpen={openModal === "resume"}
        // Unified import complete handler - always refreshes data and lets modal handle closing
        onImportComplete={handleResumeImportComplete}
        // Unified close handler - handles the onboarding flow properly
        onClose={handleResumeModalClose}
      />

      {/* Company Modal */}
      <CompanyModal
        isOpen={openModal === "company"}
        onClose={() => {
          setEditingCompany(null);
          setOpenModal(null); // back to page
        }}
        onSave={async (data, roleTitle) => {
          try {
            if (editingCompany) {
              // Editing existing company - just update and close
              await updateCompany(editingCompany.id, data);
              setEditingCompany(null);
              await refreshAndSelectLatest();
              setOpenModal(null);
            } else {
              // Creating new company - pass the roleTitle to createCompany
              // The createCompany function will handle creating both company and role
              const roleToCreate = roleTitle?.trim() || "New Role";
              await createCompany(data, roleToCreate);
              setEditingCompany(null);
              await refreshAndSelectLatest();
              setOpenModal(null); // Close since everything was created successfully
            }
          } catch (error) {
            console.error("Failed to save company:", error);
          }
        }}
        onDelete={editingCompany ? deleteCompany : undefined}
        company={editingCompany}
        isLoading={experiencesLoading}
      />

      {/* Role Modal */}
      <RoleModal
        isOpen={openModal === "role"}
        onClose={() => {
          setEditingRole(null);
          setOpenModal(null); // back to page
        }}
        onSave={async (data) => {
          if (editingRole) {
            await updateRole(editingRole.id, data);
          } else {
            await createRole(data);
          }
          setEditingRole(null);
          await refreshAndSelectLatest(); // keep selection fresh
          setOpenModal(null); // close role modal
        }}
        onDelete={editingRole ? deleteRole : undefined}
        role={editingRole}
        companyId={selectedCompany?.id || ""}
        isLoading={experiencesLoading}
      />
    </>
  );
};

export default Experiences;
