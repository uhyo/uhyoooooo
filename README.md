# uhyoooooo
socket.io game engine module

# version
0\.0.1

## usage
    var uhyoooooo=require('uhyoooooo'), http=require('http');
    var srv=http.createServer();
    srv.on("request",function(req,res){
        res.serveClient();
    });
    srv.listen(8080);

    var app=uhyoooooo.createServer(srv);
    app.init("game.js",{
        title: "test game",
    });

## docs
* [Game APIs](docs/game.md)

## thanks
[EventEmitter](https://github.com/Wolfy87/EventEmitter)
