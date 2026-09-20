#!/usr/bin/env python3
"""Verify a signed telemetry frame from a RiverAir payload node.

This is the check the companion computer runs before it will put a frame into a
flight record. It is deliberately small: the frame is signed over exactly the
bytes that were transmitted before the signature field, so verifying is a split
on the last pipe and an Ed25519 check — there is no canonical form to agree on.

    python verify_frame.py --pubkey <64 hex> --frame "RA1|41|…|<128 hex>"
    python verify_frame.py --pubkey <64 hex> --stdin < capture.log

The public key is the one the node prints in its BOOT line, and is also a valid
Stellar Ed25519 public key — `--stellar` prints it in strkey form.

Requires: pip install pynacl
"""

from __future__ import annotations

import argparse
import binascii
import hashlib
import struct
import sys

from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey

SIGNATURE_HEX_LEN = 128  # 64 bytes


def split_frame(frame: str) -> tuple[bytes, bytes]:
    """Return (signed_payload, signature) for a frame line."""
    frame = frame.strip()
    cut = frame.rfind("|")
    if cut < 0:
        raise ValueError("not a frame: no field separator")

    payload, signature_hex = frame[:cut], frame[cut + 1 :]
    if len(signature_hex) != SIGNATURE_HEX_LEN:
        raise ValueError(
            f"expected a {SIGNATURE_HEX_LEN}-character signature, got {len(signature_hex)}"
        )

    return payload.encode("ascii"), binascii.unhexlify(signature_hex)


def verify(frame: str, public_key: bytes) -> bool:
    payload, signature = split_frame(frame)
    try:
        VerifyKey(public_key).verify(payload, signature)
        return True
    except BadSignatureError:
        return False


def to_stellar_address(public_key: bytes) -> str:
    """Render a raw Ed25519 public key as a Stellar account id (strkey 'G…').

    Included because it is the point of using this curve: the board's identity
    and an on-chain identity are the same 32 bytes in two encodings.
    """
    import base64

    version_byte = 6 << 3  # account id
    payload = bytes([version_byte]) + public_key

    checksum = 0x0000
    for byte in payload:
        code = checksum ^ (byte << 8)
        code &= 0xFFFF
        for _ in range(8):
            code = ((code << 1) ^ 0x1021) & 0xFFFF if code & 0x8000 else (code << 1) & 0xFFFF
        checksum = code

    return base64.b32encode(payload + struct.pack("<H", checksum)).decode("ascii").rstrip("=")


def record_hash(frames: list[str]) -> str:
    """The 32-byte digest `complete()` stores, over a whole verified flight."""
    digest = hashlib.sha256()
    for frame in frames:
        digest.update(frame.strip().encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pubkey", required=True, help="node public key, 64 hex characters")
    parser.add_argument("--frame", help="a single frame line to check")
    parser.add_argument(
        "--stdin", action="store_true", help="read frames from stdin, one per line"
    )
    parser.add_argument(
        "--stellar", action="store_true", help="also print the key as a Stellar address"
    )
    args = parser.parse_args()

    public_key = binascii.unhexlify(args.pubkey)
    if len(public_key) != 32:
        print("A public key is 32 bytes / 64 hex characters.", file=sys.stderr)
        return 2

    if args.stellar:
        print(f"stellar address  {to_stellar_address(public_key)}")

    if args.frame:
        frames = [args.frame]
    elif args.stdin:
        frames = [line for line in sys.stdin if line.strip().startswith("RA1|")]
    else:
        print("Give it --frame or --stdin.", file=sys.stderr)
        return 2

    good = 0
    for frame in frames:
        try:
            ok = verify(frame, public_key)
        except ValueError as exc:
            print(f"malformed  {exc}")
            continue
        good += ok
        if not ok:
            print(f"BAD        {frame.strip()[:72]}…")

    print(f"verified   {good}/{len(frames)} frames")
    if good == len(frames) and frames:
        print(f"record     sha256 {record_hash(frames)}")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
