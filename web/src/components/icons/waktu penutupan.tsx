import type { SVGProps } from "react";

type WaktuPenutupanProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

export default function WaktuPenutupan({
  size = "1em",
  width,
  height,
  ...props
}: WaktuPenutupanProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={width ?? size}
      height={height ?? size}
      fill="none"
      {...props}
    >
      <g clipPath="url(#waktu-penutupan-clip)">
        <path
          d="M1.33325 8.00001C1.33325 11.6794 4.32049 14.6667 7.99992 14.6667C11.6794 14.6667 14.6666 11.6794 14.6666 8.00001C14.6666 4.32058 11.6794 1.33334 7.99992 1.33334C4.32049 1.33334 1.33325 4.32058 1.33325 8.00001V8.00001"
          stroke="currentColor"
          strokeWidth={1.33333}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M8 4V8L10.6667 9.33333"
          stroke="currentColor"
          strokeWidth={1.33333}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <defs>
        <clipPath id="waktu-penutupan-clip">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}