const DEFAULT_SIZE = 36;

type LogoProps = {
  size?: number;
};

export const Logo = ({ size = DEFAULT_SIZE }: LogoProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 156 156"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-purple-500 dark:text-purple-300"
    >
      <path
        d="M138 95.1998V106.263L91.3878 106.115V94.6098L126.199 65.5509V50.8002H102.303V63.9283H91.0928V39.7372H138V73.0738L108.941 95.1998H138Z"
        fill="currentColor"
      />
      <path
        d="M75.3803 39.7371L57.2369 106.263H36.1434L18 39.7371H33.0457L45.1413 95.6423H49.419L61.5146 39.7371H75.3803Z"
        fill="currentColor"
      />
      <rect x="18" y="118.263" width="60" height="12" fill="#C6EDC3" />
      <rect
        x="78"
        y="118.263"
        width="60"
        height="12"
        className="dark: fill-[#F7BEC0] fill-[#FBD9D9]"
      />
    </svg>
  );
};
