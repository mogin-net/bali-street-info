import { useEffect, useState } from "react";

import Head from "./head";
import ReportList, { type LocationPoint } from "./reportList";
import ReportPopUp from "./partials/reportPopUp";
import {
  getNearestStreetName,
  getReportErrorMessage,
  resolveStreetRoute,
  type RoutePreview,
} from "@/services/reportService";

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
  const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);
  const [isResolvingRoute, setIsResolvingRoute] = useState(false);
  const [routePreviewError, setRoutePreviewError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    if (!startPoint || !endPoint) return;

    resolveStreetRoute(startPoint, endPoint)
      .then((route) => {
        if (isCurrent) setRoutePreview(route);
      })
      .catch((error: unknown) => {
        console.error("Gagal memeriksa jalur laporan:", error);
        if (isCurrent) setRoutePreviewError(getReportErrorMessage(error));
      })
      .finally(() => {
        if (isCurrent) setIsResolvingRoute(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [startPoint, endPoint]);

  useEffect(() => {
    let isCurrent = true;

    if (!startPoint) return;
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
  }, [startPoint]);

  useEffect(() => {
    let isCurrent = true;

    if (!endPoint) return;
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
  }, [endPoint]);

  // Membuka popup dan menentukan titik yang akan diedit.
  const handleOpenLocation = (point: "start" | "end" = "end") => {
    setActivePoint(point);
    setIsLocationOpen(true);
  };

  const handleChangeStart = (point: LocationPoint | null) => {
    setRoutePreview(null);
    setRoutePreviewError(null);
    setIsResolvingRoute(Boolean(point && endPoint));
    setStartPoint(point);
    setStartStreetName(null);
    setStartStreetLookupFailed(false);
    setIsResolvingStart(Boolean(point));
  };

  const handleChangeEnd = (point: LocationPoint | null) => {
    setRoutePreview(null);
    setRoutePreviewError(null);
    setIsResolvingRoute(Boolean(startPoint && point));
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
    <main className="report-page">
      <Head onBack={() => window.history.back()} />

      <ReportList
        startPoint={startPoint}
        endPoint={endPoint}
        startStreetName={routePreview?.start_street_name ?? startStreetName}
        endStreetName={routePreview?.end_street_name ?? endStreetName}
        isResolvingStart={isResolvingStart}
        isResolvingEnd={isResolvingEnd}
        startStreetLookupFailed={startStreetLookupFailed}
        endStreetLookupFailed={endStreetLookupFailed}
        routePreview={routePreview}
        isResolvingRoute={isResolvingRoute}
        routePreviewError={routePreviewError}
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
