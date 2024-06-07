"use strict";

function comprezzGenDict() {
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
	
	_getLengthLZSS(buff, reject) {
		const dict = comprezzGenDict();
		
		let buffI = 0, prefixBit = 0, isRef = false, match = false;
		
		while(buffI < buff.length) {
			buffI++;
			
			for(prefixBit = 0; prefixBit < 8; prefixBit++) {
				match = this._lzssFindBiggestMatch(buff, buffI, dict);
				
				buffI += ((match.length > 3) ? 3 : 1);
			};
		};
		
		return retBuffLen;
	};
	
	_encodeLZSS(buff, reject) {
		const	dict = comprezzGenDict(),
				retBuff = Buffer.alloc(buff.length << 2);
		
		
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
		
		const dict = comprezzGenDict();
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
					refOff = (buff.readUInt16BE(buff) >> 4);
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
