from flask import Flask, request, jsonify
from flask_cors import CORS
import concurrent.futures

# Import KETIGA robot dari scraper.py
from scraper import jalankan_robot_tokopedia, jalankan_robot_lazada, jalankan_robot_blibli

app = Flask(__name__)
CORS(app) 

@app.route('/api/cari', methods=['GET'])
def cari_barang():
    kata_kunci = request.args.get('keyword')
    
    if not kata_kunci:
        return jsonify({"error": "Kata kunci pencarian tidak boleh kosong!"}), 400
    
    print(f"\n[API] Menerima request pencarian PARALEL: {kata_kunci}")
    data_gabungan = []
    
    # Buka 3 jalur Thread sekaligus agar sangat cepat!
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        
        # Tugaskan ketiga robot berlari bersamaan
        future_tokped = executor.submit(jalankan_robot_tokopedia, kata_kunci)
        future_lazada = executor.submit(jalankan_robot_lazada, kata_kunci)
        future_blibli = executor.submit(jalankan_robot_blibli, kata_kunci)
        
        # 1. Kumpulkan hasil Tokopedia (Tunggu maksimal 45 detik)
        try:
            hasil_tokped = future_tokped.result(timeout=45)
            if hasil_tokped:
                data_gabungan.extend(hasil_tokped)
        except Exception as e:
            print(f"[API] Robot Tokopedia Timeout/Gagal: {e}")

        # 2. Kumpulkan hasil Lazada
        try:
            hasil_lazada = future_lazada.result(timeout=45)
            if hasil_lazada:
                data_gabungan.extend(hasil_lazada)
        except Exception as e:
            print(f"[API] Robot Lazada Timeout/Gagal: {e}")

        # 3. Kumpulkan hasil Blibli
        try:
            hasil_blibli = future_blibli.result(timeout=45)
            if hasil_blibli:
                data_gabungan.extend(hasil_blibli)
        except Exception as e:
            print(f"[API] Robot Blibli Timeout/Gagal: {e}")
            
    # Mengacak data sedikit agar tampilannya di React terlihat bercampur (Tokped, Lazada, Blibli)
    import random
    random.shuffle(data_gabungan)

    print(f"[API] Selesai! Berhasil mengumpulkan {len(data_gabungan)} data dari berbagai platform.")

    return jsonify({
        "status": "sukses",
        "keyword": kata_kunci,
        "total_data": len(data_gabungan),
        "data": data_gabungan
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)