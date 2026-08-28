import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage() {
  const user = await requireUser();
  if (!user.profile) {
    return (
      <p className="text-sm text-muted-foreground">
        Profile not found. Try signing out and back in.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <ProfileForm profile={user.profile} email={user.email} />
    </div>
  );
}
