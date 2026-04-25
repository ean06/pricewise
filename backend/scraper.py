from playwright.sync_api import sync_playwright

def is_produk_relevan(nama_produk, keyword):
    nama_lower = nama_produk.lower()
    keyword_lower = keyword.lower()

    # 1. Blacklist Umum & Otomotif (Tambah visor, kaca, busa, spoiler)
    blacklist_umum = ['kardus', 'box kosong', 'sewa', 'jasa', 'dummy', 'cicilan', 'service', 'perbaikan', 'visor', 'kaca', 'spoiler', 'busa', 'stiker', 'pinlock']
    if any(b in nama_lower for b in blacklist_umum):
        return False

    # 2. Blacklist Aksesoris Gadget
    kata_gadget = ['hp', 'handphone', 'iphone', 'samsung', 'laptop', 'macbook', 'ipad', 'tablet']
    if any(k in keyword_lower for k in kata_gadget):
        blacklist_elektronik = ['kabel', 'case', 'casing', 'tempered', 'charger', 'adaptor', 'strap', 'anti gores', 'pelindung', 'power bank', 'baterai', 'lens', 'kaca', 'lcd', 'kamera']
        if any(b in nama_lower for b in blacklist_elektronik):
            return False

    # --- 3. LOGIKA BARU: FILTER MEREK WAJIB (DITAMBAH OTOMOTIF) ---
    daftar_merek = [
        # Gadget
        'iphone', 'samsung', 'macbook', 'ipad', 'lenovo', 'asus', 'xiaomi', 'oppo', 'vivo', 'infinix',
        # Otomotif / Helm
        'hjc', 'kyt', 'shoei', 'arai', 'agv', 'nolan', 'zeus', 'ink', 'rsv', 'kbc', 'nhk'
    ]
    
    for merek in daftar_merek:
        if merek in keyword_lower: # Jika user mencari merek tertentu (misal: hjc)
            # Kasus khusus Apple/iPhone
            if merek == 'iphone' or merek == 'apple':
                if 'iphone' not in nama_lower and 'apple' not in nama_lower:
                    return False 
            # Jika merek HJC dicari, judul produk WAJIB ada kata HJC!
            elif merek not in nama_lower:
                return False # Kymco dan Evolution akan langsung ditendang di sini!
    # --------------------------------------------------------------

   # --- 4. LOGIKA BARU: FILTER KETAT TIPE/MODEL SPESIFIK ---
    # Kita pisahkan mana kata umum dan mana kata model spesifik ("kx1", "race", "pro", dsb)
    kata_umum = ['helm', 'hp', 'laptop', 'macbook', 'iphone', 'samsung', 'asus', 'kyt', 'hjc', 'arai', 'agv', 'shoei']
    kata_spesifik = [k for k in keyword_lower.split() if k not in kata_umum and len(k) >= 2]

    if kata_spesifik:
        # Hapus spasi di judul produk untuk mengatasi penjual yang menulis "KX 1" menjadi "kx1"
        judul_tanpa_spasi = nama_lower.replace(" ", "")
        
        # Hitung berapa banyak kata spesifik yang nyangkut di judul produk
        jumlah_cocok = sum(1 for kata in kata_spesifik if kata in nama_lower or kata.replace(" ", "") in judul_tanpa_spasi)
        
        # Jika tidak ada SATUPUN kata spesifik yang cocok, berarti ini produk nyasar! Buang!
        if jumlah_cocok == 0:
            return False

    return True

def jalankan_robot_tokopedia(keyword):
    print(f"\n[TOKOPEDIA] Memulai pencarian untuk: {keyword}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={'width': 1920, 'height': 1080} # Pura-pura pakai monitor besar
        )
        page = context.new_page()

        keyword_url = keyword.replace(" ", "%20")
        url = f"https://www.tokopedia.com/search?q={keyword_url}"
        
        page.goto(url)
        hasil_pencarian = []
        
        try:
            page.wait_for_selector('text=/^Rp\s*[0-9\.]+$/', timeout=10000)
            # --- AJARI ROBOT SCROLL KE BAWAH ---
            print("[TOKOPEDIA] Sedang men-scroll halaman untuk memuat lebih banyak barang...")
            for i in range(10): # Lakukan 20 kali scroll
                page.mouse.wheel(0, 1500) # Scroll ke bawah 1500 pixel
                page.wait_for_timeout(1000) # Beri jeda 1 detik per scroll agar gambar sempat ter-load
            
            # Kumpulkan semua kotak setelah selesai di-scroll (Biasanya ada 60 - 80 kotak)
            kotak_produk = page.locator('div.css-5wh65g').all()
            print(f"[TOKOPEDIA] Ditemukan {len(kotak_produk)} kotak produk mentah di halaman.")
            
            # --- LOGIKA BARU: JANGAN BATASI DI AWAL ---
            # Kita looping SEMUA kotak, tapi kita hentikan kalau sudah dapat 20 barang bersih
            for kotak in kotak_produk: 
                
                # Jika keranjang hasil pencarian sudah berisi 20 barang bersih, stop!
                if len(hasil_pencarian) >= 50:
                    break

                semua_teks = kotak.inner_text().split('\n')
                
                # --- STRATEGI BARU MENCARI NAMA ---
                nama = ""
                # Prioritas 1: Coba ambil pakai nama class CSS resmi dari Tokopedia
                nama_locator = kotak.locator('[class*="prd_link-product-name"]')
                if nama_locator.count() > 0:
                    nama = nama_locator.first.inner_text()
                
                # Prioritas 2: Jika CSS berubah, cari teks manual tapi hindari promo!
                if not nama:
                    for t in semua_teks:
                        t_lower = t.lower()
                        # Jika teks > 15 huruf DAN tidak mengandung kata-kata promo e-commerce
                        if len(t) > 15 and not any(promo in t_lower for promo in ["ongkir", "cashback", "diskon", "terjual", "sisa", "rb", "promo"]):
                            nama = t
                            break

                if not nama or nama == "":
                    continue # Abaikan kotak yang tidak punya nama

                # Panggil filter cerdas
                if not is_produk_relevan(nama, keyword):
                    continue

                lokasi = "Lokasi tidak ditemukan"
                for t in semua_teks:
                    if any(kota in t for kota in ["Jakarta", "Surabaya", "Bandung", "Medan", "Tangerang", "Bekasi", "Semarang", "Depok"]):
                        lokasi = t
                        break
                
                # --- STRATEGI BARU MENCARI HARGA ---
                harga_teks = "0"
                for t in semua_teks:
                    # Cari baris yang diawali "Rp" dan mengandung angka (lebih dari 3 huruf)
                    if t.strip().startswith("Rp") and len(t) > 3:
                        harga_teks = t
                        break

                import re
                angka_bersih = re.sub(r'[^0-9]', '', harga_teks)
                harga_angka = int(angka_bersih) if angka_bersih else 0

                # FILTER HARGA PREMIUM
                kata_premium = ['iphone', 'macbook', 'samsung s', 'samsung z', 'laptop', 'ipad', 'playstation']
                if any(k in keyword.lower() for k in kata_premium):
                    if harga_angka < 1000000:
                        continue # BUANG BARANG MURAH (Aksesoris)
                    
                gambar_locator = kotak.locator('img')
                gambar = gambar_locator.first.get_attribute('src')
                if not gambar:
                    gambar = gambar_locator.first.get_attribute('data-src')

                # Kalau lolos semua filter, baru masukkan ke keranjang
                hasil_pencarian.append({
                    "platform": "Tokopedia",
                    "nama": nama,
                    "harga": harga_teks,
                    "gambar": gambar,
                    "lokasi": lokasi,
                    "rating": "4.5", 
                    "kondisi": "Baru"
                })
        except Exception as e:
            print(f"Gagal mengambil data. Detail error: {e}")
        
        return hasil_pencarian
    
def jalankan_robot_lazada(keyword):
    print(f"\n[LAZADA] Memulai pencarian untuk: {keyword}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        page = context.new_page()

        keyword_url = keyword.replace(" ", "%20")
        url = f"https://www.lazada.co.id/catalog/?q={keyword_url}"
        
        hasil_pencarian = []
        
        try:
            page.goto(url)
            print("[LAZADA] Menunggu halaman dimuat...")
            page.wait_for_selector('text=/^Rp/', timeout=15000) 
            
            print("[LAZADA] Sedang men-scroll halaman...")
            for i in range(5): 
                page.mouse.wheel(0, 1000)
                page.wait_for_timeout(1000)
            
            # Lazada sering menggunakan atribut 'data-tracking="product-card"' atau 'data-qa-locator="product-item"'
            kotak_produk = page.locator('div[data-tracking="product-card"]').all()
            print(f"[LAZADA] Ditemukan {len(kotak_produk)} kotak produk mentah di halaman.")

            if not kotak_produk:
                kotak_produk = page.locator('div[data-qa-locator="product-item"]').all()
                
            for kotak in kotak_produk: 
                if len(hasil_pencarian) >= 15: 
                    break

                semua_teks = kotak.inner_text().split('\n')
                
                nama = ""
                for t in semua_teks:
                    if len(t) > 15 and not any(promo in t.lower() for promo in ["lazmall", "lazada", "diskon", "terjual", "rb", "promo"]):
                        nama = t
                        break

                if not nama or not is_produk_relevan(nama, keyword):
                    continue 

                harga_teks = "0"
                for t in semua_teks:
                    if "Rp" in t and len(t) > 3:
                        harga_teks = t
                        break

                import re
                angka_bersih = re.sub(r'[^0-9]', '', harga_teks)
                harga_angka = int(angka_bersih) if angka_bersih else 0

                kata_premium = ['iphone', 'macbook', 'samsung s', 'samsung z', 'laptop', 'ipad']
                if any(k in keyword.lower() for k in kata_premium) and harga_angka < 1000000:
                    continue 

                lokasi = "Lokasi tidak ditemukan"
                for t in semua_teks:
                    if any(kota in t for kota in ["Jakarta", "Surabaya", "Bandung", "Medan", "Tangerang", "Bekasi", "Semarang", "Depok", "Kota", "Kab."]):
                        lokasi = t
                        break

                gambar_locator = kotak.locator('img')
                gambar = gambar_locator.first.get_attribute('src')

                hasil_pencarian.append({
                    "platform": "Lazada 💙", 
                    "nama": nama,
                    "harga": harga_teks, 
                    "gambar": gambar,
                    "lokasi": lokasi,
                    "rating": "4.7", 
                    "kondisi": "Baru"
                })

        except Exception as e:
            print(f"[LAZADA] Gagal mengambil data. Detail error: {e}")
        
        return hasil_pencarian

def jalankan_robot_blibli(keyword):
    print(f"\n[BLIBLI] Memulai pencarian untuk: {keyword}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        page = context.new_page()

        keyword_url = keyword.replace(" ", "%20")
        url = f"https://www.blibli.com/cari/{keyword_url}"
        
        hasil_pencarian = []
        
        try:
            page.goto(url)
            print("[BLIBLI] Menunggu halaman dimuat...")
            page.wait_for_selector('text=/^Rp/', timeout=15000) 
            
            print("[BLIBLI] Sedang men-scroll halaman...")
            for i in range(5): 
                page.mouse.wheel(0, 1000)
                page.wait_for_timeout(1000)
            
            # Blibli biasanya memakai class .blu-product__card atau .product__card
            kotak_produk = page.locator('div[class*="product__card"]').all()
            
            for kotak in kotak_produk: 
                if len(hasil_pencarian) >= 15: 
                    break

                semua_teks = kotak.inner_text().split('\n')
                
                nama = ""
                for t in semua_teks:
                    if len(t) > 15 and not any(promo in t.lower() for promo in ["blibli", "official", "diskon", "terjual", "cashback", "promo"]):
                        nama = t
                        break

                if not nama or not is_produk_relevan(nama, keyword):
                    continue 

                harga_teks = "0"
                for t in semua_teks:
                    if "Rp" in t and len(t) > 3:
                        harga_teks = t
                        break

                import re
                angka_bersih = re.sub(r'[^0-9]', '', harga_teks)
                harga_angka = int(angka_bersih) if angka_bersih else 0

                kata_premium = ['iphone', 'macbook', 'samsung s', 'samsung z', 'laptop', 'ipad']
                if any(k in keyword.lower() for k in kata_premium) and harga_angka < 1000000:
                    continue 

                lokasi = "Lokasi tidak ditemukan"
                for t in semua_teks:
                    if any(kota in t for kota in ["Jakarta", "Surabaya", "Bandung", "Medan", "Tangerang", "Bekasi", "Semarang", "Depok"]):
                        lokasi = t
                        break

                gambar_locator = kotak.locator('img')
                gambar = gambar_locator.first.get_attribute('src')

                hasil_pencarian.append({
                    "platform": "Blibli 🛍️", 
                    "nama": nama,
                    "harga": harga_teks, 
                    "gambar": gambar,
                    "lokasi": lokasi,
                    "rating": "4.9", 
                    "kondisi": "Baru"
                })

        except Exception as e:
            print(f"[BLIBLI] Gagal mengambil data. Detail error: {e}")
        
        return hasil_pencarian