import asyncio
import websockets
import json
import time
from dronekit import connect, VehicleMode, LocationGlobalRelative
# from nacl.signing import SigningKey   # Ed25519; Stellar hesaplarıyla aynı şema

print("========================================")
print("RIVERAIR - PIXHAWK MAVLINK BRIDGE v1.0")
print("========================================")

# 1. Uçuş Kontrolcüsüne Bağlan (Serial Port üzerinden)
# Raspberry Pi'de genellikle ttyAMA0 veya ttyS0 kullanılır
CONNECTION_STRING = '/dev/ttyAMA0'
print(f"[{time.strftime('%H:%M:%S')}] Uçuş kontrolcüsüne bağlanılıyor ({CONNECTION_STRING})...")

try:
    vehicle = connect(CONNECTION_STRING, wait_ready=True, baud=921600)
    print(f"[{time.strftime('%H:%M:%S')}] Pixhawk bağlantısı başarılı! Sistem: {vehicle.version}")
except Exception as e:
    print(f"HATA: Pixhawk bağlantısı başarısız oldu. {e}")
    exit(1)

RIVERAIR_WS_URL = "wss://api.riverair.io/node/connect"
DRONE_ID = "EGE-01-CARGO-NODE"

# Donanımsal imza için Ed25519 anahtar yükleniyor (örnek)
# with open('node_keypair.json', 'r') as f:
#     keypair_data = json.load(f)
#     signer = SigningKey(bytes(keypair_data))

async def telemetry_loop(websocket):
    """Her 1.5 saniyede bir MAVLink verilerini okur ve panele yollar."""
    while True:
        try:
            # 1. Sensörlerden gerçek zamanlı veri okuma
            telemetry_data = {
                "id": DRONE_ID,
                "type": "telemetry",
                "battery": vehicle.battery.level,
                "voltage": vehicle.battery.voltage,
                "lat": vehicle.location.global_frame.lat,
                "lng": vehicle.location.global_frame.lon,
                "altitude": vehicle.location.global_relative_frame.alt,
                "speed": vehicle.groundspeed * 3.6, # m/s to km/h
                "heading": vehicle.heading,
                "mode": vehicle.mode.name,
                "armed": vehicle.armed,
                "timestamp": int(time.time() * 1000)
            }
            
            # 2. Veriyi Ed25519 imzasıyla güvence altına alma (örnek)
            # message_bytes = json.dumps(telemetry_data).encode('utf-8')
            # signature = signer.sign(message_bytes).signature.hex()
            # payload = {"data": telemetry_data, "signature": signature}
            
            # 3. Buluta gönder
            await websocket.send(json.dumps(telemetry_data))
            
        except Exception as e:
            print(f"Telemetri okuma hatası: {e}")
            
        await asyncio.sleep(1.5)

async def command_listener(websocket):
    """Buluttan (AI Dispatcher) gelen otonom görev komutlarını MAVLink'e çevirir."""
    async for message in websocket:
        try:
            data = json.loads(message)
            cmd = data.get("command")
            
            if cmd == "TAKEOFF":
                target_alt = data.get('altitude', 20)
                print(f">>> KOMUT: Kalkış yapılıyor. Hedef irtifa: {target_alt}m")
                vehicle.mode = VehicleMode("GUIDED")
                vehicle.armed = True
                
                # Motorların çalışmasını bekle
                while not vehicle.armed:
                    await asyncio.sleep(1)
                    
                vehicle.simple_takeoff(target_alt)
                
            elif cmd == "GOTO":
                lat = data.get('lat')
                lng = data.get('lng')
                alt = data.get('altitude', vehicle.location.global_relative_frame.alt)
                
                print(f">>> KOMUT: Waypoint rotası alındı -> {lat}, {lng}")
                target_location = LocationGlobalRelative(lat, lng, alt)
                vehicle.simple_goto(target_location)
                
            elif cmd == "RTL":
                print(">>> KOMUT: RTL (Geri Dön) tetiklendi!")
                vehicle.mode = VehicleMode("RTL")
                
        except json.JSONDecodeError:
            pass

async def main():
    print(f"[{time.strftime('%H:%M:%S')}] RiverAir WebSocket sunucusuna bağlanılıyor...")
    try:
        async with websockets.connect(RIVERAIR_WS_URL) as ws:
            print(f"[{time.strftime('%H:%M:%S')}] Ağa bağlantı sağlandı! Yayın başlıyor...")
            
            # Telemetri ve komut dinleme işlemlerini paralel çalıştır
            await asyncio.gather(
                telemetry_loop(ws),
                command_listener(ws)
            )
    except Exception as e:
        print(f"Sunucu bağlantı hatası: {e}. Lütfen interneti ve URL'yi kontrol edin.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nSistem kapatılıyor...")
        vehicle.close()
