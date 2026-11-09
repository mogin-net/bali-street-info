import { useEffect, useRef, useState, type FormEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Map as LeafletMap,
  TileLayer,
  CircleMarker,
  Marker,
  DivIcon,
  Polyline,
  LayerGroup,
  LatLngBounds,
  type LocationEvent,
} from "leaflet";
import "leaflet/styles.css";
import {
  MapPin,
  Info,
  Search,
  List,
  Construction,
  Ticket,
  SquareExclamationPoint,
  PartyPopper,
  CircleEllipsis,
  CircleX,
  CircleCheck,
  PenLine,
  Crosshair,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockReports } from "./mockReports";
import "./home.css";

const SANUR_CENTER: [number, number] = [-8.695, 115.254];
const SANUR_BOUNDS = new LatLngBounds([-8.721, 115.238], [-8.668, 115.283]);

const categories = [
  { name: "Semua", icon: List },
  { name: "Perbaikan", icon: Construction },
  { name: "Upacara", icon: Ticket },
  { name: "Bencana", icon: SquareExclamationPoint },
  { name: "Event", icon: PartyPopper },
  { name: "Lainnya", icon: CircleEllipsis },
] as const;

const legends = [
  { label: "Jalan ditutup", icon: CircleX },
  { label: "Jalan sudah dibuka", icon: CircleCheck },
] as const;

type Category = (typeof categories)[number]["name"];

type SearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

function getSanurPosition(result: SearchResult): [number, number] | null {
  const lat = Number(result.lat);
  const lon = Number(result.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const position: [number, number] = [lat, lon];
  return SANUR_BOUNDS.contains(position) ? position : null;
}

function Home() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const locationMarkerRef = useRef<CircleMarker | null>(null);
  const searchMarkerRef = useRef<CircleMarker | null>(null);
  const reportsLayerRef = useRef<LayerGroup | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const lastSearchAtRef = useRef<number | null>(null);

  const [activeCategory, setActiveCategory] = useState<Category>("Semua");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const map = new LeafletMap(container, {
      zoomControl: true,
      scrollWheelZoom: true,
      minZoom: 14,
      maxZoom: 19,
      maxBounds: SANUR_BOUNDS,
      maxBoundsViscosity: 1,
    }).setView(SANUR_CENTER, 16);

    mapRef.current = map;
    map.zoomControl?.setPosition("bottomright");

    new TileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      noWrap: true,
    }).addTo(map);

    reportsLayerRef.current = new LayerGroup().addTo(map);

    function keepMapInSanur() {
      map.invalidateSize({ pan: false });

      const minZoom = Math.max(
        14,
        Math.min(19, Math.ceil(map.getBoundsZoom(SANUR_BOUNDS, true))),
      );

      map.setMinZoom(minZoom);

      if (map.getZoom() < minZoom) {
        map.setZoom(minZoom, { animate: false });
      }

      map.panInsideBounds(SANUR_BOUNDS, { animate: false });
    }

    keepMapInSanur();

    const handleLocationFound = (event: LocationEvent) => {
      setIsLocating(false);
      console.log("Latitude:", event.latlng.lat);
      console.log("Longitude:", event.latlng.lng);
      console.log("Akurasi GPS:", event.accuracy, "meter");
      console.log("Di dalam batas Sanur:", SANUR_BOUNDS.contains(event.latlng));

      if (!SANUR_BOUNDS.contains(event.latlng)) {
        locationMarkerRef.current?.remove();
        locationMarkerRef.current = null;

        setLocationMessage(
          "Lokasi kamu berada di luar area Sanur. Peta tetap di Sanur.",
        );
        setTimeout(() => setLocationMessage(""), 5000);
        return;
      }

      if (locationMarkerRef.current) {
        locationMarkerRef.current.setLatLng(event.latlng);
      } else {
        locationMarkerRef.current = new CircleMarker(event.latlng, {
          radius: 8,
          color: "#FFFFFF",
          weight: 3,
          fillColor: "#2563EB",
          fillOpacity: 1,
        }).addTo(map);
      }

      setLocationMessage("");
      map.flyTo(event.latlng, Math.max(map.getMinZoom(), 17));
    };

    const handleLocationError = () => {
      setIsLocating(false);
      setLocationMessage(
        "Lokasi tidak ditemukan. Periksa izin lokasi di browser.",
      );
      setTimeout(() => setLocationMessage(""), 5000);
    };

    const handleMapClick = () => {
      setSelectedReportId(null);
    };

    map.on("locationfound", handleLocationFound);
    map.on("locationerror", handleLocationError);
    map.on("click", handleMapClick);

    const resizeObserver = new ResizeObserver(keepMapInSanur);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      searchAbortRef.current?.abort();

      map.off("locationfound", handleLocationFound);
      map.off("locationerror", handleLocationError);
      map.off("click", handleMapClick);
      map.stopLocate();

      reportsLayerRef.current?.clearLayers();
      reportsLayerRef.current?.remove();

      reportsLayerRef.current = null;
      locationMarkerRef.current = null;
      searchMarkerRef.current = null;
      mapRef.current = null;

      map.remove();
    };
  }, []);

  function renderReports(
    categoryToFilter: Category,
    currentSelectedId: string | null,
  ) {
    const layerGroup = reportsLayerRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();

    const displayedReports =
      categoryToFilter === "Semua"
        ? mockReports
        : mockReports.filter((report) => report.category === categoryToFilter);

    displayedReports.forEach((report) => {
      if (report.roadPath.length < 2) return;

      const isClosed = report.status === "ditutup";
      const isSelected = currentSelectedId === report.id;
      const statusColor = isClosed ? "#DC2626" : "#16A34A";

      const polyline = new Polyline(report.roadPath, {
        color: statusColor,
        weight: isSelected ? 8 : 6,
        opacity: isSelected ? 1 : 0.85,
        lineCap: "round",
        lineJoin: "round",
      });

      polyline.bindTooltip(
        `<div>
          <strong>${report.streetName}</strong>
          <br/>
          <span style="color:${statusColor};font-weight:600">
            ${isClosed ? "Jalan ditutup" : "Jalan sudah dibuka"}
          </span>
        </div>`,
        { sticky: true },
      );

      polyline.addTo(layerGroup);
      const markerPosition = polyline.getCenter();

      polyline.on("click", (event) => {
        event.originalEvent?.stopPropagation();

        setSelectedReportId((prev) => (prev === report.id ? null : report.id));

        mapRef.current?.panTo(markerPosition, { animate: true });
      });

      const size = isSelected ? 34 : 26;
      const anchor = size / 2;
      const iconSize = isSelected ? 16 : 12;

      const iconMarkup = renderToStaticMarkup(
        isClosed ? (
          <X size={iconSize} strokeWidth={3.5} color="#FFFFFF" />
        ) : (
          <Check size={iconSize} strokeWidth={3.5} color="#FFFFFF" />
        ),
      );

      const statusIcon = new DivIcon({
        className: `status-marker-icon ${
          isSelected ? "status-marker-selected" : ""
        }`,
        iconSize: [size, size],
        iconAnchor: [anchor, anchor],
        html: `
          <div style="
            width:${size}px;
            height:${size}px;
            background-color:${statusColor};
            border:${isSelected ? "3px" : "2.5px"} solid #FFFFFF;
            border-radius:50%;
            box-shadow:${
              isSelected
                ? "0 0 0 3px #191919, 0 4px 12px rgba(0,0,0,0.45)"
                : "0 2px 5px rgba(0,0,0,0.3)"
            };
            display:flex;
            align-items:center;
            justify-content:center;
            color:#FFFFFF;
            box-sizing:border-box;
            cursor:pointer;
            transition:transform 0.2s ease;
          ">
            ${iconMarkup}
          </div>
        `,
      });

      const marker = new Marker(markerPosition, {
        icon: statusIcon,
      });

      marker.bindTooltip(
        `<div>
          <strong>${report.streetName}</strong>
          <br/>
          <span>${report.title}</span>
        </div>`,
        {
          direction: "top",
          offset: [0, -10],
        },
      );

      marker.on("click", (event) => {
        event.originalEvent?.stopPropagation();

        setSelectedReportId((prev) => (prev === report.id ? null : report.id));

        mapRef.current?.panTo(markerPosition, { animate: true });
      });

      marker.addTo(layerGroup);

      if (isSelected) {
        marker.openTooltip();
      }
    });
  }

  useEffect(() => {
    renderReports(activeCategory, selectedReportId);
  }, [activeCategory, selectedReportId]);

  function chooseCategory(category: Category) {
    setActiveCategory(category);
  }

  function goToMyLocation() {
    const map = mapRef.current;
    if (!map || isLocating) return;

    if (!navigator.geolocation) {
      setLocationMessage("Browser tidak mendukung fitur lokasi.");
      return;
    }

    setIsLocating(true);
    setLocationMessage("");

    map.locate({
      setView: false,
      enableHighAccuracy: true,
      timeout: 10000,
    });
  }

  function showSearchResult(result: SearchResult, closeList = false) {
    const map = mapRef.current;
    const position = getSanurPosition(result);
    if (!map || !position) return;

    searchMarkerRef.current?.remove();

    searchMarkerRef.current = new CircleMarker(position, {
      radius: 9,
      color: "#FFFFFF",
      weight: 3,
      fillColor: "#F97316",
      fillOpacity: 1,
    }).addTo(map);

    searchMarkerRef.current.bindTooltip("Hasil pencarian", {
      direction: "top",
      offset: [0, -12],
    });

    map.flyTo(position, Math.max(map.getMinZoom(), 17));

    if (closeList) {
      setQuery(result.display_name.split(",")[0]);
      setSearchResults([]);
      setSearchMessage("");
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const searchTerm = query.trim();

    if (!searchTerm) {
      setSearchMessage("Masukkan nama jalan di Sanur.");
      return;
    }

    if (isSearching) return;

    const searchTime = event.timeStamp;

    if (
      lastSearchAtRef.current !== null &&
      searchTime - lastSearchAtRef.current < 1200
    ) {
      setSearchMessage("Tunggu sebentar sebelum mencari lagi.");
      return;
    }

    lastSearchAtRef.current = searchTime;
    searchAbortRef.current?.abort();

    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);
    setSearchResults([]);
    setSearchMessage("");

    const params = new URLSearchParams({
      q: searchTerm,
      format: "jsonv2",
      limit: "8",
      countrycodes: "id",
      viewbox: [
        SANUR_BOUNDS.getWest(),
        SANUR_BOUNDS.getNorth(),
        SANUR_BOUNDS.getEast(),
        SANUR_BOUNDS.getSouth(),
      ].join(","),
      bounded: "1",
    });

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        },
      );

      if (!response.ok) {
        throw new Error("Layanan pencarian sedang bermasalah.");
      }

      const data = (await response.json()) as SearchResult[];
      if (controller.signal.aborted) return;

      const sanurResults = data.filter(
        (result) => getSanurPosition(result) !== null,
      );

      if (sanurResults.length === 0) {
        setSearchMessage("Jalan tidak ditemukan di area Sanur pada peta.");
        return;
      }

      setSearchResults(sanurResults);
      showSearchResult(sanurResults[0]);
    } catch (error) {
      if (controller.signal.aborted) return;

      setSearchMessage(
        error instanceof Error ? error.message : "Pencarian gagal. Coba lagi.",
      );
    } finally {
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null;
        setIsSearching(false);
      }
    }
  }

  function changeSearchText(value: string) {
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    setIsSearching(false);
    setQuery(value);
    setSearchResults([]);
    setSearchMessage("");
  }

  return (
    <main className="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-[#F3F3F3]">
      <header className="relative z-[1300] shrink-0 bg-white px-3 pt-3 pb-2 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 rounded-2xl border border-[#E5E5E5] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#191919] sm:size-11">
            <MapPin size={22} strokeWidth={2} className="text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xs font-semibold leading-5 text-[#191919] sm:text-sm lg:text-base">
              Peta Penutupan Jalan Sanur
            </h1>
            <p className="truncate text-[10px] leading-4 text-[#858585] sm:text-xs">
              Informasi jalan ditutup di kawasan Sanur
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Informasi aplikasi"
            className="size-9 shrink-0 rounded-full text-[#191919] hover:bg-[#F3F3F3]"
          >
            <Info size={19} />
          </Button>
        </div>
      </header>

      <div className="relative z-[1200] shrink-0 bg-white px-3 pb-3 sm:px-6 lg:px-8">
        <form onSubmit={handleSearch} role="search" className="relative w-full">
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            disabled={isSearching}
            aria-label="Cari jalan"
            className="absolute top-1/2 left-1 z-10 size-8 -translate-y-1/2 text-[#999999]"
          >
            <Search size={18} />
          </Button>

          <Input
            type="search"
            value={query}
            onChange={(event) => changeSearchText(event.target.value)}
            placeholder="Cari jalan di Sanur..."
            aria-label="Cari jalan di Sanur"
            className="h-10 w-full rounded-xl border-[#E5E5E5] bg-white pr-3 pl-11 text-xs text-[#191919] shadow-sm placeholder:text-[#A0A0A0]"
          />

          {(isSearching || searchMessage || searchResults.length > 0) && (
            <div className="absolute top-12 right-0 left-0 z-10 max-h-56 overflow-y-auto rounded-xl border border-[#E5E5E5] bg-white p-2 text-xs shadow-lg">
              {isSearching && (
                <p className="px-2 py-1">Sedang mencari jalan di Sanur...</p>
              )}

              {searchMessage && (
                <p role="status" className="px-2 py-1">
                  {searchMessage}
                </p>
              )}

              {searchResults.map((result) => (
                <Button
                  key={result.place_id}
                  type="button"
                  variant="ghost"
                  onClick={() => showSearchResult(result, true)}
                  className="h-auto w-full justify-start gap-2 whitespace-normal rounded-lg px-2 py-2 text-left text-xs text-[#191919]"
                >
                  <MapPin size={15} className="shrink-0" />
                  <span className="min-w-0 break-words">
                    {result.display_name}
                  </span>
                </Button>
              ))}
            </div>
          )}
        </form>
      </div>

      <section className="relative min-h-0 min-w-0 flex-1">
        <div
          ref={mapContainerRef}
          className="home-map h-full w-full"
          role="region"
          aria-label="Peta interaktif wilayah Sanur"
        />

        <nav
          aria-label="Filter kategori laporan"
          className="pointer-events-auto absolute left-1/2 top-3 z-[1100] w-max max-w-[calc(100%-24px)] -translate-x-1/2 overflow-x-auto rounded-xl border border-[#D5D5D5] bg-white/95 p-2 shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-w-[calc(100%-48px)]"
        >
          <div className="flex w-max items-center gap-2">
            {categories.map(({ name, icon: Icon }) => (
              <Button
                key={name}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={activeCategory === name}
                onClick={() =>
                  chooseCategory(
                    activeCategory === name && name !== "Semua"
                      ? "Semua"
                      : name,
                  )
                }
                className={`h-9 shrink-0 gap-2 rounded-lg border px-3 text-xs shadow-sm ${
                  activeCategory === name
                    ? "border-[#191919] bg-[#191919] text-white hover:bg-[#333333] hover:text-white"
                    : "border-[#D5D5D5] bg-white text-[#191919] hover:bg-[#F3F3F3] hover:text-[#191919]"
                }`}
              >
                <Icon size={16} strokeWidth={2} className="shrink-0" />
                <span>{name}</span>
              </Button>
            ))}
          </div>
        </nav>

        <div className="pointer-events-none absolute right-3 bottom-[180px] z-[1100] flex flex-col items-end gap-2 sm:right-4 sm:bottom-[200px]">
          {(isLocating || locationMessage) && (
            <div
              role="status"
              className="pointer-events-auto max-w-60 rounded-lg bg-white px-3 py-2 text-xs text-[#191919] shadow-md"
            >
              {isLocating ? "Sedang mencari lokasi..." : locationMessage}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={goToMyLocation}
            disabled={isLocating}
            aria-label="Lokasi Saya (khusus Sanur)"
            title="Lokasi Saya"
            className="pointer-events-auto size-10 rounded-xl border border-[#E5E5E5] bg-white text-[#191919] shadow-md sm:size-11"
          >
            <Crosshair
              size={21}
              className={isLocating ? "animate-pulse" : ""}
            />
          </Button>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[1100] px-3 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-2">
            <div className="pointer-events-auto flex shrink-0 flex-col gap-1.5 rounded-xl border border-[#E5E5E5] bg-white px-2 py-2 shadow-md sm:gap-2 sm:px-3">
              {legends.map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-1.5 sm:gap-2">
                  <Icon size={16} className="shrink-0 text-[#191919]" />
                  <span className="whitespace-nowrap text-[9px] text-[#191919] sm:text-xs">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <Button
              type="button"
              disabled
              aria-label="Laporkan Penutupan"
              className="pointer-events-auto h-10 shrink-0 gap-1.5 rounded-full bg-[#191919] px-2.5 text-[10px] text-white shadow-md disabled:bg-[#191919] disabled:text-white disabled:opacity-100 sm:gap-2 sm:px-4 sm:text-xs"
            >
              <PenLine size={16} className="shrink-0" />
              <span className="hidden min-[360px]:inline">
                Laporkan Penutupan
              </span>
              <span className="min-[360px]:hidden">Laporkan</span>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;
