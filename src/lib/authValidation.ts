export type ValidationErrors<T extends string> = Partial<Record<T, string>>;

const namePattern = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const emailLocalPattern = /^[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*$/;
const emailDomainLabelPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const emailTldPattern = /^[A-Za-z]{2,24}$/;
const commonEmailDomainTypos = new Map([
  ["gmail.clm", "gmail.com"],
  ["gmail.con", "gmail.com"],
  ["gamil.com", "gmail.com"],
  ["gmial.com", "gmail.com"],
  ["gmai.com", "gmail.com"],
  ["hotmial.com", "hotmail.com"],
  ["outlok.com", "outlook.com"],
  ["yaho.com", "yahoo.com"],
]);

export const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");
export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const validateName = (value: string) => {
  const name = normalizeName(value);
  if (!name) return "Enter your full name.";
  if (!namePattern.test(name)) return "Use letters and spaces only.";
  if (name.replace(/\s/g, "").length < 2) return "Name must be at least 2 letters.";
  return "";
};

export const validateEmail = (value: string) => {
  const email = normalizeEmail(value);
  if (!email) return "Enter your email address.";
  if (/\s/.test(email)) return "Email cannot contain spaces.";

  const parts = email.split("@");
  if (parts.length !== 2) return "Enter a valid email address.";

  const [local, domain] = parts;
  if (!local || !domain) return "Enter a valid email address.";
  if (!emailLocalPattern.test(local)) return "Use only letters, numbers, and dots before @.";

  const labels = domain.split(".");
  if (labels.length < 2) return "Enter a valid email address.";
  if (commonEmailDomainTypos.has(domain)) return `Did you mean ${commonEmailDomainTypos.get(domain)}?`;
  if (!labels.every((label) => emailDomainLabelPattern.test(label))) return "Enter a valid email address.";
  if (!emailTldPattern.test(labels[labels.length - 1])) return "Enter a valid email address.";

  return "";
};

export const validateRequiredPassword = (value: string) => {
  if (!value) return "Enter your password.";
  return "";
};

export const validateNewPassword = (value: string) => {
  if (!value) return "Enter a password.";
  if (value.length < 6) return "Password must be at least 6 characters.";
  return "";
};

export const validateConfirmPassword = (password: string, confirmPassword: string) => {
  if (!confirmPassword) return "Confirm your password.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return "";
};

export const hasValidationErrors = <T extends string>(errors: ValidationErrors<T>) =>
  Object.values(errors).some(Boolean);
