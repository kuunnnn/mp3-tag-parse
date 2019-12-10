/*
一、ID3V1

表1：ID3V1结构
--------------------------------------------------------------------
名称　字节 　　说明
--------------------------------------------------------------------
Tag　　　3 　　ID3V1标识符“TAG”的Ascii码
Title　　30　　歌曲名
Artist　 30　　歌手名
Album　　30　　专辑名
Year　　 4 　　日期信息
Comment　28　　注释信息，有时为30字节
Reserved 1 　　＝0说明有音轨，下一字节就是音轨；≠0表示注释是30个字节
Track　　1 　　音轨（字节型数值），歌曲在专辑里的序号
Genre　　1 　　歌曲风格（字节型数值）
--------------------------------------------------------------------
说明：
　　* 如果MP3的注释＝30字节，那么就要占用 Reserved 和 Track 两个字节，这要看 Reserved 是否＝0，如果＝0，那么注释有 28 个字节。如果不是，那么注释有 30 个字节。当注释＝30 个字节的时候，那就没有 Track 了。
　　* 如果 MP3 文件后面虽然有“TAG”三个字母，但字母后面全是0，那就不是一个合法的 ID3V1 信息，应该认为没有 ID3V1 信息。
　　* ID3V1 的各项信息都是顺序存放，没有任何标识将其分开，一般用 0补足规定的长度。否则将造成信息错误。
　　* 歌曲风格共 148 种，用编号表示
 */
const { GenreList } = require( "./constants/genre" );
const { readByteToUtf8 } = require( "./utf" );

// 标题的其实位置
const TITLE_OFFSET = 3;
// 歌手的起始位置
const ARTIST_OFFSET = 33;
// 专辑的起始位置
const ALBUM_OFFSET = 63;
// 年份的起始位置
const YEAR_OFFSET = 93;
// 注释的起始位置
const COMMENT_OFFSET = 97;
// 已知的音乐风格数目
const MAX_GENRE = 148;

/**
 * 是否存在 id3v1 数据
 * @param meta {Buffer}
 * @returns {boolean}
 */
const isExistId3v1 = ( meta ) => {
  const tagBuf = Buffer.from( "TAG" );
  const isExistTag = tagBuf.compare( meta, 0, 3 ) === 0;
  if ( !isExistTag ) {
    return false
  }
  // 存储的数据是否是有效的
  for ( let char of meta.slice( 3 ) ) {
    if ( char !== 0 ) {
      return true
    }
  }
  return false
};


/**
 *
 * @returns {Buffer}
 */
function newTagBuf() {
  const nMeta = Buffer.alloc( 128 );
  nMeta.write( "TAG" );
  nMeta.writeUInt8( 255, 127 );
  return nMeta
}

/**
 * 解析.mp3 的 id3v1 数据
 * @param buf {Buffer}
 * @returns {null|{artist: string, year: string, album: string, genre: string, comment: string, title: string, track: number}}
 */
function parse( buf ) {
  if ( !Buffer.isBuffer( buf ) ) {
    throw new Error( "I need a buffer params" )
  }
  const meta = buf.slice( buf.byteLength - 128 );
  if ( !isExistId3v1( meta ) ) {
    return null
  }

  const info = {
    title: readByteToUtf8( meta.slice( TITLE_OFFSET, TITLE_OFFSET + 30 ) ),
    artist: readByteToUtf8( meta.slice( ARTIST_OFFSET, ARTIST_OFFSET + 30 ) ),
    album: readByteToUtf8( meta.slice( ALBUM_OFFSET, ALBUM_OFFSET + 30 ) ),
    year: readByteToUtf8( meta.slice( YEAR_OFFSET, YEAR_OFFSET + 4 ) ),
    comment: "",
    track: 0,
    genre: "unknown"
  };
  // 是否有音轨
  if ( meta[ 125 ] === 0 ) {
    info.comment = readByteToUtf8( meta.slice( COMMENT_OFFSET, 125 ) );
    info.track = meta[ 126 ];
  } else {
    info.comment = readByteToUtf8( meta.slice( COMMENT_OFFSET, 127 ) );
  }
  const genreNumber = meta[ 127 ];
  if ( genreNumber > MAX_GENRE ) {
    info.genre = "unknown";
    return info;
  }
  info.genre = GenreList[ genreNumber ];
  return info
}


/**
 *  从 buf 某个位置写入指定长度的数据
 * @param buf {Buffer}
 * @param data {String}
 * @param size {Number}
 * @param offset {Number}
 * @returns {Buffer}
 */
function write( buf, data, size, offset ) {
  const meta = buf.slice( buf.byteLength - 128 );
  const m = Buffer.alloc( size );
  m.write( data, 0, size );
  if ( !isExistId3v1( meta ) ) {
    const nMeta = newTagBuf();
    nMeta.write( m.toString(), offset, size + offset );
    return Buffer.concat( [ buf, nMeta ], buf.byteLength + 128 );
  }
  meta.write( m.toString(), offset, size + offset );
  // 因为 Buffer 的 slice 返回的 Buffer 和原来的 Buffer 指向的内存位置是相同的,只是 start 和 end 不同
  return buf
}


/**
 *  从 buf 某个位置写入指定长度的数据
 * @param buf {Buffer}
 * @param data {String}
 * @param size {Number}
 * @param offset {Number}
 * @description 内部没有判断是否存在 Id3v1 数据
 * @returns {Buffer}
 */
function write2( buf, data, size, offset ) {
  const meta = buf.slice( buf.byteLength - 128 );
  const m = Buffer.alloc( size );
  m.write( data, 0, size );
  meta.write( m.toString(), offset, size + offset );
  return buf
}


/**
 * 检查参数
 * @param buf {Buffer}
 * @param data {String|Number|object}
 * @param type {String}
 */
function checkParams( buf, data, type = 'string' ) {
  if ( !Buffer.isBuffer( buf ) ) {
    throw  new Error( `I need a buffer value` )
  }
  if ( typeof data !== type ) {
    throw  new Error( `I need a ${ type } value` )
  }
}

/**
 * 写 title
 * @param buf {Buffer}
 * @param data {String}
 * @returns {Buffer}
 */
function writeTitle( buf, data ) {
  checkParams( buf, data, 'string' );
  return write( buf, data, 30, TITLE_OFFSET )
}


/**
 * 写 歌手
 * @param buf {Buffer}
 * @param data {String}
 * @returns {Buffer}
 */
function writeArtist( buf, data ) {
  checkParams( buf, data, 'string' );
  return write( buf, data, 30, ARTIST_OFFSET )
}

/**
 * 写 专辑
 * @param buf {Buffer}
 * @param data {String}
 * @returns {Buffer}
 */
function writeAlbum( buf, data ) {
  checkParams( buf, data, 'string' );
  return write( buf, data, 30, ALBUM_OFFSET )
}

/**
 * 写 年份
 * @param buf {Buffer}
 * @param data {String}
 * @returns {Buffer}
 */
function writeYear( buf, data ) {
  checkParams( buf, data, 'string' );
  return write( buf, data, 4, YEAR_OFFSET )
}


/**
 * 写 注释信息
 * @param buf {Buffer}
 * @param data {String}
 * @description 注释有 30 字节也有 28 字节的会根据内存判断, 如果长度大于 28,就是 30,超出 30 截断,\n 虽然注释会影响到第 125 和 126 字节, 但是如果是由 30 字节改到 28 字节, 那两个字节也是无用的,所以可以等\n track 的写时在修改
 * @returns {Buffer}
 */
function writeComment( buf, data ) {
  checkParams( buf, data, 'string' );
  const meta = buf.slice( buf.byteLength - 128 );
  const size = Buffer.from( data ).byteLength > 28 ? 30 : 28;
  const m = Buffer.alloc( size );
  m.write( data, 0 );
  if ( !isExistId3v1( meta ) ) {
    const nMeta = newTagBuf();
    nMeta.write( m.toString(), COMMENT_OFFSET, size + COMMENT_OFFSET );
    return Buffer.concat( [ buf, nMeta ], buf.byteLength + 128 );
  }
  meta.write( m.toString(), COMMENT_OFFSET, size + COMMENT_OFFSET );
  return buf
}

/**
 * 写 位于专辑的第几曲
 * @param buf {Buffer}
 * @param data {Number}
 * @returns {Buffer}
 */
function writeTrack( buf, data ) {
  checkParams( buf, data, 'number' );
  const len = buf.length;
  buf.writeUInt8( 0, len - 3 );
  buf.writeUInt8( data, len - 2 );
  return buf;
}

/**
 * 写 歌曲风格
 * @param buf {Buffer}
 * @param data {Number}
 * @returns {Buffer}
 */
function writeGenre( buf, data ) {
  checkParams( buf, data, 'number' );
  const len = buf.length;
  buf.writeUInt8( data, len - 1 );
  return buf;
}


/**
 * 写 同时写几个部分
 * @param buf {Buffer}
 * @param data {{title:String, artist:String,album:String,year:String,comment:String,track:Number,genre:String|Number}}
 * @returns {*}
 */
function writeByWhole( buf, data ) {
  checkParams( buf, data, 'object' );
  let len = buf.byteLength;
  if ( !isExistId3v1( buf.slice( len - 128 ) ) ) {
    const data = newTagBuf();
    buf = Buffer.concat( [ buf, data ], len + 128 );
    len += 128;
  }
  if ( data.title ) {
    write2( buf, data.title, 30, TITLE_OFFSET );
  }
  if ( data.artist ) {
    write2( buf, data.artist, 30, ARTIST_OFFSET );
  }
  if ( data.album ) {
    write2( buf, data.album, 30, ALBUM_OFFSET );
  }
  if ( data.year ) {
    write2( buf, data.year, 4, YEAR_OFFSET );
  }
  if ( data.genre ) {
    if ( typeof data.genre === "number" ) {
      buf.writeUInt8( data.genre, len - 1 );
    } else {
      const index = GenreList.findIndex( v => v === data.genre );
      buf.writeUInt8( index === -1 ? 255 : index, len - 1 );
    }
  }
  if ( data.comment ) {
    // 这里这个函数内部还会判断是否有 idv3 信息,有些多余了,
    writeComment( buf, data.comment );
  }
  if ( data.track ) {
    buf.writeUInt8( 0, len - 3 );
    buf.writeUInt8( data.track, len - 2 );
  }
  return buf
}

const ID3V1 = {
  parse,
  writeAlbum,
  writeArtist,
  writeTitle,
  writeComment,
  writeYear,
  writeGenre,
  writeTrack,
  writeByWhole,
};

export default ID3V1;
export { ID3V1 };

