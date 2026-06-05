import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  // Synchronously initialize with the correct value so there is no layout flash
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    
    const listener = () => setMatches(media.matches);
    
    // Modern browsers support addEventListener, fallback to addListener for older
    if (media.addEventListener) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } else if ('addListener' in media) {
      // @ts-ignore - legacy support
      media.addListener(listener);
      // @ts-ignore - legacy support
      return () => media.removeListener(listener);
    }
  }, [matches, query]);

  return matches;
}
