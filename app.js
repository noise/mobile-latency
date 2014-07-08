
var WebSocketServer = require("ws").Server;
var http = require("http");
var express = require("express");
var app = express();
var port = process.env.PORT || 5000;

app.use(express.static(__dirname + "/"));

var server = http.createServer(app);
server.listen(port);

console.log("http server listening on %d", port);

var wss = new WebSocketServer({server: server});

wss.broadcast = function (data, sender) {
    for (var i in this.clients) {
        if (this.clients[i] !== sender) {
            this.clients[i].send(data);
        }
    }
};

wss.on("connection", function(ws) {
    ws.id = ws.upgradeReq.connection.remoteAddress + ':' + ws.upgradeReq.connection.remotePort;
    console.log('conn:', ws.id);
    
    ws.on("close", function() {
        console.log("websocket connection close: ", ws.name);
        msg = JSON.stringify({'type': 'leave', 'name': ws.name});
        //console.log(msg);
        wss.broadcast(msg, ws);
        console.log('wss clients:');
        for (var i in wss.clients) {
            console.log(wss.clients[i].id);
        }
    });

    ws.on('error', function(error) {
        console.log('error:', error, ws.id);
    });
    
    ws.on('message', function(data, flags) {
        obj = JSON.parse(data);
        //console.log('got msg', data)

        if (obj.type === 'join') {
            ws.name = obj.name;
            ws.pos = obj.pos;
            ws.id += '/' + ws.name;
            console.log('join:', ws.id, data);
            wss.broadcast(data, ws);
        }
        else if (obj.type === 'ping') {
            ws.send(JSON.stringify({type: 'pong', ts: obj.ts}));
        } 
        else {
            // update
            ws.pos = obj.pos;
            wss.broadcast(data, ws);
        }

    });

    for (var i in wss.clients) {
        if (wss.clients[i] === ws) {
            continue;
        }
        msg = JSON.stringify({'type': 'join', 
                               'name': wss.clients[i].name,
                               'pos': wss.clients[i].pos
                               });
        ws.send(msg);
    }
});


// setInterval(function() {
//     console.log('pinging all clients')
//     wss.broadcast(JSON.stringify({type: 'ping', ts: new Date().getTime()}))
// }, 5000)

