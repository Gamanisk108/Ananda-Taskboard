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
      {/* D6: emphasized "Unscheduled Tasks (N)" button — blue outline + tinted
          fill + navy count pill; line-art CalendarOff; hidden at 0 (above). */}
      <button type="button" className="btn-unscheduled" style={{ marginLeft: "auto" }}
        data-testid="undated-button" onClick={() => setOpen(true)}>
        <CalendarOff size={14} /> {t("cal.noDate", "Unscheduled Tasks")}
        <span className="us-count">{undated.length}</span>
      </button>
      {open && (
        <Modal icon={<CalendarOff />} title={t("cal.noDateTitle", "Unscheduled tasks ({{count}})", { count: undated.length })} onClose={() => setOpen(false)}>
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
