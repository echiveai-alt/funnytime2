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
      {/* Key head - circle with inner ring */}
      <circle cx="12" cy="12" r="12" fill="currentColor"/>
      <circle cx="12" cy="12" r="6" fill="none" stroke="white" strokeWidth="2"/>
      
      {/* Key shaft */}
      <rect x="24" y="9" width="18" height="6" rx="1" fill="currentColor"/>
      
      {/* Key teeth - three bars with gradient overlay */}
      <rect x="35" y="5" width="4" height="10" fill="currentColor"/>
      <rect x="35" y="5" width="4" height="4" fill="white" opacity="0.3"/>
      
      <rect x="40" y="2" width="4" height="13" fill="currentColor"/>
      <rect x="40" y="2" width="4" height="5" fill="white" opacity="0.3"/>
      
      <rect x="45" y="0" width="4" height="15" fill="currentColor"/>
      <rect x="45" y="0" width="4" height="6" fill="white" opacity="0.3"/>
    </svg>
  );
};

export default KeystepLogo;
