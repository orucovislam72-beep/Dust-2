/* =============================================================
   Минимальный WebSocket-сервер без внешних зависимостей.
   Реализует RFC 6455: handshake, текстовые/бинарные кадры,
   ping/pong, close, маскирование клиентских кадров.
   ============================================================= */
const crypto = require('crypto');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 1024 * 1024; // 1 МБ на сообщение (защита от исчерпания памяти)

class WsSocket {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    this.onmessage = null;   // (text) => void
    this.onclose = null;     // () => void
    this.onopen = null;
    this.fragOpcode = null;  // тип текущего фрагментированного сообщения
    this.fragData = [];
    this.fragSize = 0;

    socket.on('data', chunk => this.onData(chunk));
    socket.on('close', () => this._onClose());
    socket.on('error', () => this._onClose());
  }

  onData(chunk) {
    if (this.closed) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    // Не даём буферу расти бесконечно, если клиент «капает» байтами
    if (this.buffer.length > MAX_MESSAGE * 2) { this.close(); return; }
    while (!this.closed) {
      const frame = this.parseFrame();
      if (!frame) break;
      if (frame.opcode === 0x8) { this.close(); break; }
      if (frame.opcode === 0x9) { this.send(frame.payload, 0xA); continue; }
      if (frame.opcode === 0xA) continue;

      if (frame.opcode === 0x0) {
        // Продолжение фрагментированного сообщения
        if (this.fragOpcode === null) { this.close(); return; }
        this._appendFragment(frame.payload);
        if (frame.fin) this._flushFragments();
        continue;
      }

      if (frame.opcode === 0x1 || frame.opcode === 0x2) {
        if (!frame.fin) {
          this.fragOpcode = frame.opcode;
          this.fragData = [];
          this.fragSize = 0;
          this._appendFragment(frame.payload);
          continue;
        }
        this._deliver(frame.opcode, frame.payload);
      }
    }
  }

  _appendFragment(payload) {
    this.fragSize += payload.length;
    if (this.fragSize > MAX_MESSAGE) { this.close(); return; }
    this.fragData.push(payload);
  }

  _flushFragments() {
    const opcode = this.fragOpcode;
    const data = Buffer.concat(this.fragData);
    this.fragOpcode = null;
    this.fragData = [];
    this.fragSize = 0;
    this._deliver(opcode, data);
  }

  _deliver(opcode, payload) {
    if (!this.onmessage) return;
    this.onmessage(opcode === 0x1 ? payload.toString('utf8') : payload);
  }

  parseFrame() {
    const buf = this.buffer;
    if (buf.length < 2) return null;
    const b0 = buf[0], b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let offset = 2;
    if (len === 126) {
      if (buf.length < 4) return null;
      len = buf.readUInt16BE(2); offset = 4;
    } else if (len === 127) {
      if (buf.length < 10) return null;
      len = Number(buf.readBigUInt64BE(2)); offset = 10;
    }
    if (len > MAX_MESSAGE) { this.close(); return null; }
    let mask = null;
    if (masked) {
      if (buf.length < offset + 4) return null;
      mask = buf.slice(offset, offset + 4); offset += 4;
    }
    if (buf.length < offset + len) return null;
    let payload = buf.slice(offset, offset + len);
    if (mask) {
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    }
    this.buffer = buf.slice(offset + len);
    return { fin, opcode, payload };
  }

  send(data, opcode = 0x1) {
    if (this.closed) return;
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2); header[0] = 0x80 | opcode; header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2);
    }
    try { this.socket.write(Buffer.concat([header, payload])); } catch (e) { this._onClose(); }
  }

  json(obj) { this.send(JSON.stringify(obj)); }

  close() {
    if (this.closed) return;
    try { this.socket.write(Buffer.from([0x88, 0x00])); } catch (e) { /* ignore */ }
    this.closed = true;
    try { this.socket.end(); } catch (e) { /* ignore */ }
    this._onClose();
  }

  _onClose() {
    if (this._closeFired) return;
    this._closeFired = true;
    this.closed = true;
    if (this.onclose) this.onclose();
  }
}

function attach(httpServer, onConnection) {
  httpServer.on('upgrade', (req, socket, head) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
    );
    const ws = new WsSocket(socket);
    if (head && head.length) ws.onData(head);
    onConnection(ws, req);
  });
}

module.exports = { attach, WsSocket };
