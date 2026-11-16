
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
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

type ConfirmationData = {
  closed: number;
  opened: number;
};

type ReportRow = {
  uuid: string;
  category: string;
  status: string;
  description: string | null;
  dt_created: string;
  valid_from: string | null;
  actual_opened_at: string | null;
  is_car_forbidden: boolean;
  is_motorcycle_forbidden: boolean;
  report_street_segments: {
    uuid: string;
    start_fraction: number;
    end_fraction: number;
    streets: {
      name: string | null;
    } | null;
  }[];
};

// Mengambil data konfirmasi dari localStorage
function getInitialConfirmation(
  reportId: string,
): ConfirmationData {
  const saved = localStorage.getItem(
    `road-confirmation-${reportId}`,
  );

  if (saved) {
    try {
      return JSON.parse(saved) as ConfirmationData;
    } catch {
      console.error("Confirmation data is invalid");
    }
  }

  return {
    closed: 0,
    opened: 0,
  };
}

// Mengubah format tanggal dari database
function formatDate(date: string | null): string {
  if (!date) return "-";

  return (
    new Date(date).toLocaleString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    }) + " WITA"
  );
}

function DetailInfo() {
  const { reportId } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState<ReportRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [confirmation, setConfirmation] =
    useState<ConfirmationData>({
      closed: 0,
      opened: 0,
    });

  const [roadStatus, setRoadStatus] = useState("");

  const onClose = () => navigate("/");

  // Mengambil data laporan berdasarkan UUID dari URL Home
  useEffect(() => {
    if (!reportId) return;

    const currentReportId = reportId;
    let active = true;

    async function getReportDetail() {
      try {
        const { data, error } = await supabase
          .from("reports")
          .select(`
            uuid,
            category,
            status,
            description,
            dt_created,
            valid_from,
            actual_opened_at,
            is_car_forbidden,
            is_motorcycle_forbidden,
            report_street_segments (
              uuid,
              start_fraction,
              end_fraction,
              streets (
                name
              )
            )
          `)
          .eq("uuid", currentReportId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error("Laporan tidak ditemukan.");
        }

        if (active) {
          const reportData = data as unknown as ReportRow;

          setReport(reportData);

          setRoadStatus(
            reportData.status === "closed"
              ? "Ditutup"
              : "Sudah Dibuka",
          );

          setConfirmation(
            getInitialConfirmation(currentReportId),
          );

          setErrorMessage("");
        }
      } catch (error) {
        console.error(
          "Gagal mengambil detail laporan:",
          error,
        );

        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data laporan.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void getReportDetail();

    return () => {
      active = false;
    };
  }, [reportId]);

  // Menyimpan konfirmasi sementara di localStorage
  const saveConfirmation = (data: ConfirmationData) => {
    if (!reportId) return;

    localStorage.setItem(
      `road-confirmation-${reportId}`,
      JSON.stringify(data),
    );

    setConfirmation(data);
  };

  // Konfirmasi jalan masih ditutup
  const handleConfirmClosed = () => {
    const newData = {
      ...confirmation,
      closed: confirmation.closed + 1,
    };

    saveConfirmation(newData);
    setRoadStatus("Ditutup");
  };

  // Konfirmasi jalan sudah dibuka
  const handleConfirmOpened = () => {
    const newData = {
      ...confirmation,
      opened: confirmation.opened + 1,
    };

    saveConfirmation(newData);
    setRoadStatus("Sudah Dibuka");
  };

  // Jika ID laporan tidak tersedia
  if (!reportId) {
    return (
      <div className="popup-overlay" onClick={onClose}>
        <div
          className="popup"
          onClick={(e) => e.stopPropagation()}
        >
          <p>ID laporan tidak ditemukan.</p>

          <button className="popup-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  // Tampilan ketika data sedang dimuat
  if (isLoading) {
    return (
      <div className="popup-overlay" onClick={onClose}>
        <div
          className="popup"
          onClick={(e) => e.stopPropagation()}
        >
          <p>Memuat detail laporan...</p>
        </div>
      </div>
    );
  }

  // Tampilan jika data gagal ditemukan
  if (errorMessage || !report) {
    return (
      <div className="popup-overlay" onClick={onClose}>
        <div
          className="popup"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="popup-top">
            <button className="popup-close" onClick={onClose}>
              Close
            </button>
          </div>

          <p>
            {errorMessage || "Data laporan tidak ditemukan."}
          </p>
        </div>
      </div>
    );
  }

  // Mengambil nama jalan melalui relasi tabel
  const streetName =
    report.report_street_segments?.[0]?.streets?.name ??
    "Jalan tanpa nama";

  // Data yang ditampilkan pada Detail Info
  const roadData = {
    name: streetName,
    location: "Sanur, Denpasar Selatan, Bali",
    category: report.category,
    reportTime: formatDate(
      report.valid_from ?? report.dt_created,
    ),
    motorcycleAccess: report.is_motorcycle_forbidden
      ? "Tidak dapat diakses"
      : "Dapat diakses",
    carAccess: report.is_car_forbidden
      ? "Tidak dapat diakses"
      : "Dapat diakses",
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
      icon: roadStatus === "Ditutup" ? CircleX : CircleCheck,
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
          <h2 id="road-detail-title">
            {roadData.name}
          </h2>

          <p className="road-location">
            <MapPin size={16} />
            {roadData.location}
          </p>

          <span className="road-status">
            {roadStatus === "Ditutup" ? (
              <CircleX size={14} />
            ) : (
              <CircleCheck size={14} />
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

                <strong>{confirmation.closed}</strong>
              </div>

              <div className="confirmation-count-row">
                <span>
                  <CircleCheck size={14} />
                  Dibuka
                </span>

                <strong>{confirmation.opened}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="road-confirmation">
          <h3>Konfirmasi Kondisi Jalan</h3>

          <div className="confirmation-buttons">
            <button onClick={handleConfirmClosed}>
              <CircleX size={16} />
              Masih Ditutup
            </button>

            <button onClick={handleConfirmOpened}>
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
