import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <SignUp
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
