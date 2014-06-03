
var fs = require('fs')
  , path = require('path');

var espree = {
	result:     '',
	_fileNames: {},
	
	fileNames: function() {
		return Object.keys(espree._fileNames);
	},
	process: function( fileName, env, fileExt ) {
		// Recursively retrieve preprocessed code.
		var result = espree._include(fileName, env, fileExt);
		espree.result += result;
		return result;
	},
	reset: function() {
		var result = espree.result;
		espree._fileNames = {};
		espree.result = '';
		return result;
	},
	
	// Get file data, parse and execute. Is used recursively via `_executeCode`
	// where parameter `fromFile` will be empty only on the initial call.
	_include: function( fileName, env, fileExt, fromFile, options ) {
		fileName = path.resolve(
			fromFile ? path.dirname(fromFile) : process.cwd(),
			fileName
		);
		fileExt || (fileExt = path.extname(fileName).substr(1));
		options || (options = {});
		
		// Depending on the filetype, the preprocess comment format can differ.
		var code = this._parseCode(fileName, fileExt, options);
		
		if( code.length ) {
			this._testForCircularLoop(fileName);
			return this._executeCode(fileName, fileExt, env, code);
		} else {
			return '';
		}
	},
	// Transform code; all normal JavaScript code becomes print('code'), all
	// preprocess statements become normal JavaScript.
	_parseCode: function( fileName, fileExt, options ) {
		var regex = this._getRegexesForFileType(fileExt)
		  , data, match, code = '';
		
		try {
			data = fs.readFileSync(fileName, 'utf8');
			while( match = regex.search.exec(data) ) {
				match = match.slice(1);
				if( match[0] ) {
					code += match[0].replace(regex.replace, '$1\n');
				}
				if( match[1] ) {
					code += 'print(\'' +
						    match[1].replace(/(\\|')/g, '\\$1')
						            .replace(/\r\n|\n|\r/g, '\\n') +
						    '\');\n';
				}
			}
		} catch( e ) {
			if( !options.silent ) throw e;
		}
		
		return code;
	},
	// Execute transformed JavaScript. Two functions (include and print) are
	// passed as arguments, providing the preprocess statements with essential
	// functionality. The environment variables are parsed and prepended to the
	// to-run code as variables in the function's scope. See `_parseEnv`.
	_executeCode: function( fileName, fileExt, env, code ) {
		var result = '';
		Function(
			'require', 'include', 'print',
			'var _ = require("underscore");\n'+
			espree._parseEnv(env)+
			code
		)(
			require,
			function (newFile, silent) {
				result += espree._include(newFile, env, fileExt, fileName, {
					silent: !!silent
				});
			},
			function (txt) {
				result += txt;
			}
		);
		return result;
	},
	
	// PHP files that need preprocessing are thought of as HTML files with some PHP
	// sugar on top, instead of business logic with some HTML as output. The latter
	// type of file should not be preprocessed in my opinion.
	_getRegexesForFileType: function( fileExt ) {
		switch( fileExt ) {
			case 'js':
			case 'css':
				// /*@ preprocess statement */
				return {
					search:  /(?:(\/\*@[\s\S]+?\*\/)|^)([\s\S]*?)(?=\/\*@|$)/gi,
					replace: /\/\*@\s*([\s\S]*?)\s*\*\//
				};
			case 'html':
			case 'php':
			default:
				// <!--@ preprocess statement -->
				return {
					search:  /(?:(<\!--@[\s\S]+?-->)|^)([\s\S]*?)(?=<\!--@|$)/gi,
					replace: /<\!--@\s*([\s\S]*?)\s*-->/
				};
		}
	},
	// Turn a JSON object into a string of JavaScript code with variable declarations,
	// where the variable name is the object key, and its value is the object's value
	// under that key.
	// 
	// For example this object:
	//   var env = {"foo": "bar", "test": true};
	// becomes:
	//   var foo = "bar";
	//   var test = true;
	_parseEnv: function( env ) {
		var result = '';
		if( !env ) {
			return result;
		}
		for( var name in env ) {
			result += 'var '+name+' = '+JSON.stringify(env[name])+';\n';
		}
		return result;
	},
	// Add file name to list of processed files. Paths are relative to cwd.
	// If file is already processed before, throw an error to prevent an endless
	// loop.
	_testForCircularLoop: function( fileName ) {
		var normalized = path.relative(process.cwd(), fileName)
		if( normalized in espree._fileNames ) {
			throw Error('Already included '+normalized);
		}
		espree._fileNames[normalized] = true;
	}
};
module.exports = espree.espree = espree;