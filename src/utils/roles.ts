import type { UserRole } from "../types";

export const ROLE_OPTIONS: UserRole[] = [
  "admin",
  "editor",
  "picker",
  "packer",
  "summarizer",
];

export function roleLabelKey(role: UserRole) {
  switch (role) {
    case "admin":
      return "auth.roleAdmin";
    case "editor":
      return "auth.roleEditor";
    case "picker":
      return "auth.rolePicker";
    case "packer":
      return "auth.rolePacker";
    case "summarizer":
      return "auth.roleSummarizer";
  }
}

export function homeForRole(role: UserRole) {
  switch (role) {
    case "admin":
      return "/ingredients";
    case "editor":
      return "/orders";
    case "picker":
      return "/pickups";
    case "packer":
      return "/packing";
    case "summarizer":
      return "/summary";
  }
}
