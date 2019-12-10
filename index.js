const id3v1 = require( './lib/id3v1' );
const id3v2 = require( './lib/id3v2.3' );
module.exports = { ...id3v1, ...id3v2 };
