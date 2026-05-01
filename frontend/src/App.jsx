import { useState, useMemo } from 'react';
import logo from './assets/APX-logo.png';
import axios from 'axios';
import { db } from './db';
import './App.css';

// ── Config ───────────────────────────────────────────────────────
const PLATFORM_ITEMS = [
  { id: 'semua',     label: 'Semua Platform', color: '#3B82F6' },
  { id: 'tokopedia', label: 'Tokopedia',       color: '#22C55E' },
  { id: 'lazada',    label: 'Lazada',           color: '#9333EA' },
  { id: 'shopee',    label: 'Shopee',           color: '#FB923C' },
  { id: 'bukalapak', label: 'Bukalapak',        color: '#EF4444' },
];

const LOKASI_ITEMS = [
  { id: 'semua',    label: 'Semua Lokasi' },
  { id: 'jakarta',  label: 'Jakarta' },
  { id: 'surabaya', label: 'Surabaya' },
  { id: 'bandung',  label: 'Bandung' },
  { id: 'medan',    label: 'Medan' },
  { id: 'bali',     label: 'Bali' },
];

const SUGGESTIONS = ['iPhone 15 Pro', 'Laptop Gaming', 'Air Jordan', 'Samsung S24', 'Smartwatch'];

// ── Helper: parse harga string → angka ───────────────────────────
const parseHarga = (str = '') => {
  const angka = str.replace(/[^0-9]/g, '');
  return angka ? parseInt(angka, 10) : 0;
};

// ── Helper: fix Lazada image URL (CORS / referrer issue) ─────────
// Lazada memblokir gambar jika referer tidak sesuai.
// Kita gunakan image proxy publik (wsrv.nl) sebagai workaround.
const fixImageUrl = (url, platform) => {
  if (!url) return null;
  const platformLower = (platform || '').toLowerCase();
  if (platformLower.includes('lazada') && url.startsWith('http')) {
    // wsrv.nl adalah free image proxy yang menghilangkan header CORS/referrer
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&output=webp`;
  }
  return url;
};

// ── App ──────────────────────────────────────────────────────────
function App() {
  const [keyword, setKeyword]       = useState('');
  const [hasil, setHasil]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [sumberData, setSumberData] = useState('');
  const [favorites, setFavorites]   = useState(new Set());

  // Sidebar
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [platformOpen, setPlatformOpen] = useState(true);
  const [lokasiOpen, setLokasiOpen]     = useState(false);
  const [hargaOpen, setHargaOpen]       = useState(true);
  const [sortOpen, setSortOpen]         = useState(false);

  // Filters
  const [platformAktif, setPlatformAktif] = useState('semua');
  const [lokasiAktif, setLokasiAktif]     = useState('semua');
  const [sortMode, setSortMode]           = useState('default');
  const [maxHarga, setMaxHarga]           = useState(50000000);
  const [minHarga, setMinHarga]           = useState(0);

  // Dark mode
  const [darkMode, setDarkMode] = useState(false);

  // ── Backend logic ────────────────────────────────────────────
  const cariBarang = async (e) => {
    e?.preventDefault();
    if (!keyword) return;
    setLoading(true);
    setHasil([]);
    setSumberData('');
    try {
      const dataLokal = await db.pencarian.get(keyword.toLowerCase());
      if (dataLokal) {
        setHasil(dataLokal.data);
        setSumberData('📊 Data dari pencarian sebelumnya. Klik REFRESH untuk data terbaru.');
        setLoading(false);
        return;
      }
      setSumberData('🤖 Apex robot sedang mengambil data dari E-Commerce...');
      const response = await axios.get(`http://127.0.0.1:5000/api/cari?keyword=${keyword}`);
      const dataBaru = response.data.data;
      setHasil(dataBaru);
      setSumberData('✅ Data disimpan ke Memori Lokal.');
      if (dataBaru && dataBaru.length > 0) {
        await db.pencarian.put({
          keyword: keyword.toLowerCase(),
          data: dataBaru,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setSumberData('❌ Gagal mengambil data. Pastikan server Python menyala.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!keyword) return;
    await db.pencarian.delete(keyword.toLowerCase());
    setSumberData('');
    cariBarang({ preventDefault: () => {} });
  };

  // ── Clear semua local memory (IndexedDB) ─────────────────────
  const handleClearMemory = async () => {
    if (!window.confirm('Hapus semua data cache pencarian? Aksi ini tidak bisa dibatalkan.')) return;
    await db.pencarian.clear();
    setSumberData('🗑️ Semua cache pencarian telah dihapus.');
    setHasil([]);
    setKeyword('');
  };

  const toggleFav = (i) => {
    setFavorites(prev => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  const resetFilter = () => {
    setPlatformAktif('semua');
    setLokasiAktif('semua');
    setSortMode('default');
    setMinHarga(0);
    setMaxHarga(50000000);
  };

  // ── Compute harga range ───────────────────────────────────────
  const hargaRange = useMemo(() => {
    if (!hasil.length) return { min: 0, max: 50000000 };
    const values = hasil.map(i => parseHarga(i.harga)).filter(v => v > 0);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [hasil]);

  // ── Filter + Sort ─────────────────────────────────────────────
  const hasilFiltered = useMemo(() => {
    let arr = hasil.filter(item => {
      const platformMatch =
        platformAktif === 'semua' ||
        (item.platform || '').toLowerCase().includes(platformAktif.toLowerCase());
      const lokasiMatch =
        lokasiAktif === 'semua' ||
        (item.lokasi || '').toLowerCase().includes(lokasiAktif.toLowerCase());
      const harga = parseHarga(item.harga);
      const hargaMatch = harga >= minHarga && harga <= maxHarga;
      return platformMatch && lokasiMatch && hargaMatch;
    });
    if (sortMode === 'low')  arr = [...arr].sort((a, b) => parseHarga(a.harga) - parseHarga(b.harga));
    if (sortMode === 'high') arr = [...arr].sort((a, b) => parseHarga(b.harga) - parseHarga(a.harga));
    return arr;
  }, [hasil, platformAktif, lokasiAktif, minHarga, maxHarga, sortMode]);

  const filterAktif =
    platformAktif !== 'semua' || lokasiAktif !== 'semua' ||
    sortMode !== 'default' || minHarga > 0 || maxHarga < 50000000;

  const sliderMax = hargaRange.max || 50000000;
  const minPct = Math.round((minHarga / sliderMax) * 100);
  const maxPct = Math.round((maxHarga / sliderMax) * 100);
  const fmt = (n) => 'Rp ' + n.toLocaleString('id-ID');

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={`app-wrapper${darkMode ? ' dark' : ''}`}>

      {/* Overlay untuk mobile saat sidebar terbuka */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>

        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-left">
            <div className="brand-logo">
              <img src={logo} alt="Apexure Logo" />
            </div>
            <span className="brand-name">Apexure</span>
          </div>
          {/* Hamburger — fungsional buka/tutup sidebar */}
          <button
            className={`sidebar-toggle-btn${sidebarOpen ? ' active' : ''}`}
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle sidebar"
          >
            <div className="toggle-line" />
            <div className="toggle-line" />
            <div className="toggle-line" />
          </button>
        </div>

        <div className="sidebar-divider" />

        <nav className="sidebar-nav">

          {/* ── RANGE HARGA ── */}
          <div className={`nav-item${(minHarga > 0 || maxHarga < sliderMax) ? ' active' : ''}`}
               onClick={() => setHargaOpen(o => !o)}>
            <div className="nav-item-left">
              <div className="nav-icon-wrap">💰</div>
              <span className="nav-label">Rentang Harga</span>
            </div>
            <span className={`nav-chevron${hargaOpen ? ' open' : ''}`}>▾</span>
          </div>

          <div className={`sub-menu${hargaOpen ? ' open' : ''}`}>
            <div className="harga-filter">
              <div className="harga-slider-wrap" onClick={e => e.stopPropagation()}>
                <div className="harga-track">
                  <div className="harga-fill" style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }} />
                </div>
                <input
                  type="range" className="range-input range-min"
                  min={0} max={sliderMax} step={50000}
                  value={minHarga}
                  onChange={e => {
                    const v = Number(e.target.value);
                    if (v < maxHarga) setMinHarga(v);
                  }}
                />
                <input
                  type="range" className="range-input range-max"
                  min={0} max={sliderMax} step={50000}
                  value={maxHarga}
                  onChange={e => {
                    const v = Number(e.target.value);
                    if (v > minHarga) setMaxHarga(v);
                  }}
                />
              </div>
              <div className="harga-labels">
                <span className="harga-label">{fmt(minHarga)}</span>
                <span className="harga-label">{fmt(maxHarga)}</span>
              </div>
            </div>
          </div>

          {/* ── SORT ── */}
          <div className={`nav-item${sortMode !== 'default' ? ' active' : ''}`}
               onClick={() => setSortOpen(o => !o)}>
            <div className="nav-item-left">
              <div className="nav-icon-wrap">↕️</div>
              <span className="nav-label">Urutkan Harga</span>
            </div>
            <div className="nav-item-right">
              {sortMode !== 'default' && <div className="nav-badge">✓</div>}
              <span className={`nav-chevron${sortOpen ? ' open' : ''}`}>▾</span>
            </div>
          </div>

          <div className={`sub-menu${sortOpen ? ' open' : ''}`}>
            {[
              { id: 'default', label: 'Default',         icon: '—' },
              { id: 'low',     label: 'Harga Terendah',  icon: '↑' },
              { id: 'high',    label: 'Harga Tertinggi', icon: '↓' },
            ].map(opt => (
              <div key={opt.id}
                   className={`sub-item${sortMode === opt.id ? ' active' : ''}`}
                   onClick={() => setSortMode(opt.id)}>
                <div className="sub-item-left">
                  <span className="sort-icon">{opt.icon}</span>
                  <span className="sub-label">{opt.label}</span>
                </div>
                <div className={`sub-radio${sortMode === opt.id ? ' active' : ''}`} />
              </div>
            ))}
          </div>

          {/* ── PLATFORM ── */}
          <div className={`nav-item${platformAktif !== 'semua' ? ' active' : ''}`}
               onClick={() => setPlatformOpen(o => !o)}>
            <div className="nav-item-left">
              <div className="nav-icon-wrap">🏪</div>
              <span className="nav-label">Platform</span>
            </div>
            <div className="nav-item-right">
              <span className={`nav-chevron${platformOpen ? ' open' : ''}`}>▾</span>
            </div>
          </div>

          <div className={`sub-menu${platformOpen ? ' open' : ''}`}>
            {PLATFORM_ITEMS.map(item => (
              <div key={item.id}
                   className={`sub-item${platformAktif === item.id ? ' active' : ''}`}
                   onClick={() => setPlatformAktif(item.id)}>
                <div className="sub-item-left">
                  <div className="sub-dot" style={{ background: item.color }} />
                  <span className="sub-label">{item.label}</span>
                </div>
                <div className={`sub-radio${platformAktif === item.id ? ' active' : ''}`} />
              </div>
            ))}
          </div>

          {/* ── LOKASI ── */}
          <div className={`nav-item${lokasiAktif !== 'semua' ? ' active' : ''}`}
               onClick={() => setLokasiOpen(o => !o)}>
            <div className="nav-item-left">
              <div className="nav-icon-wrap">📍</div>
              <span className="nav-label">Lokasi Penjual</span>
            </div>
            <div className="nav-item-right">
              {lokasiAktif !== 'semua' && <div className="nav-badge">✓</div>}
              <span className={`nav-chevron${lokasiOpen ? ' open' : ''}`}>▾</span>
            </div>
          </div>

          <div className={`sub-menu${lokasiOpen ? ' open' : ''}`}>
            {LOKASI_ITEMS.map(item => (
              <div key={item.id}
                   className={`sub-item${lokasiAktif === item.id ? ' active' : ''}`}
                   onClick={() => setLokasiAktif(item.id)}>
                <div className="sub-item-left">
                  <span className="sub-label">{item.label}</span>
                </div>
                <div className={`sub-radio${lokasiAktif === item.id ? ' active' : ''}`} />
              </div>
            ))}
          </div>

        </nav>

        {/* Reset filter */}
        {filterAktif && (
          <button className="sidebar-reset-full" onClick={resetFilter}>
            Reset Semua Filter
          </button>
        )}

        {/* Bottom actions */}
        <div className="sidebar-bottom">
          {/* Clear Memory Button */}
          <button
            className="clear-memory-btn"
            onClick={handleClearMemory}
            title="Hapus semua cache pencarian lokal"
          >
            🗑️ <span className="clear-memory-label">Hapus Cache</span>
          </button>

          <div
            className={`bottom-action dark-toggle${darkMode ? ' on' : ''}`}
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
            onClick={() => setDarkMode(d => !d)}
          >
            {darkMode ? '☀️' : '🌙'}
          </div>
        </div>
      </aside>

      {/* ══════════════════ PAGE BODY ══════════════════ */}
      <div className="page-body">

        {/* Navbar + Search */}
        <form onSubmit={cariBarang} className="navbar">
          <div className="navbar-left">
            {/* Hamburger di navbar — hanya tampil di mobile */}
            <button
              type="button"
              className="navbar-hamburger"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Buka menu"
            >
              <div className="toggle-line" />
              <div className="toggle-line" />
              <div className="toggle-line" />
            </button>
            <div className="navbar-titles">
              <span className="navbar-page-title">Apexure</span>
              <span className="navbar-page-sub">Price Comparator</span>
            </div>
          </div>
          <div className="navbar-search-inline">
            <div className="search-input-wrap">
              <input
                type="text"
                placeholder="Cari barang (Misal: iPhone, Laptop Gaming, dsb)..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                disabled={loading}
              />
            </div>
            <button type="submit" className="search-btn" disabled={loading || !keyword}>
              {loading ? 'Mencari...' : 'Cari'}
            </button>
          </div>
        </form>

        {/* Status badge */}
        {sumberData && (
          <div className="status-row">
            <div className="status-badge">{sumberData}</div>
            {sumberData.includes('sebelumnya') && (
              <button className="refresh-btn" onClick={handleRefresh}>🔄 Refresh</button>
            )}
          </div>
        )}

        {/* Filter info bar */}
        {!loading && hasil.length > 0 && (
          <div className="filter-info-bar">
            <span className="filter-info-count">
              Menampilkan <strong>{hasilFiltered.length}</strong> dari <strong>{hasil.length}</strong> produk
            </span>
            <div className="filter-pills">
              {platformAktif !== 'semua' && (
                <span className="filter-pill">
                  {PLATFORM_ITEMS.find(p => p.id === platformAktif)?.label}
                  <button onClick={() => setPlatformAktif('semua')}>×</button>
                </span>
              )}
              {lokasiAktif !== 'semua' && (
                <span className="filter-pill">
                  📍 {LOKASI_ITEMS.find(l => l.id === lokasiAktif)?.label}
                  <button onClick={() => setLokasiAktif('semua')}>×</button>
                </span>
              )}
              {sortMode !== 'default' && (
                <span className="filter-pill">
                  {sortMode === 'low' ? '↑ Termurah' : '↓ Termahal'}
                  <button onClick={() => setSortMode('default')}>×</button>
                </span>
              )}
              {(minHarga > 0 || maxHarga < sliderMax) && (
                <span className="filter-pill">
                  {fmt(minHarga)} – {fmt(maxHarga)}
                  <button onClick={() => { setMinHarga(0); setMaxHarga(50000000); }}>×</button>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Initial state */}
        {!sumberData && !loading && hasil.length === 0 && (
          <div className="initial-state">
            <div className="initial-state-emoji">🏪</div>
            <h3>Apexure Compare siap membantu!</h3>
            <p>Ketikkan nama produk untuk membandingkan harga dari berbagai e-commerce.</p>
            <div className="suggestion-chips">
              {SUGGESTIONS.map(chip => (
                <button key={chip} className="chip" onClick={() => setKeyword(chip)}>{chip}</button>
              ))}
            </div>
          </div>
        )}

        {/* Not found */}
        {hasilFiltered.length === 0 && !loading && sumberData && !sumberData.includes('robot') && (
          <div className="empty-state">
            <div className="empty-state-icon">🕵️‍♂️</div>
            <h2>Ups, Produk Tidak Ditemukan</h2>
            <p>Tidak ada produk yang cocok dengan filter yang aktif.</p>
            <span className="hint">💡 Coba reset filter atau gunakan kata kunci yang lebih spesifik</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="loading-state">
            <h2>🔍 Sedang mencari harga terbaik...</h2>
            <p>Robot kami menyisir Tokopedia, Lazada & Blibli. Tunggu sebentar.</p>
            <div className="spinner" />
          </div>
        )}

        {/* Product grid */}
        {!loading && hasilFiltered.length > 0 && (
          <div className="product-grid">
            {hasilFiltered.map((item, index) => {
              const handleCardClick = () => {
                if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
              };
              // Fix gambar Lazada via proxy
              const gambarSrc = fixImageUrl(item.gambar, item.platform);
              return (
                <div
                  key={index}
                  className={`product-card${item.url ? ' clickable' : ''}`}
                  onClick={handleCardClick}
                  title={item.url ? `Buka di ${item.platform}` : ''}
                >
                  <div className="card-top">
                    {index === 0 && <span className="top-item-badge">🏆 Top item</span>}
                    <button
                      className={`fav-btn${favorites.has(index) ? ' heart-filled' : ''}`}
                      onClick={e => { e.stopPropagation(); toggleFav(index); }}
                    >
                      {favorites.has(index) ? '❤️' : '🤍'}
                    </button>
                    <img
                      src={gambarSrc}
                      alt={item.nama}
                      className="card-image"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      onError={e => {
                        // Fallback: coba URL asli dulu, lalu placeholder
                        if (e.target.src !== item.gambar && item.gambar) {
                          e.target.src = item.gambar;
                        } else {
                          e.target.src = 'https://via.placeholder.com/200x170?text=No+Image';
                        }
                      }}
                    />
                  </div>
                  <div className="card-body">
                    <h3 className="product-name">{item.nama}</h3>
                    <div className="product-price-row">
                      <div className="price-tag">
                        <span className="price-tag-icon">🛒</span>
                        <span className="product-price">{item.harga}</span>
                      </div>
                    </div>
                    <div className="product-meta">
                      <span className="product-location">📍 {item.lokasi}</span>
                      <span className="platform-badge">{item.platform}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;