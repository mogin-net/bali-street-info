import { useEffect, useState } from "react";
import {
  MapPin,
  Construction,
  Clock,
  CircleCheck,
  CircleX,
  CarFront,
  Motorbike,
  Users,
} from "lucide-react";

import "./style.css";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  getReportDetail,
  submitReportConfirmation,
  type ReportDetail as ReportDetailData,
} from "@/services/detailInfoService";
import { getReportErrorMessage } from "@/services/reportService";

function DetailInfo() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteMessage, setVoteMessage] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  const onClose = () => navigate("/");

  useEffect(() => {
    if (!reportId) return;

    let isCurrent = true;
    setIsLoading(true);
    setLoadError(null);

    getReportDetail(reportId)
      .then((data) => {
        if (isCurrent) setReport(data);
      })
      .catch((error) => {
        console.error("Gagal memuat detail laporan:", error);
        if (isCurrent) setLoadError("Detail laporan gagal dimuat.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [reportId]);

  if (!reportId) return <Navigate to="/" replace />;

  if (isLoading) {
    return <div className="popup-overlay">Memuat detail laporan...</div>;
  }

  if (loadError) {
    return (
      <div className="popup-overlay" onClick={onClose}>
        <div
          className="popup"
          role="alert"
          onClick={(event) => event.stopPropagation()}
        >
          <p>{loadError}</p>
          <button className="popup-close" onClick={onClose}>
            Kembali ke peta
          </button>
        </div>
      </div>
    );
  }

  if (!report) return <Navigate to="/" replace />;

  const roadStatus = {
    closed: "Ditutup",
    open: "Sudah Dibuka",
    expired: "Kedaluwarsa",
  }[report.status];

  const roadData = {
    name: report.streetName,
    location: "Sanur, Denpasar Selatan, Bali",
    category:
      report.category.charAt(0).toUpperCase() + report.category.slice(1),
    reportTime: new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Makassar",
    }).format(new Date(report.dtCreated)),
    motorcycleAccess: report.isMotorcycleForbidden
      ? "Tidak dapat dilewati"
      : "Dapat dilewati",
    carAccess: report.isCarForbidden
      ? "Tidak dapat dilewati"
      : "Dapat dilewati",
  };

  const submitConfirmation = async (isStillClosed: boolean) => {
    if (isSubmittingVote || report.status === "expired") return;

    try {
      setIsSubmittingVote(true);
      setVoteError(null);
      setVoteMessage(null);

      const result = await submitReportConfirmation(
        report.reportId,
        isStillClosed,
      );
      setReport((current) =>
        current
          ? {
              ...current,
              status: result.reportStatus,
              closedCount: result.closedCount,
              openCount: result.openCount,
            }
          : current,
      );

      setVoteMessage(
        result.confirmationRecorded
          ? "Konfirmasi Anda berhasil disimpan."
          : "Laporan telah kedaluwarsa; konfirmasi tidak disimpan.",
      );
    } catch (error) {
      console.error("Gagal menyimpan konfirmasi:", error);
      setVoteError(getReportErrorMessage(error));
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const infoItems = [
    {
      label: "Kategori",
      icon: Construction,
      value: roadData.category,
    },
    {
      label: "Waktu Awal Laporan",
      icon: Clock,
      value: roadData.reportTime,
    },
    {
      label: "Status",
      icon:
        report.status === "closed"
          ? CircleX
          : report.status === "open"
            ? CircleCheck
            : Clock,
      value: roadStatus,
    },
    {
      label: "Akses Motor",
      icon: Motorbike,
      value: roadData.motorcycleAccess,
    },
    {
      label: "Akses Mobil",
      icon: CarFront,
      value: roadData.carAccess,
    },
  ];

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
          <h2 id="road-detail-title">{roadData.name}</h2>

          <p className="road-location">
            <MapPin size={16} />
            {roadData.location}
          </p>

          <span className="road-status">
            {report.status === "closed" ? (
              <CircleX size={14} />
            ) : report.status === "open" ? (
              <CircleCheck size={14} />
            ) : (
              <Clock size={14} />
            )}
            {roadStatus}
          </span>
        </div>

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

          <div className="info-item">
            <span className="info-label">
              <Users size={16} />
              Jumlah Konfirmasi
            </span>

            <div className="confirmation-counts">
              <div className="confirmation-count-row">
                <span>
                  <CircleX size={14} />
                  Ditutup
                </span>

                <strong>{report.closedCount}</strong>
              </div>

              <div className="confirmation-count-row">
                <span>
                  <CircleCheck size={14} />
                  Dibuka
                </span>

                <strong>{report.openCount}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="road-confirmation">
          <h3>Konfirmasi Kondisi Jalan</h3>

          {report.status === "expired" && (
            <p role="status">
              Laporan ini sudah kedaluwarsa dan tidak menerima konfirmasi.
            </p>
          )}
          {voteError && <p role="alert">{voteError}</p>}
          {voteMessage && <p role="status">{voteMessage}</p>}

          <div className="confirmation-buttons">
            <button
              onClick={() => void submitConfirmation(true)}
              disabled={isSubmittingVote || report.status === "expired"}
            >
              <CircleX size={16} />
              Masih Ditutup
            </button>

            <button
              onClick={() => void submitConfirmation(false)}
              disabled={isSubmittingVote || report.status === "expired"}
            >
              <CircleCheck size={16} />
              Sudah Dibuka
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetailInfo;
