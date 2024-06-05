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
	
	_encodeUInt(num) {
		const buff = Buffer.alloc(10);
		let i;
		
		for(i = 0; i < 10; i++) {
			buff[i] = ((num & 0x7f) | 0x80);
			num >>= 7;
			
			if(num <= 0) {
				buff[i] &= 0x7f;
				break;
			}
		};
		
		return buff.slice(0, i);
	};
	
	_encodeRLE(buff) {
		const ret = Buffer.alloc((buff.length << 2) + buff.length);
		
		let	si = 0, sc0 = 0x00, sc1 = 0x00,
			repNo = 0, repBuff,
			di = 0;
		
		for(; si < buff.length;) {
			sc0 = buff.readUInt8(si);
			
			for(repNo = 0; si < buff.length; si++) {
				sc1 = buff.readUInt8(si);
				if(sc0 !== sc1) break;
			};
			
			ret.writeUInt8(sc0, di); di++;
			repBuff = this._encodeUInt(repNo);
			di += repBuff.copy(ret, di);
		};
		
		return ret.slice(0, di);
	};
	
	_lzssFindMatch(buff, buffI, dict, dictOffI) {
		let len = 0, i = buffI, j = dictOffI;
		
		while((i < buff.length) && (len < 0x1000)) {
			if(buff.readUInt8(i) !== dict.readUInt8(j)) break;
			
			i++;
			j = ((j + 1) & 0xfff);
		};
		
		return {
			offset: dictOffI,
			length: len,
			match: buff.slice(buffI, buffI + len),
		};
	};
	
	_encodeLZSS(buff) {
		const ret = Buffer.alloc((buff.length << 2) + buff.length);
		const dict = Buffer.alloc(0x1000);
		
		// The first eight bit are used to determinate if the next eight
		// symbols are:
		// (0) a byte literal,
		// (1) a reference.
		// 
		// References are 24-bit (three bytes) long:
		// * 12 MSb is used for reference offset.
		// * 12 LSb is used for reference length.
		
		const preBuff = new Buffer.alloc(1), refBuff = Buffer.alloc(3);
		let	buffI = 0, retI = 0, oldRetI = 0,
			refBitI = 0, shouldRef = false,
			oldMatch = false, curMatch = false,
			dictI = 0;
		
		while(buffI < buff.length) {
			oldRetI = retI; retI++;
			preBuff[0] = 0x00;
			
			for(refBitI = 0; refBitI < 8; refBitI++) {
				for(dictI = 0; dictI < 0x1000; dictI++) {
					curMatch = this._lzssFindMatch(buff, buffI, dict, dictI);
					
					if(oldMatch === false) {
						oldMatch = curMatch;
						continue;
					}
					
					if(oldMatch.length < curMatch.length)
						oldMatch = curMatch;
				};
				
				if(oldMatch.length > 3) {
					shouldRef = true;
					
					refBuff[0] = (oldMatch.offset >> 4);
					refBuff[1] = (oldMatch.offset << 4);
					refBuff[1] |= (oldMatch.length >> 8);
					refBuff[2] = (oldMatch.offset >> 4);
					
					retI += refBuff.copy(ret, retI);
					buffI += refBuff.length;
				} else {
					shouldRef = false;
					ret.writeUInt8(buff[buffI], retI);
					retI++;
					buffI++;
				}
				
				preBuff[0] = ((preBuff[0] << 1) | shouldRef);
			};
			
			ret.writeUInt8(preBuff[0], oldRetI);
		};
		
		return ret.slice(0, retI);
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
