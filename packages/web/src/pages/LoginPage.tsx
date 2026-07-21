import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { EyeIcon, EyeOffIcon, GithubIcon, LogoMark } from "../components/icons.js";
import { LoadingScreen } from "../components/LoadingScreen.js";
import { useAuth } from "../lib/auth.js";

/** Official multicolor Google "G". Brand mark — do not re-ink. */
function GoogleLogo() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.96H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l4.01-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4.01 3.1C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}

// The border, radius, and background live on a WRAPPER that clips its contents
// (overflow-hidden). The <input> itself is square and transparent, so Chrome's
// autofill background — which the box-shadow hack can only repaint as a
// rectangle, leaking white at rounded corners — is clipped to the rounded shape
// by the wrapper instead. Keyboard focus rings on the wrapper, not the input,
// so overflow-hidden doesn't clip them.
const fieldWrap =
  "flex items-stretch rounded-lg border border-hair bg-raise overflow-hidden transition duration-200 " +
  "focus-within:border-accent focus-within:bg-surface";
const fieldInput =
  "w-full bg-transparent px-3 py-2.5 text-ink text-sm placeholder:text-muted focus:outline-none focus-visible:outline-none";
const labelCls = "block text-xs font-medium text-muted mb-1.5";

interface TextFieldProps {
  id: string;
  name: string;
  label: string;
  type?: string;
  autoComplete: string;
}

function TextField({ id, name, label, type = "text", autoComplete }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className={fieldWrap}>
        <input id={id} name={name} type={type} autoComplete={autoComplete} required className={fieldInput} />
      </div>
    </div>
  );
}

/** Password field with a reveal toggle. Uncontrolled — value is read from the
 *  form on submit, only the visibility is stateful. */
function PasswordField({ id, name, label, autoComplete }: Omit<TextFieldProps, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className={fieldWrap}>
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className={fieldInput}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="shrink-0 inline-flex items-center justify-center pl-1 pr-3 text-muted/60 hover:text-ink transition-colors duration-200"
        >
          {visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
        </button>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const rawReturnTo = searchParams.get("return_to") || "/";
  const returnTo = /^\/(?![/\\])/.test(rawReturnTo) ? rawReturnTo : "/";

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to={returnTo} replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-app text-ink px-6">
      <div className="pi-rise w-full max-w-sm space-y-6 py-10">
        <div className="text-center space-y-3">
          <LogoMark size={28} className="mx-auto text-ink" />
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {isSignUp ? "Create your account" : "Sign in to pipeit"}
          </h1>
          <p className="text-sm text-muted">Your piped docs, on any device.</p>
        </div>
        <div className="space-y-3">
          <a
            href={`/auth/google${returnTo !== "/" ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`}
            className="flex w-full items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg bg-surface border border-hair text-ink text-sm font-medium hover:bg-raise active:scale-[0.99] transition duration-200"
          >
            <GoogleLogo />
            Continue with Google
          </a>
          <a
            href={`/auth/github${returnTo !== "/" ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`}
            className="flex w-full items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg bg-ink text-app text-sm font-medium hover:opacity-90 active:scale-[0.99] transition duration-200"
          >
            <GithubIcon />
            Continue with GitHub
          </a>
        </div>
        <div className="flex items-center gap-3 text-muted text-xs">
          <div className="flex-1 h-px bg-hair" />
          <span>or with email</span>
          <div className="flex-1 h-px bg-hair" />
        </div>
        <form
          key={isSignUp ? "signup" : "signin"}
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const form = new FormData(e.currentTarget);
            if (isSignUp && form.get("password") !== form.get("confirm")) {
              setError("Passwords don't match.");
              return;
            }
            setSubmitting(true);
            try {
              const endpoint = isSignUp ? "/auth/email/signup" : "/auth/email/login";
              const body: Record<string, unknown> = { email: form.get("email"), password: form.get("password") };
              if (isSignUp) body.name = form.get("name");
              const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body),
              });
              if (res.ok) {
                const data = await res.json().catch(() => ({}));
                window.location.href = data.redirect || returnTo;
              } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Something went wrong. Please try again.");
              }
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {isSignUp && <TextField id="login-name" name="name" label="Name" autoComplete="name" />}
          <TextField id="login-email" name="email" label="Email" type="email" autoComplete="email" />
          <PasswordField
            id="login-password"
            name="password"
            label="Password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />
          {isSignUp && (
            <PasswordField id="login-confirm" name="confirm" label="Confirm password" autoComplete="new-password" />
          )}
          {error && <p className="text-bad text-sm bg-bad/10 border border-bad/30 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-accent text-on-accent text-sm font-semibold hover:opacity-90 active:scale-[0.99] disabled:opacity-60 transition duration-200"
          >
            {submitting ? "One moment…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-muted">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="text-accent hover:opacity-80 font-medium transition"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
