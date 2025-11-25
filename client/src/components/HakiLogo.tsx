import { useLocalize } from '~/hooks';

interface HakiLogoProps {
  className?: string;
  logoSize?: string;
  textSize?: string;
}

export default function HakiLogo({
  className = '',
  logoSize = 'h-8',
  textSize = 'text-xl',
}: HakiLogoProps) {
  const localize = useLocalize();

  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <img
        src="assets/logo.svg"
        className={`${logoSize} object-contain`}
        alt={localize('com_ui_logo', { 0: 'Haki One' })}
      />
      <div className={textSize}>
        <span style={{ color: '#c1272d' }}>HAKI</span>
        <span className="text-black dark:text-white"> One</span>
      </div>
    </div>
  );
}
