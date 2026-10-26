import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

export type AdminIdea = FunctionReturnType<typeof api.admin.listIdeas>[number];
