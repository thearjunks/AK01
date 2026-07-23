'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowUpRight, BarChart3, Bell, ChevronRight, CircleAlert,
  Camera, Download, Eye, Filter, Grid2X2, LayoutDashboard,
  MessageCircle, Menu, RefreshCw, Search, Smartphone,
  Sparkles, Target, TrendingUp, X,
} from 'lucide-react';

const logoUrl = 'https://www.stc.com.kw/icons/stc-logo-purple.svg';
const providers = [
  { key: 'stc', name: 'stc Kuwait', id: '85631962851', color: '#4f008c' },
  { key: 'ooredoo', name: 'Ooredoo Kuwait', id: '181832232881', color: '#ed1c24' },
  { key: 'zain', name: 'Zain Kuwait', id: '114476661945257', color: '#00a651' },
];
const adProviders = [
  ...providers,
  { key: 'virgin', name: 'Virgin Mobile Kuwait', id: '1293796630758728', color: '#e0007a' },
  { key: 'redbull', name: 'Red Bull Mobile by Zain', id: '106380039071315', color: '#132257' },
  { key: 'tawseel', name: 'Zain-tawseel', id: '444661005390298', color: '#00a651' },
  { key: 'gamez', name: 'Gamez Card', id: '101008544936040', color: '#f59e0b' },
];
const planCategories = ['Prepaid', 'Postpaid', 'Postpaid Internet', 'Roaming'];
const bannerCategories = ['Homepage Offers', 'Homepage Carousel', 'Offer Banners', 'Homepage Hero', 'Offers News More'];
const deviceCategories = ['Smartphones', 'Tablets', 'Laptops', 'Internet Devices', 'Gaming', 'Accessories', 'Smartwatches', 'TV'];
const deviceSourceLinks = [
  { provider: 'zain', label: 'Zain devices', url: 'https://www.kw.zain.com/en/shop/devices' },
  { provider: 'stc', label: 'stc e-store', url: 'https://www.stc.com.kw/en/e-store/grid/all' },
  { provider: 'ooredoo', label: 'Ooredoo internet devices', url: 'https://store.ooredoo.com.kw/gadgets/internet-devices.html' },
  { provider: 'ooredoo', label: 'Ooredoo tablets/laptops', url: 'https://store.ooredoo.com.kw/gadgets/tablets-laptops.html' },
  { provider: 'ooredoo', label: 'Ooredoo gaming', url: 'https://store.ooredoo.com.kw/gadgets/gaming.html' },
  { provider: 'ooredoo', label: 'Ooredoo accessories', url: 'https://store.ooredoo.com.kw/gadgets/accessories.html' },
  { provider: 'ooredoo', label: 'Ooredoo smartwatches', url: 'https://store.ooredoo.com.kw/gadgets/accessories/smartwatches.html' },
  { provider: 'ooredoo', label: 'Ooredoo TV', url: 'https://store.ooredoo.com.kw/getooredooadd/tv.html' },
  { provider: 'ooredoo', label: 'Ooredoo full catalog/search', url: 'https://store.ooredoo.com.kw/cash.html' },
  { provider: 'ooredoo', label: 'Ooredoo tablet search', url: 'https://store.ooredoo.com.kw/catalogsearch/result/?q=tablet' },
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
];
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

function apiUrl(path) {
  return path;
}

function textOf(ad) { return ad.ad_creative_body || ad.creative_text || ''; }
function imageOf(ad) { return ad.local_artwork_url || ad.artwork_url || ''; }
function dateOf(ad) { return String(ad.ad_delivery_start_time || '').slice(0, 10); }
function sourceOrderOf(ad) { return Number.isFinite(ad._source_index) ? ad._source_index : Number.MAX_SAFE_INTEGER; }
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

function organicImage(post) {
  return post.local_thumbnail_url || post.thumbnail_url || post.thumbnail || post.image_url || post.media_url || post.cover_url || '';
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
  return organicPublishedLabel(post) || (organicPublishedAt(post) ? relativeTime(organicPublishedAt(post)) : 'Publication time unavailable');
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
  return <div className="filter-bar"><label><Search size={17} /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search campaign copy or ID" /></label><select value={filters.provider} onChange={(event) => setFilters({ ...filters, provider: event.target.value })}><option value="">All competitors</option>{adProviders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input aria-label="Start date" type="date" value={filters.start} onChange={(event) => setFilters({ ...filters, start: event.target.value })} /><select aria-label="Sort boosted ads" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="recent">Sort by: Most recent</option><option value="impressions">Impressions: high to low</option></select><button type="button" onClick={() => setFilters({ search: '', provider: '', start: '', sort: 'recent' })}><Filter size={16} /> Clear</button></div>;
}

function exportAds(rows) {
  const lines = [['Company', 'Library ID', 'Creative', 'Started', 'Status', 'Link'].map(csvCell).join(',')];
  rows.forEach((ad) => lines.push([ad.page_name, ad.ad_archive_id, textOf(ad), dateOf(ad), ad.ad_delivery_stop_time ? 'Ended' : 'Live', ad.ad_snapshot_url].map(csvCell).join(',')));
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'stc-boosted-ads.csv'; anchor.click(); URL.revokeObjectURL(url);
}

function CampaignGrid({ rows }) {
  if (!rows.length) return <div className="empty-state"><CircleAlert /><b>No campaigns match these filters</b><span>Try removing a filter or searching for a different keyword.</span></div>;
  return <div className="campaign-grid">{rows.map((ad) => <article className="campaign-card-new" key={`${ad.page_id}-${ad.ad_archive_id}`}><div className="campaign-image">{imageOf(ad) ? <img src={imageOf(ad)} alt="Campaign creative" /> : <EmptyArtwork />}<span>{ad.ad_delivery_stop_time ? 'Ended' : 'Live'}</span></div><div className="campaign-content"><div className="campaign-company"><BrandMark pageId={ad.page_id} name={ad.page_name} /><span><b>{ad.page_name}</b><small>{dateOf(ad)}</small></span></div><h3>{titleOf(ad)}</h3><p>{textOf(ad)}</p><div><span>ID {ad.ad_archive_id}</span><a href={ad.ad_snapshot_url || '#'} target="_blank" rel="noreferrer">Open ad <ArrowUpRight size={14} /></a></div></div></article>)}</div>;
}

function CompetitorColumns({ rows }) {
  return <div className="competitor-columns">{adProviders.map((provider) => { const providerRows = rows.filter((ad) => String(ad.page_id) === provider.id); return <section key={provider.id}><header style={{ '--brand': provider.color }}><span><BrandMark pageId={provider.id} /><b>{provider.name}</b></span><em>{providerRows.length} ads</em></header><div>{providerRows.map((ad) => <CampaignMini key={`${ad.page_id}-${ad.ad_archive_id}`} ad={ad} />)}{!providerRows.length ? <p className="column-empty">No matching campaigns</p> : null}</div></section>; })}</div>;
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

function Boosted({ ads, onFetchLive, fetchState, updatedAt }) {
  const [tab, setTab] = useState('campaigns');
  const [filters, setFilters] = useState({ search: '', provider: '', start: '', sort: 'recent' });
  const filtered = useMemo(() => ads.filter((ad) => adProviders.some((provider) => provider.id === String(ad.page_id))).filter((ad) => {
    if (filters.search && !`${textOf(ad)} ${ad.ad_archive_id}`.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.provider && String(ad.page_id) !== filters.provider) return false;
    if (filters.start && dateOf(ad) < filters.start) return false;
    return true;
  }).sort((a, b) => {
    if (filters.sort === 'impressions') return sourceOrderOf(a) - sourceOrderOf(b);
    return String(dateOf(b)).localeCompare(String(dateOf(a))) || sourceOrderOf(a) - sourceOrderOf(b);
  }), [ads, filters]);
  return <><div className="page-actions"><div className="segmented">{[['campaigns', 'Campaign library'], ['compare', 'Competitor view'], ['opportunities', 'Offer gaps']].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)} type="button">{label}<span>{filtered.length}</span></button>)}</div><div className="boosted-actions"><button className={`fetch-live-button ${fetchState.state === 'fetching' ? 'fetching' : ''}`} disabled={fetchState.state === 'fetching'} type="button" onClick={onFetchLive}><RefreshCw size={16} /> {fetchState.state === 'fetching' ? 'Fetching live ads…' : 'Fetch live ads'}</button><button className="export-button" type="button" onClick={() => exportAds(filtered)}><Download size={16} /> Export CSV</button></div></div><Filters filters={filters} setFilters={setFilters} /><div className={`live-fetch-status ${fetchState.state}`}><span><i />{fetchState.message}</span><small>{updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : 'No fetch timestamp available'}</small></div><div className="results-summary"><span><b>{filtered.length}</b> campaigns in this view</span><span><i /> All tracked Meta Ads Library URLs</span></div>{tab === 'campaigns' ? <CampaignGrid rows={filtered} /> : tab === 'compare' ? <CompetitorColumns rows={filtered} /> : <OpportunityMatrix rows={filtered} />}</>;
}

function Organic({ posts, source, onRefresh, onFetchLive, fetchState, updatedAt }) {
  const [filters, setFilters] = useState({ search: '', company: '', platform: '', recent: 'all' });
  const recentPlatform = filters.recent === 'all' ? '' : filters.recent;
  const filtered = posts.filter((post) => {
    if (filters.search && !`${post.title || ''} ${organicCaption(post)}`.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.company && organicCompany(post).key !== filters.company) return false;
    if (filters.platform && post.platform !== filters.platform) return false;
    if (recentPlatform && post.platform !== recentPlatform) return false;
    return true;
  }).sort((a, b) => organicPublishedTime(b) - organicPublishedTime(a));

  return <>
    <section className="organic-status"><div><span><i /> Live monitoring</span><h2>Organic publishing watch</h2><p>New posts appear here as soon as the connected provider makes them available.</p></div><button type="button" disabled={fetchState.state === 'fetching'} onClick={onFetchLive}><RefreshCw size={16} /> {fetchState.state === 'fetching' ? 'Fetching posts...' : 'Fetch live organic posts'}</button><div className="source-chip"><small>Data source</small><b>{source}</b></div></section>
    <div className={`live-fetch-status organic-live-status ${fetchState.state}`}><span><i />{fetchState.message}</span><small>{updatedAt ? `Last fetched ${new Date(updatedAt).toLocaleString()}` : 'No live fetch timestamp available'}</small></div>
    <section className="organic-kpis"><div><b>{socialAccounts.length}</b><span>Accounts</span></div><div><b>{posts.length}</b><span>Live posts loaded</span></div><div><b>{posts.filter((post) => !post.viewed).length}</b><span>New posts</span></div><div><b>10m</b><span>Auto live fetch</span></div></section>
    <div className="organic-layout">
      <aside className="organic-accounts"><div className="section-heading"><div><span>Watchlist</span><h2>Tracked accounts</h2></div></div>{['Facebook', 'Instagram', 'TikTok'].map((platform) => <div className="platform-group" key={platform}><b>{platform === 'Facebook' ? <MessageCircle /> : platform === 'Instagram' ? <Camera /> : <Activity />}{platform}</b>{socialAccounts.filter((account) => account[1] === platform).map((account) => <a key={account[2]} href={account[2]} target="_blank" rel="noreferrer"><span>{account[0]}</span><ArrowUpRight /></a>)}</div>)}</aside>
      <section className="organic-feed-main">
        <div className="feed-toolbar surface"><label><Search /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search post captions or descriptions" /></label><select value={filters.company} onChange={(event) => setFilters({ ...filters, company: event.target.value })}><option value="">All companies</option><option value="stc">stc</option><option value="ooredoo">Ooredoo</option><option value="zain">Zain</option></select><select value={filters.platform} onChange={(event) => setFilters({ ...filters, platform: event.target.value })}><option value="">All platforms</option><option>Facebook</option><option>Instagram</option><option>TikTok</option></select><select value={filters.recent} onChange={(event) => setFilters({ ...filters, recent: event.target.value })} aria-label="Recent posts"><option value="all">All most recent</option><option value="Instagram">Most recent Instagram</option><option value="Facebook">Most recent Facebook</option><option value="TikTok">Most recent TikTok</option></select></div>
        {filtered.length ? <><div className="organic-results"><span><b>{filtered.length}</b> organic posts</span><span><i /> Images and descriptions from the connected source</span></div><div className="campaign-grid organic-campaign-grid">{filtered.map((post) => {
          const company = organicCompany(post); const published = organicPublishedAt(post); const caption = organicCaption(post); const link = organicLink(post);
          return <article className="campaign-card-new organic-card" key={post.id || link}><div className="campaign-image">{organicImage(post) ? <img src={organicImage(post)} alt={`${company.name} ${post.platform || ''} post`} /> : <EmptyArtwork label={post.platform || 'Post'} />}<span>{post.post_type || post.type || (post.viewed ? 'Viewed' : 'New')}</span></div><div className="campaign-content"><div className="campaign-company"><BrandMark pageId={company.id} /><span><b>{company.name}</b><small>{post.platform || 'Social'} · {organicDateLabel(post)}</small></span></div><h3>{post.title || `${company.name} ${post.platform || 'social'} post`}</h3><p>{caption || 'No description was supplied by the connected social-data source.'}</p><div><span>{organicRelativeLabel(post)}</span>{link ? <a href={link} target="_blank" rel="noreferrer">Open post <ArrowUpRight size={14} /></a> : <span>Link unavailable</span>}</div></div></article>;
        })}</div></> : <div className="organic-empty surface"><div><Bell /></div><b>Your organic feed is ready</b><p>Connect an approved social-data provider to display post images and descriptions in the same card format as Boosted Ads.</p><button type="button" onClick={onRefresh}><RefreshCw /> Check connection</button></div>}
      </section>
    </div>
  </>;
}

function PlanComparison({ plans, fetchState, updatedAt, onFetchPlans }) {
  const [filters, setFilters] = useState({ search: '', provider: '', category: '', sort: '' });
  const filtered = useMemo(() => plans.filter((plan) => {
    const haystack = `${plan.title || ''} ${plan.price || ''} ${plan.category || ''} ${plan.sub_category || ''} ${plan.provider_name || ''} ${planBenefits(plan).join(' ')}`.toLowerCase();
    if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false;
    if (filters.provider && plan.provider !== filters.provider) return false;
    if (filters.category && plan.category !== filters.category) return false;
    return true;
  }).sort((a, b) => {
    if (filters.sort === 'price_asc') return planPriceValue(a) - planPriceValue(b);
    if (filters.sort === 'price_desc') return planPriceValue(b) - planPriceValue(a);
    return 0;
  }), [plans, filters]);
  const counts = providers.map((provider) => ({ ...provider, count: filtered.filter((plan) => plan.provider === provider.key).length }));
  const visibleProviders = filters.provider ? providers.filter((provider) => provider.key === filters.provider) : providers;
  return <>
    <section className="organic-status plan-status"><div><span><i /> Plan intelligence</span><h2>Plan comparison dashboard</h2><p>Compare prepaid, postpaid, internet, and roaming offers from stc, Ooredoo, and Zain.</p></div><button type="button" disabled={fetchState.state === 'fetching'} onClick={onFetchPlans}><RefreshCw size={16} /> {fetchState.state === 'fetching' ? 'Fetching plans...' : 'Fetch live plans'}</button><div className="source-chip"><small>Plans loaded</small><b>{plans.length}</b></div></section>
    <div className={`live-fetch-status ${fetchState.state}`}><span><i />{fetchState.message}</span><small>{updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : 'No plan fetch timestamp available'}</small></div>
    <section className="organic-kpis">{counts.map((item) => <div key={item.key}><b>{item.count}</b><span>{item.name}</span></div>)}<div><b>{new Set(filtered.map((plan) => plan.category)).size}</b><span>Categories</span></div></section>
    <div className="feed-toolbar surface plan-toolbar"><label><Search /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search plan title, benefits, or price" /></label><select value={filters.provider} onChange={(event) => setFilters({ ...filters, provider: event.target.value })}><option value="">All providers</option>{providers.map((provider) => <option key={provider.key} value={provider.key}>{provider.name}</option>)}</select><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{planCategories.map((category) => <option key={category}>{category}</option>)}</select><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })} aria-label="Sort by price"><option value="">Sort by price</option><option value="price_asc">Price low to high</option><option value="price_desc">Price high to low</option></select><button type="button" onClick={() => setFilters({ search: '', provider: '', category: '', sort: '' })}><Filter size={16} /> Clear</button></div>
    {filtered.length ? <div className={`plan-comparison-columns ${visibleProviders.length === 1 ? 'single' : ''}`}>{visibleProviders.map((provider) => {
      const providerPlans = filtered.filter((plan) => plan.provider === provider.key);
      return <section className="plan-provider-column" key={provider.key} style={{ '--brand': provider.color }}><header><div>{providerLogo(provider, plans) ? <img className="provider-logo" src={providerLogo(provider, plans)} alt={provider.name} /> : <BrandMark pageId={provider.id} />}<span><b>{provider.name}</b><small>{providerPlans.length} matching plans</small></span></div></header><div>{providerPlans.length ? providerPlans.map((plan) => { const benefits = planBenefits(plan); return <article className="plan-row-card" key={plan.id}><div className="plan-row-price"><strong>{plan.price || 'Price unavailable'}</strong><span>{plan.sub_category || plan.category}</span></div><h3>{plan.title || 'Plan'}</h3><ul>{benefits.length ? benefits.slice(0, 5).map((benefit) => <li key={benefit}>{benefit}</li>) : <li>Benefits were not exposed clearly on the source page.</li>}</ul><footer><a href={plan.detail_url || plan.source_url} target="_blank" rel="noreferrer">Open plan <ArrowUpRight size={14} /></a><a href={plan.source_url} target="_blank" rel="noreferrer">Source</a></footer></article>; }) : <p className="column-empty">No matching plans</p>}</div></section>;
    })}</div> : <div className="empty-state"><CircleAlert /><b>No plans match these filters</b><span>Try another provider, category, or keyword.</span></div>}
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
    <section className="organic-status plan-status"><div><span><i /> Banner intelligence</span><h2>Banner comparison dashboard</h2><p>Compare public website banners and visible campaign text from stc, Ooredoo, and Zain plan pages.</p></div><button type="button" disabled={fetchState.state === 'fetching'} onClick={onFetchPlans}><RefreshCw size={16} /> {fetchState.state === 'fetching' ? 'Fetching banners...' : 'Fetch live banners'}</button><div className="source-chip"><small>Banners loaded</small><b>{banners.length}</b></div></section>
    <div className={`live-fetch-status ${fetchState.state}`}><span><i />{fetchState.message}</span><small>{updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : 'No banner fetch timestamp available'}</small></div>
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
  const remote = device.image_url || device.image || '';
  if (usableDeviceImage(remote)) return apiUrl(`/api/device-image?url=${encodeURIComponent(remote)}`);
  const local = device.local_image_url || '';
  if (usableDeviceImage(local)) return local;
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
  return <>
    <section className="organic-status plan-status"><div><span><i /> Device intelligence</span><h2>Device comparison dashboard</h2><p>Monitor devices, prices, installments, stock, offers, and stc gaps across stc, Ooredoo, and Zain.</p></div><button type="button" disabled={fetchState.state === 'fetching'} onClick={onFetchDevices}><RefreshCw size={16} /> {fetchState.state === 'fetching' ? 'Fetching devices...' : 'Fetch live devices'}</button><div className="source-chip"><small>Devices loaded</small><b>{devices.length}</b></div></section>
    <div className={`live-fetch-status ${fetchState.state}`}><span><i />{fetchState.message || payload.source || 'Device monitoring snapshot ready.'}</span><small>{payload.generated_at ? `Last checked ${new Date(payload.generated_at).toLocaleString()}` : 'No device fetch timestamp available'}</small></div>
    <section className="organic-kpis device-kpis">{counts.map((item) => <div key={item.key}><b>{item.count}</b><span>{item.name}</span></div>)}<div><b>{competitorMissing.length}</b><span>Missing from stc</span></div></section>
    <div className="page-actions device-tab-actions"><div className="segmented device-tabs">{[['devices', 'All devices', filtered.length], ['gaps', 'stc gap analysis', gapRows.length]].map(([key, label, count]) => <button key={key} className={tab === key ? 'active' : ''} type="button" onClick={() => setTab(key)}>{label}<span>{count}</span></button>)}</div><button className="load-more" type="button" onClick={onReload}><RefreshCw size={14} /> Reload saved device snapshot</button></div>
    <div className="feed-toolbar surface device-toolbar"><label><Search /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search device name, brand, storage, offer" /></label><select value={filters.provider} onChange={(event) => setFilters({ ...filters, provider: event.target.value })}><option value="">All operators</option>{providers.map((provider) => <option key={provider.key} value={provider.key}>{provider.name}</option>)}</select><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{deviceCategories.map((category) => <option key={category}>{category}</option>)}</select><select value={filters.stock} onChange={(event) => setFilters({ ...filters, stock: event.target.value })}><option value="">All stock</option><option value="in">In stock</option><option value="out">Out of stock</option></select><select value={filters.gap} onChange={(event) => setFilters({ ...filters, gap: event.target.value })}><option value="">All gaps</option><option value="missing_stc">Missing from stc</option><option value="competitor_only">Competitor only</option></select><select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="">Newest checked</option><option value="price_asc">Price low to high</option><option value="price_desc">Price high to low</option><option value="installment_asc">Installment low to high</option></select><button type="button" onClick={() => setFilters({ search: '', provider: '', category: '', stock: '', gap: '', sort: '' })}><Filter size={16} /> Clear</button></div>
    {tab === 'gaps' ? <section className="surface device-gap-board"><div className="section-heading"><div><span>stc gap analysis</span><h2>Competitor-only devices</h2></div><Sparkles /></div>{gapRows.length ? <div className="device-gap-grid">{gapRows.map((device) => <article className="device-card" key={device.id || `${device.provider}-${device.name}-${device.product_url}`}><div className="device-card-image"><DeviceArtwork device={device} /></div><div className="device-card-copy"><span>{device.provider_name || device.provider} · {device.category || 'Device'}</span><h3>{device.name || 'Device name unavailable'}</h3><p>{device.description || device.offer || 'Competitor-only device not currently matched in stc.'}</p><dl><div><dt>Brand</dt><dd>{device.brand || 'Unknown'}</dd></div><div><dt>Price</dt><dd>{device.price || 'Unavailable'}</dd></div><div><dt>Stock</dt><dd>{device.stock_status || 'Unknown'}</dd></div></dl><footer><small>Missing in stc</small>{device.product_url ? <a href={device.product_url} target="_blank" rel="noreferrer">Open <ArrowUpRight size={13} /></a> : null}</footer></div></article>)}</div> : <div className="empty-state"><CircleAlert /><b>No competitor-only devices match these filters</b><span>Try clearing filters or click Fetch live devices.</span></div>}</section> : <div className="device-layout">
      <div className={`device-provider-columns ${visibleProviders.length === 1 ? 'single' : ''}`}>{visibleProviders.map((provider) => {
        const providerDevices = filtered.filter((device) => device.provider === provider.key);
        return <section className="device-provider-column" key={provider.key} style={{ '--brand': provider.color }}><header><div>{providerLogo(provider, devices) ? <img className="provider-logo" src={providerLogo(provider, devices)} alt={provider.name} /> : <BrandMark pageId={provider.id} />}<span><b>{provider.name}</b><small>{providerDevices.length} matching devices</small></span></div></header><div>{providerDevices.length ? providerDevices.map((device) => <article className="device-card" key={device.id || `${device.provider}-${device.name}-${device.product_url}`}><div className="device-card-image"><DeviceArtwork device={device} /></div><div className="device-card-copy"><span>{device.category || 'Device'}</span><h3>{device.name || 'Device name unavailable'}</h3><p>{device.description || device.offer || 'Description was not captured yet.'}</p><dl><div><dt>Price</dt><dd>{device.price || 'Unavailable'}</dd></div><div><dt>Monthly</dt><dd>{device.monthly_installment || 'Unavailable'}</dd></div><div><dt>Stock</dt><dd>{device.stock_status || 'Unknown'}</dd></div></dl><footer><small>{device.status || 'Snapshot'} · {device.last_checked || 'Not checked'}</small>{device.product_url ? <a href={device.product_url} target="_blank" rel="noreferrer">Open <ArrowUpRight size={13} /></a> : null}</footer></div></article>) : <p className="column-empty">No devices loaded yet for this operator.</p>}</div></section>;
      })}</div>
    </div>}
  </>;
}

export default function Dashboard() {
  const [active, setActive] = useState('overview');
  const [ads, setAds] = useState([]);
  const [adsUpdatedAt, setAdsUpdatedAt] = useState('');
  const [adsFetchState, setAdsFetchState] = useState({ state: 'snapshot', message: 'Showing the latest saved Ads Library snapshot.' });
  const [posts, setPosts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [banners, setBanners] = useState([]);
  const [bannerCoverage, setBannerCoverage] = useState([]);
  const [devices, setDevices] = useState([]);
  const [devicesPayload, setDevicesPayload] = useState({});
  const [devicesFetchState, setDevicesFetchState] = useState({ state: 'snapshot', message: 'Showing the latest saved device snapshot.' });
  const [source, setSource] = useState('Checking connection');
  const [socialUpdatedAt, setSocialUpdatedAt] = useState('');
  const [socialFetchState, setSocialFetchState] = useState({ state: 'snapshot', message: 'Showing the latest saved Organic snapshot.' });
  const [plansUpdatedAt, setPlansUpdatedAt] = useState('');
  const [plansFetchState, setPlansFetchState] = useState({ state: 'snapshot', message: 'Showing the latest saved plan snapshot.' });
  const [menuOpen, setMenuOpen] = useState(false);
  const applyAdsPayload = useCallback((payload) => { const records = Array.isArray(payload) ? payload : payload.data || []; setAds(records.map((ad, index) => ({ ...ad, _source_index: Number.isFinite(ad._source_index) ? ad._source_index : index }))); setAdsUpdatedAt(Array.isArray(payload) ? '' : payload.generated_at || ''); }, []);
  useEffect(() => { fetch('/data/ads.json', { cache: 'no-store' }).then((response) => response.json()).then(applyAdsPayload).catch(() => { setAds([]); setAdsFetchState({ state: 'error', message: 'The saved ads dataset could not be loaded.' }); }); }, [applyAdsPayload]);
  const applyPlansPayload = useCallback((payload) => { setPlans(Array.isArray(payload) ? payload : payload.data || []); setBanners(Array.isArray(payload) ? [] : payload.banners || []); setBannerCoverage(Array.isArray(payload) ? [] : payload.banner_coverage || []); setPlansUpdatedAt(Array.isArray(payload) ? '' : payload.generated_at || ''); }, []);
  useEffect(() => { fetch('/data/plans.json', { cache: 'no-store' }).then((response) => response.json()).then(applyPlansPayload).catch(() => { setPlans([]); setPlansFetchState({ state: 'error', message: 'The saved plan dataset could not be loaded yet. Click Fetch live plans.' }); }); }, [applyPlansPayload]);
  const applyDevicesPayload = useCallback((payload) => { setDevices(Array.isArray(payload) ? payload : payload.data || []); setDevicesPayload(Array.isArray(payload) ? {} : payload); }, []);
  const loadDevices = useCallback(() => {
    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 1200);
    fetch(apiUrl('/api/devices'), { cache: 'no-store', signal: controller.signal }).catch(() => fetch('/data/devices.json', { cache: 'no-store' })).then((response) => response.json()).then(applyDevicesPayload).catch(() => { setDevices([]); setDevicesPayload({ source: 'Device snapshot could not be loaded.' }); }).finally(() => window.clearTimeout(timer));
  }, [applyDevicesPayload]);
  useEffect(() => { loadDevices(); }, [loadDevices]);
  const fetchLiveAds = useCallback(async () => {
    setAdsFetchState({ state: 'fetching', message: 'Fetching all live ads from stc, Ooredoo, and Zain. This may take a few minutes.' });
    try {
      const response = await fetch(apiUrl('/api/fetch-live'), { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.payload) throw new Error(result.error || 'Live fetch failed.');
      applyAdsPayload(result.payload);
      setAdsFetchState({ state: 'live', message: `Live fetch complete. ${result.payload.data?.length || 0} current Ads Library cards loaded.` });
    } catch (error) {
      setAdsFetchState({ state: 'error', message: `Live fetch failed: ${error.message}. The previous snapshot is still displayed.` });
    }
  }, [applyAdsPayload]);
  const applySocialPayload = useCallback((payload) => { setPosts(Array.isArray(payload) ? payload : payload.data || []); setSource(Array.isArray(payload) ? 'Saved organic data' : payload.source || 'Connected provider'); setSocialUpdatedAt(Array.isArray(payload) ? '' : payload.generated_at || ''); }, []);
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
    setSocialFetchState({ state: 'fetching', message: 'Fetching Facebook and Instagram posts from all six configured accounts. This may take a few minutes.' });
    try {
      const response = await fetch(apiUrl('/api/fetch-social-posts'), { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
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
    setPlansFetchState({ state: 'fetching', message: 'Fetching live plan pages from stc, Ooredoo, and Zain.' });
    try {
      const response = await fetch(apiUrl('/api/fetch-plans'), { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.payload) throw new Error(result.error || 'Plan fetch failed.');
      applyPlansPayload(result.payload);
      const failed = (result.payload.coverage || []).filter((item) => item.status !== 'ok');
      setPlansFetchState({ state: failed.length || result.payload.fetch_warning ? 'error' : 'live', message: result.payload.fetch_warning || `${result.message}${failed.length ? ` ${failed.length} pages were partial or blocked.` : ''}` });
    } catch (error) {
      setPlansFetchState({ state: 'error', message: `Plan fetch failed: ${error.message}. The previous snapshot is still displayed.` });
    }
  }, [applyPlansPayload]);
  const fetchDevices = useCallback(async () => {
    setDevicesFetchState({ state: 'fetching', message: 'Fetching live device listings from stc, Ooredoo, and Zain e-store pages.' });
    try {
      const response = await fetch(apiUrl('/api/fetch-devices'), { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.payload) throw new Error(result.error || 'Device fetch failed.');
      applyDevicesPayload(result.payload);
      const failed = (result.payload.coverage || []).filter((item) => item.status !== 'ok');
      setDevicesFetchState({ state: failed.length ? 'error' : 'live', message: `${result.message}${failed.length ? ` ${failed.length} pages were partial or blocked.` : ''}` });
    } catch (error) {
      setDevicesFetchState({ state: 'error', message: `Device fetch failed: ${error.message}. The previous snapshot is still displayed.` });
    }
  }, [applyDevicesPayload]);
  useEffect(() => { loadPosts(); const timer = window.setInterval(loadPosts, 30000); return () => window.clearInterval(timer); }, [loadPosts]);
  useEffect(() => {
    if (active !== 'organic') return undefined;
    fetchLiveOrganic();
    const timer = window.setInterval(fetchLiveOrganic, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [active, fetchLiveOrganic]);
  const titles = { overview: ['Intelligence overview', 'A clear view of competitor momentum across paid and organic social.'], boosted: ['Boosted ads', 'Explore campaign activity, creative patterns, and offer gaps.'], organic: ['Organic monitoring', 'Track new posts from configured competitor accounts.'], plans: ['Plan comparison', 'Compare live public telecom plans across stc, Ooredoo, and Zain.'], banners: ['Banner comparison', 'Compare public website banners and campaign copy across stc, Ooredoo, and Zain.'], devices: ['Device comparison', 'Compare devices, prices, installment options, stock, and gaps across stc, Ooredoo, and Zain.'] };
  return <div className="app-shell"><Sidebar active={active} onChange={setActive} open={menuOpen} onClose={() => setMenuOpen(false)} />{menuOpen ? <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close navigation" /> : null}<main className="app-main"><Topbar title={titles[active][0]} subtitle={titles[active][1]} onMenu={() => setMenuOpen(true)} /><div className="page-body">{active === 'overview' ? <Overview ads={ads} onNavigate={setActive} /> : active === 'boosted' ? <Boosted ads={ads} onFetchLive={fetchLiveAds} fetchState={adsFetchState} updatedAt={adsUpdatedAt} /> : active === 'organic' ? <Organic posts={posts} source={source} onRefresh={loadPosts} onFetchLive={fetchLiveOrganic} fetchState={socialFetchState} updatedAt={socialUpdatedAt} /> : active === 'banners' ? <BannerDashboard banners={banners} bannerCoverage={bannerCoverage} fetchState={plansFetchState} updatedAt={plansUpdatedAt} onFetchPlans={fetchPlans} /> : active === 'devices' ? <DeviceComparison devices={devices} payload={devicesPayload} fetchState={devicesFetchState} onFetchDevices={fetchDevices} onReload={loadDevices} /> : <PlanComparison plans={plans} fetchState={plansFetchState} updatedAt={plansUpdatedAt} onFetchPlans={fetchPlans} />}</div></main></div>;
}
