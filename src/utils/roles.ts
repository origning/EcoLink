import type { UserRole } from "../types";

export const ROLE_OPTIONS: UserRole[] = [
  "admin",
  "editor",
  "uploader",
  "summarizer",
];

export function roleLabelKey(role: UserRole) {
  switch (role) {
    case "admin":
      return "auth.roleAdmin";
    case "editor":
      return "auth.roleEditor";
    case "uploader":
    case "picker":
    case "packer":
      return "auth.roleUploader";
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
    case "uploader":
    case "picker":
    case "packer":
      return "/upload";
    case "summarizer":
      return "/summary";
  }
}
