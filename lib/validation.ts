import { z } from "zod";
import { CATALOG } from "./catalog";

const categories = [...new Set(CATALOG.map((s) => s.category))] as [string, ...string[]];

/**
 * One definition, used by the form and by the route handler. A second copy on the server would
 * drift from the client one within a week.
 */
export const inquirySchema = z.object({
  firstName: z.string().trim().min(1, "Please add your first name"),
  lastName: z.string().trim().min(1, "Please add your last name"),
  phone: z.string().trim().min(7, "Please add a phone number we can reach you on"),
  email: z.string().trim().email("Please check the email address"),
  heardAbout: z.string().trim().optional(),
  hasGroupon: z.boolean(),
  serviceCategory: z.enum(categories).optional(),
  preferredDate: z.string().trim().optional(),
  preferredTime: z.string().trim().optional(),
  // Ten characters, not two sentences. The rule only needs to stop an empty or accidental
  // submission; the assistant handles a short inquiry fine and a person reads it either way.
  message: z.string().trim().min(10, "Please tell us a little about what you are looking for"),
  contactMethod: z.enum(["phone", "text", "email"]),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

export const serviceCategories = categories;
