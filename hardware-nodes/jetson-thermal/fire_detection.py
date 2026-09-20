import cv2
import numpy as np
import asyncio
import websockets
import json
import time

print("========================================")
print("RIVERAIR - JETSON NANO THERMAL VISION (B SINIFI)")
print("========================================")

# Termal Kamera RTSP Akışı (DJI veya Flir kamera)
CAMERA_SOURCE = "rtsp://192.168.1.10:554/thermal"
RIVERAIR_WS_URL = "wss://api.riverair.io/node/connect"
DRONE_ID = "BAYRAKLI-02-EMERGENCY"

# Termal kameralarda genelde çok beyaz olan pikseller sıcaktır
# (Buradaki eşik değerleri kameranın paletine göre değişir)
HOTSPOT_THRESHOLD = 240 

async def process_thermal_feed(websocket):
    print("Termal kamera bağlantısı başlatılıyor...")
    # Not: Gerçek cihaz yoksa VideoCapture(0) ile normal webcam denenebilir
    cap = cv2.VideoCapture(0) # Örnek amaçlı 0 kullanıldı
    
    if not cap.isOpened():
        print("HATA: Kamera açılamadı!")
        return

    print("Görüntü işleme başladı. Hotspot aranıyor...")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            await asyncio.sleep(0.1)
            continue
            
        # Görüntüyü gri tonlamaya çevir (Termal veriyi basitleştirmek için)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Çok sıcak olan (beyaz) bölgeleri filtrele
        _, thresh = cv2.threshold(gray, HOTSPOT_THRESHOLD, 255, cv2.THRESH_BINARY)
        
        # Sıcak alan piksellerini say
        hot_pixels = cv2.countNonZero(thresh)
        total_pixels = gray.shape[0] * gray.shape[1]
        
        # Eğer görüntünün %2'sinden fazlası çok sıcaksa yangın uyarısı ver
        if (hot_pixels / total_pixels) > 0.02:
            print(f"[{time.strftime('%H:%M:%S')}] 🔥 DİKKAT: YÜKSEK ISI (YANGIN) TESPİT EDİLDİ!")
            
            # Buluta anında ihbar yolla
            alert_payload = {
                "id": DRONE_ID,
                "type": "emergency_alert",
                "alert_type": "fire_detected",
                "severity": "HIGH",
                "timestamp": int(time.time() * 1000)
            }
            
            try:
                await websocket.send(json.dumps(alert_payload))
                print("İhbar RiverAir ağına iletildi.")
            except:
                print("Ağ hatası, ihbar iletilemedi.")
                
            # Sürekli spami önlemek için biraz bekle
            await asyncio.sleep(5) 
            
        # Görüntü işlemeyi asenkron döngüyü kilitlemeden yapmak için
        await asyncio.sleep(0.05)

async def main():
    try:
        async with websockets.connect(RIVERAIR_WS_URL) as ws:
            print("RiverAir Dispatcher'a bağlanıldı.")
            await process_thermal_feed(ws)
    except Exception as e:
        print(f"Bağlantı hatası: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nKamera kapatılıyor...")
