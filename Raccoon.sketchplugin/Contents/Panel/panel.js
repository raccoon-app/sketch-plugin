var Panel = function(pluginContext, configs) {
    var defaultConfigs = {
        url: encodeURI("file://" + pluginContext.root + '/panel/index.html') ,
        width: 600,
        height: 360,
        hiddenClose: false,
        data: {},
        callback: function( data ){
            return data;
        },
        titleBgColor: NSColor.colorWithRed_green_blue_alpha(0.19, 0.19, 0.19, 1),
        contentBgColor: NSColor.colorWithRed_green_blue_alpha(0.15, 0.15, 0.15, 1)
    };

    configs = configs || {};

    this.configs = Object.assign({}, defaultConfigs, configs);
    this.pluginContext = pluginContext;
    this.$window = {};
    this.panel = {};

    this.show();
};

Object.assign(Panel.prototype, {
    show: function() {
        var _this = this;
        var result = false;
        var configs = this.configs;

        var Frame = NSMakeRect(0, 0, configs.width, (configs.height + 32));
        this.panel = NSPanel.alloc().init();
        this.panel.setTitleVisibility(NSWindowTitleHidden);
        this.panel.setTitlebarAppearsTransparent(true);
        this.panel.standardWindowButton(NSWindowCloseButton).setHidden(configs.hiddenClose);
        this.panel.standardWindowButton(NSWindowMiniaturizeButton).setHidden(true);
        this.panel.standardWindowButton(NSWindowZoomButton).setHidden(true);
        this.panel.setFrame_display(Frame, false);
        this.panel.setBackgroundColor(configs.contentBgColor);

        var contentView = this.panel.contentView();
        var webView = WebView.alloc().initWithFrame(NSMakeRect(0, 0, configs.width, configs.height));
        this.$window = webView.windowScriptObject();
        var MochaDelegate = new MochaJSDelegate({
            "webView:didFinishLoadForFrame:": (this.onFinishLoadForFrame.bind(this)),
            "webView:didChangeLocationWithinPageForFrame:": (this.onChangeLocationWithinPageForFrame.bind(this))
        });

        contentView.setWantsLayer(true);
        contentView.layer().setFrame( contentView.frame() );
        contentView.layer().setCornerRadius(6);
        contentView.layer().setMasksToBounds(true);

        webView.setBackgroundColor(configs.contentBgColor);
        webView.setFrameLoadDelegate_(MochaDelegate.getClassInstance());
        webView.setMainFrameURL_(configs.url);

        contentView.addSubview(webView);

        var closeButton = this.panel.standardWindowButton(NSWindowCloseButton);
        closeButton.setCOSJSTargetFunction(function(sender) {
            _this.close(_this.panel);
        });
        closeButton.setAction("callAction:");

        var titlebarView = contentView.superview().titlebarViewController().view();
        var titlebarContainerView = titlebarView.superview();

        closeButton.setFrameOrigin(NSMakePoint(8, 8));
        titlebarContainerView.setFrame(NSMakeRect(0, configs.height, configs.width, 32));
        titlebarView.setFrameSize(NSMakeSize(configs.width, 32));
        titlebarView.setTransparent(true);
        titlebarView.setBackgroundColor(configs.titleBgColor);
        titlebarContainerView.superview().setBackgroundColor(configs.titleBgColor);

        NSApp.runModalForWindow(this.panel);

        return result;
    },

    close: function(panel) {
        panel.orderOut(nil);
        NSApp.stopModal();
    },

    onFinishLoadForFrame: function(webView, webFrame){
        var PanelAction = [
                "function trigger(hash, data){",
                    "if(data){",
                        "window.PanelData = encodeURI(JSON.stringify(data));",
                    "}",
                    "window.location.hash = hash;",
                "}"
            ].join("");

        var DOMReady = [
                "$(",
                    "function(){",
                        "init(" + JSON.stringify(this.configs.data) + ")",
                    "}",
                ");"
            ].join("");

        this.$window.evaluateWebScript(PanelAction);
        this.$window.evaluateWebScript(DOMReady);
    },

    onChangeLocationWithinPageForFrame: function(webView, webFrame){
        var request = NSURL.URLWithString(webView.mainFrameURL()).fragment();
        var data;

        switch (request) {
            case 'submit':
                data = JSON.parse(decodeURI(this.$window.valueForKey("AppData")));
                this.configs.callback(data);

                this.$window.evaluateWebScript("window.location.hash = 'close';");

                break;

            case 'fetch':
                data = JSON.parse(decodeURI(this.$window.valueForKey("AppData")));
                this.configs.callback(data);

                this.$window.evaluateWebScript("window.location.hash = 'close';");

                this.pluginContext.message("Fetch complete!");

                break;

            case 'close':
                this.close(this.panel);

                break;

            case 'focus':
                var point = this.panel.currentEvent().locationInWindow();
                var y = NSHeight(this.panel.frame()) - point.y - 32;
                this.$window.evaluateWebScript("lookupItemInput(" + point.x + ", " + y + ")");

                break;
        }

        this.$window.evaluateWebScript("window.location.hash = '';");

    }
});


