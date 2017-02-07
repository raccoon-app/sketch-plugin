

var App = function() {
    this.root = '';
    this.version = '';

    this.options = {
        prefix: "RaccoonData"
    };

    coscript.setShouldKeepAround(true);
};


Object.assign(App.prototype, {
    init: function(sketchContext) {

        this.prefs = NSUserDefaults.standardUserDefaults();
        this.sketchContext = sketchContext;
        this.document = sketchContext.document;

        this.version = sketchContext.plugin.version() + '';

        var root = sketchContext.scriptPath
            .stringByDeletingLastPathComponent()
            .stringByDeletingLastPathComponent()
            .stringByDeletingLastPathComponent();
        this.root = root + "/Contents/Panel";

        this.message('init');

        //this.checkUpdate();
        //this.checkAuth();
    },
    command: function(sketchContext, command) {

        if (!this.version) {
            this.init(sketchContext)
        }
        this.sketchContext = sketchContext;

        this.documentData = sketchContext.document.documentData();

        this.metadata = this.getMetadata();
        //this.message("commands complete root!" + this.root);

        //if(!this.configs && command &&  command != 'settings'){
            //if(!this.settingsPanel()) return false;
        //}

        switch (command) {
            case "export":
                this.openPanel({data: this.metadata});
                break;
        }
    },

    openPanel: function() {
        return new Panel(this);
    },

    message: function(message) {
        this.document.showMessage(message);
    }
});


// Metadata
Object.assign(App.prototype, {
    getMetadata: function() {
        var UIMetadata = this.sketchContext.document.mutableUIMetadata();
        var metadata = UIMetadata.objectForKey(this.options.prefix);

        return JSON.parse(metadata);
    },

    setMetadata: function(newMetadata) {
        var metadata = this.extend(newMetadata, this.getMetadata() || {});
        var UIMetadata = this.sketchContext.document.mutableUIMetadata();

        newMetadata.timestamp = new Date().getTime();
        UIMetadata.setObject_forKey (JSON.stringify(metadata), this.options.prefix);

        //var saveDoc = this.addShape();
        //this.page.addLayers([saveDoc]);

        //this.removeLayer(saveDoc);

        return metadata;
    },

    removeMetadata: function() {
        var UIMetadata = this.sketchContext.document.mutableUIMetadata();

        UIMetadata.setObject_forKey (null, this.options.prefix);
    }
});
// end Metadata


// Export
Object.assign(App.prototype, {



    hasExportSizes: function(layer){
        return layer.exportOptions().exportFormats().count() > 0;
    },
    isSliceGroup: function(layer) {
        return this.is(layer, MSLayerGroup) && this.hasExportSizes(layer);
    },
    isExportable: function(layer) {
        return this.is(layer, MSTextLayer) ||
            this.is(layer, MSShapeGroup) ||
            this.is(layer, MSBitmapLayer) ||
            this.is(layer, MSSliceLayer) ||
            this.is(layer, MSSymbolInstance) ||
            this.isSliceGroup(layer)
    },
    getStates: function(layer){
        var isVisible = true,
            isLocked = false,
            hasSlice = false,
            isEmpty = false,
            isMaskChildLayer = false,
            isMeasure = false;

        while (!( this.is(layer, MSArtboardGroup) || this.is(layer, MSSymbolMaster) ) ) {
            var group = layer.parentGroup();

            if( this.regexNames.exec(group.name()) ){
                isMeasure = true;
            }

            if (!layer.isVisible()) {
                isVisible = false;
            }

            if (layer.isLocked()) {
                isLocked = true;
            }

            if ( this.is(group, MSLayerGroup) && this.hasExportSizes(group) ) {
                hasSlice = true
            }

            if (
                this.maskObjectID &&
                group.objectID() == this.maskObjectID &&
                !layer.shouldBreakMaskChain()
            ) {
                isMaskChildLayer = true
            }

            if (
                this.is(layer, MSTextLayer) &&
                layer.isEmpty()
            ) {
                isEmpty = true
            }

            layer = group;
        }
        return {
            isVisible: isVisible,
            isLocked: isLocked,
            hasSlice: hasSlice,
            isMaskChildLayer: isMaskChildLayer,
            isMeasure: isMeasure,
            isEmpty: isEmpty
        }
    },
    getMask: function(group, layer, layerData, layerStates){
        if(layer.hasClippingMask()){
            if(layerStates.isMaskChildLayer){
                this.maskCache.push({
                    objectID: this.maskObjectID,
                    rect: this.maskRect
                });
            }
            this.maskObjectID = group.objectID();
            this.maskRect = layerData.rect;
        }
        else if( !layerStates.isMaskChildLayer && this.maskCache.length > 0 ){
            var mask = this.maskCache.pop();
            this.maskObjectID = mask.objectID;
            this.maskRect = mask.rect;
            layerStates.isMaskChildLayer = true;
        }
        else if ( !layerStates.isMaskChildLayer ) {
            this.maskObjectID = undefined;
            this.maskRect = undefined;
        }

        if (layerStates.isMaskChildLayer){
            var layerRect = layerData.rect,
                maskRect = this.maskRect;

            layerRect.maxX = layerRect.x + layerRect.width;
            layerRect.maxY = layerRect.y + layerRect.height;
            maskRect.maxX = maskRect.x + maskRect.width;
            maskRect.maxY = maskRect.y + maskRect.height;

            var distance = this.getDistance(layerRect, maskRect),
                width = layerRect.width,
                height = layerRect.height;

            if(distance.left < 0) width += distance.left;
            if(distance.right < 0) width += distance.right;
            if(distance.top < 0) height += distance.top;
            if(distance.bottom < 0) height += distance.bottom;

            layerData.rect = {
                x: ( distance.left < 0 )? maskRect.x: layerRect.x,
                y: ( distance.top < 0 )? maskRect.y: layerRect.y,
                width: width,
                height: height
            }

        }
    },
    getFormats: function( exportFormats ) {
        var formats = [];
        for (var i = 0; i < exportFormats.length; i++) {
            var format = exportFormats[i];
            formats.push({
                scale: format.scale(),
                suffix: format.name(),
                format: format.fileFormat()
            })
        }
        return formats;
    },
    getExportable: function(layer, savePath){
        var self = this,
            exportable = [],
            size, sizes = layer.exportOptions().exportFormats(),
            fileFormat = this.toJSString(sizes[0].fileFormat()),
            matchFormat = /png|jpg|tiff|webp/.exec(fileFormat);
        var exportFormats =
            (self.configs.unit == "dp/sp" && matchFormat)? [
                { scale: 1 / self.configs.scale, drawable: "drawable-mdpi/", format: "png" },
                { scale: 1.5 / self.configs.scale, drawable: "drawable-hdpi/", format: "png" },
                { scale: 2 / self.configs.scale, drawable: "drawable-xhdpi/", format: "png" },
                { scale: 3 / self.configs.scale, drawable: "drawable-xxhdpi/", format: "png" },
                { scale: 4 / self.configs.scale, drawable: "drawable-xxxhdpi/", format: "png" }
            ]:
                (this.configs.unit == "pt" && matchFormat)? [
                    { scale: 1 / self.configs.scale, suffix: "", format: "png" },
                    { scale: 2 / self.configs.scale, suffix: "@2x", format: "png" },
                    { scale: 3 / self.configs.scale, suffix: "@3x", format: "png" }
                ]:
                    self.getFormats(sizes);

        for(exportFormat of exportFormats) {
            var drawable = exportFormat.drawable || "",
                suffix = exportFormat.suffix || "";
            self.exportImage({
                layer: layer,
                path: self.assetsPath,
                scale: exportFormat.scale,
                name: drawable + layer.name(),
                suffix: suffix,
                format: exportFormat.format
            });

            exportable.push({
                name: self.toJSString(layer.name()),
                format: fileFormat,
                path: drawable + layer.name() + suffix + "." + exportFormat.format
            });
        }

        return exportable;
    },
    getSlice: function(layer, layerData, symbolLayer){
        var objectID = ( layerData.type == "symbol" )? this.toJSString(layer.symbolMaster().objectID()):
            ( symbolLayer )? this.toJSString(symbolLayer.objectID()):
                layerData.objectID;
        if(
            (
                layerData.type == "slice" ||
                (
                    layerData.type == "symbol" &&
                    this.hasExportSizes(layer.symbolMaster())
                )
            ) &&
            !this.sliceCache[objectID]
        ){
            var sliceLayer = ( layerData.type == "symbol" )? layer.symbolMaster(): layer;
            if(symbolLayer && this.is(symbolLayer.parentGroup(), MSSymbolMaster)){
                layer.exportOptions().setLayerOptions(2);
            }

            this.assetsPath = this.savePath + "/assets";
            NSFileManager
                .defaultManager()
                .createDirectoryAtPath_withIntermediateDirectories_attributes_error(this.assetsPath, true, nil, nil);

            this.sliceCache[objectID] = layerData.exportable = this.getExportable(sliceLayer);
            this.slices.push({
                name: layerData.name,
                objectID: objectID,
                rect: layerData.rect,
                exportable: layerData.exportable
            })
        }
        else if( this.sliceCache[objectID] ){
            layerData.exportable = this.sliceCache[objectID];
        }
    },
    getSymbol: function(artboard, layer, layerData, data){
        if( layerData.type == "symbol" ){
            var self = this,
                symbolObjectID = this.toJSString(layer.symbolMaster().objectID());

            layerData.objectID = symbolObjectID;

            if( !self.hasExportSizes(layer.symbolMaster()) && layer.symbolMaster().children().count() > 1 ){
                var symbolRect = this.getRect(layer),
                    symbolChildren = layer.symbolMaster().children(),
                    tempSymbol = layer.duplicate(),
                    tempGroup = tempSymbol.detachByReplacingWithGroup();

                tempGroup.resizeToFitChildrenWithOption(0)

                var tempSymbolLayers = tempGroup.children().objectEnumerator(),
                    overrides = layer.overrides(),
                    idx = 0;

                overrides = (overrides)? overrides.objectForKey(0): undefined;

                while(tempSymbolLayer = tempSymbolLayers.nextObject()){
                    if( self.is(tempSymbolLayer, MSSymbolInstance) ){
                        var symbolMasterObjectID = self.toJSString(symbolChildren[idx].objectID());
                        if(
                            overrides &&
                            overrides[symbolMasterObjectID] &&
                            !!overrides[symbolMasterObjectID].symbolID
                        ){
                            var changeSymbol = self.find({key: "(symbolID != NULL) && (symbolID == %@)", match: self.toJSString(overrides[symbolMasterObjectID].symbolID)}, self.document.documentData().allSymbols());
                            if(changeSymbol){
                                tempSymbolLayer.changeInstanceToSymbol(changeSymbol);
                            }
                            else{
                                tempSymbolLayer = undefined;
                            }
                        }
                    }
                    if(tempSymbolLayer){
                        self.getLayer(
                            artboard,
                            tempSymbolLayer,
                            data,
                            symbolChildren[idx]
                        );
                    }
                    idx++
                }
                this.removeLayer(tempGroup);
            }
        }
    },
    getTextAttrs: function(str){
        var data = {},
            regExpAttr = new RegExp('([a-z\-]+)\=\"([^\"]+)\"', 'g'),
            regExpAttr1 = new RegExp('([a-z\-]+)\=\"([^\"]+)\"'),
            attrs = str.match(regExpAttr);
        for (var a = 0; a < attrs.length; a++) {
            var attrData = regExpAttr1.exec(attrs[a]),
                key = attrData[1],
                value = attrData[2];

            data[key] = value;
        }
        return data;
    },
    getText: function(artboard, layer, layerData, data){

        if(layerData.type == "text" && layer.attributedString().treeAsDictionary().value.attributes.length > 1){
            var self = this,
                svgExporter = SketchSVGExporter.new().exportLayers([layer.immutableModelObject()]),
                svgStrong = this.toJSString(NSString.alloc().initWithData_encoding(svgExporter, 4)),
                regExpTspan = new RegExp('<tspan([^>]+)>([^<]*)</tspan>', 'g'),
                regExpContent = new RegExp('>([^<]*)<'),
                offsetX, offsetY, textData = [],
                layerRect = this.getRect(layer),
                svgSpans = svgStrong.match(regExpTspan);

            for (var a = 0; a < svgSpans.length; a++) {
                var attrsData = this.getTextAttrs(svgSpans[a]);
                attrsData.content = svgSpans[a].match(regExpContent)[1];
                offsetX = (
                    !offsetX ||
                    ( offsetX && offsetX > this.toJSNumber(attrsData.x) )
                )?
                    this.toJSNumber(attrsData.x): offsetX;

                offsetY = (
                    !offsetY ||
                    ( offsetY && offsetY > this.toJSNumber(attrsData.y) )
                )?
                    this.toJSNumber(attrsData.y): offsetY;

                textData.push(attrsData);
            }

            var parentGroup = layer.parentGroup(),
                parentRect = self.getRect(parentGroup),
                colorHex = layerData.color["color-hex"].split(" ")[0];

            textData.forEach(function(tData){

                if(
                    tData["content"].trim() &&
                    (
                        colorHex != tData.fill ||
                        Object.getOwnPropertyNames(tData).length > 4
                    )
                ){
                    var textLayer = self.addText(),
                        colorRGB = self.hexToRgb(tData.fill || colorHex),
                        color = MSColor.colorWithRed_green_blue_alpha(colorRGB.r / 255, colorRGB.g / 255, colorRGB.b / 255, (tData["fill-opacity"] || 1) );

                    textLayer.setName(tData.content);
                    textLayer.setStringValue(tData.content);
                    textLayer.setTextColor(color);
                    textLayer.setFontSize(tData["font-size"] || layerData.fontSize);

                    var defaultLineHeight = layer.font().defaultLineHeightForFont();

                    textLayer.setLineHeight(layer.lineHeight() || defaultLineHeight);

                    textLayer.setCharacterSpacing(self.toJSNumber(tData["letter-spacing"]) || layer.characterSpacing());
                    textLayer.setTextAlignment(layer.textAlignment())

                    if(tData["font-family"]){
                        textLayer.setFontPostscriptName(tData["font-family"].split(",")[0]);
                    }
                    else{
                        textLayer.setFontPostscriptName(layer.fontPostscriptName());
                    }

                    parentGroup.addLayers([textLayer]);

                    var textLayerRect = self.getRect(textLayer);

                    textLayerRect.setX(layerRect.x + (self.toJSNumber(tData.x) - offsetX));
                    textLayerRect.setY(layerRect.y + (self.toJSNumber(tData.y) - offsetY));

                    self.getLayer(
                        artboard,
                        textLayer,
                        data
                    );

                    self.removeLayer(textLayer);
                }

            });
        }
    },
    getSavePath: function(){
        var filePath = this.document.fileURL()? this.document.fileURL().path().stringByDeletingLastPathComponent(): "~";
        var fileName = this.document.displayName().stringByDeletingPathExtension();
        var savePanel = NSSavePanel.savePanel();

        savePanel.setTitle(_("Export spec"));
        savePanel.setNameFieldLabel(_("Export to:"));
        savePanel.setPrompt(_("Export"));
        savePanel.setCanCreateDirectories(true);
        savePanel.setNameFieldStringValue(fileName);

        if (savePanel.runModal() != NSOKButton) {
            return false;
        }

        return savePanel.URL().path();
    },
    exportPanel: function(){
        var self = this;
        this.artboardsData = [];
        this.selectionArtboards = {};
        var data = {};
        data.selection = [];
        data.current = [];
        data.pages = [];

        data.exportOption = self.configs.exportOption;
        if(data.exportOption == undefined){
            data.exportOption = true;
        }

        self.configs.order = (self.configs.order)? self.configs.order: "positive";
        data.order = self.configs.order;

        if(this.selection.count() > 0){
            var selectionArtboards = this.find({key: "(class != NULL) && (class == %@)", match: MSArtboardGroup}, this.selection, true);
            if(selectionArtboards.count() > 0){
                selectionArtboards = selectionArtboards.objectEnumerator();
                while(artboard = selectionArtboards.nextObject()){
                    data.selection.push(this.toJSString(artboard.objectID()));
                }
            }
        }
        if(this.artboard) data.current.push(this.toJSString(this.artboard.objectID()));

        var pages = this.document.pages().objectEnumerator();
        while(page = pages.nextObject()){
            var pageData = {},
                artboards = page.artboards().objectEnumerator();
            pageData.name = this.toJSString(page.name());
            pageData.objectID = this.toJSString(page.objectID());
            pageData.artboards = [];

            while(artboard = artboards.nextObject()){
                // if(!this.is(artboard, MSSymbolMaster)){
                var artboardData = {};
                artboardData.name = this.toJSString(artboard.name());
                artboardData.objectID = this.toJSString(artboard.objectID());
                artboardData.MSArtboardGroup = artboard;
                pageData.artboards.push(artboardData);
                // }
            }
            pageData.artboards.reverse()
            data.pages.push(pageData);
        }

        self.allData = data;

        return this.AppPanel({
            url: this.pluginSketch + "/panel/export.html",
            width: 320,
            height: 567,
            data: data,
            callback: function( data ){
                var allData = self.allData;
                self.selectionArtboards = [];
                self.allCount = 0;

                for (var p = 0; p < allData.pages.length; p++) {
                    var artboards = allData.pages[p].artboards;
                    if(data.order == 'reverse'){
                        artboards = artboards.reverse();
                    }
                    else if(data.order == 'alphabet'){
                        artboards = artboards.sort(function(a, b) {
                            var nameA = a.name.toUpperCase(),
                                nameB = b.name.toUpperCase();
                            if (nameA < nameB) {
                                return -1;
                            }
                            if (nameA > nameB) {
                                return 1;
                            }
                            return 0;
                        });
                    }

                    for (var a = 0; a < artboards.length; a++) {
                        var artboard = artboards[a].MSArtboardGroup,
                            objectID = self.toJSString( artboard.objectID() );
                        if(data[objectID]){
                            self.allCount += artboard.children().count();
                            self.selectionArtboards.push(artboard);
                        }
                    }
                }

                self.configs = self.setConfigs({
                    exportOption: data.exportOption,
                    order: data.order
                });
            }
        });
    },
    export: function(){
        if(this.exportPanel()){
            if(this.selectionArtboards.length <= 0){
                return false;
            }
            var self = this,
                savePath = this.getSavePath();

            if(savePath){
                // self.message(_("Exporting..."));
                var processingPanel = this.AppPanel({
                        url: this.pluginSketch + "/panel/processing.html",
                        width: 304,
                        height: 104,
                        floatWindow: true
                    }),
                    processing = processingPanel.windowScriptObject(),
                    template = NSString.stringWithContentsOfFile_encoding_error(this.pluginSketch + "/template.html", 4, nil);

                this.savePath = savePath;
                var idx = 1,
                    artboardIndex = 0,
                    layerIndex = 0,
                    exporting = false,
                    data = {
                        scale: self.configs.scale,
                        unit: self.configs.unit,
                        colorFormat: self.configs.colorFormat,
                        artboards: [],
                        slices: [],
                        colors: []
                    };

                self.slices = [];
                self.sliceCache = {};
                self.maskCache = [];
                self.wantsStop = false;

                coscript.scheduleWithRepeatingInterval_jsFunction( 0, function( interval ){
                    // self.message('Processing layer ' + idx + ' of ' + self.allCount);
                    processing.evaluateWebScript("processing('"  + Math.round( idx / self.allCount * 100 ) +  "%', '" + _("Processing layer %@ of %@", [idx, self.allCount]) + "')");
                    idx++;

                    if(!data.artboards[artboardIndex]){
                        data.artboards.push({layers: [], notes: []});
                        self.maskCache = [];
                        self.maskObjectID = undefined;
                        self.maskRect = undefined;
                    }

                    if(!exporting) {
                        exporting = true;
                        var artboard = self.selectionArtboards[artboardIndex],
                            page = artboard.parentGroup(),
                            layer = artboard.children()[layerIndex];

                        // log( page.name() + ' - ' + artboard.name() + ' - ' + layer.name());
                        try {
                            self.getLayer(
                                artboard, // Sketch artboard element
                                layer, // Sketch layer element
                                data.artboards[artboardIndex] // Save to data
                            );
                            layerIndex++;
                            exporting = false;
                        } catch (e) {
                            self.wantsStop = true;
                            processing.evaluateWebScript("$('#processing-text').html('<strong>Error:</strong> <small>" + self.toHTMLEncode(e.message) + "</small>');");
                        }

                        if( self.is(layer, MSArtboardGroup) || self.is(layer, MSSymbolMaster)){
                            var objectID = artboard.objectID(),
                                artboardRect = self.getRect(artboard),
                                page = artboard.parentGroup(),
                                // name = self.toSlug(self.toHTMLEncode(page.name()) + ' ' + self.toHTMLEncode(artboard.name()));
                                slug = self.toSlug(page.name() + ' ' + artboard.name());

                            data.artboards[artboardIndex].pageName = self.toHTMLEncode(self.emojiToEntities(page.name()));
                            data.artboards[artboardIndex].pageObjectID = self.toJSString(page.objectID());
                            data.artboards[artboardIndex].name = self.toHTMLEncode(self.emojiToEntities(artboard.name()));
                            data.artboards[artboardIndex].slug = slug;
                            data.artboards[artboardIndex].objectID = self.toJSString(artboard.objectID());
                            data.artboards[artboardIndex].width = artboardRect.width;
                            data.artboards[artboardIndex].height = artboardRect.height;

                            if(!self.configs.exportOption){
                                var imageURL = NSURL.fileURLWithPath(self.exportImage({
                                        layer: artboard,
                                        scale: 2,
                                        name: objectID
                                    })),
                                    imageData = NSData.dataWithContentsOfURL(imageURL),
                                    imageBase64 = imageData.base64EncodedStringWithOptions(0);
                                data.artboards[artboardIndex].imageBase64 = 'data:image/png;base64,' + imageBase64;

                                var newData =  JSON.parse(JSON.stringify(data));
                                newData.artboards = [data.artboards[artboardIndex]];
                                self.writeFile({
                                    content: self.template(template, {lang: language, data: JSON.stringify(newData)}),
                                    path: self.toJSString(savePath),
                                    fileName: slug + ".html"
                                });
                            }
                            else{
                                // data.artboards[artboardIndex].imagePath = "preview/" + objectID + ".png";
                                data.artboards[artboardIndex].imagePath = "preview/" + encodeURI(slug) + ".png";

                                self.exportImage({
                                    layer: artboard,
                                    path: self.toJSString(savePath) + "/preview",
                                    scale: 2,
                                    // name: objectID,
                                    name: slug
                                });

                                self.writeFile({
                                    content: "<meta http-equiv=\"refresh\" content=\"0;url=../index.html#artboard" + artboardIndex + "\">",
                                    path: self.toJSString(savePath) + "/links",
                                    fileName: slug + ".html"
                                });
                            }


                            layerIndex = 0;
                            artboardIndex++;
                        }

                        if(artboardIndex >= self.selectionArtboards.length){
                            if(self.slices.length > 0){
                                data.slices = self.slices;
                            }

                            if(self.configs.colors && self.configs.colors.length > 0){
                                data.colors = self.configs.colors;
                            }

                            var selectingPath = savePath;
                            if(self.configs.exportOption){
                                self.writeFile({
                                    content: self.template(template, {lang: language, data: JSON.stringify(data)}),
                                    path: self.toJSString(savePath),
                                    fileName: "index.html"
                                });
                                selectingPath = savePath + "/index.html";
                            }
                            NSWorkspace.sharedWorkspace().activateFileViewerSelectingURLs(NSArray.arrayWithObjects(NSURL.fileURLWithPath(selectingPath)));

                            self.message(_("Export complete!"));
                            self.wantsStop = true;
                        }
                    }

                    if( self.wantsStop === true ){
                        return interval.cancel();
                    }


                });
            }
        }
    },
    writeFile: function(options) {
        var options = this.extend(options, {
                content: "Type something!",
                path: this.toJSString(NSTemporaryDirectory()),
                fileName: "temp.txt"
            }),
            content = NSString.stringWithString(options.content),
            savePathName = [];

        NSFileManager
            .defaultManager()
            .createDirectoryAtPath_withIntermediateDirectories_attributes_error(options.path, true, nil, nil);

        savePathName.push(
            options.path,
            "/",
            options.fileName
        );
        savePathName = savePathName.join("");

        content.writeToFile_atomically_encoding_error(savePathName, false, 4, null);
    },
    exportImage: function(options) {
        var options = this.extend(options, {
                layer: this.artboard,
                path: this.toJSString(NSTemporaryDirectory()),
                scale: 1,
                name: "preview",
                suffix: "",
                format: "png"
            }),
            document = this.document,
            slice = MSExportRequest.exportRequestsFromExportableLayer(options.layer).firstObject(),
            savePathName = [];

        slice.scale = options.scale;
        slice.format = options.format;

        savePathName.push(
            options.path,
            "/",
            options.name,
            options.suffix,
            ".",
            options.format
        );
        savePathName = savePathName.join("");

        document.saveArtboardOrSlice_toFile(slice, savePathName);

        return savePathName;
    },
    getLayer: function(artboard, layer, data, symbolLayer){
        var artboardRect = artboard.absoluteRect(),
            group = layer.parentGroup(),
            layerStates = this.getStates(layer);

        if(layer && this.is(layer, MSLayerGroup) && /NOTE\#/.exec(layer.name())){
            var textLayer = layer.children()[2];

            data.notes.push({
                rect: this.rectToJSON(textLayer.absoluteRect(), artboardRect),
                note: this.toHTMLEncode(this.emojiToEntities(textLayer.stringValue())).replace(/\n/g, "<br>")
            });

            layer.setIsVisible(false);
        }

        if (
            !this.isExportable(layer) ||
            !layerStates.isVisible ||
            ( layerStates.isLocked && !this.is(layer, MSSliceLayer) ) ||
            layerStates.isEmpty ||
            layerStates.hasSlice ||
            layerStates.isMeasure
        ){
            return this;
        }

        var layerType = this.is(layer, MSTextLayer) ? "text" :
            this.is(layer, MSSymbolInstance) ? "symbol" :
                this.is(layer, MSSliceLayer) || this.hasExportSizes(layer)? "slice":
                    "shape";

        if ( symbolLayer && layerType == "text" && layer.textBehaviour() == 0) { // fixed for v40
            layer.setTextBehaviour(1); // fixed for v40
            layer.setTextBehaviour(0); // fixed for v40
        } // fixed for v40

        var layerData = {
            objectID: this.toJSString( layer.objectID() ),
            type: layerType,
            name: this.toHTMLEncode(this.emojiToEntities(layer.name())),
            rect: this.rectToJSON(layer.absoluteRect(), artboardRect)
        };

        if(symbolLayer) layerData.objectID = this.toJSString( symbolLayer.objectID() );


        if ( layerType != "slice" ) {
            var layerStyle = layer.style();
            layerData.rotation = layer.rotation();
            layerData.radius = this.getRadius(layer);
            layerData.borders = this.getBorders(layerStyle);
            layerData.fills = this.getFills(layerStyle);
            layerData.shadows = this.getShadows(layerStyle);
            layerData.opacity = this.getOpacity(layerStyle);
            layerData.styleName = this.getStyleName(layer);
        }

        if ( layerType == "text" ) {
            layerData.content = this.toHTMLEncode(this.emojiToEntities(layer.stringValue()));
            layerData.color = this.colorToJSON(layer.textColor());
            layerData.fontSize = layer.fontSize();
            layerData.fontFace = this.toJSString(layer.fontPostscriptName());
            layerData.textAlign = TextAligns[layer.textAlignment()];
            layerData.letterSpacing = this.toJSNumber(layer.characterSpacing()) || 0;
            layerData.lineHeight = layer.lineHeight() || layer.font().defaultLineHeightForFont();
        }

        var layerCSSAttributes = layer.CSSAttributes(),
            css = [];

        for(var i = 0; i < layerCSSAttributes.count(); i++) {
            var c = layerCSSAttributes[i]
            if(! /\/\*/.exec(c) ) css.push(this.toJSString(c));
        }
        if(css.length > 0) layerData.css = css;

        this.getMask(group, layer, layerData, layerStates);
        this.getSlice(layer, layerData, symbolLayer);
        data.layers.push(layerData);
        this.getSymbol(artboard, layer, layerData, data);
        this.getText(artboard, layer, layerData, data);
    },
    template: function(content, data) {
        var content = content.replace(new RegExp("\\<\\!\\-\\-\\s([^\\s\\-\\-\\>]+)\\s\\-\\-\\>", "gi"), function($0, $1) {
            if ($1 in data) {
                return data[$1];
            } else {
                return $0;
            }
        });
        return content;
    }
});
// end Export