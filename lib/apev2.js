const { readBytesToUtf8 } = require( "./encoding" );
const tagBuf = Buffer.from( "APETAGEX" );

/**
 * 计算 2 进制的某一位是否是 1
 * @param num {Number}
 * @param bit {Number} 从 0 开始
 * @return {Boolean}
 */
function isBit1( num, bit ) {
  return ((num >> bit) & 1) === 1
}

/**
 * 计算版本
 * @param buf {Buffer}
 * @param i {Number}
 * @returns {string}
 * @description 已知 1.000 和 2.000
 */
function calcVersion( buf, i ) {
  const version = (buf[ i + 3 ] << 16) | (buf[ i + 2 ] << 8) | (buf[ i + 1 ] << 8) | buf[ i ];
  if ( version === 1000 ) {
    return "1.000"
  }
  if ( version === 2000 ) {
    return "2.000"
  }
  return `unknown version ${ version }`
}

/**
 * 计算大小 高位在后
 * @param buf {Buffer}
 * @param i {Number}
 * @return {Number}
 */
function calcSize( buf, i ) {
  return (buf[ i + 3 ] << 24) | (buf[ i + 2 ] << 16) | (buf[ i + 1 ] << 8) | buf[ i ];
}

/**
 * 解析 flag
 * @param buf {Buffer}
 * @param i {Number}
 * @description header footer items 的 flag 解析都是一样的,并且位也没有冲突
 * @return {{isHeader: Boolean, isExistFooter: Boolean, isExistHeader: Boolean}}
 */
function parseFlags( buf, i ) {
  const flagNum = calcSize( buf, i );
  return {
    // 此apev2 含有Header吗
    isExistHeader: isBit1( flagNum, 31 ),
    // 此apev2 是否没有Footer
    isExistFooter: !isBit1( flagNum, 30 ),
    // 这是页眉吗
    isHeader: isBit1( flagNum, 29 ),
  }
}

/**
 * 解析 flag
 * @param buf {Buffer}
 * @param i {Number}
 * @description header footer items 的 flag 解析都是一样的,并且位也没有冲突
 * @return {{ onlyRead: Boolean,  encoding: number}}
 */
function parseItemFlags( buf, i ) {
  const flagNum = calcSize( buf, i );
  return {
    // 是否只读
    onlyRead: isBit1( flagNum, 0 ),
    // 包含什么信息
    // 0 utf8 文本
    // 1 二进制信息
    // 2 项目是外部存储信息的定位符**
    // 3 保留
    // 0 "Item contains text information coded in UTF-8",
    // 1 "Item contains binary information*",
    // 2 "Item is a locator of external stored information**",
    // 3 "reserved",
    encoding: flagNum & 0b110
  }
}

/**
 * 解析 header or footer
 * @param buf {Buffer}
 * @param i {Number}
 * @return {{size: Number, flags: {isHeader: Boolean, isExistFooter: Boolean, isExistHeader: Boolean}, tag: string, version: string, items: Number}}
 */
function parseHeader( buf, i ) {
  return {
    tag: readBytesToUtf8( buf, i, i + 8 ),
    // 高位在后
    version: calcVersion( buf, i + 8 ),
    // Tag size in bytes including footer and all tag items excluding the header to be as compatible as possible with APE Tags 1.000
    // 标签大小（以字节为单位），包括页脚和所有标头项目（不包括标头），应与APE标签1.000尽可能兼容
    // 高位在后
    size: calcSize( buf, i + 12 ),
    // Number of items in the Tag (n)
    // 高位在后 计算方式和 size 一致
    items: calcSize( buf, i + 16 ),
    // 高位在后
    flags: parseFlags( buf, i + 20 ),
    // 剩下 8 个字节必须为 0
  }
}

/**
 * 读取字节直到 00 终止
 * @param buf {Buffer}
 * @param i {Number}
 * @param bytes {Array}
 * @return {Number}
 */
function readBytes( buf, i, bytes ) {
  let len = buf.length;
  while ( i < len ) {
    if ( buf[ i ] === 0 ) {
      break;
    } else {
      bytes.push( buf[ i ] )
    }
    i++;
  }
  return i
}

/**
 * 读取二进制的 value
 * @param buf {Buffer}
 * @param i {Number}
 * @param len {Number}
 * @return {Array}
 */
function readBinaryValueBytes( buf, i, len ) {
  const bytes = [];
  while ( i < len ) {
    bytes.push( buf[ i ] );
    i++;
  }
  return bytes
}

/**
 *
 * @param buf {Buffer}
 * @param i {Number}
 * @param totalSize{Number}
 * @param counts{Number}
 */
function parseItem( buf, i, totalSize, counts ) {
  let j = 0;
  const items = [];
  let keyBytes = [];
  let size = 0;
  let flags = {};
  let valueIndex = 0;
  let valueBytes = [];
  while ( j < counts && i < totalSize ) {
    keyBytes = [];
    flags = parseItemFlags( buf, i + 4 );
    size = calcSize( buf, i );
    // 这个 index 刚好是 00 的位置 所以需要+1
    valueIndex = readBytes( buf, i + 8, keyBytes ) + 1;
    valueBytes = readBinaryValueBytes( buf, valueIndex, valueIndex + size );
    items.push( {
      size: size,
      flags: flags,
      // ASCII 编码 最多 255 个字符
      key: readBytesToUtf8( keyBytes ),
      // utf8 | binary
      // 0 是 utf8 1 是 binary 2 位址訊息 utf8 3 保留
      // 所以为 0 时解析成文本, 其他的都读出字节数组
      value: flags.encoding === 1 ? valueBytes : readBytesToUtf8( valueBytes ),
    } );
    i = valueIndex + size;
    j++;
  }
  return items
}


/**
 * 查找 apev2 的开始位置
 * @param buf {Buffer}
 * @description 返回 -1 代表没有正确的 tag 但是还是可能存在 APETAGEX 的
 * @return {Number}
 * @todo: 如遇到 id3v2 应直接计算 id3v2 大小然后跳到 id3v2 的后面
 */
function findTagStartIndexByBefore( buf ) {
  let i = 0;
  // 32字节是 header 或 footer 的大小, 所以没必要查找后面的字节
  let len = buf.length - 32;
  while ( i < len ) {
    if ( tagBuf.compare( buf, i, i + 8 ) === 0 ) {
      return i
    } else {
      i++;
    }
  }
  return -1
}

/**
 * 查找 apev2 的开始位置
 * @param buf {Buffer}
 * @description 返回 -1 代表没有正确的 tag 但是还是可能存在 APETAGEX 的
 * @return {Number}
 */
function findTagStartIndexByAfter( buf ) {
  let i = buf.length;
  if ( i > 128 && Buffer.from( "TAG" ).compare( buf, i - 128, i - 128 + 3 ) === 0 ) {
    i = i - 128 - 8;
  } else {
    i = i - 8;
  }
  while ( i > 32 ) {
    if ( tagBuf.compare( buf, i, i + 8 ) === 0 ) {
      return i
    } else {
      i--;
    }
  }
  return -1
}

/**
 *
 * @param buf {Buffer}
 This is how information is laid out in an APEv2 tag:

 APE Tags Header  32 bytes
 APE Tag Item 1  10.. bytes
 APE Tag Item 2  10.. bytes
 ...  10.. bytes
 APE Tag Item n-1  10.. bytes
 APE Tag Item n  10.. bytes
 APE Tags Footer  32 bytes

 * @param dir {Number} 从前面(1)还是后面(-1)搜索 默认后面
 */
function parse( buf, dir = -1 ) {
  let i = 0;
  if ( dir > 0 ) {
    i = findTagStartIndexByBefore( buf );
  } else {
    i = findTagStartIndexByAfter( buf );
  }
  if ( i === -1 ) {
    return null
  }
  const header = parseHeader( buf, i );
  let totalSize = header.size;
  // 首先 size 的大小是不包含 header 的 但是包含 Footer 的
  if ( header.flags.isExistFooter ) {
    totalSize -= 32;
  }
  const result = {
    header: null,
    footer: null,
    items: []
  };

  if ( header.flags.isHeader ) {
    result.header = header;
    if ( header.flags.isExistFooter ) {
      result.footer = parseHeader( buf, i + totalSize )
    }
  } else {
    result.footer = header;
    if ( header.flags.isExistHeader ) {
      result.header = parseHeader( buf, i - totalSize - 32 )
    }
  }
  // 并且 header 与 footer 的内容没有差别
  // 是否有 header  header.flags.isContainsTitle
  // size 是包含 footer 的所以需要判断 footer 存不存在
  // 如果这两是 Footer 则跳到内容开始处, 如果是 header 那么 i+32 就是内容开始
  if ( header.flags.isHeader ) {
    i = i - 32;
  } else {
    i = i - totalSize;
  }
  result.items = parseItem( buf, i, i + totalSize, header.items );
  return result
}

module.exports = {
  parse,
};
