// SNBT reader/writer used by the FTB Quests Builder.
// FTB's SNBT is vanilla SNBT plus: '#' comments, newline-separated entries (commas optional).
const SNBT = (() => {
  // For each parsed object: { key: exact source text of its value }. Lets unknown fields
  // be written back byte-for-byte, so importing and re-exporting a chapter loses nothing.
  const RAW = new WeakMap();

  class Typed { constructor(t, v) { this.t = t; this.v = v; } }   // numeric with suffix: L, D, F, S, B
  class Raw { constructor(text) { this.text = text; } }            // emitted verbatim
  class IntArray { constructor(arr) { this.arr = arr; } }          // [I; 1, 2, 3]

  function parse(text) {
    let i = 0;
    const fail = msg => { throw new Error(`SNBT line ${text.slice(0, i).split('\n').length}: ${msg}`); };

    function ws() {
      while (i < text.length) {
        const c = text[i];
        if (c === '#') { while (i < text.length && text[i] !== '\n') i++; }
        else if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ',') i++;
        else break;
      }
    }
    function str(q) {
      i++;
      let out = '';
      while (i < text.length && text[i] !== q) {
        if (text[i] === '\\') {
          i++;
          const e = text[i];
          out += e === 'n' ? '\n' : e === 't' ? '\t' : e;
        } else out += text[i];
        i++;
      }
      if (i >= text.length) fail('unterminated string');
      i++;
      return out;
    }
    function atom(tok) {
      if (tok === 'true') return true;
      if (tok === 'false') return false;
      const m = /^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)([bBsSlLfFdD]?)$/.exec(tok);
      if (m) return Number(m[1]);
      return tok; // bare string
    }
    function obj() {
      i++;
      const o = {}, raws = {};
      for (;;) {
        ws();
        if (i >= text.length) fail("unterminated '{'");
        if (text[i] === '}') { i++; break; }
        let key;
        if (text[i] === '"' || text[i] === "'") key = str(text[i]);
        else {
          const s = i;
          while (i < text.length && !/[\s:]/.test(text[i])) i++;
          key = text.slice(s, i);
        }
        ws();
        if (text[i] !== ':') fail(`expected ':' after "${key}"`);
        i++;
        ws();
        const vs = i;
        o[key] = value();
        raws[key] = text.slice(vs, i);
      }
      RAW.set(o, raws);
      return o;
    }
    function list() {
      i++;
      ws();
      if (/^[BIL];/.test(text.slice(i, i + 2))) i += 2;
      const arr = [];
      for (;;) {
        ws();
        if (i >= text.length) fail("unterminated '['");
        if (text[i] === ']') { i++; break; }
        arr.push(value());
      }
      return arr;
    }
    function value() {
      ws();
      const c = text[i];
      if (c === '{') return obj();
      if (c === '[') return list();
      if (c === '"' || c === "'") return str(c);
      const s = i;
      while (i < text.length && !/[\s,\]\}]/.test(text[i])) i++;
      const tok = text.slice(s, i);
      if (!tok) fail(`unexpected ${c === undefined ? 'end of file' : `'${c}'`}`);
      return atom(tok);
    }

    const v = value();
    ws();
    if (i < text.length) fail(`unexpected trailing '${text[i]}'`);
    return v;
  }

  const BARE_KEY = /^[A-Za-z0-9_\-.+]+$/;
  function quote(s) {
    return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }
  function key(k) { return BARE_KEY.test(k) ? k : quote(k); }
  function num(t, n) {
    if (t === 'D' || t === 'F') {
      const s = Number.isInteger(n) ? n.toFixed(1) : String(n);
      return s + t.toLowerCase();
    }
    return Math.trunc(n) + t;
  }
  function isScalar(v) { return v === null || typeof v !== 'object' || v instanceof Typed || v instanceof IntArray; }

  // Writes in FTB's own style: tabs, one entry per line, sorted keys.
  function write(v, ind = '') {
    if (v instanceof Raw) return v.text;
    if (v instanceof Typed) return num(v.t, v.v);
    if (v instanceof IntArray) return `[I; ${v.arr.map(n => Math.trunc(n)).join(', ')}]`;
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'number') return String(Math.trunc(v));
    if (typeof v === 'string') return quote(v);
    const inner = ind + '\t';
    if (Array.isArray(v)) {
      if (!v.length) return '[ ]';
      const parts = v.map(x => write(x, inner));
      if (v.every(isScalar) && parts.join(', ').length < 80 && !v.some(x => typeof x === 'string' && x.length > 30)) {
        return `[${parts.join(', ')}]`;
      }
      return `[\n${parts.map(p => inner + p).join('\n')}\n${ind}]`;
    }
    const keys = Object.keys(v).filter(k => v[k] !== undefined).sort();
    if (!keys.length) return '{ }';
    return `{\n${keys.map(k => `${inner}${key(k)}: ${write(v[k], inner)}`).join('\n')}\n${ind}}`;
  }

  return {
    parse,
    write: v => write(v) + '\n',
    rawOf: o => RAW.get(o) || {},
    L: n => new Typed('L', Number(n) || 0),
    D: n => new Typed('D', Number(n) || 0),
    raw: t => new Raw(t),
    intArray: a => new IntArray(a),
  };
})();
