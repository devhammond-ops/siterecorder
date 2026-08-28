import { Dancing_Script } from "next/font/google";
import { initialsFromName } from "@/lib/profile";
import { cn } from "@/lib/utils";

const signatureFont = Dancing_Script({
  subsets: ["latin"],
  weight: ["700"],
});

interface Props {
  fullName: string;
  className?: string;
}

/** Auto-generated cursive initials preview from the user's full name. */
export function SignaturePreview({ fullName, className }: Props) {
  const initials = initialsFromName(fullName);

  return (
    <div
      className={cn(
        "flex min-h-[5rem] items-center justify-center rounded-lg border border-dashed bg-muted/40 px-6 py-4",
        className
      )}
    >
      <span
        className={cn(signatureFont.className, "text-5xl text-foreground sm:text-6xl")}
        aria-label={`Signature initials ${initials}`}
      >
        {initials}
      </span>
    </div>
  );
}
