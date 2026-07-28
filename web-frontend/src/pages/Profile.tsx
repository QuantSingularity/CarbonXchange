import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, userApi, apiErrorMessage } from "@/services/api";
import { humanize, initials } from "@/lib/format";

export function Profile() {
  const { user, refreshUser } = useAuth();
  const profile = user?.profile;

  const [personal, setPersonal] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone_number: user?.phone_number || "",
    middle_name: profile?.middle_name || "",
    nationality: profile?.nationality || "",
    occupation: profile?.occupation || "",
    employer: profile?.employer || "",
    company_name: profile?.company?.name || "",
    country_of_residence: profile?.country_of_residence || "",
    address_line_1: profile?.address?.line_1 || "",
    address_line_2: profile?.address?.line_2 || "",
    city: profile?.address?.city || "",
    state_province: profile?.address?.state_province || "",
    postal_code: profile?.address?.postal_code || "",
    country: profile?.address?.country || "",
    source_of_funds: profile?.source_of_funds || "",
    trading_experience: profile?.trading?.experience || "",
    risk_tolerance: profile?.trading?.risk_tolerance || "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  const updateField =
    (key: keyof typeof personal) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setPersonal((f) => ({ ...f, [key]: e.target.value }));

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await userApi.updateMyProfile(personal);
      await refreshUser();
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "We couldn't update your profile."));
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      toast.error("New passwords don't match.");
      return;
    }
    setSavingPassword(true);
    try {
      await authApi.changePassword(passwords.current, passwords.next);
      toast.success("Password updated.");
      setPasswords({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast.error(apiErrorMessage(err, "We couldn't update your password."));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleVerifyEmail = async () => {
    setVerifyingEmail(true);
    try {
      await authApi.verifyEmail();
      await refreshUser();
      toast.success("Verification email sent.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setVerifyingEmail(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Profile & settings"
        description="Manage your identity, contact details, and security preferences."
      />

      <div className="mb-6 flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary font-mono-num text-lg font-semibold text-primary-foreground">
          {initials(user?.first_name, user?.last_name)}
        </span>
        <div>
          <p className="font-display text-lg font-semibold">
            {user?.full_name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{humanize(user?.role)}</Badge>
            <Badge
              variant="outline"
              className={
                user?.is_kyc_approved
                  ? "border-gain/30 text-gain"
                  : "border-amber-500/30 text-amber-600 dark:text-amber-400"
              }
            >
              {user?.is_kyc_approved ? "KYC verified" : "KYC pending"}
            </Badge>
            {!user?.is_email_verified && (
              <Badge
                variant="outline"
                className="border-amber-500/30 text-amber-600 dark:text-amber-400"
              >
                Email unverified
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personal details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>First name</Label>
                  <Input
                    value={personal.first_name}
                    onChange={updateField("first_name")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name</Label>
                  <Input
                    value={personal.last_name}
                    onChange={updateField("last_name")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Middle name</Label>
                  <Input
                    value={personal.middle_name}
                    onChange={updateField("middle_name")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone number</Label>
                  <Input
                    value={personal.phone_number}
                    onChange={updateField("phone_number")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nationality (ISO code)</Label>
                  <Input
                    value={personal.nationality}
                    onChange={updateField("nationality")}
                    placeholder="USA"
                    maxLength={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Country of residence</Label>
                  <Input
                    value={personal.country_of_residence}
                    onChange={updateField("country_of_residence")}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Address</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Address line 1</Label>
                  <Input
                    value={personal.address_line_1}
                    onChange={updateField("address_line_1")}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Address line 2</Label>
                  <Input
                    value={personal.address_line_2}
                    onChange={updateField("address_line_2")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input value={personal.city} onChange={updateField("city")} />
                </div>
                <div className="space-y-1.5">
                  <Label>State / province</Label>
                  <Input
                    value={personal.state_province}
                    onChange={updateField("state_province")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Postal code</Label>
                  <Input
                    value={personal.postal_code}
                    onChange={updateField("postal_code")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Input
                    value={personal.country}
                    onChange={updateField("country")}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Employment &amp; trading profile
                </CardTitle>
                <CardDescription>
                  Used for suitability and KYC risk assessment.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Occupation</Label>
                  <Input
                    value={personal.occupation}
                    onChange={updateField("occupation")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Employer</Label>
                  <Input
                    value={personal.employer}
                    onChange={updateField("employer")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Company name{" "}
                    <span className="text-muted-foreground">
                      (corporate accounts)
                    </span>
                  </Label>
                  <Input
                    value={personal.company_name}
                    onChange={updateField("company_name")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Source of funds</Label>
                  <Input
                    value={personal.source_of_funds}
                    onChange={updateField("source_of_funds")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Trading experience</Label>
                  <Select
                    value={personal.trading_experience}
                    onValueChange={(v) =>
                      setPersonal((f) => ({ ...f, trading_experience: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Risk tolerance</Label>
                  <Select
                    value={personal.risk_tolerance}
                    onValueChange={(v) =>
                      setPersonal((f) => ({ ...f, risk_tolerance: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tolerance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="aggressive">Aggressive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="security" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" /> Email verification
              </CardTitle>
              <CardDescription>{user?.email}</CardDescription>
            </CardHeader>
            <CardContent>
              {user?.is_email_verified ? (
                <p className="flex items-center gap-1.5 text-sm text-gain">
                  <ShieldCheck className="h-4 w-4" /> Your email is verified.
                </p>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleVerifyEmail}
                  disabled={verifyingEmail}
                >
                  {verifyingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Send verification email"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change password</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handlePasswordSubmit}
                className="max-w-sm space-y-4"
              >
                <div className="space-y-1.5">
                  <Label>Current password</Label>
                  <Input
                    type="password"
                    value={passwords.current}
                    onChange={(e) =>
                      setPasswords((p) => ({ ...p, current: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>New password</Label>
                  <Input
                    type="password"
                    value={passwords.next}
                    onChange={(e) =>
                      setPasswords((p) => ({ ...p, next: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm new password</Label>
                  <Input
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) =>
                      setPasswords((p) => ({ ...p, confirm: e.target.value }))
                    }
                    required
                  />
                </div>
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Update password"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Profile;
