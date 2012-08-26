# game file spec
## game constructor
    var game = new Game();

## Game object properties

### Game#init
indicate [View](view.md) to use

    game.init(Game.ClientDOMView,{
        //Options
    });

### Game#start

    game.start();

register the client/user to the game(server).

### Game#useUser
indicate [User](user.md) to use

    game.useUser(Game.DOMUser,function(user){
    });

---
### Game#add
Add new **game object** to game.

    game.add(constructor,{
        //params
    });

## game objects
**Game objects constructor**: 3 args are given.

    function Constructor(game,event,param){
    }

* game: game objects
* event: EventEmitter associated with the instance(same as `this.event`)
* param: params object given to `game.add`

you can initialize the instance properties using `param`.

**`init` method**: same args are given.

    Constructor.prototype={
        init:function(game,event,param){
        }
    };

you may add event listeners on `event` in `init` method.

## Game events
`game` also has `event` property: EventEmitter.

### `gamestart` event
Fired automatically only once: when `game.start()` is called (on server).

    game.event.on("gamestart",function(){
        game.add(SomeObject);
    });

### `entry` event
Fired when new user entered( fired only once in standalone mode).

    game.event.on("entry",function(user){
    });

## User object
(see [User](user.md))

User object also have `event` property: EventEmitter.

You can initialize the user-input method by `game.useUser` callback:

    game.useUser(Game.DOMUser,function(user){
        document.addEventListener("click",function(e){
            //click event
            user.event.emit("click");
        },false);
    });

user object can be passed to `game.add` second arg -- can be one of properties of **game object**.
