interface KeystepLogoProps {
  className?: string;
}

const KeystepLogo = ({ className = "w-6 h-6" }: KeystepLogoProps) => {
  return (
    <svg 
      viewBox="0 0 60 24" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Key head - target design */}
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="6"/>
      <circle cx="12" cy="12" r="4" fill="currentColor"/>
      
      {/* Key shaft */}
      <rect x="20" y="9" width="18" height="6" rx="1" fill="currentColor"/>
      
      {/* Key teeth - three ascending bars */}
      <rect x="33" y="7" width="5" height="10" fill="currentColor"/>
      <rect x="39" y="4" width="5" height="13" fill="currentColor"/>
      <rect x="45" y="1" width="5" height="16" fill="currentColor"/>
    </svg>
  );
};

export default KeystepLogo;
