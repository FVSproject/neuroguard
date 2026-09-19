import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <SignIn
        appearance={{
          elements: {
            card: "shadow-lg border border-border bg-surface",
            formButtonPrimary: "bg-brand hover:bg-brand-strong",
          },
        }}
      />
    </div>
  );
}
