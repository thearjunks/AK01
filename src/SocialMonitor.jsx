import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellRing, Download, ExternalLink, Eye, RefreshCw, Search } from 'lucide-react';
import { socialAccounts } from './data/socialAccounts.js';

const companies = ['stc', 'ooredoo', 'zain'];
const platforms = ['Facebook', 'Instagram', 'TikTok'];
const postTypes = ['Image', 'Video', 'Reel', 'Carousel', 'Story', 'Post'];
const initialFilters = { company: '', platform: '', date: '', type: '', search: '', sort: 'newest' };

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function postId(post) {
  return String(post.id || post.post_id || post.url || post.direct_url || '');
}

function publishedAt(post) {
  return post.published_at || post.publishedAt || post.created_time || post.timestamp || '';
}

function thumbnailUrl(post) {
  return post.local_thumbnail_url || post.thumbnail_url || post.thumbnail || post.image_url || post.media_url || post.cover_url || '';
}

function relativeTime(value, now = Date.now()) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Time unavailable';
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function normalizePost(post) {
  return {
    ...post,
    id: postId(post),
    company: String(post.company || '').toLowerCase(),
    platform: post.platform || 'Unknown',
    published_at: publishedAt(post),
    thumbnail_url: thumbnailUrl(post),
    title: post.title || '',
    caption: post.caption || post.description || post.text || '',
    post_type: post.post_type || post.type || 'Post',
    direct_url: post.direct_url || post.url || post.permalink || '',
  };
}

async function fetchWithTimeout(url, timeout = 1500) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function downloadCsv(rows) {
  const headers = ['Company', 'Platform', 'Published at', 'Elapsed', 'Title', 'Caption', 'Post type', 'Status', 'Thumbnail', 'Original post'];
  const lines = [headers.map(csvCell).join(',')];
  rows.forEach((post) => lines.push([
    post.company,
    post.platform,
    post.published_at,
    relativeTime(post.published_at),
    post.title,
    post.caption,
    post.post_type,
    post.viewed ? 'Previously Viewed' : 'New',
    post.thumbnail_url,
    post.direct_url,
  ].map(csvCell).join(',')));
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `social-media-posts-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function SocialMonitor() {
  const [posts, setPosts] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [alerts, setAlerts] = useState([]);
  const [source, setSource] = useState('Checking connection');
  const [lastChecked, setLastChecked] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewedIds, setViewedIds] = useState(() => new Set(JSON.parse(localStorage.getItem('social-monitor-viewed') || '[]')));
  const knownIds = useRef(null);

  const loadPosts = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);
    try {
      let response;
      try {
        response = await fetchWithTimeout(`http://127.0.0.1:8787/api/${manual ? 'fetch-social-posts' : 'social-posts'}`);
        if (!response.ok) throw new Error('Monitor service unavailable');
      } catch {
        response = await fetch('/data/social-posts.json', { cache: 'no-store' });
      }
      if (!response.ok) throw new Error(`Social feed returned HTTP ${response.status}`);
      const result = await response.json();
      const payload = result.payload || result;
      const records = (Array.isArray(payload) ? payload : payload.data || []).map(normalizePost).filter((post) => post.id);
      const ids = new Set(records.map(postId));

      if (knownIds.current) {
        const newlyDetected = records.filter((post) => !knownIds.current.has(post.id));
        if (newlyDetected.length) {
          setAlerts((current) => [...newlyDetected.map((post) => ({ ...post, alert_id: `${post.id}-${Date.now()}` })), ...current].slice(0, 50));
          if (Notification.permission === 'granted') {
            newlyDetected.slice(0, 3).forEach((post) => new Notification(`New ${post.platform} post from ${post.company}`, { body: `${post.title || post.caption || 'New post'} · ${relativeTime(post.published_at)}` }));
          }
        }
      }

      knownIds.current = ids;
      setPosts(records);
      setSource(payload.source || 'Connected feed');
      setLastChecked(new Date());
    } catch (error) {
      setSource(error.message);
      setLastChecked(new Date());
    } finally {
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
    const timer = window.setInterval(() => loadPosts(), 30_000);
    return () => window.clearInterval(timer);
  }, [loadPosts]);

  useEffect(() => {
    const timer = window.setInterval(() => setLastChecked((current) => current ? new Date(current) : current), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const markViewed = useCallback((id) => {
    setViewedIds((current) => {
      const next = new Set(current);
      next.add(id);
      localStorage.setItem('social-monitor-viewed', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const filtered = useMemo(() => posts
    .map((post) => ({ ...post, viewed: viewedIds.has(post.id) }))
    .filter((post) => {
      const text = `${post.title} ${post.caption}`.toLowerCase();
      if (filters.company && post.company !== filters.company) return false;
      if (filters.platform && post.platform !== filters.platform) return false;
      if (filters.type && post.post_type !== filters.type) return false;
      if (filters.date && String(post.published_at).slice(0, 10) !== filters.date) return false;
      if (filters.search && !text.includes(filters.search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => (filters.sort === 'newest' ? -1 : 1) * (new Date(a.published_at) - new Date(b.published_at))), [filters, posts, viewedIds]);

  const filteredAlerts = useMemo(() => alerts.filter((post) => {
    if (filters.company && post.company !== filters.company) return false;
    if (filters.platform && post.platform !== filters.platform) return false;
    return true;
  }), [alerts, filters.company, filters.platform]);

  const enableNotifications = async () => {
    if ('Notification' in window) await Notification.requestPermission();
  };

  return (
    <div className="social-monitor">
      <div className="social-hero">
        <div>
          <span className="live-label"><i /> Live monitor</span>
          <h2>Social Media Monitoring</h2>
          <p>Organic post watchlist for stc Kuwait, Ooredoo Kuwait, and Zain Kuwait.</p>
        </div>
        <div className="social-actions">
          <button className="secondary-button compact" type="button" onClick={enableNotifications}><Bell size={16} /> Enable browser alerts</button>
          <button className="primary-button compact" type="button" onClick={() => loadPosts({ manual: true })} disabled={refreshing}><RefreshCw size={16} /> {refreshing ? 'Checking…' : 'Check now'}</button>
        </div>
      </div>

      <div className="monitor-status">
        <span><b>Source:</b> {source}</span>
        <span><b>Last checked:</b> {lastChecked ? lastChecked.toLocaleTimeString() : 'Waiting'}</span>
        <span><b>Refresh:</b> every 30 seconds while open</span>
      </div>

      <section className="social-kpis">
        <div><b>{socialAccounts.length}</b><span>Accounts tracked</span></div>
        <div><b>{posts.length}</b><span>Posts loaded</span></div>
        <div><b>{posts.filter((post) => !viewedIds.has(post.id)).length}</b><span>New posts</span></div>
        <div><b>{alerts.length}</b><span>Detected this session</span></div>
      </section>

      <div className="social-layout">
        <aside className="social-sidebar">
          <section className="panel">
            <h2>Post filters</h2>
            <div className="filters">
              <label className="search-control"><Search size={16} /><input type="search" placeholder="Search captions or descriptions" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
              <select value={filters.company} onChange={(event) => setFilters({ ...filters, company: event.target.value })}><option value="">All companies</option>{companies.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={filters.platform} onChange={(event) => setFilters({ ...filters, platform: event.target.value })}><option value="">All platforms</option>{platforms.map((item) => <option key={item}>{item}</option>)}</select>
              <input type="date" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} />
              <select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">All post types</option>{postTypes.map((item) => <option key={item}>{item}</option>)}</select>
              <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
              <button className="primary-button" type="button" onClick={() => downloadCsv(filtered)}><Download size={16} /> Export Excel CSV</button>
              <button className="secondary-button" type="button" onClick={() => setFilters(initialFilters)}>Reset filters</button>
            </div>
          </section>

          <section className="panel alert-panel">
            <h2><BellRing size={17} /> Instant alerts <span>{filteredAlerts.length}</span></h2>
            {filteredAlerts.length ? filteredAlerts.map((alert) => <a key={alert.alert_id} href={alert.direct_url || '#'} target="_blank" rel="noreferrer"><b>{alert.company} · {alert.platform}</b><span>{alert.published_at ? new Date(alert.published_at).toLocaleString() : 'Time unavailable'}</span></a>) : <p>No new-post alerts this session.</p>}
          </section>
        </aside>

        <section className="section social-feed">
          <div className="feed-heading"><div><h2>Real-time post feed</h2><span>{filtered.length} matching posts</span></div><div className="feed-legend"><span className="status-new">New</span><span className="status-viewed">Previously Viewed</span></div></div>
          {filtered.length ? <div className="post-grid">{filtered.map((post) => (
            <article className={`post-card ${post.viewed ? '' : 'is-new'}`} key={post.id}>
              <div className="post-media">{post.thumbnail_url ? <img src={post.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>{post.platform}</span>}<em>{post.post_type}</em></div>
              <div className="post-body">
                <div className="post-meta"><b>{post.company}</b><span>{post.platform}</span><time dateTime={post.published_at}>{post.published_at ? new Date(post.published_at).toLocaleString() : 'Time unavailable'}</time></div>
                <h3>{post.title || `${post.company} ${post.platform} post`}</h3>
                <p>{post.caption || 'No caption supplied by the connected source.'}</p>
                <div className="post-footer"><span className={post.viewed ? 'status-viewed' : 'status-new'}>{post.viewed ? 'Previously Viewed' : 'New'}</span><span>{relativeTime(post.published_at)}</span><div><button type="button" onClick={() => markViewed(post.id)} disabled={post.viewed}><Eye size={14} /> Mark viewed</button>{post.direct_url ? <a href={post.direct_url} target="_blank" rel="noreferrer">Open post <ExternalLink size={13} /></a> : null}</div></div>
              </div>
            </article>
          ))}</div> : <div className="empty social-empty"><Bell size={28} /><b>No posts available from the connected source.</b><span>Connect an approved social-data provider to begin live monitoring. The dashboard does not present demo records as live data.</span></div>}
        </section>
      </div>

      <section className="section account-watchlist">
        <h2>Configured account watchlist</h2>
        <div>{socialAccounts.map((account) => <a key={`${account.company}-${account.platform}`} href={account.url} target="_blank" rel="noreferrer"><b>{account.label}</b><span>{account.platform}</span><ExternalLink size={13} /></a>)}</div>
      </section>
    </div>
  );
}
