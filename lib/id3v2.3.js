const { SYLTContentType } = require( "./constants/sylt-content-type" );
const { ImageType } = require( "./constants/image-type" );
const {
  readBytesToISO88591,
  readBytesToUtf16LE,
  readBytesToUtf16BE,
  readBytesToUtf8,
} = require( './encoding' );

/**
 * 跳过 00
 * @param buf {Buffer|Uint8Array}
 * @param i {Number}
 * @returns {Number}
 */
function skipPaddingZeros( buf, i ) {
  while ( i < buf.length ) {
    if ( buf[ i ] === 0 ) {
      i++;
    } else {
      return i
    }
  }
  return i;
}

/**
 * 判断是否有 ID3tag
 * @param buf {Buffer}
 * @returns {boolean}
 */
function isExistID3V2( buf ) {
  return Buffer.from( 'ID3' ).compare( buf, 0, 3 ) === 0
}

/**
 * 计算 tag 的大小
 * @param buf {Buffer|Uint8Array}
 * @returns {number}
 * @description 大小可能包含 header 也可能不包含 id3.org 上说是不含的,但是实际上有些文件上是包含的
 */
function calcTagSize( buf ) {
  return (buf[ 0 ] & 0x7F) * 0x200000
    + (buf[ 1 ] & 0x7F) * 0x4000
    + (buf[ 2 ] & 0x7F) * 0x80
    + (buf[ 3 ] & 0x7F)
}

/**
 * 计算帧的大小
 * @param buf {Buffer|Uint8Array}
 * @returns {Number}
 * @description 这个大小是帧总大小-10
 */
function calcFrameSize( buf ) {
  return buf[ 0 ] * 0x1000000
    + buf[ 1 ] * 0x10000
    + buf[ 2 ] * 0x100
    + buf[ 3 ];
}

/**
 * 解析 header
 * @param buf {Buffer|Uint8Array}
 * @returns {{major: number, size: number, flags: {xHeader: boolean, unsynchronisation: boolean, experimental: boolean}, version: string}}
 */
function parseHeader( buf ) {
  return {
    version: '2.' + buf[ 3 ] + '.' + buf[ 4 ],
    // 本号 ID3V2.3 就记录 3
    major: buf[ 3 ],
    // 副版本号此版本记录为 0
    // 一个字节如: abc00000
    flags: {
      // ID3v2标志中的位7指示是否使用了非同步功能。
      unsynchronisation: (buf[ 5 ] & 128) !== 0,
      // 第二位（位6）指示是否在标头之后跟随扩展标头。扩展头在3.2节中描述。
      xHeader: (buf[ 5 ] & 64) !== 0,
      // 第三位（位5）应用作“实验指标”。标签处于实验阶段时，应始终设置此标志。
      experimental: (buf[ 5 ] & 32) !== 0,
    },
    //  mp3 文件的标签大小是不包含标签头的,但有的又是包含的,可能是某些 mp3 编码器写标签的 BUG,
    //  所以为了兼容只好认为其是包含的,如果按大小找不到,再向后搜索,直到找到首帧为止。
    // 一共四个字节,但每个字节只用 7 位,最高位不使用恒为 0。所以格式如下
    // 0xxxxxxx 0xxxxxxx 0xxxxxxx 0xxxxxxx
    // 计算大小时要将 0 去掉,得到一个 28 位的二进制数,就是标签大小(不懂为什么要这样做),
    size: calcTagSize( buf.slice( 6, 10 ) ),
  }
}

/**
 * 解析帧的 header
 * @param buf {Buffer|Uint8Array}
 * @returns {{size: Number, flags: {a: boolean, b: boolean, c: boolean, origin: *, i: boolean, j: boolean, k: boolean}, id: String}}
 */
function parseFrameHeader( buf ) {
  return {
    id: buf.slice( 0, 4 ).toString(),
    // 帧内容的大小,不包括帧头,不得小于 1
    size: calcFrameSize( buf.slice( 4, 8 ) ),
    // 只定义了 6 位,另外的 10 位为 0,但大部分的情况下 16 位都为 0 就可以了。格式如下:
    // abc00000 ijk00000
    // a -- 标签保护标志,设置时认为此帧作废
    // b -- 文件保护标志,设置时认为此帧作废
    // c -- 只读标志,设置时认为此帧不能修改(但我没有找到一个软件理会这个标志)
    // i -- 压缩标志,设置时一个字节存放两个 BCD 码表示数字
    // j -- 加密标志(没有见过哪个 MP3 文件的标签用了加密)
    // k -- 组标志,设置时说明此帧和其他的某帧是一组
    // 值得一提的是 winamp 在保存和读取帧内容的时候会在内容前面加个'\0',并把这个字节计算在帧内容的
    flags: {
      a: (buf[ 8 ] & 128) !== 0,
      b: (buf[ 8 ] & 64) !== 0,
      c: (buf[ 8 ] & 32) !== 0,
      i: (buf[ 9 ] & 128) !== 0,
      j: (buf[ 9 ] & 64) !== 0,
      k: (buf[ 9 ] & 32) !== 0,
      origin: buf.slice( 8, 10 ).toJSON.data,
    }
  }
}

/**
 * @param buf {Buffer|Uint8Array}
 * @returns {string}
 * @description
 * <Header for 'Text information frame', ID: "T000" - "TZZZ", excluding "TXXX" described in 4.2.2.>
    Text encoding    $xx
    Information    <text string according to encoding>
 */
function readTextFrame( buf ) {
  const decode = getDecodingFunc( buf[ 0 ] );
  return decode( buf.slice( 1 ) );
}

/**
 * 读取字节直到 00
 * @param buf {Buffer|Uint8Array}
 * @param i {Number}
 * @returns {[Uint8Array, Number]}
 */
function readByte( buf, i ) {
  const bytes = [];
  const len = buf.length;
  while ( i < len ) {
    if ( buf[ i ] !== 0 ) {
      bytes.push( buf[ i ] );
      i++;
    } else {
      break;
    }
  }
  return [ bytes, i ]
}

/**
 * 获取对应的字符解码函数
 * @param byte {Number}
 * @returns {readBytesToUtf8|(function((Buffer|Number[]), Number=, Number=): (string))|*|readBytesToUtf16LE|(function(Array, Number=, Number=): string)|*|readBytesToUtf16BE|(function(Array, Number=, Number=): string)|*|readBytesToISO88591|(function((Buffer|ArrayBuffer|Array), Number=, Number=): string)|*}
 */
function getDecodingFunc( byte ) {
  switch ( byte ) {
    case 0: // ISO-8859-1
      return readBytesToISO88591;
    case 1: // utf-16
      return readBytesToUtf16LE;
    case 2: //utf-16be
      return readBytesToUtf16BE;
    case 3: // utf-8
      return readBytesToUtf8;
    default:
      return readBytesToUtf8;
  }
}

/**
 * 读取图片帧
 * @param buf {Buffer|Uint8Array}
 * @returns {{data: Buffer, mime: string, description: string, type: string}}
 * @description
 *  <Header for 'Attached picture', ID: "APIC">
 Text encoding   $xx
 MIME type       <text string> $00
 Picture type    $xx
 Description     <text string according to encoding> $00 (00)
 Picture data    <binary data>
 */
function readImageFrame( buf ) {
  const func = getDecodingFunc( buf[ 0 ] );
  const [ mimeBytes, i ] = readByte( buf, 1 );
  const type = ImageType[ i ];
  const [ descriptionBytes, dataStart ] = readByteByUtf16( buf, i );
  return {
    mime: readBytesToISO88591( mimeBytes ),
    type: type,
    description: func( descriptionBytes ),
    data: buf.slice( dataStart ),
  }
}

/**
 * 读取注释帧
 * @param buf {Buffer|Uint8Array}
 * @returns {{description: string, language: string, text: string}}
 */
function readCommentFrame( buf ) {
  const func = getDecodingFunc( buf[ 0 ] );
  let [ descriptionBytes, i ] = readByteByUtf16( buf, 4 );
  return {
    language: readBytesToISO88591( buf.slice( 1, 4 ) ),
    description: func( descriptionBytes ),
    // 这里面并不全是文字, 后面可能跟了一些 00 的填充
    text: func( buf.slice( i ) ),
  }
}

/**
 * 读取字节直到 00 00
 * @param buf {Buffer|Uint8Array}
 * @param i {Number}
 * @returns {[Uint8Array, Number]}
 */
function readByteByUtf16( buf, i ) {
  const result = [];
  const len = buf.length;
  while ( i < buf.length ) {
    if ( i % 2 === 0 && i < len - 2 && buf[ i ] === 0 && buf[ i + 1 ] === 0 ) {
      break;
    }
    result.push( buf[ i ] );
    i++
  }
  // 结束时 i 正好是 00 00 的第一个,需要+2 到下一个的开始
  return [ result, i + 2 ]
}

/**
 * 不同步的歌词
 * @param buf {Buffer|Uint8Array}
 * @description
 * <Header for 'Unsynchronised lyrics/text transcription', ID: "USLT">
 Text encoding       $xx
 Language            $xx xx xx
 Content descriptor  <text string according to encoding> $00 (00)
 Lyrics/text         <full text string according to encoding>
 */
function readUSLTFrame( buf ) {
  const decode = getDecodingFunc( buf[ 0 ] );
  let [ d, i ] = readByteByUtf16( buf, 4 );
  return {
    // 3字节
    language: readBytesToISO88591( buf.slice( 1, 4 ) ),
    // 需要注意是以 00 00 为结束的,而 utf16 在知乎 Unicode 值较小的时候会有 00
    description: decode( d ),
    // 内容会带 bom 头
    text: decode( buf.slice( i ) )
  }
}


// 同步歌词的时间格式
const SYLT_TIME_FORMAT = [
  null,// 从 1 开始
  "Absolute time, 32 bit sized, using MPEG frames as unit",
  "Absolute time, 32 bit sized, using milliseconds as unit"
];

/**
 * 同步的歌词
 * @param buf {Uint8Array|Buffer}
 * @returns {{description: string, language: string, text: string}}
 */
function readSYLTFrame( buf ) {
  //   ecode
  // 0 "Unicode character set is used => $00 00 is sync identifier.",
  // 1 "ISO-8859-1 character set is used => $00 is sync identifier.",
  // const len = buf.length;
  // let i = 6;
  // let text = '';
  // TODO:
  // while ( i<len ) {
  //
  //   i++;
  // }
  return {
    // 3字节
    encode: [ "ISO-8859-1", "unicode(不知道是 8 还是 16)" ][ buf[ 0 ] ],
    language: readBytesToISO88591( buf.slice( 1, 4 ) ),
    timeFormat: SYLT_TIME_FORMAT[ buf[ 4 ] ],
    contentType: SYLTContentType[ buf[ 5 ] ],
    // Terminated text to be synced (typically a syllable)
    // Sync identifier (terminator to above string)    $00 (00)
    // Time stamp      $xx (xx ...)
    // 最后 2 位是 00 00
    text: ""
  }
}

/**
 * 判断不同的 id 调用不同的解析方法
 * @param buf {Buffer|Uint8Array}
 * @param id {String}
 * @returns {string|{description: string, language: string, text: string}|{description: string, language: string, text: string}|{data: Buffer, mime: string, description: string, type: string}}
 */
function parseSwitch( buf, id ) {
  if ( id === 'TXXX' ) {
    return "TXXX"
  }
  // 如果以 T 开头的话,需要区别 TXXX(用户自定义文本)
  if ( /^T/.test( id ) ) {
    return readTextFrame( buf )
  }
  switch ( id ) {
    // 图片
    case "APIC":
      return readImageFrame( buf );
    // 注释
    case "COMM":
      return readCommentFrame( buf );
    // 非同步歌词
    case "USLT":
      return readUSLTFrame( buf );
    // 同步歌词
    case "SYLT":
      return readSYLTFrame( buf );
    default:
      console.log( `不支持的 id [ ${ id } ]` );
      return  ""
  }
}

/**
 * 解析frame
 * @param buf {Buffer|Uint8Array}
 * @param totalSize {Number}
 * @param list {Array}
 */
function parseFrame( buf, totalSize, list ) {
  let i = 0;
  while ( i < totalSize ) {
    const header = parseFrameHeader( buf.slice( i, i + 10 ) );
    const bodyBuffer = buf.slice( i + 10, i + 10 + header.size );
    // 如果标记为压缩或加密,跳过
    if ( header.flags.i || header.flags.j ) {
      console.log( '压缩或加密' );
      continue;
    }
    const body = parseSwitch( bodyBuffer, header.id );
    list.push( { header, body } );
    i = i + 10 + header.size;
    // 因为标准中 totalSize 是不包含标头的, 而一些文件的实现确是包含了的, 所以做下判断, 如果为 true 的话就代表是包含的,
    if ( i === totalSize - 10 ) {
      break;
    }
    i = skipPaddingZeros( buf, i )
  }
}


/**
 * @param buf {Buffer|Uint8Array}
 * @returns {({image, comments, artist, year, album, genre, title, track, lyrics}&{header: {major: number, size: number, flags: {xHeader: boolean, unsynchronisation: boolean, experimental: boolean}, version: string}, frame: Array})|null}
 */
function parse( buf ) {
  if ( !isExistID3V2( buf ) ) {
    return null
  }
  const header = parseHeader( buf );
  if ( header.flags.unsynchronisation ) {
    throw "Does not support Unsynchronisation!"
  }
  if ( header.major !== 3 ) {
    throw `This version is not ID3v2.3 [${ header.version }]`
  }
  let headerSize = 10;
  if ( header.flags.xHeader ) {
    headerSize += calcTagSize( buf.slice( 10, 14 ) )
  }
  const frameList = [];
  parseFrame( buf.slice( headerSize ), header.size, frameList );
  return {
    header,
    frame: frameList,
    ...toObject( frameList )
  }
}

function toObject( list ) {
  return {
    artist: list.find( v => v.header.id === 'TPE1' ),
    album: list.find( v => v.header.id === 'TALB' ),
    title: list.find( v => v.header.id === 'TIT2' ),
    year: list.find( v => v.header.id === 'TYER' ),
    track: list.find( v => v.header.id === 'TRCK' ),
    genre: list.find( v => v.header.id === 'TCON' ),
    lyrics: list.filter( v => [ "USLT", "SYLT" ].includes( v.header.id ) ),
    comments: list.filter( v => v.header.id === 'COMM' ),
    image: list.filter( v => v.header.id === 'APIC' ),
  }
}


const ID3V2_3 = {
  parse,
};
module.exports = ID3V2_3;
