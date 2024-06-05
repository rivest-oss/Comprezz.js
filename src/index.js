"use strict";

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
		const rotations = [];
		
		for(let i = 0; i < buff.length; i++)
			rotations.push(Buffer.concat([
				buff.slice(i),
				buff.slice(0, i),
			]));
		
		rotations.sort((x, y) => Buffer.compare(x, y));
		
		const rIndex = rotations.findIndex(x => x.equals(buff));
		const retBuff = Buffer.alloc(buff.length + 4);
		
		for(let i = 0; i < buff.length; i++)
			retBuff.writeUInt8(rotations[i].readUInt8(buff.length - 1), i);
		
		retBuff.writeUInt32BE(rIndex, buff.length);
		
		return retBuff;
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
	
	_encodeRLE(buff, reject) {
		const ret = Buffer.alloc((buff.length << 2) + buff.length);
		
		let	si = 0, sc0 = 0x00, sc1 = 0x00,
			repNo = 0, repBuff,
			di = 0;
		
		for(; si < buff.length;) {
			sc0 = buff.readUInt8(si);
			
			for(repNo = 0; si < buff.length; si++, repNo++) {
				sc1 = buff.readUInt8(si);
				if(sc0 !== sc1) break;
			};
			
			ret.writeUInt8(sc0, di); di++;
			repBuff = this._encodeUInt(repNo - 1);
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
	
	_lzssFindBiggestMatch(buff, buffI, dict) {
		let topMatch = false, currMatch = false;
		
		for(let dictOff = 0; dictOff < 0x1000; dictOff++) {
			 currMatch = this._lzssFindMatch(buff, buffI, dict, dictOff);
			 
			 if(topMatch === false) {
			 	topMatch = currMatch;
			 	break;
			 }
			 
			 if(currMatch.length > topMatch.length) topMatch = currMatch;
		};
		
		return topMatch;
	};
	
	_encodeLZSS(buff, reject) {
		const	retBuff = Buffer.alloc(buff.length << 2),
				dict = Buffer.alloc(0x1000),
				refBuff = Buffer.alloc(3);
		
		let	buffI = 0, retBuffI = 0,
			prefixByte = 0x00, prefixI = 0, oldBuffI = 0,
			dictI = 0x000, match = false, isRef = false;
		
		while(buffI < buff.length) {
			prefixByte = 0x00;
			
			oldBuffI = buffI;
			buffI++;
			
			for(prefixI = 0; prefixI < 8; prefixI++) {
				if(buffI >= buff.length) break;
				
				match = this._lzssFindBiggestMatch(buff, buffI, dict);
				
				if(match.length > 3) {
					prefixByte |= (0x80 >> prefixI);
					
					retBuff.writeUInt8(match.offset >> 4, retBuffI);
					retBuffI++;
					
					retBuff.writeUInt8(	((match.offset << 4) |
										(match.length >> 8)),
										retBuffI);
					retBuffI++;
					
					retBuff.writeUInt8(match.length, retBuffI);
					retBuffI++;
					
					buffI += match.length;
				} else {
					dict.writeUInt8(buff.readUInt8(buffI), dictI);
					retBuff.writeUInt8(buff.readUInt8(buffI), retBuffI);
					
					buffI++;
					retBuffI++;
					dictI = ((dictI + 1) & 0xfff);
				}
			};
			
			retBuff.writeUInt8(prefixByte, oldBuffI);
		};
		
		return retBuff.slice(0, retBuffI);
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
		let retBuffLength = 0;
		
		for(let buffI = 0, c = 0x00, rep = false; buffI < buff.length;) {
			c = buff.readUInt8(buffI); buffI++;
			
			rep = this._decodeUInt(buff, buffI, reject);
			if(rep === -1) return;
			
			buffI += rep.bytes;
			retBuffLength += (rep.number + 1);
		};
		
		return retBuffLength;
	};
	
	_decodeRLE(buff, reject) {
		const retBuffLen = this._getLengthRLE(buff, reject);
		if(retBuffLen === -1) return;
		
		const retBuff = Buffer.alloc(retBuffLen);
		
		let buffI = 0, retBuffI = 0, c = 0x00, rep = false, j = 0;
		for(; buffI < buff.length;) {
			c = buff.readUInt8(buffI); buffI++;
			
			rep = this._decodeUInt(buff, buffI, reject);
			if(rep === -1) return;
			
			buffI += rep.bytes;
			
			for(j = 0; j < (rep.number + 1); j++) {
				retBuff.writeUInt8(c, retBuffI);
				retBuffI++;
			};
		};
		
		return retBuff;
	};
	
	_getDictSliceLZSS(dict, off, len) {
		const buff = Buffer.alloc(Math.min(0x1000, len));
		
		for(let i = 0; i < len; i++)
			buff.writeUInt8(i, dict.readUInt8((off + i) & 0xfff));
		
		return buff;
	};
	
	
	
	// `decode` expects a Buffer, and maybe a number.
	decode(data, sizeLimit = false) {
		// [TODO]
	};
};

module.exports = { Encoder: ComprezzEncoder, Decoder: ComprezzDecoder };
