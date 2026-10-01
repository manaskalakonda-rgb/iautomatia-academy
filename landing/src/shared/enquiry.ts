// Enquiry form rules shared by the browser and the server, so both validate the same way.
// Keep this file free of DOM and Node APIs.

export const PROGRAMS = ["Foundation", "Integrator", "Specialist", "Not sure"] as const;
export const STATUSES = ["Student", "Working professional"] as const;

export type Program = (typeof PROGRAMS)[number];
export type Status = (typeof STATUSES)[number];

export interface EnquiryInput {
  name: string;
  phone: string;
  email: string;
  program: string;
  status: string;
}

export interface Enquiry {
  name: string;
  phone: string; // normalised to +91XXXXXXXXXX
  email: string; // lower-cased
  program: Program;
  status: Status;
}

export type EnquiryField = keyof EnquiryInput;
export type FieldErrors = Partial<Record<EnquiryField, string>>;

export type ValidationResult =
  | { ok: true; value: Enquiry }
  | { ok: false; errors: FieldErrors };

export const MAX_LENGTH = { name: 80, email: 120 } as const;

const NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;
// Indian mobile: optional +91 / 91 / 0 prefix, then 10 digits starting 6-9.
const PHONE_RE = /^(?:\+91|91|0)?([6-9]\d{9})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateName(value: string): string {
  const v = value.trim();
  if (!v) return "Please enter your name.";
  if (v.length < 2) return "Name looks too short.";
  if (v.length > MAX_LENGTH.name) return "Name is too long.";
  if (!NAME_RE.test(v)) return "Please use letters only.";
  return "";
}

export function validatePhone(value: string): string {
  const digits = value.replace(/[\s-]/g, "");
  if (!digits) return "Please enter your mobile number.";
  if (!PHONE_RE.test(digits)) return "Enter a valid 10-digit Indian mobile number.";
  return "";
}

export function validateEmail(value: string): string {
  const v = value.trim();
  if (!v) return "Please enter your email.";
  if (v.length > MAX_LENGTH.email) return "Email is too long.";
  if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
  return "";
}

export function validateProgram(value: string): string {
  if (!value) return "Please choose a program.";
  return (PROGRAMS as readonly string[]).includes(value) ? "" : "Please choose a program from the list.";
}

export function validateStatus(value: string): string {
  if (!value) return "Please tell us if you are a student or a working professional.";
  return (STATUSES as readonly string[]).includes(value) ? "" : "Please choose student or working professional.";
}

export const FIELD_VALIDATORS: Record<EnquiryField, (value: string) => string> = {
  name: validateName,
  phone: validatePhone,
  email: validateEmail,
  program: validateProgram,
  status: validateStatus,
};

export function normalisePhone(value: string): string {
  const match = PHONE_RE.exec(value.replace(/[\s-]/g, ""));
  return match ? "+91" + match[1] : value;
}

/** Validates untrusted input (e.g. a request body) and returns a clean enquiry or field errors. */
export function validateEnquiry(input: unknown): ValidationResult {
  const data = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const str = (key: EnquiryField): string => (typeof data[key] === "string" ? (data[key] as string) : "");

  const errors: FieldErrors = {};
  (Object.keys(FIELD_VALIDATORS) as EnquiryField[]).forEach((field) => {
    const message = FIELD_VALIDATORS[field](str(field));
    if (message) errors[field] = message;
  });

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name: str("name").trim().replace(/\s+/g, " "),
      phone: normalisePhone(str("phone")),
      email: str("email").trim().toLowerCase(),
      program: str("program") as Program,
      status: str("status") as Status,
    },
  };
}
