from playwright.sync_api import sync_playwright
import re
import random

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

    # 3. LOGIKA BARU: FILTER MEREK WAJIB
    daftar_merek = [
        # Gadget
        'iphone', 'samsung', 'macbook', 'ipad', 'lenovo', 'asus', 'xiaomi', 'oppo', 'vivo', 'infinix',
        # Otomotif / Helm
        'hjc', 'kyt', 'shoei', 'arai', 'agv', 'nolan', 'zeus', 'ink', 'rsv', 'kbc', 'nhk'
    ]
    
    for merek in daftar_merek:
        if merek in keyword_lower:
            if merek == 'iphone' or merek == 'apple':
                if 'iphone' not in nama_lower and 'apple' not in nama_lower:
                    return False 
            elif merek not in nama_lower:
                return False

    kata_umum = ['helm', 'hp', 'laptop', 'macbook', 'iphone', 'samsung', 'asus', 'kyt', 'hjc', 'arai', 'agv', 'shoei']
    kata_spesifik = [k for k in keyword_lower.split() if k not in kata_umum and len(k) >= 2]

    if kata_spesifik:
        judul_tanpa_spasi = nama_lower.replace(" ", "")
        jumlah_cocok = sum(1 for kata in kata_spesifik if kata in nama_lower or kata.replace(" ", "") in judul_tanpa_spasi)
        if jumlah_cocok == 0:
            return False

    return True

def jalankan_robot_tokopedia(keyword):
    print(f"\n[TOKOPEDIA] Memulai pencarian untuk: {keyword}")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,  
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={'width': 1920, 'height': 1080}
        )
        page = context.new_page()

        keyword_url = keyword.replace(" ", "%20")
        url = f"https://www.tokopedia.com/search?q={keyword_url}"
        
        page.goto(url)
        hasil_pencarian = []
        
        try:
            page.wait_for_selector('text=/^Rp\s*[0-9\.]+$/', timeout=10000)
            print("[TOKOPEDIA] Sedang men-scroll halaman untuk memuat lebih banyak barang...")
            for i in range(10):
                page.mouse.wheel(0, 1500)
                page.wait_for_timeout(1000)
            
            kotak_produk = page.locator('div.css-5wh65g').all()
            print(f"[TOKOPEDIA] Ditemukan {len(kotak_produk)} kotak produk mentah di halaman.")
            
            for kotak in kotak_produk: 
                if len(hasil_pencarian) >= 50:
                    break

                semua_teks = kotak.inner_text().split('\n')
                
                nama = ""
                nama_locator = kotak.locator('[class*="prd_link-product-name"]')
                if nama_locator.count() > 0:
                    nama = nama_locator.first.inner_text()
                
                if not nama:
                    for t in semua_teks:
                        t_lower = t.lower()
                        if len(t) > 15 and not any(promo in t_lower for promo in ["ongkir", "cashback", "diskon", "terjual", "sisa", "rb", "promo"]):
                            nama = t
                            break

                if not nama or nama == "":
                    continue

                if not is_produk_relevan(nama, keyword):
                    continue

                lokasi = "Lokasi tidak ditemukan"
                for t in semua_teks:
                    if any(kota in t for kota in ["Jakarta", "Surabaya", "Bandung", "Medan", "Tangerang", "Bekasi", "Semarang", "Depok"]):
                        lokasi = t
                        break
                
                harga_teks = "0"
                for t in semua_teks:
                    if t.strip().startswith("Rp") and len(t) > 3:
                        harga_teks = t
                        break

                angka_bersih = re.sub(r'[^0-9]', '', harga_teks)
                harga_angka = int(angka_bersih) if angka_bersih else 0

                kata_premium = ['iphone', 'macbook', 'samsung s', 'samsung z', 'laptop', 'ipad', 'playstation']
                if any(k in keyword.lower() for k in kata_premium):
                    if harga_angka < 1000000:
                        continue
                    
                gambar_locator = kotak.locator('img')
                gambar = gambar_locator.first.get_attribute('src')
                if not gambar:
                    gambar = gambar_locator.first.get_attribute('data-src')

                url_produk = ""
                link_locator = kotak.locator('[class*="prd_link-product-name"]')
                if link_locator.count() > 0:
                    url_produk = link_locator.first.get_attribute('href') or ""
                if not url_produk:
                    all_links = kotak.locator('a')
                    if all_links.count() > 0:
                        url_produk = all_links.first.get_attribute('href') or ""

                hasil_pencarian.append({
                    "platform": "Tokopedia",
                    "nama": nama,
                    "harga": harga_teks,
                    "gambar": gambar,
                    "lokasi": lokasi,
                    "rating": "4.5",
                    "kondisi": "Baru",
                    "url": url_produk
                })
        except Exception as e:
            print(f"Gagal mengambil data. Detail error: {e}")
        finally:
            browser.close()
        
        return hasil_pencarian
    
def jalankan_robot_lazada(keyword):
    print(f"\n[LAZADA] Memulai pencarian untuk: {keyword}")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={'width': 1920, 'height': 1080}
        )
        page = context.new_page()

        keyword_url = keyword.replace(" ", "%20")
        url = f"https://www.lazada.co.id/catalog/?q={keyword_url}"
        
        hasil_pencarian = []
        
        try:
            page.goto(url)
            print("[LAZADA] Menunggu halaman dimuat...")
            page.wait_for_selector('text=/^Rp/', timeout=15000) 
            
            print("[LAZADA] Sedang men-scroll halaman...")
            for i in range(10):
                page.mouse.wheel(0, 800)
                page.wait_for_timeout(800)  
            
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(1000)
            
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

                gambar = None
                gambar_locator = kotak.locator('img').first
                
                for attr in ['src', 'data-src', 'data-lazy-src', 'data-original']:
                    try:
                        val = gambar_locator.get_attribute(attr)
                        if val and val.startswith('http') and 'placeholder' not in val and len(val) > 20:
                            gambar = val
                            break
                    except:
                        continue
                
                if not gambar:
                    semua_img = kotak.locator('img').all()
                    for img in semua_img:
                        for attr in ['src', 'data-src', 'data-lazy-src', 'data-original']:
                            try:
                                val = img.get_attribute(attr)
                                if val and val.startswith('http') and len(val) > 20:
                                    gambar = val
                                    break
                            except:
                                continue
                        if gambar:
                            break

                url_produk = ""
                all_links = kotak.locator('a')
                if all_links.count() > 0:
                    url_produk = all_links.first.get_attribute('href') or ""
                if url_produk and url_produk.startswith('/'):
                    url_produk = 'https://www.lazada.co.id' + url_produk

                hasil_pencarian.append({
                    "platform": "Lazada 💙",
                    "nama": nama,
                    "harga": harga_teks,
                    "gambar": gambar, 
                    "lokasi": lokasi,
                    "rating": "4.7",
                    "kondisi": "Baru",
                    "url": url_produk
                })

        except Exception as e:
            print(f"[LAZADA] Gagal mengambil data. Detail error: {e}")
        finally:
            browser.close()
        
        return hasil_pencarian
        
def jalankan_robot_blibli(keyword):
    print(f"\n[BLIBLI] Memulai pencarian untuk: {keyword}")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
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

                url_produk = ""
                all_links = kotak.locator('a')
                if all_links.count() > 0:
                    url_produk = all_links.first.get_attribute('href') or ""
                if url_produk and url_produk.startswith('/'):
                    url_produk = 'https://www.blibli.com' + url_produk

                hasil_pencarian.append({
                    "platform": "Blibli 🛍️",
                    "nama": nama,
                    "harga": harga_teks,
                    "gambar": gambar,
                    "lokasi": lokasi,
                    "rating": "4.9",
                    "kondisi": "Baru",
                    "url": url_produk
                })

        except Exception as e:
            print(f"[BLIBLI] Gagal mengambil data. Detail error: {e}")
        finally:
            browser.close()
        
        return hasil_pencarian