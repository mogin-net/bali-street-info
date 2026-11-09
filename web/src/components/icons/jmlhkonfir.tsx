import type { SVGProps } from "react";

type JumlahKonfirmasiProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

export default function JumlahKonfirmasi({
  size = "1em",
  width,
  height,
  ...props
}: JumlahKonfirmasiProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={width ?? size}
      height={height ?? size}
      fill="none"
      {...props}
    >
      <path
        d="M10.6666 14V12.6667C10.6666 11.1949 9.47169 10 7.99992 10H3.99992C2.52815 10 1.33325 11.1949 1.33325 12.6667V14"
        stroke="currentColor"
        strokeWidth={1.33333}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M10.6667 2.08533C11.8429 2.39024 12.6642 3.45164 12.6642 4.66666C12.6642 5.88168 11.8429 6.94308 10.6667 7.24799"
        stroke="currentColor"
        strokeWidth={1.33333}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M14.6667 14V12.6667C14.6658 11.4514 13.8434 10.3905 12.6667 10.0867"
        stroke="currentColor"
        strokeWidth={1.33333}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M3.33325 4.66667C3.33325 6.13844 4.52815 7.33333 5.99992 7.33333C7.47169 7.33333 8.66659 6.13844 8.66659 4.66667C8.66659 3.19489 7.47169 2 5.99992 2C4.52815 2 3.33325 3.19489 3.33325 4.66667H3.33325"
        stroke="currentColor"
        strokeWidth={1.33333}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}