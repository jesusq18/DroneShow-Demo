
import React from 'react';

const DroneIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 18a.969.969 0 0 0 .969-.969V12" />
    <path d="M12 6.01V6" />
    <path d="m18.36 12 .01.01" />
    <path d="m5.64 12 .01.01" />
    <path d="M12 12h.01" />
    <path d="M18.36 5.64.01.01" />
    <path d="m5.64 18.36 .01.01" />
    <path d="m18.36 18.36-.01-.01" />
    <path d="m5.64 5.64-.01-.01" />
    <path d="M22 12c0 4-8 4-8 4s-8 0-8-4 8-10 8-10 8 6 8 10Z" />
    <path d="M2 12c0 4 8 4 8 4s8 0 8-4-8-10-8-10S2 8 2 12Z" />
  </svg>
);

export default DroneIcon;
