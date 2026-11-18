import { useEffect, useState } from "react";

import Head from "./head";
import ReportList, { type LocationPoint } from "./reportList";
import ReportPopUp from "./partials/reportPopUp";
import { getNearestStreetName } from "@/services/reportService";

const ReportLayout = () => {
  const [isLocationOpen, setIsLocationOpen] = useState(false);

  const [startPoint, setStartPoint] = useState<LocationPoint | null>(null);

  const [endPoint, setEndPoint] = useState<LocationPoint | null>(null);

  const [activePoint, setActivePoint] = useState<"start" | "end">("end");
  const [startStreetName, setStartStreetName] = useState<string | null>(null);
  const [endStreetName, setEndStreetName] = useState<string | null>(null);
  const [isResolvingStart, setIsResolvingStart] = useState(false);
  const [isResolvingEnd, setIsResolvingEnd] = useState(false);
  const [startStreetLookupFailed, setStartStreetLookupFailed] = useState(false);
  const [endStreetLookupFailed, setEndStreetLookupFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    if (!startPoint) {
      setStartStreetName(null);
      setIsResolvingStart(false);
      setStartStreetLookupFailed(false);
      return;
    }

    setStartStreetName(null);
    setStartStreetLookupFailed(false);
    setIsResolvingStart(true);
    getNearestStreetName(startPoint)
      .then((name) => {
        if (isCurrent) setStartStreetName(name);
      })
      .catch((error) => {
        console.error(
          "Gagal mencari nama jalan untuk titik awal penutupan:",
          error,
        );
        if (isCurrent) {
          setStartStreetName(null);
          setStartStreetLookupFailed(true);
        }
      })
      .finally(() => {
        if (isCurrent) setIsResolvingStart(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [startPoint?.lat, startPoint?.lng]);

  useEffect(() => {
    let isCurrent = true;

    if (!endPoint) {
      setEndStreetName(null);
      setIsResolvingEnd(false);
      setEndStreetLookupFailed(false);
      return;
    }

    setEndStreetName(null);
    setEndStreetLookupFailed(false);
    setIsResolvingEnd(true);
    getNearestStreetName(endPoint)
      .then((name) => {
        if (isCurrent) setEndStreetName(name);
      })
      .catch((error) => {
        console.error(
          "Gagal mencari nama jalan untuk titik akhir penutupan:",
          error,
        );
        if (isCurrent) {
          setEndStreetName(null);
          setEndStreetLookupFailed(true);
        }
      })
      .finally(() => {
        if (isCurrent) setIsResolvingEnd(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [endPoint?.lat, endPoint?.lng]);

  // Membuka popup dan menentukan titik yang akan diedit.
  const handleOpenLocation = (point: "start" | "end" = "end") => {
    setActivePoint(point);
    setIsLocationOpen(true);
  };

  const handleChangeStart = (point: LocationPoint | null) => {
    setStartPoint(point);
    setStartStreetName(null);
    setStartStreetLookupFailed(false);
    setIsResolvingStart(Boolean(point));
  };

  const handleChangeEnd = (point: LocationPoint | null) => {
    setEndPoint(point);
    setEndStreetName(null);
    setEndStreetLookupFailed(false);
    setIsResolvingEnd(Boolean(point));
  };

  // Menghapus titik awal dan akhir.
  const handleReset = () => {
    handleChangeStart(null);
    handleChangeEnd(null);
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
        startStreetName={startStreetName}
        endStreetName={endStreetName}
        isResolvingStart={isResolvingStart}
        isResolvingEnd={isResolvingEnd}
        startStreetLookupFailed={startStreetLookupFailed}
        endStreetLookupFailed={endStreetLookupFailed}
        onOpenLocation={handleOpenLocation}
      />

      {isLocationOpen && (
        <ReportPopUp
          startPoint={startPoint}
          endPoint={endPoint}
          startStreetName={startStreetName}
          endStreetName={endStreetName}
          isResolvingStart={isResolvingStart}
          isResolvingEnd={isResolvingEnd}
          startStreetLookupFailed={startStreetLookupFailed}
          endStreetLookupFailed={endStreetLookupFailed}
          activePoint={activePoint}
          onChangeActive={setActivePoint}
          onChangeStart={handleChangeStart}
          onChangeEnd={handleChangeEnd}
          onReset={handleReset}
          onSave={handleSaveLocation}
          onClose={() => setIsLocationOpen(false)}
        />
      )}
    </main>
  );
};

export default ReportLayout;
