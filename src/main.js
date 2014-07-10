
define(function(require, exports, module) {
    // import dependencies
    var Engine = require('famous/core/Engine');
    var Modifier = require('famous/core/Modifier');
    var Transform = require('famous/core/Transform');
    var Surface = require('famous/core/Surface');
    var Timer    = require('famous/utilities/Timer');
    var EventHandler = require('famous/core/EventHandler');
    var HeaderFooterLayout = require("famous/views/HeaderFooterLayout");
    var GridLayout = require("famous/views/GridLayout");

    var AppView = require('views/AppView');
    var mainContext = Engine.createContext();
    var appView = new AppView();
    var layout;

    var ACTIVE=true;

    function createLayout() {
        layout = new HeaderFooterLayout({
            headerSize: 50,
            footerSize: 100
        });
        console.log(layout);
        mainContext.add(layout);
    }

    function addHeader() {
        head = new Surface({
            content: 'Latency Tester [click to toggle active]',
            classes: ['grey-bg'],
            properties: {
                lineHeight: '50px',
                textAlign: 'center'
            }
        });

        head.on('click', function(event) {
            if (ACTIVE) {
                head.setContent('Latency Tester [STOPPED]');
                ACTIVE = false;
                ws.close();
            }
            else {
                head.setContent('Latency Tester [RUNNING]');
                ACTIVE = true;
                ws = connect();
            }
        });
        layout.header.add(head);
    }

    var PING_INTERVAL = 1000;
    var UPDATE_INTERVAL = 1;

    function addFooter() {

        var grid = new GridLayout({
            dimensions: [4, 2],
        });

        var surfaces = [];
        grid.sequenceFrom(surfaces);

        surfaces.push(new Surface({
            content: 'Ping: ',
            size: [undefined, undefined],
            styles: ['grey-bg']
        }));

        for (var i = 0; i < 3; i++) {
            var ms = Math.pow(10, i+1);
            ping = new Surface({
                content: ms + ' ms',
                size: [undefined, undefined],
                properties: {
                    backgroundColor: "rgb(140, 140," + (160 + 20 * i) + ")"
                }
            });
            ping.ms = ms;
            ping.on('click', function(event) {
                console.log(this.ms + ' ms');
                PING_INTERVAL = this.ms;
                clearPinger();
                setPinger();
            });
            surfaces.push(ping);
        }

        surfaces.push(new Surface({
            content: 'Update: ',
            size: [undefined, undefined],
            styles: ['grey-bg']
        }));
        for (var j = 0; j < 3; j++) {
            var ms = Math.pow(10, j);
            update = new Surface({
                content: ms + ' ms',
                size: [undefined, undefined],
                properties: {
                    backgroundColor: "rgb(140, " + (150 + 25 * j) + ", 140)"
                }
            });
            update.ms = ms;
            update.on('click', function(event) {
                console.log(this.ms + ' ms');
                UPDATE_INTERVAL = this.ms;
                clearUpdater();
                setUpdater();
            });
            surfaces.push(update);
        }

        layout.footer.add(grid);
    }

    createLayout();
    addHeader();
    layout.content.add(appView);
    addFooter();

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

   
    var counter = 0;

    var host = location.origin.replace(/^http/, 'ws');
    
    var LATENCY_SAMPLES = Math.floor(10000 / PING_INTERVAL);
    var latencies = [];
    var bytes = 0;
    var lastBytes = 0;
    var lastTime = 0;
    var BPS_SAMPLES = 10; // 1/sec
    var Bps = [];
    var BpsMed = 0;
    var BpsAvg = 0;
    var BpsMax = 0;


    var pinger;
    var bandwidth;
    var updater;
    function setPinger() {
        console.log('set pinger', PING_INTERVAL);
        pinger = Timer.setInterval(function(){
            //console.log('ping');
            send({type: 'ping', ts: new Date().getTime()});
        }, PING_INTERVAL);
    }
    function clearPinger() {
        Timer.clear(pinger);
    }

    function setBandwidther() {
        bandwidth = Timer.setInterval(function(){
            now = new Date().getTime();
            bps = Math.round((bytes - lastBytes)/((now - lastTime)/1000.0));
            lastTime = now;
            lastBytes = bytes;

            Bps.push(bps);
            if (Bps.length > BPS_SAMPLES) {
                Bps.shift();
            }
            s = Bps.slice(0).sort(function(a, b) { return a - b;});
            BpsMed = s[Math.floor(s.length/2)];
            BpsMax = Math.max(Bps)
            sum = Bps.reduce(function(a, b) { return a + b });
            BpsAvg = Math.round(sum / Bps.length);

        }, 250);
    }
    function clearBandwidther() {
        Timer.clear(bandwidth);
    }
    function setUpdater() {
        updater = Timer.setInterval(function() {
            if ( (currPos < lastPos || currPos > lastPos)) {
                sendPos(currPos);
                lastPos = currPos.slice(0);
            }
        }, UPDATE_INTERVAL);
    }
    function clearUpdater() {
        Timer.clear(updater);
    }


    function send(msg) {
        msg = JSON.stringify(msg);
        ws.send(msg);
        bytes += msg.length;
    }

    var currPos = [0,0];
    var lastPos = [0,0];

    function sendPos(pos) {
        msg = { 'type': 'update',
                'name': appView.myName, 
                'pos': pos,
                'ts': '' + new Date().getTime()};
        send(msg);
    }

    var networkEventHandler = new EventHandler();
    networkEventHandler.subscribe(appView);
    networkEventHandler.on('updatePos', function(pos) {
        if (UPDATE_INTERVAL === 1) {
            sendPos(pos);
        }
        else {
            currPos = pos;
        }
    });


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
            others = appView.others
            
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
                        content: '' + name,
                        size: (name === appView.myName) ? [100, 100] : [80, 80],
                        properties: {
                            backgroundColor: (name === appView.myName) ? '#339933' : randomColor(180),
                            borderRadius: (name === appView.myName) ? '50px' : '40px',
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
                send({type: 'pong', ts: data.ts});
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
                appView.myBall.setContent('' + appView.myName + '<br/>med:' + median + 'ms<br/>' + latency + ' ms<br/>' + BpsAvg + ' B/s');
                break;
                
            } // switch
              
        }; // onmessage



        ws.onopen = function() {
            console.log('open');
            msg = {'type': 'join', 'name': appView.myName, 'pos': appView.myPos};
            console.log(msg);
            send(msg);

            setPinger();
            setBandwidther();
            setUpdater();
        };
        
        ws.onclose = function(event) {
            console.log('close', event.code, event.reason);
            clearPinger();
            clearBandwidther();
            clearUpdater();
            appView.myBall.setContent('' + appView.myName + '<br/>[closed]');
            if (ACTIVE) {
                setTimeout( function() {
                    console.log('try to reconnect...');
                    connect();
                }, 2000);
            }
            // TODO: give up after N tries, display status, button for reconnect
        };

        return ws;
    } // connect

    var ws = connect();

    // TODO: track inactivity and close the conn after awhile, or at least stop sending pings
});
