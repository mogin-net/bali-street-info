import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";

interface HeadProps {
  onBack?: () => void;
}

const Head = ({ onBack }: HeadProps) => {
  return (
    <header className="report-header">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label="Kembali"
      >
        <ArrowLeft className="report-header__back-icon" />
      </Button>

      <h1 className="report-header__title">
        Lapor Penutupan Jalan
      </h1>
    </header>
  );
};

export default Head;
