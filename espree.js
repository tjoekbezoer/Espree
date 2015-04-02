
var fs   = require('fs')
  , path = require('path')
  , glob = require('glob');

var espree = {
	result:     '',
	_fileNames: {},
	_globals: {},
	
	addGlobal: function( name, value ) {
		var obj = name;
		obj instanceof Object || ((obj = {})[name] = value);
		
		for( name in obj ) {
			value = obj[name];
			switch( name ) {
				case 'vars':
				case 'include':
				case 'print':
					throw new Error('Cannot add reserved global: '+name);
			}
			this._globals[name] = value;
		}
	},
	fileNames: function() {
		return Object.keys(espree._fileNames);
	},
	process: function( fileName, vars, fileExt ) {
		// Recursively retrieve preprocessed code.
		var result = espree._include(fileName, vars, fileExt);
		espree.result += result;
		return result;
	},
	reset: function( hard ) {
		var result = espree.result;
		espree.result = '';
		espree._fileNames = {};
		if( hard ) {
			espree._globals = {};
		}
		return result;
	},
	
	// Get file data, parse and execute. Is used recursively via `_executeCode`
	// where parameter `fromFile` will be empty only on the initial call.
	_include: function( pattern, vars, fileExt, fromFile, options ) {
		var cwd     = fromFile ? path.dirname(fromFile) : process.cwd()
		  , matches = glob.sync(pattern, {cwd: cwd})
		  , result  = '';
		
		matches.forEach(function( match ) {
			var fileName = path.resolve(cwd, match);
			
			fileExt || (fileExt = path.extname(fileName).substr(1));
			options || (options = {});
			
			// Depending on the filetype, the preprocess comment format can differ.
			var code = this._parseCode(fileName, fileExt, options);
			if( code.length ) {
				this._testForCircularLoop(fileName);
				result += this._executeCode(fileName, fileExt, vars, code);
			}
		}, this);
		
		return result;
	},
	// Transform code; all normal code becomes print('code'), all
	// preprocess statements become normal JavaScript.
	_parseCode: function( fileName, fileExt, options ) {
		var regex = this._getRegexesForFileType(fileExt)
		  , code = '', data, match, statement;
		
		try {
			data = fs.readFileSync(fileName, 'utf8');
			while( match = regex.search.exec(data) ) {
				if( match[1] ) {
					statement = match[1].replace(regex.replace, '$1');
					code += match[2] ?
					        'print('+statement+')\n' :
					        statement+'\n';
				}
				if( match[3] ) {
					code += 'print(\'' +
						    match[3].replace(/(\\|')/g, '\\$1')
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
	_executeCode: function( fileName, fileExt, vars, code ) {
		var result = '';
		// Create parameter names and values using the user-defined globals.
		var params = Object.keys(this._globals);
		var values = params.map(function( key ) {
			return this._globals[key];
		}, this);
		// Add the reserved globals (needs to be done here since they depend on
		// variables from within this function call).
		Function(
			params.concat('vars', 'include', 'print').join(','),
			code
		).apply(null, values.concat(vars, include, print));
		
		function include( pattern, silent ) {
			result += espree._include(pattern, vars, fileExt, fileName, {
				silent: !!silent
			});
		}
		function print(txt) {
			result += txt;
		}
		
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
					search:  /(?:(\/\*@(=?)[\s\S]+?\*\/)|^)([\s\S]*?)(?=\/\*@|$)/gi,
					replace: /\/\*@=?\s*([\s\S]*?)\s*\*\//
				};
			case 'html':
			case 'php':
			default:
				// <!--@ preprocess statement -->
				return {
					search:  /(?:(<\!--@(=?)[\s\S]+?-->)|^)([\s\S]*?)(?=<\!--@|$)/gi,
					replace: /<\!--@=?\s*([\s\S]*?)\s*-->/
				};
		}
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