
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
    <rect width="10" height="10" x="7" y="7" rx="2" />
    <path d="m7 7-3-3" />
    <path d="m17 7 3-3" />
    <path d="m7 17-3 3" />
    <path d="m17 17 3 3" />
    <path d="M2 2h4" />
    <path d="M18 2h4" />
    <path d="M2 22h4" />
    <path d="M18 22h4" />
  </svg>
);

export default DroneIcon;
