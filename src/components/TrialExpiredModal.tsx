import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface TrialExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrialExpiredModal = ({ isOpen, onClose }: TrialExpiredModalProps) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onClose();
    navigate("/pricing");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-xl shadow-soft mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center text-2xl">
            Your Free Trial Has Ended
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            You've used all your free analyses and resume bullet generations. 
            Upgrade to Resume Builder Pro for unlimited access to all features.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Pro Benefits:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Unlimited resume bullet points</li>
              <li>• Unlimited job fit analyses</li>
              <li>• Advanced AI matching</li>
              <li>• Priority support</li>
            </ul>
          </div>

          <Button 
            onClick={handleUpgrade}
            className="w-full"
            size="lg"
          >
            Sign Up for Unlimited Usage
          </Button>
          
          <Button 
            onClick={onClose}
            variant="ghost"
            className="w-full"
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};