const REPEATED_DIGITS = /^(\d)\1{9}$/;
const COMMON_FAKE_NUMBERS = new Set(["1234567890", "9876543210", "0123456789"]);

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function isValidPhoneNumber(value: string) {
  const phone = normalizePhone(value);
  return (
    /^[6-9]\d{9}$/.test(phone) &&
    !REPEATED_DIGITS.test(phone) &&
    !COMMON_FAKE_NUMBERS.has(phone)
  );
}

export function phoneValidationMessage(value: string) {
  if (!value) return "Enter a mobile number.";
  if (!/^\d{10}$/.test(normalizePhone(value)))
    return "Enter exactly 10 digits.";
  if (!/^[6-9]/.test(value))
    return "Indian mobile numbers must begin with 6, 7, 8 or 9.";
  if (REPEATED_DIGITS.test(value) || COMMON_FAKE_NUMBERS.has(value))
    return "Enter a real mobile number; repeated or test sequences are not accepted.";
  return "Enter a valid mobile number.";
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidGmailAddress(value: string) {
  const email = normalizeEmail(value);
  if (email.length > 254) return false;
  const [local, domain, extra] = email.split("@");
  return (
    !extra &&
    domain === "gmail.com" &&
    Boolean(local) &&
    local.length <= 64 &&
    /^[a-z0-9]+(?:[a-z0-9._%+-]*[a-z0-9])?$/.test(local) &&
    !local.includes("..")
  );
}

export function gmailValidationMessage(value: string) {
  if (!value.trim()) return "Enter your Gmail address.";
  if (!value.includes("@")) return "Enter the complete Gmail address.";
  if (!normalizeEmail(value).endsWith("@gmail.com"))
    return "Use an address ending in @gmail.com.";
  return "Enter a valid Gmail address.";
}

export function isValidUsername(value: string) {
  return /^[a-z][a-z0-9._-]{2,23}$/.test(value.trim().toLowerCase());
}

export function isStrongPassword(value: string) {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}
