export type ReportCategory =
  | "Perbaikan"
  | "Upacara"
  | "Bencana"
  | "Event"
  | "Lainnya";

export type ReportStatus = "ditutup" | "dibuka";

export interface RoadClosureReport {
  id: string;
  title: string;
  streetName: string;
  category: ReportCategory;
  status: ReportStatus;
  description: string;
  coordinate: [number, number]; // Titik penanda utama [latitude, longitude]
  roadPath: Array<[number, number]>; // Garis ruas jalan yang terdampak (Polyline)
  reportedAt: string;
}

// Data dummy laporan penutupan & pembukaan jalan di wilayah Sanur
// Seluruh koordinat berada di dalam batasan SANUR_BOUNDS [-8.721, 115.238] s/d [-8.668, 115.283]
export const mockReports: RoadClosureReport[] = [
  // {
  //   // id: "rep-bypass-sanur",
  //   // title: "Penutupan Ruas Jl. Bypass Ngurah Rai",
  //   // streetName: "Jl. Bypass Ngurah Rai",
  //   // category: "Perbaikan",
  //   // status: "ditutup",
  //   // description:
  //   //   "Penutupan jalur dari Simpang Hang Tuah sampai Simpang Danau Buyan sepanjang ±800 meter.",
  //   // coordinate: [-8.674406, 115.252204],
  //   // roadPath: [
  //   //   [-8.674406, 115.252204],
  //   //   [-8.678, 115.25232],
  //   //   [-8.681515, 115.252444],
  //   // ],
  //   // reportedAt: "2026-11-05 08:30",
  // },
  // {
  //   id: "rep-001",
  //   title: "Penutupan Jl. Danau Tamblingan untuk Pelebaran Trotoar",
  //   streetName: "Jl. Danau Tamblingan",
  //   category: "Perbaikan",
  //   status: "ditutup",
  //   description: "Pekerjaan gorong-gorong dan perbaikan trotoar jalan utama.",
  //   coordinate: [-8.6945, 115.2618],
  //   roadPath: [
  //     [-8.6912, 115.2625],
  //     [-8.6945, 115.2618],
  //     [-8.6978, 115.2612],
  //   ],
  //   reportedAt: "2026-11-04 08:30",
  // },

  // {
  //   id: "rep-003",
  //   title: "Pohon Tumbang Akibat Angin Kencang",
  //   streetName: "Jl. Danau Poso",
  //   category: "Bencana",
  //   status: "ditutup",
  //   description: "Pohon tumbang menghalangi sebagian besar badan jalan.",
  //   coordinate: [-8.7082, 115.2528],
  //   roadPath: [
  //     [-8.7065, 115.2533],
  //     [-8.7082, 115.2528],
  //     [-8.7105, 115.2522],
  //   ],
  //   reportedAt: "2026-11-05 06:45",
  // },
  // {
  //   id: "rep-004",
  //   title: "Sanur Village Festival Fun Run",
  //   streetName: "Jl. Pantai Sindhu",
  //   category: "Event",
  //   status: "ditutup",
  //   description: "Jalur dialihkan sementara untuk rute lari santai pagi.",
  //   coordinate: [-8.6865, 115.2612],
  //   roadPath: [
  //     [-8.6862, 115.2585],
  //     [-8.6865, 115.2612],
  //     [-8.6868, 115.2642],
  //   ],
  //   reportedAt: "2026-11-05 07:00",
  // },
  // {
  //   id: "rep-005",
  //   title: "Pengaspalan Ulang Selesai",
  //   streetName: "Jl. Danau Buyan",
  //   category: "Perbaikan",
  //   status: "dibuka",
  //   description: "Pengaspalan telah rampung dan jalan sudah dibuka kembali.",
  //   coordinate: [-8.6772, 115.2546],
  //   roadPath: [
  //     [-8.6752, 115.253],
  //     [-8.6772, 115.2546],
  //     [-8.6795, 115.2568],
  //   ],
  //   reportedAt: "2026-11-03 17:00",
  // },
  // {
  //   id: "rep-006",
  //   title: "Pembersihan Saluran Air Selesai",
  //   streetName: "Jl. Cemara",
  //   category: "Lainnya",
  //   status: "dibuka",
  //   description: "Pembersihan gorong-gorong telah selesai, lalu lintas lancar.",
  //   coordinate: [-8.7125, 115.2572],
  //   roadPath: [
  //     [-8.7102, 115.2578],
  //     [-8.7125, 115.2572],
  //     [-8.7148, 115.2565],
  //   ],
  //   reportedAt: "2026-11-04 11:20",
  // },
  {
    id: "rep-hang-tuah",
    title: "Penutupan Total Jl. Hang Tuah",
    streetName: "Jl. Hang Tuah",
    category: "Upacara",
    status: "ditutup",
    description:
      "Penutupan total ruas Jalan Hang Tuah untuk kendaraan dari kedua arah.",
    coordinate: [-8.674638, 115.258098],
    roadPath: [
      [-8.67462, 115.257134],
      [-8.674638, 115.258098],
      [-8.674575, 115.258773],
    ],
    reportedAt: "2026-11-06 13:00",
  },

  {
    id: "rep-segara-ayu",
    title: "Jalan Segara Ayu Sudah Dibuka Kembali",
    streetName: "Jl. Segara Ayu",
    category: "Perbaikan",
    status: "dibuka",
    description:
      "Ruas Jalan Segara Ayu sudah dibuka kembali dan dapat dilalui kendaraan.",
    coordinate: [-8.68246, 115.262639],
    roadPath: [
      [-8.682447, 115.262359],
      [-8.68246, 115.262639],
      [-8.682483, 115.263111],
    ],
    reportedAt: "2026-11-06 14:00",
  },
];
