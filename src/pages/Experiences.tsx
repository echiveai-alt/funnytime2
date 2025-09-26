import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  // Which modal is open now
  const [openModal, setOpenModal] = useState<Modal>(null);

  // Session-scoped flag: did we already auto-show onboarding this session?
  const [hasAutoShownThisSession, setHasAutoShownThisSession] = useState<boolean>(() => {
    return sessionStorage.getItem(SESSION_FLAG) === "1";
  });

  // For editing flows
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [editingRole, setEditingRole] = useState<any>(null);

  // Which company the Role modal should attach to
  const [roleCompanyId, setRoleCompanyId] = useState<string>("");

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

  // 1) First visit this session + no companies ⇒ open Resume modal once (per session)
  useEffect(() => {
    if (experiencesLoading) return;
    if (!hasAutoShownThisSession && noCompanies && openModal === null) {
      setOpenModal("resume");
      setHasAutoShownThisSession(true);
      sessionStorage.setItem(SESSION_FLAG, "1");
    }
  }, [experiencesLoading, hasAutoShownThisSession, noCompanies, openModal]);

  // Actions for Experience list
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

  // Openers (buttons)
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
    // Ensure role modal has a target company
    if (selectedCompany?.id) setRoleCompanyId(selectedCompany.id);
    setEditingRole(null);
    setOpenModal("role");
  };

  const openEditRole = (role: any) => {
    // For edit, we’ll prefer selectedCompany as the target
    if (selectedCompany?.id) setRoleCompanyId(selectedCompany.id);
    setEditingRole(role);
    setOpenModal("role");
  };

  return (
    <>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Company Tabs */}
            <CompanyTabs
              companies={companies}
              selectedCompany={selectedCompany}
              onSelectCompany={setSelectedCompany}
              onAddCompany={openAddCompany}
              onEditCompany={openEditCompany}
              isLoading={experiencesLoading}
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

          {/* Spec (2): explicit Import Experiences button */}
          <div className="shrink-0">
            <Button variant="secondary" onClick={openImportResume}>
              Import Experiences
            </Button>
          </div>
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

      {/* (1, 1a, 1b, 2) Resume / Onboarding Modal */}
      <OnboardingResumeModal
        isOpen={openModal === "resume"}
        onImportComplete={async (_data) => {
          // Parse success: refresh, auto-select most recent role, close modal.
          try {
            await refreshAndSelectLatest();
          } finally {
            setOpenModal(null);
          }
        }}
        onClose={() => {
          // Cancel/Skip: if still no companies, go to Company; else just close.
          if (noCompanies) {
            setOpenModal("company");
          } else {
            setOpenModal(null);
          }
        }}
      />

      {/* (3) Company Modal */}
      <CompanyModal
        isOpen={openModal === "company"}
        onClose={() => {
          setEditingCompany(null);
          setOpenModal(null); // back to page without changes
        }}
        onSave={async (data, _roleTitle) => {
          // If editing, update; else create. After save, refresh selection and open Role modal.
          let savedCompany: any = null;

          if (editingCompany) {
            savedCompany = await updateCompany(editingCompany.id, data);
          } else {
            savedCompany = await createCompany(data, undefined);
          }

          setEditingCompany(null);
          await refreshAndSelectLatest();

          // Resolve the correct companyId for the upcoming Role modal
          const resolvedCompanyId =
            savedCompany?.id ||
            selectedCompany?.id ||
            companies[companies.length - 1]?.id ||
            "";

          setRoleCompanyId(resolvedCompanyId);
          setOpenModal("role"); // open Role modal next
        }}
        onDelete={editingCompany ? deleteCompany : undefined}
        company={editingCompany}
        isLoading={experiencesLoading}
      />

      {/* (4) Role Modal */}
      <RoleModal
        isOpen={openModal === "role"}
        onClose={() => {
          setEditingRole(null);
          setRoleCompanyId("");
          setOpenModal(null); // back to page
        }}
        onSave={async (data) => {
          if (editingRole) {
            await updateRole(editingRole.id, data);
          } else {
            await createRole(data);
          }
          setEditingRole(null);
          await refreshAndSelectLatest();
          setRoleCompanyId("");
          setOpenModal(null); // close role modal
        }}
        onDelete={editingRole ? deleteRole : undefined}
        role={editingRole}
        companyId={roleCompanyId || selectedCompany?.id || ""}
        isLoading={experiencesLoading}
      />
    </>
  );
};

export default Experiences;
