import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { STC_PAGE_ID, pages } from './data/pages.js';
import SocialMonitor from './SocialMonitor.jsx';

const platformOptions = ['Facebook', 'Instagram', 'Messenger', 'Threads'];
const comparisonColumns = [
  { label: 'STC', pageId: STC_PAGE_ID },
  { label: 'Ooredoo', pageId: '181832232881' },
  { label: 'Zain', pageId: '114476661945257' },
];
const offerProviderColumns = [
  { key: 'stc', label: 'stc', pageId: STC_PAGE_ID },
  { key: 'zain', label: 'Zain', pageId: '114476661945257' },
  { key: 'ooredoo', label: 'Ooredoo', pageId: '181832232881' },
];
const offerDefinitions = [
  {
    name: 'go prepaid eSIM activation',
    all: ['esim'],
    any: ['go prepaid', 'باقة go', 'prepaid esim in less than a minute', 'الدفع المسبق بأقل من دقيقة'],
  },
  {
    name: 'Ooredoo app eSIM self-service',
    all: ['esim'],
    any: ['ooredoo app', 'esim swap', 'self-service', 'بدّل الـ esim', 'فرعنا صار في جيبك'],
  },
  {
    name: 'Travel eSIM and roaming',
    any: ['travel esim', 'roaming', '150 countries', '150 دولة', 'تجوال', 'الخليج', 'تركيا'],
    exclude: ['apple watch', 'watch ultra', 'eezee'],
  },
  {
    name: 'Wearable eSIM / Apple Watch connectivity',
    all: ['esim'],
    any: ['apple watch', 'watch ultra'],
  },
  {
    name: 'eeZee SIM / instant eSIM',
    any: ['eezee'],
  },
  {
    name: 'Prepaid voice and data bundles',
    any: ['75gb', '65gb', '500gb', 'go prepaid', 'prepaid', 'kd 7', 'kd 6', '9kd', 'local mins', 'minutes', 'more internet. more minutes', 'الدفع المسبق', 'دقيقة', 'جيجابايت'],
  },
  {
    name: '5G home internet and routers',
    any: ['5g', 'router', 'routers', 'home internet', 'cpe', '1.5 tb', '1.2tb', '1.2 tb', 'إنترنت 5g'],
  },
  {
    name: 'Device installment and add-on devices',
    any: ['iphone', 'airpods', 'smartwatch', 'phone', 'phones', 'device', 'devices', 'add', 'zeed', 'taly', 'installment', 'أجهزة', 'آيفون', 'تقسيط'],
    exclude: ['apple watch', 'watch ultra'],
  },
  {
    name: 'Sports streaming and TOD',
    any: ['tod', 'fifa', 'world cup', 'match', 'goal', 'stadium', 'كأس العالم', 'مباراة'],
  },
  {
    name: 'Digital gift cards and app-store vouchers',
    any: ['itunes', 'psn', 'playstation', 'gift card', 'gift cards', 'google play', 'app store', 'voucher', 'vouchers', 'بطاقات', 'بطاقة', 'قسائم'],
  },
  {
    name: 'Rewards and loyalty benefits',
    any: ['qitaf', 'perks', 'rewards', 'points', 'loyalty', 'نقاط', 'مكافآت'],
  },
  {
    name: 'Annual plan benefits',
    any: ['annual', '365 days', 'yearly', 'paying your annual plan', 'السداد مقدمًا', 'سنة'],
  },
  {
    name: 'Unlimited social media',
    any: ['social media', 'unlimited social', 'سوشال ميديا', 'تواصل اجتماعي'],
  },
  {
    name: 'Night internet',
    any: ['night internet', 'unlimited night', 'إنترنت ليلي', 'ليلي'],
  },
  {
    name: 'Security camera and smart monitoring',
    any: ['security camera', 'solar', 'camera', 'smart eye', 'property', 'أمان', 'ممتلكات'],
  },
  {
    name: 'Entertainment apps and streaming',
    any: ['entertainment', 'streaming', 'watch', 'apps', 'ترفيه', 'تطبيقات'],
  },
];

const initialFilters = {
  search: '',
  page: '',
  platform: '',
  start: '',
  end: '',
};

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function adText(ad) {
  return ad.ad_creative_body || ad.creative_text || '';
}

function campaignTitle(ad) {
  const lines = adText(ad)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^\d+:\d+\s*\/\s*\d+:\d+$/.test(line));
  return lines[0] || ad.ad_creative_link_caption || `Library ID ${ad.ad_archive_id}`;
}

function platforms(ad) {
  const raw = ad.publisher_platforms || ad.platforms || [];
  const values = Array.isArray(raw) ? raw : String(raw).split(',');
  return values.map((item) => String(item).trim()).filter(Boolean);
}

function artworkSrc(ad) {
  return ad.local_artwork_url || ad.artwork_url || '';
}

function duplicateKey(ad) {
  const text = normalize(adText(ad)).replace(/\s+/g, ' ').trim();
  const artwork = normalize(ad.artwork_url).trim();
  return text || artwork ? `${text}|${artwork}` : '';
}

function getDuplicateGroups(rows) {
  const groups = new Map();

  rows
    .filter((ad) => String(ad.page_id) === STC_PAGE_ID && !ad.ad_delivery_stop_time)
    .forEach((ad) => {
      const key = duplicateKey(ad);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ad);
    });

  return [...groups.values()].filter((group) => group.length > 1).sort((a, b) => b.length - a.length);
}

function getDuplicateLookup(groups) {
  const lookup = new Map();
  groups.forEach((group, index) => {
    group.forEach((ad) => {
      lookup.set(String(ad.ad_archive_id), { group: index + 1, count: group.length });
    });
  });
  return lookup;
}

function matchesOffer(ad, offer) {
  const text = normalize([adText(ad), ad.ad_creative_link_caption, ad.search_keywords].join(' '));
  const all = offer.all || [];
  const any = offer.any || [];
  const exclude = offer.exclude || [];
  if (exclude.some((keyword) => text.includes(normalize(keyword)))) return false;
  if (all.length && !all.every((keyword) => text.includes(normalize(keyword)))) return false;
  if (any.length && !any.some((keyword) => text.includes(normalize(keyword)))) return false;
  return all.length > 0 || any.length > 0;
}

function assignedOfferName(ad) {
  const matchedOffer = offerDefinitions.find((offer) => matchesOffer(ad, offer));
  return matchedOffer?.name || `Campaign: ${campaignTitle(ad)}`;
}

function buildOfferRows(rows) {
  const rowsByOffer = new Map();

  rows
    .filter((ad) => offerProviderColumns.some((provider) => provider.pageId === String(ad.page_id)))
    .forEach((ad) => {
      const offer = assignedOfferName(ad);
      if (!rowsByOffer.has(offer)) {
        rowsByOffer.set(offer, {
          offer,
          providers: Object.fromEntries(offerProviderColumns.map((provider) => [provider.key, []])),
          availableProviders: [],
        });
      }

      const row = rowsByOffer.get(offer);
      const provider = offerProviderColumns.find((item) => item.pageId === String(ad.page_id));
      row.providers[provider.key].push(ad);
    });

  return [...rowsByOffer.values()]
    .map((row) => ({
      ...row,
      availableProviders: offerProviderColumns.filter((provider) => row.providers[provider.key].length > 0),
    }))
    .sort((a, b) => {
      const aGap = !a.providers.stc.length && (a.providers.zain.length || a.providers.ooredoo.length);
      const bGap = !b.providers.stc.length && (b.providers.zain.length || b.providers.ooredoo.length);
      if (aGap !== bGap) return aGap ? -1 : 1;
      const aIsCategory = offerDefinitions.some((offer) => offer.name === a.offer);
      const bIsCategory = offerDefinitions.some((offer) => offer.name === b.offer);
      if (aIsCategory !== bIsCategory) return aIsCategory ? -1 : 1;
      return a.offer.localeCompare(b.offer);
    });
}

function offerObservation(row) {
  const available = new Set(row.availableProviders.map((provider) => provider.key));
  const names = row.availableProviders.map((provider) => provider.label);

  if (available.size === 3) return 'Available in all three providers.';
  if (!available.has('stc') && available.size > 0) {
    if (available.size === 1) return `Missing in stc - potential opportunity. Exclusive to ${names[0]}.`;
    return `Missing in stc - potential opportunity. Available in ${names.join(' and ')}.`;
  }
  if (available.has('stc') && available.has('zain') && !available.has('ooredoo')) return 'Available in stc and Zain only.';
  if (available.has('stc') && available.has('ooredoo') && !available.has('zain')) return 'Available in stc and Ooredoo only.';
  if (available.has('stc') && available.size === 1) return 'Available in stc only.';
  if (available.has('zain') && available.size === 1) return 'Exclusive to Zain.';
  if (available.has('ooredoo') && available.size === 1) return 'Exclusive to Ooredoo.';
  return `Available in ${names.join(' and ')} only.`;
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function KpiCard({ label, value, note }) {
  return (
    <div className="kpi">
      <b>{value}</b>
      <span>{label} - {note}</span>
    </div>
  );
}

function SafeImage({ src, alt, className, fallbackClassName, fallbackText }) {
  const [failed, setFailed] = useState(!src);

  if (failed) {
    return <span className={fallbackClassName}>{fallbackText}</span>;
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function Filters({ filters, onChange, onReset, onDownload }) {
  return (
    <div className="panel">
      <h2>Filters</h2>
      <div className="filters">
        <label className="search-control">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search page, ad text, library ID"
            value={filters.search}
            onChange={(event) => onChange('search', event.target.value)}
          />
        </label>
        <select value={filters.page} onChange={(event) => onChange('page', event.target.value)}>
          <option value="">All pages</option>
          {pages.map((page) => (
            <option key={page.pageId} value={page.pageId}>{page.name}</option>
          ))}
        </select>
        <select value={filters.platform} onChange={(event) => onChange('platform', event.target.value)}>
          <option value="">All platforms</option>
          {platformOptions.map((platform) => (
            <option key={platform} value={platform}>{platform}</option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Start date"
          value={filters.start}
          onChange={(event) => onChange('start', event.target.value)}
        />
        <input
          type="date"
          aria-label="End date"
          value={filters.end}
          onChange={(event) => onChange('end', event.target.value)}
        />
        <button className="primary-button" type="button" onClick={onDownload}>
          <Download size={16} aria-hidden="true" />
          Download Excel CSV
        </button>
        <button className="secondary-button" type="button" onClick={onReset}>
          <RotateCcw size={16} aria-hidden="true" />
          Reset filters
        </button>
      </div>
    </div>
  );
}

function TrackedPages() {
  return (
    <div className="panel">
      <h2>Tracked Pages</h2>
      <div className="page-list">
        {pages.map((page) => (
          <div className="page-card" key={page.pageId}>
            <SafeImage
              src={page.logo}
              alt=""
              fallbackClassName="fallback-logo"
              fallbackText={page.name.slice(0, 1)}
            />
            <div>
              <b>{page.name}</b>
              <span>{page.liveCount}</span>
              <a href={page.libraryUrl} target="_blank" rel="noreferrer">
                Open live Ads Library <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignTable({ rows, duplicateLookup }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Page</th>
            <th>Library ID</th>
            <th>Creative</th>
            <th>Started</th>
            <th>Ended</th>
            <th>Artwork</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ad) => {
            const page = pages.find((item) => item.pageId === String(ad.page_id));
            const link = ad.ad_snapshot_url || page?.libraryUrl || '#';
            const duplicate = duplicateLookup.get(String(ad.ad_archive_id));
            const artwork = artworkSrc(ad);

            return (
              <tr key={`${ad.page_id}-${ad.ad_archive_id}`}>
                <td>{ad.page_name || page?.name || ad.page_id}</td>
                <td>
                  <span className="tag">{ad.ad_archive_id}</span>
                  {duplicate ? <span className="dup-badge">Duplicate group {duplicate.group} - {duplicate.count} ads</span> : null}
                </td>
                <td className="creative">{adText(ad)}</td>
                <td>{dateOnly(ad.ad_delivery_start_time)}</td>
                <td>{dateOnly(ad.ad_delivery_stop_time) || 'Live'}</td>
                <td>
                  {artwork ? (
                    <a href={artwork} target="_blank" rel="noreferrer">
                      <SafeImage
                        src={artwork}
                        alt="Campaign artwork"
                        className="artwork-thumb"
                        fallbackClassName="artwork-placeholder"
                        fallbackText="No image"
                      />
                    </a>
                  ) : (
                    <span className="muted">No artwork captured</span>
                  )}
                </td>
                <td>
                  <a className="view-link" href={link} target="_blank" rel="noreferrer">View</a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonTable({ rows }) {
  const groupedRows = comparisonColumns.map((column) => ({
    ...column,
    rows: rows.filter((ad) => String(ad.page_id) === column.pageId),
  }));

  const totalRows = groupedRows.reduce((sum, column) => sum + column.rows.length, 0);

  if (totalRows === 0) {
    return <div className="empty">No STC, Ooredoo, or Zain campaigns match this filter.</div>;
  }

  return (
    <div className="comparison-grid">
      {groupedRows.map((column) => (
        <div className="comparison-column" key={column.pageId}>
          <div className="comparison-head">
            <h3>{column.label}</h3>
            <span>{column.rows.length} campaigns</span>
          </div>
          <div className="campaign-stack">
            {column.rows.length > 0 ? column.rows.map((ad) => {
              const page = pages.find((item) => item.pageId === String(ad.page_id));
              const link = ad.ad_snapshot_url || page?.libraryUrl || '#';
              const artwork = artworkSrc(ad);

              return (
                <article className="campaign-card" key={`${ad.page_id}-${ad.ad_archive_id}`}>
                  <a href={artwork || link} target="_blank" rel="noreferrer" className="campaign-artwork-link">
                    <SafeImage
                      src={artwork}
                      alt="Campaign artwork"
                      fallbackClassName="campaign-artwork-missing"
                      fallbackText="No image"
                    />
                  </a>
                  <div className="campaign-card-body">
                    <h4>{campaignTitle(ad)}</h4>
                    <div className="campaign-meta">
                      <span>{dateOnly(ad.ad_delivery_start_time) || 'No start date'}</span>
                      <span>{ad.ad_delivery_stop_time ? dateOnly(ad.ad_delivery_stop_time) : 'Live'}</span>
                    </div>
                    <div className="campaign-card-footer">
                      <span className="tag">{ad.ad_archive_id}</span>
                      <a className="view-link" href={link} target="_blank" rel="noreferrer">View</a>
                    </div>
                  </div>
                </article>
              );
            }) : (
              <div className="comparison-empty">No campaigns in this filter.</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function OfferCell({ ads }) {
  if (!ads.length) {
    return <span className="not-available">Not Available</span>;
  }

  return (
    <div className="offer-cell">
      <span className="available">Available ({ads.length})</span>
      <div className="offer-campaign-list">
        {ads.map((ad) => {
          const page = pages.find((item) => item.pageId === String(ad.page_id));
          const link = ad.ad_snapshot_url || page?.libraryUrl || '#';
          const artwork = artworkSrc(ad);

          return (
            <a className="offer-campaign-item" href={link} target="_blank" rel="noreferrer" key={`${ad.page_id}-${ad.ad_archive_id}`}>
              <SafeImage
                src={artwork}
                alt="Campaign artwork"
                fallbackClassName="offer-campaign-placeholder"
                fallbackText="No image"
              />
              <span>
                <b>{campaignTitle(ad)}</b>
                <em>{ad.ad_archive_id}</em>
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function OfferComparisonTable({ rows }) {
  const offerRows = buildOfferRows(rows);
  const missingFromStc = offerRows.filter((row) => !row.providers.stc.length && (row.providers.zain.length || row.providers.ooredoo.length)).length;
  const representedCampaigns = offerRows.reduce(
    (sum, row) => sum + offerProviderColumns.reduce((providerSum, provider) => providerSum + row.providers[provider.key].length, 0),
    0,
  );

  if (!offerRows.length) {
    return <div className="empty">No comparable offers match this filter.</div>;
  }

  return (
    <>
      <div className="offer-summary">
        <b>{missingFromStc}</b>
        <span>offer gap{missingFromStc === 1 ? '' : 's'} missing from stc in the current filters</span>
        <strong>{representedCampaigns} campaigns represented</strong>
      </div>
      <div className="offer-table-wrap">
        <table className="offer-table">
          <thead>
            <tr>
              <th>Unique Offer</th>
              {offerProviderColumns.map((provider) => (
                <th key={provider.key}>{provider.label}</th>
              ))}
              <th>Status / Observation</th>
            </tr>
          </thead>
          <tbody>
            {offerRows.map((row) => {
              const isStcGap = !row.providers.stc.length && (row.providers.zain.length || row.providers.ooredoo.length);
              return (
                <tr key={row.offer} className={isStcGap ? 'gap-row' : ''}>
                  <td className="offer-name">{row.offer}</td>
                  {offerProviderColumns.map((provider) => (
                    <td key={provider.key}>
                      <OfferCell ads={row.providers[provider.key]} />
                    </td>
                  ))}
                  <td className="observation">{offerObservation(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function App() {
  const [ads, setAds] = useState([]);
  const [status, setStatus] = useState('Loading data');
  const [fetchMessage, setFetchMessage] = useState('');
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [view, setView] = useState('ads');
  const [dashboard, setDashboard] = useState('ads');

  const loadImportedAds = useCallback((ignore = false) => {
    fetch('/data/ads.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No ads.json found');
        return response.json();
      })
      .then((payload) => {
        if (ignore) return;
        const records = Array.isArray(payload) ? payload : payload.data || [];
        setAds(records);
        setStatus(`${records.length} records loaded`);
      })
      .catch(() => {
        if (ignore) return;
        setAds([]);
        setStatus('No ad data imported yet');
      });
  }, []);

  useEffect(() => {
    let ignore = false;

    loadImportedAds(ignore);

    return () => {
      ignore = true;
    };
  }, [loadImportedAds]);

  const fetchLiveData = useCallback(async () => {
    setIsFetchingLive(true);
    setFetchMessage('Fetching live data...');
    try {
      const response = await fetch('http://127.0.0.1:8787/api/fetch-live', { cache: 'no-store' });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || `Live fetch failed with HTTP ${response.status}.`);
      }

      const records = Array.isArray(result.payload) ? result.payload : result.payload.data || [];
      setAds(records);
      setStatus(`${records.length} live records loaded`);
      setFetchMessage(result.message || `Fetched ${records.length} live records.`);
    } catch (error) {
      setFetchMessage(`${error.message} Start the live fetch service with npm run live-server, and configure LIVE_ADS_JSON_URL for a real live source.`);
    } finally {
      setIsFetchingLive(false);
    }
  }, []);

  const pageLookup = useMemo(() => new Map(pages.map((page) => [page.pageId, page])), []);

  const filteredAds = useMemo(() => {
    const query = normalize(filters.search);
    return ads.filter((ad) => {
      const adPlatforms = platforms(ad);
      const start = dateOnly(ad.ad_delivery_start_time);
      const searchableText = [
        ad.page_name,
        ad.page_id,
        ad.ad_archive_id,
        adText(ad),
        ad.ad_creative_link_caption,
        ad.search_keywords,
        adPlatforms.join(' '),
      ].join(' ');

      if (query && !normalize(searchableText).includes(query)) return false;
      if (filters.page && String(ad.page_id) !== filters.page) return false;
      if (filters.platform && adPlatforms.length > 0 && !adPlatforms.includes(filters.platform)) return false;
      if (filters.start && start < filters.start) return false;
      if (filters.end && start > filters.end) return false;
      return true;
    });
  }, [ads, filters]);

  const duplicateGroups = useMemo(() => getDuplicateGroups(filteredAds), [filteredAds]);
  const duplicateLookup = useMemo(() => getDuplicateLookup(duplicateGroups), [duplicateGroups]);
  const displayRows = view === 'duplicates' ? duplicateGroups.flat() : filteredAds;
  const comparisonTotal = useMemo(
    () => filteredAds.filter((ad) => comparisonColumns.some((column) => column.pageId === String(ad.page_id))).length,
    [filteredAds],
  );
  const offerRows = useMemo(() => buildOfferRows(filteredAds), [filteredAds]);
  const offerCampaignTotal = useMemo(
    () => offerRows.reduce(
      (sum, row) => sum + offerProviderColumns.reduce((providerSum, provider) => providerSum + row.providers[provider.key].length, 0),
      0,
    ),
    [offerRows],
  );
  const stcOfferGaps = useMemo(
    () => offerRows.filter((row) => !row.providers.stc.length && (row.providers.zain.length || row.providers.ooredoo.length)).length,
    [offerRows],
  );

  const kpis = useMemo(() => {
    const active = filteredAds.filter((ad) => !ad.ad_delivery_stop_time).length;
    const withArtwork = filteredAds.filter((ad) => artworkSrc(ad)).length;
    const pageCount = new Set(filteredAds.map((ad) => String(ad.page_id || ''))).size;

    return [
      ['Tracked Pages', pages.length, 'Meta Ads Library page links'],
      ['Imported Ads', filteredAds.length, 'records in current date range'],
      ['Active Ads', active, 'records without stop date'],
      ['With Artwork', withArtwork, 'rows with captured creative image'],
      ['STC Duplicates', duplicateGroups.length, 'duplicate creative groups running'],
      ['Pages Matched', pageCount, 'pages in current filters'],
    ];
  }, [duplicateGroups.length, filteredAds]);

  const updateFilter = useCallback((key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setView('ads');
  }, []);

  const downloadExcelCsv = useCallback(() => {
    const headers = ['Page', 'Library ID', 'Creative', 'Started', 'Ended', 'Platforms', 'Artwork URL', 'Ad Library Link'];
    const csvRows = [headers.map(csvCell).join(',')];

    filteredAds.forEach((ad) => {
      const page = pageLookup.get(String(ad.page_id));
      const link = ad.ad_snapshot_url || page?.libraryUrl || '';
      csvRows.push([
        ad.page_name || page?.name || ad.page_id || '',
        ad.ad_archive_id || '',
        adText(ad),
        dateOnly(ad.ad_delivery_start_time),
        dateOnly(ad.ad_delivery_stop_time) || 'Live',
        platforms(ad).join(', '),
        artworkSrc(ad),
        link,
      ].map(csvCell).join(','));
    });

    const blob = new Blob(['\ufeff' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `meta-ads-campaigns-${stamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [filteredAds, pageLookup]);

  return (
    <>
      <header>
        <div>
          <h1>{dashboard === 'social' ? 'Social Media Live Monitoring Dashboard' : 'Meta Ads Live Dashboard'}</h1>
          <div className="subhead">{dashboard === 'social' ? 'Real-time organic post monitoring for Kuwait telecom competitors across Facebook, Instagram, and TikTok.' : 'Kuwait competitor watchlist from Meta Ads Library page links, with date-range filtering for imported ad records.'}</div>
        </div>
        <div className="header-actions">
          {dashboard === 'ads' ? <>
            <button className="fetch-button" type="button" onClick={fetchLiveData} disabled={isFetchingLive}>
              <RefreshCw size={16} aria-hidden="true" />
              {isFetchingLive ? 'Fetching...' : 'Fetch live data'}
            </button>
            <div className="status-pill">{status}</div>
          </> : <div className="status-pill">9 social accounts configured</div>}
        </div>
      </header>

      <main>
        <div className="dashboard-switcher" role="tablist" aria-label="Dashboard workspace">
          <button className={dashboard === 'ads' ? 'active' : ''} type="button" onClick={() => setDashboard('ads')}>Boosted Ads</button>
          <button className={dashboard === 'social' ? 'active' : ''} type="button" onClick={() => setDashboard('social')}>Organic</button>
        </div>
        {dashboard === 'social' ? <SocialMonitor /> : <>
        {fetchMessage ? <div className="fetch-message">{fetchMessage}</div> : null}
        <div className="notice">
          Meta does not expose a supported public API for all active Kuwait ads by competitor page. This React dashboard is wired for imported Ads Library records and keeps direct live Ads Library links for each page.
        </div>

        <section className="kpis" aria-label="Dashboard metrics">
          {kpis.map(([label, value, note]) => (
            <KpiCard key={label} label={label} value={value} note={note} />
          ))}
        </section>

        <div className="layout">
          <aside>
            <Filters filters={filters} onChange={updateFilter} onReset={resetFilters} onDownload={downloadExcelCsv} />
            <TrackedPages />
          </aside>

          <div className="sections">
            <section className="section">
              <h2>{view === 'duplicates' ? 'Duplicate Campaigns' : view === 'comparison' ? 'Comparison Table' : view === 'offers' ? 'Offer Comparison (stc vs Zain vs Ooredoo)' : 'Ads'}</h2>
              <div className="tabs" role="tablist" aria-label="Campaign views">
                <button className={`tab ${view === 'ads' ? 'active' : ''}`} type="button" onClick={() => setView('ads')}>
                  All Ads
                </button>
                <button className={`tab ${view === 'duplicates' ? 'active' : ''}`} type="button" onClick={() => setView('duplicates')}>
                  Duplicate Campaigns ({duplicateGroups.length})
                </button>
                <button className={`tab ${view === 'comparison' ? 'active' : ''}`} type="button" onClick={() => setView('comparison')}>
                  Comparison Table ({comparisonTotal})
                </button>
                <button className={`tab ${view === 'offers' ? 'active' : ''}`} type="button" onClick={() => setView('offers')}>
                  Offer Comparison ({stcOfferGaps} gap{stcOfferGaps === 1 ? '' : 's'})
                </button>
              </div>

              {duplicateGroups.length > 0 ? (
                <div className="duplicate-alert">
                  STC is running {duplicateGroups.length} duplicate campaign group{duplicateGroups.length === 1 ? '' : 's'} in the current filters.
                </div>
              ) : null}

              <div className="result-count">
                {view === 'offers'
                  ? `Reviewing ${offerRows.length} offer rows with ${offerCampaignTotal} STC, Zain, and Ooredoo campaigns represented`
                  : view === 'comparison'
                  ? `Comparing ${comparisonTotal} STC, Ooredoo, and Zain campaigns in the current filters`
                  : view === 'duplicates'
                    ? `Showing ${displayRows.length} duplicate STC ads from ${duplicateGroups.length} groups`
                    : `Showing ${displayRows.length} of ${ads.length} active campaigns`}
              </div>

              {view === 'comparison' ? (
                <ComparisonTable rows={filteredAds} />
              ) : view === 'offers' ? (
                <OfferComparisonTable rows={filteredAds} />
              ) : displayRows.length > 0 ? (
                <CampaignTable rows={displayRows} duplicateLookup={duplicateLookup} />
              ) : (
                <div className="empty">{view === 'duplicates' ? 'No duplicate STC campaigns match this filter.' : 'No imported ads match this filter.'}</div>
              )}
            </section>

            <section className="section method">
              <h2>React Data Source</h2>
              This React dashboard reads imported campaign records from <code>public/data/ads.json</code>. Update that file when new Meta Ads Library records are captured.
            </section>
          </div>
        </div>
        </>}
      </main>
    </>
  );
}

export default App;
