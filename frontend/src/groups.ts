import { useEffect, useState } from "react";
import { api } from "./api/client";
import type { Me } from "./types";
import type { GroupLite } from "./components/AssigneePicker";

// The admin-only groups list. Non-admins (or when `enabled` is false) get []
// without hitting the admin-only endpoint. Shared by the task modal, the
// summary copier, and the export dialog, which all loaded it identically.
export function useAdminGroups(me: Me, enabled = true): GroupLite[] {
  const [groups, setGroups] = useState<GroupLite[]>([]);
  useEffect(() => {
    if (enabled && me.is_admin) api.get("/api/groups").then(setGroups).catch(() => setGroups([]));
  }, [enabled, me.is_admin]);
  return groups;
}
