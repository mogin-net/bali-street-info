import { supabase } from "@/lib/supabase";
import { ensureAnonymousSession } from "@/services/anonymousSession";

export type ReportStatus = "closed" | "maybe_open" | "open" | "expired";

export const statusLabels: Record<ReportStatus, string> = {
  closed: "Ditutup",
  maybe_open: "Mungkin sudah dibuka",
  open: "Sudah dibuka",
  expired: "Kedaluwarsa",
};

export function voteThanksMessage(previous: ReportStatus, next: ReportStatus) {
  return previous === next
    ? "Terima kasih! Vote-mu sudah tercatat."
    : `Terima kasih! Vote-mu ikut mengubah status menjadi ${statusLabels[next]}.`;
}

export interface ReportDetail {
  reportId: string;
  streetName: string;
  category: string;
  status: ReportStatus;
  description: string | null;
  dtCreated: string;
  isCarForbidden: boolean;
  isMotorcycleForbidden: boolean;
  closedCount: number;
  openCount: number;
  lastClosedVoteAt: string | null;
  lastOpenVoteAt: string | null;
  closedIsReporterOnly: boolean;
  myNextVoteAt: string | null;
}

export interface ConfirmationResult {
  reportStatus: ReportStatus;
  closedCount: number;
  openCount: number;
  confirmationRecorded: boolean;
  nextVoteAt: string | null;
}

interface ReportDetailRow {
  report_id: string;
  street_name: string;
  category: string;
  report_status: ReportStatus;
  description: string | null;
  dt_created: string;
  is_car_forbidden: boolean;
  is_motorcycle_forbidden: boolean;
  closed_count: number;
  open_count: number;
  last_closed_vote_at: string | null;
  last_open_vote_at: string | null;
  closed_is_reporter_only: boolean;
  my_next_vote_at: string | null;
}

interface ConfirmationRow {
  report_status: ReportStatus;
  closed_count: number;
  open_count: number;
  confirmation_recorded: boolean;
  next_vote_at: string | null;
}

export async function getReportDetail(reportId: string) {
  const { data, error } = await supabase.rpc("get_report_detail", {
    p_report_uuid: reportId,
  });

  if (error) throw error;

  const row = ((data ?? []) as ReportDetailRow[])[0];
  if (!row) return null;

  return {
    reportId: row.report_id,
    streetName: row.street_name,
    category: row.category,
    status: row.report_status,
    description: row.description,
    dtCreated: row.dt_created,
    isCarForbidden: row.is_car_forbidden,
    isMotorcycleForbidden: row.is_motorcycle_forbidden,
    closedCount: Number(row.closed_count),
    openCount: Number(row.open_count),
    lastClosedVoteAt: row.last_closed_vote_at,
    lastOpenVoteAt: row.last_open_vote_at,
    closedIsReporterOnly: row.closed_is_reporter_only,
    myNextVoteAt: row.my_next_vote_at,
  } satisfies ReportDetail;
}

export async function submitReportConfirmation(
  reportId: string,
  isStillClosed: boolean,
) {
  await ensureAnonymousSession();

  const { data, error } = await supabase.rpc("submit_report_confirmation", {
    p_report_uuid: reportId,
    p_is_still_closed: isStillClosed,
  });

  if (error) throw error;

  const row = ((data ?? []) as ConfirmationRow[])[0];
  if (!row) throw new Error("Konfirmasi tidak menghasilkan status terbaru.");

  return {
    reportStatus: row.report_status,
    closedCount: Number(row.closed_count),
    openCount: Number(row.open_count),
    confirmationRecorded: row.confirmation_recorded,
    nextVoteAt: row.next_vote_at,
  } satisfies ConfirmationResult;
}
