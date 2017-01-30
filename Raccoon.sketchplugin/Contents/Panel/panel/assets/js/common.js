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


function lookupItemInput(x, y){
    var elem = document.elementFromPoint(x, y);
    $(elem).click();
}


window.onfocus = function() {
    panelTrigger('focus');
};

var initView = function(data) {
    new View(data);
};


var View = function(data) {
    this.data = data;
    this.$container = $('.container');


    console.log('data');
    console.log(this.data);

    this.init();
};


$.extend(View.prototype, {
    init: function() {
        this.bind();


        console.log('init');

        if(this.data && this.data.projects) {
            this.renderExport();
        } else {
            this.renderAuth();
        }
    },

    bind: function() {
        this.$container.on('submit', '.form-auth', this.onAuth.bind(this));
    },

    onAuth: function(evt) {
        evt.preventDefault();

        console.log('onAuth');

        $.getJSON('https://randomuser.me/api/?results=1').done(function(response) {
            response = response || {results:[]};

            this.$container.find('.user').text(JSON.stringify(response.results[0]));

            this.data = {
                user: response.results[0],
                projects: [
                    {
                        id: '0002',
                        title: 'CTCO-MPOS'
                    },
                    {
                        id: '0001',
                        title: 'CTCO-FPOS'
                    }
                ]
            };

            panelTrigger('fetch', this.data);

            this.renderExport();
        }.bind(this));
    },

    renderAuth: function() {
        console.log('renderAuth');


        this.$container.html([
            '<form class="form form-auth" action="#">',
            '<label class="label">email</label>',
            '<input type="email" class="form-control" name="user_email">',
            '<label class="label">password</label>',
            '<input type="password" class="form-control" name="user_password">',
            '<button type="submit">auth</button>',
            '</form>'
        ].join(''));
    },

    renderExport: function() {
        console.log('renderExport');

        var template = [];

        template.push('<form class="form form-export"><ul class="project-list">');

        $.each(this.data.projects, function(index, item) {
            template.push(
                '<li class="project-item">',
                    '<label class="project-label">',
                        '<input type="radio" class="project-radio" name="projects" value="'+ item.id +'">',
                        '<span class="text">',
                        item.title,
                        '</span>',
                    '</label>',
                '</li>'
            );
        });

        template.push('</ul>',
            '<div class="export-info">',
            '<button type="submit">Start Export</button>',
            '</div>',
        '</form>');

        this.$container.html(template.join(''));
    }

});