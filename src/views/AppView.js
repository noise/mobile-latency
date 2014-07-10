define(function(require, exports, module) {
    var View = require('famous/core/View');
    var Modifier = require('famous/core/Modifier');
    var StateModifier = require('famous/modifiers/StateModifier');
    var Transform = require('famous/core/Transform');
    var Surface = require('famous/core/Surface');
    var Draggable = require('famous/modifiers/Draggable');

    function AppView() {
        View.apply(this, arguments);
        var appView = this;

        this.myName = 'p' + Math.floor(Math.random() * 1000);
        this.myPos = [ Math.floor(Math.random() * 300) - 150, Math.floor(Math.random() * 300) - 150];


        this.myBall = new Surface({
            content: '<br/>' + this.myName,
            size: [100, 100],
            properties: {
                backgroundColor: '#44CC44',
                borderRadius: '50px',
                textAlign: 'center',
            }
        });

        this.others = {};

        var draggable = new Draggable();
        draggable.subscribe(this.myBall);
        draggable.on('update', function(data) {
            this.myPos = data.position;
            appView._eventOutput.emit('updatePos', data.position);
        });
        draggable.on('end', function(data) {
            //console.log(latencies);
        });
        
        // a modifier that centers the surface
        var centerModifier = new Modifier({origin : [0.5, 0.5]});
        var myBallZOrder = new StateModifier({
            transform: Transform.translate(0,0,10)
        });

        // define the scene graph
        n1 = this
         .add(centerModifier);
        n1.add(draggable)
            .add(myBallZOrder)
            .add(this.myBall);

        draggable.setPosition(this.myPos);
        console.log(draggable);
    
    }

    AppView.prototype = Object.create(View.prototype);
    AppView.prototype.constructor = AppView;

    AppView.DEFAULT_OPTIONS = {};

    module.exports = AppView;

});
