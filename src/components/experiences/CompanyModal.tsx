import { useState } from "react";
import { Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Company } from "@/types/experience";

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (company: Omit<Company, "id" | "user_id" | "created_at" | "updated_at">) => Promise<void>;
  company?: Company | null;
  isLoading?: boolean;
}

export const CompanyModal = ({
  isOpen,
  onClose,
  onSave,
  company = null,
  isLoading = false,
}: CompanyModalProps) => {
  const [formData, setFormData] = useState({
    name: company?.name || "",
    start_date: company?.start_date ? new Date(company.start_date) : undefined,
    end_date: company?.end_date ? new Date(company.end_date) : undefined,
    is_current: company?.is_current || false,
    role_title: "", // For creating initial role
  });
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const handleSave = async () => {
    if (!formData.name || !formData.start_date) return;

    try {
      await onSave({
        name: formData.name,
        start_date: formData.start_date.toISOString().split('T')[0],
        end_date: formData.is_current ? null : formData.end_date?.toISOString().split('T')[0] || null,
        is_current: formData.is_current,
      });
      onClose();
      // Reset form
      setFormData({
        name: "",
        start_date: undefined,
        end_date: undefined,
        is_current: false,
        role_title: "",
      });
    } catch (error) {
      console.error("Failed to save company:", error);
    }
  };

  const isValid = formData.name.trim() && formData.start_date && formData.role_title.trim();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {company ? "Edit Company" : "Add Company"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter company name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-title">Initial Role</Label>
            <Input
              id="role-title"
              value={formData.role_title}
              onChange={(e) => setFormData(prev => ({ ...prev, role_title: e.target.value }))}
              placeholder="e.g., Product Manager"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.start_date && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.start_date ? (
                      format(formData.start_date, "MMM yyyy")
                    ) : (
                      <span>Pick date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.start_date}
                    onSelect={(date) => {
                      setFormData(prev => ({ ...prev, start_date: date }));
                      setStartDateOpen(false);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={formData.is_current}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      (!formData.end_date || formData.is_current) && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.is_current ? (
                      <span>Current</span>
                    ) : formData.end_date ? (
                      format(formData.end_date, "MMM yyyy")
                    ) : (
                      <span>Pick date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.end_date}
                    onSelect={(date) => {
                      setFormData(prev => ({ ...prev, end_date: date }));
                      setEndDateOpen(false);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="current"
              checked={formData.is_current}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ 
                  ...prev, 
                  is_current: !!checked,
                  end_date: checked ? undefined : prev.end_date
                }))
              }
            />
            <Label htmlFor="current">This is my current position</Label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isLoading}>
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};