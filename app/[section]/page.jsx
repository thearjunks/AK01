import { notFound } from 'next/navigation';
import Dashboard from '../Dashboard.jsx';

export const dynamic = 'force-dynamic';

const sections = {
  overview: 'overview',
  'booster-ads': 'boosted',
  'boosted-ads': 'boosted',
  organic: 'organicInstagram',
  'organic-instagram': 'organicInstagram',
  'organic-facebook': 'organicFacebook',
  'organic-tiktok': 'organicTikTok',
  'organic-twitter': 'organicTwitter',
  'plan-comparison': 'plans',
  'banner-comparison': 'banners',
  'device-comparison': 'devices',
};

export default async function SectionPage({ params }) {
  const { section } = await params;
  const activeSection = sections[section];

  if (!activeSection) notFound();

  return <Dashboard initialSection={activeSection} />;
}
