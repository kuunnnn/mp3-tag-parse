import { ID3V1 } from "../lib/id3v1.mjs";
import { resolve } from 'path'
import fse from 'fs-extra'
import result_read from './result/id3v1-read.mjs'
import id3v1EmptyTag from './result/id3v1-empty.mjs'
import id3v1Write_template from './result/id3v1-writre-whole-template.mjs'

const readId3v1TagFileUrl = resolve( process.cwd(), "./test/v1tag-read.mp3" );
const writeId3v1TagFileUrl = resolve( process.cwd(), "./test/v1tag-write.mp3" );
const buffer_read = fse.readFileSync( readId3v1TagFileUrl );

describe( "ID3V1", () => {
  test( "parse", () => {
    expect( ID3V1.parse( buffer_read ) ).toEqual( result_read )
  } );
  test( 'parse-not-tag', () => {
    expect( ID3V1.parse( Buffer.alloc( 200 ) ) ).toEqual( null )
  } );
  test( 'parse-empty-tag', () => {
    const buf = Buffer.alloc(128);
    buf.write("TAG");
    expect( ID3V1.parse( buf )).toEqual( null )
  } );
  test( 'parse-not-buffer-params', () => {
    const wrapper = () => ID3V1.parse(30);
    expect( wrapper ).toThrow( "I need a buffer params" )
  } );
  test( 'write-not-tag', () => {
    const tag = ID3V1.parse( ID3V1.writeTitle( Buffer.alloc( 200 ), 'testTitle' ) );
    expect( tag ).toEqual( { ...id3v1EmptyTag, title: "testTitle" } )
  } );
  test( 'write-title', () => {
    const buffer_write = fse.readFileSync( writeId3v1TagFileUrl );
    const tag = ID3V1.parse( ID3V1.writeTitle( buffer_write, 'testTitle' ) );
    expect( tag ).toEqual( { ...result_read, title: "testTitle" } )
  } );
  test( 'write-title-error-params', () => {
    const buffer_write = fse.readFileSync( writeId3v1TagFileUrl );
    const wrapper = () => ID3V1.writeTitle(30,"34");
    const wrapper2 = () => ID3V1.writeTitle(buffer_write,34);
    expect( wrapper ).toThrow( "I need a buffer value" );
    expect( wrapper2 ).toThrow( "I need a string value" );
  } );
  test( 'write-artist', () => {
    const buffer_write = fse.readFileSync( writeId3v1TagFileUrl );
    const tag = ID3V1.parse( ID3V1.writeArtist( buffer_write, 'testArtist' ) );
    expect( tag ).toEqual( { ...result_read, artist: "testArtist" } )
  } );
  test( 'write-album', () => {
    const buffer_write = fse.readFileSync( writeId3v1TagFileUrl );
    const tag = ID3V1.parse( ID3V1.writeAlbum( buffer_write, 'testAlbum' ) );
    expect( tag ).toEqual( { ...result_read, album: "testAlbum" } )
  } );
  test( 'write-year', () => {
    const buffer_write = fse.readFileSync( writeId3v1TagFileUrl );
    const tag = ID3V1.parse( ID3V1.writeYear( buffer_write, '2019' ) );
    expect( tag ).toEqual( { ...result_read, year: "2019" } )
  } );
  test( 'write-comment-not-30bytes', () => {
    const buffer_write = fse.readFileSync( writeId3v1TagFileUrl );
    const tag = ID3V1.parse( ID3V1.writeComment( buffer_write, 'testComment30' ) );
    expect( tag ).toEqual( { ...result_read, comment: "testComment30" } );
  } );
  test( 'write-comment-30-30bytes', () => {
    let buffer_write = fse.readFileSync( writeId3v1TagFileUrl );
    const str = "ALBUM1234567890123456789012345";
    buffer_write = ID3V1.writeComment( buffer_write, str );
    const tag = ID3V1.parse( buffer_write );
    expect( tag ).toEqual( { ...result_read, comment: str, track: 0 } );
    expect( buffer_write[ buffer_write.length - 3 ] ).not.toBe( 0 )
  } );
  test( 'write-comment-30-30bytes-not-tag', () => {
    let buffer_write = Buffer.alloc( 200 );
    const str = "ALBUM1234567890123456789012345";
    buffer_write = ID3V1.writeComment( buffer_write, str );
    const tag = ID3V1.parse( buffer_write );
    expect( tag ).toEqual( { ...id3v1EmptyTag, comment: str } );
    expect( buffer_write[ buffer_write.length - 3 ] ).not.toBe( 0 )
  } );
  test( 'write-track', () => {
    let buffer_write = fse.readFileSync( writeId3v1TagFileUrl );
    buffer_write = ID3V1.writeTrack( buffer_write, 3 );
    const tag = ID3V1.parse( buffer_write );
    expect( tag ).toEqual( { ...result_read, track: 3 } );
    expect( buffer_write[ buffer_write.length - 3 ] ).toBe( 0 )
  } );
  test( 'write-genre', () => {
    const buffer_write = fse.readFileSync( writeId3v1TagFileUrl );
    const tag = ID3V1.parse( ID3V1.writeGenre( buffer_write, 3 ) );
    expect( tag ).toEqual( { ...result_read, genre: "Dance" } );
  } );
  test( 'write-whole', () => {
    const buffer_write = fse.readFileSync( writeId3v1TagFileUrl );
    const tag = ID3V1.parse( ID3V1.writeByWhole( buffer_write, id3v1Write_template ) );
    expect( tag ).toEqual( id3v1Write_template );
  } );
  test( 'write-whole-not-tag', () => {
    const buffer_write = Buffer.alloc( 200 );
    const tag = ID3V1.parse( ID3V1.writeByWhole( buffer_write, id3v1Write_template ) );
    expect( tag ).toEqual( id3v1Write_template );
  } );
  test( 'write-whole-not-tag-genre-number', () => {
    const buffer_write = Buffer.alloc( 200 );
    const tag = ID3V1.parse( ID3V1.writeByWhole( buffer_write, {
      ...id3v1Write_template,
      genre: 13,
    } ) );
    expect( tag ).toEqual( id3v1Write_template );
  } );
} );
