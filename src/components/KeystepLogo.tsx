interface KeystepLogoProps {
  className?: string;
}

const KeystepLogo = ({ className = "w-6 h-6" }: KeystepLogoProps) => {
  return (
    <svg 
      viewBox="0 0 56 24" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Key head - hollow ring */}
      <circle cx="12" cy="12" r="12" fill="none" stroke="currentColor" strokeWidth="5"/>
      
      {/* Key shaft */}
      <rect x="22" y="10" width="18" height="4" rx="1" fill="currentColor"/>
      
      {/* Key teeth - three bars with gradient overlay */}
      <rect x="34" y="6" width="4" height="10" fill="currentColor"/>
      <rect x="34" y="6" width="4" height="4" fill="white" opacity="0.3"/>
      
      <rect x="39" y="3" width="4" height="13" fill="currentColor"/>
      <rect x="39" y="3" width="4" height="5" fill="white" opacity="0.3"/>
      
      <rect x="44" y="1" width="4" height="15" fill="currentColor"/>
      <rect x="44" y="1" width="4" height="6" fill="white" opacity="0.3"/>
    </svg>
  );
};

export default KeystepLogo;
