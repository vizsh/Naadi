import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NAADI · machine pulse intelligence',
    short_name: 'NAADI',
    description: 'Reads a small factory’s machines card by card, explains faults from physics, prices each repair window in rupees, and leaves the decision to the owner. Works offline.',
    start_url: '/floor',
    display: 'standalone',
    background_color: '#f3f4ef',
    theme_color: '#17191c',
    icons: [{ src: '/naadi.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
