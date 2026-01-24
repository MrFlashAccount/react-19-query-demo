/**
 * @file
 *
 * Minimal authentication-related schemas used by component stories.
 * This example no longer includes the full auth pages, but some stories still
 * reference a password schema helper.
 */

import { z } from "zod";

export type GetText = (key: string, ...args: string[]) => string;

export function passwordSchema(getText: GetText) {
  return z
    .string()
    .min(8, { message: getText("passwordTooShort", "8") })
    .regex(/[A-Za-z]/, { message: getText("passwordMustContainLetters") })
    .regex(/[0-9]/, { message: getText("passwordMustContainNumbers") });
}
