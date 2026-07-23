import { z } from "zod";

export const identifierSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "Invalid identifier");
