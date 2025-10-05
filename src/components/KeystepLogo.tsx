interface KeystepLogoProps {
  className?: string;
}

const KeystepLogo = ({ className = "w-6 h-6" }: KeystepLogoProps) => {
  return (
    <svg 
      viewBox="0 0 60 28" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Key head - filled circle with ring */}
      <circle cx="14" cy="14" r="11" fill="currentColor"/>
      <circle cx="14" cy="14" r="6" fill="var(--background)"/>
      
      {/* Key shaft - thicker */}
      <rect x="24" y="11" width="20" height="6" rx="1" fill="currentColor"/>
      
      {/* Key teeth - thicker bars */}
      <rect x="38" y="6" width="5" height="12" fill="currentColor"/>
      <rect x="44" y="3" width="5" height="15" fill="currentColor"/>
      <rect x="50" y="0" width="5" height="18" fill="currentColor"/>
    </svg>
  );
};

export default KeystepLogo;
