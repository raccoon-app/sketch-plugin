// $(function() {
//     $(document)
//         .on('contextmenu', function(event){
//                 return false;
//             })
//         .keypress(function(event){
//                 var eventObj = event || e,
//                     keyCode = eventObj.keyCode || eventObj.which;
//
//                 if(keyCode == 13){
//                     event.stopPropagation();
//                     $('#submit:not(:disabled)').click();
//                     return false;
//                 }
//             });
// });
//
// function lookupItemInput(x, y){
//     var elem = document.elementFromPoint(x, y);
//     $(elem).click();
// }
//



window.onfocus = function() {
    trigger('focus');
};

var init = function(data) {

};


var View = function(data) {
    this.data = data;
    this.$container = $('.container');

    this.init();
};


$.extend(View.prototype, {
    init: function() {
        this.bind();

        if(this.data && this.data.user) {
            this.renderAuth();
        } else {
            this.renderExport();
        }
    },

    bind: function() {
        this.$container.on('submit', '.form', this.onAuth.bind(this));
    },

    onAuth: function(evt) {
        evt.preventDefault();
    },

    renderAuth: function() {
        this.$container.html([
            '<form class="form">',
            '<label class="label">email</label>',
            '<input type="email" class="form-control" name="user_email">',
            '<label class="label">password</label>',
            '<input type="password" class="form-control" name="user_password">',
            '<button type="submit">auth</button>',
            '</form>'
        ].join(''));
    },

    renderExport: function() {

        $.each(data.projects, function(index, page) {

        });
    }

});

var Render = {
    auth: function(data) {
        $('.container').html([
            '<form class="form">',
            '<label class="label">email</label>',
            '<input type="email" class="form-control" name="user_email">',
            '<label class="label">password</label>',
            '<input type="password" class="form-control" name="user_password">',
            '<button type="submit">auth</button>',
            '</form>'
        ].join(''));
    },
    export: function(data) {
        $('.container').html([
            '<form class="form">',
            '<label class="label">email</label>',
            '<input type="email" class="form-control" name="user_email">',
            '<label class="label">password</label>',
            '<input type="password" class="form-control" name="user_password">',
            '<button type="submit">auth</button>',
            '</form>'
        ].join(''));
    }
};

