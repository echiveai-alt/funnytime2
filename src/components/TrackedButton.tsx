import { Button, ButtonProps } from '@/components/ui/button';
import { useClickTracking } from '@/hooks/useClickTracking';

interface TrackedButtonProps extends ButtonProps {
  trackingLabel?: string;
  trackingCat1?: string;
  trackingCat2?: string;
  trackingCat3?: string;
  trackingMetadata?: Record<string, any>;
}

export const TrackedButton = ({ 
  trackingLabel, 
  trackingCat1,
  trackingCat2,
  trackingCat3,
  trackingMetadata,
  onClick,
  children,
  ...props 
}: TrackedButtonProps) => {
  const { trackClick } = useClickTracking();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    trackClick({
      component: 'button',
      label: trackingLabel || (typeof children === 'string' ? children : undefined),
      cat1: trackingCat1,
      cat2: trackingCat2,
      cat3: trackingCat3,
      metadata: trackingMetadata
    });
    
    onClick?.(e);
  };

  return (
    <Button onClick={handleClick} {...props}>
      {children}
    </Button>
  );
};
