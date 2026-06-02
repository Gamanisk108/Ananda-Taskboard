import { useEffect, useState } from "react";
import { api } from "./api/client";
import type { UserLite } from "./types";

// Small shared cache so we don't refetch the user list in every component.
let cache: UserLite[] | null = null;
let inflight: Promise<UserLite[]> | null = null;

export function fetchUsers(): Promise<UserLite[]> {
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

export function userName(users: UserLite[], id: number): string {
  const u = users.find((x) => x.id === id);
  return u ? u.name || u.email : `#${id}`;
}
