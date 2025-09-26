import { useState } from "react";
import { Plus, MoreVertical, User, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Role } from "@/types/experience";
import { cn } from "@/lib/utils";

interface RoleTabsProps {
  roles: Role[];
  selectedRole: Role | null;
  onSelectRole: (role: Role) => void;
  onAddRole: () => void;
  onEditRole?: (role: Role) => void;
  onDeleteRole?: (role: Role) => void;
  hasUnsavedChanges?: boolean;
  isLoading?: boolean;
}

export const RoleTabs = ({
  roles,
  selectedRole,
  onSelectRole,
  onAddRole,
  onEditRole,
  onDeleteRole,
  hasUnsavedChanges = false,
  isLoading = false,
}: RoleTabsProps) => {
  const sortedRoles = [...roles].sort((a, b) => {
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
    <div className="border-b border-border/30">
      <div className="flex items-center gap-2 py-1.5 pl-8">
        <ScrollArea className="flex-1">
          <div className="flex items-center gap-2 min-w-0">
            {sortedRoles.map((role) => {
              const isSelected = selectedRole?.id === role.id;
              const showUnsavedDot = hasUnsavedChanges && isSelected;
              
              return (
                <button
                  key={role.id}
                  onClick={() => onSelectRole(role)}
                  disabled={isLoading}
                   className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all whitespace-nowrap text-xs font-medium relative h-6",
                      isSelected
                      ? "bg-primary/20 text-primary shadow-sm"
                      : "bg-background/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                    // Border colors based on role status
                      isSelected
                      ? "border-primary/30"
                      : role.is_current
                      ? "border-green-500/70"
                      : showUnsavedDot
                      ? "border-orange-500/70"
                      : "border-border/50 hover:border-border/70"
                    )}
                >
                  <User className="w-3 h-3" />
                  <span className="font-medium">{role.title}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
        
        <div className="flex items-center gap-2">
          {selectedRole && onEditRole && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditRole(selectedRole)}
              disabled={isLoading}
              className="h-6 w-6 p-0 hover:bg-muted flex-shrink-0"
            >
              <MoreVertical className="h-2.5 w-2.5" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onAddRole}
            disabled={isLoading}
            className="flex items-center gap-1.5 whitespace-nowrap text-xs h-6 flex-shrink-0"
          >
            <Plus className="w-3 h-3" />
            Add Role
          </Button>
        </div>
      </div>
    </div>
  );
};
