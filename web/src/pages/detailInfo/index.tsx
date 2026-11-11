import { useState } from "react";
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
import { mockReports } from "../home/data";

type ConfirmationData = {
  closed: number;
  opened: number;
};

function getInitialConfirmation(reportId: string): ConfirmationData {
  const saved = localStorage.getItem(`road-confirmation-${reportId}`);

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

function DetailInfo() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const report = mockReports.find((item) => item.id === reportId);

  const onClose = () => navigate("/");

  const [confirmation, setConfirmation] = useState<ConfirmationData>(() =>
    getInitialConfirmation(report?.id ?? ""),
  );

  const [roadStatus, setRoadStatus] = useState(
    report?.status === "ditutup" ? "Ditutup" : "Sudah Dibuka",
  );

  if (!report) {
    return <Navigate to="/" replace />;
  }

  const roadData = {
    name: report.streetName,
    location: "Sanur, Denpasar Selatan, Bali",
    category: report.category,
    reportTime: "09 November 2026, 09.30 WITA",
    motorcycleAccess: "No access",
    carAccess: "No access",
  };

  const saveConfirmation = (data: ConfirmationData) => {
    localStorage.setItem(
      `road-confirmation-${report.id}`,
      JSON.stringify(data),
    );

    setConfirmation(data);
  };

  const handleConfirmClosed = () => {
    const newData = {
      ...confirmation,
      closed: confirmation.closed + 1,
    };

    saveConfirmation(newData);
    setRoadStatus("Ditutup");
  };

  const handleConfirmOpened = () => {
    const newData = {
      ...confirmation,
      opened: confirmation.opened + 1,
    };

    saveConfirmation(newData);
    setRoadStatus("Sudah Dibuka");
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
          <h2 id="road-detail-title">{roadData.name}</h2>

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
