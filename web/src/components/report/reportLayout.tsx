import { useEffect, useState } from "react";

import Head from "./head";
import ReportList, { type LocationPoint } from "./reportList";
import ReportPopUp from "./partials/reportPopUp";

const ReportLayout = () => {
  const [isLocationOpen, setIsLocationOpen] = useState(false);

  const [startPoint, setStartPoint] = useState<LocationPoint | null>(null);

  const [endPoint, setEndPoint] = useState<LocationPoint | null>(null);

  const [activePoint, setActivePoint] = useState<"start" | "end">("end");

  // Mengambil lokasi perangkat saat popup pertama kali dibuka.
  useEffect(() => {
    if (!isLocationOpen || startPoint || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStartPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Pengguna tetap dapat memilih titik secara manual.
      },
    );
  }, [isLocationOpen, startPoint]);

  // Membuka popup dan menentukan titik yang akan diedit.
  const handleOpenLocation = (point: "start" | "end" = "end") => {
    setActivePoint(point);
    setIsLocationOpen(true);
  };

  // Menghapus titik awal dan akhir.
  const handleReset = () => {
    setStartPoint(null);
    setEndPoint(null);
    setActivePoint("start");
  };

  // Menyimpan lokasi sementara dan menutup popup.
  const handleSaveLocation = () => {
    if (!startPoint || !endPoint) return;

    setIsLocationOpen(false);
  };

  return (
    <main className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white">
      <Head onBack={() => window.history.back()} />

      <ReportList
        startPoint={startPoint}
        endPoint={endPoint}
        onOpenLocation={handleOpenLocation}
      />

      {isLocationOpen && (
        <ReportPopUp
          startPoint={startPoint}
          endPoint={endPoint}
          activePoint={activePoint}
          onChangeActive={setActivePoint}
          onChangeStart={setStartPoint}
          onChangeEnd={setEndPoint}
          onReset={handleReset}
          onSave={handleSaveLocation}
          onClose={() => setIsLocationOpen(false)}
        />
      )}
    </main>
  );
};

export default ReportLayout;
