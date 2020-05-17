
const fromCodePoint = String.fromCodePoint;

/**
 * to ISO-8859-1
 * @param bytes {Buffer|Uint8Array}
 * @param i {Number?}
 * @param len {Number?}
 * @returns {string}
 */
function readBytesToISO88591( bytes, i, len ) {
  if ( !bytes ) return "";
  if ( typeof i !== "number" ) {
    i = 0;
  }
  if ( !len || len < 0 ) {
    len = bytes.length
  }
  let result = '';
  while ( i < len ) {
    result += fromCodePoint( bytes[ i ] );
    i++;
  }
  return result
}

function isExistUtf8BOM( bytes ,i=0) {
  return (bytes[i] === 0xef && bytes[i+1] === 0xbb && bytes[i+2] === 0xbf)
}
function isExistUtf16leBOM( bytes ,i=0 ) {
  return (bytes[i] === 0xff && bytes[i+1] === 0xfe)
}
function isExistUtf16beBOM( bytes ,i=0 ) {
  return (bytes[i] === 0xfe && bytes[i+1] === 0xff)
}

/**
 * 二进制转 utf8 字符串
 * @param bytes {Buffer|Uint8Array}
 * @param i {Number?}
 * @param len {Number?}
 * @description 使用 String.fromCodePoint() 来获取对应的字符
 * @returns {string|string}
 */
function readBytesToUtf8( bytes, i, len ) {
  if ( !bytes ) return "";
  let result = "";
  if ( typeof i !== "number" ) {
    i = 0;
  }
  if ( !len ) {
    len = bytes.length;
  }
  if (isExistUtf8BOM(bytes,i)) {
    i+=3;
  }
  while ( i < len ) {
    if ( bytes[ i ] <= 0b0111_1111 ) { // 一字节 0xxxxxxx
      if(bytes[i]!==0) {
        result += fromCodePoint( bytes[ i ] );
      }
      i += 1;
    } else if ( bytes[ i ] >= 0b1100_0000 && bytes[ i ] <= 0b1101_1111 ) { // 二字节 110xxxxx 10xxxxxx
      result += fromCodePoint(
        ((bytes[ i ] & 0b0001_1111) << 6) | (bytes[ i + 1 ] & 0b0011_1111)
      );
      i += 2;
    } else if ( bytes[ i ] >= 0b1110_0000 && bytes[ i ] <= 0b1110_1111 ) { // 三字节 1110xxxx 10xxxxxx 10xxxxxx
      result += fromCodePoint(
        ((bytes[ i ] & 0b0000_1111) << 12) |
        ((bytes[ i + 1 ] & 0b0011_1111) << 6) |
        (bytes[ i + 2 ] & 0b0011_1111)
      );
      i += 3;
    } else if ( bytes[ i ] >= 0b1111_0000 && bytes[ i ] <= 0b1111_0111 ) { // 四字节 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      result += fromCodePoint(
        ((bytes[ i ] & 0b0000_0111) << 18) |
        ((bytes[ i + 1 ] & 0b0011_1111) << 12) |
        ((bytes[ i + 2 ] & 0b0011_1111) << 6) |
        (bytes[ i + 3 ] & 0b0011_1111)
      );
      i += 4;
    } else {
      throw "错误的编码"
    }
  }
  return result
}

/**
 * 字符串 to Utf16 little-endian 字节数组
 * @param bytes {Buffer|Uint8Array}
 * @param i {Number?}
 * @param len {Number?}
 * @returns {string}
 */
function readBytesToUtf16LE( bytes, i, len ) {
  if ( !bytes ) return "";
  let result = "";
  if ( typeof i !== "number" ) {
    i = 0;
  }
  if ( !len ) {
    len = bytes.length;
  }
  if (isExistUtf16leBOM(bytes,i)) {
    i+=2;
  }
  while ( i < len ) {
    if ( bytes[ i ] <= 0xFFFF ) { // 二字节
      result += fromCodePoint( (bytes[ i + 1 ] << 8) | bytes[ i ] );
      i += 2;
    } else if ( bytes[ i ] >= 0x10000 && bytes[ i ] <= 0x10FFFF ) { // 四字节
      result += fromCodePoint(
        (
          ((bytes[ i + 2 ] & 0b00000011) << 18) |
          bytes[ i ] << 10 |
          ((bytes[ i + 3 ] & 0b00000011) << 8) |
          bytes[ i + 2 ]
        ) + 0x10000
      );
      i += 4;
    } else {
      throw "错误的编码"
    }
  }
  return result
}

/**
 * 字符串 to Utf16 big-endian 字节数组
 * @param bytes {Buffer|Uint8Array}
 * @param i {Number?}
 * @param len {Number?}
 * @returns {string}
 */
function readBytesToUtf16BE( bytes, i, len ) {
  if ( !bytes ) return "";
  let result = "";
  if ( typeof i !== "number" ) {
    i = 0;
  }
  if ( !len ) {
    len = bytes.length;
  }
  if (isExistUtf16beBOM(bytes,i)) {
    i+=2;
  }
  while ( i < len ) {
    if ( bytes[ i ] <= 0xFFFF ) { // 二字节
      result += fromCodePoint( (bytes[ i ] << 8) | bytes[ i + 1 ] );
      i += 2;
    } else if ( bytes[ i ] >= 0x10000 && bytes[ i ] <= 0x10FFFF ) { // 四字节
      result += fromCodePoint(
        (
          ((bytes[ i + 3 ] & 0b0000_0011) << 18) |
          (bytes[ i + 2 ] << 10) |
          ((bytes[ i + 1 ] & 0b0000_0011) << 8) |
          bytes[ i ]
        ) + 0x10000
      );
      i += 4;
    } else {
      throw "错误的编码"
    }
  }
  return result
}


module.exports = {
  readBytesToUtf8,
  readBytesToUtf16BE,
  readBytesToUtf16LE,
  readBytesToISO88591,
};
