const {
  readBytesToUtf16BE,
  readBytesToUtf16LE,
  readBytesToISO88591,
  readBytesToUtf8,
} = require( "../lib/encoding" );

describe( "encode-read-prefix", () => {
  test( 'utf8', () => {
    const str1 = Buffer.from( "23423849fsdjlfksdjlfjds/'[]-=()", 'utf8' );
    expect( readBytesToUtf8( str1.toJSON().data ) ).toEqual( str1.toString() );
    const str2 = Buffer.from( "UTF-16也是一种变长编码，对于一个Unicode字符被编码成1至2个码元，每个码元为16位。", 'utf8' );
    expect( readBytesToUtf8( str2.toJSON().data ) ).toEqual( str2.toString() );
  } );
  test( 'utf16le', () => {
    const str1 = Buffer.from( "23423849fsdjlfksdjlfjds/'[]-=()", 'utf16le' );
    expect( readBytesToUtf16LE( str1.toJSON().data ) ).toEqual( str1.toString( 'utf16le' ) );
    const str2 = Buffer.from( "UTF-16也是一种变长编码，对于一个Unicode字符被编码成1至2个码元，每个码元为16位。", 'utf16le' );
    expect( readBytesToUtf16LE( str2.toJSON().data ) ).toEqual( str2.toString( 'utf16le' ) );
  } );
  test( 'utf16be', () => {
    const b1 = [ 0x00, 0x41, 0x78, 0x34, 0x66, 0x53 ];
    expect( readBytesToUtf16BE( b1, 0, b1.length ) ).toEqual( "A破晓" );
    expect( readBytesToUtf16BE( b1, 0 ) ).toEqual( "A破晓" );
    expect( readBytesToUtf16BE( b1 ) ).toEqual( "A破晓" );
  } );
} );

