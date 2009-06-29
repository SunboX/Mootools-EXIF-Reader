/*
 Script: Request.Binary.js
 	Extends the basic Request Class with additional methods for interacting with binary responses.
  	
 Copyright:
 	Copyright (c) 2009 Dipl.-Ing. (FH) André Fiedler <kontakt@visualdrugs.net>
 	
 License:
 	MIT-style license
 	
 Version
 	0.9
 
 Credits:
 	Based on Binary Ajax 0.1.5, Copyright (c) 2008 Jacob Seidelin, cupboy@gmail.com, http://blog.nihilogic.dk/
 */
Request.Binary = new Class({
    Extends: Request,
    
    options: {
        method: 'get',
        range: [],
        acceptRanges: null,
        fileSize: null
    },
    
    initialize: function(options){
        this.parent(options);
        
        this.xhr.onprogress = this.onProgress.bind(this);
    },
    
    getHeadAndSend: function(){
        if (typeof(this.xhr.onload) != 'undefined') {
            this.xhr.onload = function(){
                if (this.xhr.status == '200') {
                    this.processHead();
                    this.xhr.onload = $empty;
                }
                else {
                    this.failure();
                    this.xhr.onload = $empty;
                }
            }.bind(this);
        }
        else {
            this.xhr.onreadystatechange = function(){
                if (this.xhr.readyState == 4) {
                    if (this.xhr.status == '200') {
                        this.processHead();
                        this.xhr.onreadystatechange = $empty;
                    }
                    else {
                        this.failure();
                        this.xhr.onreadystatechange = $empty;
                    }
                }
            }.bind(this);
        }
        this.xhr.open('HEAD', this.options.url, true);
        this.xhr.send(null);
    },
    
    processHead: function(){
        if (this.options.range.length == 2) {
            var length = parseInt(this.getHeader('Content-Length'), 10);
            var acceptRanges = this.getHeader('Accept-Ranges');
            
            var start = this.options.range[0];
            if (start < 0) 
                start += length;
            end = start + this.options.range[1] - 1;
            
            this.send({
                range: [start, end],
                acceptRanges: (acceptRanges == 'bytes'),
                length: length
            });
        }
        else {
            send();
        }
    },
    
    send: function(options){
        if (!this.check(arguments.callee, options)) 
            return this;
        this.running = true;
        
        var type = $type(options);
        if (type == 'string' || type == 'element') 
            options = {
                data: options
            };
        
        var old = this.options;
        options = $extend({
            data: old.data,
            url: old.url,
            method: old.method
        }, options);
        var data = options.data, url = options.url, method = options.method;
        
        if (data && method == 'get') {
            url = url + (url.contains('?') ? '&' : '?') + data;
            data = null;
        }
        
        var dataOffset = 0;
        if (options.range && options.range.length > 0 && !options.acceptRanges) {
            dataOffset = options.range[0];
        }
        var dataLen = 0;
        if (options.range && options.range.length > 1) {
            dataLen = options.range[1] - options.range[0] + 1;
        }
        
        if (typeof(this.xhr.onload) != 'undefined') {
            this.xhr.onload = function(){
                if (this.xhr.status == '200' || this.xhr.status == '206') {
                    this.response = {
                        binary: new ByteStream(this.xhr.responseText, dataOffset, dataLen),
                        fileSize: options.fileSize || this.getHeader('Content-Length')
                    };
                    this.success(this.response.binary, this.response.fileSize);
                    this.xhr.onload = $empty;
                }
                else {
                    this.failure();
                    this.xhr.onload = $empty;
                }
            }.bind(this);
        }
        else {
            this.xhr.onreadystatechange = function(){
                if (this.xhr.readyState == 4) {
                    if (this.xhr.status == '200' || this.xhr.status == '206') {
                        this.response = {
                            binary: new ByteStream(this.xhr.responseBody, dataOffset, dataLen),
                            fileSize: options.fileSize || this.getHeader('Content-Length')
                        }
                        this.success(this.response.binary, this.response.fileSize);
                        this.xhr.onreadystatechange = $empty;
                    }
                    else {
                        this.failure();
                        this.xhr.onreadystatechange = $empty;
                    }
                }
            }.bind(this);
        }
        
        this.xhr.open(method.toUpperCase(), url, this.options.async);
        
        if (this.xhr.overrideMimeType) {
            if (method == 'get') 
                this.xhr.overrideMimeType('text/plain; charset=x-user-defined');
            else 
                this.xhr.overrideMimeType('text/plain; charset=x-user-defined-binary');
        }
        
        if (options.range && options.range.length > 1 && options.acceptRanges) {
            this.xhr.setRequestHeader('Range', 'bytes=' + options.range[0] + '-' + options.range[1]);
        }
        
        this.xhr.setRequestHeader('If-Modified-Since', 'Sat, 1 Jan 1970 00:00:00 GMT');
        
        if (data) {
            if (this.xhr.sendAsBinary) {
                this.fireEvent('request');
                this.xhr.sendAsBinary(data);
            }
            else {
                this.failure();
            }
        }
        else {
            this.fireEvent('request');
            this.xhr.send(null);
        }
        
        return this;
    },
    
    onProgress: function(e, fileSize){
        if (e && e.lengthComputable) 
            this.fireEvent('progress', {
                loaded: e.loaded,
                total: e.total
            });
        if (fileSize) 
            this.fireEvent('progress', {
                loaded: fileSize,
                total: fileSize
            });
    },
    
    success: function(binary, fileSize){
        this.onProgress(null, fileSize);
        this.onSuccess(binary, fileSize);
    }
});
