import { describe, expect, it } from "vitest";
import { myVisibleSubprojectIds, peopleInMyScope } from "./users";
import type { Me, UserLite } from "./types";

function makeMe(over: Partial<Me> = {}): Me {
  return {
    id: 1,
    email: "me@example.com",
    name: "Me",
    role: "member",
    is_admin: false,
    tier: null,
    language: "en",
    groups: [],
    tree: { projects: [], show_global_overview: false },
    ...over,
  };
}

function user(id: number, subproject_ids: number[], is_admin = false): UserLite {
  return { id, name: `U${id}`, email: `u${id}@example.com`, is_admin, subproject_ids };
}

// A member who can reach sub-projects 10 and 11 (in project 100).
const memberMe = makeMe({
  id: 1,
  tree: {
    projects: [
      {
        id: 100,
        name: "P",
        color: "#000",
        show_project_overview: true,
        subprojects: [
          { id: 10, name: "A", color: "#000", is_default: true, level: "viewer" },
          { id: 11, name: "B", color: "#000", is_default: false, level: "member" },
        ],
      },
    ],
    show_global_overview: false,
  },
});

describe("myVisibleSubprojectIds", () => {
  it("collects every sub-project id across the tree", () => {
    expect(myVisibleSubprojectIds(memberMe)).toEqual(new Set([10, 11]));
  });

  it("is empty for a user with no visible projects", () => {
    expect(myVisibleSubprojectIds(makeMe())).toEqual(new Set());
  });
});

describe("peopleInMyScope", () => {
  const roster: UserLite[] = [
    user(1, [10, 11]),       // me
    user(2, [11]),           // shares sub-project 11 → visible
    user(3, [10, 99]),       // shares sub-project 10 → visible
    user(4, [99]),           // shares nothing → hidden
    user(5, []),             // no access at all → hidden
    user(6, [99], true),     // an admin who happens to share nothing of mine
  ];

  it("admins see the entire roster unchanged", () => {
    const adminMe = makeMe({ is_admin: true });
    expect(peopleInMyScope(adminMe, roster)).toEqual(roster);
  });

  it("a reduced-access user only sees people sharing a visible sub-project", () => {
    const ids = peopleInMyScope(memberMe, roster).map((u) => u.id).sort();
    expect(ids).toEqual([1, 2, 3]);
  });

  it("always includes the user themselves even with no shared people", () => {
    const lonelyMe = makeMe({
      id: 7,
      tree: {
        projects: [
          {
            id: 200, name: "Q", color: "#000", show_project_overview: false,
            subprojects: [{ id: 20, name: "C", color: "#000", is_default: true, level: "member" }],
          },
        ],
        show_global_overview: false,
      },
    });
    const onlyMe = [user(7, [20]), user(8, [99])];
    expect(peopleInMyScope(lonelyMe, onlyMe).map((u) => u.id)).toEqual([7]);
  });

  it("hides everyone when the user can reach no sub-projects", () => {
    expect(peopleInMyScope(makeMe({ id: 99 }), roster).map((u) => u.id)).toEqual([]);
  });
});
