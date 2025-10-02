import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface AccountSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountSettings = ({ isOpen, onClose }: AccountSettingsProps) => {
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordMessageType, setPasswordMessageType] = useState<"success" | "error">("error");
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  const validatePassword = (password: string) => {
    const requirements = [];
    if (password.length < 8) requirements.push("at least 8 characters");
    if (!/(?=.*[a-z])/.test(password)) requirements.push("a lowercase letter");
    if (!/(?=.*[A-Z])/.test(password)) requirements.push("an uppercase letter");
    if (!/(?=.*\d)/.test(password)) requirements.push("a number");
    if (!/(?=.*[@$!%*?&])/.test(password)) requirements.push("a special character (@$!%*?&)");
    
    return requirements;
  };

  const handleEmailVerification = async () => {
    if (!newEmail) {
      toast({
        title: "Error",
        description: "Please enter a new email address",
        variant: "destructive",
      });
      return;
    }

    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      
      toast({
        title: "Verification Email Sent",
        description: "Please check your new email address for verification",
      });
      setNewEmail("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMessage("");
    
    if (!currentPassword || !newPassword) {
      return;
    }

    // First validate current password
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: (await supabase.auth.getUser()).data.user?.email || "",
        password: currentPassword,
      });
      
      if (signInError) {
        setPasswordMessage("You've input the current password incorrectly, please try again.");
        setPasswordMessageType("error");
        return;
      }
    } catch (error) {
      setPasswordMessage("You've input the current password incorrectly, please try again.");
      setPasswordMessageType("error");
      return;
    }

    // Then validate new password requirements
    const requirements = validatePassword(newPassword);
    if (requirements.length > 0) {
      setPasswordMessage(`Your new password does not meet requirement: ${requirements.join(", ")}`);
      setPasswordMessageType("error");
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setPasswordMessage("Password changed.");
      setPasswordMessageType("success");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error: any) {
      setPasswordMessage("Failed to change password. Please try again.");
      setPasswordMessageType("error");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setSubscriptionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Portal error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to open customer portal",
        variant: "destructive",
      });
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      return;
    }

    setDeleteLoading(true);
    try {
      // Verify current password first
      const currentUser = await supabase.auth.getUser();
      const userEmail = currentUser.data.user?.email;
      
      if (!userEmail) {
        throw new Error("Unable to get user email");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: deletePassword,
      });
      
      if (signInError) {
        toast({
          title: "Error",
          description: "Current password is incorrect",
          variant: "destructive",
        });
        setDeleteLoading(false);
        return;
      }

      // For now, we'll sign out the user as account deletion requires admin privileges
      // In a production environment, you would call an edge function to handle deletion
      await supabase.auth.signOut();
      navigate("/");
      
      toast({
        title: "Account Deletion Requested",
        description: "Please contact support to complete account deletion",
      });
    } catch (error: any) {
      toast({
        title: "Error", 
        description: "Failed to process request. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen && !showDeleteConfirm} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Account Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Change Email */}
            <div className="space-y-2">
              <Label htmlFor="new-email">Change Email</Label>
              <div className="flex gap-2">
                <Input
                  id="new-email"
                  type="email"
                  placeholder="Enter new email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                <Button 
                  onClick={handleEmailVerification}
                  disabled={emailLoading || !newEmail}
                  size="sm"
                >
                  {emailLoading ? "Sending..." : "Verify"}
                </Button>
              </div>
            </div>

            {/* Change Password */}
            <div className="space-y-2">
              <Label>Change Password</Label>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <Button 
                    onClick={handlePasswordChange}
                    disabled={passwordLoading || !currentPassword || !newPassword}
                    size="sm"
                  >
                    {passwordLoading ? "Changing..." : "Change Password"}
                  </Button>
                </div>
                {passwordMessage && (
                  <p className={`text-sm ${passwordMessageType === "success" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                    {passwordMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Educational Achievements */}
            <div className="space-y-2 pt-4 border-t">
              <Label>Educational Achievements</Label>
              <p className="text-sm text-muted-foreground">
                Review and update your educational background
              </p>
              <Button 
                variant="outline"
                onClick={() => {
                  navigate("/onboarding/education");
                  onClose();
                }}
                className="w-full"
              >
                Manage Education
              </Button>
              <Button 
                variant="outline"
                onClick={handleManageSubscription}
                disabled={subscriptionLoading}
                className="w-full"
              >
                {subscriptionLoading ? "Loading..." : "Manage Subscription"}
              </Button>
            </div>

            {/* Delete Account */}
            <div className="space-y-2 pt-4 border-t">
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full"
              >
                Delete Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete your account, without any possibility of recovery. 
              Do you wish to continue? Should you have any concerns, you may email the administrator.
            </p>
            
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter your current password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
              <Button 
                variant="destructive" 
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePassword}
                className="w-full"
              >
                {deleteLoading ? "Deleting..." : "Continue - Delete Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};