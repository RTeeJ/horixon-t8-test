import { useState } from 'react';
import { FALLBACK_MENU_IMAGE, menuImage } from '../features/menu/menu-images';

type Props = { code: string; alt: string; className?: string };

export function MenuImage({ code, alt, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? FALLBACK_MENU_IMAGE : menuImage(code)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`.trim()}
    />
  );
}
