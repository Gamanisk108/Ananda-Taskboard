import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarOff } from "lucide-react";
import { Modal } from "./common";
import { DayTaskList } from "./DayTaskList";
import type { CalendarInstance } from "../types";

/** A "No date (N)" button for the month/week views that opens a modal listing the
 *  tasks with no start date and no deadline (they never land on a calendar day).
 *  Reuses DayTaskList for the rows. Hidden entirely when there are none. */
export function UndatedTasks({
  undated, colorByProject, onOpen,
}: {
  undated: CalendarInstance[];
  colorByProject: boolean;
  onOpen: (taskId: number) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!undated.length) return null;

  return (
    <>
      <button type="button" className="btn-secondary" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
        data-testid="undated-button" onClick={() => setOpen(true)}>
        <CalendarOff size={14} /> {t("cal.noDate", "No date")} ({undated.length})
      </button>
      {open && (
        <Modal icon={<CalendarOff />} title={t("cal.noDateTitle", "No date — {{count}} tasks", { count: undated.length })} onClose={() => setOpen(false)}>
          <DayTaskList
            items={undated}
            colorByProject={colorByProject}
            onOpen={(id) => { setOpen(false); onOpen(id); }}
          />
        </Modal>
      )}
    </>
  );
}
