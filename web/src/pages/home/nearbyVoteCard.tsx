import { useState } from "react";
import { MapPin } from "lucide-react";

import { formatAgo } from "@/lib/time";
import {
  submitReportConfirmation,
  voteThanksMessage,
} from "@/services/detailInfoService";
import type { HomeRoadSegment } from "@/services/homeService";
import { getReportErrorMessage } from "@/services/reportService";

type Props = {
  report: HomeRoadSegment;
  distanceM: number;
  onDone: () => void;
};

export function NearbyVoteCard({ report, distanceM, onDone }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const category =
    report.category.charAt(0).toUpperCase() + report.category.slice(1);

  const vote = async (isStillClosed: boolean) => {
    setState("sending");

    try {
      const result = await submitReportConfirmation(
        report.reportId,
        isStillClosed,
      );

      setMessage(
        result.confirmationRecorded
          ? voteThanksMessage(report.status, result.reportStatus)
          : "Laporan telah kedaluwarsa; konfirmasi tidak disimpan.",
      );
      setState("done");
      setTimeout(onDone, 3000);
    } catch (error) {
      console.error("Gagal menyimpan konfirmasi:", error);
      setMessage(getReportErrorMessage(error));
      setState("error");
    }
  };

  return (
    <section
      role="region"
      aria-label="Konfirmasi jalan di dekatmu"
      aria-live="polite"
      className="pointer-events-auto absolute inset-x-3 bottom-4 z-[1150] rounded-2xl border-2 border-[#191919] bg-white p-4 text-[#191919] shadow-xl sm:left-1/2 sm:right-auto sm:w-[380px] sm:-translate-x-1/2"
    >
      <p className="flex items-center gap-1 text-xs text-[#858585]">
        <MapPin size={14} className="shrink-0" />
        Kamu ±{Math.max(10, Math.round(distanceM / 10) * 10)} m dari laporan ini
      </p>

      <h2 className="mt-1 text-base leading-6 font-semibold">
        {report.streetName ?? "Jalan tanpa nama"} masih ditutup?
      </h2>

      <p className="text-xs text-[#858585]">
        Dilaporkan ditutup · {category} · {formatAgo(report.reportCreatedAt)}
      </p>

      {state === "done" || state === "error" ? (
        <>
          <p
            role={state === "error" ? "alert" : "status"}
            className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
              state === "error"
                ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
                : "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
            }`}
          >
            {message}
          </p>

          {state === "error" && (
            <button
              type="button"
              onClick={onDone}
              className="mt-2 w-full py-2 text-sm text-[#2563EB]"
            >
              Tutup
            </button>
          )}
        </>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={state === "sending"}
              onClick={() => void vote(true)}
              className="min-h-12 rounded-xl bg-[#DC2626] text-sm font-bold text-white disabled:bg-[#E5E5E5] disabled:text-[#A3A3A3]"
            >
              Masih ditutup
            </button>

            <button
              type="button"
              disabled={state === "sending"}
              onClick={() => void vote(false)}
              className="min-h-12 rounded-xl bg-[#16A34A] text-sm font-bold text-white disabled:bg-[#E5E5E5] disabled:text-[#A3A3A3]"
            >
              Sudah dibuka
            </button>
          </div>

          <button
            type="button"
            disabled={state === "sending"}
            onClick={onDone}
            className="mt-2 w-full py-2 text-xs text-[#858585]"
          >
            Tidak tahu / lewati
          </button>
        </>
      )}
    </section>
  );
}
