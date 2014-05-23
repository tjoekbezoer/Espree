
var fs = require('fs')
  , path = require('path');

var espree = {
	result:     '',
	_fileNames: {},
	
	fileNames: function() {
		return Object.keys(espree._fileNames);
	},
	process: function( fileName, env, fileExt, fromFile ) {
		fileName = path.resolve(
			fromFile ? path.dirname(fromFile) : process.cwd(),
			fileName
		);
		fileExt || (fileExt = path.extname(fileName).substr(1));
		
		var file = fs.readFileSync(fileName, 'utf8')
		  , normalized = path.relative(process.cwd(), fileName)
		  // Depending on the filetype, the preprocess comment format can differ.
		  , regex = this._regExes(fileExt)
		  , js = '', match;
		
		// Add file name to list of processed files. Paths are relative to cwd.
		if( normalized in espree._fileNames ) {
			throw Error('Already included '+normalized);
		}
		espree._fileNames[normalized] = true;
		
		// Transform code; all normal JavaScript code becomes print('code'), all
		// the preprocess statements become normal JavaScript.
		while( match = regex.search.exec(file) ) {
			match = match.slice(1);
			if( match[0] ) {
				js += match[0].replace(regex.replace, '$1\n');
			}
			if( match[1] ) {
				js += 'print(\'' +
					    match[1].replace(/(\\|')/g, '\\$1')
					            .replace(/\r\n|\n|\r/g, '\\n') +
					    '\');\n';
			}
		}
		
		// Execute transformed JavaScript. Two functions (include and print) are
		// passed as arguments, providing the preprocess statements with essential
		// functionality.
		var result = '';
		Function(
			'include',
			'print',
			espree._parseEnv(env)+js
		)(
			function (newFile) { result += espree.process(newFile, env, fileExt, fileName) },
			function (txt)     { result += txt }
		);
		
		if( !fromFile ) {
			espree.result += result;
		}
		return result;
	},
	reset: function() {
		var result = espree.result;
		espree._fileNames = {};
		espree.result = '';
		return result;
	},
	
	_parseEnv: function( env ) {
		if( !env ) return '';
		
		var result = '';
		for( var name in env ) {
			result += 'var '+name+' = '+JSON.stringify(env[name])+';\n';
		}
		return result;
	},
	_regExes: function( fileExt ) {
		switch( fileExt ) {
			case 'js':
			case 'css':
				// /*@ preprocess statement */
				return {
					search:  /(?:(\/\*@[\s\S]+?\*\/)|^)([\s\S]*?)(?=\/\*@|$)/gi,
					replace: /\/\*@\s*(.*?)\s*\*\//
				};
			case 'html':
			case 'php':
			default:
				// <!--@ preprocess statement -->
				return {
					search:  /(?:(<\!--@[\s\S]+?-->)|^)([\s\S]*?)(?=<\!--@|$)/gi,
					replace: /<\!--@\s*(.*?)\s*-->/
				};
		}
	}
};
module.exports = espree.espree = espree;