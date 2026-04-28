import { useState } from 'react';
import axios from 'axios';
import { db } from './db';
import './App.css';

// ── Sidebar menu config ──────────────────────────────────────────
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

// ── App ──────────────────────────────────────────────────────────
function App() {
  const [keyword, setKeyword]     = useState('');
  const [hasil, setHasil]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [sumberData, setSumberData] = useState('');
  const [favorites, setFavorites] = useState(new Set());

  // Sidebar expand state
  const [platformOpen, setPlatformOpen] = useState(true);
  const [lokasiOpen, setLokasiOpen]     = useState(false);

  // Active filter selections
  const [platformAktif, setPlatformAktif] = useState('semua');
  const [lokasiAktif, setLokasiAktif]     = useState('semua');

  // ── Backend logic (unchanged) ────────────────────────────────
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
        setSumberData('📊Data yang ditampilkan adalah dari pencarian sebelumnya, jika ingin di tampilkan data terbaru silahkan klik REFRESH');
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
      setSumberData('❌ Gagal mengambil data.');
    } finally {
      setLoading(false);
    }
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
  };

  // ── Filter hasil secara real-time ────────────────────────────
  const hasilFiltered = hasil.filter(item => {
    const platformMatch =
      platformAktif === 'semua' ||
      (item.platform || '').toLowerCase().includes(platformAktif.toLowerCase());
    const lokasiMatch =
      lokasiAktif === 'semua' ||
      (item.lokasi || '').toLowerCase().includes(lokasiAktif.toLowerCase());
    return platformMatch && lokasiMatch;
  });

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="app-wrapper">

      {/* ══════════════════════════════
          SIDEBAR — VYKINS STYLE
      ══════════════════════════════ */}
      <aside className="sidebar">

        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-left">
            <div className="brand-logo">
              <img src='src/assets/APX-logo.png' alt="Apexure Logo" />
            </div>
            <span className="brand-name">Apexure Compare</span>
          </div>
          <div className="sidebar-toggle-btn" title="Toggle sidebar">
            <div className="toggle-line" />
            <div className="toggle-line" />
            <div className="toggle-line" />
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* Nav */}
        <nav className="sidebar-nav">

          {/* ── PLATFORM section ── */}
          <div
            className={`nav-item${platformAktif !== 'semua' ? ' active' : ''}`}
            onClick={() => setPlatformOpen(o => !o)}
          >
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
              <div
                key={item.id}
                className={`sub-item${platformAktif === item.id ? ' active' : ''}`}
                onClick={() => setPlatformAktif(item.id)}
              >
                <div className="sub-item-left">
                  <div className="sub-dot" style={{ background: item.color }} />
                  <span className="sub-label">{item.label}</span>
                </div>
                <div className={`sub-radio${platformAktif === item.id ? ' active' : ''}`} />
              </div>
            ))}
          </div>

          {/* ── LOKASI section ── */}
          <div
            className={`nav-item${lokasiAktif !== 'semua' ? ' active' : ''}`}
            onClick={() => setLokasiOpen(o => !o)}
          >
            <div className="nav-item-left">
              <div className="nav-icon-wrap">📍</div>
              <span className="nav-label">Lokasi Penjual</span>
            </div>
            <div className="nav-item-right">
              {lokasiAktif !== 'semua' && (
                <div className="nav-badge">✓</div>
              )}
              <span className={`nav-chevron${lokasiOpen ? ' open' : ''}`}>▾</span>
            </div>
          </div>

          <div className={`sub-menu${lokasiOpen ? ' open' : ''}`}>
            {LOKASI_ITEMS.map(item => (
              <div
                key={item.id}
                className={`sub-item${lokasiAktif === item.id ? ' active' : ''}`}
                onClick={() => setLokasiAktif(item.id)}
              >
                <div className="sub-item-left">
                  <span className="sub-label">{item.label}</span>
                </div>
                <div className={`sub-radio${lokasiAktif === item.id ? ' active' : ''}`} />
              </div>
            ))}
          </div>

          {/* ── Active filter summary ── */}
          {(platformAktif !== 'semua' || lokasiAktif !== 'semua') && (
            <>
              <div className="nav-section-label">Filter Aktif</div>
              {platformAktif !== 'semua' && (
                <div className="nav-item" style={{ opacity: 0.75 }}>
                  <div className="nav-item-left">
                    <div className="nav-icon-wrap" style={{ fontSize: '0.7rem' }}>
                      <div
                        className="sub-dot"
                        style={{
                          background: PLATFORM_ITEMS.find(p => p.id === platformAktif)?.color,
                          width: 10, height: 10
                        }}
                      />
                    </div>
                    <span className="nav-label" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                      {PLATFORM_ITEMS.find(p => p.id === platformAktif)?.label}
                    </span>
                  </div>
                </div>
              )}
              {lokasiAktif !== 'semua' && (
                <div className="nav-item" style={{ opacity: 0.75 }}>
                  <div className="nav-item-left">
                    <div className="nav-icon-wrap">📌</div>
                    <span className="nav-label" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                      {LOKASI_ITEMS.find(l => l.id === lokasiAktif)?.label}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </nav>

        {/* Reset filter */}
        {(platformAktif !== 'semua' || lokasiAktif !== 'semua') && (
          <button className="sidebar-reset-full" onClick={resetFilter}>
            Reset Semua Filter
          </button>
        )}

        {/* Bottom actions */}
        <div className="sidebar-bottom">
          <div className="bottom-action" title="Dark mode">🌙</div>
          <div className="bottom-action theme-dark" title="Settings">☀</div>
        </div>
      </aside>

      {/* ══════════════════════════════
          PAGE BODY
      ══════════════════════════════ */}
      <div className="page-body">

        {/* Navbar */}
        <form onSubmit={cariBarang} className="navbar">
          <div className="navbar-left">
            <span className="navbar-page-title">Apexure -</span>
            <span className="navbar-page-sub">Price Comparator</span>
          </div>

          <div className="navbar-search-inline">
            <div className="search-input-wrap">
              <input
                type="text"
                placeholder="Cari barang (Misal: iPhone, Laptop Gaming, dsb)..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                disabled={loading}
              />
            </div>
            <button type="submit" className="search-btn" disabled={loading || !keyword}>
              {loading ? 'Mencari...' : 'Cari Harga'}
            </button>
          </div>
        </form>

        {/* Status badge */}
        {sumberData && <div className="status-badge">{sumberData}</div>}

        {/* Filter result info */}
        {!loading && hasil.length > 0 && (platformAktif !== 'semua' || lokasiAktif !== 'semua') && (
          <div className="status-badge" style={{ marginBottom: 14 }}>
            🎯 Menampilkan <strong style={{ margin: '0 3px' }}>{hasilFiltered.length}</strong> dari{' '}
            <strong style={{ margin: '0 3px' }}>{hasil.length}</strong> produk
            {platformAktif !== 'semua' && <> · Platform: <strong style={{ marginLeft: 3 }}>{PLATFORM_ITEMS.find(p => p.id === platformAktif)?.label}</strong></>}
            {lokasiAktif !== 'semua' && <> · Lokasi: <strong style={{ marginLeft: 3 }}>{LOKASI_ITEMS.find(l => l.id === lokasiAktif)?.label}</strong></>}
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
                <button key={chip} className="chip" onClick={() => setKeyword(chip)}>
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Not found */}
        {hasilFiltered.length === 0 && !loading && sumberData && !sumberData.includes('robot') && (
          <div className="empty-state">
            <div className="empty-state-icon">🕵️‍♂️</div>
            <h2>Ups, Produk Tidak Ditemukan</h2>
            <p>Semua hasil terdeteksi sebagai aksesoris atau tidak relevan dengan pencarian.</p>
            <span className="hint">💡 Coba: "Apple iPhone 15 Pro" atau "Laptop ASUS ROG"</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="loading-state">
            <h2>🔍 Sedang mencari harga terbaik...</h2>
            <p>Robot kami menyisir Tokopedia, Lazada, Shopee & Bukalapak. Tunggu sebentar.</p>
            <div className="spinner" />
          </div>
        )}

        {/* Product grid */}
        {!loading && hasilFiltered.length > 0 && (
          <div className="product-grid">
            {hasilFiltered.map((item, index) => {
              const isFeatured = index === 4;
              const bukaProduK = () => {
                if (item.url) {
                  window.open(item.url, '_blank', 'noopener,noreferrer');
                }
              };
              return (
                <div key={index} className={`product-card${isFeatured ? ' featured' : ''}`}>
                  <div className="card-top">
                    {(index === 0 || index === hasil.length - 1) && (
                      <span className="top-item-badge">Top item</span>
                    )}
                    <button
                      className={`fav-btn${favorites.has(index) ? ' heart-filled' : ''}`}
                      onClick={() => toggleFav(index)}
                    >
                      {favorites.has(index) ? '❤️' : '🤍'}
                    </button>
                    <img
                      src={item.gambar}
                      alt={item.nama}
                      className="card-image"
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/200x170?text=No+Image'; }}
                    />
                    {isFeatured && (
                      <div className="featured-review">
                        <div className="review-avatars">
                          {['A','B','C'].map(l => (
                            <div key={l} className="review-avatar">{l}</div>
                          ))}
                        </div>
                        <span className="review-score">4.7/5 ⭐</span>
                      </div>
                    )}
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