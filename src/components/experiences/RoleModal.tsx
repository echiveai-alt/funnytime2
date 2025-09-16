import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Role } from "@/types/experience";

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (role: Omit<Role, "id" | "user_id" | "created_at" | "updated_at">) => Promise<void>;
  onDelete?: (roleId: string) => Promise<void>;
  role?: Role | null;
  companyId: string;
  isLoading?: boolean;
}

export const RoleModal = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  role = null,
  companyId,
  isLoading = false,
}: RoleModalProps) => {
  const [formData, setFormData] = useState({
    title: role?.title || "",
    start_month: role?.start_date ? parseInt(role.start_date.split('-')[1]) : new Date().getMonth() + 1,
    start_year: role?.start_date ? parseInt(role.start_date.split('-')[0]) : new Date().getFullYear(),
    end_month: role?.end_date ? parseInt(role.end_date.split('-')[1]) : new Date().getMonth() + 1,
    end_year: role?.end_date ? parseInt(role.end_date.split('-')[0]) : new Date().getFullYear(),
    is_current: role?.is_current || false,
  });

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i);

  // Update form data when role changes (for editing)
  useEffect(() => {
    if (role) {
      setFormData({
        title: role.title || "",
        start_month: role.start_date ? parseInt(role.start_date.split('-')[1]) : new Date().getMonth() + 1,
        start_year: role.start_date ? parseInt(role.start_date.split('-')[0]) : new Date().getFullYear(),
        end_month: role.end_date ? parseInt(role.end_date.split('-')[1]) : new Date().getMonth() + 1,
        end_year: role.end_date ? parseInt(role.end_date.split('-')[0]) : new Date().getFullYear(),
        is_current: role.is_current || false,
      });
    } else {
      // Reset form for adding new role
      setFormData({
        title: "",
        start_month: new Date().getMonth() + 1,
        start_year: new Date().getFullYear(),
        end_month: new Date().getMonth() + 1,
        end_year: new Date().getFullYear(),
        is_current: false,
      });
    }
  }, [role]);

  const handleSave = async () => {
    if (!formData.title) return;

    const startDate = `${formData.start_year}-${String(formData.start_month).padStart(2, '0')}-01`;
    const endDate = formData.is_current ? null : `${formData.end_year}-${String(formData.end_month).padStart(2, '0')}-01`;

    try {
      await onSave({
        company_id: companyId,
        title: formData.title,
        start_date: startDate,
        end_date: endDate,
        is_current: formData.is_current,
      });
      onClose();
      // Reset form
      setFormData({
        title: "",
        start_month: new Date().getMonth() + 1,
        start_year: new Date().getFullYear(),
        end_month: new Date().getMonth() + 1,
        end_year: new Date().getFullYear(),
        is_current: false,
      });
    } catch (error) {
      console.error("Failed to save role:", error);
    }
  };

  const isValid = formData.title.trim();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {role ? "Edit Role" : "Add Role"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role-title">Role Title</Label>
            <Input
              id="role-title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Senior Product Manager"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={formData.start_month.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, start_month: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label.slice(0, 3)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={formData.start_year.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, start_year: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  disabled={formData.is_current}
                  value={formData.end_month.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, end_month: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.is_current ? "Current" : "Month"} />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label.slice(0, 3)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  disabled={formData.is_current}
                  value={formData.end_year.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, end_year: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.is_current ? "Current" : "Year"} />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="current"
              checked={formData.is_current}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ 
                  ...prev, 
                  is_current: !!checked
                }))
              }
            />
            <Label htmlFor="current">This is my current role</Label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          {role && onDelete && (
            <Button 
              variant="destructive" 
              onClick={async () => {
                await onDelete(role.id);
                onClose();
              }} 
              disabled={isLoading}
            >
              Delete
            </Button>
          )}
          <Button onClick={handleSave} disabled={!isValid || isLoading}>
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};