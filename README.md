# uhyoooooo
socket.io game engine module

# version
0\.0\.3

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
* [Game APIs](https://github.com/uhyo/uhyoooooo/blob/master/docs/game.md)

## used module
[EventEmitter](https://github.com/Wolfy87/EventEmitter)

## changelogs
### 0\.0\.3
* Game#readfile: at server(node), BOM is removed from the top of text file.
* A bug of reconnection was fixed.
* EventEmitter for browsers are new. Now it's merged into engine.js.

### 0\.0\.2
* Game.Timer and Game#getTimer is added.
* Rerendering is improved. Less DOM nodes are rewrited.
* Game#getItem, game#newItem has a new attribute. It can be applied to any object.

