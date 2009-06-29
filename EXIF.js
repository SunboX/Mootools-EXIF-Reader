/*
 Script: EXIF.js
 
 Copyright:
 	Copyright (c) 2009 Dipl.-Ing. (FH) André Fiedler <kontakt@visualdrugs.net>
 
 License:
 	MIT-style license
 
 Version
 	0.9
 
 Credits:
 	Based on Javascript EXIF Reader 0.1.2, Copyright (c) 2008 Jacob Seidelin, cupboy@gmail.com, http://blog.nihilogic.dk/
 */
var EXIF = new Class({

    Implements: [Events, Options],
    
    options: {},
    
    initialize: function(options){
        this.setOptions(options);
        this.tags = new Hash();
    },
    
    parseByteStream: function(byteStream){
        if (byteStream.getByteAt(0) != 0xFF || byteStream.getByteAt(1) != 0xD8) {
            this.fireEvent('complete', this.tags);
            return this; // not a valid jpeg
        }
        
        var offset = 2;
        var length = byteStream.getLength();
        while (offset < length) {
            if (byteStream.getByteAt(offset) != 0xFF) {
                this.log('Not a valid marker at offset ' + offset + ', found: ' + byteStream.getByteAt(offset));
                this.fireEvent('complete', this.tags);
                return this; // not a valid marker, something is wrong
            }
            
            var marker = byteStream.getByteAt(offset + 1);
            
            // we could implement handling for other markers here, 
            // but we're only looking for 0xFFE1 for EXIF data
            
            if (marker == 22400) {
                this.log('Found 0xFFE1 marker');
                return this.readEXIFData(byteStream, offset + 4, byteStream.getShortAt(offset + 2, true) - 2);
            }
            else {
                if (marker == 225) {
                    // 0xE1 = Application-specific 1 (for EXIF)
                    this.log('Found 0xFFE1 marker');
                    return this.readEXIFData(byteStream, offset + 4, byteStream.getShortAt(offset + 2, true) - 2);
                }
                else {
                    offset += 2 + byteStream.getShortAt(offset + 2, true);
                }
            }
        }
    },
    
    readEXIFData: function(byteStream, start, length){
        if (byteStream.getStringAt(start, 4) != 'Exif') {
            this.log('Not valid EXIF data! ' + byteStream.getStringAt(start, 4));
            this.fireEvent('complete', this.tags);
            return this;
        }
        
        var bigEnd;
        
        var TIFFOffset = start + 6;
        
        // test for TIFF validity and endianness
        if (byteStream.getShortAt(TIFFOffset) == 0x4949) {
            bigEnd = false;
        }
        else 
            if (byteStream.getShortAt(TIFFOffset) == 0x4D4D) {
                bigEnd = true;
            }
            else {
                this.log('Not valid TIFF data! (no 0x4949 or 0x4D4D)');
                this.fireEvent('complete', this.tags);
                return this;
            }
        
        if (byteStream.getShortAt(TIFFOffset + 2, bigEnd) != 0x002A) {
            this.log('Not valid TIFF data! (no 0x002A)');
            this.fireEvent('complete', this.tags);
            return this;
        }
        
        if (byteStream.getLongAt(TIFFOffset + 4, bigEnd) != 0x00000008) {
            this.log('Not valid TIFF data! (First offset not 8)', byteStream.getShortAt(TIFFOffset + 4, bigEnd));
            this.fireEvent('complete', this.tags);
            return this;
        }
        
        var tags = this.readTags(byteStream, TIFFOffset, TIFFOffset + 8, MooTools.lang.get('EXIF', 'TiffTags'), bigEnd);
        
        if (tags.ExifIFDPointer) {
            var EXIFTags = this.readTags(byteStream, TIFFOffset, TIFFOffset + tags.ExifIFDPointer, MooTools.lang.get('EXIF', 'Tags'), bigEnd);
            for (var tag in EXIFTags) {
                switch (tag) {
                    case 'LightSource':
                    case 'Flash':
                    case 'MeteringMode':
                    case 'ExposureProgram':
                    case 'SensingMethod':
                    case 'SceneCaptureType':
                    case 'SceneType':
                    case 'CustomRendered':
                    case 'WhiteBalance':
                    case 'GainControl':
                    case 'Contrast':
                    case 'Saturation':
                    case 'Sharpness':
                    case 'SubjectDistanceRange':
                    case 'FileSource':
                        EXIFTags[tag] = MooTools.lang.get('EXIF', 'StringValues')[tag][EXIFTags[tag]];
                        break;
                        
                    case 'ExifVersion':
                    case 'FlashpixVersion':
                        EXIFTags[tag] = String.fromCharCode(EXIFTags[tag][0], EXIFTags[tag][1], EXIFTags[tag][2], EXIFTags[tag][3]);
                        break;
                        
                    case 'ComponentsConfiguration':
                        EXIFTags[strTag] = MooTools.lang.get('EXIF', 'StringValues').Components[EXIFTags[tag][0]] +
                        MooTools.lang.get('EXIF', 'StringValues').Components[EXIFTags[tag][1]] +
                        MooTools.lang.get('EXIF', 'StringValues').Components[EXIFTags[tag][2]] +
                        MooTools.lang.get('EXIF', 'StringValues').Components[EXIFTags[tag][3]];
                        break;
                }
                tags[tag] = EXIFTags[tag];
            }
        }
        
        if (tags.GPSInfoIFDPointer) {
            var GPSTags = this.readTags(byteStream, TIFFOffset, TIFFOffset + tags.GPSInfoIFDPointer, MooTools.lang.get('EXIF', 'GPSTags'), bigEnd);
            for (var tag in GPSTags) {
                switch (tag) {
                    case 'GPSVersionID':
                        GPSTags[tag] = GPSTags[tag][0] +
                        '.' +
                        GPSTags[tag][1] +
                        '.' +
                        GPSTags[tag][2] +
                        '.' +
                        GPSTags[tag][3];
                        break;
                }
                tags[tag] = GPSTags[tag];
            }
        }
        
        this.tags.extend(tags);
        
        this.fireEvent('complete', this.tags);
        return this;
    },
    
    readTags: function(byteStream, TIFFStart, dirStart, strings, bigEnd){
        var entries = byteStream.getShortAt(dirStart, bigEnd);
        var tags = {};
        for (var i = 0; i < entries; i++) {
            var entryOffset = dirStart + i * 12 + 2;
            var tag = strings[byteStream.getShortAt(entryOffset, bigEnd)];
            if (!tag) 
                this.log('Unknown tag: ' + byteStream.getShortAt(entryOffset, bigEnd));
            tags[tag] = this.readTagValue(byteStream, entryOffset, TIFFStart, dirStart, bigEnd);
        }
        return tags;
    },
    
    readTagValue: function(byteStream, entryOffset, TIFFStart, dirStart, bigEnd){
        var type = byteStream.getShortAt(entryOffset + 2, bigEnd);
        var numValues = byteStream.getLongAt(entryOffset + 4, bigEnd);
        var valueOffset = byteStream.getLongAt(entryOffset + 8, bigEnd) + TIFFStart;
        
        switch (type) {
            case 1: // byte, 8-bit unsigned int
            case 7: // undefined, 8-bit byte, value depending on field
                if (numValues == 1) {
                    return byteStream.getByteAt(entryOffset + 8, bigEnd);
                }
                else {
                    var valOffset = numValues > 4 ? valueOffset : (entryOffset + 8);
                    var values = [];
                    for (var n = 0; n < numValues; n++) {
                        values[n] = byteStream.getByteAt(valOffset + n);
                    }
                    return values;
                }
                break;
                
            case 2: // ascii, 8-bit byte
                var stringOffset = numValues > 4 ? valueOffset : (entryOffset + 8);
                return byteStream.getStringAt(stringOffset, numValues - 1);
                break;
                
            case 3: // short, 16 bit int
                if (numValues == 1) {
                    return byteStream.getShortAt(entryOffset + 8, bigEnd);
                }
                else {
                    var valOffset = numValues > 2 ? valueOffset : (entryOffset + 8);
                    var values = [];
                    for (var n = 0; n < numValues; n++) {
                        values[n] = byteStream.getShortAt(valOffset + 2 * n, bigEnd);
                    }
                    return values;
                }
                break;
                
            case 4: // long, 32 bit int
                if (numValues == 1) {
                    return byteStream.getLongAt(entryOffset + 8, bigEnd);
                }
                else {
                    var values = [];
                    for (var n = 0; n < numValues; n++) {
                        values[n] = byteStream.getLongAt(valueOffset + 4 * n, bigEnd);
                    }
                    return values;
                }
                break;
            case 5: // rational = two long values, first is numerator, second is denominator
                if (numValues == 1) {
                    return byteStream.getLongAt(valueOffset, bigEnd) / byteStream.getLongAt(valueOffset + 4, bigEnd);
                }
                else {
                    var values = [];
                    for (var n = 0; n < numValues; n++) {
                        values[n] = byteStream.getLongAt(valueOffset + 8 * n, bigEnd) / byteStream.getLongAt(valueOffset + 4 + 8 * n, bigEnd);
                    }
                    return values;
                }
                break;
            case 9: // slong, 32 bit signed int
                if (numValues == 1) {
                    return byteStream.getSLongAt(entryOffset + 8, bigEnd);
                }
                else {
                    var values = [];
                    for (var n = 0; n < numValues; n++) {
                        values[n] = byteStream.getSLongAt(valueOffset + 4 * n, bigEnd);
                    }
                    return values;
                }
                break;
            case 10: // signed rational, two slongs, first is numerator, second is denominator
                if (numValues == 1) {
                    return byteStream.getSLongAt(valueOffset, bigEnd) / byteStream.getSLongAt(valueOffset + 4, bigEnd);
                }
                else {
                    var values = [];
                    for (var n = 0; n < numValues; n++) {
                        values[n] = byteStream.getSLongAt(valueOffset + 8 * n, bigEnd) / byteStream.getSLongAt(valueOffset + 4 + 8 * n, bigEnd);
                    }
                    return values;
                }
                break;
        }
    },
    
    getTags: function(){
        return this.tags;
    },
    
    pretty: function(){
        var pretty = '';
        for (var a in this.tags) {
            if (this.tags.hasOwnProperty(a)) {
                if (typeof this.tags[a] == 'object') {
                    pretty += a + ' : [' + this.tags[a].length + " values]\r\n";
                }
                else {
                    pretty += a + ' : ' + this.tags[a] + "\r\n";
                }
            }
        }
        return pretty;
    },
    
    log: function(){
        if (window.console && console.log && console.log.apply) 
            console.log.apply(console, arguments);
    }
});
