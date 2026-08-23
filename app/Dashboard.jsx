'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, ArrowUpRight, BarChart3, Bell, ChevronRight, CircleAlert,
  Camera, Download, Eye, Filter, Grid2X2, LayoutDashboard,
  Heart, MessageCircle, Menu, RefreshCw, Search, Smartphone,
  Share2, Sparkles, Target, TrendingUp, X,
} from 'lucide-react';

const logoUrl = 'https://www.stc.com.kw/icons/stc-logo-purple.svg';
const providers = [
  { key: 'stc', name: 'stc Kuwait', id: '85631962851', color: '#4f008c' },
  { key: 'ooredoo', name: 'Ooredoo Kuwait', id: '181832232881', color: '#ed1c24' },
  { key: 'zain', name: 'Zain Kuwait', id: '114476661945257', color: '#00a651' },
];
const planProviders = providers;
const adProviders = [
  ...providers,
  { key: 'virgin', name: 'Virgin Mobile Kuwait', id: '1293796630758728', color: '#e0007a' },
  { key: 'redbull', name: 'Red Bull Mobile by Zain', id: '106380039071315', color: '#132257' },
  { key: 'tawseel', name: 'Zain-tawseel', id: '444661005390298', color: '#00a651' },
  { key: 'gamez', name: 'Gamez Card', id: '101008544936040', color: '#f59e0b' },
];
const bannerCategories = ['Homepage Offers', 'Homepage Carousel', 'Offer Banners', 'Homepage Hero', 'Offers News More'];
const deviceCategories = ['Smartphones', 'Tablets', 'Laptops', 'Internet Devices', 'Gaming', 'Accessories', 'Smartwatches', 'TV'];
const deviceSourceLinks = [
  { provider: 'ooredoo', label: 'Ooredoo smartphones', url: 'https://store.ooredoo.com.kw/gadgets/smartphones.html' },
  { provider: 'zain', label: 'Zain smartphones', url: 'https://www.kw.zain.com/en/shop/smartphones' },
  { provider: 'stc', label: 'stc smartphones', url: 'https://www.stc.com.kw/en/e-store/grid/smartphone' },
  { provider: 'stc', label: 'stc internet devices', url: 'https://www.stc.com.kw/en/e-store/grid/router' },
  { provider: 'zain', label: 'Zain internet devices', url: 'https://www.kw.zain.com/en/shop/internet-devices' },
  { provider: 'ooredoo', label: 'Ooredoo internet devices', url: 'https://store.ooredoo.com.kw/gadgets/internet-devices.html' },
  { provider: 'stc', label: 'stc tablets', url: 'https://www.stc.com.kw/en/e-store/grid/tablet' },
  { provider: 'zain', label: 'Zain tablets', url: 'https://www.kw.zain.com/en/shop/tablets' },
  { provider: 'ooredoo', label: 'Ooredoo tablets/laptops', url: 'https://store.ooredoo.com.kw/gadgets/tablets-laptops.html' },
  { provider: 'zain', label: 'Zain laptops', url: 'https://www.kw.zain.com/en/shop/laptops' },
  { provider: 'stc', label: 'stc gaming, accessories, watches and TV filters', url: 'https://www.stc.com.kw/en/e-store/grid/gamingconsole' },
  { provider: 'zain', label: 'Zain gaming', url: 'https://www.kw.zain.com/en/shop/gaming' },
  { provider: 'ooredoo', label: 'Ooredoo gaming', url: 'https://store.ooredoo.com.kw/gadgets/gaming.html' },
  { provider: 'zain', label: 'Zain headsets/accessories', url: 'https://www.kw.zain.com/en/shop/headsets' },
  { provider: 'ooredoo', label: 'Ooredoo accessories', url: 'https://store.ooredoo.com.kw/gadgets/accessories.html' },
  { provider: 'ooredoo', label: 'Ooredoo smartwatches', url: 'https://store.ooredoo.com.kw/gadgets/accessories/smartwatches.html' },
  { provider: 'ooredoo', label: 'Ooredoo TV', url: 'https://store.ooredoo.com.kw/getooredooadd/tv.html' },
];
const providerLogoOverrides = {
  zain: '/brand-logos/zain_logo.svg',
};
const socialAccounts = [
  ['stc Kuwait', 'Facebook', 'https://www.facebook.com/stc.kwt/'],
  ['Ooredoo Kuwait', 'Facebook', 'https://www.facebook.com/OoredooKuwait'],
  ['Zain Kuwait', 'Facebook', 'https://www.facebook.com/zainkuwait'],
  ['stc Kuwait', 'Instagram', 'https://www.instagram.com/stc_kwt/'],
  ['Ooredoo Kuwait', 'Instagram', 'https://www.instagram.com/ooredookuwait/'],
  ['Zain Kuwait', 'Instagram', 'https://www.instagram.com/zainkuwait/'],
  ['stc Kuwait', 'TikTok', 'https://www.tiktok.com/@stc_kwt'],
  ['Ooredoo Kuwait', 'TikTok', 'https://www.tiktok.com/@ooredookuwait'],
  ['Zain Kuwait', 'TikTok', 'https://www.tiktok.com/@zainkuwait'],
  ['stc Kuwait', 'X', 'https://x.com/stc_kwt'],
  ['Ooredoo Kuwait', 'X', 'https://x.com/OoredooKuwait'],
  ['Zain Kuwait', 'X', 'https://x.com/ZainKuwait'],
];
const socialEmbedAccounts = {
  stc: { name: 'stc Kuwait', facebook: 'https://www.facebook.com/stc.kwt/', instagram: 'stc_kwt', tiktok: 'stc_kwt', x: 'stc_kwt' },
  ooredoo: { name: 'Ooredoo Kuwait', facebook: 'https://www.facebook.com/OoredooKuwait', instagram: 'ooredookuwait', tiktok: 'ooredookuwait', x: 'OoredooKuwait' },
  zain: { name: 'Zain Kuwait', facebook: 'https://www.facebook.com/zainkuwait', instagram: 'zainkuwait', tiktok: 'zainkuwait', x: 'ZainKuwait' },
};
const offerCategories = [
  ['eSIM & digital activation', ['esim', 'digital sim']],
  ['Roaming & travel', ['roaming', 'travel', 'تجوال']],
  ['Prepaid bundles', ['prepaid', '75gb', '65gb', 'دقيقة']],
  ['5G home internet', ['5g', 'router', 'home internet']],
  ['Devices & installments', ['iphone', 'device', 'airpods', 'installment', 'تقسيط']],
  ['Entertainment & sports', ['tod', 'fifa', 'streaming', 'entertainment']],
  ['Gift cards & vouchers', ['itunes', 'voucher', 'gift card', 'playstation']],
  ['Rewards & loyalty', ['qitaf', 'rewards', 'loyalty', 'مكافآت']],
];
const rollingMonthMs = 30 * 24 * 60 * 60 * 1000;
const sectionPaths = {
  overview: '/overview',
  boosted: '/booster-ads',
  organic: '/organic',
  plans: '/plan-comparison',
  banners: '/banner-comparison',
  devices: '/device-comparison',
};

function isInRollingMonth(value, now = Date.now()) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= now - rollingMonthMs && time <= now + 24 * 60 * 60 * 1000;
}

function recentSocialPosts(records) {
  const now = Date.now();
  return records.filter((record) => isInRollingMonth(record.published_at || record.publishedAt || record.created_time || record.timestamp, now));
}

function apiUrl(path) {
  return path;
}

async function responseJson(response, action) {
  const body = await response.text();
  let result;
  try {
    result = body ? JSON.parse(body) : {};
  } catch {
    const summary = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    throw new Error(`${action} returned HTTP ${response.status} ${response.statusText || ''} instead of JSON${summary ? `: ${summary}` : ''}`.trim());
  }
  if (!response.ok || result.ok === false) throw new Error(result.error || result.message || `${action} failed with HTTP ${response.status}.`);
  return result;
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function waitForComparisonJob(endpoint, label, onProgress) {
  const deadline = Date.now() + 18 * 60 * 1000;
  let job;
  while (Date.now() < deadline) {
    await wait(5000);
    const response = await fetch(apiUrl(endpoint), { cache: 'no-store' });
    const result = await responseJson(response, `${label} refresh status`);
    job = result.job;
    if (job?.state === 'complete' || job?.state === 'error') return job;
    onProgress(job?.message || `${label} refresh is still running.`);
  }
  throw new Error(`${label} refresh did not finish within 18 minutes.`);
}

function textOf(ad) { return ad.ad_creative_body || ad.creative_text || ''; }
function imageOf(ad) {
  return ad.local_artwork_url || ad.artwork_url || '';
}
function dateOf(ad) { return String(ad.ad_delivery_start_time || '').slice(0, 10); }
function sourceOrderOf(ad) { return Number.isFinite(ad._source_index) ? ad._source_index : Number.MAX_SAFE_INTEGER; }
function languageOf(ad) {
  const explicit = String(ad.language || ad.languages || '').toLowerCase();
  if (explicit.includes('mixed')) return 'mixed';
  if (explicit.includes('arab') || explicit === 'ar') return 'ar';
  if (explicit.includes('english') || explicit === 'en') return 'en';
  const body = textOf(ad);
  const hasArabic = /[\u0600-\u06ff]/.test(body);
  const hasEnglish = /[A-Za-z]/.test(body);
  return hasArabic && hasEnglish ? 'mixed' : hasArabic ? 'ar' : hasEnglish ? 'en' : 'unknown';
}
function platformsOf(ad) {
  const value = ad.publisher_platforms || ad.platforms || ad.platform || [];
  const values = Array.isArray(value) ? value : String(value).split(/[,|]/);
  return values.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}
function mediaTypeOf(ad) {
  const explicit = String(ad.media_type || ad.mediaType || '').toLowerCase();
  if (explicit.includes('video')) return 'video';
  if (explicit.includes('image') || explicit.includes('photo')) return 'image';
  if (/\d{1,2}:\d{2}\s*\/\s*\d{1,2}:\d{2}/.test(textOf(ad))) return 'video';
  return imageOf(ad) ? 'image' : 'unknown';
}
function statusOf(ad) { return ad.ad_status === 'inactive' || ad.ad_delivery_stop_time ? 'inactive' : 'active'; }
function impressionsOf(ad) { return ad.impressions || ad.impressions_text || ad.impression_range || ad.estimated_impressions || 'Not provided by source'; }
function titleOf(ad) {
  return textOf(ad).split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/see ad details/i.test(line))[1]
    || textOf(ad).split(/\r?\n/).find((line) => line.trim()) || `Campaign ${ad.ad_archive_id}`;
}
function csvCell(value) { return `"${String(value ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`; }
function relativeTime(value) {
  const difference = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(difference)) return 'Time unavailable';
  const minutes = Math.max(0, Math.floor(difference / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function servedSocialImage(value) {
  const url = String(value || '').trim();
  return url.startsWith('/social-thumbnails/') ? `/api/social-image?path=${encodeURIComponent(url)}` : url;
}

function organicImage(post) {
  return servedSocialImage(post.local_thumbnail_url || post.thumbnail_url || post.thumbnail || post.image_url || post.media_url || post.cover_url || '');
}

function organicCaption(post) {
  return post.caption || post.description || post.text || post.message || '';
}

function organicPublishedAt(post) {
  return post.published_at || post.publishedAt || post.created_time || post.timestamp || '';
}
function organicPublishedTime(post) {
  const time = new Date(organicPublishedAt(post)).getTime();
  return Number.isFinite(time) ? time : 0;
}
function organicPublishedLabel(post) {
  return post.published_label || post.relative_time || '';
}
function organicDateLabel(post) {
  const published = organicPublishedAt(post);
  if (!published) return 'Time unavailable';
  return new Date(published).toLocaleString();
}
function organicRelativeLabel(post) {
  return organicPublishedAt(post) ? relativeTime(organicPublishedAt(post)) : organicPublishedLabel(post) || 'Publication time unavailable';
}

function engagementValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  const count = Number(value);
  if (!Number.isFinite(count)) return String(value);
  return new Intl.NumberFormat('en', { notation: count >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(count);
}

function organicLink(post) {
  return post.direct_url || post.url || post.permalink || '';
}

function organicCompany(post) {
  const value = String(post.company || post.page_name || post.account_name || '').toLowerCase();
  if (value.includes('ooredoo')) return providers[1];
  if (value.includes('zain')) return providers[2];
  return providers[0];
}

function organicProfile(provider, platform, profiles, posts) {
  const account = socialEmbedAccounts[provider.key] || {};
  const profile = profiles.find((item) => item.platform === platform && organicCompany(item).key === provider.key) || {};
  const username = platform === 'Instagram' ? account.instagram : platform === 'Facebook' ? account.facebook?.split('/').filter(Boolean).pop() : platform === 'TikTok' ? account.tiktok : account.x;
  return {
    username: profile.username || username || provider.key,
    displayName: profile.display_name || profile.full_name || provider.name,
    picture: servedSocialImage(profile.local_profile_picture_url || profile.profile_picture_url || ''),
    followers: profile.followers ?? profile.total_followers,
    totalPosts: profile.total_posts ?? profile.posts_count,
    loadedPosts: posts.length,
  };
}

function planProvider(plan) {
  return providers.find((provider) => provider.key === plan.provider) || providers[0];
}
function providerLogo(provider, plans = []) {
  return providerLogoOverrides[provider.key] || plans.find((plan) => plan.provider === provider.key && plan.logo)?.logo || '';
}

function planBenefits(plan) {
  return Array.isArray(plan.benefits) ? plan.benefits.filter(Boolean) : String(plan.benefits || '').split('|').map((item) => item.trim()).filter(Boolean);
}
function planPriceValue(plan) {
  const match = String(plan.price || '').replace(/,/g, '').match(/[\d.]+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}
function devicePriceValue(device, key = 'price') {
  const match = String(device[key] || '').replace(/,/g, '').match(/[\d.]+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}
function bannerImage(banner) {
  return banner.local_image_url || banner.image_url || '';
}

function BrandMark({ pageId, name }) {
  const provider = adProviders.find((item) => item.id === String(pageId));
  return <span className="brand-mark" style={{ '--brand': provider?.color || '#697386' }}>{(provider?.key || name || '?').slice(0, 2)}</span>;
}

function EmptyArtwork({ label = 'Creative' }) {
  return <div className="creative-empty"><Sparkles size={21} /><span>{label}</span></div>;
}

function Kpi({ icon: Icon, label, value, note, tone = 'purple' }) {
  return <article className={`kpi-card tone-${tone}`}><div className="kpi-top"><span><Icon size={18} /></span><small>{note}</small></div><strong>{value}</strong><p>{label}</p></article>;
}

function Sidebar({ active, onChange, open, onClose }) {
  const items = [
    ['overview', 'Overview', LayoutDashboard],
    ['boosted', 'Boosted Ads', Target],
    ['organic', 'Organic', Activity],
    ['plans', 'Plan Comparison', Grid2X2],
    ['banners', 'Banner Comparison', Camera],
    ['devices', 'Device Comparison', Smartphone],
  ];
  return <aside className={`app-sidebar ${open ? 'open' : ''}`}>
    <div className="sidebar-brand"><img src={logoUrl} alt="stc" /><button type="button" onClick={onClose} aria-label="Close menu"><X /></button></div>
    <div className="workspace-label">Social intelligence</div>
    <nav>{items.map(([key, label, Icon]) => <button key={key} className={active === key ? 'active' : ''} type="button" onClick={() => { onChange(key); onClose(); }}><Icon size={18} /><span>{label}</span><ChevronRight size={15} /></button>)}</nav>
    <div className="sidebar-insight"><span><Sparkles size={15} /> Intelligence brief</span><b>{adProviders.length} ad pages</b><p>9 organic accounts and the tracked Meta Ads Library pages in one view.</p></div>
    <div className="sidebar-footer"><i /><span><b>Monitor ready</b><small>Local data service</small></span></div>
  </aside>;
}

function Topbar({ title, subtitle, onMenu }) {
  return <header className="topbar"><button className="mobile-menu" type="button" onClick={onMenu} aria-label="Open navigation"><Menu /></button><div><span>Competitive intelligence</span><h1>{title}</h1><p>{subtitle}</p></div><div className="top-actions"><button type="button" aria-label="Notifications"><Bell size={19} /><i /></button><div className="avatar">SI</div></div></header>;
}

function CampaignMini({ ad }) {
  return <a className="campaign-mini" href={ad.ad_snapshot_url || '#'} target="_blank" rel="noreferrer">
    <div className="mini-image">{imageOf(ad) ? <img src={imageOf(ad)} alt="" /> : <EmptyArtwork />}</div>
    <div><span>{ad.page_name || 'Campaign'} · {dateOf(ad)}</span><b>{titleOf(ad)}</b><small>Open campaign <ArrowUpRight size={12} /></small></div>
  </a>;
}

function Overview({ ads, onNavigate }) {
  const relevant = ads.filter((ad) => adProviders.some((provider) => provider.id === String(ad.page_id)));
  const counts = adProviders.map((provider) => ({ ...provider, count: relevant.filter((ad) => String(ad.page_id) === provider.id).length }));
  const max = Math.max(...counts.map((item) => item.count), 1);
  const active = ads.filter((ad) => !ad.ad_delivery_stop_time).length;
  const latest = [...relevant].sort((a, b) => String(dateOf(b)).localeCompare(dateOf(a))).slice(0, 5);
  const withCreative = ads.filter((ad) => imageOf(ad)).length;
  return <>
    <section className="welcome-card"><div><span>stc Kuwait competitor watch</span><h2>See the market before it moves.</h2><p>One decision-ready view of organic publishing and boosted campaign activity across Kuwait&apos;s leading telecom brands.</p><div><button type="button" onClick={() => onNavigate('boosted')}>Explore boosted ads <ArrowUpRight size={16} /></button><button type="button" onClick={() => onNavigate('organic')}>Open organic monitor</button></div></div><div className="welcome-orbit"><span className="orbit-center">stc</span><i className="orbit-one">O</i><i className="orbit-two">Z</i><div className="orbit-ring" /></div></section>
    <section className="kpi-grid"><Kpi icon={Target} label="Imported campaigns" value={ads.length} note="Current dataset" /><Kpi icon={Activity} label="Active boosted ads" value={active} note="Live records" tone="pink" /><Kpi icon={Eye} label="Captured creatives" value={withCreative} note={`${Math.round((withCreative / Math.max(ads.length, 1)) * 100)}% coverage`} tone="teal" /><Kpi icon={Grid2X2} label="Organic accounts" value={socialAccounts.length} note="3 platforms" tone="amber" /></section>
    <div className="overview-grid">
      <section className="surface share-panel"><div className="section-heading"><div><span>Boosted activity</span><h2>Share of campaigns</h2></div><BarChart3 /></div><div className="share-chart">{counts.map((item) => <div key={item.id}><div className="share-label"><span><i style={{ background: item.color }} />{item.name}</span><b>{item.count}</b></div><div className="bar-track"><i style={{ width: `${(item.count / max) * 100}%`, background: item.color }} /></div><small>{Math.round((item.count / Math.max(relevant.length, 1)) * 100)}% of competitor set</small></div>)}</div><div className="chart-note"><TrendingUp size={17} /><span><b>{counts.sort((a, b) => b.count - a.count)[0]?.name}</b> has the largest visible campaign footprint in the imported dataset.</span></div></section>
      <section className="surface pulse-panel"><div className="section-heading"><div><span>Latest activity</span><h2>Campaign pulse</h2></div><button type="button" onClick={() => onNavigate('boosted')}>View all</button></div><div className="mini-list">{latest.map((ad) => <CampaignMini key={`${ad.page_id}-${ad.ad_archive_id}`} ad={ad} />)}</div></section>
    </div>
    <section className="surface brand-snapshot"><div className="section-heading"><div><span>Competitor snapshot</span><h2>Tracked Meta pages, one clear view</h2></div></div><div>{counts.map((item) => <article key={item.id}><BrandMark pageId={item.id} /><div><b>{item.name}</b><span>{item.count} boosted campaigns</span></div><strong>{Math.round((item.count / Math.max(relevant.length, 1)) * 100)}%</strong></article>)}</div></section>
  </>;
}

function Filters({ filters, setFilters }) {
  const reset = { search: '', provider: '', platform: '', mediaType: '', status: 'active', dateMode: 'all', exactDate: '', from: '2019-07-26', to: new Date().toISOString().slice(0, 10), sort: 'recent' };
  return <section className="boosted-filter-panel surface"><div className="boosted-filter-heading"><div><span>Filters</span><b>Refine the complete paid-ad archive</b></div><small>Date controls use the delivery dates available in Meta results.</small></div><div className="filter-bar boosted-filter-grid">
    <label className="filter-search"><Search size={17} /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search campaign copy or ID" /></label>
    <label className="filter-field"><span>Competitor</span><select value={filters.provider} onChange={(event) => setFilters({ ...filters, provider: event.target.value })}><option value="">All competitors</option>{adProviders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="filter-field"><span>Platform</span><select value={filters.platform} onChange={(event) => setFilters({ ...filters, platform: event.target.value })}><option value="">All platforms</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="messenger">Messenger</option><option value="threads">Threads</option><option value="audience network">Audience Network</option><option value="unknown">Unknown</option></select></label>
    <label className="filter-field"><span>Media type</span><select value={filters.mediaType} onChange={(event) => setFilters({ ...filters, mediaType: event.target.value })}><option value="">All media types</option><option value="image">Images</option><option value="video">Videos</option><option value="unknown">Unknown</option></select></label>
    <label className="filter-field"><span>Active status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Active and inactive</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
    <label className="filter-field"><span>Impressions by date</span><select value={filters.dateMode} onChange={(event) => setFilters({ ...filters, dateMode: event.target.value })}><option value="all">All dates</option><option value="exact">Exact date</option><option value="range">Date range</option></select></label>
    {filters.dateMode === 'exact' ? <label className="filter-field"><span>Exact date</span><input aria-label="Exact date picker" type="date" value={filters.exactDate} onChange={(event) => setFilters({ ...filters, exactDate: event.target.value })} /></label> : null}
    {filters.dateMode === 'range' ? <div className="date-filter-group"><label className="filter-field"><span>From</span><input aria-label="Start date picker" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label><label className="filter-field"><span>To</span><input aria-label="End date picker" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label></div> : null}
    <label className="filter-field"><span>Sort</span><select aria-label="Sort boosted ads" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="recent">Most recent</option><option value="impressions">Meta result order</option></select></label>
    <button type="button" onClick={() => setFilters(reset)}><Filter size={16} /> Clear filters</button>
  </div></section>;
}

function exportAds(rows) {
  const lines = [['Company', 'Library ID', 'Creative', 'Started', 'Status', 'Language', 'Platforms', 'Media type', 'Link'].map(csvCell).join(',')];
  rows.forEach((ad) => lines.push([ad.page_name, ad.ad_archive_id, textOf(ad), dateOf(ad), statusOf(ad), languageOf(ad), platformsOf(ad).join(' | '), mediaTypeOf(ad), ad.ad_snapshot_url].map(csvCell).join(',')));
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'stc-boosted-ads.csv'; anchor.click(); URL.revokeObjectURL(url);
}

function CampaignGrid({ rows }) {
  if (!rows.length) return <div className="empty-state"><CircleAlert /><b>No campaigns match these filters</b><span>Try removing a filter or searching for a different keyword.</span></div>;
  return <div className="campaign-grid boosted-campaign-grid">{rows.map((ad) => <article className="campaign-card-new" key={`${ad.page_id}-${ad.ad_archive_id}`}><div className="campaign-image">{imageOf(ad) ? <img src={imageOf(ad)} alt="Campaign creative" loading="lazy" decoding="async" onLoad={(event) => { if (event.currentTarget.naturalWidth <= 120 && event.currentTarget.naturalHeight <= 120) event.currentTarget.classList.add('low-resolution'); }} /> : <EmptyArtwork />}<span>{statusOf(ad) === 'inactive' ? 'Inactive' : 'Active'}</span></div><div className="campaign-content"><div className="campaign-company"><BrandMark pageId={ad.page_id} name={ad.page_name} /><span><b>{ad.page_name}</b><small>{dateOf(ad)}</small></span></div><h3>{titleOf(ad)}</h3><p>{textOf(ad)}</p><div><span>ID {ad.ad_archive_id}</span><a href={ad.ad_snapshot_url || '#'} target="_blank" rel="noreferrer">Open ad <ArrowUpRight size={14} /></a></div></div></article>)}</div>;
}

function ActiveOfferRows({ rows, validation }) {
  return <div className="active-offer-rows">{providers.map((provider, index) => {
    const providerRows = rows.filter((ad) => String(ad.page_id) === provider.id);
    const sourcePage = validation?.pages?.find((page) => String(page.page_id) === provider.id);
    const sourceLabel = sourcePage ? `${sourcePage.approximate ? '~' : ''}${sourcePage.source_count}` : '';
    return <section className="active-offer-row surface" key={provider.id} style={{ '--brand': provider.color }}><header><div><BrandMark pageId={provider.id} /><span><small>Row {index + 1}</small><b>{provider.name}</b></span></div><div><strong>{providerRows.length}</strong><span>exact active cards{sourceLabel ? ` · Meta estimate ${sourceLabel}` : ''}</span></div></header><div className="offer-scroll-frame" role="list" aria-label={`${provider.name} active offers`}>{providerRows.length ? providerRows.map((ad) => <article className="active-offer-card" role="listitem" key={`${ad.page_id}-${ad.ad_archive_id}`}><div className="active-offer-creative">{imageOf(ad) ? <img src={imageOf(ad)} alt={`${provider.name} offer creative`} loading="lazy" decoding="async" /> : <EmptyArtwork label="Offer" />}<span>Active</span></div><div className="active-offer-copy"><h3>{titleOf(ad)}</h3><p>{textOf(ad)}</p><dl><div><dt>Impressions</dt><dd>{impressionsOf(ad)}</dd></div><div><dt>Started</dt><dd>{dateOf(ad) || 'Unavailable'}</dd></div><div><dt>Platform</dt><dd>{platformsOf(ad).join(', ') || 'Not provided'}</dd></div><div><dt>Media</dt><dd>{mediaTypeOf(ad)}</dd></div></dl><footer><span>Library ID {ad.ad_archive_id}</span><a href={ad.ad_snapshot_url || '#'} target="_blank" rel="noreferrer">Open offer <ArrowUpRight size={14} /></a></footer></div></article>) : <p className="column-empty">No active offers match the current filters.</p>}</div></section>;
  })}</div>;
}

function OpportunityMatrix({ rows }) {
  const matrix = offerCategories.map(([name, terms]) => ({ name, providers: providers.map((provider) => ({ ...provider, count: rows.filter((ad) => String(ad.page_id) === provider.id && terms.some((term) => textOf(ad).toLowerCase().includes(term))).length })) }));
  return <div className="opportunity-layout"><section className="opportunity-intro"><Sparkles /><h2>Offer opportunity map</h2><p>Campaign themes visible for competitors but missing or underrepresented for stc are highlighted for review.</p><div><b>{matrix.filter((row) => !row.providers[0].count && row.providers.some((item) => item.count)).length}</b><span>potential gaps</span></div></section><div className="matrix"><div className="matrix-head"><span>Campaign theme</span>{providers.map((provider) => <b key={provider.id}>{provider.key}</b>)}<span>Signal</span></div>{matrix.map((row) => { const gap = !row.providers[0].count && row.providers.slice(1).some((item) => item.count); return <div className={gap ? 'gap' : ''} key={row.name}><strong>{row.name}</strong>{row.providers.map((provider) => <span key={provider.id} className={provider.count ? 'present' : 'absent'}>{provider.count || '—'}</span>)}<em>{gap ? 'Opportunity' : 'Covered'}</em></div>; })}</div></div>;
}

function BannerComparison({ banners, visibleProviders }) {
  if (!banners.length) return <div className="empty-state"><CircleAlert /><b>No banners match these filters</b><span>Try another provider, category, or keyword, then click Fetch live plans to refresh banners.</span></div>;
  return <div className="banner-gallery">{visibleProviders.map((provider) => {
    const providerBanners = banners.filter((banner) => banner.provider === provider.key);
    return <section className="banner-provider-section" key={provider.key} style={{ '--brand': provider.color }}><header><div>{providerLogo(provider, banners) ? <img className="provider-logo" src={providerLogo(provider, banners)} alt={provider.name} /> : <BrandMark pageId={provider.id} />}<span><b>{provider.name}</b><small>{providerBanners.length} matching banners</small></span></div></header><div className="banner-card-grid">{providerBanners.length ? providerBanners.map((banner) => <article className="banner-card" key={banner.id}><div className="banner-image">{bannerImage(banner) ? <img src={bannerImage(banner)} alt={banner.title || `${provider.name} banner`} /> : <EmptyArtwork label="Banner" />}</div><div className="banner-copy"><span>{banner.sub_category || banner.category}</span><h3>{banner.title || 'Banner'}</h3>{banner.text ? <p>{banner.text}</p> : <p>No banner text was detected near this image.</p>}<small>{banner.source_method || 'Live source'}{banner.api_url ? ` · API` : ''}</small><div>{banner.link_url ? <a href={banner.link_url} target="_blank" rel="noreferrer">Open campaign <ArrowUpRight size={14} /></a> : null}<a href={banner.api_url || banner.source_url} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={14} /></a></div></div></article>) : <p className="column-empty">No matching banners</p>}</div></section>;
  })}</div>;
}

function Boosted({ ads, meta, onFetchLive, fetchState, updatedAt }) {
  const [tab, setTab] = useState('compare');
  const [filters, setFilters] = useState({ search: '', provider: '', platform: '', mediaType: '', status: 'active', dateMode: 'all', exactDate: '', from: '2019-07-26', to: new Date().toISOString().slice(0, 10), sort: 'recent' });
  const filtered = useMemo(() => ads.filter((ad) => adProviders.some((provider) => provider.id === String(ad.page_id))).filter((ad) => {
    if (filters.search && !`${textOf(ad)} ${ad.ad_archive_id}`.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.provider && String(ad.page_id) !== filters.provider) return false;
    const adPlatforms = platformsOf(ad);
    if (filters.platform === 'unknown' && adPlatforms.length) return false;
    if (filters.platform && filters.platform !== 'unknown' && !adPlatforms.includes(filters.platform)) return false;
    if (filters.mediaType && mediaTypeOf(ad) !== filters.mediaType) return false;
    if (filters.status && statusOf(ad) !== filters.status) return false;
    if (filters.dateMode === 'exact' && filters.exactDate && dateOf(ad) !== filters.exactDate) return false;
    if (filters.dateMode === 'range' && filters.from && dateOf(ad) < filters.from) return false;
    if (filters.dateMode === 'range' && filters.to && dateOf(ad) > filters.to) return false;
    return true;
  }).sort((a, b) => {
    if (filters.sort === 'impressions') return sourceOrderOf(a) - sourceOrderOf(b);
    return String(dateOf(b)).localeCompare(String(dateOf(a))) || sourceOrderOf(a) - sourceOrderOf(b);
  }), [ads, filters]);
  const activeOffers = filtered.filter((ad) => statusOf(ad) === 'active' && providers.some((provider) => provider.id === String(ad.page_id)));
  const tabs = [['campaigns', 'Campaign library', filtered.length], ['compare', 'Active offers', activeOffers.length], ['opportunities', 'Offer gaps', filtered.length]];
  return <><div className="page-actions"><div className="segmented">{tabs.map(([key, label, count]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)} type="button">{label}<span>{count}</span></button>)}</div><div className="boosted-actions"><button className={`fetch-live-button ${fetchState.state === 'fetching' ? 'fetching' : ''}`} disabled={fetchState.state === 'fetching'} type="button" onClick={onFetchLive}><RefreshCw size={16} /> {fetchState.state === 'fetching' ? 'Fetching live ads…' : 'Fetch live ads'}</button><button className="export-button" type="button" onClick={() => exportAds(tab === 'compare' ? activeOffers : filtered)}><Download size={16} /> Export CSV</button></div></div><Filters filters={filters} setFilters={setFilters} /><div className={`live-fetch-status ${fetchState.state}`}><span><i />{fetchState.message}</span><small>{updatedAt ? `Last verified ${new Date(updatedAt).toLocaleString()} · Server refresh every 10 minutes` : 'Waiting for a verified live fetch'}</small></div><div className="results-summary"><span><b>{tab === 'compare' ? activeOffers.length : filtered.length}</b> {tab === 'compare' ? 'unique active Library IDs captured' : 'campaigns across all available dates'}</span><span><i /> {tab === 'compare' ? 'Exact cards are shown separately from Meta’s approximate ~ result estimate' : 'Ads from the tracked Meta URLs'}</span></div>{tab === 'campaigns' ? <CampaignGrid rows={filtered} /> : tab === 'compare' ? <ActiveOfferRows rows={activeOffers} validation={meta?.validation} /> : <OpportunityMatrix rows={filtered} />}</>;
}

function Organic({ posts, profiles, source, coverage, onRefresh, onFetchLive, fetchState, updatedAt }) {
  const [filters, setFilters] = useState({ search: '', company: '', platform: 'Instagram', recent: 'all' });
  const recentPlatform = filters.recent === 'all' ? '' : filters.recent;
  const filtered = posts.filter((post) => {
    if (filters.search && !`${post.title || ''} ${organicCaption(post)}`.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.company && organicCompany(post).key !== filters.company) return false;
    if (filters.platform && post.platform !== filters.platform) return false;
    if (recentPlatform && post.platform !== recentPlatform) return false;
    return true;
  }).sort((a, b) => organicPublishedTime(b) - organicPublishedTime(a));
  const selectedPlatform = filters.platform || recentPlatform;
  const trackedAccountCount = selectedPlatform ? socialAccounts.filter(([, platform]) => platform === selectedPlatform).length : socialAccounts.length;
  const verifiedAccountCount = coverage.filter((item) => (!selectedPlatform || item.platform === selectedPlatform) && Number(item.count) > 0 && item.status === 'ok').length;
  const platformCoverage = ['Facebook', 'Instagram', 'TikTok', 'X'].map((platform) => ({
    platform,
    posts: posts.filter((post) => post.platform === platform).length,
    accounts: new Set(posts.filter((post) => post.platform === platform).map((post) => organicCompany(post).key)).size,
  }));

  return <>
    <section className="organic-status"><div><span><i /> Live monitoring</span><h2>Organic publishing watch</h2><p>Only posts published during the last 30 days are displayed.</p></div><button type="button" disabled={fetchState.state === 'fetching'} onClick={onFetchLive}><RefreshCw size={16} /> {fetchState.state === 'fetching' ? 'Refreshing posts...' : 'Refresh organic posts'}</button><div className="source-chip"><small>Data source</small><b>{source}</b></div></section>
    <div className={`live-fetch-status organic-live-status ${fetchState.state}`}><span><i />{fetchState.message}</span><small>{updatedAt ? `Last verified ${new Date(updatedAt).toLocaleString()} · manual refresh available anytime · 24-hour backup refresh` : 'Not yet verified · use Refresh organic posts'}</small></div>
    <section className="organic-kpis"><div><b>{trackedAccountCount}</b><span>{selectedPlatform || 'Tracked'} accounts</span></div><div><b>{filtered.length}</b><span>Available posts · last 30 days</span></div><div><b>{verifiedAccountCount}/{trackedAccountCount}</b><span>Verified account sources</span></div><div><b>24h</b><span>Backup refresh</span></div></section>
    <section className="organic-platform-coverage" aria-label="Organic platform coverage">{platformCoverage.map((item) => <div className={item.posts ? 'available' : 'blocked'} key={item.platform}><span>{item.platform}</span><b>{item.posts} posts</b><small>{item.posts ? `${item.accounts} tracked ${item.accounts === 1 ? 'account' : 'accounts'} represented` : 'No verified posts returned by source'}</small></div>)}</section>
    <div className="organic-mobile-layout">
      <section className="organic-feed-main organic-mobile-main">
        <div className="feed-toolbar surface"><label><Search /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search post captions or descriptions" /></label><select value={filters.company} onChange={(event) => setFilters({ ...filters, company: event.target.value })}><option value="">All companies</option><option value="stc">stc</option><option value="ooredoo">Ooredoo</option><option value="zain">Zain</option></select><select value={filters.platform} onChange={(event) => setFilters({ ...filters, platform: event.target.value })}><option value="">All platforms</option><option>Facebook</option><option>Instagram</option><option>TikTok</option><option>X</option></select><select value={filters.recent} onChange={(event) => setFilters({ ...filters, recent: event.target.value })} aria-label="Recent posts"><option value="all">All most recent</option><option value="Instagram">Most recent Instagram</option><option value="Facebook">Most recent Facebook</option><option value="TikTok">Most recent TikTok</option><option value="X">Most recent X</option></select></div>
        {selectedPlatform === 'Instagram' ? <InstagramAccountFrame posts={filtered} profiles={profiles} companyKey={filters.company} onRefresh={onRefresh} /> : null}
      </section>
    </div>
  </>;
}

function InstagramAccountFrame({ posts, profiles, companyKey, onRefresh }) {
  return <section className="instagram-account-frame surface">
    <header><div><span>Instagram post viewer</span><h3>Competitor posts in one screen</h3><p>Scroll inside each competitor column to move through one Instagram post at a time.</p></div></header>
    <CompetitorMobileFeeds posts={posts} profiles={profiles} platform="Instagram" companyKey={companyKey} onRefresh={onRefresh} />
  </section>;
}

function CompetitorMobileFeeds({ posts, profiles, platform, companyKey, onRefresh }) {
  const visibleProviders = companyKey ? providers.filter((provider) => provider.key === companyKey) : providers;
  return <section className={`competitor-mobile-feeds ${visibleProviders.length === 1 ? 'single' : ''}`} aria-label="Competitor mobile organic feeds">{visibleProviders.map((provider) => {
    const providerPosts = posts.filter((post) => organicCompany(post).key === provider.key);
    const profile = organicProfile(provider, platform === 'All platforms' ? (providerPosts[0]?.platform || 'Instagram') : platform, profiles, providerPosts);
    const account = socialEmbedAccounts[provider.key] || {};
    const officialUrl = platform === 'Facebook' ? account.facebook : platform === 'TikTok' ? `https://www.tiktok.com/@${account.tiktok}` : platform === 'X' ? `https://x.com/${account.x}` : `https://www.instagram.com/${account.instagram}/`;
    return <article className="competitor-phone" key={provider.key} style={{ '--brand': provider.color }}>
      <header className="competitor-profile-header"><div className="competitor-profile-picture">{profile.picture ? <img src={profile.picture} alt={`${profile.username} profile`} /> : <BrandMark pageId={provider.id} />}</div><div className="competitor-profile-copy"><span>{platform}</span><h3>@{profile.username}</h3><p>{profile.displayName}</p></div><a href={officialUrl} target="_blank" rel="noreferrer" aria-label={`Open ${provider.name} profile`}><ArrowUpRight /></a><dl><div><dt>Followers</dt><dd>{engagementValue(profile.followers)}</dd></div><div><dt>Total posts</dt><dd>{engagementValue(profile.totalPosts)}</dd></div><div><dt>Loaded</dt><dd>{profile.loadedPosts}</dd></div></dl></header>
      <div className="competitor-feed-scroll" role="feed" aria-label={`${provider.name} ${platform} posts`}>{providerPosts.length ? providerPosts.map((post, index) => {
        const caption = organicCaption(post); const link = organicLink(post);
        const extraMetrics = [['Impressions', post.impressions ?? post.reach], ['Likes', post.likes], ['Comments', post.comments], ['Shares', post.shares ?? post.reposts], ['Views', post.views ?? post.plays]];
        return <article className="competitor-feed-post" role="article" aria-posinset={index + 1} aria-setsize={providerPosts.length} key={post.id || link}>
          <header><div><BrandMark pageId={provider.id} /><span><b>@{profile.username}</b><small>{post.platform || platform} · {organicDateLabel(post)}</small></span></div><em>{index + 1}/{providerPosts.length}</em></header>
          <div className="competitor-feed-media">{organicImage(post) ? <img src={organicImage(post)} alt={`${provider.name} post`} loading="lazy" /> : <EmptyArtwork label={post.post_type || 'Post'} />}<span>{post.post_type || post.type || 'Post'}</span></div>
          <div className="competitor-feed-body"><h4>{post.title || `${provider.name} ${post.platform || 'social'} post`}</h4><p>{caption || 'Caption unavailable from this source.'}</p><div className="competitor-feed-metrics">{extraMetrics.map(([label, value]) => <div key={label}>{label === 'Likes' ? <Heart /> : label === 'Comments' ? <MessageCircle /> : label === 'Shares' ? <Share2 /> : <Eye />}<span><b>{engagementValue(value)}</b><small>{label}</small></span></div>)}</div><footer><span>{organicRelativeLabel(post)}</span>{link ? <a href={link} target="_blank" rel="noreferrer">Open post <ArrowUpRight /></a> : null}</footer></div>
        </article>;
      }) : <div className="competitor-feed-empty"><Bell /><b>No verified {platform} posts</b><p>The source returned no current posts for {provider.name}. Cached or blocked data is not presented as live.</p><div><button type="button" onClick={onRefresh}><RefreshCw /> Reload</button><a href={officialUrl} target="_blank" rel="noreferrer">Open profile <ArrowUpRight /></a></div></div>}</div>
    </article>;
  })}</section>;
}

function OfficialLiveFeed({ companyKey, platform, posts = [] }) {
  const containerRef = useRef(null);
  const accounts = companyKey ? [socialEmbedAccounts[companyKey]].filter(Boolean) : Object.values(socialEmbedAccounts);

  useEffect(() => {
    const addScript = (id, src, onReady, reload = false) => {
      let script = document.getElementById(id);
      if (reload && script) { script.remove(); script = null; }
      if (script) { onReady?.(); return; }
      script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.onload = () => onReady?.();
      document.body.appendChild(script);
    };

    if (platform === 'X') addScript('x-widgets-script', 'https://platform.twitter.com/widgets.js', () => window.twttr?.widgets?.load(containerRef.current));
    if (platform === 'TikTok') addScript('tiktok-embed-script', 'https://www.tiktok.com/embed.js', null, true);
    if (platform === 'Instagram') addScript('instagram-embed-script', 'https://www.instagram.com/embed.js', () => window.instgrm?.Embeds?.process());
  }, [companyKey, platform]);

  return <section className="official-live-feed surface" ref={containerRef}>
    <header><div><span>Official live source</span><h3>Latest {platform} posts</h3><p>Rendered directly by {platform}; refresh the page to request the newest public posts.</p></div><span className="official-live-badge"><i /> Live</span></header>
    <div className={`official-embed-grid ${accounts.length === 1 ? 'single' : ''}`}>{accounts.map((account) => {
      if (platform === 'Facebook') {
        const src = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(account.facebook)}&tabs=timeline&width=500&height=700&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false`;
        return <article key={account.name}><h4>{account.name}</h4><iframe src={src} width="500" height="700" title={`${account.name} Facebook timeline`} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" /></article>;
      }
      if (platform === 'TikTok') return <article key={account.name}><h4>{account.name}</h4><blockquote className="tiktok-embed" cite={`https://www.tiktok.com/@${account.tiktok}`} data-unique-id={account.tiktok} data-embed-type="creator"><section><a target="_blank" rel="noreferrer" href={`https://www.tiktok.com/@${account.tiktok}`}>@{account.tiktok}</a></section></blockquote></article>;
      if (platform === 'X') return <article key={account.name}><h4>{account.name}</h4><a className="twitter-timeline" data-height="700" data-dnt="true" href={`https://x.com/${account.x}`}>Latest posts from @{account.x}</a></article>;
      return <article key={account.name}><h4>{account.name}</h4><blockquote className="instagram-media" data-instgrm-permalink={`https://www.instagram.com/${account.instagram}/`} data-instgrm-version="14"><a href={`https://www.instagram.com/${account.instagram}/`} target="_blank" rel="noreferrer">Latest posts from @{account.instagram}</a></blockquote></article>;
    })}</div>
    {platform === 'Instagram' && posts.length ? <InstagramPostScroller posts={posts} /> : null}
  </section>;
}

function InstagramPostScroller({ posts }) {
  return <section className="instagram-post-scroller" aria-label="Instagram post-by-post viewer">
    <header><div><span>Mobile-style viewer</span><h3>Scroll posts one by one</h3><p>{posts.length} saved posts from the last 30 days · scroll inside the phone-style feed</p></div><span>Scroll ↓</span></header>
    <div className="instagram-snap-viewport">{posts.map((post) => {
      const company = organicCompany(post); const link = organicLink(post); const caption = organicCaption(post);
      return <article className="instagram-snap-card" key={`snap-${post.id || link}`}>
        <header><BrandMark pageId={company.id} /><span><b>{company.name}</b><small>Instagram · {organicDateLabel(post)}</small></span></header>
        <div className="instagram-snap-image">{organicImage(post) ? <img src={organicImage(post)} alt={`${company.name} Instagram post`} /> : <EmptyArtwork label="Instagram" />}</div>
        <div className="instagram-snap-copy"><p>{caption || 'No description was supplied by the connected Instagram source.'}</p><div className="organic-engagement"><span title="Likes"><Heart />{engagementValue(post.likes)}</span><span title="Views"><Eye />{engagementValue(post.views)}</span><span title="Comments"><MessageCircle />{engagementValue(post.comments)}</span></div><footer><span>{organicRelativeLabel(post)}</span>{link ? <a href={link} target="_blank" rel="noreferrer">Open post <ArrowUpRight size={14} /></a> : null}</footer></div>
      </article>;
    })}</div>
  </section>;
}

function PlanSourceDirectory({ sourceMatrix }) {
  if (!sourceMatrix.length) return null;
  return <section className="plan-source-directory surface"><header><div><span>Refresh scope</span><h3>Tracked live plan sources</h3><p>Refresh checks these exact public pages. Repeated URLs are fetched once and mapped to every listed category.</p></div><b>{sourceMatrix.length} categories</b></header><div><table><thead><tr><th>Category</th>{planProviders.map((provider) => <th key={provider.key}>{provider.name}</th>)}</tr></thead><tbody>{sourceMatrix.map((row) => <tr key={row.category}><th>{row.category}</th>{planProviders.map((provider) => { const links = (Array.isArray(row[provider.key]) ? row[provider.key] : [row[provider.key]]).filter(Boolean); return <td key={provider.key}>{links.length ? <div className="source-link-list">{links.map((link, index) => <a key={link} href={link} target="_blank" rel="noreferrer">{links.length > 1 ? `Source ${index + 1}` : 'Open source'} <ArrowUpRight /></a>)}</div> : <span>—</span>}</td>; })}</tr>)}</tbody></table></div></section>;
}

function PlanComparison({ plans, sourceMatrix, fetchState, updatedAt, onFetchPlans }) {
  const [tab, setTab] = useState('comparison');
  const [filters, setFilters] = useState({ search: '', provider: '', category: '', country: '', sort: '' });
  const planCategories = useMemo(() => sourceMatrix.map((row) => row.category).filter(Boolean), [sourceMatrix]);
  const sourceLinkCount = sourceMatrix.reduce((total, row) => total + planProviders.reduce((count, provider) => count + (Array.isArray(row[provider.key]) ? row[provider.key].length : row[provider.key] ? 1 : 0), 0), 0);
  const roamingCountries = useMemo(() => [...new Set(plans.filter((plan) => plan.category === 'Roaming Plans').flatMap((plan) => plan.countries || []))].sort((a, b) => a.localeCompare(b)), [plans]);
  const filtered = useMemo(() => plans.filter((plan) => plan.status !== 'Inactive').filter((plan) => {
    const haystack = `${plan.title || ''} ${plan.price || ''} ${plan.category || ''} ${plan.sub_category || ''} ${plan.provider_name || ''} ${(plan.countries || []).join(' ')} ${planBenefits(plan).join(' ')}`.toLowerCase();
    if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false;
    if (filters.provider && plan.provider !== filters.provider) return false;
    if (filters.category && plan.category !== filters.category && !(plan.source_categories || []).includes(filters.category)) return false;
    if (filters.country && !(plan.countries || []).some((country) => country.toLowerCase() === filters.country.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (filters.sort === 'price_asc') return planPriceValue(a) - planPriceValue(b);
    if (filters.sort === 'price_desc') return planPriceValue(b) - planPriceValue(a);
    return 0;
  }), [plans, filters]);
  const counts = planProviders.map((provider) => ({ ...provider, count: filtered.filter((plan) => plan.provider === provider.key).length }));
  const visibleProviders = filters.provider ? planProviders.filter((provider) => provider.key === filters.provider) : planProviders;
  return <>
    <section className="organic-status plan-status"><div><span><i /> Live plan intelligence</span><h2>Active plan comparison</h2><p>Live plan and roaming offers across stc, Ooredoo, and Zain.</p></div><button type="button" disabled={fetchState.state === 'fetching'} onClick={onFetchPlans}><RefreshCw size={16} /> {fetchState.state === 'fetching' ? 'Fetching plans...' : 'Fetch live plans'}</button><div className="source-chip"><small>Active plans</small><b>{plans.filter((plan) => plan.status !== 'Inactive').length}</b></div></section>
    <div className={`live-fetch-status ${fetchState.state}`}><span><i />{fetchState.message}</span><small>{updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()} · Refresh checks ${sourceLinkCount} configured links` : 'Use Fetch live plans to check every configured source'}</small></div>
    <div className="segmented plan-tabs" role="tablist" aria-label="Plan comparison views"><button className={tab === 'comparison' ? 'active' : ''} type="button" role="tab" aria-selected={tab === 'comparison'} onClick={() => setTab('comparison')}>Plan comparison<span>{plans.length}</span></button><button className={tab === 'sources' ? 'active' : ''} type="button" role="tab" aria-selected={tab === 'sources'} onClick={() => setTab('sources')}>Tracked live plan sources<span>{sourceLinkCount}</span></button></div>
    {tab === 'sources' ? <PlanSourceDirectory sourceMatrix={sourceMatrix} /> : <>
    <section className="organic-kpis">{counts.map((item) => <div key={item.key}><b>{item.count}</b><span>{item.name}</span></div>)}<div><b>{new Set(filtered.map((plan) => plan.category)).size}</b><span>Categories</span></div></section>
    <div className={`feed-toolbar surface plan-toolbar ${filters.category === 'Roaming Plans' ? 'with-country' : ''}`}><label><Search /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search plan title, benefits, or price" /></label><select value={filters.provider} onChange={(event) => setFilters({ ...filters, provider: event.target.value })}><option value="">All providers</option>{planProviders.map((provider) => <option key={provider.key} value={provider.key}>{provider.name}</option>)}</select><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value, country: event.target.value === 'Roaming Plans' ? filters.country : '' })}><option value="">All categories</option>{planCategories.map((category) => <option key={category}>{category}</option>)}</select>{filters.category === 'Roaming Plans' ? <label className="country-filter"><Search /><input list="roaming-country-options" value={filters.country} onChange={(event) => setFilters({ ...filters, country: event.target.value })} placeholder="Search or select country" aria-label="Roaming country" /><datalist id="roaming-country-options">{roamingCountries.map((country) => <option key={country} value={country} />)}</datalist></label> : null}<select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })} aria-label="Sort by price"><option value="">Sort by price</option><option value="price_asc">Price low to high</option><option value="price_desc">Price high to low</option></select><button type="button" onClick={() => setFilters({ search: '', provider: '', category: '', country: '', sort: '' })}><Filter size={16} /> Clear</button></div>
    {filtered.length ? <div className={`plan-comparison-columns ${visibleProviders.length === 1 ? 'single' : ''}`}>{visibleProviders.map((provider) => {
      const providerPlans = filtered.filter((plan) => plan.provider === provider.key);
      return <section className="plan-provider-column" key={provider.key} style={{ '--brand': provider.color }}><header><div>{providerLogo(provider, plans) ? <img className="provider-logo" src={providerLogo(provider, plans)} alt={provider.name} /> : <BrandMark pageId={provider.id} name={provider.key} />}<span><b>{provider.name}</b><small>{providerPlans.length} matching plans</small></span></div></header><div>{providerPlans.length ? providerPlans.map((plan) => { const benefits = planBenefits(plan); return <article className="plan-row-card" key={plan.id}><div className="plan-row-price"><strong>{plan.price || 'Price unavailable'}</strong><span>{plan.sub_category || plan.category}</span></div><h3>{plan.title || 'Plan'}</h3>{filters.category === 'Roaming Plans' && plan.countries?.length ? <p className="plan-country-coverage">{filters.country ? `Available in ${filters.country}` : `${plan.countries.length} supported ${plan.countries.length === 1 ? 'country' : 'countries'}`}</p> : null}<ul>{benefits.length ? benefits.slice(0, 5).map((benefit) => <li key={benefit}>{benefit}</li>) : <li>Benefits were not exposed clearly on the source page.</li>}</ul><footer><a href={plan.detail_url || plan.source_url} target="_blank" rel="noreferrer">Open plan <ArrowUpRight size={14} /></a><a href={plan.source_url} target="_blank" rel="noreferrer">Source</a></footer></article>; }) : <p className="column-empty">No matching plans</p>}</div></section>;
    })}</div> : <div className="empty-state"><CircleAlert /><b>No plans match these filters</b><span>Try another provider, category, or keyword.</span></div>}</>}
  </>;
}

function BannerDashboard({ banners, bannerCoverage, fetchState, updatedAt, onFetchPlans }) {
  const [filters, setFilters] = useState({ search: '', provider: '', category: '' });
  const filtered = useMemo(() => banners.filter((banner) => {
    const haystack = `${banner.title || ''} ${banner.text || ''} ${banner.category || ''} ${banner.sub_category || ''} ${banner.provider_name || ''}`.toLowerCase();
    if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false;
    if (filters.provider && banner.provider !== filters.provider) return false;
    if (filters.category && banner.category !== filters.category) return false;
    return true;
  }), [banners, filters]);
  const counts = providers.map((provider) => ({ ...provider, count: filtered.filter((banner) => banner.provider === provider.key).length }));
  const visibleProviders = filters.provider ? providers.filter((provider) => provider.key === filters.provider) : providers;
  return <>
    <section className="organic-status plan-status"><div><span><i /> Live banner intelligence</span><h2>Current homepage banners</h2><p>Every detected homepage hero, carousel, offer, and campaign image currently published by the three competitors.</p></div><button type="button" disabled={fetchState.state === 'fetching'} onClick={onFetchPlans}><RefreshCw size={16} /> {fetchState.state === 'fetching' ? 'Fetching banners...' : 'Fetch live banners'}</button><div className="source-chip"><small>Current banners</small><b>{banners.length}</b></div></section>
    <div className={`live-fetch-status ${fetchState.state}`}><span><i />{fetchState.message}</span><small>{updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()} · Auto-refresh every hour` : 'Auto-refresh every hour'}</small></div>
    <section className="organic-kpis">{counts.map((item) => <div key={item.key}><b>{item.count}</b><span>{item.name}</span></div>)}<div><b>{new Set(filtered.map((banner) => banner.category)).size}</b><span>Categories</span></div></section>
    <div className="feed-toolbar surface banner-toolbar"><label><Search /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search banner text or category" /></label><select value={filters.provider} onChange={(event) => setFilters({ ...filters, provider: event.target.value })}><option value="">All providers</option>{providers.map((provider) => <option key={provider.key} value={provider.key}>{provider.name}</option>)}</select><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All banner categories</option>{bannerCategories.map((category) => <option key={category}>{category}</option>)}</select><button type="button" onClick={() => setFilters({ search: '', provider: '', category: '' })}><Filter size={16} /> Clear</button></div>
    <div className="banner-source-strip">{(bannerCoverage || []).map((item) => <a key={`${item.provider}-${item.category}`} href={item.api_url || '#'} target={item.api_url ? '_blank' : undefined} rel="noreferrer"><b>{item.category}</b><span>{item.source}</span><em className={item.status === 'ok' ? 'ok' : 'warn'}>{item.count} found</em></a>)}</div>
    <BannerComparison banners={filtered} visibleProviders={visibleProviders} />
  </>;
}

function usableDeviceImage(value) {
  return value && !/^data:/i.test(value) && !/kuwait\.svg|logo|placeholder|blank/i.test(value);
}

function deviceImage(device) {
  const local = device.local_image_url || '';
  if (usableDeviceImage(local)) return local;
  const remote = device.image_url || device.image || '';
  if (usableDeviceImage(remote) && /^https?:\/\//i.test(remote)) return apiUrl(`/api/device-image?url=${encodeURIComponent(remote)}`);
  return '';
}

function DeviceArtwork({ device }) {
  const [failed, setFailed] = useState(false);
  const local = device.local_image_url || '';
  const remote = device.image_url || device.image || '';
  const src = failed && usableDeviceImage(local) ? local : deviceImage(device);
  if (!src) return <EmptyArtwork label="Device" />;
  return <img src={src} alt={device.name || 'Device'} onError={() => setFailed(true)} />;
}

function deviceStock(device) {
  const status = device.stock_status || 'Availability not disclosed';
  const label = device.stock_freshness === 'preserved_source_failure' ? `Last confirmed: ${status}` : status;
  const detail = Number.isFinite(Number(device.stock_quantity)) && device.stock_quantity !== null
    ? `${Number(device.stock_quantity)} units reported`
    : device.stock_evidence || 'Quantity not disclosed by source';
  return { label, detail };
}

function deviceKey(device) {
  return `${device.brand || ''} ${device.name || ''} ${device.storage || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function DeviceComparison({ devices, payload, fetchState, onFetchDevices, onReload }) {
  const [tab, setTab] = useState('devices');
  const [filters, setFilters] = useState({ search: '', provider: '', category: '', stock: '', gap: '', sort: '' });
  const filtered = useMemo(() => devices.filter((device) => {
    const haystack = `${device.name || ''} ${device.brand || ''} ${device.category || ''} ${device.storage || ''} ${device.colors || ''} ${device.offer || ''} ${device.plan || ''}`.toLowerCase();
    if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false;
    if (filters.provider && device.provider !== filters.provider) return false;
    if (filters.category && device.category !== filters.category) return false;
    if (filters.stock === 'in' && !/in stock|available/i.test(device.stock_status || '')) return false;
    if (filters.stock === 'out' && !/out|sold|unavailable/i.test(device.stock_status || '')) return false;
    if (filters.gap === 'missing_stc' && !device.missing_from_stc) return false;
    if (filters.gap === 'competitor_only' && device.provider === 'stc') return false;
    return true;
  }).sort((a, b) => {
    if (filters.sort === 'price_asc') return devicePriceValue(a, 'price') - devicePriceValue(b, 'price');
    if (filters.sort === 'price_desc') return devicePriceValue(b, 'price') - devicePriceValue(a, 'price');
    if (filters.sort === 'installment_asc') return devicePriceValue(a, 'monthly_installment') - devicePriceValue(b, 'monthly_installment');
    return String(b.last_checked || '').localeCompare(String(a.last_checked || ''));
  }), [devices, filters]);
  const counts = providers.map((provider) => ({ ...provider, count: filtered.filter((device) => device.provider === provider.key).length }));
  const stcKeys = new Set(devices.filter((device) => device.provider === 'stc').map(deviceKey).filter(Boolean));
  const competitorMissing = devices.filter((device) => device.provider !== 'stc' && deviceKey(device) && !stcKeys.has(deviceKey(device)));
  const visibleProviders = filters.provider ? providers.filter((provider) => provider.key === filters.provider) : providers;
  const gapRows = filtered.filter((device) => device.provider !== 'stc' && device.missing_from_stc);
  const changes = payload.changes || {};
  return <>
    <section className="organic-status plan-status"><div><span><i /> Device intelligence</span><h2>Device comparison dashboard</h2><p>Live public availability is shown for every device. Exact unit quantity appears only when the competitor store publicly discloses it.</p></div><button type="button" disabled={fetchState.state === 'fetching'} onClick={onFetchDevices}><RefreshCw size={16} /> {fetchState.state === 'fetching' ? 'Fetching devices...' : 'Fetch live devices'}</button><div className="source-chip"><small>Devices loaded</small><b>{devices.length}</b></div></section>
    <div className={`live-fetch-status ${fetchState.state}`}><span><i />{fetchState.message || payload.source || 'Device monitoring snapshot ready.'}</span><small>{payload.generated_at ? `Last checked ${new Date(payload.generated_at).toLocaleString()} · Auto-refresh every hour` : 'Auto-refresh every hour'}</small></div>
    <section className="device-change-strip" aria-label="Changes detected in the latest device refresh"><div><b>{changes.added || 0}</b><span>Added</span></div><div><b>{changes.updated || 0}</b><span>Updated</span></div><div><b>{changes.removed || 0}</b><span>Removed</span></div><div><b>{changes.unchanged ?? devices.length}</b><span>Unchanged</span></div></section>
    <section className="organic-kpis device-kpis">{counts.map((item) => <div key={item.key}><b>{item.count}</b><span>{item.name}</span></div>)}<div><b>{competitorMissing.length}</b><span>Missing from stc</span></div></section>
    <div className="page-actions device-tab-actions"><div className="segmented device-tabs">{[['devices', 'All devices', filtered.length], ['gaps', 'stc gap analysis', gapRows.length]].map(([key, label, count]) => <button key={key} className={tab === key ? 'active' : ''} type="button" onClick={() => setTab(key)}>{label}<span>{count}</span></button>)}</div><button className="load-more" type="button" onClick={onReload}><RefreshCw size={14} /> Reload saved device snapshot</button></div>
    <div className="feed-toolbar surface device-toolbar"><label><Search /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search device name, brand, storage, offer" /></label><select value={filters.provider} onChange={(event) => setFilters({ ...filters, provider: event.target.value })}><option value="">All operators</option>{providers.map((provider) => <option key={provider.key} value={provider.key}>{provider.name}</option>)}</select><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{deviceCategories.map((category) => <option key={category}>{category}</option>)}</select><select value={filters.stock} onChange={(event) => setFilters({ ...filters, stock: event.target.value })}><option value="">All stock</option><option value="in">In stock</option><option value="out">Out of stock</option></select><select value={filters.gap} onChange={(event) => setFilters({ ...filters, gap: event.target.value })}><option value="">All gaps</option><option value="missing_stc">Missing from stc</option><option value="competitor_only">Competitor only</option></select><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="">Newest checked</option><option value="price_asc">Price low to high</option><option value="price_desc">Price high to low</option><option value="installment_asc">Installment low to high</option></select><button type="button" onClick={() => setFilters({ search: '', provider: '', category: '', stock: '', gap: '', sort: '' })}><Filter size={16} /> Clear</button></div>
    {tab === 'gaps' ? <section className="surface device-gap-board"><div className="section-heading"><div><span>stc gap analysis</span><h2>Competitor-only devices</h2></div><Sparkles /></div>{gapRows.length ? <div className="device-gap-grid">{gapRows.map((device) => <article className="device-card" key={device.id || `${device.provider}-${device.name}-${device.product_url}`}><div className="device-card-image"><DeviceArtwork device={device} /></div><div className="device-card-copy"><span>{device.provider_name || device.provider} · {device.category || 'Device'}</span><h3>{device.name || 'Device name unavailable'}</h3><p>{device.description || device.offer || 'Competitor-only device not currently matched in stc.'}</p><dl><div><dt>Brand</dt><dd>{device.brand || 'Unknown'}</dd></div><div><dt>Price</dt><dd>{device.price || 'Unavailable'}</dd></div><div><dt>Stock</dt><dd>{device.stock_status || 'Unknown'}</dd></div></dl><footer><small>Missing in stc</small>{device.product_url ? <a href={device.product_url} target="_blank" rel="noreferrer">Open <ArrowUpRight size={13} /></a> : null}</footer></div></article>)}</div> : <div className="empty-state"><CircleAlert /><b>No competitor-only devices match these filters</b><span>Try clearing filters or click Fetch live devices.</span></div>}</section> : <div className="device-layout">
      <div className={`device-provider-columns ${visibleProviders.length === 1 ? 'single' : ''}`}>{visibleProviders.map((provider) => {
        const providerDevices = filtered.filter((device) => device.provider === provider.key);
        return <section className="device-provider-column" key={provider.key} style={{ '--brand': provider.color }}><header><div>{providerLogo(provider, devices) ? <img className="provider-logo" src={providerLogo(provider, devices)} alt={provider.name} /> : <BrandMark pageId={provider.id} />}<span><b>{provider.name}</b><small>{providerDevices.length} matching devices</small></span></div></header><div>{providerDevices.length ? providerDevices.map((device) => { const stock = deviceStock(device); return <article className="device-card" key={device.id || `${device.provider}-${device.name}-${device.product_url}`}><div className="device-card-image"><DeviceArtwork device={device} /></div><div className="device-card-copy"><span>{device.category || 'Device'}</span><h3>{device.name || 'Device name unavailable'}</h3><p>{device.description || device.offer || 'Description was not captured yet.'}</p><dl><div><dt>Price</dt><dd>{device.price || 'Unavailable'}</dd></div><div><dt>Monthly</dt><dd>{device.monthly_installment || 'Unavailable'}</dd></div><div title={stock.detail}><dt>Stock</dt><dd>{stock.label}</dd></div></dl><footer><small>{device.status || 'Snapshot'} · {device.last_checked || 'Not checked'} · {stock.detail}</small>{device.product_url ? <a href={device.product_url} target="_blank" rel="noreferrer">Open <ArrowUpRight size={13} /></a> : null}</footer></div></article>; }) : <p className="column-empty">No devices loaded yet for this operator.</p>}</div></section>;
      })}</div>
    </div>}
  </>;
}

export default function Dashboard({ initialSection = 'overview' }) {
  const router = useRouter();
  const [active, setActive] = useState(initialSection);
  const [ads, setAds] = useState([]);
  const [adsMeta, setAdsMeta] = useState({});
  const [adsUpdatedAt, setAdsUpdatedAt] = useState('');
  const [adsFetchState, setAdsFetchState] = useState({ state: 'snapshot', message: 'Showing the latest saved Ads Library snapshot.' });
  const [posts, setPosts] = useState([]);
  const [socialProfiles, setSocialProfiles] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planSourceMatrix, setPlanSourceMatrix] = useState([]);
  const [banners, setBanners] = useState([]);
  const [bannerCoverage, setBannerCoverage] = useState([]);
  const [devices, setDevices] = useState([]);
  const [devicesPayload, setDevicesPayload] = useState({});
  const [devicesFetchState, setDevicesFetchState] = useState({ state: 'snapshot', message: 'Showing the latest saved device snapshot.' });
  const [source, setSource] = useState('Checking connection');
  const [socialUpdatedAt, setSocialUpdatedAt] = useState('');
  const [socialCoverage, setSocialCoverage] = useState([]);
  const [socialFetchState, setSocialFetchState] = useState({ state: 'snapshot', message: 'Showing the latest saved Organic snapshot.' });
  const [plansUpdatedAt, setPlansUpdatedAt] = useState('');
  const [plansFetchState, setPlansFetchState] = useState({ state: 'snapshot', message: 'Showing the latest saved plan snapshot.' });
  const [bannerFetchState, setBannerFetchState] = useState({ state: 'snapshot', message: 'Showing the latest saved banner snapshot.' });
  const [menuOpen, setMenuOpen] = useState(false);
  const applyAdsPayload = useCallback((payload) => {
    const records = Array.isArray(payload) ? payload : payload.data || [];
    const generatedAt = Array.isArray(payload) ? '' : payload.generated_at || '';
    const generatedTime = new Date(generatedAt).getTime();
    const isFresh = Number.isFinite(generatedTime) && Date.now() - generatedTime <= 15 * 60 * 1000;
    const isValidated = Array.isArray(payload) || (payload.validation?.complete === true && payload.validation?.active_only === true);
    setAdsMeta(Array.isArray(payload) ? {} : payload);
    setAdsUpdatedAt(generatedAt);
    setAds(isValidated ? records.map((ad, index) => ({ ...ad, _source_index: Number.isFinite(ad._source_index) ? ad._source_index : index })) : []);
    return { isFresh, isValidated };
  }, []);
  const loadAds = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/current-data'), { cache: 'no-store' });
      if (!response.ok) throw new Error(`Live ads API returned HTTP ${response.status}`);
      const result = await response.json();
      const payload = result.payload || result;
      const { isFresh, isValidated } = applyAdsPayload(payload);
      setAdsFetchState(isValidated
        ? isFresh
          ? { state: 'live', message: 'Verified live Ads Library traversal loaded from the dashboard API.' }
          : { state: 'snapshot', message: 'Showing the last fully validated Ads Library snapshot while a new live refresh is requested.' }
        : { state: 'error', message: 'The saved Ads Library data failed validation and cannot be displayed.' });
    } catch (error) {
      setAds([]);
      setAdsFetchState({ state: 'error', message: `Live ads API unavailable: ${error.message}` });
    }
  }, [applyAdsPayload]);
  useEffect(() => { loadAds(); const timer = window.setInterval(loadAds, 30 * 1000); return () => window.clearInterval(timer); }, [loadAds]);
  const applyPlansPayload = useCallback((payload) => {
    const planRows = Array.isArray(payload) ? payload : payload.data || [];
    const planCoverage = Array.isArray(payload) ? [] : payload.coverage || [];
    const bannerRows = Array.isArray(payload) ? [] : payload.banners || [];
    const bannerSources = Array.isArray(payload) ? [] : payload.banner_coverage || [];
    const failedPlans = planCoverage.filter((item) => item.status !== 'ok');
    const failedBanners = bannerSources.filter((item) => item.status !== 'ok');
    setPlans(planRows);
    setPlanSourceMatrix(Array.isArray(payload) ? [] : payload.source_matrix || []);
    setBanners(bannerRows);
    setBannerCoverage(bannerSources);
    setPlansUpdatedAt(Array.isArray(payload) ? '' : payload.generated_at || '');
    setPlansFetchState(failedPlans.length
      ? { state: 'error', message: `${failedPlans.length} live plan sources were blocked or incomplete; only validated or explicitly preserved records are shown.` }
      : { state: 'live', message: `Live plan snapshot verified: ${planRows.length} active plans from ${planCoverage.length} unique public pages.` });
    setBannerFetchState(failedBanners.length
      ? { state: 'error', message: `${failedBanners.length} banner source was blocked or incomplete; its previous image was preserved.` }
      : { state: 'live', message: `Live banner snapshot verified: ${bannerRows.length} current banners.` });
  }, []);
  const loadPlans = useCallback(async () => {
    try {
      let response;
      try { response = await fetch(apiUrl('/api/plans'), { cache: 'no-store' }); if (!response.ok) throw new Error(); }
      catch { response = await fetch('/data/plans.json', { cache: 'no-store' }); }
      applyPlansPayload(await response.json());
    } catch { setPlansFetchState({ state: 'error', message: 'The saved plan and banner dataset could not be loaded.' }); }
  }, [applyPlansPayload]);
  useEffect(() => { loadPlans(); const timer = window.setInterval(loadPlans, 60 * 1000); return () => window.clearInterval(timer); }, [loadPlans]);
  const applyDevicesPayload = useCallback((payload) => { setDevices(Array.isArray(payload) ? payload : payload.data || []); setDevicesPayload(Array.isArray(payload) ? {} : payload); }, []);
  const loadDevices = useCallback(() => {
    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 1200);
    fetch(apiUrl('/api/devices'), { cache: 'no-store', signal: controller.signal }).catch(() => fetch('/data/devices.json', { cache: 'no-store' })).then((response) => response.json()).then(applyDevicesPayload).catch(() => { setDevices([]); setDevicesPayload({ source: 'Device snapshot could not be loaded.' }); }).finally(() => window.clearTimeout(timer));
  }, [applyDevicesPayload]);
  useEffect(() => { loadDevices(); const timer = window.setInterval(loadDevices, 60 * 1000); return () => window.clearInterval(timer); }, [loadDevices]);
  const fetchLiveAds = useCallback(async () => {
    setAdsFetchState({ state: 'fetching', message: 'Fetching all live ads from stc, Ooredoo, and Zain. This may take a few minutes.' });
    try {
      const startResponse = await fetch(apiUrl('/api/fetch-live'), { method: 'POST', cache: 'no-store' });
      await responseJson(startResponse, 'Live ad refresh');

      const deadline = Date.now() + 12 * 60 * 1000;
      let job;
      while (Date.now() < deadline) {
        await wait(5000);
        const statusResponse = await fetch(apiUrl('/api/fetch-live?status=1'), { cache: 'no-store' });
        const statusResult = await responseJson(statusResponse, 'Live ad refresh status');
        job = statusResult.job;
        if (job?.state === 'complete' || job?.state === 'error') break;
        setAdsFetchState({ state: 'fetching', message: job?.message || 'The live ad refresh is still running.' });
      }

      if (!job || job.state === 'running' || job.state === 'idle') throw new Error('The live ad refresh did not finish within 12 minutes. Check the hosting application logs.');
      if (job.state === 'error') throw new Error(job.message || 'The background live ad refresh failed.');

      const dataResponse = await fetch(apiUrl('/api/current-data'), { cache: 'no-store' });
      const dataResult = await responseJson(dataResponse, 'Updated ad data');
      if (!dataResult.payload) throw new Error('The completed refresh did not return an updated dataset.');
      const applied = applyAdsPayload(dataResult.payload);
      if (!applied.isValidated || !applied.isFresh) throw new Error('The completed live result is not fresh and fully validated.');
      setAdsFetchState({ state: 'live', message: job.message || `Live fetch complete. ${job.count || 0} current Ads Library cards loaded.` });
    } catch (error) {
      await loadAds();
      setAdsFetchState({ state: 'error', message: `Live fetch failed: ${error.message}. The last validated snapshot remains visible.` });
    }
  }, [applyAdsPayload, loadAds]);
  const applySocialPayload = useCallback((payload) => {
    const records = Array.isArray(payload) ? payload : payload.data || [];
    const validation = Array.isArray(payload) ? null : payload.instagram_validation;
    const verifiedAccounts = validation?.accounts?.filter((account) => account.complete).length || 0;
    setPosts(recentSocialPosts(records));
    setSocialProfiles(Array.isArray(payload) ? [] : payload.profiles || []);
    setSource(Array.isArray(payload) ? 'Saved organic data' : payload.source || 'Connected provider');
    setSocialUpdatedAt(Array.isArray(payload) ? '' : payload.generated_at || '');
    setSocialCoverage(Array.isArray(payload) ? [] : payload.coverage || []);
    setSocialFetchState(validation?.complete
      ? { state: 'live', message: `Live Instagram source verified: ${payload.fetched_count || 0} newest posts checked across ${verifiedAccounts} accounts.` }
      : { state: 'error', message: payload.fetch_warning || 'The Instagram source has not been verified for all three accounts.' });
  }, []);
  const loadPosts = useCallback(async () => {
    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 1200);
    try {
      let response;
      try { response = await fetch(apiUrl('/api/social-posts'), { cache: 'no-store', signal: controller.signal }); if (!response.ok) throw new Error(); }
      catch { response = await fetch('/data/social-posts.json', { cache: 'no-store' }); }
      const payload = await response.json(); applySocialPayload(payload);
    } catch { setSource('Not connected'); } finally { window.clearTimeout(timer); }
  }, [applySocialPayload]);
  const fetchLiveOrganic = useCallback(async () => {
    setSocialFetchState({ state: 'fetching', message: 'Checking the latest posts from all three Instagram accounts.' });
    try {
      const response = await fetch(apiUrl('/api/fetch-social-posts'), { method: 'POST', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.payload) throw new Error(result.error || 'Organic fetch failed.');
      applySocialPayload(result.payload);
      const failed = (result.payload.coverage || []).filter((item) => item.status !== 'ok');
      setSocialFetchState({ state: failed.length || result.payload.fetch_warning ? 'error' : 'live', message: result.payload.fetch_warning || `${result.message}${failed.length ? ` ${failed.length} account sources were partial or blocked.` : ''}` });
    } catch (error) {
      setSocialFetchState({ state: 'error', message: `Organic fetch failed: ${error.message}. The previous snapshot is still displayed.` });
    }
  }, [applySocialPayload]);
  const fetchPlans = useCallback(async () => {
    setPlansFetchState({ state: 'fetching', message: 'Fetching the 18 configured live plan links from stc, Ooredoo, and Zain.' });
    setBannerFetchState({ state: 'fetching', message: 'Fetching current homepage banners from stc, Ooredoo, and Zain.' });
    try {
      const response = await fetch(apiUrl('/api/fetch-plans'), { method: 'POST', cache: 'no-store' });
      await responseJson(response, 'Plan and banner refresh');
      const job = await waitForComparisonJob('/api/fetch-plans', 'Plan and banner', (message) => setPlansFetchState({ state: 'fetching', message }));
      if (job.state === 'error') throw new Error(job.message || 'Plan and banner refresh failed.');
      const dataResponse = await fetch(apiUrl('/api/plans'), { cache: 'no-store' });
      const payload = await responseJson(dataResponse, 'Updated plan and banner data');
      applyPlansPayload(payload);
    } catch (error) {
      setPlansFetchState({ state: 'error', message: `Plan fetch failed: ${error.message}. The previous snapshot is still displayed.` });
      setBannerFetchState({ state: 'error', message: `Banner fetch failed: ${error.message}. The previous snapshot is still displayed.` });
    }
  }, [applyPlansPayload]);
  const fetchDevices = useCallback(async () => {
    setDevicesFetchState({ state: 'fetching', message: 'Fetching live device listings from stc, Ooredoo, and Zain e-store pages.' });
    try {
      const response = await fetch(apiUrl('/api/fetch-devices'), { method: 'POST', cache: 'no-store' });
      await responseJson(response, 'Device refresh');
      const job = await waitForComparisonJob('/api/fetch-devices', 'Device', (message) => setDevicesFetchState({ state: 'fetching', message }));
      if (job.state === 'error') throw new Error(job.message || 'Device refresh failed.');
      const dataResponse = await fetch(apiUrl('/api/devices'), { cache: 'no-store' });
      const payload = await responseJson(dataResponse, 'Updated device data');
      applyDevicesPayload(payload);
      const failed = (payload.coverage || []).filter((item) => item.status !== 'ok');
      setDevicesFetchState({ state: failed.length ? 'error' : 'live', message: `${job.message}${failed.length ? ` ${failed.length} sources are showing preserved data because the live page was partial or blocked.` : ''}` });
    } catch (error) {
      setDevicesFetchState({ state: 'error', message: `Device fetch failed: ${error.message}. The previous snapshot is still displayed.` });
    }
  }, [applyDevicesPayload]);
  useEffect(() => { loadPosts(); const timer = window.setInterval(loadPosts, 30000); return () => window.clearInterval(timer); }, [loadPosts]);
  useEffect(() => setActive(initialSection), [initialSection]);
  const navigate = useCallback((section) => {
    const path = sectionPaths[section];
    if (!path) return;
    setActive(section);
    setMenuOpen(false);
    router.push(path);
  }, [router]);
  const titles = { overview: ['Intelligence overview', 'A clear view of competitor momentum across paid and organic social.'], boosted: ['Boosted ads', 'Explore campaign activity, creative patterns, and offer gaps.'], organic: ['Organic monitoring', 'Track new posts from configured competitor accounts.'], plans: ['Plan comparison', 'Compare live public telecom plans across stc, Ooredoo, and Zain.'], banners: ['Banner comparison', 'Compare public website banners and campaign copy across stc, Ooredoo, and Zain.'], devices: ['Device comparison', 'Compare devices, prices, installment options, stock, and gaps across stc, Ooredoo, and Zain.'] };
  return <div className="app-shell"><Sidebar active={active} onChange={navigate} open={menuOpen} onClose={() => setMenuOpen(false)} />{menuOpen ? <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close navigation" /> : null}<main className="app-main"><Topbar title={titles[active][0]} subtitle={titles[active][1]} onMenu={() => setMenuOpen(true)} /><div className="page-body">{active === 'overview' ? <Overview ads={ads} onNavigate={navigate} /> : active === 'boosted' ? <Boosted ads={ads} meta={adsMeta} onFetchLive={fetchLiveAds} fetchState={adsFetchState} updatedAt={adsUpdatedAt} /> : active === 'organic' ? <Organic posts={posts} profiles={socialProfiles} source={source} coverage={socialCoverage} onRefresh={loadPosts} onFetchLive={fetchLiveOrganic} fetchState={socialFetchState} updatedAt={socialUpdatedAt} /> : active === 'banners' ? <BannerDashboard banners={banners} bannerCoverage={bannerCoverage} fetchState={bannerFetchState} updatedAt={plansUpdatedAt} onFetchPlans={fetchPlans} /> : active === 'devices' ? <DeviceComparison devices={devices} payload={devicesPayload} fetchState={devicesFetchState} onFetchDevices={fetchDevices} onReload={loadDevices} /> : <PlanComparison plans={plans} sourceMatrix={planSourceMatrix} fetchState={plansFetchState} updatedAt={plansUpdatedAt} onFetchPlans={fetchPlans} />}</div></main></div>;
}
