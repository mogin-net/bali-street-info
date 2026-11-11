import { Route, Routes } from "react-router-dom";
import ReportPage from "./pages/report";
import Home from "./pages/home";
import DetailInfo from "./pages/detailInfo";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />}>
        <Route path="detail/:reportId" element={<DetailInfo />} />
      </Route>
      <Route path="/report" element={<ReportPage />} />
    </Routes>
  );
}

export default App;
