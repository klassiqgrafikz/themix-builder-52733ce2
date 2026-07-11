import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Briefcase,
  Building2,
  Check,
  GraduationCap,
  Landmark,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { getPublishedBank } from "@/lib/website/registry.functions";
import { registerCustomer } from "@/lib/customer/customer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/banks/$slug/register")({
  loader: async ({ params }) => {
    const bank = await getPublishedBank({ data: { slug: params.slug } });
    if (!bank) throw notFound();
    return { bank };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Open an account — ${loaderData.bank.manifest.bank.name}`
          : "Open an account",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegisterWizard,
});

type AccountTypeKey =
  | "personal"
  | "savings"
  | "current"
  | "business"
  | "joint"
  | "student";

const ACCOUNT_TYPES: {
  key: AccountTypeKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: "personal",
    label: "Personal Account",
    description: "Everyday banking for individuals.",
    icon: UserRound,
  },
  {
    key: "savings",
    label: "Savings Account",
    description: "Grow your money with competitive rates.",
    icon: Wallet,
  },
  {
    key: "current",
    label: "Current Account",
    description: "Daily transactions with a debit card.",
    icon: Landmark,
  },
  {
    key: "business",
    label: "Business Account",
    description: "For registered businesses and companies.",
    icon: Building2,
  },
  {
    key: "joint",
    label: "Joint Account",
    description: "Manage money together with a partner.",
    icon: Users,
  },
  {
    key: "student",
    label: "Student Account",
    description: "Fee-friendly account for students.",
    icon: GraduationCap,
  },
];

type FormShape = {
  account_type: AccountTypeKey;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  email: string;
  phone: string;
  nationality: string;
  id_document_type: string;
  id_document_number: string;
  id_document_country: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  employment_status: string;
  employer_name: string;
  job_title: string;
  annual_income: string;
  next_of_kin_name: string;
  next_of_kin_relationship: string;
  next_of_kin_phone: string;
  next_of_kin_email: string;
  password: string;
  confirm_password: string;
};

const emptyForm: FormShape = {
  account_type: "personal",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  email: "",
  phone: "",
  nationality: "",
  id_document_type: "",
  id_document_number: "",
  id_document_country: "",
  address: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  employment_status: "",
  employer_name: "",
  job_title: "",
  annual_income: "",
  next_of_kin_name: "",
  next_of_kin_relationship: "",
  next_of_kin_phone: "",
  next_of_kin_email: "",
  password: "",
  confirm_password: "",
};

const STEPS = [
  { key: "type", label: "Account type", icon: Sparkles },
  { key: "identity", label: "Identity", icon: User },
  { key: "address", label: "Address", icon: Landmark },
  { key: "employment", label: "Employment", icon: Briefcase },
  { key: "kin", label: "Next of kin", icon: Users },
  { key: "review", label: "Review", icon: ShieldCheck },
] as const;

function RegisterWizard() {
  const { bank } = Route.useLoaderData();
  const m = bank.manifest;
  const theme = m.theme;
  const isDark = theme.dark_mode;
  const surface = isDark ? "#111827" : "#ffffff";
  const bg = isDark ? "#0b1120" : "#f6f7fb";
  const text = isDark ? "#e2e8f0" : "#0f172a";
  const muted = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#1f2937" : "#e2e8f0";

  const navigate = useNavigate();
  const doRegister = useServerFn(registerCustomer);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormShape>(emptyForm);
  const [result, setResult] = useState<{
    customer_number: string;
    account_number: string;
  } | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      doRegister({
        data: {
          slug: bank.slug,
          account_type: form.account_type,
          first_name: form.first_name,
          last_name: form.last_name,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          email: form.email,
          phone: form.phone || null,
          nationality: form.nationality || null,
          id_document_type: form.id_document_type || null,
          id_document_number: form.id_document_number || null,
          id_document_country: form.id_document_country || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          postal_code: form.postal_code || null,
          country: form.country || null,
          employment_status: form.employment_status || null,
          employer_name: form.employer_name || null,
          job_title: form.job_title || null,
          annual_income: form.annual_income ? Number(form.annual_income) : null,
          next_of_kin_name: form.next_of_kin_name || null,
          next_of_kin_relationship: form.next_of_kin_relationship || null,
          next_of_kin_phone: form.next_of_kin_phone || null,
          next_of_kin_email: form.next_of_kin_email || null,
          password: form.password,
          confirm_password: form.confirm_password,
        },
      }),
    onSuccess: (r) => {
      setResult({ customer_number: r.customer_number, account_number: r.account_number });
      toast.success("Account created successfully.", {
        description: `Customer ${r.customer_number} · Account ${r.account_number}`,
      });
      // Automatically redirect to the customer login page after a brief pause
      // so the user can see the confirmation before signing in.
      setTimeout(() => {
        navigate({ to: "/banks/$slug/login", params: { slug: bank.slug } });
      }, 1500);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Registration failed";
      console.error("[register] pipeline failed:", e);
      toast.error(msg);
    },
  });

  const update =
    <K extends keyof FormShape>(k: K) =>
    (v: FormShape[K]) =>
      setForm((s) => ({ ...s, [k]: v }));

  const stepErrors = useMemo(() => validateStep(step, form), [step, form]);

  const next = () => {
    if (stepErrors.length > 0) {
      toast.error(stepErrors[0]);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  if (result) {
    return (
      <SuccessScreen
        bank={bank}
        result={result}
        theme={theme}
        surface={surface}
        muted={muted}
        border={border}
        onGoToLogin={() =>
          navigate({ to: "/banks/$slug/login", params: { slug: bank.slug } })
        }
      />
    );
  }

  const StepIcon = STEPS[step].icon;

  return (
    <div
      className="min-h-screen p-4"
      style={{ backgroundColor: bg, color: text, fontFamily: theme.typography.body }}
    >
      <div className="mx-auto max-w-5xl py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/banks/$slug"
            params={{ slug: bank.slug }}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: theme.colors.primary }}
          >
            ← Back to {m.bank.name}
          </Link>
          <Link
            to="/banks/$slug/login"
            params={{ slug: bank.slug }}
            className="text-sm underline"
            style={{ color: muted }}
          >
            Already have an account?
          </Link>
        </div>

        <header className="mb-8 text-center">
          {m.brand.login_logo_url && (
            <img
              src={m.brand.login_logo_url}
              alt=""
              className="mx-auto mb-4 h-16 w-16 rounded-xl object-contain"
            />
          )}
          <p
            className="text-xs uppercase tracking-[0.2em]"
            style={{ color: theme.colors.accent }}
          >
            Open an account
          </p>
          <h1
            className="mt-2 text-3xl font-bold sm:text-4xl"
            style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
          >
            Welcome to {m.bank.name}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: muted }}>
            It only takes a few minutes. Your details are isolated to {m.bank.name} and never
            shared with other banks on TheMixWeb.
          </p>
        </header>

        <StepBar current={step} theme={theme} muted={muted} border={border} />

        <div
          className="mt-8 rounded-3xl p-6 sm:p-10"
          style={{ backgroundColor: surface, border: `1px solid ${border}` }}
        >
          <div className="mb-6 flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-white"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
              }}
            >
              <StepIcon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-widest" style={{ color: muted }}>
                Step {step + 1} of {STEPS.length}
              </div>
              <div
                className="text-lg font-semibold"
                style={{ fontFamily: theme.typography.heading, color: text }}
              >
                {STEPS[step].label}
              </div>
            </div>
          </div>

          {step === 0 && (
            <AccountTypeStep
              value={form.account_type}
              onChange={update("account_type")}
              theme={theme}
              border={border}
              muted={muted}
              surface={surface}
            />
          )}
          {step === 1 && <IdentityStep form={form} onChange={update} muted={muted} />}
          {step === 2 && <AddressStep form={form} onChange={update} muted={muted} />}
          {step === 3 && <EmploymentStep form={form} onChange={update} muted={muted} />}
          {step === 4 && <NextOfKinStep form={form} onChange={update} muted={muted} />}
          {step === 5 && (
            <ReviewStep
              form={form}
              onChange={update}
              muted={muted}
              theme={theme}
              border={border}
            />
          )}

          <div
            className="mt-8 flex flex-col-reverse items-stretch gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: border }}
          >
            <Button type="button" variant="outline" onClick={back} disabled={step === 0}>
              ← Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={next}
                style={{ backgroundColor: theme.colors.accent }}
                className="text-white"
              >
                Continue →
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  if (stepErrors.length > 0) {
                    toast.error(stepErrors[0]);
                    return;
                  }
                  mut.mutate();
                }}
                disabled={mut.isPending}
                style={{ backgroundColor: theme.colors.accent }}
                className="text-white"
              >
                {mut.isPending ? "Creating account…" : "Confirm & open account"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBar({
  current,
  theme,
  muted,
  border,
}: {
  current: number;
  theme: import("@/lib/rendering/types").WebsiteManifest["theme"];
  muted: string;
  border: string;
}) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const active = i === current;
        const done = i < current;
        const bg = done ? theme.colors.primary : active ? theme.colors.accent : "transparent";
        const fg = done || active ? "#fff" : muted;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                backgroundColor: bg,
                color: fg,
                border: done || active ? "none" : `1px solid ${border}`,
              }}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className="hidden text-xs font-medium sm:inline"
              style={{ color: active ? theme.colors.primary : muted }}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="hidden h-px w-6 sm:inline-block"
                style={{ backgroundColor: border }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function AccountTypeStep({
  value,
  onChange,
  theme,
  border,
  muted,
  surface,
}: {
  value: AccountTypeKey;
  onChange: (v: AccountTypeKey) => void;
  theme: import("@/lib/rendering/types").WebsiteManifest["theme"];
  border: string;
  muted: string;
  surface: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ACCOUNT_TYPES.map((t) => {
        const selected = value === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className="rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
            style={{
              backgroundColor: surface,
              border: `2px solid ${selected ? theme.colors.primary : border}`,
              boxShadow: selected ? `0 0 0 4px ${theme.colors.primary}22` : undefined,
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${theme.colors.primary}15`,
                  color: theme.colors.primary,
                }}
              >
                <Icon className="h-5 w-5" />
              </span>
              {selected && (
                <Check className="h-5 w-5" style={{ color: theme.colors.primary }} />
              )}
            </div>
            <div
              className="mt-4 text-base font-semibold"
              style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
            >
              {t.label}
            </div>
            <p className="mt-1 text-sm" style={{ color: muted }}>
              {t.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

type UpdateFn = <K extends keyof FormShape>(k: K) => (v: FormShape[K]) => void;

function IdentityStep({
  form,
  onChange,
  muted,
}: {
  form: FormShape;
  onChange: UpdateFn;
  muted: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="First name" required>
        <Input
          value={form.first_name}
          onChange={(e) => onChange("first_name")(e.target.value)}
        />
      </Field>
      <Field label="Last name" required>
        <Input
          value={form.last_name}
          onChange={(e) => onChange("last_name")(e.target.value)}
        />
      </Field>
      <Field label="Date of birth" required>
        <Input
          type="date"
          value={form.date_of_birth}
          onChange={(e) => onChange("date_of_birth")(e.target.value)}
        />
      </Field>
      <Field label="Gender">
        <SelectField
          value={form.gender}
          onChange={onChange("gender")}
          options={["Female", "Male", "Non-binary", "Prefer not to say"]}
        />
      </Field>
      <Field label="Email" required>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => onChange("email")(e.target.value)}
        />
      </Field>
      <Field label="Phone number" required>
        <Input value={form.phone} onChange={(e) => onChange("phone")(e.target.value)} />
      </Field>
      <Field label="Nationality">
        <Input
          value={form.nationality}
          onChange={(e) => onChange("nationality")(e.target.value)}
        />
      </Field>
      <Field label="ID document type" required>
        <SelectField
          value={form.id_document_type}
          onChange={onChange("id_document_type")}
          options={["Passport", "National ID", "Driver's licence", "Residence permit"]}
        />
      </Field>
      <Field label="ID document number" required>
        <Input
          value={form.id_document_number}
          onChange={(e) => onChange("id_document_number")(e.target.value)}
        />
      </Field>
      <Field label="ID issuing country">
        <Input
          value={form.id_document_country}
          onChange={(e) => onChange("id_document_country")(e.target.value)}
        />
      </Field>
      <p className="text-xs sm:col-span-2" style={{ color: muted }}>
        Your identification is used for KYC/AML verification and is never shared with other
        banks on the platform.
      </p>
    </div>
  );
}

function AddressStep({
  form,
  onChange,
  muted,
}: {
  form: FormShape;
  onChange: UpdateFn;
  muted: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Residential address" required className="sm:col-span-2">
        <Input value={form.address} onChange={(e) => onChange("address")(e.target.value)} />
      </Field>
      <Field label="City" required>
        <Input value={form.city} onChange={(e) => onChange("city")(e.target.value)} />
      </Field>
      <Field label="State / Province">
        <Input value={form.state} onChange={(e) => onChange("state")(e.target.value)} />
      </Field>
      <Field label="Postal / ZIP code">
        <Input
          value={form.postal_code}
          onChange={(e) => onChange("postal_code")(e.target.value)}
        />
      </Field>
      <Field label="Country of residence" required>
        <Input value={form.country} onChange={(e) => onChange("country")(e.target.value)} />
      </Field>
      <p className="text-xs sm:col-span-2" style={{ color: muted }}>
        We use your address to verify residency and post physical correspondence, when
        applicable.
      </p>
    </div>
  );
}

function EmploymentStep({
  form,
  onChange,
  muted,
}: {
  form: FormShape;
  onChange: UpdateFn;
  muted: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Employment status" required>
        <SelectField
          value={form.employment_status}
          onChange={onChange("employment_status")}
          options={[
            "Employed",
            "Self-employed",
            "Business owner",
            "Student",
            "Retired",
            "Unemployed",
          ]}
        />
      </Field>
      <Field label="Employer / Company">
        <Input
          value={form.employer_name}
          onChange={(e) => onChange("employer_name")(e.target.value)}
        />
      </Field>
      <Field label="Job title">
        <Input
          value={form.job_title}
          onChange={(e) => onChange("job_title")(e.target.value)}
        />
      </Field>
      <Field label="Annual income">
        <Input
          type="number"
          min="0"
          value={form.annual_income}
          onChange={(e) => onChange("annual_income")(e.target.value)}
        />
      </Field>
      <p className="text-xs sm:col-span-2" style={{ color: muted }}>
        Employment information helps us tailor products, credit limits, and regulatory
        reporting to your profile.
      </p>
    </div>
  );
}

function NextOfKinStep({
  form,
  onChange,
  muted,
}: {
  form: FormShape;
  onChange: UpdateFn;
  muted: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Full name" required>
        <Input
          value={form.next_of_kin_name}
          onChange={(e) => onChange("next_of_kin_name")(e.target.value)}
        />
      </Field>
      <Field label="Relationship" required>
        <SelectField
          value={form.next_of_kin_relationship}
          onChange={onChange("next_of_kin_relationship")}
          options={[
            "Spouse",
            "Parent",
            "Sibling",
            "Child",
            "Guardian",
            "Friend",
            "Other",
          ]}
        />
      </Field>
      <Field label="Phone number" required>
        <Input
          value={form.next_of_kin_phone}
          onChange={(e) => onChange("next_of_kin_phone")(e.target.value)}
        />
      </Field>
      <Field label="Email address">
        <Input
          type="email"
          value={form.next_of_kin_email}
          onChange={(e) => onChange("next_of_kin_email")(e.target.value)}
        />
      </Field>
      <p className="text-xs sm:col-span-2" style={{ color: muted }}>
        Your next of kin is contacted only in exceptional circumstances such as account
        succession or emergency verification.
      </p>
    </div>
  );
}

function ReviewStep({
  form,
  onChange,
  muted,
  theme,
  border,
}: {
  form: FormShape;
  onChange: UpdateFn;
  muted: string;
  theme: import("@/lib/rendering/types").WebsiteManifest["theme"];
  border: string;
}) {
  const chosen = ACCOUNT_TYPES.find((t) => t.key === form.account_type);
  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-4"
        style={{
          border: `1px solid ${border}`,
          backgroundColor: `${theme.colors.primary}08`,
        }}
      >
        <div className="text-xs uppercase tracking-widest" style={{ color: theme.colors.accent }}>
          Selected account
        </div>
        <div
          className="mt-1 text-lg font-semibold"
          style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
        >
          {chosen?.label}
        </div>
        <p className="text-sm" style={{ color: muted }}>
          {chosen?.description}
        </p>
      </div>

      <ReviewGroup title="Personal">
        <ReviewRow label="Name" value={`${form.first_name} ${form.last_name}`.trim() || "—"} />
        <ReviewRow label="Date of birth" value={form.date_of_birth || "—"} />
        <ReviewRow label="Email" value={form.email || "—"} />
        <ReviewRow label="Phone" value={form.phone || "—"} />
      </ReviewGroup>

      <ReviewGroup title="Identity">
        <ReviewRow label="Document" value={form.id_document_type || "—"} />
        <ReviewRow label="Document #" value={form.id_document_number || "—"} />
        <ReviewRow label="Nationality" value={form.nationality || "—"} />
      </ReviewGroup>

      <ReviewGroup title="Address">
        <ReviewRow
          label="Address"
          value={
            [form.address, form.city, form.state, form.postal_code, form.country]
              .filter(Boolean)
              .join(", ") || "—"
          }
        />
      </ReviewGroup>

      <ReviewGroup title="Employment">
        <ReviewRow label="Status" value={form.employment_status || "—"} />
        <ReviewRow label="Employer" value={form.employer_name || "—"} />
        <ReviewRow label="Job title" value={form.job_title || "—"} />
        <ReviewRow
          label="Annual income"
          value={form.annual_income ? String(form.annual_income) : "—"}
        />
      </ReviewGroup>

      <ReviewGroup title="Next of kin">
        <ReviewRow label="Name" value={form.next_of_kin_name || "—"} />
        <ReviewRow label="Relationship" value={form.next_of_kin_relationship || "—"} />
        <ReviewRow label="Phone" value={form.next_of_kin_phone || "—"} />
      </ReviewGroup>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Create password" required>
          <Input
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => onChange("password")(e.target.value)}
          />
        </Field>
        <Field label="Confirm password" required>
          <Input
            type="password"
            minLength={8}
            value={form.confirm_password}
            onChange={(e) => onChange("confirm_password")(e.target.value)}
          />
        </Field>
        <p className="text-xs sm:col-span-2" style={{ color: muted }}>
          By confirming, you agree to open a {chosen?.label.toLowerCase()} and accept the terms
          of service and privacy policy of your bank.
        </p>
      </div>
    </div>
  );
}

function ReviewGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-80">
        {title}
      </h3>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="opacity-70">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>
        {label} {required ? <span className="text-red-500">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function validateStep(step: number, f: FormShape): string[] {
  const errors: string[] = [];
  if (step === 0) {
    if (!f.account_type) errors.push("Please choose an account type.");
  }
  if (step === 1) {
    if (!f.first_name.trim()) errors.push("First name is required.");
    if (!f.last_name.trim()) errors.push("Last name is required.");
    if (!f.date_of_birth) errors.push("Date of birth is required.");
    if (!z.string().email().safeParse(f.email).success)
      errors.push("A valid email is required.");
    if (!f.phone.trim()) errors.push("Phone number is required.");
    if (!f.id_document_type) errors.push("Choose an ID document type.");
    if (!f.id_document_number.trim()) errors.push("ID document number is required.");
  }
  if (step === 2) {
    if (!f.address.trim()) errors.push("Residential address is required.");
    if (!f.city.trim()) errors.push("City is required.");
    if (!f.country.trim()) errors.push("Country of residence is required.");
  }
  if (step === 3) {
    if (!f.employment_status) errors.push("Employment status is required.");
  }
  if (step === 4) {
    if (!f.next_of_kin_name.trim()) errors.push("Next of kin name is required.");
    if (!f.next_of_kin_relationship) errors.push("Next of kin relationship is required.");
    if (!f.next_of_kin_phone.trim()) errors.push("Next of kin phone is required.");
  }
  if (step === 5) {
    if (f.password.length < 8) errors.push("Password must be at least 8 characters.");
    if (f.password !== f.confirm_password) errors.push("Passwords do not match.");
  }
  return errors;
}

function SuccessScreen({
  bank,
  result,
  theme,
  surface,
  muted,
  border,
  onGoToLogin,
}: {
  bank: { slug: string; manifest: import("@/lib/rendering/types").WebsiteManifest };
  result: { customer_number: string; account_number: string };
  theme: import("@/lib/rendering/types").WebsiteManifest["theme"];
  surface: string;
  muted: string;
  border: string;
  onGoToLogin: () => void;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        backgroundColor: theme.dark_mode ? "#0b1120" : "#f6f7fb",
        color: theme.dark_mode ? "#e2e8f0" : "#0f172a",
        fontFamily: theme.typography.body,
      }}
    >
      <div
        className="w-full max-w-xl rounded-3xl p-8 text-center"
        style={{ backgroundColor: surface, border: `1px solid ${border}` }}
      >
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
          }}
        >
          <Check className="h-8 w-8" />
        </div>
        <h1
          className="mt-6 text-3xl font-bold"
          style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
        >
          Account created!
        </h1>
        <p className="mt-2 text-sm" style={{ color: muted }}>
          Welcome to {bank.manifest.bank.name}. Your account is ready to go.
        </p>

        <div
          className="mt-6 grid grid-cols-1 gap-3 rounded-2xl p-4 text-left sm:grid-cols-2"
          style={{ border: `1px solid ${border}` }}
        >
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: muted }}>
              Customer number
            </div>
            <div className="mt-1 font-mono text-base">{result.customer_number}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: muted }}>
              Account number
            </div>
            <div className="mt-1 font-mono text-base">{result.account_number}</div>
          </div>
        </div>

        <div
          className="mt-6 flex items-start gap-3 rounded-2xl p-4 text-left text-sm"
          style={{
            backgroundColor: `${theme.colors.accent}12`,
            border: `1px dashed ${theme.colors.accent}55`,
            color: theme.dark_mode ? "#e2e8f0" : "#0f172a",
          }}
        >
          <Mail className="mt-0.5 h-5 w-5 shrink-0" style={{ color: theme.colors.accent }} />
          <div>
            <div className="font-semibold">Welcome email sent</div>
            <p className="mt-1" style={{ color: muted }}>
              A welcome message with your account details has been delivered to your inbox
              (simulated). You'll also find it in your notifications after signing in.
            </p>
          </div>
        </div>

        <Button
          className="mt-8 w-full text-white"
          style={{ backgroundColor: theme.colors.accent }}
          onClick={onGoToLogin}
        >
          Continue to sign in
        </Button>
        <Link
          to="/banks/$slug"
          params={{ slug: bank.slug }}
          className="mt-3 inline-block text-sm underline"
          style={{ color: muted }}
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
