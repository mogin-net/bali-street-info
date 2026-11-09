import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";

interface HeadProps {
  onBack?: () => void;
}

const Head = ({ onBack }: HeadProps) => {
  return (
    <header className="flex h-14 shrink-0 items-center border-b bg-white px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label="Kembali"
      >
        <ArrowLeft className="size-5" />
      </Button>

      <h1 className="flex-1 pr-10 text-center text-sm font-semibold">
        Lapor Penutupan Jalan
      </h1>
    </header>
  );
};

export default Head;
