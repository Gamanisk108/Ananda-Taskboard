// English help text, keyed by the article ids in ../registry.ts. Plain language for
// non-technical users — short sentences, no jargon. `body` may use blank lines to
// separate paragraphs; the panel renders each as its own line. To translate, copy
// this file to e.g. it.ts and translate the strings — no code change needed (see
// ./index.ts). Every id in ARTICLES must have an entry here (help.test.ts enforces).

export interface HelpContent {
  title: string;
  body: string;
}

export const EN: Record<string, HelpContent> = {
  // ---- Views ----------------------------------------------------------------
  "list-view": {
    title: "The List view",
    body: "List shows your tasks as a simple top-to-bottom list — the easiest way to read everything at a glance.\n\nUse the filter row at the top to narrow things down by person, status, or priority.",
  },
  "board-view": {
    title: "The Board view",
    body: "Board shows your tasks as cards in columns, one column per status (like To Do, In Progress, Done).\n\nDrag a card from one column to another to change its status.",
  },
  "weekly-view": {
    title: "The Weekly view",
    body: "Weekly lays your tasks out across the seven days of a week, by their due date.\n\nIt's the best view for planning the days right in front of you.",
  },
  "monthly-view": {
    title: "The Monthly calendar",
    body: "Monthly shows a full calendar month with your tasks on their due dates. Public holidays appear automatically too.\n\nTap any day to see everything happening that day.",
  },

  // ---- Everyday actions -----------------------------------------------------
  "new-task": {
    title: "Add a new task",
    body: "Tap the big blue + New task button at the top right.\n\nGive it a name, pick which project it belongs to, and (optionally) a due date and who should do it. Then tap Save. That's it.",
  },
  "share-view": {
    title: "Share what you're looking at",
    body: "The Share view button copies a link to exactly what's on your screen right now.\n\nPaste that link to a teammate and they'll open the same project and view you're seeing.",
  },
  "copy-summary": {
    title: "Copy a daily summary",
    body: "Copy summary makes a tidy text summary of the current tasks that you can paste into a chat or email.\n\nHandy for a quick end-of-day update without typing it out yourself.",
  },
  archive: {
    title: "Finding finished tasks",
    body: "Completed tasks tuck themselves away after 7 days so your list stays clean.\n\nTap the Archive button to see them again. Tap Hide archive to put them back away.",
  },
  notifications: {
    title: "Turn on notifications",
    body: "Open your name menu (top right) and tap the bell to turn on notifications.\n\nYour device will ask permission once — tap Allow — and then you'll be told when a task is assigned to you or changes.",
  },
  "daily-push": {
    title: "Daily reminder",
    body: "Open your name menu (top right) and tick \"Daily reminder\" to get one summary notification each day of what's on your plate.\n\nIt's separate from the per-task notifications above — turn either on or off independently. Your choice is remembered per account.",
  },
  language: {
    title: "Change the language",
    body: "Open your name menu (top right) and pick a language from the list.\n\nThe whole app switches straight away, and it remembers your choice next time.",
  },
  theme: {
    title: "Light or dark mode",
    body: "Use the sun/moon button (or the Theme picker in your name menu) to switch between light and dark.\n\nChoose System to follow whatever your phone or computer is set to.",
  },

  // ---- Admin tools ----------------------------------------------------------
  projects: {
    title: "Manage projects",
    body: "Projects lets admins create projects and sub-projects, rename them, give them colors, and set their order.\n\nProjects are the top tabs; sub-projects appear underneath when you open a project.",
  },
  team: {
    title: "Team & permissions",
    body: "Team is where admins invite people, remove them, and decide what each person can see and do.\n\nEach member has a single Access level that controls how much of the board they can see.",
  },
  approvals: {
    title: "Approvals",
    body: "Some changes wait for an admin's OK. Approvals is the inbox where you review those requests and approve or decline them.",
  },
  trash: {
    title: "Trash & restore",
    body: "Deleted projects, sub-projects, and tasks rest in the Trash for a while before they're gone for good.\n\nOpen Trash to restore something by mistake, or to delete it permanently.",
  },
  settings: {
    title: "Settings",
    body: "Settings holds organization-wide options for your whole team. Changes here affect everyone, so take a moment before saving.",
  },
  history: {
    title: "History",
    body: "History is a running log of who changed what and when — useful for understanding how a task got to where it is.",
  },
  "restore-points": {
    title: "Restore points",
    body: "A restore point is a saved snapshot of your whole board. If something goes badly wrong, you can roll the board back to an earlier snapshot.",
  },
  "bulk-migrate": {
    title: "Bulk migrate",
    body: "Bulk migrate moves many tasks at once from one project or sub-project to another — far quicker than moving them one by one.",
  },
  holidays: {
    title: "Automatic calendar holidays",
    body: "The calendar can show public holidays for your country automatically, so you don't have to add them by hand.\n\nAdmins choose which holiday sets to show from the Holidays tab in Team & permissions.",
  },

  // ---- General FAQ ----------------------------------------------------------
  "faq-cant-see": {
    title: "Why can't I see a project or task?",
    body: "You only see the projects an admin has added you to. If something's missing, it usually means you haven't been given access yet.\n\nAsk your admin to add you, or to assign you the task — it'll appear right away.",
  },
  "faq-assign": {
    title: "How do I give a task to someone?",
    body: "Open the task, find the people field, and pick who should do it. You can choose more than one person.\n\nThey'll see it on their board (and get a notification if they've turned notifications on).",
  },
  "faq-status": {
    title: "How do I mark a task done or change its status?",
    body: "Tap the colored status label on a task and choose a new status (such as Done).\n\nIn the Board view you can also just drag the card into the Done column.",
  },
  "faq-mobile": {
    title: "Can I use this on my phone?",
    body: "Yes. Open the app in your phone's web browser, then use the browser menu and choose Add to Home Screen.\n\nIt then opens like a normal app, full-screen, with its own icon.",
  },
  "faq-password": {
    title: "How do I change or reset my password?",
    body: "If you're logged in, you can change it from your account area. If you're locked out, tap Forgot password on the login screen and follow the email link.",
  },
};
