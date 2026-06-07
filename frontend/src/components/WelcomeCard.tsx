import { useTranslation } from "react-i18next";
import { LayoutGrid, Columns3, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { Modal } from "./common";

// One-card, skippable first-login welcome. Deliberately tiny: a title, three plain
// bullets, and two buttons that both just dismiss it (shown once ever). The localStorage
// flag and replay are owned by App.tsx so the same card can be re-shown from Help.
export function WelcomeCard({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const bullets: { Icon: LucideIcon; text: string }[] = [
    {
      Icon: LayoutGrid,
      text: t(
        "onboarding.b1",
        "Tap a colored tab to open a project and see its tasks.",
      ),
    },
    {
      Icon: Columns3,
      text: t(
        "onboarding.b2",
        "Switch between List, Board, Weekly and Monthly up top.",
      ),
    },
    {
      Icon: Plus,
      text: t(
        "onboarding.b3",
        "Tap the big + New task button to add something to do.",
      ),
    },
  ];
  return (
    <Modal
      icon={<Sparkles />}
      title={t("onboarding.title", "Welcome to Ananda Taskboard")}
      onClose={onClose}
    >
      <div style={{ lineHeight: 1.5 }}>
        <p style={{ marginTop: 0, color: "var(--text-muted)" }}>
          {t("onboarding.intro", "Three quick things and you're ready:")}
        </p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 14px",
            display: "grid",
            gap: 12,
          }}
        >
          {bullets.map((b, i) => (
            <li
              key={i}
              style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
            >
              <span
                style={{ flex: "none", color: "var(--primary)", display: "inline-flex", marginTop: 1 }}
                aria-hidden
              >
                <b.Icon size={20} />
              </span>
              <span>{b.text}</span>
            </li>
          ))}
        </ul>
        <p className="muted" style={{ fontSize: 12, margin: "0 0 14px" }}>
          {t(
            "onboarding.help",
            "You can reopen this anytime from the ? Help button.",
          )}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onClose}>
            {t("onboarding.skip", "Skip")}
          </button>
          <button
            className="btn-primary"
            data-testid="welcome-gotit"
            onClick={onClose}
          >
            {t("onboarding.gotIt", "Got it")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
