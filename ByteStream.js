/*
 Script: ByteStream.js
 	
 Copyright:
 	Copyright (c) 2009 Dipl.-Ing. (FH) André Fiedler <kontakt@visualdrugs.net>
 	
 License:
 	MIT-style license
 	
 Version
 	0.9
 
 Credits:
 	Based on Binary Ajax 0.1.5, Copyright (c) 2008 Jacob Seidelin, cupboy@gmail.com, http://blog.nihilogic.dk/
 */
ByteStream = new Class({

    Implements: [Events, Options],
    
    options: {
        offset: 0,
        length: null
    },
    
    initialize: function(data, options){
        this.data = data;
        this.setOptions(options);
        
        this.use_vb_script = false;
        
        if (typeof this.data != 'string') {
            this.execVBScript();
            if (this.use_vb_script) {
                this.data = BinReader(this.data).toArray();
                for (var i = 0; i < this.data.length; i++) 
                    this.data[i] = String.fromCharCode(this.data[i]);
                this.data = this.data.join('');
            }
        }
        
        this.options.length = this.options.length || this.data.length;
    },
    
    getRawData: function(){
        return this.data;
    },
    
    getLength: function(){
        return this.options.length;
    },
    
    getByteAt: function(offset){
        return this.data.charCodeAt(this.options.offset + offset) & 0xFF;
    },
    
    getSByteAt: function(offset){
        var b = this.getByteAt(offset);
        if (b > 127) 
            return b - 256;
        else 
            return b;
    },
    
    getShortAt: function(offset, bigEndian){
        var s = bigEndian ? (this.getByteAt(offset) << 8) + this.getByteAt(offset + 1) : (this.getByteAt(offset + 1) << 8) + this.getByteAt(offset)
        if (s < 0) 
            s += 65536;
        return s;
    },
    
    getSShortAt: function(offset, bigEndian){
        var us = this.getShortAt(offset, bigEndian);
        if (us > 32767) 
            return us - 65536;
        else 
            return us;
    },
    
    getLongAt: function(offset, bigEndian){
        var b1 = this.getByteAt(offset), b2 = this.getByteAt(offset + 1), b3 = this.getByteAt(offset + 2), b4 = this.getByteAt(offset + 3);
        
        var l = bigEndian ? (((((b1 << 8) + b2) << 8) + b3) << 8) + b4 : (((((b4 << 8) + b3) << 8) + b2) << 8) + b1;
        if (l < 0) 
            l += 4294967296;
        return l;
    },
    
    getSLongAt: function(offset, bigEndian){
        var ul = this.getLongAt(offset, bigEndian);
        if (ul > 2147483647) 
            return ul - 4294967296;
        else 
            return ul;
    },
    
    getStringAt: function(offset, length){
        var str = [];
        for (var i = offset, j = 0; i < offset + length; i++, j++) {
            str[j] = String.fromCharCode(this.getByteAt(i));
        }
        return str.join('');
    },
    
    getCharAt: function(offset){
        return String.fromCharCode(this.getByteAt(offset));
    },
    
    toBase64: function(){
        return window.btoa(this.data);
    },
    
    fromBase64: function(strBase64){
        this.data = window.atob(strBase64);
    },
    
    execVBScript: function(){
        if (window.execScript) {
            var script = "Function BinReader(byteString)\r\n" +
            "	Dim i\r\n" +
            "	ReDim byteArray(LenB(byteString))\r\n" +
            "	For i = 1 To LenB(byteString)\r\n" +
            "		byteArray(i-1) = AscB(MidB(byteString, i, 1))\r\n" +
            "	Next\r\n" +
            "	BinReader = byteArray\r\n" +
            "End Function\r\n";
            
            window.execScript(script, 'vbscript');
            this.use_vb_script = true;
        }
        else {
            this.fireEvent('exception', 'Type of data should be \'string\', given type is \'' + $type(this.data) + '\'');
        }
    }
});
