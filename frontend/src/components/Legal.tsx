// Privacy Policy + Terms of Service — hosted at /privacy and /terms (the SPA
// fallback serves any path, so these are real linkable URLs for app-store
// listings). Legal body text is deliberately English-only (one authoritative
// text; only the nav labels are translated). Pre-auth: rendered before the
// auth gate, with the same auth-card framing as Login.

import { ArrowLeft } from "lucide-react";

const CONTACT = "gamanisk@gmail.com";
const UPDATED = "June 10, 2026";

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="login-wrap" style={{ alignItems: "start", paddingTop: 40 }}>
      <div className="card login-card rise" style={{ maxWidth: 640 }}>
        <div className="login-brand brand">
          <img src="/logo.png" alt="" style={{ width: 34, height: 34, objectFit: "contain" }} />
          <div className="brand-txt">
            <div className="name" style={{ fontSize: 20 }}>Ananda <b>Taskboard</b></div>
            <div className="tagline">Love &amp; Blessings from Ananda Los Angeles</div>
          </div>
        </div>
        <h1 style={{ fontSize: 22, margin: "14px 0 2px" }}>{title}</h1>
        <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>Last updated: {UPDATED}</p>
        <div className="legal-body">{children}</div>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 18, color: "var(--primary)", fontSize: 13.5, textDecoration: "none" }}>
          <ArrowLeft size={15} /> Back to Ananda Taskboard
        </a>
      </div>
    </div>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <h3>What this app is</h3>
      <p>
        Ananda Taskboard is a team task board operated for the Ananda community.
        Your organization's administrators invite you or approve your account.
      </p>
      <h3>Information we store</h3>
      <ul>
        <li><strong>Account data:</strong> your name, email address, password (stored as a salted hash — we never see it), preferred language, and theme.</li>
        <li><strong>Work data:</strong> the projects, tasks, subtasks, comments, attachments, calendar events, and holidays you and your team create.</li>
        <li><strong>Activity records:</strong> administrative actions (e.g. who approved or deleted a task) kept so your team can audit changes.</li>
        <li><strong>Notifications:</strong> if you enable them, a push subscription for your browser or device.</li>
      </ul>
      <h3>What we do NOT do</h3>
      <ul>
        <li>No advertising, no trackers, no analytics beyond error logging.</li>
        <li>We never sell or share your data with third parties for marketing.</li>
        <li>No profiling or automated decision-making.</li>
      </ul>
      <h3>Who can see your data</h3>
      <p>
        Your tasks are visible to your organization's members according to the
        access your administrators grant. Platform operators can access data
        only for support and maintenance.
      </p>
      <h3>Where it lives</h3>
      <p>
        The app and its database are hosted on Render (render.com). Optional
        file attachments are stored on Cloudflare R2. Both providers encrypt
        data in transit and at rest.
      </p>
      <h3>Retention &amp; deletion</h3>
      <ul>
        <li>Deleted tasks sit in Trash for 7 days, then are removed permanently.</li>
        <li>Bug-report screenshots are purged automatically after 90 days.</li>
        <li>You can delete your account from Settings → Account; this removes your personal data. Content your team still needs (e.g. tasks you created for others) is disassociated from you rather than destroyed.</li>
      </ul>
      <h3>Contact</h3>
      <p>Questions or data requests: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </LegalShell>
  );
}

export function Terms() {
  return (
    <LegalShell title="Terms of Service">
      <h3>The service</h3>
      <p>
        Ananda Taskboard is provided to Ananda communities and their teams for
        organizing shared work. It is offered as-is, free of charge, in a
        spirit of service.
      </p>
      <h3>Your account</h3>
      <ul>
        <li>Keep your password private; you are responsible for activity under your account.</li>
        <li>Accounts are personal. Administrators may suspend accounts that abuse the service.</li>
      </ul>
      <h3>Acceptable use</h3>
      <ul>
        <li>Use the board for your team's legitimate work.</li>
        <li>Don't upload unlawful content, malware, or other people's private information without consent.</li>
        <li>Don't attempt to break, overload, or probe the service's security.</li>
      </ul>
      <h3>Your content</h3>
      <p>
        Your team's tasks and files remain yours. You grant us only the rights
        needed to store and display them to the people your administrators
        authorize.
      </p>
      <h3>Availability &amp; liability</h3>
      <p>
        We aim for the service to be reliable but offer no uptime guarantee.
        To the fullest extent permitted by law, the service is provided
        without warranties, and our liability is limited to the amount you
        paid for it (zero).
      </p>
      <h3>Changes</h3>
      <p>
        We may update these terms; material changes will be announced in-app.
        Continued use after a change means you accept the new terms.
      </p>
      <h3>Contact</h3>
      <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </LegalShell>
  );
}
