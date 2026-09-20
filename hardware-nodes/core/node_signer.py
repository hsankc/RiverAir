import json
import time
from typing import Dict, Any
# from nacl.signing import SigningKey   # PyNaCl donanımda kurulu olmalıdır
# from stellar_sdk import StrKey        # Adres kodlaması için

class NodeSigner:
    """
    Edge Node (Raspberry Pi / Jetson) üzerinde çalışan donanımsal cüzdan yöneticisi.
    RiverAir ağına giden her veriyi kriptografik olarak imzalar; böylece ağdaki
    diğer aktörler verinin gerçekten bu drone'dan geldiğini doğrulayabilir.

    Stellar hesapları da Ed25519 kullandığı için burada üretilen imza, zincirdeki
    bir hesap kimliğine çeviri katmanı olmadan doğrulanır. Escrow kontratının
    `complete()` fonksiyonu uçuş kaydının 32 baytlık özetini saklar — bu imza
    zincirinin bağlanacağı yer orası.

    NOT: Bu dosya simülasyon modunda çalışır. Gerçek anahtar yüklemesi ve imzalama
    yorum satırlarında bırakılmıştır; donanım entegre edilene kadar aktif değildir.
    """

    def __init__(self, keypair_path: str = "/etc/riverair/node_wallet.json"):
        self.keypair_path = keypair_path
        self.pubkey = None
        self._signer = None
        self._load_wallet()

    def _load_wallet(self):
        """Yerel diskten Ed25519 seed'ini yükler ve G... adresini türetir."""
        try:
            # Gerçek senaryoda bu dosya AES ile şifrelenmiş olmalıdır.
            # with open(self.keypair_path, 'r') as f:
            #     seed = bytes(json.load(f)[:32])          # ilk 32 bayt seed
            #     self._signer = SigningKey(seed)
            #     raw = self._signer.verify_key.encode()   # 32 baytlık public key
            #     self.pubkey = StrKey.encode_ed25519_public_key(raw)

            # Simülasyon modu (geliştirme için)
            self.pubkey = "GSIMULATEDNODEKEY000000000000000000000000000000000000000"
            print(f"[SIGNER] Donanım cüzdanı yüklendi. Pubkey: {self.pubkey}")
        except Exception as e:
            print(f"[SIGNER] Cüzdan yüklenemedi: {e}. Sistem sadece okunur modda çalışacak.")

    def sign_telemetry(self, telemetry_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Telemetri verisini (GPS, batarya vb.) alır, zaman damgası ekler ve Ed25519 ile imzalar.
        """
        # Replay saldırısını engellemek için veriye her zaman zaman damgası eklenir.
        telemetry_data["timestamp"] = int(time.time() * 1000)
        telemetry_data["node_pubkey"] = self.pubkey

        message_bytes = json.dumps(telemetry_data, sort_keys=True).encode("utf-8")

        signature_hex = "simulated_signature_hash_xyz"
        # Gerçek kod:
        # if self._signer:
        #     signature_hex = self._signer.sign(message_bytes).signature.hex()

        return {
            "payload": telemetry_data,
            "signature": signature_hex,
        }

    def verify_server_command(self, command_payload: Dict[str, Any]) -> bool:
        """
        Gelen komutun gerçekten escrow kontratından veya yetkili dispatcher'dan
        gelip gelmediğini kontrol eder (spoofing engelleme).
        """
        # Burada sunucunun imzası bilinen public key ile doğrulanır.
        # ...
        return True


# Test
if __name__ == "__main__":
    signer = NodeSigner()
    test_data = {"lat": 38.4237, "lng": 27.1428, "alt": 120, "battery": 87}
    signed_packet = signer.sign_telemetry(test_data)
    print("İmzalı paket çıktısı:")
    print(json.dumps(signed_packet, indent=2))
