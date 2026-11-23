import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合併 Tailwind CSS 類別的工具函式
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
