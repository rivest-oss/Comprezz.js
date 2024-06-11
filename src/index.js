"use strict";

function comprezzGenLZSSDict() {
	const dict = Buffer.alloc(0x1000);
	let j = 0;
	
	for(let i = 0; i < 0x100; i++)
		dict.writeUInt8(i, j + i);
	
	j += 0x100;
	for(let i = 0; i < 0x100; i++)
		dict.writeUInt8(0xff - i, j + i);
	
	j += 0x100;
	for(let i = 0; i < 0x400; i++)
		dict.writeUInt8(0x00, j + i);
	
	j += 0x400;
	for(let i = 0; i < 0x400; i++)
		dict.writeUInt8(0xff, j + i);
	
	j += 0x400;
	for(let i = 0; i < 0x400; i++)
		dict.writeUInt8(0x01, j + i);
	
	return dict;
};

class ComprezzEncoder {
	constructor() {};
	
	_encodeMTF(buff, reject) {
		const dict = [];
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
	
	_encodeBWT(buff, reject) {
		// [TODO]
	};
	
	_encodeUInt(num) {
		const buff = Buffer.alloc(10);
		let i;
		
		for(i = 0; i < 10; i++) {
			buff[i] = ((num & 0x7f) | 0x80);
			num >>= 7;
			
			if(num === 0) {
				buff[i] &= 0x7f;
				break;
			}
		};
		
		return buff.slice(0, i + 1);
	};
	
	_getLengthRLE(buff, reject) {
		let	buffI = 0, retBuffI = 0,
			prefixBit = 0,
			c = 0x00, repN = 0, repBuff = false;
		
		while(buffI < buff.length) {
			retBuffI++;
			
			for(prefixBit = 0; prefixBit < 8; prefixBit++) {
				if(buffI >= buff.length) break;
				
				c = buff.readUInt8(buffI);
				retBuffI++;
				
				repN = 0;
				
				while((buffI + repN) < buff.length) {
					if(c !== buff.readUInt8(buffI + repN)) break;
					repN++;
				};
				
				if(repN > 1) {
					repBuff = this._encodeUInt(repN);
					retBuffI += repBuff.length;
				}
				
				buffI += repN;
			};
		};
		
		return retBuffI;
	};
	
	_encodeRLE(buff, reject) {
		const retBuffLen = this._getLengthRLE(buff, reject);
		if(retBuffLen === -1) return -1;
		
		const retBuff = Buffer.alloc(retBuffLen);
		
		let	buffI = 0, retBuffI = 0, oldRetBuffI = 0,
			prefixByte = 0x00, prefixBit = 0,
			c = 0x00, repN = 0, repBuff = false;
		
		while(buffI < buff.length) {
			oldRetBuffI = (retBuffI | 0);
			retBuffI++;
			
			prefixByte = 0x00;
			
			for(prefixBit = 0; prefixBit < 8; prefixBit++) {
				if(buffI >= buff.length) break;
				
				c = buff.readUInt8(buffI);
				
				retBuff.writeUInt8(c, retBuffI);
				retBuffI++;
				
				repN = 0;
				
				while((buffI + repN) < buff.length) {
					if(c !== buff.readUInt8(buffI + repN)) break;
					repN++;
				};
				
				if(repN > 2) {
					repBuff = this._encodeUInt(repN);
					retBuffI += repBuff.copy(retBuff, retBuffI);
					
					prefixByte |= (0x80 >> prefixBit);
				}
				
				buffI += repN;
			};
			
			retBuff.writeUInt8(prefixByte, oldRetBuffI);
		};
		
		return retBuff;
	};
	
	_encodeDelta(buff, reject) {
		const retBuff = Buffer.alloc(buff.length);
		
		for(let i = 0, b0 = 0xa5, b1 = 0x00; i < buff.length; i++) {
			b1 = buff.readUInt8(i);
			retBuff.writeInt8(b1 - b0, i);
			b0 = b1;
		};
		
		return retBuff;
	};
	
	_lzssFindMatch(buff, buffI, dict, dictOffI) {
		let len = 0, i = 0, j = dictOffI;
		
		while(((buffI + i) < buff.length) && (len < 0xffff)) {
			if(buff.readUInt8(buffI + i) !== dict.readUInt8(j))
				break;
			
			len++;
			i++;
			j = ((j + 1) & 0xfff);
		};
		
		return {
			offset: dictOffI,
			length: len,
			match: buff.slice(buffI, buffI + len),
		};
	};
	
	_lzssFindBiggestMatch(buff, buffI, dict) {
		let topMatch = false, currMatch = false;
		
		for(let dictOff = 0; dictOff < 0x1000; dictOff++) {
			 currMatch = this._lzssFindMatch(buff, buffI, dict, dictOff);
			 
			 if(topMatch === false) {
			 	topMatch = currMatch;
			 	continue;
			 }
			 
			 if(currMatch.length > topMatch.length) topMatch = currMatch;
		};
		
		return topMatch;
	};
	
	_lzssPushToDict(dict, bytes) {
		if(Buffer.isBuffer(bytes)) {
			for(let i = 0; i < bytes.length; i++)
				this._lzssPushToDict(dict, bytes.readUInt8(i));
			
			return;
		}
		
		if(dict.dictI === undefined) dict.dictI = 0;
		
		dict.writeUInt8(bytes, dict.dictI);
		
		dict.dictI = ((dict.dictI + 1) & 0xfff);
	};
	
	_getLengthLZSS(buff, reject) {
		const dict = comprezzGenLZSSDict();
		
		let	buffI = 0, retBuffLen = 0,
			prefixBit = 0, isRef = false, match = false;
		
		while(buffI < buff.length) {
			retBuffLen++;
			
			for(prefixBit = 0; prefixBit < 8; prefixBit++) {
				if(buffI >= buff.length) break;
				
				match = this._lzssFindBiggestMatch(buff, buffI, dict);
				
				if(match.length > 3) {
					this._lzssPushToDict(dict, match.match);
					buffI += match.length;
					retBuffLen += 3;
				} else {
					this._lzssPushToDict(dict, buff.readUInt8(buffI));
					buffI++;
					retBuffLen++;
				}
			};
		};
		
		return retBuffLen;
	};
	
	_encodeLZSS(buff, reject) {
		const retBuffLen = this._getLengthLZSS(buff, reject);
		if(retBuffLen === -1) return -1;
		
		const dict = comprezzGenLZSSDict();
		const retBuff = Buffer.alloc(retBuffLen);
		
		let	buffI = 0, retBuffI = 0, oldRetBuffI = 0,
			prefixByte = 0x00, prefixBit = 0, isRef = false, match = false;
		
		while((buffI < buff.length) && (retBuffI < retBuffLen)) {
			prefixByte = 0x00;
			oldRetBuffI = (retBuffI | 0);
			retBuffI++;
			
			for(prefixBit = 0; prefixBit < 8; prefixBit++) {
				if(buffI >= buff.length) break;
				if(retBuffI >= retBuffLen) break;
				
				match = this._lzssFindBiggestMatch(buff, buffI, dict);
				isRef = (match.length > 3);
				
				if(isRef) {
					this._lzssPushToDict(dict, match.match);
					this.buffI += match.length;
					
					retBuff.writeUInt8(((match.offset >> 4) & 0xff), retBuffI);
					
					retBuff.writeUInt8(	(((match.offset << 4) |
										(match.length >> 8))) &
										0xff, retBuffI + 1);
					
					retBuff.writeUInt8(((match.length) & 0xff), retBuffI + 2);
					
					buffI += match.length;
					retBuffI += 3;
					prefixByte |= (0x80 >> prefixBit);
				} else {
					this._lzssPushToDict(dict, buff.readUInt8(buffI));
					retBuff.writeUInt8(buff.readUInt8(buffI), retBuffI);
					
					buffI++;
					retBuffI++;
				}
			};
			
			retBuff.writeUInt8(prefixByte, oldRetBuffI);
		};
		
		return retBuff;
	};
	
	// `encode` expects a Buffer.
	encode(data) {
		return new Promise((resolve, reject) => {
			if(Buffer.isBuffer(data) !== true)
				return reject("`encode` expected a Buffer");
			
			const mtf = this._encodeMTF(data, reject);
			if(mtf === -1) return -1;
			
			const bwt = this._encodeBWT(mtf, reject);
			if(bwt === -1) return -1;
			
			// [TODO]
		});
	};
};

class ComprezzDecoder {
	constructor() {};
	
	_decodeMTF(buff, reject) {
		const dict = [];
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
	
	_decodeBWT(buff, reject) {
		// [TODO]
	};
	
	_decodeUInt(buff, buffI, reject) {
		const no = new Uint32Array([ 0x00000000 ]);
		
		let i = 0, c = 0x00;
		for(; ((buffI + i) < buff.length); i++) {
			c = buff.readUInt8(buffI + i);
			
			no[0] <<= 7;
			no[0] |= (c & 0x7f);
			
			if(c & 0x80) continue;
			break;
		};
		
		return {
			bytes: (i + 1),
			number: no[0],
		};
	};
	
	_getLengthRLE(buff, reject) {
		let	buffI = 0, retBuffI = 0,
			prefixByte = 0x00, prefixBit = 0,
			c = 0x00, isRep = 0, rep = false, repN = 0;
		
		while(buffI < buff.length) {
			prefixByte = buff.readUInt8(buffI);
			buffI++;
			
			for(prefixBit = 0; prefixBit < 8; prefixBit++) {
				if(buffI >= buff.length) break;
				
				isRep = ((0x80 >> prefixBit) & prefixByte);
				
				c = buff.readUInt8(buffI);
				buffI++;
				
				if(isRep) {
					rep = this._decodeUInt(buff, buffI);
					
					for(repN = 0; repN < rep.number; repN++, retBuffI++);
					
					buffI += rep.bytes;
					
					continue;
				}
				
				retBuffI++;
			};
		};
		
		return retBuffI;
	};
	
	_decodeRLE(buff, reject) {
		const retBuffLen = this._getLengthRLE(buff, reject);
		if(retBuffLen === -1) return;
		
		const retBuff = Buffer.alloc(retBuffLen);
		
		let	buffI = 0, retBuffI = 0,
			prefixByte = 0x00, prefixBit = 0,
			c = 0x00, isRep = 0, rep = false, repN = 0;
		
		while((buffI < buff.length) && (retBuffI < retBuffLen)) {
			prefixByte = buff.readUInt8(buffI);
			buffI++;
			
			for(prefixBit = 0; prefixBit < 8; prefixBit++) {
				if(buffI >= buff.length) break;
				
				isRep = ((0x80 >> prefixBit) & prefixByte);
				
				c = buff.readUInt8(buffI);
				buffI++;
				
				if(isRep) {
					rep = this._decodeUInt(buff, buffI);
					
					for(repN = 0; repN < rep.number; repN++, retBuffI++)
						retBuff.writeUInt8(c, retBuffI);
					
					buffI += rep.bytes;
					
					continue;
				}
				
				retBuff.writeUInt8(c, retBuffI);
				retBuffI++;
			};
		};
		
		return retBuff;
	};
	
	_decodeDelta(buff, reject) {
		const retBuff = Buffer.alloc(buff.length);
		
		for(let i = 0, orig = 0xa5, delta = 0x00; i < buff.length; i++) {
			delta = buff.readInt8(i);
			retBuff.writeUInt8(orig + delta, i);
			orig = retBuff.readUint8(i);
		};
		
		return retBuff;
	};
	
	_getDictSliceLZSS(dict, off, len) {
		const retBuff = Buffer.alloc((len > 0x1000) ? 0x1000 : len);
		
		for(let i = 0; i < len; i++)
			retBuff.writeUInt8(dict.readUInt8((off + i) & 0xfff), i);
		
		return retBuff;
	};
	
	_getLengthLZSS(buff, reject) {
		let retBuffLen = 0;
		
		let	buffI = 0, prefixByte = 0x00, prefixI = 0,
			isRef = false, refLen = 0;
		
		while(buffI < buff.length) {
			prefixByte = buff.readUInt8(buffI);
			buffI++;
			
			for(prefixI = 0; prefixI < 8; prefixI++) {
				isRef = ((0x80 >> prefixI) & prefixByte);
				
				if(isRef) {
					refLen = 0;
					
					refLen = (buff.readUInt16BE(buffI + 1) & 0xfff);
					buffI += 3;
					
					retBuffLen += refLen;
					
					continue;
				}
				
				buffI++;
				retBuffLen++;
			};
		};
		
		return retBuffLen;
	};
	
	_decodeLZSS(buff, reject) {
		const retBuffLen = this._getLengthLZSS(buff, reject);
		if(retBuffLen === -1) return -1;
		
		const dict = comprezzGenLZSSDict();
		const retBuff = Buffer.alloc(retBuffLen);
		
		let	buffI = 0, retBuffI = 0, c = 0x00,
			prefixByte = 0x00, prefixI = 0,
			isRef = false, refWord = 0x0000, refOff = 0x000, refLen = 0x000,
			dictI = 0x000, dictJ = 0x000,
			dictSlice = false;
		
		while((buffI < buff.length) && (retBuffI < retBuffLen)) {
			prefixByte = buff.readUInt8(buffI);
			buffI++;
			
			for(prefixI = 0; prefixI < 8; prefixI++) {
				if(buffI >= buff.length) break;
				
				isRef = (prefixByte & (0x80 >> prefixI));
				
				if(isRef) {
					refOff = (buff.readUInt16BE(buffI) >> 4);
					refLen = (buff.readUInt16BE(buffI + 1) & 0xfff);
					
					buffI += 3;
					
					dictSlice = this._getDictSliceLZSS(dict, refOff, refLen);
					
					for(dictJ = 0x000; dictJ < refLen; dictJ++) {
						dict.writeUInt8(dictSlice.readUInt8(),
										(dictI + dictJ) & 0xfff);
					};
					
					dictI = ((dictI + refLen) & 0xfff);
					
					retBuffI += dictSlice.copy(retBuff, retBuffI);
					
					continue;
				}
				
				c = buff.readUInt8(buffI);
				buffI++;
				
				retBuff.writeUInt8(c, retBuffI);
				retBuffI++;
				
				dict.writeUInt8(c, dictI);
				dictI = ((dictI + 1) & 0xfff);
			};
		};
		
		return retBuff.slice(0, retBuffI);
	};
	
	// `decode` expects a Buffer, and maybe a number.
	decode(data, sizeLimit = false) {
		// [TODO]
	};
};

module.exports = { Encoder: ComprezzEncoder, Decoder: ComprezzDecoder };
