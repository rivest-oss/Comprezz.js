"use strict";

class ComprezzEncoder {
	constructor() {};
	
	_buildCount(buff) {
		let dict = [];
		for(let i = 0; i < 0x100; i++)
			dict.push(i);
		
		const ret = Buffer.alloc(buff.length);
		
		for(let i = 0, c = 0x00, j = 0; i < buff.length; i++) {
			c = buff.readUInt8(i);
			j = dict.indexOf(c);
			
			ret[i] = j;
			
			dict.splice(j, 1);
			dict.unshift(c);
		};
		
		return ret;
	};
	
	// `encode` expects a Buffer.
	encode(data) {
		return new Promise((resolve, reject) => {
			if(Buffer.isBuffer(data) !== true)
				return reject("`encode` expected a Buffer");
			
			const count = this._buildCount(data);
			
			// [TODO]
		});
	};
};

class ComprezzDecoder {
	constructor() {};
	
	_buildInvCount(buff, reject) {
		let dict = [];
		for(let i = 0; i < 0x100; i++)
			dict.push(i);
		
		const ret = Buffer.alloc(buff.length);
		
		for(let i = 0, c = 0x00, j = 0; i < buff.length; i++) {
			j = buff.readUInt8(i);
			
			c = dict[j];
			ret[i] = c;
			
			dict.splice(j, 1);
			dict.unshift(c);
		};
		
		return ret;
	};
	
	// `decode` expects a Buffer, and maybe a number.
	decode(data, sizeLimit = false) {
		// [TODO]
	};
};

module.exports = { Encoder: ComprezzEncoder, Decoder: ComprezzDecoder };
