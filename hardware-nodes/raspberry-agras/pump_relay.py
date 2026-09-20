import RPi.GPIO as GPIO
import time
import asyncio
import websockets
import json

print("========================================")
print("RIVERAIR - AGRAS T40 PUMP RELAY (C SINIFI)")
print("========================================")

# Raspberry Pi GPIO pin numarası (BCM dizilimi)
RELAY_PIN = 18

# GPIO Ayarları
GPIO.setmode(GPIO.BCM)
GPIO.setup(RELAY_PIN, GPIO.OUT)
GPIO.output(RELAY_PIN, GPIO.LOW) # Varsayılan: Pompa Kapalı

RIVERAIR_WS_URL = "wss://api.riverair.io/node/connect"
DRONE_ID = "CESME-03-AGRI-NODE"

is_pumping = False

def start_pump():
    global is_pumping
    print(f"[{time.strftime('%H:%M:%S')}] RÖLE TETİKLENDİ: Su/İlaç pompası AKTİF")
    GPIO.output(RELAY_PIN, GPIO.HIGH)
    is_pumping = True

def stop_pump():
    global is_pumping
    print(f"[{time.strftime('%H:%M:%S')}] RÖLE KESİLDİ: Pompa KAPALI")
    GPIO.output(RELAY_PIN, GPIO.LOW)
    is_pumping = False

async def payload_listener():
    """RiverAir üzerinden ziraat payload komutlarını dinler."""
    try:
        async with websockets.connect(RIVERAIR_WS_URL) as ws:
            print("Ziraat Kontrolcüsü buluta bağlandı. Komutlar dinleniyor...")
            
            # Bağlantıyı tanıt
            await ws.send(json.dumps({"id": DRONE_ID, "type": "register_payload"}))

            async for message in ws:
                data = json.loads(message)
                cmd = data.get("command")
                
                if cmd == "PUMP_START":
                    start_pump()
                    # Ağa pompanın çalıştığını onayla
                    await ws.send(json.dumps({
                        "id": DRONE_ID, 
                        "type": "payload_status", 
                        "status": "pumping",
                        "pressure_psi": 45.2
                    }))
                    
                elif cmd == "PUMP_STOP":
                    stop_pump()
                    await ws.send(json.dumps({
                        "id": DRONE_ID, 
                        "type": "payload_status", 
                        "status": "idle"
                    }))
                    
    except Exception as e:
        print(f"Ağ bağlantı hatası: {e}")
        stop_pump() # Güvenlik: Bağlantı koparsa pompayı kapat

if __name__ == "__main__":
    try:
        asyncio.run(payload_listener())
    except KeyboardInterrupt:
        print("\nSistem kapatılıyor...")
    finally:
        stop_pump()
        GPIO.cleanup() # GPIO pinlerini sıfırla
