import type { SVGProps } from "react";

const BaseIcon = ({ children, ...props }: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const GlobeIcon = (props: SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.8 2.7 2.8 15.3 0 18" />
    <path d="M12 3c-2.8 2.7-2.8 15.3 0 18" />
  </BaseIcon>
);

export const LogoutIcon = (props: SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </BaseIcon>
);

export const LoginIcon = (props: SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="m10 17-5-5 5-5" />
    <path d="M15 12H5" />
  </BaseIcon>
);

export const SaveIcon = (props: SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8" />
    <path d="M7 3v5h8" />
  </BaseIcon>
);

export const ShareIcon = (props: SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4" />
    <path d="m15.4 6.5-6.8 4" />
  </BaseIcon>
);

export const MapIcon = (props: SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
    <path d="M9 3v15" />
    <path d="M15 6v15" />
  </BaseIcon>
);

export const ListIcon = (props: SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <path d="M8 6h13" />
    <path d="M8 12h13" />
    <path d="M8 18h13" />
    <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
  </BaseIcon>
);

export const SparkIcon = (props: SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2z" />
    <path d="M5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16z" />
  </BaseIcon>
);

export const PinIcon = ({ color = "#0ea5e9", ...props }: SVGProps<SVGSVGElement> & { color?: string }) => (
  <svg viewBox="0 0 28 28" aria-hidden="true" {...props}>
    <path d="M14 2c-4.8 0-8.7 3.8-8.7 8.5 0 6.2 8.7 15.5 8.7 15.5s8.7-9.3 8.7-15.5C22.7 5.8 18.8 2 14 2z" fill={color} />
    <circle cx="14" cy="10.6" r="4.2" fill="white" />
  </svg>
);

export const PlaneIcon = (props: SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <path d="M2 16l20-8-6 12-4-5-5 4-1-3-4 0z" />
  </BaseIcon>
);

export const ProgressIcon = (props: SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <path d="M12 4v4" />
    <path d="M12 16v4" />
    <path d="M4 12h4" />
    <path d="M16 12h4" />
    <path d="m6.3 6.3 2.8 2.8" />
    <path d="m14.9 14.9 2.8 2.8" />
    <path d="m17.7 6.3-2.8 2.8" />
    <path d="m9.1 14.9-2.8 2.8" />
  </BaseIcon>
);
