import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Modal, Spinner } from "./common";
import type { PlatformOrg } from "../types";

/** Platform-owner view: a metadata-only directory of every org. Deliberately
 *  shows NO task content — only counts, admins, and the member roster. */
export function PlatformStats({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<PlatformOrg[] | null>(null);

  useEffect(() => {
    api.get("/api/platform/orgs").then((d) => setOrgs(d as PlatformOrg[])).catch(() => setOrgs([]));
  }, []);

  return (
    <Modal fullScreenOnNarrow title={t("platform.title")} onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{t("platform.subtitle")}</p>
      {orgs === null ? (
        <Spinner />
      ) : orgs.length === 0 ? (
        <p className="muted">{t("platform.empty")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {orgs.map((o) => (
            <div key={o.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0 }}>
                  {o.name}{" "}
                  {!o.is_active && <span className="muted" style={{ fontSize: 12 }}>({t("platform.pending")})</span>}
                </h3>
                <span className="muted" style={{ fontSize: 13 }}>
                  {[o.city, o.country].filter(Boolean).join(", ")}
                </span>
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, margin: "8px 0" }}>
                <Stat label={t("platform.projects")} value={o.counts.projects} />
                <Stat label={t("platform.subprojects")} value={o.counts.subprojects} />
                <Stat label={t("platform.tasks")} value={o.counts.tasks} />
                <Stat label={t("platform.members")} value={o.counts.members} />
              </div>

              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                {t("platform.admins")}: {o.admins.length ? o.admins.map((a) => `${a.name} (${a.email})`).join(", ") : "—"}
              </div>

              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: "4px 6px" }}>{t("platform.member")}</th>
                    <th style={{ padding: "4px 6px" }}>{t("platform.email")}</th>
                    <th style={{ padding: "4px 6px" }}>{t("platform.role")}</th>
                    <th style={{ padding: "4px 6px" }}>{t("platform.tier")}</th>
                  </tr>
                </thead>
                <tbody>
                  {o.members.map((m) => (
                    <tr key={m.email} style={{ borderTop: "1px solid var(--border)", opacity: m.active ? 1 : 0.5 }}>
                      <td style={{ padding: "4px 6px" }}>{m.name}</td>
                      <td style={{ padding: "4px 6px" }}>{m.email}</td>
                      <td style={{ padding: "4px 6px" }}>{t(`platform.role_${m.role}`)}</td>
                      <td style={{ padding: "4px 6px" }}>{m.tier ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <b>{value}</b> <span className="muted">{label}</span>
    </span>
  );
}
