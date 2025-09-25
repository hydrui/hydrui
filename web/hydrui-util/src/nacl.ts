// Ported in 2014 by Dmitry Chestnykh and Devi Mandiri.
// TypeScript adaptation for Hydrui.
// Public domain.
//
// Implementation derived from TweetNaCl version 20140427.
// See for details: http://tweetnacl.cr.yp.to/
import { blake2b } from "./blake2b";

const secretboxZeroLength = 32;
const secretboxBoxZeroLength = 16;
export const secretboxKeyLength = 32;
export const secretboxNonceLength = 24;
export const secretboxOverheadLength = secretboxBoxZeroLength;
export const scalarMultScalarLength = 32;
export const scalarMultGroupElementLength = 32;
export const boxPublicKeyLength = 32;
export const boxSecretKeyLength = 32;
export const boxSharedKeyLength = 32;
export const boxNonceLength = secretboxNonceLength;

function gf(init?: number[]) {
  let i;
  const r = new Float64Array(16);
  if (init) for (i = 0; i < init.length; i++) r[i] = init[i];
  return r;
}

const QUOTA = 65536;

function genRandom(x: Uint8Array, n: number) {
  const v = new Uint8Array(n);
  for (let i = 0; i < n; i += QUOTA) {
    crypto.getRandomValues(v.subarray(i, i + Math.min(n - i, QUOTA)));
  }
  x.set(v);
  cleanup(v);
}

const _0 = new Uint8Array(16);
const _9 = new Uint8Array(32);
_9[0] = 9;

const _121665 = gf([0xdb41, 1]);

function L32(x: number, c: number) {
  return (x << c) | (x >>> (32 - c));
}

function ld32(x: Uint8Array, i: number) {
  let u = x[i + 3] & 0xff;
  u = (u << 8) | (x[i + 2] & 0xff);
  u = (u << 8) | (x[i + 1] & 0xff);
  return (u << 8) | (x[i + 0] & 0xff);
}

function st32(x: Uint8Array, j: number, u: number) {
  for (let i = 0; i < 4; i++) {
    x[j + i] = u & 255;
    u >>>= 8;
  }
}

function vn(x: Uint8Array, xi: number, y: Uint8Array, yi: number, n: number) {
  let d = 0;
  for (let i = 0; i < n; i++) d |= x[xi + i] ^ y[yi + i];
  return (1 & ((d - 1) >>> 8)) - 1;
}

function cryptoVerify16(x: Uint8Array, xi: number, y: Uint8Array, yi: number) {
  return vn(x, xi, y, yi, 16);
}

function core(
  out: Uint8Array,
  inp: Uint8Array,
  k: Uint8Array,
  c: Uint8Array,
  h: boolean,
) {
  const w = new Uint32Array(16),
    x = new Uint32Array(16),
    y = new Uint32Array(16),
    t = new Uint32Array(4);
  let i, j, m;

  for (i = 0; i < 4; i++) {
    x[5 * i] = ld32(c, 4 * i);
    x[1 + i] = ld32(k, 4 * i);
    x[6 + i] = ld32(inp, 4 * i);
    x[11 + i] = ld32(k, 16 + 4 * i);
  }

  for (i = 0; i < 16; i++) y[i] = x[i];

  for (i = 0; i < 20; i++) {
    for (j = 0; j < 4; j++) {
      for (m = 0; m < 4; m++) t[m] = x[(5 * j + 4 * m) % 16];
      t[1] ^= L32((t[0] + t[3]) | 0, 7);
      t[2] ^= L32((t[1] + t[0]) | 0, 9);
      t[3] ^= L32((t[2] + t[1]) | 0, 13);
      t[0] ^= L32((t[3] + t[2]) | 0, 18);
      for (m = 0; m < 4; m++) w[4 * j + ((j + m) % 4)] = t[m];
    }
    for (m = 0; m < 16; m++) x[m] = w[m];
  }

  if (h) {
    for (i = 0; i < 16; i++) x[i] = (x[i] + y[i]) | 0;
    for (i = 0; i < 4; i++) {
      x[5 * i] = (x[5 * i] - ld32(c, 4 * i)) | 0;
      x[6 + i] = (x[6 + i] - ld32(inp, 4 * i)) | 0;
    }
    for (i = 0; i < 4; i++) {
      st32(out, 4 * i, x[5 * i]);
      st32(out, 16 + 4 * i, x[6 + i]);
    }
  } else {
    for (i = 0; i < 16; i++) st32(out, 4 * i, (x[i] + y[i]) | 0);
  }
}

function cryptoCoreSalsa20(
  out: Uint8Array,
  inp: Uint8Array,
  k: Uint8Array,
  c: Uint8Array,
) {
  core(out, inp, k, c, false);
  return 0;
}

function cryptoCoreHsalsa20(
  out: Uint8Array,
  inp: Uint8Array,
  k: Uint8Array,
  c: Uint8Array,
) {
  core(out, inp, k, c, true);
  return 0;
}

const sigma = new Uint8Array([
  101, 120, 112, 97, 110, 100, 32, 51, 50, 45, 98, 121, 116, 101, 32, 107,
]);

function cryptoStreamSalsa20Xor(
  c: Uint8Array,
  cpos: number,
  m: Uint8Array | undefined,
  mpos: number,
  b: number,
  n: Uint8Array,
  k: Uint8Array,
) {
  const z = new Uint8Array(16),
    x = new Uint8Array(64);
  let u, i;
  if (!b) return 0;
  for (i = 0; i < 16; i++) z[i] = 0;
  for (i = 0; i < 8; i++) z[i] = n[i];
  while (b >= 64) {
    cryptoCoreSalsa20(x, z, k, sigma);
    for (i = 0; i < 64; i++) c[cpos + i] = (m ? m[mpos + i] : 0) ^ x[i];
    u = 1;
    for (i = 8; i < 16; i++) {
      u = (u + (z[i] & 0xff)) | 0;
      z[i] = u & 0xff;
      u >>>= 8;
    }
    b -= 64;
    cpos += 64;
    if (m) mpos += 64;
  }
  if (b > 0) {
    cryptoCoreSalsa20(x, z, k, sigma);
    for (i = 0; i < b; i++) c[cpos + i] = (m ? m[mpos + i] : 0) ^ x[i];
  }
  return 0;
}

function cryptoStreamSalsa20(
  c: Uint8Array,
  cpos: number,
  d: number,
  n: Uint8Array,
  k: Uint8Array,
) {
  return cryptoStreamSalsa20Xor(c, cpos, undefined, 0, d, n, k);
}

function cryptoStream(
  c: Uint8Array,
  cpos: number,
  d: number,
  n: Uint8Array,
  k: Uint8Array,
) {
  const s = new Uint8Array(32);
  cryptoCoreHsalsa20(s, n, k, sigma);
  return cryptoStreamSalsa20(c, cpos, d, n.subarray(16), s);
}

function cryptoStreamXor(
  c: Uint8Array,
  cpos: number,
  m: Uint8Array,
  mpos: number,
  d: number,
  n: Uint8Array,
  k: Uint8Array,
) {
  const s = new Uint8Array(32);
  cryptoCoreHsalsa20(s, n, k, sigma);
  return cryptoStreamSalsa20Xor(c, cpos, m, mpos, d, n.subarray(16), s);
}

function add1305(h: Uint32Array, c: Uint32Array) {
  let j,
    u = 0;
  for (j = 0; j < 17; j++) {
    u = (u + ((h[j] + c[j]) | 0)) | 0;
    h[j] = u & 255;
    u >>>= 8;
  }
}

const minusp = new Uint32Array([
  5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 252,
]);

function cryptoOnetimeauth(
  out: Uint8Array,
  outpos: number,
  m: Uint8Array,
  mpos: number,
  n: number,
  k: Uint8Array,
) {
  let i, j, u;
  const x = new Uint32Array(17),
    r = new Uint32Array(17),
    h = new Uint32Array(17),
    c = new Uint32Array(17),
    g = new Uint32Array(17);
  for (j = 0; j < 17; j++) r[j] = h[j] = 0;
  for (j = 0; j < 16; j++) r[j] = k[j];
  r[3] &= 15;
  r[4] &= 252;
  r[7] &= 15;
  r[8] &= 252;
  r[11] &= 15;
  r[12] &= 252;
  r[15] &= 15;

  while (n > 0) {
    for (j = 0; j < 17; j++) c[j] = 0;
    for (j = 0; j < 16 && j < n; ++j) c[j] = m[mpos + j];
    c[j] = 1;
    mpos += j;
    n -= j;
    add1305(h, c);
    for (i = 0; i < 17; i++) {
      x[i] = 0;
      for (j = 0; j < 17; j++)
        x[i] =
          (x[i] + h[j] * (j <= i ? r[i - j] : (320 * r[i + 17 - j]) | 0)) |
          0 |
          0;
    }
    for (i = 0; i < 17; i++) h[i] = x[i];
    u = 0;
    for (j = 0; j < 16; j++) {
      u = (u + h[j]) | 0;
      h[j] = u & 255;
      u >>>= 8;
    }
    u = (u + h[16]) | 0;
    h[16] = u & 3;
    u = (5 * (u >>> 2)) | 0;
    for (j = 0; j < 16; j++) {
      u = (u + h[j]) | 0;
      h[j] = u & 255;
      u >>>= 8;
    }
    u = (u + h[16]) | 0;
    h[16] = u;
  }

  for (j = 0; j < 17; j++) g[j] = h[j];
  add1305(h, minusp);
  const s = -(h[16] >>> 7) | 0;
  for (j = 0; j < 17; j++) h[j] ^= s & (g[j] ^ h[j]);

  for (j = 0; j < 16; j++) c[j] = k[j + 16];
  c[16] = 0;
  add1305(h, c);
  for (j = 0; j < 16; j++) out[outpos + j] = h[j];
  return 0;
}

function cryptoOnetimeauthVerify(
  h: Uint8Array,
  hpos: number,
  m: Uint8Array,
  mpos: number,
  n: number,
  k: Uint8Array,
) {
  const x = new Uint8Array(16);
  cryptoOnetimeauth(x, 0, m, mpos, n, k);
  return cryptoVerify16(h, hpos, x, 0);
}

function cryptoSecretbox(
  c: Uint8Array,
  m: Uint8Array,
  d: number,
  n: Uint8Array,
  k: Uint8Array,
) {
  let i;
  if (d < 32) return -1;
  cryptoStreamXor(c, 0, m, 0, d, n, k);
  cryptoOnetimeauth(c, 16, c, 32, d - 32, c);
  for (i = 0; i < 16; i++) c[i] = 0;
  return 0;
}

function cryptoSecretboxOpen(
  m: Uint8Array,
  c: Uint8Array,
  d: number,
  n: Uint8Array,
  k: Uint8Array,
) {
  let i;
  const x = new Uint8Array(32);
  if (d < 32) return -1;
  cryptoStream(x, 0, 32, n, k);
  if (cryptoOnetimeauthVerify(c, 16, c, 32, d - 32, x) !== 0) return -1;
  cryptoStreamXor(m, 0, c, 0, d, n, k);
  for (i = 0; i < 32; i++) m[i] = 0;
  return 0;
}

function car25519(o: Float64Array) {
  for (let i = 0; i < 16; i++) {
    o[i] += 65536;
    const c = Math.floor(o[i] / 65536);
    o[(i + 1) * (i < 15 ? 1 : 0)] += c - 1 + 37 * (c - 1) * (i === 15 ? 1 : 0);
    o[i] -= c * 65536;
  }
}

function sel25519(p: Float64Array, q: Float64Array, b: number) {
  const c = ~(b - 1);
  for (let i = 0; i < 16; i++) {
    const t = c & (p[i] ^ q[i]);
    p[i] ^= t;
    q[i] ^= t;
  }
}

function pack25519(o: Uint8Array, n: Float64Array) {
  let i, j, b;
  const m = gf(),
    t = gf();
  for (i = 0; i < 16; i++) t[i] = n[i];
  car25519(t);
  car25519(t);
  car25519(t);
  for (j = 0; j < 2; j++) {
    m[0] = t[0] - 0xffed;
    for (i = 1; i < 15; i++) {
      m[i] = t[i] - 0xffff - ((m[i - 1] >> 16) & 1);
      m[i - 1] &= 0xffff;
    }
    m[15] = t[15] - 0x7fff - ((m[14] >> 16) & 1);
    b = (m[15] >> 16) & 1;
    m[14] &= 0xffff;
    sel25519(t, m, 1 - b);
  }
  for (i = 0; i < 16; i++) {
    o[2 * i] = t[i] & 0xff;
    o[2 * i + 1] = t[i] >> 8;
  }
}

function unpack25519(o: Float64Array, n: Uint8Array) {
  for (let i = 0; i < 16; i++) o[i] = n[2 * i] + (n[2 * i + 1] << 8);
  o[15] &= 0x7fff;
}

function A(o: Float64Array, a: Float64Array, b: Float64Array) {
  for (let i = 0; i < 16; i++) o[i] = (a[i] + b[i]) | 0;
}

function Z(o: Float64Array, a: Float64Array, b: Float64Array) {
  for (let i = 0; i < 16; i++) o[i] = (a[i] - b[i]) | 0;
}

function M(o: Float64Array, a: Float64Array, b: Float64Array) {
  let i, j;
  const t = new Float64Array(31);
  for (i = 0; i < 31; i++) t[i] = 0;
  for (i = 0; i < 16; i++) {
    for (j = 0; j < 16; j++) {
      t[i + j] += a[i] * b[j];
    }
  }
  for (i = 0; i < 15; i++) {
    t[i] += 38 * t[i + 16];
  }
  for (i = 0; i < 16; i++) o[i] = t[i];
  car25519(o);
  car25519(o);
}

function S(o: Float64Array, a: Float64Array) {
  M(o, a, a);
}

function inv25519(o: Float64Array, i: Float64Array) {
  const c = gf();
  let a;
  for (a = 0; a < 16; a++) c[a] = i[a];
  for (a = 253; a >= 0; a--) {
    S(c, c);
    if (a !== 2 && a !== 4) M(c, c, i);
  }
  for (a = 0; a < 16; a++) o[a] = c[a];
}

function cryptoScalarmult(q: Uint8Array, n: Uint8Array, p: Uint8Array) {
  const z = new Uint8Array(32);
  const x = new Float64Array(80);
  let r, i;
  const a = gf(),
    b = gf(),
    c = gf(),
    d = gf(),
    e = gf(),
    f = gf();
  for (i = 0; i < 31; i++) z[i] = n[i];
  z[31] = (n[31] & 127) | 64;
  z[0] &= 248;
  unpack25519(x, p);
  for (i = 0; i < 16; i++) {
    b[i] = x[i];
    d[i] = a[i] = c[i] = 0;
  }
  a[0] = d[0] = 1;
  for (i = 254; i >= 0; --i) {
    r = (z[i >>> 3] >>> (i & 7)) & 1;
    sel25519(a, b, r);
    sel25519(c, d, r);
    A(e, a, c);
    Z(a, a, c);
    A(c, b, d);
    Z(b, b, d);
    S(d, e);
    S(f, a);
    M(a, c, a);
    M(c, b, e);
    A(e, a, c);
    Z(a, a, c);
    S(b, a);
    Z(c, d, f);
    M(a, c, _121665);
    A(a, a, d);
    M(c, c, a);
    M(a, d, f);
    M(d, b, x);
    S(b, e);
    sel25519(a, b, r);
    sel25519(c, d, r);
  }
  for (i = 0; i < 16; i++) {
    x[i + 16] = a[i];
    x[i + 32] = c[i];
    x[i + 48] = b[i];
    x[i + 64] = d[i];
  }
  const x32 = x.subarray(32);
  const x16 = x.subarray(16);
  inv25519(x32, x32);
  M(x16, x16, x32);
  pack25519(q, x16);
  return 0;
}

function cryptoScalarmultBase(q: Uint8Array, n: Uint8Array) {
  return cryptoScalarmult(q, n, _9);
}

function cryptoBoxKeypair(y: Uint8Array, x: Uint8Array) {
  genRandom(x, 32);
  return cryptoScalarmultBase(y, x);
}

function cryptoBoxBeforeNm(k: Uint8Array, y: Uint8Array, x: Uint8Array) {
  const s = new Uint8Array(32);
  cryptoScalarmult(s, x, y);
  return cryptoCoreHsalsa20(k, _0, s, sigma);
}

const cryptoBoxAfterNm = cryptoSecretbox;
const cryptoBoxOpenAfternm = cryptoSecretboxOpen;

export function cryptoBox(
  c: Uint8Array,
  m: Uint8Array,
  d: number,
  n: Uint8Array,
  y: Uint8Array,
  x: Uint8Array,
) {
  const k = new Uint8Array(32);
  cryptoBoxBeforeNm(k, y, x);
  return cryptoBoxAfterNm(c, m, d, n, k);
}

export function cryptoBoxOpen(
  m: Uint8Array,
  c: Uint8Array,
  d: number,
  n: Uint8Array,
  y: Uint8Array,
  x: Uint8Array,
) {
  const k = new Uint8Array(32);
  cryptoBoxBeforeNm(k, y, x);
  return cryptoBoxOpenAfternm(m, c, d, n, k);
}

function checkLengths(k: Uint8Array, n: Uint8Array) {
  if (k.length !== secretboxKeyLength) throw new Error("bad key size");
  if (n.length !== secretboxNonceLength) throw new Error("bad nonce size");
}

function checkBoxLengths(pk: Uint8Array, sk: Uint8Array) {
  if (pk.length !== boxPublicKeyLength) throw new Error("bad public key size");
  if (sk.length !== boxSecretKeyLength) throw new Error("bad secret key size");
}

function cleanup(arr: Uint8Array) {
  for (let i = 0; i < arr.length; i++) arr[i] = 0;
}

export function randomBytes(n: number) {
  const b = new Uint8Array(n);
  genRandom(b, n);
  return b;
}

export function secretbox(msg: Uint8Array, nonce: Uint8Array, key: Uint8Array) {
  checkLengths(key, nonce);
  const m = new Uint8Array(secretboxZeroLength + msg.length);
  const c = new Uint8Array(m.length);
  for (let i = 0; i < msg.length; i++) m[i + secretboxZeroLength] = msg[i];
  cryptoSecretbox(c, m, m.length, nonce, key);
  return c.subarray(secretboxBoxZeroLength);
}

export function secretboxOpen(
  box: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
) {
  checkLengths(key, nonce);
  const c = new Uint8Array(secretboxBoxZeroLength + box.length);
  const m = new Uint8Array(c.length);
  for (let i = 0; i < box.length; i++) c[i + secretboxBoxZeroLength] = box[i];
  if (c.length < 32) return null;
  if (cryptoSecretboxOpen(m, c, c.length, nonce, key) !== 0) return null;
  return m.subarray(secretboxZeroLength);
}

export function scalarMult(n: Uint8Array, p: Uint8Array) {
  if (n.length !== scalarMultScalarLength) throw new Error("bad n size");
  if (p.length !== scalarMultGroupElementLength) throw new Error("bad p size");
  const q = new Uint8Array(scalarMultGroupElementLength);
  cryptoScalarmult(q, n, p);
  return q;
}

export function scalarMultBase(n: Uint8Array) {
  if (n.length !== scalarMultScalarLength) throw new Error("bad n size");
  const q = new Uint8Array(scalarMultGroupElementLength);
  cryptoScalarmultBase(q, n);
  return q;
}

export function box(
  msg: Uint8Array,
  nonce: Uint8Array,
  publicKey: Uint8Array,
  secretKey: Uint8Array,
) {
  const k = boxBefore(publicKey, secretKey);
  return secretbox(msg, nonce, k);
}

export function boxBefore(publicKey: Uint8Array, secretKey: Uint8Array) {
  checkBoxLengths(publicKey, secretKey);
  const k = new Uint8Array(boxSharedKeyLength);
  cryptoBoxBeforeNm(k, publicKey, secretKey);
  return k;
}

export function boxAfter(
  msg: Uint8Array,
  nonce: Uint8Array,
  publicKey: Uint8Array,
  secretKey: Uint8Array,
) {
  const k = boxBefore(publicKey, secretKey);
  return secretbox(msg, nonce, k);
}

export function boxOpen(
  msg: Uint8Array,
  nonce: Uint8Array,
  publicKey: Uint8Array,
  secretKey: Uint8Array,
) {
  const k = boxBefore(publicKey, secretKey);
  return secretboxOpen(msg, nonce, k);
}

export function boxKeyPair() {
  const pk = new Uint8Array(boxPublicKeyLength);
  const sk = new Uint8Array(boxSecretKeyLength);
  cryptoBoxKeypair(pk, sk);
  return { publicKey: pk, secretKey: sk };
}

export function boxKeyPairFromSecretKey(secretKey: Uint8Array) {
  if (secretKey.length !== boxSecretKeyLength)
    throw new Error("bad secret key size");
  const pk = new Uint8Array(boxPublicKeyLength);
  cryptoScalarmultBase(pk, secretKey);
  return { publicKey: pk, secretKey: new Uint8Array(secretKey) };
}

export function sealedbox(msg: Uint8Array, recipientPk: Uint8Array) {
  if (recipientPk.length !== boxPublicKeyLength)
    throw new Error("bad recipient public key size");

  const ephemeralKeyPair = boxKeyPair();
  const ephemeralPk = ephemeralKeyPair.publicKey;
  const ephemeralSk = ephemeralKeyPair.secretKey;

  const nonceInput = new Uint8Array(ephemeralPk.length + recipientPk.length);
  nonceInput.set(ephemeralPk);
  nonceInput.set(recipientPk, ephemeralPk.length);
  const nonce = blake2b(nonceInput, undefined, boxNonceLength);

  const ct = boxAfter(msg, nonce, recipientPk, ephemeralSk);

  const sealedMsg = new Uint8Array(ephemeralPk.length + ct.length);
  sealedMsg.set(ephemeralPk);
  sealedMsg.set(ct, ephemeralPk.length);

  cleanup(ephemeralSk);
  cleanup(nonce);
  cleanup(nonceInput);

  return sealedMsg;
}

export function sealedboxOpen(
  sealedMsg: Uint8Array,
  recipientPk: Uint8Array,
  recipientSk: Uint8Array,
) {
  if (recipientPk.length !== boxPublicKeyLength)
    throw new Error("bad recipient public key size");
  if (recipientSk.length !== boxSecretKeyLength)
    throw new Error("bad recipient secret key size");
  if (sealedMsg.length < boxPublicKeyLength)
    throw new Error("sealed message too short");

  const ephemeralPk = sealedMsg.subarray(0, boxPublicKeyLength);
  const ct = sealedMsg.subarray(boxPublicKeyLength);

  const nonceInput = new Uint8Array(ephemeralPk.length + recipientPk.length);
  nonceInput.set(ephemeralPk);
  nonceInput.set(recipientPk, ephemeralPk.length);
  const nonce = blake2b(nonceInput, undefined, boxNonceLength);

  const m = boxOpen(ct, nonce, ephemeralPk, recipientSk);

  cleanup(nonce);
  cleanup(nonceInput);

  return m;
}

export function verify(x: Uint8Array, y: Uint8Array) {
  if (x.length === 0 || y.length === 0) return false;
  if (x.length !== y.length) return false;
  return vn(x, 0, y, 0, x.length) === 0 ? true : false;
}
