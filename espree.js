
var fs = require('fs')
  , path = require('path');

var espree = {
	// espree: espree
	fileNames: {},
	result:    '',
	
	process: function( fileName, env, fromFile ) {
		fileName = path.resolve(
			fromFile ? path.dirname(fromFile) : process.cwd(),
			fileName
		);
		
		var file = fs.readFileSync(fileName, 'utf8')
		  , regex = /(?:(\/\*@[\s\S]+?\*\/)|^)([\s\S]*?)(?=\/\*@|$)/gi
		  , js = '', match;
		
		// Add file name to list of processed files. Paths are relative to cwd.
		// espree.fileNames.push(path.relative(process.cwd(), fileName));
		var normalized = path.relative(process.cwd(), fileName);
		if( normalized in espree.fileNames ) {
			throw Error('Already included '+normalized);
		}
		espree.fileNames[normalized] = true;
		
		// Transform code; all normal JavaScript code becomes print('code'), all
		// the preprocess statements become normal JavaScript.
		while( match = regex.exec(file) ) {
			match = match.slice(1);
			if( match[0] ) {
				js += match[0].replace(/\/\*@\s*(.*?)\s*\*\//, '$1\n');
			}
			if( match[1] ) {
				js += 'print(\'' +
					    match[1].replace(/\\/g, '\\\\')
					            .replace(/'/g, '\\\'')
					            .replace(/\n/g, '\\n') +
					            // .replace(/(['\n])/g, '\\$1') +
					    '\');\n';
			}
		}
		
		// Execute transformed JavaScript. Two functions (include and print) are
		// passed as arguments, providing the preprocess statements with essential
		// functionality.
		var result = '';
		Function(
			'include, print',
			espree._parseEnv(env)+js
		)(
			function(newFile) { result += espree.process(newFile, env, fileName) },
			function(txt) {     result += txt }
		);
		
		if( !fromFile ) {
			espree.result += result;
		}
		return result;
	},
	reset: function() {
		var result = espree.result;
		espree.fileNames = {};
		espree.result = '';
		return result;
	},
	
	_parseEnv: function( env ) {
		if( !env ) {
			return '';
		}
		
		var result = '';
		for( var name in env ) {
			result += 'var '+name+' = '+JSON.stringify(env[name])+';\n';
		}
		return result;
	}
};
module.exports = espree.espree = espree;