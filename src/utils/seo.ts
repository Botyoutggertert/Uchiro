import { Product } from '../types';

export interface SeoMetaOptions {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product';
  price?: number;
  currency?: string;
  availability?: 'instock' | 'oos';
}

const DEFAULT_TITLE = 'Uchiro Store - Cambodia Gaming Marketplace';
const DEFAULT_DESC =
  'Premium Roblox & gaming marketplace with full KHQR instant USD payment integration, accounts with 14-day warranty, permanent Blox Fruits, and fast delivery.';
const DEFAULT_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAJbPmK_4tXbPo7csvq5Th9P3jTxJ0832ZJXjTEiILWmnuAzoW1cThcH0p1D2Er4LY0IgbfX0j5zzK5XO26Ej73VWHE9q3JXLYadZTOJdYu9tOtAX3vKWuuA1SA8xJA_w9FyaBAERQu816-BlDrGtKKhocghmuzg37LdL7w50CkOyb9f468g3emhq45yCP_vgOhUNTOa_3i5RhaG75oQop7T6CoQMJxn39S1XxyclZ7BACOn4MgqXrE';

function setMetaTag(nameOrProperty: 'name' | 'property', attrValue: string, content: string) {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[${nameOrProperty}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(nameOrProperty, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonicalUrl(url: string) {
  if (typeof document === 'undefined') return;
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

/**
 * Dynamically updates document.title, Open Graph tags, and Twitter card meta tags for a specific product.
 */
export function updateProductSeo(product: Product) {
  if (typeof window === 'undefined') return;
  const currentUrl = `${window.location.origin}/product/${encodeURIComponent(product.id)}`;
  const price = typeof product.priceUSD === 'number' ? product.priceUSD : (product.price || 0);
  const isAvailable = !product.isSold && (product.stock ?? 1) > 0;

  const displayTitle = product.titleKhmer
    ? `${product.title} (${product.titleKhmer}) - $${price.toFixed(2)} | Uchiro Store`
    : `${product.title} - $${price.toFixed(2)} | Uchiro Store Cambodia`;

  const rawDesc = product.descriptionKhmer || product.description || 'Premium Roblox gaming item with instant delivery and official warranty.';
  const fullDesc = `${rawDesc} • Price: $${price.toFixed(2)} USD via Instant KHQR. Official 14-Day Warranty & 100% Safe.`;
  const img = product.image || DEFAULT_IMAGE;

  // Browser tab title
  document.title = displayTitle;

  // Basic HTML meta
  setMetaTag('name', 'description', fullDesc);

  // Open Graph / Facebook / Discord / Telegram / WhatsApp
  setMetaTag('property', 'og:title', displayTitle);
  setMetaTag('property', 'og:description', fullDesc);
  setMetaTag('property', 'og:image', img);
  setMetaTag('property', 'og:image:secure_url', img);
  setMetaTag('property', 'og:image:alt', product.title);
  setMetaTag('property', 'og:url', currentUrl);
  setMetaTag('property', 'og:type', 'product');
  setMetaTag('property', 'og:site_name', 'Uchiro Store Cambodia');
  setMetaTag('property', 'product:price:amount', price.toFixed(2));
  setMetaTag('property', 'product:price:currency', 'USD');
  setMetaTag('property', 'product:availability', isAvailable ? 'instock' : 'oos');

  // Twitter Cards
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', displayTitle);
  setMetaTag('name', 'twitter:description', fullDesc);
  setMetaTag('name', 'twitter:image', img);
  setMetaTag('name', 'twitter:image:alt', product.title);
  setMetaTag('name', 'twitter:site', '@UchiroStore');
  setMetaTag('name', 'twitter:creator', '@UchiroStore');

  // Canonical tag
  setCanonicalUrl(currentUrl);
}

/**
 * Resets document title, Open Graph tags, and Twitter card meta tags to default store branding.
 */
export function resetDefaultSeo() {
  if (typeof window === 'undefined') return;
  const currentUrl = `${window.location.origin}/`;

  document.title = DEFAULT_TITLE;
  setMetaTag('name', 'description', DEFAULT_DESC);

  setMetaTag('property', 'og:title', DEFAULT_TITLE);
  setMetaTag('property', 'og:description', DEFAULT_DESC);
  setMetaTag('property', 'og:image', DEFAULT_IMAGE);
  setMetaTag('property', 'og:image:secure_url', DEFAULT_IMAGE);
  setMetaTag('property', 'og:url', currentUrl);
  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:site_name', 'Uchiro Store Cambodia');

  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', DEFAULT_TITLE);
  setMetaTag('name', 'twitter:description', DEFAULT_DESC);
  setMetaTag('name', 'twitter:image', DEFAULT_IMAGE);
  setMetaTag('name', 'twitter:site', '@UchiroStore');
  setMetaTag('name', 'twitter:creator', '@UchiroStore');

  setCanonicalUrl(currentUrl);
}

/**
 * Generates direct share URL for a product.
 */
export function getProductShareUrl(productId: string): string {
  if (typeof window === 'undefined') return `/product/${encodeURIComponent(productId)}`;
  return `${window.location.origin}/product/${encodeURIComponent(productId)}`;
}
