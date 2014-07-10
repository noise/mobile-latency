
define(function(require, exports, module) {
    // import dependencies
    var Engine = require('famous/core/Engine');
    var Modifier = require('famous/core/Modifier');
    var StateModifier = require('famous/modifiers/StateModifier');
    var Transform = require('famous/core/Transform');
    var Surface = require('famous/core/Surface');
    var Draggable = require('famous/modifiers/Draggable');
    var Timer    = require('famous/utilities/Timer');

    var myName = 'p' + Math.floor(Math.random() * 1000);
    var myPos = [ Math.floor(Math.random() * 300) - 150, Math.floor(Math.random() * 300) - 150];

    var myBall = new Surface({
        content: '<br/>' + myName,
        size: [100, 100],
        properties: {
            backgroundColor: '#44CC44',
            borderRadius: '50px',
            textAlign: 'center',
        }
    });

    myBallZOrder = new StateModifier({
        transform: Transform.translate(0,0,10)
    });

    var others = {};

    function get_random_color() {
        return '#' + Math.random().toString(16).substring(4);
    }

    function randomColor(brightness){
        function randomChannel(brightness){
            var r = 255-brightness;
            var n = 0|((Math.random() * r) + brightness);
            var s = n.toString(16);
            return (s.length==1) ? '0'+s : s;
        }
        return '#' + randomChannel(brightness) + randomChannel(brightness) + randomChannel(brightness);
    }

    var draggable = new Draggable();
    draggable.subscribe(myBall);
    draggable.on('update', function(data) {
        myPos = data.position;
        sendUpdate();
    });
    draggable.on('end', function(data) {
        console.log(latencies);
    });

    // a modifier that centers the surface
    var centerModifier = new Modifier({origin : [0.5, 0.5]});

    // define the scene graph
    var mainContext = Engine.createContext();
    n1 = mainContext
         .add(centerModifier);
    n1.add(draggable)
        .add(myBallZOrder)
        .add(myBall);

    draggable.setPosition(myPos);
    console.log(draggable);
    
    var counter = 0;

    var host = location.origin.replace(/^http/, 'ws');
    
    var LATENCY_INTERVAL = 100;
    var LATENCY_SAMPLES = Math.floor(10000 / LATENCY_INTERVAL);
    var latencies = [];

    function sendUpdate() {
        msg = { 'type': 'update',
                'name': myName, 
                'pos': myPos,
                'ts': '' + new Date().getTime()};
        ws.send(JSON.stringify(msg));
    }
    
    function connect() {
        ws = new WebSocket(host);

        ws.onmessage = function (event) {
            data = JSON.parse(event.data);
            //console.log('onmessage, data:', data)

            name = data.name;
            //if (name === myName) {
            //    console.log('not listening to myself');
            //    return;
            //}
            
            switch (data.type) {
            case 'join':
                if (name in others) {
                    console.log(name, ' already in list, skipping add');
                    break;
                }
                if (!('pos' in data)) {
                    console.log('bad join message, no pos');
                    break;
                }
                console.log('adding new ball');
                var ball = Object({
                    name: name,
                    surface: new Surface({
                        content: '<br/>' + name,
                        size: (name === myName) ? [100, 100] : [80, 80],
                        properties: {
                            backgroundColor: (name === myName) ? '#339933' : randomColor(180),
                            borderRadius: (name === myName) ? '50px' : '40px',
                            textAlign: 'center',
                        }
                    }),
                    pos: data.pos,
                    mod: new Modifier({
                        transform : function(){
                            //console.log(data.pos)
                            return Transform.translate(ball.pos[0], ball.pos[1], 0);
                        }
                    })
                });
                n1.add(ball.mod).add(ball.surface);
                others[name] = ball;
                break;
            case 'update':
                if (name in others) {
                    // update position
                    others[name].pos = data.pos;
                }
                break;
            case 'leave':
                console.log(data);
                console.log(others);
                if (name in others) {
                    console.log('remove:', name, 'surface: ', others[name].surface);
                    // TODO: there is no remove
                    //n1.remove(others[name].surface)
                    //delete others[name];
                    others[name].pos = [-2000, -2000];
                }
                break;
            case 'ping':
                ws.send(JSON.stringify({type: 'pong', ts: data.ts}));
                break;
            case 'pong':
                //console.log(data);
                latency = new Date().getTime() - data.ts;
                latencies.push(latency);
                if (latencies.length > LATENCY_SAMPLES) {
                    latencies.shift();
                }
                s = latencies.slice(0).sort(function(a, b) { return a - b;});
                median = s[Math.floor(s.length/2)];
                myBall.setContent('<br/>' + myName + '<br/>med:' + median + 'ms<br/>' + latency + 'ms');
                break;
                
            } // switch
              
        }; // onmessage

        var pinger;
        ws.onopen = function() {
            console.log('open');
            msg = JSON.stringify({'type': 'join', 'name': myName, 'pos': myPos});
            console.log(msg);
            ws.send(msg);

            pinger = setInterval(function(){
                ws.send(JSON.stringify({type: 'ping', ts: new Date().getTime()}));
            }, LATENCY_INTERVAL);
        };
        
        ws.onclose = function(event) {
            console.log('close', event.code, event.reason);
            clearInterval(pinger);
            myBall.setContent('<br/>' + myName + '<br/>[closed]');
            setTimeout( function() {
                console.log('try to reconnect...');
                connect();
            }, 2000);
            // TODO: give up after N tries, display status, button for reconnect
        };

        return ws;
    } // connect

    var ws = connect();
    // TODO: track inactivity and close the conn after awhile, or at least stop sending pings
    // TODO: ui elements for: connection state, ping speed
    // TODO: physics
    // TODO: multiple units per player
    // TOOD: track bandwidth usage
});
