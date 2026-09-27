import { useEffect } from 'react';

/**
 * usePageMetadata Hook
 * Deterministically applies document title, description, canonical link,
 * robots, Open Graph, and Twitter metadata to the DOM for SEO & prerendering.
 * Sets data-prerender-ready="true" on document.documentElement once metadata is active.
 */
export function usePageMetadata({
  title,
  description,
  canonicalPath = '',
  robots = 'index, follow',
  ogType = 'website'
}) {
  useEffect(() => {
    // 1. Title
    if (title) {
      document.title = title;
    }

    // 2. Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    if (description) {
      metaDesc.setAttribute('content', description);
    }

    // 3. Meta Robots
    let metaRobots = document.querySelector('meta[name="robots"]');
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.name = 'robots';
      document.head.appendChild(metaRobots);
    }
    if (robots) {
      metaRobots.setAttribute('content', robots);
    }

    // 4. Canonical Tag (Anchored to production origin or current domain)
    const productionOrigin =
      (typeof window !== 'undefined' && window.__PRODUCTION_ORIGIN__) ||
      (import.meta.env.VITE_FRONTEND_URL ? import.meta.env.VITE_FRONTEND_URL.replace(/\/+$/, '') : '') ||
      (typeof window !== 'undefined' && !window.location.origin.includes('127.0.0.1') && !window.location.origin.includes('localhost')
        ? window.location.origin
        : '');

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      canonicalLink.id = 'canonical-tag';
      document.head.appendChild(canonicalLink);
    }

    const cleanPath = canonicalPath === '/' ? '' : canonicalPath.replace(/\/+$/, '');
    if (productionOrigin) {
      canonicalLink.setAttribute('href', `${productionOrigin}${cleanPath}`);
    }

    // 5. Open Graph Meta Tags
    const setOgMeta = (property, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setOgMeta('og:title', title);
    setOgMeta('og:description', description);
    setOgMeta('og:type', ogType);
    if (productionOrigin) {
      setOgMeta('og:url', `${productionOrigin}${cleanPath}`);
    }

    // 6. Twitter Card Meta Tags
    const setTwitterMeta = (name, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setTwitterMeta('twitter:card', 'summary_large_image');
    setTwitterMeta('twitter:title', title);
    setTwitterMeta('twitter:description', description);

    // 7. Mark DOM deterministically ready for static headless snapshot engines
    document.documentElement.setAttribute('data-prerender-ready', 'true');
    if (typeof window !== 'undefined') {
      window.__PRERENDER_METADATA_READY__ = true;
    }

    return () => {
      document.documentElement.removeAttribute('data-prerender-ready');
      if (typeof window !== 'undefined') {
        delete window.__PRERENDER_METADATA_READY__;
      }
    };
  }, [title, description, canonicalPath, robots, ogType]);
}

export default usePageMetadata;
