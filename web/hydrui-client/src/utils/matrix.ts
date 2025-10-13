export class Mat4 {
  elements: Float32Array;

  constructor() {
    this.elements = new Float32Array(16);
    this.elements[0] = 1;
    this.elements[5] = 1;
    this.elements[10] = 1;
    this.elements[15] = 1;
  }

  perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
    const out = new Float32Array(16);
    const f = 1.0 / Math.tan(fovy / 2);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    this.elements = out;
    return this;
  }

  translate(x: number, y: number, z: number): Mat4 {
    const out = this.elements;
    out[12] = out[0]! * x + out[4]! * y + out[8]! * z + out[12]!;
    out[13] = out[1]! * x + out[5]! * y + out[9]! * z + out[13]!;
    out[14] = out[2]! * x + out[6]! * y + out[10]! * z + out[14]!;
    out[15] = out[3]! * x + out[7]! * y + out[11]! * z + out[15]!;
    return this;
  }

  rotate(rad: number, x: number, y: number, z: number): Mat4 {
    const out = this.elements;
    let len = Math.sqrt(x * x + y * y + z * z);
    if (len < 0.000001) return this;
    len = 1 / len;
    x *= len;
    y *= len;
    z *= len;
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const t = 1 - c;
    const a = out.slice(0, 12);
    const xt = x * t,
      yt = y * t,
      zt = z * t;
    const b = [
      x * xt + c,
      y * xt + z * s,
      z * xt - y * s,
      x * yt - z * s,
      y * yt + c,
      z * yt + x * s,
      x * zt + y * s,
      y * zt - x * s,
      z * zt + c,
    ];
    out[0] = a[0]! * b[0]! + a[4]! * b[1]! + a[8]! * b[2]!;
    out[1] = a[1]! * b[0]! + a[5]! * b[1]! + a[9]! * b[2]!;
    out[2] = a[2]! * b[0]! + a[6]! * b[1]! + a[10]! * b[2]!;
    out[3] = a[3]! * b[0]! + a[7]! * b[1]! + a[11]! * b[2]!;
    out[4] = a[0]! * b[3]! + a[4]! * b[4]! + a[8]! * b[5]!;
    out[5] = a[1]! * b[3]! + a[5]! * b[4]! + a[9]! * b[5]!;
    out[6] = a[2]! * b[3]! + a[6]! * b[4]! + a[10]! * b[5]!;
    out[7] = a[3]! * b[3]! + a[7]! * b[4]! + a[11]! * b[5]!;
    out[8] = a[0]! * b[6]! + a[4]! * b[7]! + a[8]! * b[8]!;
    out[9] = a[1]! * b[6]! + a[5]! * b[7]! + a[9]! * b[8]!;
    out[10] = a[2]! * b[6]! + a[6]! * b[7]! + a[10]! * b[8]!;
    out[11] = a[3]! * b[6]! + a[7]! * b[7]! + a[11]! * b[8]!;
    return this;
  }
}
