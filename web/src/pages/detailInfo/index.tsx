import { useEffect, useState } from "react";
import {
  MapPin,
  Construction,
  Clock,
  CircleCheck,
  CircleX,
  CircleQuestionMark,
  CarFront,
  Motorbike,
  FileText,
  type LucideIcon,
} from "lucide-react";

import "./style.css";
import {
  Navigate,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import {
  getReportDetail,
  statusLabels,
  submitReportConfirmation,
  voteThanksMessage,
  type ReportDetail as ReportDetailData,
  type ReportStatus,
} from "@/services/detailInfoService";
import { getReportErrorMessage } from "@/services/reportService";
import { formatAgo, formatClock } from "@/lib/time";
import type { HomeOutletContext } from "@/pages/home";

type Loaded = {
  id: string;
  report: ReportDetailData | null;
  error: string | null;
};

const statusIcons: Record<ReportStatus, LucideIcon> = {
  closed: CircleX,
  maybe_open: CircleQuestionMark,
  open: CircleCheck,
  expired: Clock,
};

function DetailInfo() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { reloadReports } = useOutletContext<HomeOutletContext>();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteMessage, setVoteMessage] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const onClose = () => navigate("/");

  useEffect(() => {
    if (!reportId) return;

    let isCurrent = true;

    getReportDetail(reportId)
      .then((data) => {
        if (isCurrent) setLoaded({ id: reportId, report: data, error: null });
      })
      .catch((error) => {
        console.error("Gagal memuat detail laporan:", error);
        if (isCurrent) {
          setLoaded({
            id: reportId,
            report: null,
            error: "Detail laporan gagal dimuat.",
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [reportId]);

  const myNextVoteAt = loaded?.report?.myNextVoteAt ?? null;

  // Re-enable the buttons when the cooldown ends while the panel stays open.
  useEffect(() => {
    if (!myNextVoteAt) return;
    const waitMs = new Date(myNextVoteAt).getTime() - Date.now();
    if (waitMs <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), waitMs + 500);
    return () => clearTimeout(timer);
  }, [myNextVoteAt]);

  if (!reportId) return <Navigate to="/" replace />;

  if (!loaded || loaded.id !== reportId) {
    return <div className="popup-overlay">Memuat detail laporan...</div>;
  }

  if (loaded.error) {
    return (
      <div className="popup-overlay" onClick={onClose}>
        <div
          className="popup"
          role="alert"
          onClick={(event) => event.stopPropagation()}
        >
          <p>{loaded.error}</p>
          <button className="popup-close" onClick={onClose}>
            Kembali ke peta
          </button>
        </div>
      </div>
    );
  }

  const report = loaded.report;
  if (!report) return <Navigate to="/" replace />;

  const isExpired = report.status === "expired";
  const isCoolingDown =
    myNextVoteAt !== null && new Date(myNextVoteAt).getTime() > now;
  const nowDate = new Date(now);
  const category =
    report.category.charAt(0).toUpperCase() + report.category.slice(1);
  const StatusIcon = statusIcons[report.status];

  const submitConfirmation = async (isStillClosed: boolean) => {
    if (isSubmittingVote || isExpired || isCoolingDown) return;

    try {
      setIsSubmittingVote(true);
      setVoteError(null);
      setVoteMessage(null);

      const result = await submitReportConfirmation(
        report.reportId,
        isStillClosed,
      );

      setVoteMessage(
        result.confirmationRecorded
          ? voteThanksMessage(report.status, result.reportStatus)
          : "Laporan telah kedaluwarsa; konfirmasi tidak disimpan.",
      );
    } catch (error) {
      console.error("Gagal menyimpan konfirmasi:", error);
      setVoteError(getReportErrorMessage(error));
    } finally {
      setIsSubmittingVote(false);
      setNow(Date.now());
      // Refresh both the panel and the map, also after errors such as an
      // expiry that happened while the panel was open.
      getReportDetail(report.reportId)
        .then((data) => setLoaded({ id: report.reportId, report: data, error: null }))
        .catch((error) => console.error("Gagal memuat ulang detail:", error));
      reloadReports();
    }
  };

  const infoItems = [
    { label: "Lokasi", icon: MapPin, value: "Sanur, Denpasar Selatan, Bali" },
    { label: "Kategori", icon: Construction, value: category },
    {
      label: "Waktu Awal Laporan",
      icon: Clock,
      value: new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Asia/Makassar",
      }).format(new Date(report.dtCreated)),
    },
    {
      label: "Akses Motor",
      icon: Motorbike,
      value: report.isMotorcycleForbidden
        ? "Tidak dapat dilewati"
        : "Dapat dilewati",
    },
    {
      label: "Akses Mobil",
      icon: CarFront,
      value: report.isCarForbidden ? "Tidak dapat dilewati" : "Dapat dilewati",
    },
    ...(report.description
      ? [{ label: "Keterangan", icon: FileText, value: report.description }]
      : []),
  ];

  const ago = (count: number, iso: string | null) =>
    iso ? ` · ${count > 1 ? "terakhir " : ""}${formatAgo(iso, nowDate)}` : "";

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="road-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popup-top">
          <button className="popup-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="road-header">
          <h2 id="road-detail-title">{report.streetName}</h2>

          <p className="road-meta">
            {category} · dilaporkan {formatClock(report.dtCreated)}
          </p>

          <span className="road-status" data-status={report.status}>
            <StatusIcon size={14} />
            {statusLabels[report.status]}
          </span>

          {(report.openCount > 0 || report.closedCount > 0) && (
            <ul className="vote-lines">
              {report.openCount > 0 && (
                <li className="vote-line-open">
                  <CircleCheck />
                  <span>
                    {report.openCount} orang bilang <b>sudah dibuka</b>
                    {ago(report.openCount, report.lastOpenVoteAt)}
                  </span>
                </li>
              )}

              {report.closedCount > 0 && (
                <li className="vote-line-closed">
                  <CircleX />
                  <span>
                    {report.closedIsReporterOnly ? (
                      <>
                        Pelapor: <b>ditutup</b>
                      </>
                    ) : (
                      <>
                        {report.closedCount} orang bilang <b>masih ditutup</b>
                      </>
                    )}
                    {ago(report.closedCount, report.lastClosedVoteAt)}
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>

        {isExpired ? (
          <p className="vote-note" role="status">
            Laporan ini sudah kedaluwarsa dan tidak menerima konfirmasi.
          </p>
        ) : (
          <>
            <p className="vote-question">Kamu di sini? Bagaimana sekarang?</p>

            <div className="vote-buttons">
              <button
                className="vote-closed"
                onClick={() => void submitConfirmation(true)}
                disabled={isSubmittingVote || isCoolingDown}
              >
                <CircleX size={18} />
                Masih ditutup
              </button>

              <button
                className="vote-open"
                onClick={() => void submitConfirmation(false)}
                disabled={isSubmittingVote || isCoolingDown}
              >
                <CircleCheck size={18} />
                Sudah dibuka
              </button>
            </div>

            {isCoolingDown && myNextVoteAt && (
              <p className="vote-note">
                Kamu bisa vote lagi pukul {formatClock(myNextVoteAt)}
              </p>
            )}
          </>
        )}

        {voteMessage && (
          <p className="vote-feedback" role="status">
            {voteMessage}
          </p>
        )}
        {voteError && (
          <p className="vote-feedback" role="alert">
            {voteError}
          </p>
        )}

        <button
          type="button"
          className="details-toggle"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((value) => !value)}
        >
          {showDetails ? "Sembunyikan detail" : "Lihat detail lengkap"}
        </button>

        {showDetails && (
          <div className="road-information">
            {infoItems.map((item) => {
              const Icon = item.icon;

              return (
                <div className="info-item" key={item.label}>
                  <span className="info-label">
                    <Icon size={16} />
                    {item.label}
                  </span>

                  <p>{item.value}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default DetailInfo;
