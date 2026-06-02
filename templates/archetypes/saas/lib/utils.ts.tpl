// Shared utilities for ${project.name}.
//
// `cn` is the standard shadcn/ui class-name merge helper (the design-system payload
// and components.json alias @/lib/utils -> this file). It merges conditional class
// lists and resolves Tailwind conflicts. Keep tiny, dependency-light helpers here.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
