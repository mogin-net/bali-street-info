
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

import "./detil info.css";

type DetilInfoProps = {
  report: {
    id: string;
    streetName: string;
    category: string;
    status: string;
    title: string;
  };
  onClose: () => void;
};

type ConfirmationData = {
  ditutup: number;
  dibuka: number;
};

function getInitialConfirmation(reportId: string): ConfirmationData {
  const saved = localStorage.getItem(`konfirmasi-jalan-${reportId}`);

  if (saved) {
    try {
      return JSON.parse(saved) as ConfirmationData;
    } catch {
      console.error("Data konfirmasi tidak valid");
    }
  }

  return {
    ditutup: 0,
    dibuka: 0,
  };
}

function DetilInfo({ report, onClose }: DetilInfoProps) {
 const [konfirmasi, setKonfirmasi] = useState<ConfirmationData>(
  () => getInitialConfirmation(report.id)
);

const [statusJalan, setStatusJalan] = useState(
  report.status === "ditutup" ? "Ditutup" : "Sudah Dibuka"
);

  const dataJalan = {
    nama: report.streetName,
    lokasi: "Sanur, Denpasar Selatan, Bali",
    kategori: report.category,
    waktuAwal: "09 November 2026, 09.30 WITA",
    aksesMotor: "Tidak Bisa Lewat",
    aksesMobil: "Tidak Bisa Lewat",
  };

  const simpanKonfirmasi = (data: ConfirmationData) => {
    localStorage.setItem(
      `konfirmasi-jalan-${report.id}`,
      JSON.stringify(data)
    );

    setKonfirmasi(data);
  };

  const handleConfirmClosed = () => {
    const dataBaru = {
      ...konfirmasi,
      ditutup: konfirmasi.ditutup + 1,
    };

    simpanKonfirmasi(dataBaru);
    setStatusJalan("Ditutup");
  };

  const handleConfirmOpened = () => {
    const dataBaru = {
      ...konfirmasi,
      dibuka: konfirmasi.dibuka + 1,
    };

    simpanKonfirmasi(dataBaru);
    setStatusJalan("Sudah Dibuka");
  };

  const informasi = [
    {
      label: "Kategori",
      icon: Construction,
      value: dataJalan.kategori,
    },
    {
      label: "Waktu Awal Laporan",
      icon: Clock,
      value: dataJalan.waktuAwal,
    },
    {
      label: "Status",
      icon: statusJalan === "Ditutup" ? CircleX : CircleCheck,
      value: statusJalan,
    },
    {
      label: "Akses Motor",
      icon: Motorbike,
      value: dataJalan.aksesMotor,
    },
    {
      label: "Akses Mobil",
      icon: CarFront,
      value: dataJalan.aksesMobil,
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
          <h2 id="road-detail-title">{dataJalan.nama}</h2>

          <p className="road-location">
            <MapPin size={16} />
            {dataJalan.lokasi}
          </p>

          <span className="road-status">
            {statusJalan === "Ditutup" ? (
              <CircleX size={14} />
            ) : (
              <CircleCheck size={14} />
            )}
            {statusJalan}
          </span>
        </div>

        <div className="road-information">
          {informasi.map((item) => {
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

                <strong>{konfirmasi.ditutup}</strong>
              </div>

              <div className="confirmation-count-row">
                <span>
                  <CircleCheck size={14} />
                  Dibuka
                </span>

                <strong>{konfirmasi.dibuka}</strong>
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

export default DetilInfo;
