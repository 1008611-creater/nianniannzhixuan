(() => {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const rotateRight = (value, amount) => (value >>> amount) | (value << (32 - amount));

  async function sha256File(file, { chunkSize = 4 * 1024 * 1024 } = {}) {
    if (!file || !Number.isFinite(file.size)) throw new Error("MEDIA_UPLOAD_EMPTY");
    let state = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    let remainder = new Uint8Array(0);

    const processBlock = (bytes, offset) => {
      const words = new Uint32Array(64);
      for (let index = 0; index < 16; index += 1) {
        const start = offset + index * 4;
        words[index] = ((bytes[start] << 24) | (bytes[start + 1] << 16) | (bytes[start + 2] << 8) | bytes[start + 3]) >>> 0;
      }
      for (let index = 16; index < 64; index += 1) {
        const s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3);
        const s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10);
        words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = state;
      for (let index = 0; index < 64; index += 1) {
        const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choice = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + choice + K[index] + words[index]) >>> 0;
        const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + majority) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }
      state = state.map((value, index) => (value + [a, b, c, d, e, f, g, h][index]) >>> 0);
    };

    const update = (bytes) => {
      let offset = 0;
      if (remainder.length) {
        const needed = 64 - remainder.length;
        if (bytes.length < needed) {
          const next = new Uint8Array(remainder.length + bytes.length);
          next.set(remainder);
          next.set(bytes, remainder.length);
          remainder = next;
          return;
        }
        const block = new Uint8Array(64);
        block.set(remainder);
        block.set(bytes.subarray(0, needed), remainder.length);
        processBlock(block, 0);
        remainder = new Uint8Array(0);
        offset = needed;
      }
      while (offset + 64 <= bytes.length) {
        processBlock(bytes, offset);
        offset += 64;
      }
      if (offset < bytes.length) remainder = bytes.slice(offset);
    };

    for (let offset = 0; offset < file.size; offset += chunkSize) {
      update(new Uint8Array(await file.slice(offset, Math.min(offset + chunkSize, file.size)).arrayBuffer()));
    }

    const bitLength = BigInt(file.size) * 8n;
    const paddingLength = (64 + 56 - ((remainder.length + 1) % 64)) % 64;
    const finalBytes = new Uint8Array(remainder.length + 1 + paddingLength + 8);
    finalBytes.set(remainder);
    finalBytes[remainder.length] = 0x80;
    for (let index = 0; index < 8; index += 1) {
      finalBytes[finalBytes.length - 1 - index] = Number((bitLength >> BigInt(index * 8)) & 0xffn);
    }
    for (let offset = 0; offset < finalBytes.length; offset += 64) processBlock(finalBytes, offset);
    return state.map((value) => value.toString(16).padStart(8, "0")).join("");
  }

  window.NianNianUploadHash = { sha256File };
})();
