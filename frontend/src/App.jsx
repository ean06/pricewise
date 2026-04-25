import { useState } from 'react';
import axios from 'axios';
import { db } from './db';
import './App.css';

function App() {
  const [keyword, setKeyword] = useState('');
  const [hasil, setHasil] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sumberData, setSumberData] = useState(''); 

  const cariBarang = async (e) => {
    e.preventDefault();
    if (!keyword) return;

    setLoading(true);
    setHasil([]);
    setSumberData('');

    try {
      // 1. CEK DEXIE.JS (CACHE LOKAL)
      const dataLokal = await db.pencarian.get(keyword.toLowerCase());

      if (dataLokal) {
        setHasil(dataLokal.data);
        setSumberData('⚡ Dimuat secepat kilat dari Memori Lokal (Dexie.js)');
        setLoading(false);
        return; 
      }

      // 2. PANGGIL PYTHON API
      setSumberData('🤖 Robot sedang mengambil data langsung dari E-Commerce...');
      const response = await axios.get(`http://127.0.0.1:5000/api/cari?keyword=${keyword}`);
      
      const dataBaru = response.data.data;
      setHasil(dataBaru);
      setSumberData('✅ Data berhasil ditarik dan sekarang disimpan ke Memori Lokal.');

      // 3. SIMPAN KE DEXIE.JS
      if (dataBaru && dataBaru.length > 0) {
        await db.pencarian.put({
          keyword: keyword.toLowerCase(),
          data: dataBaru,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error("Error fetching data:", error);
      setSumberData('❌ Gagal mengambil data. Pastikan server Python menyala.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>PriceWise 🦅</h1>
        <p>Smart Price Aggregator untuk Keputusan Belanja yang Cerdas</p>
      </header>

      <form onSubmit={cariBarang} className="search-box">
        <input 
          type="text" 
          placeholder="Cari barang (Misal: handphone, Laptop, dsb)..." 
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !keyword}>
          {loading ? 'Mencari...' : 'Cari Harga'}
        </button>
      </form>

      {sumberData && <div className="status-badge" style={{textAlign: 'center', margin: '15px 0', fontWeight: 'bold'}}>{sumberData}</div>}

      {/* --- PESAN PRODUK TIDAK DITEMUKAN --- */}
      {hasil.length === 0 && !loading && sumberData && !sumberData.includes('Robot') && (
        <div className="empty-state" style={{ textAlign: 'center', padding: '40px', backgroundColor: '#fdfbfb', borderRadius: '12px', marginTop: '20px', border: '1px solid #ffeaa7' }}>
          <h2 style={{ color: '#e74c3c' }}>Ups, Produk Tidak Ditemukan 🕵️‍♂️</h2>
          <p style={{ color: '#7f8c8d', fontSize: '1.1rem' }}>
            Robot PriceWise menolak menampilkan data karena semua hasil di halaman ini terdeteksi sebagai aksesoris atau tidak relevan.
          </p>
          <p style={{ fontWeight: 'bold' }}>Saran: Gunakan kata kunci yang lebih spesifik, misal: "Apple iPhone 15 Pro".</p>
        </div>
      )}

      {/* --- LAYAR LOADING ANIMASI --- */}
      {loading && (
        <div className="loading-state" style={{ textAlign: 'center', padding: '50px', backgroundColor: '#fff', borderRadius: '12px', marginTop: '20px' }}>
            <h2 style={{ color: '#3498db' }}>🦅 PriceWise sedang mencari harga terbaik...</h2>
            <p style={{ color: '#7f8c8d' }}>Robot kami sedang menyisir Tokopedia dan Lazada secara rahasia. Mohon tunggu sebentar.</p>
            <div style={{ margin: '20px auto', width: '50px', height: '50px', border: '5px solid #f3f3f3', borderTop: '5px solid #3498db', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <style>
              {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
            </style>
        </div>
      )}

      {/* --- GRID KARTU PRODUK --- */}
      {!loading && hasil.length > 0 && (
        <div className="product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' }}>
          {hasil.map((item, index) => (
            <div className="product-card" key={index} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <div className="image-container" style={{ textAlign: 'center', marginBottom: '15px' }}>
                 <img src={item.gambar} alt={item.nama} style={{ maxWidth: '100%', height: '200px', objectFit: 'contain' }} />
              </div>
              <div className="product-info">
                <h3 style={{ fontSize: '1rem', margin: '0 0 10px 0', height: '45px', overflow: 'hidden' }}>{item.nama}</h3>
                <p className="price" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#e74c3c', margin: '0 0 10px 0' }}>{item.harga}</p>
                <div className="product-meta" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#7f8c8d' }}>
                  <span>📍 {item.lokasi}</span>
                  <span style={{ fontWeight: 'bold', color: '#f39c12' }}>{item.platform}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;