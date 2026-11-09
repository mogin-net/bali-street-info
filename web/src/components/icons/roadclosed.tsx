import type { SVGProps } from "react";

type RoadClosedProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

export default function RoadClosed({
  size = "1em",
  ...props
}: RoadClosedProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      {...props}
    >
      <path
        d="M9.66736 5.66704L7.6672 7.6672M7.6672 7.6672L5.66704 9.66736M7.6672 7.6672L5.66704 5.66704M7.6672 7.6672L9.66736 9.66736M14.3344 7.6672C14.3344 11.3494 11.3494 14.3344 7.6672 14.3344C3.98501 14.3344 1 11.3494 1 7.6672C1 3.98501 3.98501 1 7.6672 1C11.3494 1 14.3344 3.98501 14.3344 7.6672Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}