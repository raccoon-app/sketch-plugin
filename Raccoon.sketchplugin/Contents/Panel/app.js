

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
    },

    export: function() {

        // new Panel(this, {
        //     width: 600,
        //     height: 360,
        //     data: {},
        //     callback: function( data ){
        //     }
        // });
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
