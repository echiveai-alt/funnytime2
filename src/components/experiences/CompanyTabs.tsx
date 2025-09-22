import { useState } from "react";
import { Plus, MoreVertical, Building2, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Company } from "@/types/experience";
import { cn } from "@/lib/utils";

interface CompanyTabsProps {
  companies: Company[];
  selectedCompany: Company | null;
  onSelectCompany: (company: Company) => void;
  onAddCompany: () => void;
  onEditCompany?: (company: Company) => void;
  onDeleteCompany?: (company: Company) => void;
  isLoading?: boolean;
}

export const CompanyTabs = ({
  companies,
  selectedCompany,
  onSelectCompany,
  onAddCompany,
  onEditCompany,
  onDeleteCompany,
  isLoading = false,
}: CompanyTabsProps) => {
  const [scrollPosition, setScrollPosition] = useState(0);

  const sortedCompanies = [...companies].sort((a, b) => {
    if (a.is_current && !b.is_current) return -1;
    if (!a.is_current && b.is_current) return 1;
    if (a.end_date && b.end_date) {
      return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
    }
    if (a.end_date && !b.end_date) return 1;
    if (!a.end_date && b.end_date) return -1;
    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
  });

  return (
    <div className="border-b border-border/50">
      <div className="flex items-center gap-2 py-2 min-h-[2.5rem]">
        <ScrollArea className="flex-1">
          <div className="flex items-center gap-2 min-w-0 h-7">
            {sortedCompanies.map((company) => {
              const isSelected = selectedCompany?.id === company.id;
              return (
                <button
                  key={company.id}
                  onClick={() => onSelectCompany(company)}
                  disabled={isLoading}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all whitespace-nowrap text-sm font-medium relative",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-soft scale-105"
                      : "bg-background hover:bg-muted border-border hover:border-border/80"
                  )}
                >
                  <Building2 className="w-4 h-4" />
                  <span className="font-semibold">{company.name}</span>
                  {company.is_current && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
        
        <div className="flex items-center gap-2 h-7">
          {selectedCompany && onEditCompany && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditCompany(selectedCompany)}
              disabled={isLoading}
              className="h-7 w-7 p-0 hover:bg-muted flex-shrink-0"
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onAddCompany}
            disabled={isLoading}
            className="flex items-center gap-2 whitespace-nowrap h-7 text-xs flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Company
          </Button>
        </div>
      </div>
    </div>
  );
};