import { useEffect, useState } from "react";
import { api } from "./api/client";
import type { Me, UserLite } from "./types";

// Small shared cache so we don't refetch the user list in every component.
let cache: UserLite[] | null = null;
let inflight: Promise<UserLite[]> | null = null;

function fetchUsers(): Promise<UserLite[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api.get("/api/users").then((d) => {
      cache = d as UserLite[];
      inflight = null;
      return cache;
    });
  }
  return inflight;
}

export function invalidateUsers() {
  cache = null;
}

export function useUsers() {
  const [users, setUsers] = useState<UserLite[]>(cache ?? []);
  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, []);
  return users;
}

/** Sub-project ids the current user can reach, read off their permission-filtered tree. */
export function myVisibleSubprojectIds(me: Me): Set<number> {
  const ids = new Set<number>();
  for (const p of me.tree.projects) for (const s of p.subprojects) ids.add(s.id);
  return ids;
}

/**
 * People a user is allowed to SEE in filter pickers (Copy Summary, Export):
 * themselves plus anyone who shares at least one sub-project they can access.
 * Admins see everyone. Reduced-access users never see the full roster — they
 * only get people relevant to the scope they can actually export/summarize.
 */
export function peopleInMyScope(me: Me, users: UserLite[]): UserLite[] {
  if (me.is_admin) return users;
  const mine = myVisibleSubprojectIds(me);
  return users.filter(
    (u) => u.id === me.id || u.subproject_ids.some((id) => mine.has(id)),
  );
}

export function userName(users: UserLite[], id: number): string {
  const u = users.find((x) => x.id === id);
  return u ? u.name || u.email : `#${id}`;
}

/** Deterministic, pleasant avatar background for a user id — stable across
 *  sessions so the same person always gets the same color (design uses per-
 *  person colors). Mid-saturation/lightness keeps white initials legible. */
export function avatarColor(id: number): string {
  const hue = (id * 137.508) % 360; // golden-angle spread → distinct hues
  return `hsl(${Math.round(hue)} 52% 42%)`;
}

/** Up-to-2-char initials from a user's name (or email). */
export function userInitials(users: UserLite[], id: number): string {
  const n = userName(users, id).trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}
