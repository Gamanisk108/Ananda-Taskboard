import { useQuery } from "@tanstack/react-query";
import { api } from "./api/client";
import type { Me } from "./types";
import type { GroupLite } from "./components/AssigneePicker";

// The admin-only groups list. Non-admins (or when `enabled` is false) get []
// without hitting the admin-only endpoint. Shared by the task modal, the summary
// copier, and the export dialog; refresh via invalidateQueries(["groups"]).
export function useAdminGroups(me: Me, enabled = true): GroupLite[] {
  const { data } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.get("/api/groups") as Promise<GroupLite[]>,
    enabled: enabled && me.is_admin,
  });
  return data ?? [];
}
