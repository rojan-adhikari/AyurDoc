import { DOCTORS } from "./doctor-directory";
import type { AppRole } from "./session";

export const DEMO_PATIENTS = [
  "patient",
  "rojan",
  "karan",
  "sachin",
  "gaurav",
  "deepak",
  "dharani",
] as const;

export type DemoAccount = {
  username: string;
  password: string;
  role: AppRole;
  displayName: string;
  doctorId?: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  ...DEMO_PATIENTS.map((username) => ({
    username,
    password: "123456",
    role: "patient" as const,
    displayName: username === "patient" ? "Demo Patient" : `${username[0].toUpperCase()}${username.slice(1)}`,
  })),
  {
    username: "doctor",
    password: "123456",
    role: "doctor",
    displayName: "Doctor Supervisor",
  },
  ...DOCTORS.map((doctor) => ({
    username: doctor.username,
    password: "123456",
    role: "doctor" as const,
    displayName: doctor.name,
    doctorId: doctor.id,
  })),
  {
    username: "admin",
    password: "123456",
    role: "admin",
    displayName: "AyurDoc Administrator",
  },
];

export function demoAccountFor(username: string) {
  const normalized = username.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((account) => account.username === normalized);
}

export const RESERVED_USERNAMES = new Set(
  DEMO_ACCOUNTS.map((account) => account.username),
);
