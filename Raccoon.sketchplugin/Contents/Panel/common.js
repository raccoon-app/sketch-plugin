var I18N = {},
    webI18N = {
        "zh-Hans": "zh-cn",
        "zh-Hant": "zh-tw"
    },
    macOSVersion = NSDictionary.dictionaryWithContentsOfFile("/System/Library/CoreServices/SystemVersion.plist").objectForKey("ProductVersion") + "",
    lang = NSUserDefaults.standardUserDefaults().objectForKey("AppleLanguages").objectAtIndex(0),
    lang = (macOSVersion >= "10.12")? lang.split("-").slice(0, -1).join("-"): lang,
    language = "";

function _(str, data){
    var str = (I18N[lang] && I18N[lang][str])? I18N[lang][str]: str,
        idx = -1;
    return str.replace(/\%\@/gi, function(){
        idx++;
        return data[idx];
    });
}

var App = {
        init: function(context, command){
            this.prefs = NSUserDefaults.standardUserDefaults();
            this.context = context;

            this.version = this.context.plugin.version() + "";
            this.language = lang;
            this.AppVersion = this.prefs.stringForKey("AppVersion") + "" || 0;
            this.AppLanguage = this.prefs.stringForKey("AppLanguage") + "" || 0;

            this.extend(context);
            this.pluginRoot = this.scriptPath
                    .stringByDeletingLastPathComponent()
                    .stringByDeletingLastPathComponent()
                    .stringByDeletingLastPathComponent();
            this.pluginSketch = this.pluginRoot + "/Contents/Panel";

            if(NSFileManager.defaultManager().fileExistsAtPath(this.pluginSketch + "/i18n/" + lang + ".json")){
                language = NSString.stringWithContentsOfFile_encoding_error(this.pluginSketch + "/i18n/" + lang + ".json", 4, nil);

                I18N[lang] = JSON.parse(language);
                language = "I18N[\'" + webI18N[lang] + "\'] = " + language;
            }

            coscript.setShouldKeepAround(true);

            if(command && command == "init"){
                //this.checkUpdate();
                return false;
            }

            this.document = context.document;
            this.documentData = this.document.documentData();
            this.UIMetadata = context.document.mutableUIMetadata();
            this.window = this.document.window();
            this.pages = this.document.pages();
            this.page = this.document.currentPage();
            this.artboard = this.page.currentArtboard();
            this.current = this.artboard || this.page;

            this.configs = this.getConfigs();

            if(!this.configs && command &&  command != "settings"){
                if(!this.settingsPanel()) return false;
            }

            if(command){
                switch (command) {
                    case "exportable":
                        this.makeExportable();
                        break;
                    case "slice":
                        this.makeExportable(true);
                        break;
                    case "settings":
                        this.settingsPanel();
                        break;
                    case "export":
                        this.export();
                        break;
                }
            }
        },
        extend: function( options, target ){
            var target = target || this;

            for ( var key in options ){
                target[key] = options[key];
            }
            return target;
        }
    },
    BorderPositions = ["center", "inside", "outside"],
    FillTypes = ["color", "gradient"],
    GradientTypes = ["linear", "radial", "angular"],
    ShadowTypes = ["outer", "inner"],
    TextAligns = ["left", "right", "center", "justify", "left"],
    ResizingType = ["stretch", "corner", "resize", "float"];
App.extend({
    checkUpdate: function(){
        var self = this,
            webView = WebView.new(),
            windowObject = webView.windowScriptObject(),
            timestamp = new Date().getTime(),
            delegate = new MochaJSDelegate({
                "webView:didFinishLoadForFrame:": (function(webView, webFrame){
                    var packageJSON = JSON.parse(self.toJSString(windowObject.evaluateWebScript("document.body.innerText"))),
                        currentVersion = self.toJSString( self.context.plugin.version() ),
                        lastestVersion = self.toJSString( packageJSON.version ),
                        updated = self.prefs.integerForKey("AppUpdated") || 0;

                    if( lastestVersion > currentVersion && timestamp > (updated + 1000 * 60 * 60 * 24) ){
                        self.prefs.setInteger_forKey(timestamp, "AppUpdated");
                        self.AppPanel({
                            url: self.pluginSketch + "/panel/update.html",
                            width: 480,
                            height: 229,
                            hiddenClose: true,
                            data: {
                                title: _("New Version!"),
                                content: _("Just checked Sketch Measure has a new version (%@)", [packageJSON.version]),
                                donate: _("Donate"),
                                cancel: _("Cancel"),
                                download: _("Download")
                            },
                            callback: function( data ){
                                NSWorkspace.sharedWorkspace().openURL(NSURL.URLWithString("http://utom.design/measure/?ref=update"));
                            }
                        });
                    }
                })
            });
        webView.setFrameLoadDelegate_(delegate.getClassInstance());
        webView.setMainFrameURL_("http://utom.design/measure/package.json?" + timestamp);
    }
});

App.extend({
    prefix: "AppConfigs2",
    regexNames: /OVERLAY\#|WIDTH\#|HEIGHT\#|TOP\#|RIGHT\#|BOTTOM\#|LEFT\#|VERTICAL\#|HORIZONTAL\#|NOTE\#|PROPERTY\#|LITE\#/,
    colors: {
        overlay: {
            layer: { r: 1, g: 0.333333, b: 0, a: 0.3 },
            text: { r: 1, g: 1, b: 1, a: 1 }
        },
        size: {
            layer: { r: 1, g: 0.333333, b: 0, a: 1 },
            text: { r: 1, g: 1, b: 1, a: 1 }
        },
        spacing: {
            layer: { r: 0.313725, g: 0.890196, b: 0.760784, a: 1 },
            text: { r: 1, g: 1, b: 1, a: 1 }
        },
        property: {
            layer: { r: 0.960784, g: 0.650980, b: 0.137255, a: 1 },
            text: { r: 1, g: 1, b: 1, a: 1 }
        },
        lite: {
            layer: { r: 0.564706, g: 0.074510, b: 0.996078, a: 1 },
            text: { r: 1, g: 1, b: 1, a: 1 }
        },
        note: {
            layer: { r: 1, g: 0.988235, b: 0.862745, a: 1 },
            border: { r: 0.8, g: 0.8, b: 0.8, a: 1},
            text: { r: 0.333333, g: 0.333333, b: 0.333333, a: 1 }
        }
    }
});

// api.js
App.extend({
    is: function(layer, theClass){
        if(!layer) return false;
        var klass = layer.class();
        return klass === theClass;
    },
    addGroup: function(){
        return MSLayerGroup.new();
    },
    addShape: function(){
        var shape = MSRectangleShape.alloc().initWithFrame(NAppakeRect(0, 0, 100, 100));
        return MSShapeGroup.shapeWithPath(shape);
    },
    addText: function(container){
        var text = MSTextLayer.new();
        text.setStringValue("text");
        return text;
    },
    removeLayer: function(layer){
        var container = layer.parentGroup();
        if (container) container.removeLayer(layer);
    },
    getRect: function(layer){
     var rect = layer.absoluteRect();
        return {
            x: Math.round(rect.x()),
            y: Math.round(rect.y()),
            width: Math.round(rect.width()),
            height: Math.round(rect.height()),
            maxX: Math.round(rect.x() + rect.width()),
            maxY: Math.round(rect.y() + rect.height()),
            setX: function(x){ rect.setX(x); this.x = x; this.maxX = this.x + this.width; },
            setY: function(y){ rect.setY(y); this.y = y; this.maxY = this.y + this.height; },
            setWidth: function(width){ rect.setWidth(width); this.width = width; this.maxX = this.x + this.width; },
            setHeight: function(height){ rect.setHeight(height); this.height = height; this.maxY = this.y + this.height; }
        };
    },
    toNopPath: function(str){
        return this.toJSString(str).replace(/[\/\\\?]/g, " ");
    },
    toHTMLEncode: function(str){
        return this.toJSString(str)
                    .replace(/\</g, "&lt;")
                    .replace(/\>/g, '&gt;')
                    .replace(/\'/g, "&#39;")
                    .replace(/\"/g, "&quot;")
                    .replace(/\u2028/g,"\\u2028")
                    .replace(/\u2029/g,"\\u2029")
                    .replace(/\ud83c|\ud83d/g,"")
                ;
        // return str.replace(/\&/g, "&amp;").replace(/\"/g, "&quot;").replace(/\'/g, "&#39;").replace(/\</g, "&lt;").replace(/\>/g, '&gt;');
    },
    emojiToEntities: function(str) {
      var emojiRanges = [
            "\ud83c[\udf00-\udfff]", // U+1F300 to U+1F3FF
            "\ud83d[\udc00-\ude4f]", // U+1F400 to U+1F64F
            "\ud83d[\ude80-\udeff]"  // U+1F680 to U+1F6FF
          ];
        return str.replace(
              new RegExp(emojiRanges.join("|"), "g"),
              function(match) {
                  var c = encodeURIComponent(match).split("%"),
                      h = ((parseInt(c[1], 16) & 0x0F))
                        + ((parseInt(c[2], 16) & 0x1F) << 12)
                        + ((parseInt(c[3], 16) & 0x3F) << 6)
                        + (parseInt(c[4], 16) & 0x3F);
                  return "&#" + h.toString() + ";";
              });
    },
    toSlug: function(str){
        return this.toJSString(str)
                .toLowerCase()
                .replace(/(<([^>]+)>)/ig, "")
                .replace(/[\/\+\|]/g, " ")
                .replace(new RegExp("[\\!@#$%^&\\*\\(\\)\\?=\\{\\}\\[\\]\\\\\\\,\\.\\:\\;\\']", "gi"),'')
                .replace(/\s+/g,'-')
                ;
    },
    toJSString: function(str){
        return new String(str).toString();
    },
    toJSNumber: function(str){
        return Number( this.toJSString(str) );
    },
    pointToJSON: function(point){
        return {
            x: parseFloat(point.x),
            y: parseFloat(point.y)
        };
    },
    rectToJSON: function(rect, referenceRect) {
        if (referenceRect) {
            return {
                x: Math.round( ( rect.x() - referenceRect.x() ) * 10 ) / 10,
                y: Math.round( ( rect.y() - referenceRect.y() ) * 10 ) / 10,
                width: Math.round( rect.width() * 10 ) / 10,
                height: Math.round( rect.height() * 10 ) / 10
            };
        }

        return {
            x: Math.round( rect.x() * 10 ) / 10,
            y: Math.round( rect.y() * 10 ) / 10,
            width: Math.round( rect.width() * 10 ) / 10,
            height: Math.round( rect.height() * 10 ) / 10
        };
    },
    colorToJSON: function(color) {
        return {
            r: Math.round(color.red() * 255),
            g: Math.round(color.green() * 255),
            b: Math.round(color.blue() * 255),
            a: color.alpha(),
            "color-hex": color.immutableModelObject().stringValueWithAlpha(false) + " " + Math.round(color.alpha() * 100) + "%",
            "argb-hex": "#" + this.toHex(color.alpha() * 255) + color.immutableModelObject().stringValueWithAlpha(false).replace("#", ""),
            "css-rgba": "rgba(" + [
                            Math.round(color.red() * 255),
                            Math.round(color.green() * 255),
                            Math.round(color.blue() * 255),
                            (Math.round(color.alpha() * 100) / 100)
                        ].join(",") + ")",
            "ui-color": "(" + [
                            "r:" + (Math.round(color.red() * 100) / 100).toFixed(2),
                            "g:" + (Math.round(color.green() * 100) / 100).toFixed(2),
                            "b:" + (Math.round(color.blue() * 100) / 100).toFixed(2),
                            "a:" + (Math.round(color.alpha() * 100) / 100).toFixed(2)
                        ].join(" ") + ")"
        };
    },
    colorStopToJSON: function(colorStop) {
        return {
            color: this.colorToJSON(colorStop.color()),
            position: colorStop.position()
        };
    },
    gradientToJSON: function(gradient) {
        var stopsData = [],
            stop, stopIter = gradient.stops().objectEnumerator();
        while (stop = stopIter.nextObject()) {
            stopsData.push(this.colorStopToJSON(stop));
        }

        return {
            type: GradientTypes[gradient.gradientType()],
            from: this.pointToJSON(gradient.from()),
            to: this.pointToJSON(gradient.to()),
            colorStops: stopsData
        };
    },
    shadowToJSON: function(shadow) {
        return {
            type: shadow instanceof MSStyleShadow ? "outer" : "inner",
            offsetX: shadow.offsetX(),
            offsetY: shadow.offsetY(),
            blurRadius: shadow.blurRadius(),
            spread: shadow.spread(),
            color: this.colorToJSON(shadow.color())
        };
    },
    getRadius: function(layer){
        return ( layer.layers && this.is(layer.layers().firstObject(), MSRectangleShape) ) ? layer.layers().firstObject().fixedRadius(): 0;
    },
    getBorders: function(style) {
        var bordersData = [],
            border, borderIter = style.borders().objectEnumerator();
        while (border = borderIter.nextObject()) {
            if (border.isEnabled()) {
                var fillType = FillTypes[border.fillType()],
                    borderData = {
                        fillType: fillType,
                        position: BorderPositions[border.position()],
                        thickness: border.thickness()
                    };

                switch (fillType) {
                    case "color":
                        borderData.color = this.colorToJSON(border.color());
                        break;

                    case "gradient":
                        borderData.gradient = this.gradientToJSON(border.gradient());
                        break;

                    default:
                        continue;
                }

                bordersData.push(borderData);
            }
        }

        return bordersData;
    },
    getFills: function(style) {
        var fillsData = [],
            fill, fillIter = style.fills().objectEnumerator();
        while (fill = fillIter.nextObject()) {
            if (fill.isEnabled()) {
                var fillType = FillTypes[fill.fillType()],
                    fillData = {
                        fillType: fillType
                    };

                switch (fillType) {
                    case "color":
                        fillData.color = this.colorToJSON(fill.color());
                        break;

                    case "gradient":
                        fillData.gradient = this.gradientToJSON(fill.gradient());
                        break;

                    default:
                        continue;
                }

                fillsData.push(fillData);
            }
        }

        return fillsData;
    },
    getShadows: function(style) {
        var shadowsData = [],
            shadow, shadowIter = style.shadows().objectEnumerator();
        while (shadow = shadowIter.nextObject()) {
            if (shadow.isEnabled()) {
                shadowsData.push(this.shadowToJSON(shadow));
            }
        }

        shadowIter = style.innerShadows().objectEnumerator();
        while (shadow = shadowIter.nextObject()) {
            if (shadow.isEnabled()) {
                shadowsData.push(this.shadowToJSON(shadow));
            }
        }

        return shadowsData;
    },
    getOpacity: function(style){
        return style.contextSettings().opacity()
    },
    getStyleName: function(layer){
        var styles = (this.is(layer, MSTextLayer))? this.document.documentData().layerTextStyles(): this.document.documentData().layerStyles(),
            layerStyle = layer.style(),
            sharedObjectID = layerStyle.sharedObjectID(),
            style;

        styles = styles.objectsSortedByName();

        if(styles.count() > 0){
            style = this.find({key: "(objectID != NULL) && (objectID == %@)", match: sharedObjectID}, styles);
        }

        if(!style) return "";
        return this.toJSString(style.name());
    },
    updateContext: function(){
        this.context.document = NSDocumentController.sharedDocumentController().currentDocument();
        this.context.selection = this.context.document.selectedLayers();

        return this.context;
    }
});

// help.js
App.extend({
    mathHalf: function(number){
        return Math.round( number / 2 );
    },
    convertUnit: function(length, isText, percentageType){
        if(percentageType && this.artboard){
            var artboardRect = this.getRect( this.artboard );
            if (percentageType == "width") {
                 return Math.round((length / artboardRect.width) * 1000) / 10 + "%";

            }
            else if(percentageType == "height"){
                return Math.round((length / artboardRect.height) * 1000) / 10 + "%";
            }
        }

        var length = Math.round( length / this.configs.scale * 10 ) / 10,
            units = this.configs.unit.split("/"),
            unit = units[0];

        if( units.length > 1 && isText){
            unit = units[1];
        }

        return length + unit;
    },
    toHex:function(c) {
        var hex = Math.round(c).toString(16).toUpperCase();
        return hex.length == 1 ? "0" + hex :hex;
    },
    hexToRgb:function(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: this.toHex(result[1]),
            g: this.toHex(result[2]),
            b: this.toHex(result[3])
        } : null;
    },
    isIntersect: function(targetRect, layerRect){
        return !(
            targetRect.maxX <= layerRect.x ||
            targetRect.x >= layerRect.maxX ||
            targetRect.y >= layerRect.maxY ||
            targetRect.maxY <= layerRect.y
        );
    },
    getDistance: function(targetRect, containerRect){
        var containerRect = containerRect || this.getRect(this.current);

        return {
            top: (targetRect.y - containerRect.y),
            right: (containerRect.maxX - targetRect.maxX),
            bottom: (containerRect.maxY - targetRect.maxY),
            left: (targetRect.x - containerRect.x),
        }
    },
    message: function(message){
        this.document.showMessage(message);
    },
    find: function(format, container, returnArray){
        if(!format || !format.key  || !format.match){
            return false;
        }
        var predicate = NSPredicate.predicateWithFormat(format.key,format.match),
            container = container || this.current,
            items;

        if(container.pages){
            items = container.pages();
        }
        else if( this.is( container, MSSharedStyleContainer ) || this.is( container, MSSharedTextStyleContainer ) ){
            items = container.objectsSortedByName();
        }
        else if( container.children ){
            items = container.children();
        }
        else{
            items = container;
        }

        var queryResult = items.filteredArrayUsingPredicate(predicate);

        if(returnArray) return queryResult;

        if (queryResult.count() == 1){
            return queryResult[0];
        } else if (queryResult.count() > 0){
            return queryResult;
        } else {
            return false;
        }
    }
});
// end help.js


// configs.js
App.extend({
    getConfigs: function(container){
        var configsData;
        if(container){
            configsData = this.command.valueForKey_onLayer(this.prefix, container);
        }
        else{
            configsData = this.UIMetadata.objectForKey(this.prefix);
        }

        return JSON.parse(configsData);
    },
     setConfigs: function(newConfigs, container){
        var configsData;
        newConfigs.timestamp = new Date().getTime();
        if(container){
            configsData = this.extend(newConfigs, this.getConfigs(container) || {});
            this.command.setValue_forKey_onLayer(JSON.stringify(configsData), this.prefix, container);
        }
        else{
            configsData = this.extend(newConfigs, this.getConfigs() || {});
            this.UIMetadata.setObject_forKey (JSON.stringify(configsData), this.prefix);
        }
        var saveDoc = this.addShape();
        this.page.addLayers([saveDoc]);
        this.removeLayer(saveDoc);
        return configsData;
    },
    removeConfigs: function(container){
        if(container){
            this.command.setValue_forKey_onLayer(null, prefix, container);
        }
        else{
            configsData = this.UIMetadata.setObject_forKey (null, this.prefix);
        }

    }
});
// end configs.js


// Panel.js
App.extend({
    AppPanel: function(options){
        var self = this,
            options = this.extend(options, {
                url: this.pluginSketch + "/panel/settings.html",
                width: 240,
                height: 316,
                floatWindow: false,
                hiddenClose: false,
                data: {
                    density: 2,
                    unit: "dp/sp"
                },
                callback: function( data ){ return data; }
            }),
            result = false;
        options.url = encodeURI("file://" + options.url);

        var frame = NSMakeRect(0, 0, options.width, (options.height + 32)),
            titleBgColor = NSColor.colorWithRed_green_blue_alpha(0.1, 0.1, 0.1, 1),
            contentBgColor = NSColor.colorWithRed_green_blue_alpha(0.13, 0.13, 0.13, 1);

        if(options.identifier){
            var threadDictionary = NSThread.mainThread().threadDictionary();
            if(threadDictionary[options.identifier]){
                return false;
            }
        }

        var Panel = NSPanel.alloc().init();
        Panel.setTitleVisibility(NSWindowTitleHidden);
        Panel.setTitlebarAppearsTransparent(true);
        Panel.standardWindowButton(NSWindowCloseButton).setHidden(options.hiddenClose);
        Panel.standardWindowButton(NSWindowMiniaturizeButton).setHidden(true);
        Panel.standardWindowButton(NSWindowZoomButton).setHidden(true);
        Panel.setFrame_display(frame, false);
        Panel.setBackgroundColor(contentBgColor);

        var contentView = Panel.contentView(),
            webView = WebView.alloc().initWithFrame(NSMakeRect(0, 0, options.width, options.height)),
            windowObject = webView.windowScriptObject(),
            delegate = new MochaJSDelegate({
                "webView:didFinishLoadForFrame:": (function(webView, webFrame){
                        var AppAction = [
                                    "function AppAction(hash, data){",
                                        "if(data){",
                                            "window.AppData = encodeURI(JSON.stringify(data));",
                                        "}",
                                        "window.location.hash = hash;",
                                    "}"
                                ].join(""),
                            DOMReady = [
                                    "$(",
                                        "function(){",
                                            "init(" + JSON.stringify(options.data) + ")",
                                        "}",
                                    ");"
                                ].join("");

                    windowObject.evaluateWebScript(AppAction);
                    windowObject.evaluateWebScript(language);
                    windowObject.evaluateWebScript(DOMReady);
                }),
                "webView:didChangeLocationWithinPageForFrame:": (function(webView, webFrame){
                    var request = NSURL.URLWithString(webView.mainFrameURL()).fragment();

                    if(request == "submit"){
                        var data = JSON.parse(decodeURI(windowObject.valueForKey("AppData")));
                        options.callback(data);
                        result = true;
                        if(!options.floatWindow){
                            windowObject.evaluateWebScript("window.location.hash = 'close';");
                        }
                    }
                    else if(request == "fetch"){
                        //self.message(_(JSON.stringify(data)));

                        var dataFetch = JSON.parse(decodeURI(windowObject.valueForKey("AppData")));
                        options.callback(dataFetch);
                        if(!options.floatWindow){
                            windowObject.evaluateWebScript("window.location.hash = 'close';");
                        }

                        self.message(_("Fetch complete!"));

                        self.consolePanel(dataFetch);

                    }
                    else if(request == "close"){
                        if(!options.floatWindow){
                            Panel.orderOut(nil);
                            NSApp.stopModal();
                        }
                        else{
                            Panel.close();
                        }
                    }
                    else if(request == "import"){
                        if( options.importCallback(windowObject) ){
                            self.message(_("Import complete!"));
                        }
                    }
                    else if(request == "export"){
                        if( options.exportCallback(windowObject) ){
                            self.message(_("Export complete!"));
                        }
                    }
                    else if(request == "export-xml"){
                        if( options.exportXMLCallback(windowObject) ){
                            self.message(_("Export complete!"));
                        }
                    }
                    else if(request == "add"){
                        options.addCallback(windowObject);
                    }
                    else if(request == "focus"){
                        var point = Panel.currentEvent().locationInWindow(),
                            y = NSHeight(Panel.frame()) - point.y - 32;
                        windowObject.evaluateWebScript("lookupItemInput(" + point.x + ", " + y + ")");
                    }
                    windowObject.evaluateWebScript("window.location.hash = '';");
                })
            });

        contentView.setWantsLayer(true);
        contentView.layer().setFrame( contentView.frame() );
        contentView.layer().setCornerRadius(6);
        contentView.layer().setMasksToBounds(true);

        webView.setBackgroundColor(contentBgColor);
        webView.setFrameLoadDelegate_(delegate.getClassInstance());
        webView.setMainFrameURL_(options.url);

        contentView.addSubview(webView);

        var closeButton = Panel.standardWindowButton(NSWindowCloseButton);
        closeButton.setCOSJSTargetFunction(function(sender) {
            var request = NSURL.URLWithString(webView.mainFrameURL()).fragment();

            if(options.floatWindow && request == "submit"){
                data = JSON.parse(decodeURI(windowObject.valueForKey("AppData")));
                options.callback(data);
            }

            if(options.identifier){
                threadDictionary.removeObjectForKey(options.identifier);
            }

            self.wantsStop = true;
            if(options.floatWindow){
                Panel.close();
            }
            else{
                Panel.orderOut(nil);
                NSApp.stopModal();
            }

        });
        closeButton.setAction("callAction:");

        var titlebarView = contentView.superview().titlebarViewController().view(),
            titlebarContainerView = titlebarView.superview();
        closeButton.setFrameOrigin(NSMakePoint(8, 8));
        titlebarContainerView.setFrame(NSMakeRect(0, options.height, options.width, 32));
        titlebarView.setFrameSize(NSMakeSize(options.width, 32));
        titlebarView.setTransparent(true);
        titlebarView.setBackgroundColor(titleBgColor);
        titlebarContainerView.superview().setBackgroundColor(titleBgColor);

        if(options.floatWindow){
            Panel.becomeKeyWindow();
            Panel.setLevel(NSFloatingWindowLevel);
            Panel.center();
            Panel.makeKeyAndOrderFront(nil);
            if(options.identifier){
                threadDictionary[options.identifier] = Panel;
            }
            return webView;
        }
        else{
            if(options.identifier){
                threadDictionary[options.identifier] = Panel;
            }
            NSApp.runModalForWindow(Panel);
        }

        return result;
    },
    settingsPanel: function(){
        var self = this,
            data = {};

        if(this.configs){
            data.scale = this.configs.scale;
            data.unit = this.configs.unit;
            data.colorFormat = this.configs.colorFormat;
        }

        return this.AppPanel({
            width: 240,
            height: 316,
            data: data,
            callback: function( data ){

                //self.configs = self.setConfigs(data);
            }
        });

    },
    consolePanel: function(data){
        var self = this;

            data = data || {};

        return this.AppPanel({
            width: 240,
            height: 420,
            data: data,
            url: this.pluginSketch + "/panel/console.html",
            callback: function( data ){
                //self.configs = self.setConfigs(data);
            }
        });

    }
});
// end Panel.js


// exportable.js
App.extend({
    makeExportable: function(optionKey){
        if( this.selection.count() <= 0 ){
            this.message(_("Select a layer to add exportable!"));
            return false;
        }

        for (var i = 0; i < this.selection.count(); i++) {
            var layer = this.selection[i],
                slice = layer;

            if(optionKey && !this.is(layer, MSSliceLayer)){
                slice = MSSliceLayer.sliceLayerFromLayer(layer);

                var layerRect = this.getRect(layer),
                    sliceRect = this.getRect(slice);

                if(layerRect.width > sliceRect.width){
                    sliceRect.setX(layerRect.x);
                    sliceRect.setWidth(layerRect.width);
                }

                if(layerRect.height > sliceRect.height){
                    sliceRect.setY(layerRect.y);
                    sliceRect.setHeight(layerRect.height);
                }

                if(this.is(layer, MSLayerGroup)){
                    var sliceCopy = slice.copy();
                    layer.addLayers([sliceCopy]);

                    var sliceCopyRect = this.getRect(sliceCopy);
                    sliceCopyRect.setX(sliceRect.x);
                    sliceCopyRect.setY(sliceRect.y);
                    this.removeLayer(slice);
                    slice = sliceCopy;
                    slice.exportOptions().setLayerOptions(2);
                }
            }

            slice.exportOptions().removeAllExportFormats();

            var size = slice.exportOptions().addExportFormat();
                size.setName("");
                size.setScale(1);

            if(!optionKey || this.is(layer, MSSliceLayer)){
                layer.setIsSelected(0);
                layer.setIsSelected(1);
            }
            else if(sliceCopy){
                slice.setIsSelected(1);
            }

        };


    }
});
// end exportable.js


// export.js
App.extend({
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
// end export.js
