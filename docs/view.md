# Game Views
**View** provides you rendering method: 2 Views are avaliable: ClientDOMView & ClientCanvasView.

View has **View Object** associated with `game`.

## ClientDOMView
**ClientDOMView** requires two methods of **game objects**: render & renderInit.

### renderInit
returns new dom node that renders the object.

    Foo.prototype.renderInit=function(view){
        return document.createElement("div");
    };

### render
edits dom node.

    Foo.prototype.render=function(view){
        var div=view.getItem();	//returns dom node created by renderInit
        div.textContent=this.status;
    };
---
ClientDOMView object has some methods:
### getItem
returns a dom node associated with **game object** being rendered.

If it doesnt exist, made by calling `renderInit`.

### newItem
returns a dom node like `getItem`, by always creating new node by `renderInit`.

### render
Takes one argument: another **game object**.

Renders the passed object and returns its dom node.

Now the caller object **depends** on the callee object.

### depend
Makes the caller object **depends** on the callee object like `render`.

But it doesnt render the callee object.
