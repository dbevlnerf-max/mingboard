// Both the legacy full-admin endpoint and the scoped operator endpoint
// use the same Sheet-first, GID-checked creation workflow.
import { POST as addManagedMember } from "../managed-members/route";

export async function POST(request: Request) {
  return addManagedMember(request);
}
